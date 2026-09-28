import type { Race } from './career/types';
import { inverseNormalCdf, normalCdf } from './stats';

/**
 * 인구 구성과 출생 배경 — 인종, 이민 여부, 부모 소득·자산 순위, 자란 동네의 빈곤율.
 *
 * 원칙(REALISM_V2.md): 인종은 인구 속성이지 행동 계수가 아니다. 여기서 인종이 하는 일은 **출생 배경의 분포**를
 * 바꾸는 것뿐이다 — 부모 소득(Chetty et al. 2020), 부모 자산(CBO 2022), 자란 동네(Sharkey 2009). 그 뒤의 격차는
 * 이 배경과 측정된 구조 경로(채용 차별, 단속·양형, 결혼 시장 구성)를 거쳐 모듈들 안에서 창발한다.
 *
 * 모든 추출은 공통 난수를 지킨다: 균등 난수 u 하나를 받아 인종 조건부로 변환한다. 같은 시드는 같은 인종 안에서
 * 같은 상대적 위치를 갖는다.
 *
 * 잠재변수 파라미터는 scratch 적합(수치 해)으로 정했다 — 결과는 아래 각 상수 주석에.
 */

export type { Race } from './career/types';
export const RACE_LIST: readonly Race[] = ['white', 'black', 'hispanic', 'other'];

export type RaceShares = Record<Race, number>;

/**
 * 1980년 18–24세(1956–62년생) 전국 구성 — NCES Digest 2022 Table 101.20(data/raceEconomy.ts
 * RACE_STRUCTURE_FACTS.cohortComposition). other = 아시아계 + 원주민.
 */
export const NATIONAL_SHARES_1957_64: RaceShares = { white: 23278 / 30103, black: 3872 / 30103, hispanic: 2284 / 30103, other: 669 / 30103 };

/**
 * 가정(원문 미확인): 다른 출생 코호트의 전국 구성. 1930–49년생(Roy의 부모 세대)은 1960년 센서스 무렵 구성에 가깝게,
 * 1975년 이후 출생(Roy의 자녀 세대)은 1990–2000년대 아동 구성에 가깝게. 부모·자녀 NPC의 인종은 대개 가족에서
 * 물려받으므로(kin) 이 표는 가족 밖 사람을 뽑을 때만 쓴다.
 */
const NATIONAL_SHARES_PRE1950: RaceShares = { white: 0.86, black: 0.1, hispanic: 0.03, other: 0.01 };
const NATIONAL_SHARES_POST1975: RaceShares = { white: 0.62, black: 0.15, hispanic: 0.17, other: 0.06 };

/**
 * 가정(원문 미확인): LA 카운티의 1957–64년생 구성. 전 연령 1980 센서스(백인 53%, 히스패닉 28%, 흑인 12%, 아시아 6%)보다
 * 청년층은 히스패닉 비중이 높아서 그쪽으로 옮겼다. 부모 세대·자녀 세대도 같은 방향으로 이동.
 */
const LA_SHARES_1957_64: RaceShares = { white: 0.45, black: 0.13, hispanic: 0.33, other: 0.09 };
const LA_SHARES_PRE1950: RaceShares = { white: 0.7, black: 0.11, hispanic: 0.15, other: 0.04 };
const LA_SHARES_POST1975: RaceShares = { white: 0.25, black: 0.1, hispanic: 0.5, other: 0.15 };

export function raceShares(birthYear: number, losAngeles: boolean): RaceShares {
  const [pre, mid, post] = losAngeles ? [LA_SHARES_PRE1950, LA_SHARES_1957_64, LA_SHARES_POST1975] : [NATIONAL_SHARES_PRE1950, NATIONAL_SHARES_1957_64, NATIONAL_SHARES_POST1975];
  // 1950 이전 → 1957–64 → 1975 이후를 선형으로 잇는다.
  const lerp = (a: RaceShares, b: RaceShares, t: number): RaceShares => {
    const out = {} as RaceShares;
    for (const r of RACE_LIST) out[r] = a[r] + (b[r] - a[r]) * t;
    return out;
  };
  if (birthYear <= 1950) return pre;
  if (birthYear < 1957) return lerp(pre, mid, (birthYear - 1950) / 7);
  if (birthYear <= 1964) return mid;
  if (birthYear < 1975) return lerp(mid, post, (birthYear - 1964) / 11);
  return post;
}

export function drawRace(u: number, birthYear: number, losAngeles: boolean): Race {
  const shares = raceShares(birthYear, losAngeles);
  let acc = 0;
  for (const r of RACE_LIST) {
    acc += shares[r];
    if (u < acc) return r;
  }
  return 'white';
}

/**
 * 가정(원문 미확인): 이민 1세대 비율(1990년 무렵 25–34세 거주자 기준 추정). 이민자는 16세부터 미국에 있다고 단순화한다
 * (입국 나이를 모델하지 않음) — 학력·언어 임금 할인은 경력 모델이 읽는다.
 */
export const IMMIGRANT_SHARE: Record<Race, number> = { white: 0.03, black: 0.07, hispanic: 0.45, other: 0.65 };

// ---- 부모 소득 순위 ----

/**
 * 부모 소득 잠재변수 x ~ N(μ_race, 1), 순위 = 전국 혼합분포 CDF(x). μ는 부모 가구소득 중앙값의 전국 순위를 맞춘 값:
 * 흑인 0.25(중앙값 $29,200), 히스패닉 0.30($33,060), 기타 0.48(아시아계 $53,010) — Chetty et al. (2020) 1978–83년생의
 * 부모. 결과: 백인 중앙 순위 0.56·평균 0.55, 흑인 평균 0.31, 히스패닉 평균 0.35(원문 0.362와 일치).
 * Roy 코호트 자신의 부모(1920–40년대생)에 대한 같은 분포는 없어 근사로 쓴다.
 */
export const PARENT_INCOME_MU: Record<Race, number> = { white: 0, black: -0.878, hispanic: -0.718, other: -0.216 };

/** 혼합 CDF는 1957–64년생 전국 구성으로 고정한다(순위는 "그 코호트 부모들 사이의 위치"). */
function mixtureCdf(x: number, mu: Record<Race, number>): number {
  let p = 0;
  for (const r of RACE_LIST) p += NATIONAL_SHARES_1957_64[r] * normalCdf(x - mu[r]);
  return p;
}

/** 균등 난수 u(인종과 무관하게 뽑은 것)를 인종 조건부 부모 소득 순위로. 잠재값도 돌려준다(자산·동네가 쓴다). */
export function parentIncomeRank(u: number, race: Race): { rank: number; latent: number } {
  const latent = PARENT_INCOME_MU[race] + inverseNormalCdf(u);
  return { rank: mixtureCdf(latent, PARENT_INCOME_MU), latent };
}

// ---- 부모 자산 순위 ----

/**
 * 부모 자산 잠재변수 y = 0.7·x + 0.714·e + c_race (조건부 표준편차 1). 자산 격차 > 소득 격차: 인종별 자산 중앙값의
 * 전국 순위를 흑인 0.22, 히스패닉 0.23, 기타 0.43에 맞췄다(CBO 1989 가구 자산 중앙값 백인 $171,300, 흑인 $14,200,
 * 히스패닉 $14,700, 아시아·기타 $66,100 — 전국 분포상 순위는 가정). 백인 중앙 순위 0.575.
 * 소득–자산 순위 상관 0.7은 가정(원문 미확인).
 */
const WEALTH_C: Record<Race, number> = { white: 0, black: -0.4376, hispanic: -0.5123, other: -0.2445 };
const WEALTH_MEAN: Record<Race, number> = {
  white: 0,
  black: WEALTH_C.black + 0.7 * PARENT_INCOME_MU.black,
  hispanic: WEALTH_C.hispanic + 0.7 * PARENT_INCOME_MU.hispanic,
  other: WEALTH_C.other + 0.7 * PARENT_INCOME_MU.other,
};

export function parentWealthRank(incomeLatent: number, noise: number, race: Race): number {
  const y = WEALTH_C[race] + 0.7 * incomeLatent + Math.sqrt(1 - 0.49) * noise;
  return mixtureCdf(y, WEALTH_MEAN);
}

// ---- 자란 동네 ----

/**
 * 어린 시절 센서스 트랙트 빈곤율: logit(빈곤율) = a_race − 0.200·z_부모소득 + 0.666·e.
 * 백인 −2.610, 흑인 −1.332에 맞춘 결과(Sharkey 2009, PSID 1955–70년생): 빈곤 20% 이상 동네 백인 3.5%(원문 4%)·흑인 60.8%(62%),
 * 30% 이상 흑인 30.7%(30%), 10% 미만 백인 74.1%(74%)·흑인 7.5%(9%), 중상위(상위 3개 5분위) 가정 아이 중 20% 이상
 * 흑인 49%(49%)·백인 2.3%(1%). 소득만으로는 이 분리가 안 나온다(원문 결론) — 인종 절편이 거주 분리를 나타낸다.
 * 가정: 히스패닉 절편은 흑–백 사이 60%(Jargowsky 2003의 빈곤층 집중 빈곤 노출 비율로), 기타는 15%.
 */
const POVERTY_A_WHITE = -2.61;
const POVERTY_A_BLACK = -1.332;
export const CHILDHOOD_POVERTY_INTERCEPT: Record<Race, number> = {
  white: POVERTY_A_WHITE,
  black: POVERTY_A_BLACK,
  hispanic: POVERTY_A_WHITE + 0.6 * (POVERTY_A_BLACK - POVERTY_A_WHITE),
  other: POVERTY_A_WHITE + 0.15 * (POVERTY_A_BLACK - POVERTY_A_WHITE),
};

export function childhoodTractPoverty(parentRank: number, noise: number, race: Race): number {
  const z = inverseNormalCdf(Math.min(0.999, Math.max(0.001, parentRank)));
  const logit = CHILDHOOD_POVERTY_INTERCEPT[race] - 0.2 * z + 0.666 * noise;
  return 1 / (1 + Math.exp(-logit));
}

/** 동네 빈곤율을 표준화한 불리함 점수(전국 1957–64년생 분포 기준, 평균 0·표준편차 1 근사). 모듈이 선형으로 쓰기 좋게. */
export function neighborhoodDisadvantage(tractPoverty: number): number {
  const logit = Math.log(tractPoverty / (1 - tractPoverty));
  // 적합한 인구(1957–64년생 전국 구성)에서 logit의 평균 −2.38, 표준편차 0.86.
  return (logit + 2.38) / 0.86;
}
