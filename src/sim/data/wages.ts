import type { GameDate } from '../../game/types';
import { valueAt, type AnnualSeries } from './series';

/**
 * SSA 전국 평균임금지수(AWI) — 사회보장 가입 근로자의 연간 평균 임금(달러).
 *
 * 출처: Social Security Administration, "National Average Wage Index"
 * (https://www.ssa.gov/oact/cola/AWI.html). 1951–2024 전부 원문 그대로.
 *
 * 쓰임새: NPC·Roy의 급여를 "그 해 평균 임금의 몇 배"로 표현하면 시대가 바뀌어도 상대적
 * 위치가 유지된다(1975년 공장 노동자와 2005년 공장 노동자의 명목 임금은 달라도 평균 대비
 * 비율은 비슷하다). 평균이지 중앙값이 아니다 — 중앙값은 대략 이 값의 0.7~0.75배.
 * 2025년 이후는 연 3.5% 외삽(최근 10년 평균 증가율 근처, 게임용 가정).
 */
export const SSA_AVERAGE_WAGE_INDEX: Readonly<Record<number, number>> = {
  1951: 2799.16,
  1952: 2973.32,
  1953: 3139.44,
  1954: 3155.64,
  1955: 3301.44,
  1956: 3532.36,
  1957: 3641.72,
  1958: 3673.8,
  1959: 3855.8,
  1960: 4007.12,
  1961: 4086.76,
  1962: 4291.4,
  1963: 4396.64,
  1964: 4576.32,
  1965: 4658.72,
  1966: 4938.36,
  1967: 5213.44,
  1968: 5571.76,
  1969: 5893.76,
  1970: 6186.24,
  1971: 6497.08,
  1972: 7133.8,
  1973: 7580.16,
  1974: 8030.76,
  1975: 8630.92,
  1976: 9226.48,
  1977: 9779.44,
  1978: 10556.03,
  1979: 11479.46,
  1980: 12513.46,
  1981: 13773.1,
  1982: 14531.34,
  1983: 15239.24,
  1984: 16135.07,
  1985: 16822.51,
  1986: 17321.82,
  1987: 18426.51,
  1988: 19334.04,
  1989: 20099.55,
  1990: 21027.98,
  1991: 21811.6,
  1992: 22935.42,
  1993: 23132.67,
  1994: 23753.53,
  1995: 24705.66,
  1996: 25913.9,
  1997: 27426.0,
  1998: 28861.44,
  1999: 30469.84,
  2000: 32154.82,
  2001: 32921.92,
  2002: 33252.09,
  2003: 34064.95,
  2004: 35648.55,
  2005: 36952.94,
  2006: 38651.41,
  2007: 40405.48,
  2008: 41334.97,
  2009: 40711.61,
  2010: 41673.83,
  2011: 42979.61,
  2012: 44321.67,
  2013: 44888.16,
  2014: 46481.52,
  2015: 48098.63,
  2016: 48642.15,
  2017: 50321.89,
  2018: 52145.8,
  2019: 54099.99,
  2020: 55628.6,
  2021: 60575.07,
  2022: 63795.13,
  2023: 66621.8,
  2024: 69846.57,
};

export const AVERAGE_WAGE_SERIES: AnnualSeries = {
  table: SSA_AVERAGE_WAGE_INDEX,
  before: { kind: 'growth', annualRate: 0.04 },
  after: { kind: 'growth', annualRate: 0.035 },
  interpolation: 'geometric',
};

/** 해당 연도의 연간 평균 임금(달러, 명목). */
export function averageAnnualWageAt(year: number): number {
  return valueAt(AVERAGE_WAGE_SERIES, year);
}

// ---- 최저임금 ----

export interface MinimumWageChange {
  /** 시행일 'YYYY-MM-DD'. */
  effective: string;
  /** 시급(달러). */
  hourly: number;
  /** 사업장 규모별로 갈렸던 시기(CA 2017–2022)의 25인 이하 사업장 시급. */
  smallEmployerHourly?: number;
}

/**
 * 연방 최저임금(비농업 적용 근로자 기준).
 * 출처: U.S. Department of Labor, Wage and Hour Division, "Changes in Basic Minimum Wages in
 * Non-Farm Employment Under State Law" 및 연방 최저임금 연혁 차트
 * (https://www.dol.gov/agencies/whd/minimum-wage/history/chart). 2009-07-24 이후 변동 없음.
 */
export const FEDERAL_MINIMUM_WAGE: readonly MinimumWageChange[] = [
  { effective: '1956-03-01', hourly: 1.0 },
  { effective: '1961-09-03', hourly: 1.15 },
  { effective: '1963-09-03', hourly: 1.25 },
  { effective: '1967-02-01', hourly: 1.4 },
  { effective: '1968-02-01', hourly: 1.6 },
  { effective: '1974-05-01', hourly: 2.0 },
  { effective: '1975-01-01', hourly: 2.1 },
  { effective: '1976-01-01', hourly: 2.3 },
  { effective: '1978-01-01', hourly: 2.65 },
  { effective: '1979-01-01', hourly: 2.9 },
  { effective: '1980-01-01', hourly: 3.1 },
  { effective: '1981-01-01', hourly: 3.35 },
  { effective: '1990-04-01', hourly: 3.8 },
  { effective: '1991-04-01', hourly: 4.25 },
  { effective: '1996-10-01', hourly: 4.75 },
  { effective: '1997-09-01', hourly: 5.15 },
  { effective: '2007-07-24', hourly: 5.85 },
  { effective: '2008-07-24', hourly: 6.55 },
  { effective: '2009-07-24', hourly: 7.25 },
];

/**
 * 캘리포니아 주 최저임금(성인). Roy는 잉글우드(LA 카운티) 출신이라 이쪽이 실제로 적용된다.
 * 출처: California Department of Industrial Relations, "History of California Minimum Wage"
 * (https://www.dir.ca.gov/iwc/minimumwagehistory.htm) — 2018년까지.
 * 2019–2026: DIR Minimum Wage FAQ (https://dir.ca.gov/dlse/faq_minimumwage.htm).
 * 2023년부터는 사업장 규모 구분 없이 단일, 이후 CPI 연동(연 최대 3.5%).
 * 주의(미확인): CA 최저임금은 여성·미성년자 대상 IWC 명령에서 출발했고 성인 남성까지 확대된
 * 건 1970년대 초로 알려져 있다 — 원문으로 확인하지 못했다. 맞다면 1960년대 남성 노동자에겐
 * effectiveMinimumWageAt보다 연방 기준이 더 현실적이다.
 * 로스앤젤레스 시/카운티는 2016년부터 주보다 높은 자체 최저임금이 있다(여기 미포함).
 */
export const CALIFORNIA_MINIMUM_WAGE: readonly MinimumWageChange[] = [
  { effective: '1952-08-01', hourly: 0.75 },
  { effective: '1957-11-15', hourly: 1.0 },
  { effective: '1963-08-30', hourly: 1.25 },
  { effective: '1964-08-30', hourly: 1.3 },
  { effective: '1968-02-01', hourly: 1.65 },
  { effective: '1974-03-04', hourly: 2.0 },
  { effective: '1976-10-18', hourly: 2.5 },
  { effective: '1978-04-01', hourly: 2.65 },
  { effective: '1979-01-01', hourly: 2.9 },
  { effective: '1980-01-01', hourly: 3.1 },
  { effective: '1981-01-01', hourly: 3.35 },
  { effective: '1988-07-01', hourly: 4.25 },
  { effective: '1996-10-01', hourly: 4.75 },
  { effective: '1997-03-01', hourly: 5.0 },
  { effective: '1997-09-01', hourly: 5.15 },
  { effective: '1998-03-01', hourly: 5.75 },
  { effective: '2001-01-01', hourly: 6.25 },
  { effective: '2002-01-01', hourly: 6.75 },
  { effective: '2007-01-01', hourly: 7.5 },
  { effective: '2008-01-01', hourly: 8.0 },
  { effective: '2014-07-01', hourly: 9.0 },
  { effective: '2016-01-01', hourly: 10.0 },
  { effective: '2017-01-01', hourly: 10.5, smallEmployerHourly: 10.0 },
  { effective: '2018-01-01', hourly: 11.0, smallEmployerHourly: 10.5 },
  { effective: '2019-01-01', hourly: 12.0, smallEmployerHourly: 11.0 },
  { effective: '2020-01-01', hourly: 13.0, smallEmployerHourly: 12.0 },
  { effective: '2021-01-01', hourly: 14.0, smallEmployerHourly: 13.0 },
  { effective: '2022-01-01', hourly: 15.0, smallEmployerHourly: 14.0 },
  { effective: '2023-01-01', hourly: 15.5 },
  { effective: '2024-01-01', hourly: 16.0 },
  { effective: '2025-01-01', hourly: 16.5 },
  { effective: '2026-01-01', hourly: 16.9 },
];

function toComparable(date: GameDate): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-31`;
}

/**
 * 해당 날짜에 시행 중이던 최저임금. 월 단위라 그 달 안에 시행된 변경은 그 달부터 적용으로 본다.
 * 표의 마지막 변경 이후는 그 값을 유지한다(연방은 실제로 2009년 이후 동결, CA는 2027년 이후
 * 인상분을 모름 — 필요하면 CPI 연동으로 외삽하도록 바꾸자).
 */
export function minimumWageAt(
  date: GameDate,
  jurisdiction: 'federal' | 'california',
  employerSize: 'large' | 'small' = 'large',
): number {
  const table = jurisdiction === 'federal' ? FEDERAL_MINIMUM_WAGE : CALIFORNIA_MINIMUM_WAGE;
  const key = toComparable(date);
  let current: MinimumWageChange | undefined;
  for (const change of table) {
    if (change.effective <= key) current = change;
  }
  if (!current) return 0;
  return employerSize === 'small' && current.smallEmployerHourly !== undefined ? current.smallEmployerHourly : current.hourly;
}

/**
 * 실효 최저임금 — 연방과 주 중 높은 쪽(둘 다 적용될 때 근로자에게 유리한 쪽이 적용된다).
 */
export function effectiveMinimumWageAt(date: GameDate, employerSize: 'large' | 'small' = 'large'): number {
  return Math.max(minimumWageAt(date, 'federal'), minimumWageAt(date, 'california', employerSize));
}
