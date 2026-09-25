import { valueAt, type AnnualSeries } from './series';

// ---- 모기지 금리 ----

/**
 * 30년 고정 모기지 금리(%), 연평균.
 *
 * 출처: Freddie Mac Primary Mortgage Market Survey(PMMS), FRED 시리즈 MORTGAGE30US의 연평균.
 * 연평균 값은 chartrow.com/mortgage-rates(PMMS via FRED 명시)에서 받았고, FRED 주간 원자료와
 * Freddie Mac 공표 연평균(1981=16.63~16.64, 2012=3.66, 2021=2.96, 2023=6.81, 2024=6.72)으로
 * 대조했다. 2026년은 부분 연도라 제외했다.
 *
 * PMMS는 1971년 4월 시작 — 그 이전(1962–1970)은 1971년 값을 유지한다. 실제 1960년대 금리는
 * 대략 6%대 초중반으로 이보다 조금 낮았다(FHA 계약금리 기준, 원문 미확인).
 * 2026년 이후는 마지막 값 유지.
 */
export const MORTGAGE_30Y_RATE: Readonly<Record<number, number>> = {
  1971: 7.54,
  1972: 7.38,
  1973: 8.04,
  1974: 9.19,
  1975: 9.05,
  1976: 8.87,
  1977: 8.85,
  1978: 9.64,
  1979: 11.2,
  1980: 13.74,
  1981: 16.64,
  1982: 16.04,
  1983: 13.24,
  1984: 13.88,
  1985: 12.43,
  1986: 10.19,
  1987: 10.21,
  1988: 10.34,
  1989: 10.32,
  1990: 10.13,
  1991: 9.25,
  1992: 8.39,
  1993: 7.31,
  1994: 8.38,
  1995: 7.93,
  1996: 7.81,
  1997: 7.6,
  1998: 6.94,
  1999: 7.44,
  2000: 8.05,
  2001: 6.97,
  2002: 6.54,
  2003: 5.83,
  2004: 5.84,
  2005: 5.87,
  2006: 6.41,
  2007: 6.34,
  2008: 6.03,
  2009: 5.04,
  2010: 4.69,
  2011: 4.45,
  2012: 3.66,
  2013: 3.98,
  2014: 4.17,
  2015: 3.85,
  2016: 3.65,
  2017: 3.99,
  2018: 4.54,
  2019: 3.94,
  2020: 3.11,
  2021: 2.96,
  2022: 5.34,
  2023: 6.81,
  2024: 6.72,
  2025: 6.6,
};

export const MORTGAGE_SERIES: AnnualSeries = {
  table: MORTGAGE_30Y_RATE,
  before: { kind: 'hold' },
  after: { kind: 'hold' },
  interpolation: 'linear',
};

/** 퍼센트(예: 16.64). */
export function mortgageRateAt(year: number): number {
  return valueAt(MORTGAGE_SERIES, year);
}

/** 원리금 균등 상환 월 납입액. principal 달러, annualRatePercent %(예: 7.5), 기간 년. */
export function monthlyMortgagePayment(principal: number, annualRatePercent: number, years = 30): number {
  const r = annualRatePercent / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

// ---- 집값 ----

/**
 * 미국 신규 주택 판매가격 중앙값(달러, 명목), 연간.
 *
 * 출처: U.S. Census Bureau Survey of Construction, "Median and Average Sales Prices of New
 * Homes Sold in United States"(FRED MSPUS 계열과 같은 원천). Census 원문 PDF는 robots 규칙으로
 * 직접 받지 못해 housingalmanac.com/median-home-price-by-year(같은 Census 원천 명시)에서
 * 받았고 대표 연도(1963=18,000, 1980=64,600, 2022=457,800)를 대조했다.
 *
 * 전국 "신축" 기준이다. LA 권역 기존 주택은 1970년대 후반부터 전국보다 훨씬 비쌌다(
 * 시기에 따라 크게 변동, 배수는 원문 미확인) — 지역 배수는 별도 파라미터로 두는 걸 권장.
 * 1962년은 1963년 값에서 연 2%로 역산, 2025년 이후는 연 4% 외삽(게임용 가정).
 */
export const MEDIAN_NEW_HOME_PRICE: Readonly<Record<number, number>> = {
  1963: 18000,
  1964: 18900,
  1965: 20000,
  1966: 21400,
  1967: 22700,
  1968: 24700,
  1969: 25600,
  1970: 23400,
  1971: 25200,
  1972: 27600,
  1973: 32500,
  1974: 35900,
  1975: 39300,
  1976: 44200,
  1977: 48800,
  1978: 55700,
  1979: 62900,
  1980: 64600,
  1981: 68900,
  1982: 69300,
  1983: 75300,
  1984: 79900,
  1985: 84300,
  1986: 92000,
  1987: 104500,
  1988: 112500,
  1989: 120000,
  1990: 122900,
  1991: 120000,
  1992: 121500,
  1993: 126500,
  1994: 130000,
  1995: 133900,
  1996: 140000,
  1997: 146000,
  1998: 152500,
  1999: 161000,
  2000: 169000,
  2001: 175200,
  2002: 187600,
  2003: 195000,
  2004: 221000,
  2005: 240900,
  2006: 246500,
  2007: 247900,
  2008: 232100,
  2009: 216700,
  2010: 221800,
  2011: 227200,
  2012: 245200,
  2013: 268900,
  2014: 282800,
  2015: 296400,
  2016: 307800,
  2017: 323100,
  2018: 326400,
  2019: 321500,
  2020: 336900,
  2021: 397100,
  2022: 457800,
  2023: 428600,
  2024: 420300,
};

export const HOME_PRICE_SERIES: AnnualSeries = {
  table: MEDIAN_NEW_HOME_PRICE,
  before: { kind: 'growth', annualRate: 0.02 },
  after: { kind: 'growth', annualRate: 0.04 },
  interpolation: 'geometric',
};

export function medianNewHomePriceAt(year: number): number {
  return valueAt(HOME_PRICE_SERIES, year);
}

// ---- 월세 ----

/**
 * 미국 월 총임대료(gross rent: 월세 + 공과금) 중앙값(달러, 명목).
 *
 * 출처:
 * - 1940–2000: Census Historical Census of Housing Tables, "Median Gross Rents: Unadjusted"
 *   (grossrents-unadj.txt). 원문은 robots 규칙으로 막혀 있어, 그 파일을 출처로 명시한
 *   lexlevinrad.com의 전재본에서 받았다(71/108/243/447/602는 널리 인용되는 값과 일치).
 * - 2023: Census ACS 1-year, 2024년 보도자료("Nearly Half of Renter Households Are
 *   Cost-Burdened") — $1,406.
 * 사이 연도는 기하 보간. 10년 간격 사이의 실제 경로(특히 1970년대 인플레)는 보간보다 울퉁불퉁했다.
 * 2024년 이후는 연 3.5% 외삽(게임용 가정).
 */
export const MEDIAN_GROSS_RENT: Readonly<Record<number, number>> = {
  1940: 27,
  1950: 42,
  1960: 71,
  1970: 108,
  1980: 243,
  1990: 447,
  2000: 602,
  2023: 1406,
};

export const RENT_SERIES: AnnualSeries = {
  table: MEDIAN_GROSS_RENT,
  before: { kind: 'growth', annualRate: 0.04 },
  after: { kind: 'growth', annualRate: 0.035 },
  interpolation: 'geometric',
};

export function medianGrossRentAt(year: number): number {
  return valueAt(RENT_SERIES, year);
}

// ---- 자가 보유율 ----

/**
 * Roy 코호트(1962년생 전후)가 각 연령대를 지날 때의 미국 자가 보유율(%) — 가구주 기준.
 * Census CPS/HVS Table 15 "Homeownership Rates by Age of Householder"
 * (https://www.census.gov/housing/hvs/files/annual05/ann05t15.txt)에서 코호트 대각선을 따라
 * 뽑았다: 25–29세는 1987–1991, 30–34세는 1992–1996, 35–39세는 1997–2001, 40–44세는 2002–2005
 * 연평균. 45세 이후는 이 표(2005년까지)에 없어서 2005년 횡단면 값을 근사치로 둔다.
 * 3단계 하네스의 검증 타깃으로도 쓴다(validationTargets.ts).
 */
export const HOMEOWNERSHIP_BY_AGE_ROY_COHORT: readonly { ageFrom: number; ageTo: number; percent: number; note: string }[] = [
  { ageFrom: 25, ageTo: 29, percent: 35.3, note: '1987–1991 평균(36.4, 35.9, 35.3, 35.2, 33.8)' },
  { ageFrom: 30, ageTo: 34, percent: 51.6, note: '1992–1996 평균(50.5, 51.0, 50.6, 53.1, 53.0)' },
  { ageFrom: 35, ageTo: 39, percent: 64.2, note: '1997–2001 평균(62.6, 63.7, 64.4, 65.0, 65.5)' },
  { ageFrom: 40, ageTo: 44, percent: 71.7, note: '2002–2005 평균(71.7, 71.3, 71.9, 71.7)' },
  { ageFrom: 45, ageTo: 54, percent: 76.6, note: '2005년 횡단면 근사(코호트 값 아님)' },
  { ageFrom: 55, ageTo: 64, percent: 81.2, note: '2005년 횡단면 근사(코호트 값 아님)' },
  { ageFrom: 65, ageTo: 120, percent: 80.6, note: '2005년 횡단면 근사(코호트 값 아님)' },
];
