import type { OccupationId, Schooling } from './occupations';

/**
 * 경력·재산 행위자 모델의 타입.
 *
 * 한 줄 요약: 능력·성격·집안을 가진 한 사람이 학교를 마치고, 매달 일자리 제안을 받고(경기·인맥·
 * 학력이 제안의 수와 질을 정한다), 더 나은 짝이면 옮기고, 해고·공장 폐쇄·장애·창업·은퇴를 겪으며,
 * 번 돈을 성향대로 쓰고 모은다. 임금 곡선, 이직 횟수, 실직의 상처, 불황 졸업의 상처, 재산 분포는
 * 어디에도 직접 적혀 있지 않다 — 그 결과가 통계(data/work.ts)에 수렴하도록 파라미터를 맞춘다.
 *
 * 금액 단위는 전부 "그 해 SSA 평균임금(AWI)의 배수". 시대가 달라도 같은 의미를 갖고, 달러가 필요하면
 * averageAnnualWageAt(year)를 곱한다.
 */

export type Education = 'lessThanHighSchool' | 'highSchool' | 'someCollege' | 'bachelorsOrMore';
export const EDUCATIONS: readonly Education[] = ['lessThanHighSchool', 'highSchool', 'someCollege', 'bachelorsOrMore'];

/** 표준정규 z점수(평균 0, 표준편차 1). parentRank만 0~1 백분위. */
export interface WorkerTraits {
  /** 인지 능력 — 부모 순위와 상관(ρ = STRUCTURE.abilityParentCorrelation). */
  ability: number;
  conscientiousness: number;
  neuroticism: number;
  agreeableness: number;
  openness: number;
  extraversion: number;
  /** 위험 감수 — 창업, 판매·건설 직종 선호. */
  riskTolerance: number;
}

export interface Worker {
  birthYear: number;
  /** 생일 달(0~11). */
  birthMonth: number;
  traits: WorkerTraits;
  /** 부모 소득 백분위(0~1). */
  parentRank: number;
  /** 최종 학력(4단계; 대학원은 bachelorsOrMore). */
  education: Education;
  /** 세부 학력(석사·박사·전문). */
  schooling: Schooling;
  /** 전문대학원 종류. */
  degree?: 'law' | 'medicine' | 'doctorate';
  /** 학교를 마치는 나이(년, 소수). */
  schoolExitAge: number;
  /** 로스앤젤레스 거주 — 1987~95 항공우주 붕괴가 두 배로 세다. */
  losAngeles: boolean;
}

export type LaborState = 'student' | 'employed' | 'selfEmployed' | 'unemployed' | 'outOfLaborForce' | 'retired';

export type SeparationReason = 'quit' | 'jobToJob' | 'layoff' | 'plantClosing' | 'disability' | 'retirement' | 'termEnd' | 'schoolExit' | 'businessStart';

export interface JobSpell {
  employerId: number;
  occupation: OccupationId | 'selfEmployed';
  /** 나이(개월). */
  startAgeMonths: number;
  endAgeMonths?: number;
  endReason?: SeparationReason;
  /** 로그 임금(AWI 배수의 로그) — 시작과 끝. */
  startLogWage: number;
  endLogWage?: number;
  student: boolean;
}

export interface BusinessSpell {
  startAgeMonths: number;
  endAgeMonths?: number;
  /** 사업 품질(표준정규) — 운과 능력이 섞인 값. */
  quality: number;
}

/** 나이별 연간 요약(index = 나이). */
export interface YearRecord {
  age: number;
  year: number;
  employedMonths: number;
  selfEmployedMonths: number;
  unemployedMonths: number;
  outOfLaborForceMonths: number;
  studentMonths: number;
  /** 생일 달의 임금근로자 로그 임금(AWI 배수) — 아니면 NaN. */
  logWageAtBirthday: number;
  /** 생일 달 직업(임금근로자일 때). */
  occupationAtBirthday?: OccupationId;
  /** 생일 달 근속 6년 이상 임금근로자였나(Jacobson–LaLonde–Sullivan 표본 조건). */
  longTenureAtBirthday: boolean;
  /** 생일 달 항공우주 산업 고용주에서 일했나(직업이 관리자여도). */
  aerospaceIndustryAtBirthday: boolean;
  /** 연간 소득(AWI 배수) — 임금 + 자영업 + 실업급여 제외. */
  earnings: number;
  /** 연말 순자산(AWI 배수). */
  netWorth: number;
  /** 이 해(생일~다음 생일)에 공장 폐쇄·대량 해고로 밀려났나. */
  displaced: boolean;
  /** 이 해에 일반 해고를 겪었나. */
  laidOff: boolean;
}

export interface CareerOutcome {
  worker: Worker;
  years: YearRecord[];
  jobs: JobSpell[];
  businesses: BusinessSpell[];
  /** 학교를 마친 해의 실업률(%) — 불황 졸업 효과. */
  unemploymentAtSchoolExit: number;
  /** 월별 트레이스(장면 렌더링·데모용; keepMonths일 때만). */
  months?: MonthTrace[];
}

export type CareerEventKind =
  | 'schoolExit'
  | 'enlisted'
  | 'discharged'
  | 'hired'
  | 'jobToJob'
  | 'promoted'
  | 'promotedToManager'
  | 'quit'
  | 'laidOff'
  | 'plantClosing'
  | 'disabled'
  | 'leftLaborForce'
  | 'businessStarted'
  | 'businessClosed'
  | 'retired';

export interface MonthTrace {
  ageMonths: number;
  year: number;
  month: number;
  state: LaborState;
  occupation?: OccupationId;
  logWage?: number;
  netWorth: number;
  event?: string;
  eventKind?: CareerEventKind;
}

export interface SimulateCareerOptions {
  /** 이 나이(년)까지 시뮬레이션. 기본 72. */
  untilAge?: number;
  keepMonths?: boolean;
  /** 시나리오: 특정 나이(개월)에 첫 직업을 강제. */
  forcedFirstOccupation?: OccupationId;
}
