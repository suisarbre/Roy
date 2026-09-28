import type { CareerStepResult } from '../career/model';
import type { CareerModifiers, LaborState } from '../career/types';
import type { Sex } from '../data';
import type { Rng } from '../rng';

/**
 * 도메인 모듈 계약 — 건강·범죄·친족·주거가 세계(World)에 붙는 방법. REALISM_V2.md "모듈 계약" 참고.
 *
 * - 모듈은 사람마다 자기 상태(S)를 갖고, 세계가 매달 `step`을 부른다. 상태는 직렬화 가능한 순수 데이터로.
 * - 모듈은 **자기 상태만** 바꾸고 사건(DomainEvent)을 돌려준다. 다른 도메인에 대한 영향은 선언형 훅으로만:
 *   경력(`careerModifiers`), 관계(`unionEffects`), 만남(`meetMultiplier`), 사망(`deathProbability`).
 *   세계가 모든 모듈의 훅을 모아 합친다(배수는 곱, 가산은 합).
 * - 다른 모듈의 상태는 `WorldMonthInputs`의 요약(health/crime/place/kin)으로만 읽는다 — 서로 직접 import하지 않는다.
 * - 평균 보존 결합: 이미 보정된 모듈(경력·결혼)의 해저드를 바꾸는 배수는 모집단 평균이 1에 가깝게 만든다.
 * - 난수: `ctx.rng(slot)` — (사람 시드, 달, 도메인, 슬롯)으로 새로 시작하는 난수열. 슬롯을 바꾸면 독립.
 */

export type DomainName = 'health' | 'crime' | 'kin' | 'place';

/** 건강 모듈이 매달 공개하는 요약. */
export interface HealthSummary {
  /** 건강 자본(z, 높을수록 건강) — 16세 모집단 평균 0 기준. */
  capital: number;
  smoker: boolean;
  heavyDrinker: boolean;
  obese: boolean;
  /** 진단받은 만성질환 수(심혈관·암·당뇨·만성폐질환 등). */
  chronicConditions: number;
  /** 근로 제한 장애(경력 모델의 disabled와 맞춰진다). */
  workLimitingDisability: boolean;
  /** 지금 우울 삽화 중. */
  depressed: boolean;
  /** 약물·알코올 사용 장애. */
  substanceUseDisorder: boolean;
}

/** 범죄 모듈 요약. */
export interface CrimeSummary {
  /** 교도소·구치소에 있다(이번 달). */
  incarcerated: boolean;
  /** 보호관찰·가석방 중. */
  supervised: boolean;
  everArrested: boolean;
  convictions: number;
  /** 주 교도소(1년 이상 형) 경험 — 누적 수감 위험 적률의 정의. */
  everPrison: boolean;
  /** 마지막 석방 뒤 개월(석방된 적 없으면 undefined). */
  monthsSinceRelease?: number;
}

/** 주거·관계망 모듈 요약. */
export interface PlaceSummary {
  /** 지금 사는 동네(센서스 트랙트)의 빈곤율 0~1. */
  neighborhoodPoverty: number;
  tenure: 'withParents' | 'renter' | 'owner' | 'institution';
  laResident: boolean;
  /** 지금 주소에 산 개월. */
  monthsAtAddress: number;
  /** 가까운 관계(던바 5–15층) 수. */
  closeTies: number;
}

/** 친족 모듈 요약. */
export interface KinSummary {
  motherAlive: boolean;
  fatherAlive: boolean;
  /** 노부모(또는 가족) 돌봄 중. */
  caregiving: boolean;
  siblings: number;
}

/** 세계가 매달 각 모듈에 넘기는 사실. 이 달의 경력·관계가 정해진 뒤에 만든다. */
export interface WorldMonthInputs {
  /** 총 개월(연도×12 + 월). */
  month: number;
  year: number;
  ageMonths: number;
  sex: Sex;
  focal: boolean;
  // ---- 일·돈(경력 모델) ----
  /** 이 달 경력 결과(같이 살지 않는 상대처럼 경력을 계산하지 않는 사람은 undefined). */
  career?: CareerStepResult;
  labor?: LaborState;
  disabled: boolean;
  /** 최근 12개월 소득(AWI 배수). */
  earnings12: number;
  /** 순자산(AWI 배수, 연말에 갱신되는 경력 모델 값). */
  netWorth: number;
  // ---- 관계 ----
  union: 'single' | 'dating' | 'cohabiting' | 'married';
  /** 주 관계의 상대 id. */
  partnerId?: number;
  everMarried: boolean;
  /** 이 달 끝난 관계(주인공 쪽에서 본 이유). */
  unionEndedThisMonth?: 'breakup' | 'divorce' | 'widowed' | 'discovered';
  children: number;
  youngestChildAgeMonths?: number;
  birthThisMonth: boolean;
  // ---- 다른 도메인의 요약(그 모듈이 붙어 있을 때만) ----
  health?: HealthSummary;
  crime?: CrimeSummary;
  place?: PlaceSummary;
  kin?: KinSummary;
}

export interface DomainEvent {
  month: number;
  personId: number;
  domain: DomainName;
  /** 모듈이 정하는 종류(예: 'diagnosed', 'arrested', 'moved', 'motherDied'). */
  kind: string;
  /** 이야기 현저성 0~1(실타래·기억용 — 모듈 README에 근거). */
  salience: number;
  /** 사건 세부(원인, 형량 개월 등) — 원시값만. */
  data?: Record<string, number | string | boolean>;
}

/** 관계에 대한 영향(선의 이 사람 쪽). 세계가 두 사람 것을 합쳐 stepUnionMonth에 넘긴다. */
export interface UnionEffects {
  /** 시설에 있다(수감·장기 입원): 함께 살 수 없고 아이를 가질 수 없다. 연애·동거의 헤어짐 위험을 세계가 올린다. */
  institutionalized?: boolean;
  /** 이 사람 쪽 헌신에서 빼는 값(= 떠남 쪽으로 기움, 결혼 모델의 대안 가산과 같은 척도). */
  leaveShift?: number;
  /** 이번 달 관계 만족도에 한 번 주는 충격(음수 = 나빠짐). 사건이 난 달에만 돌려준다. */
  satisfactionShock?: number;
}

export interface ModuleContext {
  readonly month: number;
  /** (사람, 달, 도메인, 슬롯) 난수열. */
  rng(slot: number): Rng;
}

export interface WorldModule<S = unknown, Summary = unknown> {
  readonly name: DomainName;
  /** focal: 주인공만. active: 활성 집합 전부(주인공과 관계가 열린 상대 포함 — 상대는 활성일 때만 굴러간다). */
  readonly scope: 'focal' | 'active';
  /** 처음 활성이 될 때 한 번. person.birthTotal·profile·ageMonths로 과거(16세 이전 포함)를 통계적으로 채운다. */
  init(ctx: ModuleContext, person: ModulePerson, inputs: WorldMonthInputs): S;
  step(ctx: ModuleContext, person: ModulePerson, state: S, inputs: WorldMonthInputs): DomainEvent[] | void;
  summary(state: S): Summary;
  careerModifiers?(state: S, person: ModulePerson): CareerModifiers | undefined;
  unionEffects?(state: S, person: ModulePerson): UnionEffects | undefined;
  /** 만남 배수(수감 중 0, 관계망이 넓으면 >1 등). */
  meetMultiplier?(state: S, person: ModulePerson): number;
  /**
   * 이 달 사망 확률(월). 붙어 있으면 생명표 대신 쓴다(여러 모듈이면 첫 번째). 원인을 함께 돌려준다.
   * 모집단 전체 사망은 코호트 생명표와 맞아야 한다(health 모듈의 보정 책임).
   */
  deathProbability?(state: S, person: ModulePerson, inputs: WorldMonthInputs): { probability: number; causes?: readonly [string, number][] } | undefined;
}

/** 모듈이 읽는 사람 — World의 WorldPerson 중 모듈에 필요한 부분(순환 import 방지). */
export interface ModulePerson {
  readonly id: number;
  readonly profile: import('../person/profile').PersonProfile;
  readonly birthTotal: number;
  readonly focal: boolean;
  readonly seed: number;
}

/** 여러 모듈의 경력 영향 합치기: 배수는 곱, 가산은 합, 불리언은 OR. */
export function mergeCareerModifiers(list: readonly (CareerModifiers | undefined)[]): CareerModifiers | undefined {
  let out: CareerModifiers | undefined;
  for (const m of list) {
    if (!m) continue;
    out ??= {};
    if (m.blocked) out.blocked = true;
    if (m.disabilityOnset) out.disabilityOnset = true;
    if (m.offerMultiplier !== undefined) out.offerMultiplier = (out.offerMultiplier ?? 1) * m.offerMultiplier;
    if (m.disabilityMultiplier !== undefined) out.disabilityMultiplier = (out.disabilityMultiplier ?? 1) * m.disabilityMultiplier;
    if (m.layoffMultiplier !== undefined) out.layoffMultiplier = (out.layoffMultiplier ?? 1) * m.layoffMultiplier;
    if (m.wageShift !== undefined) out.wageShift = (out.wageShift ?? 0) + m.wageShift;
    if (m.wealthTransfer !== undefined) out.wealthTransfer = (out.wealthTransfer ?? 0) + m.wealthTransfer;
  }
  return out;
}

export function mergeUnionEffects(list: readonly (UnionEffects | undefined)[]): UnionEffects | undefined {
  let out: UnionEffects | undefined;
  for (const e of list) {
    if (!e) continue;
    out ??= {};
    if (e.institutionalized) out.institutionalized = true;
    if (e.leaveShift !== undefined) out.leaveShift = (out.leaveShift ?? 0) + e.leaveShift;
    if (e.satisfactionShock !== undefined) out.satisfactionShock = (out.satisfactionShock ?? 0) + e.satisfactionShock;
  }
  return out;
}
