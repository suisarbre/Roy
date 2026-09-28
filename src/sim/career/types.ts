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
  /** 기본 남성. 여성은 가구 상황(HouseholdContext)에 따라 가사·육아로 노동시장을 떠나고 돌아온다. */
  sex?: 'male' | 'female';
  /** 생계부양자·가족 규범에 대한 믿음(z) — 여성의 출산 후 이탈·복귀에 쓴다. */
  traditionalism?: number;
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
  /** 인종 — 행동 방정식에는 들어가지 않는다. 노동시장에서는 측정된 채용 차별(감사 연구)과 잔차 임금 격차로만. */
  race?: Race;
  /** 자란 동네(센서스 트랙트)의 빈곤율 0~1 — 학교(능력·학력)와 어릴 때 인맥(제안)에 들어갈 수 있다. */
  childhoodPoverty?: number;
  /** 부모 자산 순위(0~1) — 상속·생전 증여·계약금 도움. */
  parentWealthRank?: number;
  /** 외국 출생(이민 1세대) — 학력은 출신국 학교에서, 언어 임금 할인. */
  immigrant?: boolean;
}

export type Race = 'white' | 'black' | 'hispanic' | 'other';
export const RACES: readonly Race[] = ['white', 'black', 'hispanic', 'other'];

/**
 * 다른 도메인 모듈(건강·범죄·친족·주거)이 이 달의 경력에 주는 영향 — 세계 엔진이 모아서 넘긴다.
 * 배수는 모집단 평균이 1이 되도록 모듈 쪽에서 만든다(평균 보존 결합).
 */
export interface CareerModifiers {
  /** 수감 중: 일자리를 잃고 노동시장 밖(시설). 풀리면 실업에서 다시 시작. */
  blocked?: boolean;
  /** 일자리 제안 배수(전과 → 채용 벌점, 관계망 → 소개 등). */
  offerMultiplier?: number;
  /** 로그 임금 가산(전과 벌점 등). */
  wageShift?: number;
  /** 장애 해저드 배수(건강 자본). */
  disabilityMultiplier?: number;
  /** 건강 모듈이 이 달 근로 제한 장애가 생겼다고 정함(해저드와 별개로 강제). */
  disabilityOnset?: boolean;
  /** 해고 해저드 배수. */
  layoffMultiplier?: number;
  /** 이 달 들어온(나간) 목돈 — AWI 배수. 상속(+), 주택 계약금(−) 등. 연말 재산에 합산. */
  wealthTransfer?: number;
}

export type LaborState = 'student' | 'employed' | 'selfEmployed' | 'unemployed' | 'outOfLaborForce' | 'retired';

export type SeparationReason = 'incarceration' | 'family' | 'quit' | 'jobToJob' | 'layoff' | 'plantClosing' | 'disability' | 'retirement' | 'termEnd' | 'schoolExit' | 'businessStart';

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
  | 'retired'
  | 'leftForFamily'
  | 'returnedToWork'
  | 'incarcerated'
  | 'released';

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

/** 가구 상황 — 결혼 모델이 매달 넘긴다. */
export interface HouseholdContext {
  married: boolean;
  /** 막내 나이(개월). 자녀가 없으면 undefined. */
  youngestChildAgeMonths?: number;
  birthThisMonth: boolean;
  /** 배우자의 최근 연소득(AWI 배수). */
  spouseAnnualEarnings: number;
  /** 다른 모듈의 영향(세계 엔진). */
  modifiers?: CareerModifiers;
}

/**
 * 여성 노동 공급 파라미터 — 결혼·출산과 함께 보정된다(src/sim/life). 남성 경력 파라미터 위에 얹힌다.
 */
export interface WomenLaborParams {
  /** 여성 임금 로그 할인(직업 분리로 설명되지 않는 몫). */
  payGap: number;
  /** 출산한 달 노동시장을 떠날 로짓 절편. */
  homeExitBirth: number;
  homeExitTraditionalism: number;
  /** 대졸 이상은 덜 떠난다(기회비용). */
  homeExitCollege: number;
  /** 배우자 소득이 본인 임금보다 클수록 떠난다(로그 비당). */
  homeExitSpouseIncome: number;
  /** 가사 중 월간 복귀 로짓 절편. */
  homeReturnBase: number;
  /** 막내 나이 1년당 복귀 로짓 증가. */
  homeReturnChildAge: number;
  homeReturnTraditionalism: number;
  /** 결혼하지 않은(이혼한) 여성의 복귀 로짓 가산 — 생계 필요. */
  homeReturnSingle: number;
  /** 실업 → 비경제활동 배수(여성). */
  nilfMultiplier: number;
  /** 여성의 고졸 미만 이탈 배수(남성의 nilfLowEducation 대신; 고졸은 제곱근). */
  nilfLowEducation: number;
  /** 결혼한 여성이 실업 중 구직을 접고 가사로 가는 월간 로짓 절편(배우자 소득·전통성·학력 효과는 출산 이탈과 공유). */
  homeFromUnemployment: number;
  /** 여성 직업별 제안 가중치(CPS 1999 여성 분포에 비례 조정). */
  occupationWeights?: Partial<Record<string, number>>;
}

export interface SimulateCareerOptions {
  /** 여성이면 필요. */
  women?: WomenLaborParams;
  /** 이 나이(년)까지 시뮬레이션. 기본 72. */
  untilAge?: number;
  keepMonths?: boolean;
  /** 시나리오: 특정 나이(개월)에 첫 직업을 강제. */
  forcedFirstOccupation?: OccupationId;
}
