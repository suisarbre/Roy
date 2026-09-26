import type { Education } from './types';

/**
 * 결혼 행위자 모델의 파라미터.
 *
 * 세 부류로 나뉜다:
 * 1. FIXED_ASSUMPTIONS — 결혼 모델 바깥의 세계(실직 발생률, 학력 분포 등). 원래는 일/돈 도메인이
 *    제공해야 할 값이라 지금은 그럴듯한 가정으로 고정하고 README에 표시한다. 보정 대상 아님.
 * 2. 구조 상수(척도 고정) — 만족도 척도, 떠남 곡선 기울기 등. 모델의 "단위"를 정하는 값이라
 *    자유롭게 두면 다른 파라미터와 같은 일을 해서 식별이 안 된다.
 * 3. FREE_PARAMS — 몬테카를로 보정으로 정하는 15개. 적률(17개 수치)보다 적게 유지한다.
 */

export interface MarriageParams {
  // ---- 떠남 ----
  /** 월간 떠남 확률 = sigmoid(leaveIntercept - commitment * LEAVE_SLOPE). 전체 이혼 수준. */
  leaveIntercept: number;

  // ---- 행동(로짓 효용) ----
  /** 대립의 기본 효용. */
  confrontBase: number;
  /** 신경성 → 대립(성향). */
  confrontNeuroticism: number;
  /** 친화성 → 지지. */
  supportAgreeableness: number;
  /** 성실성 → 지지. */
  supportConscientiousness: number;
  /** 배우자 장애 시 지지(연민) 보너스 — 장애 효과가 0이 되도록(Charles & Stephens). */
  supportSympathy: number;

  // ---- 스트레스 ----
  /** 만성 경제 긴장(학력별): 고졸 미만의 값. */
  chronicStrainBase: number;
  /** 학력 한 단계 오를 때마다 긴장 감소(고졸 미만→고졸→대학 중퇴). 긴장은 음수가 될 수 있다
   *  (경제적 안정이 오히려 대립을 줄이는 쪽). */
  chronicStrainPerStep: number;
  /** 대졸 이상의 추가 감소(계단형 학력 효과). */
  chronicStrainCollegeDrop: number;
  /** 남편이 풀타임이 아닐 때의 금전 위협 크기. */
  jobLossThreat: number;
  /** 해고를 "그의 탓"으로 볼 때의 비난 크기(아내). 공장 폐쇄는 BLAME_PLANT_RATIO배. */
  layoffBlame: number;

  // ---- 헌신 ----
  /** 대안: (32 - 현재 나이)당 대안의 매력 — 결혼 나이 효과의 통로. */
  alternativesYouth: number;
  /** 개방성 → 대안(새로운 것에 대한 열림). */
  alternativesOpenness: number;
  /** 부모 이혼 → 이혼을 선택지로 보는 정도(장벽 감소). */
  parentalDivorceBarrierDrop: number;
  /** 전업주부의 떠나는 비용(경제적 장벽) — 금전 위협 증폭과 상쇄되어 null이 나와야 한다. */
  homemakerBarrier: number;
  /** 신혼 만족도 가산(설정점 위에서 시작해 서서히 내려옴) — 초기 1~2년 이혼이 적은 모양. */
  honeymoonBoost: number;
  /** 투자: 결혼 연수 log1p당 헌신 — 세월·자녀·집이 쌓여 떠나기 어려워지는 속도. 해체 시점 분포의 모양. */
  investmentPerLogYear: number;
}

export type FreeParamName = keyof MarriageParams;

export interface FreeParamSpec {
  name: FreeParamName;
  min: number;
  max: number;
  /** 주로 어떤 적률을 움직이는가(문서용). */
  drives: string;
}

export const FREE_PARAMS: readonly FreeParamSpec[] = [
  { name: 'leaveIntercept', min: -12, max: -2, drives: '전체 해체율 수준' },
  { name: 'confrontBase', min: -7, max: 1, drives: '5년/10년 해체 곡선 모양' },
  { name: 'confrontNeuroticism', min: 0, max: 2, drives: '신경성 오즈비' },
  { name: 'supportAgreeableness', min: 0, max: 2, drives: '친화성 오즈비' },
  { name: 'supportConscientiousness', min: 0, max: 2, drives: '성실성 오즈비' },
  { name: 'supportSympathy', min: 0, max: 4, drives: '장애 후 이혼 ≈ 1' },
  { name: 'chronicStrainBase', min: 0, max: 3, drives: '학력별 이혼(고졸 미만)' },
  { name: 'chronicStrainCollegeDrop', min: 0, max: 3, drives: '학력별 이혼(대졸 계단)' },
  { name: 'jobLossThreat', min: 0, max: 4, drives: '남편 비풀타임 위험비' },
  { name: 'layoffBlame', min: 0, max: 5, drives: '해고 후 이혼 오즈비' },
  { name: 'alternativesYouth', min: 0, max: 1, drives: '결혼 나이 기울기' },
  { name: 'alternativesOpenness', min: 0, max: 2, drives: '개방성 오즈비' },
  { name: 'parentalDivorceBarrierDrop', min: 0, max: 3, drives: '부모 이혼 오즈비' },
  { name: 'homemakerBarrier', min: 0, max: 4, drives: '전업주부 null' },
  { name: 'investmentPerLogYear', min: 0, max: 2.5, drives: '5·10년 대 평생 해체 비율(시점 분포)' },
  { name: 'honeymoonBoost', min: 0, max: 3, drives: '5년 대 10년 해체 비율(신혼 효과)' },
];

/** 보정 전 초기값(대략적인 직관). calibratedParams.ts가 있으면 그쪽을 쓴다. */
export const INITIAL_PARAMS: MarriageParams = {
  leaveIntercept: -7,
  confrontBase: -2,
  confrontNeuroticism: 0.5,
  supportAgreeableness: 0.5,
  supportConscientiousness: 0.3,
  supportSympathy: 1,
  chronicStrainBase: 1,
  chronicStrainPerStep: 0, // 보정 대상 아님: 첫 보정에서 ≈0으로 수렴 → 고정해 자유도 절약
  chronicStrainCollegeDrop: 0.8,
  jobLossThreat: 1,
  layoffBlame: 1,
  alternativesYouth: 0.2,
  alternativesOpenness: 0.3,
  parentalDivorceBarrierDrop: 0.5,
  homemakerBarrier: 0.5,
  investmentPerLogYear: 0.8,
  honeymoonBoost: 0.6,
};

// ---- 구조 상수(척도 고정) ----

export const STRUCTURE = {
  /** 떠남 로짓에서 헌신 1단위의 효과 — 척도 고정용 1. */
  LEAVE_SLOPE: 1,
  /** 만족도의 평균 회귀 속도(월). */
  SATISFACTION_REVERSION: 0.03,
  /** 만족도의 월간 무작위 흔들림. */
  SATISFACTION_NOISE: 0.08,
  /** 신혼 만족도 초기 분산. */
  SATISFACTION_INITIAL_SD: 0.5,
  /** 지지 1회당 만족도 변화. */
  SUPPORT_GAIN: 0.03,
  /** 대립 1회당 만족도 변화(음수). */
  CONFRONT_LOSS: 0.1,
  /** 둘 다 대립한 달의 추가 손실. */
  MUTUAL_CONFRONT_LOSS: 0.1,
  /** 대립이 남기는 흉터(설정점 하락)와 그 월간 치유율. */
  SCAR_PER_CONFRONT: 0.02,
  SCAR_HEAL_RATE: 0.01,
  /** 지지의 기본 효용. */
  SUPPORT_BASE: -1,
  /** 스트레스 1단위가 대립 효용에 주는 효과 — 척도 고정용 1. */
  STRESS_TO_CONFRONT: 1,
  /** 스트레스가 지지를 깎는 정도(스트레스 받으면 여유가 없다). */
  STRESS_TO_SUPPORT: -0.3,
  /** 기본 대안. */
  ALTERNATIVES_BASE: 0,
  /** 전통성 → 장벽(결혼 규범). */
  BARRIER_TRADITIONALISM: 0.3,
  /** 공장 폐쇄 비난 = 해고 비난 × 이 비율(대부분 "그의 탓이 아님"). */
  BLAME_PLANT_RATIO: 0.1,
  /** 비난의 월간 감쇠(재취업 후). */
  BLAME_DECAY: 0.05,
  /** 전통성이 해고 비난을 키우는 정도(생계부양자 규범 위반). */
  BLAME_TRADITIONALISM: 0.3,
  /** 금전 불안이 금전 위협을 키우는 정도. */
  THREAT_FINANCIAL_ANXIETY: 0.3,
  /** 장애 시 금전 위협은 실직의 이 비율 — 장애 연금(SSDI)·보험의 소득 대체(가정). */
  DISABILITY_THREAT_RATIO: 0.4,
  /** 전업주부일 때 금전 위협 증폭 배수. */
  THREAT_HOMEMAKER_MULTIPLIER: 1.5,
  /** 외벌이 가구의 상시 경제 긴장(전업주부 가구) — homemakerBarrier(떠나는 비용)와 반대 방향으로
   *  작동해서, 둘이 상쇄될 때 Killewald(2016)의 null이 재현된다. */
  SINGLE_INCOME_STRAIN: 0.3,
  /** 남편 본인의 실직 수치심(전통성 비례). */
  HUSBAND_SHAME_TRADITIONALISM: 0.3,
  /** 결혼 후 만족도 설정점(0 기준). */
  SET_POINT: 0,
} as const;

// ---- 결혼 모델 바깥의 가정(보정 대상 아님) ----

export const FIXED_ASSUMPTIONS = {
  /** NLSY79 남성 최종 학력 분포 — 가정(원문 미확인). */
  educationShare: { lessThanHighSchool: 0.12, highSchool: 0.4, someCollege: 0.22, bachelorsOrMore: 0.26 } as Record<Education, number>,
  /** 학력별 남성 평균 결혼 나이 — 고졸 미만 24, 대졸 28은 NLSY79 원문, 중간은 보간(가정). */
  meanAgeAtMarriageByEducation: { lessThanHighSchool: 24, highSchool: 25, someCollege: 26, bachelorsOrMore: 28 } as Record<Education, number>,
  ageAtMarriageSd: 3.5,
  /** 아내 학력이 남편과 같을 확률(동류혼) — 가정. */
  educationHomogamy: 0.6,
  /** 부모 이혼 경험 비율 — 가정. */
  parentsDivorcedShare: 0.17,
  /** 1980년대 기혼 여성의 전업주부 비율 — 가정. */
  homemakerShare: 0.35,
  /** 남편 월간 해고 확률(학력별) — 가정. */
  monthlyLayoffByEducation: { lessThanHighSchool: 0.004, highSchool: 0.003, someCollege: 0.0025, bachelorsOrMore: 0.0015 } as Record<Education, number>,
  monthlyPlantClosing: 0.001,
  monthlyDisability: 0.0005,
  /** 실업 → 재취업 월간 확률(평균 약 6.7개월) — 가정. */
  monthlyReemployment: 0.15,
  /** 장애 → 복귀 월간 확률(평균 약 4년) — 가정. */
  monthlyDisabilityRecovery: 0.02,
  /** 남편 출생연도 범위(NLSY79). */
  husbandBirthYears: [1957, 1964] as const,
} as const;
