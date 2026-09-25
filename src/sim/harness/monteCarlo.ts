import type { GameDate } from '../../game/types';
import { monthlyDeathProbability, type Sex } from '../data';
import { createRng } from '../rng';
import { tickMonth } from '../threads/board';
import type { SharedResources, Thread } from '../threads/types';
import type { PolicyBot } from './bots';
import { POLICY_BOTS } from './bots';
import { createInitialLifeCourseState, respawnMarriageThreadIfStillMarried, tickLifeCourse } from './lifeCourse';

/**
 * 헤드리스 몬테카를로 — LLM/브라우저 없이 인생을 순수 함수로 수천 번 돌려서, 정책 봇이
 * "사는" 인생의 분포가 실제 통계(validationTargets.ts)와 맞는지 확인한다. 모든 수치는
 * 시드 RNG 기반이라 완전히 재현 가능하다.
 */

const WORK_TRACK_START_AGE = 18;
const WORK_TRACK_END_AGE = 58;
const MAX_AGE_SAFETY_CAP = 112;

interface HomeownershipBand {
  ageFrom: number;
  ageTo: number;
}

const HOMEOWNERSHIP_BANDS: readonly HomeownershipBand[] = [
  { ageFrom: 25, ageTo: 29 },
  { ageFrom: 30, ageTo: 34 },
  { ageFrom: 35, ageTo: 39 },
  { ageFrom: 40, ageTo: 44 },
  { ageFrom: 45, ageTo: 54 },
  { ageFrom: 55, ageTo: 64 },
  { ageFrom: 65, ageTo: 120 },
];

function bandKey(band: HomeownershipBand): string {
  return `${band.ageFrom}to${band.ageTo}`;
}

export interface LifeOutcome {
  ageAtDeath: number;
  ageAtFirstMarriage?: number;
  marriageCount: number;
  firstMarriageEndedInDivorce: boolean;
  firstMarriageDurationYears?: number;
  remarriedAfterDivorce: boolean;
  jobsHeldCount: number;
  shareOfWeeksEmployed18to58?: number;
  homeownershipByBand: Record<string, number>;
}

/** 인생 하나를 시드로 결정론적으로 시뮬레이션한다. */
export function runLife(seed: number, bot: PolicyBot, birthYear = 1962, sex: Sex = 'male'): LifeOutcome {
  const rng = createRng(seed);
  let threads: Thread[] = [];
  let resources: SharedResources = { money: 0, stress: 0, attentionBudget: 2.5 };
  const life = createInitialLifeCourseState();
  let threadIdCounter = 0;
  const nextThreadId = () => `t${threadIdCounter++}`;

  let monthIndex = 0;
  let ageYears = 0;
  let currentDate: GameDate = { year: birthYear, month: 1 };

  const employedTracker = { months: 0, tracked: 0 };
  const homeownershipTracker: Record<string, { owned: number; total: number }> = {};
  for (const band of HOMEOWNERSHIP_BANDS) homeownershipTracker[bandKey(band)] = { owned: 0, total: 0 };

  while (ageYears <= MAX_AGE_SAFETY_CAP) {
    if (rng() < monthlyDeathProbability(birthYear, sex, ageYears, 1)) break;

    const { newThread, removeThreadId } = tickLifeCourse(life, ageYears, currentDate, monthIndex, nextThreadId, rng);
    if (newThread) threads = [...threads, newThread];
    // 이번 달 이혼 해저드가 발동했으면(tickLifeCourse가 이미 이혼으로 기록) 그 결혼
    // 실타래를 보드에서 바로 뺀다 — 더 이상 진행시킬 이유가 없다.
    if (removeThreadId) threads = threads.filter((t) => t.id !== removeThreadId);

    const attended = bot(threads, resources, rng);
    const result = tickMonth(threads, resources, currentDate, attended, 1, rng);
    threads = result.threads;
    resources = result.resources;

    // 결혼 실타래가 이번 tick으로 스스로 끝났는데(resolved/fizzled — decay 샤드 자체의
    // 일반 동작) 아직 "married" 상태면(이혼 해저드가 이번 달엔 안 걸렸으면) 추적용으로
    // 다시 하나 만든다.
    const marriageEnded = result.events.some((e) => e.threadId === life.currentMarriageThreadId && e.endedWith !== undefined);
    if (marriageEnded) {
      const replacement = respawnMarriageThreadIfStillMarried(life, monthIndex, nextThreadId);
      if (replacement) threads = [...threads, replacement];
    }

    if (ageYears >= WORK_TRACK_START_AGE && ageYears < WORK_TRACK_END_AGE) {
      employedTracker.tracked += 1;
      if (life.employed) employedTracker.months += 1;
    }
    for (const band of HOMEOWNERSHIP_BANDS) {
      if (ageYears >= band.ageFrom && ageYears < band.ageTo) {
        const bucket = homeownershipTracker[bandKey(band)];
        bucket.total += 1;
        if (life.isHomeowner) bucket.owned += 1;
      }
    }

    monthIndex += 1;
    const totalMonths = birthYear * 12 + monthIndex;
    currentDate = { year: Math.floor(totalMonths / 12), month: (totalMonths % 12) + 1 };
    ageYears = (totalMonths - birthYear * 12) / 12;
  }

  const homeownershipByBand: Record<string, number> = {};
  for (const [key, bucket] of Object.entries(homeownershipTracker)) {
    homeownershipByBand[key] = bucket.total > 0 ? bucket.owned / bucket.total : NaN;
  }

  return {
    ageAtDeath: ageYears,
    ageAtFirstMarriage: life.ageAtFirstMarriage,
    marriageCount: life.marriageCount,
    firstMarriageEndedInDivorce: life.firstMarriageEndedInDivorce ?? false,
    firstMarriageDurationYears: life.firstMarriageDurationYears,
    remarriedAfterDivorce: life.remarriedAfterDivorce ?? false,
    jobsHeldCount: life.jobsHeldCount,
    shareOfWeeksEmployed18to58: employedTracker.tracked > 0 ? employedTracker.months / employedTracker.tracked : undefined,
    homeownershipByBand,
  };
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface AggregatedStats {
  n: number;
  meanAgeAtDeath: number;
  survivalTo65: number;
  survivalTo85: number;
  everMarriedBy55: number;
  meanAgeAtFirstMarriage: number;
  firstMarriageEndsInDivorce: number;
  firstMarriageDurationBeforeDivorce: number;
  remarriedAfterDivorce: number;
  meanJobsHeld18to58: number;
  shareOfWeeksEmployed: number;
  homeownershipByBand: Record<string, number>;
}

export function aggregate(outcomes: readonly LifeOutcome[]): AggregatedStats {
  const n = outcomes.length;
  const survivedTo55 = outcomes.filter((o) => o.ageAtDeath >= 55);
  const everMarriedBy55 =
    survivedTo55.length > 0
      ? survivedTo55.filter((o) => o.ageAtFirstMarriage !== undefined && o.ageAtFirstMarriage <= 55).length / survivedTo55.length
      : NaN;

  const married = outcomes.filter((o) => o.ageAtFirstMarriage !== undefined);
  const divorced = married.filter((o) => o.firstMarriageEndedInDivorce);

  const homeownershipByBand: Record<string, number> = {};
  for (const band of HOMEOWNERSHIP_BANDS) {
    const key = bandKey(band);
    const values = outcomes.map((o) => o.homeownershipByBand[key]).filter((v) => !Number.isNaN(v));
    homeownershipByBand[key] = mean(values);
  }

  return {
    n,
    meanAgeAtDeath: mean(outcomes.map((o) => o.ageAtDeath)),
    survivalTo65: outcomes.filter((o) => o.ageAtDeath >= 65).length / n,
    survivalTo85: outcomes.filter((o) => o.ageAtDeath >= 85).length / n,
    everMarriedBy55,
    meanAgeAtFirstMarriage: mean(married.map((o) => o.ageAtFirstMarriage!)),
    firstMarriageEndsInDivorce: married.length > 0 ? divorced.length / married.length : NaN,
    firstMarriageDurationBeforeDivorce: mean(divorced.map((o) => o.firstMarriageDurationYears!)),
    remarriedAfterDivorce: divorced.length > 0 ? divorced.filter((o) => o.remarriedAfterDivorce).length / divorced.length : NaN,
    meanJobsHeld18to58: mean(outcomes.map((o) => o.jobsHeldCount)),
    shareOfWeeksEmployed: mean(outcomes.map((o) => o.shareOfWeeksEmployed18to58).filter((v): v is number => v !== undefined)),
    homeownershipByBand,
  };
}

export function runMonteCarlo(n: number, botName: keyof typeof POLICY_BOTS, seedOffset = 0): AggregatedStats {
  const bot = POLICY_BOTS[botName];
  const outcomes: LifeOutcome[] = [];
  for (let i = 0; i < n; i++) {
    outcomes.push(runLife(seedOffset + i, bot));
  }
  return aggregate(outcomes);
}
