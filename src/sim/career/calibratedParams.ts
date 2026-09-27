import type { CareerParams } from './params';

/**
 * `npm run sim:career:calibrate -- --gens=0 --sweeps=7 --nm=300 --n=5000 --seed=1`가 생성한 파일 — 손으로 고치지 말 것.
 * 보정 loss(표준화 제곱 오차 합) = 19.42. 표본 외 검증은 `npm run sim:career`.
 */
export const CALIBRATED_CAREER_PARAMS: CareerParams = {
  eduParentWeight: 0.8683, // 순위-순위 이동성
  wageLevel: 0.1144, // 남성 풀타임 중앙값
  abilityReturn: 0.1823, // 학력별 소득비(능력 선별)
  agreeablenessPay: -0.07195, // 친화성 임금 효과
  skillPremiumTrend: 0.004416, // 학력별 임금 성장 격차(시대)
  hcGrowthLessThanHighSchool: 0.004921, // 임금 성장 — 고졸 미만
  hcGrowthHighSchool: 0.04255, // 임금 성장 — 고졸
  hcGrowthSomeCollege: 0.06981, // 임금 성장 — 대학 중퇴
  hcGrowthBachelors: 0.0001125, // 임금 성장 — 대졸
  hcDecay: 0.2998, // 임금 곡선의 오목함
  hcLateDepreciation: 0.01182, // 45세 이후 임금 정체
  tenureReturn: 0.00001305, // 실직 후 장기 손실(JLS)
  occupationReturn: 0.00001637, // 실직·전직 손실
  promotionRate: 0.0001324, // 재직 중 임금 성장
  managerPromotionRate: 0.06318, // 관리자 비율(직업 분포와 함께)
  promotionConscientiousness: 0.4832, // 성실성의 성취 효과
  rungStepScale: 1.717, // 승진의 임금 폭
  offerRateEmployed: 0.1766, // 첫 10년 고용주 수, 이직 임금 몫
  offerRateUnemployed: 0.5642, // 실업 비율
  offerAgeDecline: 0.02491, // 나이별 일자리 지속 기간
  matchSd: 0.1076, // 이직 임금 이득
  switchCost: 0.05332, // 이직 빈도
  matchCyclicality: 0.00001617, // 불황 졸업 상처(Kahn)
  occupationCyclicality: 0.1324, // 불황 졸업 하향 취업(Kahn)
  earlyMismatch: 4.395, // 1년 내 일자리 종료
  quitYoung: 0.0218, // 청년 일자리 1년 내 종료
  quitAgeDecay: 0.1209, // 나이별 일자리 지속 기간
  layoffBase: 0.007434, // 실업 비율(학력별)
  layoffTenureProtection: 2.372, // 중년 일자리 지속
  layoffCyclicality: 1.599, // 경기와 실업
  layoffConscientiousness: 0.1756, // 성실성의 고용 안정
  plantClosingRate: 0.0006623, // 장기근속자 실직
  nilfEntry: 0.006128, // 비경제활동 비율
  nilfLowEducation: 5.597, // 고졸 미만 비경제활동
  nilfExit: 0.01325, // 비경제활동 지속
  disabilityBase: 0.0004929, // 중년 고용률 하락
  disabilityAgeSlope: 0.06233, // 55–58세 고용률
  studentWorkShare: 0.592, // 18–24세 고용률
  studentWageDiscount: 0.01025, // 18–24세 임금 성장(학생→첫 직장 도약)
  seEntry: 0.001184, // 자영업 비율
  seHazard0: 0.01824, // 사업 1~2년 생존
  seHazardDecay: 0.3576, // 사업 장기 생존
  saveBase: 0.1995, // 순자산 중앙값 수준
  saveConscientiousness: 0.1199, // 재산 분산
  saveRich: 0.1351, // 재산 평균/중앙값(꼬리)
  returnMean: 0.02928, // 나이별 재산 곡선의 기울기
  inheritanceScale: 0.003033, // 고령 재산, 꼬리
  // 직업별 제안 가중치 배수(CPS 1999 직업 분포에 비례 조정).
  occupationWeights: {
    aerospaceEngineer: 0.03035,
    engineer: 0.106,
    physician: 0.134,
    nurse: 0.2851,
    professor: 0.09071,
    teacher: 1.122,
    lawyer: 70.8,
    otherProfessional: 0.5914,
    manager: 0.7302,
    businessProfessional: 0.7302,
    technician: 0.6984,
    salesRep: 0.4205,
    retailSales: 2.419,
    clerical: 4.802,
    protectiveService: 0.7963,
    foodService: 33.45,
    mechanic: 1.442,
    constructionTrades: 1.287,
    operative: 1.85,
    aerospaceAssembler: 1.85,
    truckDriver: 1.119,
    laborer: 14.71,
    farmLabor: 52.44,
  },
};
