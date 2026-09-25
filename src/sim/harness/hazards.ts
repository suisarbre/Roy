/**
 * 생애사건(결혼/이혼/취업/자가보유) 확률을 "이 순간 일어날 확률"(월간 해저드)로 바꾸는
 * 헬퍼들. 실제 생애사건은 하나의 검증 가능한 수치(예: "55세까지 결혼 85%")로만 주어지고,
 * "정확히 몇 살에 몇 % 확률로"는 데이터에 없다 — 그 형태(shape)는 우리가 정해야 한다.
 * 이 파일이 그 변환을 맡는다. 형태 자체는 튜닝 대상이라 monteCarlo.ts로 실제로 돌려보고
 * 맞을 때까지 조정한다.
 */

/** 나이별 가우시안 모양 해저드 — 결혼처럼 "어느 나이대에 몰리는" 사건에 쓴다. */
export function gaussianAgeHazard(ageYears: number, peakAge: number, spreadYears: number, peakMonthlyRate: number): number {
  const z = (ageYears - peakAge) / spreadYears;
  return peakMonthlyRate * Math.exp(-0.5 * z * z);
}

/**
 * 나이 구간별 "그 구간 동안 몇 번 일어나는가"(예: 취업 건수)를 월간 해저드로 바꾼다.
 * 구간 끝의 나이는 다음 구간 시작과 겹치지 않게(ageTo가 배타적) 넣는다.
 */
export interface AgeBandRate {
  ageFrom: number;
  ageTo: number;
  countInBand: number;
}

export function ageBandMonthlyHazard(ageYears: number, bands: readonly AgeBandRate[]): number {
  const band = bands.find((b) => ageYears >= b.ageFrom && ageYears < b.ageTo);
  if (!band) return 0;
  const years = band.ageTo - band.ageFrom;
  const perYear = band.countInBand / years;
  return perYear / 12;
}

/**
 * "이 나이 구간이 끝날 때까지 누적 몇 %가 도달했는가"(예: 자가 보유율)로 주어진 표를,
 * 아직 도달 안 한 사람이 이번 달에 도달할 조건부 월간 해저드로 바꾼다.
 * cumulativeByAgeEnd는 ageTo 오름차순이어야 한다.
 */
export interface CumulativeAgeBand {
  ageFrom: number;
  ageTo: number;
  /** 이 구간 끝(ageTo)까지 누적 도달 비율(0~1). */
  cumulativeByAgeEnd: number;
}

export function cumulativeToMonthlyHazard(ageYears: number, bands: readonly CumulativeAgeBand[]): number {
  const index = bands.findIndex((b) => ageYears >= b.ageFrom && ageYears < b.ageTo);
  if (index === -1) return 0;

  const band = bands[index];
  const priorCumulative = index === 0 ? 0 : bands[index - 1].cumulativeByAgeEnd;
  const remainingPool = 1 - priorCumulative;
  if (remainingPool <= 0) return 0;

  const withinBandProbability = Math.max(0, Math.min(1, (band.cumulativeByAgeEnd - priorCumulative) / remainingPool));
  const monthsInBand = (band.ageTo - band.ageFrom) * 12;
  // (1-h)^months = 1-withinBandProbability 를 h에 대해 푼다.
  return 1 - Math.pow(1 - withinBandProbability, 1 / monthsInBand);
}
