import type { GameDate } from '../../game/types';
import { monthlyDeathProbability } from '../data';
import { addMonths, ageInYearsAt, dateToTotalMonths, monthsBetween } from '../gameDate';
import {
  CAREER_EVENT_SALIENCE,
  FAMILY_EVENT_SALIENCE,
  careerEventsBetween,
  careerStatusAt,
  familyEventsBetween,
  storyOptionsFor,
  type CareerEvent,
} from '../person/careerTrack';
import type { FamilyEvent, LifeStoryOptions } from '../person/lifeStory';
import {
  createInitialLifeCourseState,
  createMarriageThread,
  homeownershipMonthlyHazard,
  respawnMarriageThreadIfStillMarried,
  tickLifeCourse,
  type LifeCourseState,
} from '../lifeCourse';
import type { Thread } from '../threads/types';
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
  /** 이 구간에 일어난 경력 사건(프로필 있는 NPC만, LOD와 무관 — 사실로서 기억 그래프에 들어갈 재료). */
  careerEvents: CareerEvent[];
  /** 이 구간의 결혼·출산·이혼·사별(프로필 있는 NPC만). */
  familyEvents: FamilyEvent[];
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
  if (totalMonths <= 0 || !npc.alive) return { npc, events: [], careerEvents: [], familyEvents: [] };

  const hasBoard = npc.lod === 'close' || npc.lod === 'foreground';
  let life = npc.life ?? createInitialLifeCourseState();
  let board = npc.board;
  const events: ThreadEvent[] = [];
  let threadIdCounter = 0;
  const nextThreadId = () => `${npc.id}-t${threadIdCounter++}`;
  let date = npc.lastSimulatedAt;

  // 프로필이 있으면 이 사람의 인생 이야기(sim/person/lifeStory: 경력 모델 + 결혼 모델)가 진실이다 —
  // lifeCourse.ts의 결혼·이혼·취업 기저 해저드를 쓰지 않는다. 이야기는 lifeSeed로 이미 정해져 있어서 이 구간의
  // 사건을 한 번에 꺼내 월별로 나눠 둔다. Roy의 배우자는 그 결혼이 플레이어 것이라 가족 사건을 만들지 않는다.
  const profile = npc.profile;
  const storyOptions: LifeStoryOptions = storyOptionsFor(npc.relationType);
  const careerByMonth = new Map<number, CareerEvent[]>();
  const familyByMonth = new Map<number, FamilyEvent[]>();
  const careerSeen: CareerEvent[] = [];
  const familySeen: FamilyEvent[] = [];
  if (profile) {
    for (const e of careerEventsBetween(profile, npc.lastSimulatedAt, currentDate, storyOptions)) {
      const key = dateToTotalMonths(e.date);
      careerByMonth.set(key, [...(careerByMonth.get(key) ?? []), e]);
    }
    for (const e of familyEventsBetween(profile, npc.lastSimulatedAt, currentDate, storyOptions)) {
      const key = dateToTotalMonths(e.date);
      familyByMonth.set(key, [...(familyByMonth.get(key) ?? []), e]);
    }
    if (storyOptions.marriedToRoy && life.maritalStatus !== 'married') {
      life = { ...life, maritalStatus: 'married', marriageCount: Math.max(1, life.marriageCount) };
    }
  }

  for (let month = 0; month < totalMonths; month++) {
    const ageYears = ageInYearsAt(npc.birthYear, date);

    if (rng() < monthlyDeathProbability(npc.birthYear, npc.sex, ageYears, 1)) {
      return { npc: { ...npc, life, board, alive: false, lastSimulatedAt: date }, events, diedAt: date, careerEvents: careerSeen, familyEvents: familySeen };
    }

    const careerEvents = careerByMonth.get(dateToTotalMonths(date)) ?? [];
    const familyEvents = familyByMonth.get(dateToTotalMonths(date)) ?? [];
    careerSeen.push(...careerEvents);
    familySeen.push(...familyEvents);
    let newThread: Thread | undefined;
    let removeThreadId: string | undefined;
    if (profile) {
      ({ newThread, removeThreadId } = applyStoryMonth(life, familyEvents, ageYears, month, nextThreadId, rng));
      const status = careerStatusAt(profile, date, storyOptions);
      life.employed = status?.state === 'employed' || status?.state === 'selfEmployed';
      life.jobsHeldCount = (npc.life?.jobsHeldCount ?? 0) + countJobStarts(careerByMonth, npc.lastSimulatedAt, date);
      life.unemploymentMonthsRemaining = 0;
    } else {
      ({ newThread, removeThreadId } = tickLifeCourse(life, ageYears, date, month, nextThreadId, rng));
    }

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
      // 경력 사건도 같은 이벤트 흐름으로 — collision.ts가 현저한 것(해고·공장 폐쇄 등)을 골라낸다.
      for (const e of careerEvents) {
        const { salience, domain } = CAREER_EVENT_SALIENCE[e.kind];
        events.push({ threadId: `${npc.id}-career`, domain, label: e.text, salience });
      }
      for (const e of familyEvents) {
        const { salience, domain } = FAMILY_EVENT_SALIENCE[e.kind];
        events.push({ threadId: `${npc.id}-family`, domain, label: FAMILY_LABEL_KO[e.kind], salience });
      }
    }
    // acquaintance는 board가 없다 — newThread가 생겨도(예: 결혼) 실타래에 올리지 않고
    // life 쪽 카운터(maritalStatus 등)만 유지한다(NpcLod 문서 참고).

    date = addMonths(date, 1);
  }

  return { npc: { ...npc, life, board, lastSimulatedAt: currentDate }, events, careerEvents: careerSeen, familyEvents: familySeen };
}

const FAMILY_LABEL_KO: Record<FamilyEvent['kind'], string> = { married: '결혼', childBorn: '아이가 태어남', divorced: '이혼', widowed: '배우자와 사별' };

/**
 * 인생 이야기의 이번 달 가족 사건을 lifeCourse 카운터에 반영한다(게임의 체크인 문장·기존 코드가 이 카운터를
 * 읽는다). 결혼하면 결혼 실타래를 만들고(가까운 NPC의 판에 올라간다), 끝나면 내린다. 자가 보유는 아직 모델이
 * 없어 lifeCourse.ts의 기저 해저드를 그대로 쓴다.
 */
function applyStoryMonth(
  life: LifeCourseState,
  familyEvents: readonly FamilyEvent[],
  ageYears: number,
  monthIndex: number,
  nextThreadId: () => string,
  rng: Rng,
): { newThread?: Thread; removeThreadId?: string } {
  let newThread: Thread | undefined;
  let removeThreadId: string | undefined;
  for (const e of familyEvents) {
    if (e.kind === 'married') {
      life.maritalStatus = 'married';
      life.marriageCount += 1;
      life.ageAtFirstMarriage ??= ageYears;
      life.marriageStartedAtMonth = monthIndex;
      const id = nextThreadId();
      life.currentMarriageThreadId = id;
      newThread = createMarriageThread(id, monthIndex);
    } else if (e.kind === 'childBorn') {
      life.childrenCount = (life.childrenCount ?? 0) + 1;
    } else {
      if (life.marriageCount === 1 && life.firstMarriageEndedInDivorce === undefined) {
        life.firstMarriageEndedInDivorce = e.kind === 'divorced';
        life.firstMarriageDurationYears = (monthIndex - (life.marriageStartedAtMonth ?? monthIndex)) / 12;
      }
      if (e.kind === 'divorced') life.divorceCount += 1;
      life.maritalStatus = 'between';
      life.monthsSinceLastDivorce = 0;
      removeThreadId = life.currentMarriageThreadId;
      life.currentMarriageThreadId = undefined;
    }
  }
  if (!life.isHomeowner && ageYears >= 18 && rng() < homeownershipMonthlyHazard(ageYears)) life.isHomeowner = true;
  return { newThread, removeThreadId };
}

/** 구간 시작부터 이 달까지(포함) 새로 시작한 일자리 수 — 취업·이직·창업·입대. */
function countJobStarts(careerByMonth: ReadonlyMap<number, readonly CareerEvent[]>, from: GameDate, through: GameDate): number {
  let count = 0;
  const end = dateToTotalMonths(through);
  for (const [month, list] of careerByMonth) {
    if (month < dateToTotalMonths(from) || month > end) continue;
    count += list.filter((e) => e.kind === 'hired' || e.kind === 'jobToJob' || e.kind === 'businessStarted' || e.kind === 'enlisted').length;
  }
  return count;
}
