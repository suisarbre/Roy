import type { MarriageParams } from '../marriage/params';
import type { WorldParams } from './params';

/**
 * `npm run sim:world:calibrate -- --gens=0 --sweeps=4 --nm=80 --n=3000 --seed=1`가 생성한 파일 — 손으로 고치지 말 것.
 * 보정 loss(표준화 제곱 오차 합) = 41.42. 표본 외 검증은 `npm run sim:world`.
 */
export const CALIBRATED_WORLD_PARAMS: WorldParams = {
  meetBase: 0.02382, // 결혼 경험, 첫 결혼 나이
  meetAgeDecline: 0.000174, // 늦은 결혼·재혼
  meetExtraversion: 0.3922, // (성격과 만남)
  meetHeterogeneity: 1.544, // 평생 미혼 비율
  remarriageMeet: 0.2767, // 재혼 비율·속도
  channelWork: 1.001, // 만난 경로(직장 대 친구)
  toMarryBase: -3.329, // 첫 결혼 나이
  toCohabitBase: -5.799, // 결혼 전 동거
  cohabTrend: 0.3847, // 동거의 시대 변화
  marryTraditionalism: 0.2042, // 결혼 대 동거
  cohabToMarry: -0.1052, // 동거 → 결혼
  marryEconomics: 1.19, // 학력별 남성 결혼률
  schoolMarryPenalty: 0.9318, // 대졸 첫 결혼 나이
  datingLeaveOffset: 1.765, // 연애 헤어짐
  cohabLeaveOffset: 0.1308, // 동거 헤어짐
  unplannedConception: 0.9383, // 혼외 출산 비율
  unplannedEducation: 0.7625, // 혼외 출산 학력 기울기
  shotgunMarriage: -4.56, // 혼외 출산 대 급한 결혼
  pregnancyCohabit: -1.805, // 혼외 출생 중 동거 커플
  affairOpportunity: 0.02618, // 외도 경험
  affairBase: -3.28, // 외도 경험
  affairCommitment: 0.3605, // 외도와 이혼의 연결
  affairWomen: -0.2728, // 외도 남녀 차이
  partnerPriorKids: 0.5782, // 여러 상대와의 출산, 남성 자녀 수
  stepChildWeight: 0.5017, // 재혼 가정의 출산, 여러 상대와의 출산
  affairDiscovery: 0.005415, // 외도 발각
  discoveryShock: 0.3239, // 외도 후 이혼
};

/** 세계에서 다시 연 결혼 모델 파라미터(결혼 모델의 calibratedParams 위에 덮어쓴다). */
export const CALIBRATED_WORLD_MARRIAGE: Partial<MarriageParams> = {
  desireBase: 1.803, // 평균 자녀 수 (세계에서 다시 보정)
  birthPace: 2.769, // 자녀 수 분포(원하는 만큼 낳는가) (세계에서 다시 보정)
  desireCollegeDrop: 0.005321, // 대졸 무자녀·자녀 수 (세계에서 다시 보정)
  leaveIntercept: -5.236, // 전체 해체율 수준 (세계에서 다시 보정)
  chronicStrainBase: 0.725, // 학력별 이혼(고졸 미만) (세계에서 다시 보정)
};
