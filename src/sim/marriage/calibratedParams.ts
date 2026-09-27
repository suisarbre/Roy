import type { MarriageParams } from './params';

/**
 * `npm run sim:marriage:calibrate -- --refine-only`가 생성한 파일 — 손으로 고치지 말 것.
 * 드문 사건 정밀 조정만 다시 실행. 표본 외 검증은 `npm run sim:marriage`.
 */
export const CALIBRATED_PARAMS: MarriageParams = {
  leaveIntercept: -5.5143, // 전체 해체율 수준
  confrontBase: -3.6825, // 5년/10년 해체 곡선 모양
  confrontNeuroticism: 1.3899, // 신경성 오즈비
  supportAgreeableness: 0.541, // 친화성 오즈비
  supportConscientiousness: 0.5838, // 성실성 오즈비
  supportSympathy: 0.1484, // 장애 후 이혼 ≈ 1 (4단계 대규모 표본 정밀 조정)
  chronicStrainBase: 0.6926, // 학력별 이혼(고졸 미만)
  chronicStrainPerStep: 0, // 고정(보정 대상 아님)
  chronicStrainCollegeDrop: 1.3696, // 학력별 이혼(대졸 계단)
  jobLossThreat: 0.4637, // 남편 비풀타임 위험비
  layoffBlame: 1.5643, // 해고 후 이혼 오즈비
  alternativesYouth: 0.1204, // 결혼 나이 기울기
  alternativesOpenness: 0.6961, // 개방성 오즈비
  parentalDivorceBarrierDrop: 1.0319, // 부모 이혼 오즈비
  homemakerBarrier: 0.1394, // 전업주부 null
  investmentPerLogYear: 0.816, // 5·10년 대 평생 해체 비율(시점 분포)
  honeymoonBoost: 1.9463, // 5년 대 10년 해체 비율(신혼 효과)
  desireBase: 2.2944, // 평균 자녀 수
  desireCollegeDrop: 0.9636, // 대졸 무자녀·자녀 수
  birthPace: 0.0133, // 자녀 수 분포(원하는 만큼 낳는가)
  birthCommitment: 0.5157, // 흔들리는 부부의 출산 미룸
  birthStressAversion: 0.7471, // 실직 후 완결 출산 변화
  childInvestment: 0.3221, // 자녀의 이혼 억제
  youngChildStrain: 0.3195, // 어린 자녀 양육 스트레스
  postBirthDip: 0.2028, // 출산 후 만족도 하락
};
