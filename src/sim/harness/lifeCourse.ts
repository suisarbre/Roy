import type { GameDate } from '../../game/types';
import { isInRecession, unemploymentRateAt } from '../data';
import type { Rng } from '../rng';
import type { DecayState, Thread } from '../threads/types';
import { ageBandMonthlyHazard, cumulativeToMonthlyHazard, gaussianAgeHazard, type AgeBandRate, type CumulativeAgeBand } from './hazards';

/**
 * 생애사건 스포너 — 3단계 하네스 전용. 실제 게임(gameLoop.ts)의 콘텐츠 레이어(7~8단계)가
 * 아니라, "무작위/일중독/가정적 봇이 사는 평범한 인생"이 실제 통계와 맞는지 검증하기 위한
 * 축약형 모델이다.
 *
 * 결혼은 진짜 decay 실타래로 존재한다(보드에 올라가고 봇의 관심 배분 대상이 된다) — 하지만
 * "이혼했는가"는 이 결혼 실타래가 fizzled됐는지가 아니라, 별도의 지속기간 기반 해저드로
 * 직접 판정한다. 처음엔 decay의 자연스러운 fizzle을 이혼으로 썼는데, 이 하네스에는 결혼
 * 실타래 말고는 경쟁할 다른 실타래가 없어서(일자리/자가보유는 아래처럼 카운터로만 추적)
 * attentionBudget을 사실상 독점해 거의 방치되는 일이 없었다 — 그 결과 이혼율이 0%로
 * 나왔다(1000명 시뮬레이션에서 실측). "여러 실타래가 관심을 두고 경쟁한다"는 제대로 된
 * 검증은 일/생계 실타래까지 실제로 모델링해야 가능한데, 그건 이 패스의 범위를 넘어선다 —
 * 지금은 decay 실타래를 "결혼이 존재한다"는 표식 + 나중 단계를 위한 자리로만 남겨두고,
 * 이혼율/지속기간 자체는 marriage.firstMarriageEndsInDivorce·
 * marriage.firstMarriageDurationBeforeDivorce 타깃에 직접 맞춘 해저드로 판정한다.
 *
 * 취업/자가보유는 처음부터 더 단순한 해저드+카운터로 추적한다(NLSY 타깃 자체가 "건수"라
 * 굳이 추구 실타래로 안 돌려도 됨).
 */

// ---- 결혼/이혼 ----

/** 형태(가우시안 피크 26세)는 가정, 크기(peakMonthlyRate)는 튜닝 대상 — meanAgeAtFirstMarriage=26,
 *  everMarriedBy55=0.85에 맞춘다. */
const FIRST_MARRIAGE_PEAK_AGE = 26.5;
const FIRST_MARRIAGE_SPREAD_YEARS = 3;
const FIRST_MARRIAGE_PEAK_RATE = 0.019;
/** 55세 넘어서도 완전히 0은 아니게 하는 바닥 해저드. */
const FIRST_MARRIAGE_TAIL_RATE = 0.0004;

/** 이혼 후 재혼은 첫 결혼보다 훨씬 빠르고 좁게 몰린다(평균 4.8년) — 이혼 시점부터 나이를 잰다. */
const REMARRIAGE_PEAK_YEARS_AFTER_DIVORCE = 4.8;
const REMARRIAGE_SPREAD_YEARS = 3;
const REMARRIAGE_PEAK_RATE = 0.014;

function firstMarriageMonthlyHazard(ageYears: number): number {
  if (ageYears < 18) return 0;
  return gaussianAgeHazard(ageYears, FIRST_MARRIAGE_PEAK_AGE, FIRST_MARRIAGE_SPREAD_YEARS, FIRST_MARRIAGE_PEAK_RATE) + FIRST_MARRIAGE_TAIL_RATE;
}

function remarriageMonthlyHazard(yearsSinceDivorce: number): number {
  return gaussianAgeHazard(yearsSinceDivorce, REMARRIAGE_PEAK_YEARS_AFTER_DIVORCE, REMARRIAGE_SPREAD_YEARS, REMARRIAGE_PEAK_RATE);
}

/** marriage.firstMarriageEndsInDivorce(0.43)·firstMarriageDurationBeforeDivorce(11.1년)에
 *  직접 맞춘 지속기간 기반 해저드. */
const DIVORCE_HAZARD_PEAK_YEARS = 10;
const DIVORCE_HAZARD_SPREAD_YEARS = 8;
const DIVORCE_HAZARD_PEAK_RATE = 0.0024;
const DIVORCE_HAZARD_TAIL_RATE = 0.00015;

function divorceMonthlyHazard(marriageDurationYears: number): number {
  return gaussianAgeHazard(marriageDurationYears, DIVORCE_HAZARD_PEAK_YEARS, DIVORCE_HAZARD_SPREAD_YEARS, DIVORCE_HAZARD_PEAK_RATE) + DIVORCE_HAZARD_TAIL_RATE;
}

/**
 * 결혼 하나를 나타내는 decay 실타래. decayRatePerMonth/criticalThreshold가 이혼율·지속기간을
 * 좌우하는 핵심 튜닝 지점. startingValue를 새 결혼(75, 갓 시작한 신뢰)과 resolved 재생성
 * (healthyLevel 근처, "지금 막 건강한 상태를 벗어난 시점부터 다시" — 매번 완전 회복으로
 * 리셋되면 방치가 절대 누적되지 않아서 이혼이 거의 안 나옴) 사이에서 다르게 준다.
 */
export function createMarriageThread(id: string, createdAtTurn: number, startingValue = 75): Thread {
  const state: DecayState = { value: startingValue, decayRatePerMonth: 0.05, criticalThreshold: 30, monthsHealthyStreak: 0 };
  return {
    id,
    domain: 'relationships',
    label: '결혼',
    origin: '생애사건 스포너',
    createdAtTurn,
    stakes: 0.7,
    interestEma: 0.4,
    fatigue: 0,
    shape: 'decay',
    state,
  };
}

// ---- 취업 ----

/** work.jobsHeld18to58 타깃의 연령대별 건수를 그대로 스폰 레이트로 쓴다 — 데이터가 이미
 *  "그 구간에 몇 번"이라 별도 형태 가정이 필요 없다. */
const JOB_CHANGE_BANDS: readonly AgeBandRate[] = [
  { ageFrom: 18, ageTo: 24, countInBand: 5.8 },
  { ageFrom: 24, ageTo: 34, countInBand: 4.7 },
  { ageFrom: 34, ageTo: 44, countInBand: 2.9 },
  { ageFrom: 44, ageTo: 54, countInBand: 2.1 },
  { ageFrom: 54, ageTo: 58, countInBand: 1.3 },
];

/** 실업 지속기간(개월) 기저치 — 전국 실업률 대비 배율로 스케일한다. */
const BASE_UNEMPLOYMENT_SPELL_MONTHS = 2.5;
const NATURAL_UNEMPLOYMENT_RATE = 0.05;

export function jobChangeMonthlyHazard(ageYears: number, currentDate: GameDate): number {
  const voluntary = ageBandMonthlyHazard(ageYears, JOB_CHANGE_BANDS);
  const recessionBump = isInRecession(currentDate) ? voluntary * 0.6 : 0;
  return voluntary + recessionBump;
}

export function expectedUnemploymentSpellMonths(currentDate: GameDate): number {
  const rate = unemploymentRateAt(currentDate.year) / 100;
  return BASE_UNEMPLOYMENT_SPELL_MONTHS * Math.max(0.5, rate / NATURAL_UNEMPLOYMENT_RATE);
}

// ---- 자가 보유 ----

/** housing.ts의 코호트 자가보유율(누적)을 그대로 해저드로 역산한다 — 여기도 형태 가정 불필요. */
const HOMEOWNERSHIP_CUMULATIVE_BANDS: readonly CumulativeAgeBand[] = [
  { ageFrom: 18, ageTo: 29, cumulativeByAgeEnd: 0.353 },
  { ageFrom: 29, ageTo: 34, cumulativeByAgeEnd: 0.516 },
  { ageFrom: 34, ageTo: 39, cumulativeByAgeEnd: 0.642 },
  { ageFrom: 39, ageTo: 44, cumulativeByAgeEnd: 0.717 },
  { ageFrom: 44, ageTo: 54, cumulativeByAgeEnd: 0.766 },
  { ageFrom: 54, ageTo: 64, cumulativeByAgeEnd: 0.812 },
  { ageFrom: 64, ageTo: 120, cumulativeByAgeEnd: 0.806 },
];

export function homeownershipMonthlyHazard(ageYears: number): number {
  return cumulativeToMonthlyHazard(ageYears, HOMEOWNERSHIP_CUMULATIVE_BANDS);
}

// ---- 생애사건 롤 ----

export interface LifeCourseState {
  maritalStatus: 'never' | 'married' | 'between';
  marriageCount: number;
  ageAtFirstMarriage?: number;
  marriageStartedAtMonth?: number;
  currentMarriageThreadId?: string;
  divorceCount: number;
  monthsSinceLastDivorce?: number;
  firstMarriageDurationYears?: number;
  firstMarriageEndedInDivorce?: boolean;
  remarriedAfterDivorce?: boolean;

  employed: boolean;
  jobsHeldCount: number;
  unemploymentMonthsRemaining: number;

  isHomeowner: boolean;
}

export function createInitialLifeCourseState(): LifeCourseState {
  return {
    maritalStatus: 'never',
    marriageCount: 0,
    divorceCount: 0,
    employed: false,
    jobsHeldCount: 0,
    unemploymentMonthsRemaining: 0,
    isHomeowner: false,
  };
}

export interface LifeCourseTickResult {
  newThread?: Thread;
  removeThreadId?: string;
}

/**
 * 한 달치 생애사건을 굴린다. resources는 읽기 전용으로만 쓴다(결혼 실타래 자체의 decay는
 * board.tickMonth가 처리 — 여기서는 "새로 결혼했는지/이혼으로 끝났는지"만 감지·기록한다).
 */
/**
 * 결혼 실타래(decay)가 이번 달에 보드에서 사라졌는데(fizzled 또는 resolved) 생애사건
 * 상으로는 아직 이혼 판정이 안 났으면(이혼은 divorceMonthlyHazard가 별도로 결정 — 위
 * 모듈 설명 참고), 추적용 실타래를 하나 새로 만들어 결혼이 계속 "존재"하게 한다.
 * runLife가 tickMonth 직후(이번 달에 divorceMonthlyHazard가 먼저 이혼을 이미 확정했는지
 * 안 것을 보고) 호출해야 한다.
 */
export function respawnMarriageThreadIfStillMarried(life: LifeCourseState, monthIndex: number, nextThreadId: () => string): Thread | undefined {
  if (life.maritalStatus !== 'married') return undefined;
  const id = nextThreadId();
  life.currentMarriageThreadId = id;
  // 완전 회복(75)이 아니라 건강 구간 경계값 근처에서 재시작 — 매번 완전 리셋되면 이 실타래
  // 자체의 상태가 "지금 결혼이 얼마나 힘든지"를 전혀 못 담게 된다.
  return createMarriageThread(id, monthIndex, 45);
}

export function tickLifeCourse(
  life: LifeCourseState,
  ageYears: number,
  currentDate: GameDate,
  monthIndex: number,
  nextThreadId: () => string,
  rng: Rng,
): LifeCourseTickResult {
  let newThread: Thread | undefined;
  let removeThreadId: string | undefined;

  if (life.maritalStatus === 'never' && rng() < firstMarriageMonthlyHazard(ageYears)) {
    const id = nextThreadId();
    newThread = createMarriageThread(id, monthIndex);
    life.maritalStatus = 'married';
    life.marriageCount = 1;
    life.ageAtFirstMarriage = ageYears;
    life.marriageStartedAtMonth = monthIndex;
    life.currentMarriageThreadId = id;
  } else if (life.maritalStatus === 'between') {
    life.monthsSinceLastDivorce = (life.monthsSinceLastDivorce ?? 0) + 1;
    if (rng() < remarriageMonthlyHazard(life.monthsSinceLastDivorce / 12)) {
      const id = nextThreadId();
      newThread = createMarriageThread(id, monthIndex);
      life.maritalStatus = 'married';
      life.marriageCount += 1;
      life.marriageStartedAtMonth = monthIndex;
      life.currentMarriageThreadId = id;
      life.remarriedAfterDivorce = true; // 재혼 "성사" 자체가 기준 — 이 결혼이 나중에 또
      // 끝나는지와 무관하다(끝날 때 기록하면 "재혼했지만 안 끝난" 사람이 누락된다).
    }
  } else if (life.maritalStatus === 'married') {
    const durationYears = (monthIndex - (life.marriageStartedAtMonth ?? monthIndex)) / 12;
    if (rng() < divorceMonthlyHazard(durationYears)) {
      removeThreadId = life.currentMarriageThreadId;
      if (life.marriageCount === 1) {
        life.firstMarriageEndedInDivorce = true;
        life.firstMarriageDurationYears = durationYears;
      }
      life.divorceCount += 1;
      life.maritalStatus = 'between';
      life.monthsSinceLastDivorce = 0;
      life.currentMarriageThreadId = undefined;
    }
  }

  // 취업 — 18세 미만은 노동시장 밖(취업 상태 진입 자체가 없음).
  if (ageYears >= 18) {
    if (!life.employed) {
      if (life.unemploymentMonthsRemaining > 0) {
        life.unemploymentMonthsRemaining -= 1;
      } else {
        life.employed = true;
        life.jobsHeldCount += 1;
      }
    } else if (rng() < jobChangeMonthlyHazard(ageYears, currentDate)) {
      life.employed = false;
      life.unemploymentMonthsRemaining = Math.max(1, Math.round(expectedUnemploymentSpellMonths(currentDate)));
    }
  }

  // 자가 보유
  if (!life.isHomeowner && rng() < homeownershipMonthlyHazard(ageYears)) {
    life.isHomeowner = true;
  }

  return { newThread, removeThreadId };
}
