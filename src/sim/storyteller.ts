import type { GameDate } from '../game/types';
import type { PolicyBot } from './attend';
import { addMonths, dateToTotalMonths } from './gameDate';
import type { Rng } from './rng';
import { computeSalience, rollJuxtapositionBonus, type JuxtapositionState } from './salience';
import type { ThreadEvent } from './threads/board';
import { tickMonth } from './threads/board';
import type { SharedResources, Thread } from './threads/types';

/**
 * 편집 = 문턱(threshold cut) — 설계 문서의 "5단계" 항목. 월 단위로 조용히 시뮬레이션하다
 * 현저성이 문턱을 넘으면 장면화한다("드라마는 지루한 부분을 잘라낸 인생"). LLM은 여기 없다 —
 * "장면화할지 말지"와 "여럿이면 뭘 고를지"는 전부 결정적/시드 rng 기반 순수 함수라 봇으로
 * 검증 가능하다(npc/demo.ts와 같은 방식). 실제 서술은 7단계에서 LLM이 이 결과를 받아 쓴다.
 */

export interface SceneCandidate {
  thread: Thread;
  event: ThreadEvent;
  salience: number;
}

export interface SelectSceneResult {
  /** 문턱을 넘겨 소프트맥스로 뽑힌 장면 — 없으면(조용히 지나간 달) undefined. */
  scene?: SceneCandidate;
  /** 문턱을 넘은 후보 전부(디버깅/튜닝용 — 실제 선택은 scene 하나뿐). */
  eligible: SceneCandidate[];
  juxtapositionState: JuxtapositionState;
}

/**
 * threshold 이상인 후보 중 하나를 salience 가중 소프트맥스로 뽑는다 — 항상 최댓값만
 * 뽑히면 다양성이 없다(설계 문서). threshold는 "서사 밀도"로 플레이어가 조절 가능한 값 —
 * 낮을수록 장면이 잦아진다.
 *
 * preTickThreads는 tickMonth에 넘겼던 *그 tick 시작 시점*의 목록이어야 한다 — 이번 tick에
 * 종료된(resolved 등) 실타래도 events엔 남아 있는데, tickMonth가 끝난 뒤의 threads
 * 목록에서는 이미 사라졌거나(종료) 다른 id로 바뀌어(전환) 있어서 못 찾는다.
 */
export function selectScene(
  preTickThreads: readonly Thread[],
  events: readonly ThreadEvent[],
  threshold: number,
  currentMonth: number,
  juxtapositionState: JuxtapositionState,
  rng: Rng,
): SelectSceneResult {
  const threadById = new Map(preTickThreads.map((thread) => [thread.id, thread] as const));
  const rawCandidates: SceneCandidate[] = [];
  for (const event of events) {
    const thread = threadById.get(event.threadId);
    if (!thread) continue;
    rawCandidates.push({ thread, event, salience: computeSalience({ thread, urgency: event.salience }) });
  }

  const { bonus, state: nextJuxtapositionState } = rollJuxtapositionBonus(
    events.map((event) => event.salience),
    currentMonth,
    juxtapositionState,
    rng,
  );
  const candidates = bonus > 0 ? rawCandidates.map((candidate) => ({ ...candidate, salience: candidate.salience + bonus })) : rawCandidates;

  const eligible = candidates.filter((candidate) => candidate.salience >= threshold);
  const scene = eligible.length > 0 ? softmaxSample(eligible, rng) : undefined;

  return { scene, eligible, juxtapositionState: nextJuxtapositionState };
}

function softmaxSample(candidates: readonly SceneCandidate[], rng: Rng): SceneCandidate {
  const weights = candidates.map((candidate) => Math.exp(candidate.salience));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

const FATIGUE_GAIN_ON_SCENE = 0.4;
/** 월간 지수 감쇠 — 미확정, 튜닝 대상. */
const FATIGUE_DECAY_RATE = 0.15;

/**
 * tickMonth가 끝난 뒤의(post-tick) threads에 피로를 반영한다 — 이번 달 장면으로 뽑힌
 * 실타래는 fatigue가 오르고(같은 실타래가 매번 장면을 독점하지 못하게), 나머지는 시간이
 * 지나며 서서히 식는다. lastSceneAtTurn은 game/의 turnIndex(스킵+디테일 합산 카운터)가
 * 아직 sim/에 없어서 월수(dateToTotalMonths)로 대신한다 — 8단계에서 진짜 turnIndex가
 * 붙으면 재검토할 것.
 */
export function applyStorytellerFatigue(threads: readonly Thread[], sceneThreadId: string | undefined, currentDate: GameDate): Thread[] {
  const currentMonth = dateToTotalMonths(currentDate);
  return threads.map((thread) => {
    const decayed = thread.fatigue * (1 - FATIGUE_DECAY_RATE);
    if (thread.id !== sceneThreadId) return { ...thread, fatigue: decayed } as Thread;
    return { ...thread, fatigue: Math.min(1, decayed + FATIGUE_GAIN_ON_SCENE), lastSceneAtTurn: currentMonth } as Thread;
  });
}

export interface SimulateUntilSceneResult {
  monthsElapsed: number;
  threads: Thread[];
  resources: SharedResources;
  scene?: SceneCandidate;
  juxtapositionState: JuxtapositionState;
  /** 매달의 이벤트 로그(장면이 안 나온 조용한 달도 포함) — 통계/디버깅용. */
  monthlyEvents: ThreadEvent[][];
}

/** 문턱을 못 넘고 계속 조용하면 그래도 어디선가는 멈춰야 한다는 안전판 — 예전 gameLoop.ts의
 *  "씬 교환 캡(12)"과 같은 역할이지만 조금 더 넉넉하게 잡았다. 미확정, 튜닝 대상. */
export const DEFAULT_MAX_SILENT_MONTHS = 24;

/**
 * "시간은 미리 정한 만큼이 아니라 의미 있는 일이 생길 때까지 흘러야 한다"(설계 문서)의
 * 실제 구현. 매달 조용히 tickMonth를 돌리다가 selectScene이 뭔가를 뽑으면 그 자리에서
 * 멈춘다. gameLoop.ts의 고정 범위 스킵(6~18개월)을 대체할 sim/ 쪽 원형 — 아직 game/에
 * 연결하진 않았다(8단계).
 */
export function simulateUntilScene(
  threads: readonly Thread[],
  resources: SharedResources,
  startDate: GameDate,
  attend: PolicyBot,
  threshold: number,
  juxtapositionState: JuxtapositionState,
  rng: Rng,
  maxMonths = DEFAULT_MAX_SILENT_MONTHS,
): SimulateUntilSceneResult {
  let currentThreads: Thread[] = [...threads];
  let currentResources = resources;
  let currentJuxtapositionState = juxtapositionState;
  const monthlyEvents: ThreadEvent[][] = [];

  for (let month = 0; month < maxMonths; month++) {
    const date = addMonths(startDate, month);
    const attended = attend(currentThreads, currentResources, rng);
    const result = tickMonth(currentThreads, currentResources, date, attended, 1, rng);
    monthlyEvents.push(result.events);

    const { scene, juxtapositionState: nextJuxtapositionState } = selectScene(
      currentThreads,
      result.events,
      threshold,
      dateToTotalMonths(date),
      currentJuxtapositionState,
      rng,
    );
    currentJuxtapositionState = nextJuxtapositionState;
    currentThreads = applyStorytellerFatigue(result.threads, scene?.thread.id, date);
    currentResources = result.resources;

    if (scene) {
      return {
        monthsElapsed: month + 1,
        threads: currentThreads,
        resources: currentResources,
        scene,
        juxtapositionState: currentJuxtapositionState,
        monthlyEvents,
      };
    }
  }

  return {
    monthsElapsed: maxMonths,
    threads: currentThreads,
    resources: currentResources,
    scene: undefined,
    juxtapositionState: currentJuxtapositionState,
    monthlyEvents,
  };
}
