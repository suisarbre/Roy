import type { Sex } from '../data';

/**
 * 결혼 행위자 모델의 타입. 설계와 근거는 src/sim/data/MARRIAGE.md, 보정 목표는
 * src/sim/data/marriage.ts(MARRIAGE_MOMENTS).
 *
 * 한 줄 요약: 기질·배경을 가진 두 사람이 매달 상황(특히 남편의 고용 충격)을 평가하고,
 * 대립/지지/중립 중 하나를 고르고, 그 행동이 공유된 결혼 만족도를 움직이고, 각자의 헌신
 * (만족도 + 투자 − 대안 + 장벽)이 낮아지면 떠난다. 이혼 확률은 어디에도 직접 적혀 있지 않다.
 */

export type Education = 'lessThanHighSchool' | 'highSchool' | 'someCollege' | 'bachelorsOrMore';
export const EDUCATIONS: readonly Education[] = ['lessThanHighSchool', 'highSchool', 'someCollege', 'bachelorsOrMore'];

/** 전부 모집단 평균 0, 표준편차 1인 z점수. */
export interface Traits {
  neuroticism: number;
  conscientiousness: number;
  agreeableness: number;
  openness: number;
  /** 돈 문제에 대한 불안 — 성격 5요인 밖이지만 금전 갈등 경로(Dew et al. 2012)의 입구. */
  financialAnxiety: number;
  /** 생계부양자 규범·결혼 규범에 대한 믿음(Killewald 2016의 "규범 위반" 경로). */
  traditionalism: number;
}

export interface Spouse {
  sex: Sex;
  birthYear: number;
  education: Education;
  traits: Traits;
  parentsDivorced: boolean;
}

export interface Couple {
  husband: Spouse;
  wife: Spouse;
  /** 결혼한 달(총 개월 수, gameDate.dateToTotalMonths 기준). */
  marriedAtMonth: number;
  husbandAgeAtMarriage: number;
  wifeAgeAtMarriage: number;
  /** 전업주부 여부 — Killewald(2016)상 이혼 위험에 대한 순효과는 ≈0이어야 한다. */
  wifeIsHomemaker: boolean;
  /** 희망 자녀 수의 개인차 잡음(표준정규). 실제 희망 수는 model.ts의 desiredChildrenFor가
   *  학력·전통성·파라미터와 합쳐 계산한다 — 파라미터가 바뀌어도 같은 부부가 나오게(공통 난수). */
  desiredChildren: number;
}

export type EmploymentState = 'employed' | 'unemployed' | 'disabled';
export type JobShockKind = 'layoff' | 'plantClosing' | 'disability';

export type Behavior = 'support' | 'neutral' | 'confront';

export type MarriageEndReason = 'divorce' | 'widowed' | 'censored';

/** 한 달치 기록 — 몬테카를로 집계(위험비 계산)와 장면 트레이스에 같이 쓴다. */
export interface MonthRecord {
  /** 결혼 후 경과 개월(0부터). */
  duration: number;
  husbandEmployment: EmploymentState;
  /** 이번 달 기준 가장 최근 고용 충격과 그 뒤 경과 개월. */
  lastShock?: JobShockKind;
  monthsSinceShock?: number;
  husbandBehavior: Behavior;
  wifeBehavior: Behavior;
  /** 이 달 행동이 금전 스트레스에서 촉발된 대립이었나(장면 렌더링 힌트). */
  financialConflict: boolean;
  satisfaction: number;
  husbandCommitment: number;
  wifeCommitment: number;
  divorcedThisMonth: boolean;
  /** 누가 떠났나(이혼한 달만). */
  leaver?: 'husband' | 'wife';
  /** 이번 달까지 태어난 자녀 수(이번 달 출생 포함). */
  childrenCount: number;
  /** 막내 나이(개월). 자녀가 없으면 undefined. */
  youngestChildAgeMonths?: number;
  birthThisMonth: boolean;
}

export interface MarriageOutcome {
  couple: Couple;
  endReason: MarriageEndReason;
  /** 결혼 지속 개월 수(이혼·사별·관측 종료 시점까지). */
  durationMonths: number;
  months: MonthRecord[];
  /** 결혼 중 출생한 달(결혼 후 경과 개월). */
  birthDurations: number[];
  /** 아내가 45세가 되기 전에 결혼이 (이혼 포함) 끝났거나 관측이 끝났는지와 무관하게, 아내가 45세까지
   *  생존했는가 — 완결 출산 집계의 모집단. */
  wifeReached45: boolean;
}

export interface SimulateOptions {
  /** 관측 종료: 남편 나이가 이 값에 도달하면 멈춘다(NLSY79 "55세까지"와 맞춤). */
  censorAtHusbandAge: number;
  /** 매개 검증용: true면 돈 스트레스가 대립 행동을 만들지 못한다(금전 갈등 경로 차단). */
  disableFinancialConflict?: boolean;
  /** 월별 기록을 남길지(집계엔 필요, 대량 보정 땐 요약만). 기본 true. */
  keepMonths?: boolean;
  /** 시나리오 데모용: 이 결혼 개월에 남편 고용 충격을 강제로 일으킨다. */
  forcedShock?: { atDuration: number; kind: JobShockKind };
}
