import type { MarriageParams } from './params';

/**
 * `npm run sim:marriage:calibrate -- --n=10000 --gens=0 --sweeps=10 --nm=160 --seed=1`가 생성한 파일 — 손으로 고치지 말 것.
 * 보정 loss(표준화 제곱 오차 합, 적률 17개) = 12.93. 표본 외 검증은 `npm run sim:marriage`.
 */
export const CALIBRATED_PARAMS: MarriageParams = {
  leaveIntercept: -5.516, // 전체 해체율 수준
  confrontBase: -4.0094, // 5년/10년 해체 곡선 모양
  confrontNeuroticism: 1.4007, // 신경성 오즈비
  supportAgreeableness: 0.671, // 친화성 오즈비
  supportConscientiousness: 0.458, // 성실성 오즈비
  supportSympathy: 1.2428, // 장애 후 이혼 ≈ 1
  chronicStrainBase: 0.6955, // 학력별 이혼(고졸 미만)
  chronicStrainPerStep: 0, // 고정(보정 대상 아님)
  chronicStrainCollegeDrop: 2.0319, // 학력별 이혼(대졸 계단)
  jobLossThreat: 1.3018, // 남편 비풀타임 위험비
  layoffBlame: 1.1026, // 해고 후 이혼 오즈비
  alternativesYouth: 0.1208, // 결혼 나이 기울기
  alternativesOpenness: 0.6188, // 개방성 오즈비
  parentalDivorceBarrierDrop: 0.8353, // 부모 이혼 오즈비
  homemakerBarrier: 0.2704, // 전업주부 null
  investmentPerLogYear: 0.8133, // 5·10년 대 평생 해체 비율(시점 분포)
  honeymoonBoost: 1.9293, // 5년 대 10년 해체 비율(신혼 효과)
};
