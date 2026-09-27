import type { OccupationId } from './occupations';
import type { Education } from './types';

/**
 * 경력·재산 행위자 모델의 파라미터. 결혼 모델(src/sim/marriage/params.ts)과 같은 세 부류:
 * 1. STRUCTURE — 척도를 정하거나, 근거가 약해도 식별이 안 되는 값(가정, README에 표시).
 * 2. FREE_PARAMS — 몬테카를로 보정(시뮬레이션 적률법)으로 정하는 값.
 * 3. 직업별 모양 — occupations.ts.
 */

export interface CareerParams {
  // ---- 교육 ----
  /** 부모 순위(z) → 교육 잠재변수. 세대 간 이동성(순위-순위 기울기)의 주 통로. */
  eduParentWeight: number;

  // ---- 임금 수준과 개인차 ----
  /** 전역 로그 임금 수준(남성 풀타임 중앙값 ≈ 1.055 AWI에 맞춤). */
  wageLevel: number;
  /** 능력 1SD당 로그 임금(직업별 abilityLoad가 곱해짐). */
  abilityReturn: number;
  /** 친화성 1SD당 로그 임금 — Judge et al.(2012): 음수. */
  agreeablenessPay: number;
  /** 기술 프리미엄 추세: 연도당 로그 임금 변화(대졸 +1, 고졸 0, 고졸 미만 −1배; 1999 = 0) — 1980–2000년대
   *  대졸 프리미엄 상승과 저학력 상대임금 하락. */
  skillPremiumTrend: number;

  // ---- 일반 인적자본(경력 곡선) ----
  hcGrowthLessThanHighSchool: number;
  hcGrowthHighSchool: number;
  hcGrowthSomeCollege: number;
  hcGrowthBachelors: number;
  /** 경력 연수에 따른 인적자본 성장의 감쇠율(오목한 곡선). */
  hcDecay: number;
  /** 45세 이후 연간 인적자본 감가 — 늦은 경력의 실질 임금 정체·하락. */
  hcLateDepreciation: number;

  // ---- 근속(기업 특수 자본) ----
  /** 근속 1년당 로그 임금(10년 상한) — 실직 시 잃는 몫. JLS 25% 손실의 한 축. */
  tenureReturn: number;

  // ---- 직업 특수 자본 ----
  /** 같은 직업 1년당 로그 임금(10년 상한) — 직업을 바꾸면 잃는다(항공우주→서비스 −17%의 통로). */
  occupationReturn: number;

  // ---- 승진 ----
  /** 연간 승진 확률(사다리 끝 전까지). */
  promotionRate: number;
  /** 관리자로 내부 승진하는 연간 확률(경력 6년 이상, 사다리 첫 칸 위). */
  managerPromotionRate: number;
  /** 성실성 1SD → 승진 로그 배수. */
  promotionConscientiousness: number;
  /** 직업별 사다리 칸 상승폭의 전역 배수. */
  rungStepScale: number;

  // ---- 탐색과 짝 ----
  /** 재직 중 월간 외부 제안 확률(18세). */
  offerRateEmployed: number;
  /** 실업 중 월간 제안 확률(실업률 6% 기준). */
  offerRateUnemployed: number;
  /** 나이 1년당 재직 중 제안 감소(로그). */
  offerAgeDecline: number;
  /** 고용주 짝(매치) 로그 임금 표준편차. */
  matchSd: number;
  /** 이직에 필요한 최소 로그 임금 개선(이동 비용·위험 회피). */
  switchCost: number;
  /** 입사 시 실업률 1%p당 짝 평균 하락 — 불황 졸업 상처의 입구. */
  matchCyclicality: number;
  /** 실업률이 높을 때 제안이 낮은 급의 직업 쪽으로 기우는 정도(하향 취업) — 실업률 1%p × 로그 직업 임금비당. */
  occupationCyclicality: number;
  /** 입사 직후 "안 맞음"이 드러나 그만두는 위험의 배수(근속 6개월 척도로 사라짐) — 젊을 때 짧은 일자리들. */
  earlyMismatch: number;

  // ---- 자발적 이직 ----
  /** 18세의 월간 그만둠(실업으로) 확률. */
  quitYoung: number;
  /** 나이 1년당 그만둠 감소(로그). */
  quitAgeDecay: number;

  // ---- 해고와 공장 폐쇄 ----
  layoffBase: number;
  /** 근속 10년이 해고 위험을 낮추는 로그 크기. */
  layoffTenureProtection: number;
  /** 해고 위험의 실업률 탄력성(직업 cyclicality가 곱해짐). */
  layoffCyclicality: number;
  layoffConscientiousness: number;
  /** 월간 공장 폐쇄·대량 해고(개인 잘못 없는 실직 — JLS "displaced"). */
  plantClosingRate: number;

  // ---- 노동시장 이탈 ----
  /** 실업 → 비경제활동 월간 확률(고졸 이상). */
  nilfEntry: number;
  /** 고졸 미만의 이탈 배수(고졸은 제곱근). */
  nilfLowEducation: number;
  /** 비경제활동 → 구직 복귀 월간 확률. */
  nilfExit: number;
  /** 40세 월간 장애(취업 중) 확률. */
  disabilityBase: number;
  /** 나이 1년당 장애 위험 증가(로그). */
  disabilityAgeSlope: number;

  // ---- 학생 ----
  /** 재학 중 아르바이트 비율(정상 상태). */
  studentWorkShare: number;
  /** 학생 아르바이트 임금 할인(로그). */
  studentWageDiscount: number;

  // ---- 자영업 ----
  seEntry: number;
  /** 창업 첫해 월간 폐업 위험. */
  seHazard0: number;
  /** 사업 연수 1년당 폐업 위험 감소(로그). */
  seHazardDecay: number;

  // ---- 재산 ----
  saveBase: number;
  saveConscientiousness: number;
  /** 소득이 높을수록 저축률이 오르는 기울기(로그 소득당). */
  saveRich: number;
  /** 자산의 평균 실질 수익률. */
  returnMean: number;
  /** 상속 규모 배수. */
  inheritanceScale: number;

  /** 직업별 제안 가중치 배수 — 적률법이 아니라 비례 조정(raking)으로 CPS 1999 직업 분포에 맞춘다. */
  occupationWeights?: Partial<Record<OccupationId, number>>;
}

export type CareerScalarParams = Omit<CareerParams, 'occupationWeights'>;

export type CareerParamName = keyof CareerScalarParams;

export interface CareerParamSpec {
  name: CareerParamName;
  min: number;
  max: number;
  drives: string;
}

export const CAREER_FREE_PARAMS: readonly CareerParamSpec[] = [
  { name: 'eduParentWeight', min: 0, max: 1.5, drives: '순위-순위 이동성' },
  { name: 'wageLevel', min: -0.8, max: 0.6, drives: '남성 풀타임 중앙값' },
  { name: 'abilityReturn', min: 0, max: 0.35, drives: '학력별 소득비(능력 선별)' },
  { name: 'agreeablenessPay', min: -0.2, max: 0, drives: '친화성 임금 효과' },
  { name: 'skillPremiumTrend', min: 0, max: 0.02, drives: '학력별 임금 성장 격차(시대)' },
  { name: 'hcGrowthLessThanHighSchool', min: 0, max: 0.12, drives: '임금 성장 — 고졸 미만' },
  { name: 'hcGrowthHighSchool', min: 0, max: 0.15, drives: '임금 성장 — 고졸' },
  { name: 'hcGrowthSomeCollege', min: 0, max: 0.15, drives: '임금 성장 — 대학 중퇴' },
  { name: 'hcGrowthBachelors', min: 0, max: 0.2, drives: '임금 성장 — 대졸' },
  { name: 'hcDecay', min: 0.02, max: 0.3, drives: '임금 곡선의 오목함' },
  { name: 'hcLateDepreciation', min: 0, max: 0.03, drives: '45세 이후 임금 정체' },
  { name: 'tenureReturn', min: 0, max: 0.04, drives: '실직 후 장기 손실(JLS)' },
  { name: 'occupationReturn', min: 0, max: 0.04, drives: '실직·전직 손실' },
  { name: 'promotionRate', min: 0, max: 0.3, drives: '재직 중 임금 성장' },
  { name: 'managerPromotionRate', min: 0, max: 0.15, drives: '관리자 비율(직업 분포와 함께)' },
  { name: 'promotionConscientiousness', min: 0, max: 1, drives: '성실성의 성취 효과' },
  { name: 'rungStepScale', min: 0.3, max: 2, drives: '승진의 임금 폭' },
  { name: 'offerRateEmployed', min: 0, max: 0.25, drives: '첫 10년 고용주 수, 이직 임금 몫' },
  { name: 'offerRateUnemployed', min: 0.05, max: 0.7, drives: '실업 비율' },
  { name: 'offerAgeDecline', min: 0, max: 0.12, drives: '나이별 일자리 지속 기간' },
  { name: 'matchSd', min: 0.03, max: 0.4, drives: '이직 임금 이득' },
  { name: 'switchCost', min: 0, max: 0.2, drives: '이직 빈도' },
  { name: 'matchCyclicality', min: 0, max: 0.08, drives: '불황 졸업 상처(Kahn)' },
  { name: 'occupationCyclicality', min: 0, max: 0.6, drives: '불황 졸업 하향 취업(Kahn)' },
  { name: 'earlyMismatch', min: 0, max: 12, drives: '1년 내 일자리 종료' },
  { name: 'quitYoung', min: 0, max: 0.1, drives: '청년 일자리 1년 내 종료' },
  { name: 'quitAgeDecay', min: 0, max: 0.4, drives: '나이별 일자리 지속 기간' },
  { name: 'layoffBase', min: 0, max: 0.012, drives: '실업 비율(학력별)' },
  { name: 'layoffTenureProtection', min: 0, max: 3, drives: '중년 일자리 지속' },
  { name: 'layoffCyclicality', min: 0, max: 3, drives: '경기와 실업' },
  { name: 'layoffConscientiousness', min: 0, max: 1, drives: '성실성의 고용 안정' },
  { name: 'plantClosingRate', min: 0, max: 0.004, drives: '장기근속자 실직' },
  { name: 'nilfEntry', min: 0, max: 0.1, drives: '비경제활동 비율' },
  { name: 'nilfLowEducation', min: 1, max: 10, drives: '고졸 미만 비경제활동' },
  { name: 'nilfExit', min: 0.005, max: 0.2, drives: '비경제활동 지속' },
  { name: 'disabilityBase', min: 0, max: 0.003, drives: '중년 고용률 하락' },
  { name: 'disabilityAgeSlope', min: 0, max: 0.15, drives: '55–58세 고용률' },
  { name: 'studentWorkShare', min: 0, max: 0.9, drives: '18–24세 고용률' },
  { name: 'studentWageDiscount', min: -0.5, max: 0.3, drives: '18–24세 임금 성장(학생→첫 직장 도약)' },
  { name: 'seEntry', min: 0, max: 0.006, drives: '자영업 비율' },
  { name: 'seHazard0', min: 0.002, max: 0.06, drives: '사업 1~2년 생존' },
  { name: 'seHazardDecay', min: 0, max: 1, drives: '사업 장기 생존' },
  { name: 'saveBase', min: -0.1, max: 0.35, drives: '순자산 중앙값 수준' },
  { name: 'saveConscientiousness', min: 0, max: 0.12, drives: '재산 분산' },
  { name: 'saveRich', min: 0, max: 0.3, drives: '재산 평균/중앙값(꼬리)' },
  { name: 'returnMean', min: 0, max: 0.07, drives: '나이별 재산 곡선의 기울기' },
  { name: 'inheritanceScale', min: 0, max: 3, drives: '고령 재산, 꼬리' },
];

export const INITIAL_CAREER_PARAMS: CareerParams = {
  eduParentWeight: 0.6,
  wageLevel: 0,
  abilityReturn: 0.1,
  agreeablenessPay: -0.05,
  skillPremiumTrend: 0.006,
  hcGrowthLessThanHighSchool: 0.02,
  hcGrowthHighSchool: 0.04,
  hcGrowthSomeCollege: 0.05,
  hcGrowthBachelors: 0.08,
  hcDecay: 0.08,
  hcLateDepreciation: 0.008,
  tenureReturn: 0.015,
  occupationReturn: 0.01,
  promotionRate: 0.08,
  managerPromotionRate: 0.03,
  promotionConscientiousness: 0.3,
  rungStepScale: 1,
  offerRateEmployed: 0.06,
  offerRateUnemployed: 0.25,
  offerAgeDecline: 0.04,
  matchSd: 0.15,
  switchCost: 0.05,
  matchCyclicality: 0.02,
  occupationCyclicality: 0.15,
  earlyMismatch: 2,
  quitYoung: 0.03,
  quitAgeDecay: 0.12,
  layoffBase: 0.003,
  layoffTenureProtection: 1,
  layoffCyclicality: 1,
  layoffConscientiousness: 0.2,
  plantClosingRate: 0.0012,
  nilfEntry: 0.02,
  nilfLowEducation: 3,
  nilfExit: 0.05,
  disabilityBase: 0.0008,
  disabilityAgeSlope: 0.06,
  studentWorkShare: 0.5,
  studentWageDiscount: -0.1,
  seEntry: 0.0015,
  seHazard0: 0.02,
  seHazardDecay: 0.3,
  saveBase: 0.08,
  saveConscientiousness: 0.03,
  saveRich: 0.08,
  returnMean: 0.03,
  inheritanceScale: 0.8,
};

/** 구조 상수와 가정. "가정" 표시는 원문으로 확인하지 못한 값. */
export const CAREER_STRUCTURE = {
  /** 1999 남성 풀타임 주급 중앙값 ÷ AWI 주당(검증 — data/work.ts). 직업 payRatio의 기준. */
  MEN_MEDIAN_TO_AWI: 618 / (30469.84 / 52),
  /** 능력과 부모 순위(z)의 상관 — 가정. */
  abilityParentCorrelation: 0.3,
  /** 교육 잠재변수의 성실성·개방성 가중치 — 가정. */
  eduConscientiousness: 0.3,
  eduOpenness: 0.15,
  /** 학력 분포(1999 CPS 35–39세, 남녀 합) — 검증(Census P20-528). 교육 절단점이 이 비율을 정확히 만든다. */
  educationShare: { lessThanHighSchool: 0.124, highSchool: 0.345, someCollege: 0.262, bachelorsOrMore: 0.269 } as Record<Education, number>,
  /** 대졸 이상 중 대학원 학위 비율 — 가정(1999 CPS 25세 이상 대학원 약 8.5% ÷ 대졸 이상 약 25%). */
  graduateShareOfBachelors: 0.34,
  /** 대학원 종류 기본 가중치 — CPS 1999 남성 의사(0.70%)·법조인(0.75%)·대학교수(0.72%) 비율 ÷ 대학원 학위
   *  비율(약 9%)로 역산(교수 외 박사를 감안해 박사는 조금 높게). 성격·능력이 개인별로 기울인다. */
  graduateMix: { masters: 0.72, law: 0.09, medicine: 0.08, doctorate: 0.11 },
  /** 졸업 나이 — 가정(평균적 경로). */
  schoolExitAge: { lessThanHighSchool: 17, highSchool: 18, someCollege: 20, bachelorsOrMore: 22, masters: 24, doctorate: 27, law: 25, medicine: 26 },
  /** 고졸·대학 중퇴 남성의 입대 확률 — 가정(1957–64년생 남성의 복무 경험 비율을 확인하지 못함). */
  militaryEnlistShare: 0.08,
  /** 실업률 기준점(%). */
  UNEMPLOYMENT_REFERENCE: 6,
  /** 학생 아르바이트의 파트타임 소득 비율과 임금 할인(로그). */
  studentHoursShare: 0.4,
  /** 연간 영구 임금 충격 표준편차 — 가정(Moffitt & Zhang: 남성 40대 분산의 약 1/3이 영구). */
  permanentShockSd: 0.05,
  /** 비취업 중 연간 인적자본 감가 — 가정. */
  nonemploymentDepreciation: 0.05,
  /** 성격의 임금 효과(보정하지 않는 쪽) — Mueller & Plug(2006) 방향, 크기는 가정. */
  conscientiousnessPay: 0.03,
  neuroticismPay: -0.03,
  opennessPay: 0.02,
  /** 석사 임금 가산(로그) — 가정. */
  mastersPremium: 0.1,
  /** 성격 적합도 1단위당 짝(생산성) 가산 — 비교우위에 따른 분류(Roy 모형). 가정. */
  fitPay: 0.05,
  /** 관리자 내부 승진의 학력 기울기(학력 한 단계당 로그, 고졸 미만 → 대졸까지) — 가정. 저학력 관리자는
   *  드물다(현장 감독 수준). */
  managerEducationGradient: 0.6,
  /** 다른 직업으로 옮길 때 추가로 요구하는 로그 임금 개선 — 기술·정체성의 전환 비용. 가정. */
  occupationSwitchCost: 0.08,
  /** 전문·박사 학위자가 전공 밖 제안을 받는 상대 가중치. 가정. */
  offFieldDegreeWeight: 0.03,
  /** 실업 시 수용 기준: 이전 임금 − 이 값 − 개월당 하락. */
  reservationDrop: 0.15,
  reservationDropPerMonth: 0.02,
  /** 같은 직업 안에서 제안이 올 확률. */
  sameOccupationOfferShare: 0.6,
  /** 짝이 나쁠수록 해고 위험(짝 1 표준편차당 로그). */
  layoffMatchSensitivity: 0.5,
  /** 장애 후 복귀 월간 확률 — 가정. */
  disabilityRecovery: 0.01,
  /** 육체노동의 장애 위험 배수 — 가정. */
  manualDisabilityMultiplier: 1.6,
  /** 은퇴 월간 확률: 55–61, 62–64, 65+ — 가정. */
  retireHazard: { from55: 0.002, from62: 0.025, from65: 0.08 },
  /** 항공우주 구조조정(1988–1995): 월간 추가 폐쇄 위험(전국, LA)과 신규 제안 배수 — 가정. LA 값은 1940–66년생
   *  LA 표본의 항공우주 고용 지수(1995/1987)가 RAND RB7510의 LA 카운티 50%에 가깝게(0.46) 스캔해서 정했고,
   *  전국 값은 감소율 비(30%/50%)로 줄였다. 닫힌 코호트라 신규 진입이 없어 지수는 실제보다 빨리 준다. */
  aerospaceDecline: { fromYear: 1988, toYear: 1995, closureNational: 0.0015, closureLA: 0.0025, offerMultiplier: 0.25, afterMultiplier: 0.6 },
  /** LA 거주자의 항공우주 제안 배수(산업 집중) — 가정. */
  laAerospaceConcentration: 4,
  /** 전국 표본 중 LA 비율. */
  losAngelesShare: 0.035,
  /** 자영업: 창업 자본(AWI), 사업 품질이 소득에 주는 효과, 연간 소득 흔들림, 장기 폐업 위험 바닥 비율. */
  seStartupCapital: 0.3,
  seQualityIncome: 0.5,
  seIncomeShockSd: 0.3,
  seHazardFloor: 0.15,
  /** 사업 지분 가치 = 이 배수 × max(0, 연소득 − 1 AWI). */
  seEquityMultiple: 2,
  // ---- 재산(가정) ----
  taxRate: 0.2,
  consumptionFloor: 0.3,
  debtLimit: -1.5,
  debtRate: 0.07,
  marketReturnSd: 0.15,
  idiosyncraticReturnSd: 0.08,
  unemploymentInsuranceReplacement: 0.4,
  unemploymentInsuranceMonths: 6,
  disabilityBenefitReplacement: 0.35,
  socialSecurityReplacement: 0.4,
  retireeDrawdown: 0.04,
  inheritanceAnnualProbability: 0.015,
} as const;
