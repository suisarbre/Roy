import type { WomenLaborParams } from '../career/types';
import type { MarriageParams } from './params';

/**
 * `npm run sim:marriage:calibrate -- --n=4000 --gens=0 --sweeps=10 --nm=350 --seed=1`가 생성한 파일 — 손으로 고치지 말 것.
 * 보정 loss(표준화 제곱 오차 합) = 51.40. 표본 외 검증은 `npm run sim:marriage`.
 * 결혼·출산과 여성 노동 공급을 한 번에 보정했다(남성 경력은 src/sim/career에서 고정).
 */
export const CALIBRATED_PARAMS: MarriageParams = {
  leaveIntercept: -5.5172, // 전체 해체율 수준
  confrontBase: -3.6891, // 5년/10년 해체 곡선 모양
  confrontNeuroticism: 1.3847, // 신경성 오즈비
  supportAgreeableness: 0.5455, // 친화성 오즈비
  supportConscientiousness: 0.5067, // 성실성 오즈비
  supportSympathy: 0.0156, // 장애 후 이혼 ≈ 1 (4단계 대규모 표본 정밀 조정)
  chronicStrainBase: 0.6907, // 학력별 이혼(고졸 미만)
  chronicStrainPerStep: 0, // 고정(보정 대상 아님)
  chronicStrainCollegeDrop: 1.5858, // 학력별 이혼(대졸 계단)
  jobLossThreat: 0.308, // 남편 비풀타임 위험비
  layoffBlame: 1.5529, // 해고 후 이혼 오즈비
  alternativesYouth: 0.1198, // 결혼 나이 기울기
  alternativesOpenness: 0.6997, // 개방성 오즈비
  parentalDivorceBarrierDrop: 1.2724, // 부모 이혼 오즈비
  homemakerBarrier: 0.1717, // 전업주부 null
  investmentPerLogYear: 0.8185, // 5·10년 대 평생 해체 비율(시점 분포)
  honeymoonBoost: 1.8218, // 5년 대 10년 해체 비율(신혼 효과)
  desireBase: 2.303, // 평균 자녀 수
  desireCollegeDrop: 1.0709, // 대졸 무자녀·자녀 수
  birthPace: 0.3955, // 자녀 수 분포(원하는 만큼 낳는가)
  birthCommitment: 0.681, // 흔들리는 부부의 출산 미룸
  birthStressAversion: 0.6348, // 실직 후 완결 출산 변화
  childInvestment: 0.3244, // 자녀의 이혼 억제
  youngChildStrain: 0.3191, // 어린 자녀 양육 스트레스
  postBirthDip: 0.1295, // 출산 후 만족도 하락
  birthCareerCost: 0.6065, // 대졸 무자녀(일의 기회비용)
};

export const CALIBRATED_WOMEN_PARAMS: WomenLaborParams = {
  payGap: -0.1755, // 여성/남성 임금 중앙값
  homeExitBirth: -0.5112, // 출산 후 이탈(어린 자녀 어머니 참가율)
  homeExitTraditionalism: 0.5858, // 전통성과 전업
  homeExitCollege: 1.0471, // 대졸 여성의 고용
  homeExitSpouseIncome: 0.3445, // 남편 소득과 전업
  homeReturnBase: -4.5049, // 복귀 속도
  homeReturnChildAge: 0.0006, // 자녀가 크면 복귀(6–17세 참가율)
  homeReturnTraditionalism: 0.6253, // 전통성과 장기 전업
  homeReturnSingle: 3.1083, // 이혼 후 복귀
  nilfMultiplier: 1.362, // 여성 비경제활동 수준
  nilfLowEducation: 7.7064, // 고졸 미만 여성 비경제활동(학력 기울기)
  homeFromUnemployment: -4.5996, // 여성 실업률(실업 → 가사)
  // 여성 직업별 제안 가중치 배수(CPS 1999 여성 직업 분포에 비례 조정).
  occupationWeights: {
    aerospaceEngineer: 0.01609,
    engineer: 0.0211,
    physician: 0.08854,
    nurse: 2.125,
    professor: 0.06504,
    teacher: 7.206,
    lawyer: 2.993,
    otherProfessional: 0.588,
    manager: 1.212,
    businessProfessional: 1.212,
    technician: 0.9712,
    salesRep: 0.3601,
    retailSales: 2.323,
    clerical: 13.86,
    protectiveService: 0.1768,
    foodService: 29.37,
    mechanic: 0.1864,
    constructionTrades: 0.02661,
    operative: 0.7577,
    aerospaceAssembler: 0.7577,
    truckDriver: 0.08526,
    laborer: 6.713,
    farmLabor: 5.803,
  },
};
