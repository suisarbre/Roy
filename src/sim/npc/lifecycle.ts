import type { GameDate } from '../../game/types';
import { monthlyDeathProbability } from '../data';
import { addMonths, ageInYearsAt, monthsBetween } from '../gameDate';
import { createInitialLifeCourseState, respawnMarriageThreadIfStillMarried, tickLifeCourse } from '../lifeCourse';
import type { Rng } from '../rng';
import type { ThreadEvent } from '../threads/board';
import { tickMonth } from '../threads/board';
import type { NpcSimRecord } from './types';

/** Roy의 attentionBudget(harness 튜닝 초안 2.5)보다 살짝 적게 잡은 임시값 — 밸런스 대상이
 *  아니라 "혼자 사는 삶에도 예산이 있어야 한다"는 자리 표시. */
const DEFAULT_NPC_ATTENTION_BUDGET = 2;

export interface CatchUpResult {
  npc: NpcSimRecord;
  /** close/foreground 구간에서 실제로 발생한 실타래 이벤트 — collision.ts가 소비한다. */
  events: ThreadEvent[];
  /** 이번 catchUp 도중 사망했으면 그 날짜. */
  diedAt?: GameDate;
}

/**
 * 지연 평가(lazy evaluation) — NPC의 lastSimulatedAt부터 currentDate까지 밀린 시간을 한
 * 번에 진행시킨다. LOD 승격 직후("승격 시 지연 평가", 설계 문서) 또는 오랜만에 이 NPC를
 * 다시 참조할 때 호출한다.
 *
 * 미확정(단순화): 구간 전체를 NPC의 *현재* lod 해상도로 진행시킨다 — 예를 들어 5년간
 * background였다가 지금 막 close로 승격됐으면, 그 5년 전부를 "월 틱 + 실타래 보드"로
 * 소급 시뮬레이션한다. "그때그때의 lod로" 진행시키는 게 더 정확하겠지만(과거엔
 * acquaintance였을 수도 있으므로), lod 이력을 따로 저장하지 않는 한 알 수 없다 — 지금은
 * "승격된 티어로 과거를 다시 쓴다"는 단순화를 택했다. 서사가 앞뒤 안 맞는 사례가 나오면
 * (예: "그때는 실타래가 없었어야 하는데" 같은 문제) 재검토할 것.
 */
export function catchUpNpc(npc: NpcSimRecord, currentDate: GameDate, rng: Rng): CatchUpResult {
  const totalMonths = monthsBetween(npc.lastSimulatedAt, currentDate);
  if (totalMonths <= 0 || !npc.alive) return { npc, events: [] };

  const hasBoard = npc.lod === 'close' || npc.lod === 'foreground';
  let life = npc.life ?? createInitialLifeCourseState();
  let board = npc.board;
  const events: ThreadEvent[] = [];
  let threadIdCounter = 0;
  const nextThreadId = () => `${npc.id}-t${threadIdCounter++}`;
  let date = npc.lastSimulatedAt;

  for (let month = 0; month < totalMonths; month++) {
    const ageYears = ageInYearsAt(npc.birthYear, date);

    if (rng() < monthlyDeathProbability(npc.birthYear, npc.sex, ageYears, 1)) {
      return { npc: { ...npc, life, board, alive: false, lastSimulatedAt: date }, events, diedAt: date };
    }

    const { newThread, removeThreadId } = tickLifeCourse(life, ageYears, date, month, nextThreadId, rng);

    if (hasBoard) {
      board ??= { threads: [], resources: { money: 0, stress: 0, attentionBudget: DEFAULT_NPC_ATTENTION_BUDGET } };
      let threads = board.threads;
      if (newThread) threads = [...threads, newThread];
      if (removeThreadId) threads = threads.filter((t) => t.id !== removeThreadId);

      const attended = npc.temperament.attend(threads, board.resources, rng);
      const result = tickMonth(threads, board.resources, date, attended, 1, rng);
      threads = result.threads;

      const marriageEnded = result.events.some((e) => e.threadId === life.currentMarriageThreadId && e.endedWith !== undefined);
      if (marriageEnded) {
        const replacement = respawnMarriageThreadIfStillMarried(life, month, nextThreadId);
        if (replacement) threads = [...threads, replacement];
      }

      board = { threads, resources: result.resources };
      events.push(...result.events);
    }
    // acquaintance는 board가 없다 — newThread가 생겨도(예: 결혼) 실타래에 올리지 않고
    // life 쪽 카운터(maritalStatus 등)만 유지한다(NpcLod 문서 참고).

    date = addMonths(date, 1);
  }

  return { npc: { ...npc, life, board, lastSimulatedAt: currentDate }, events };
}
