import { valueAt, type AnnualSeries } from './series';

/**
 * 미국 실업률(16세 이상 민간 노동력, %), 연평균.
 *
 * 출처: BLS Current Population Survey 연간 표 "Employment status of the civilian
 * noninstitutional population, 1940s to date"(cpsaat01). github.com/datasets/employment-us
 * (data/aat1.csv) 미러에서 받았고 대표 연도(1982=9.7, 2010=9.6, 2020=8.1)를 대조했다.
 *
 * 전국 수치다. 캘리포니아는 대체로 전국보다 0.5~1.5%p 높았다(특히 1990년대 초 국방비
 * 감축기) — 필요하면 지역 가산치를 따로 두자.
 * 2026년 이후는 장기 평균 5.0%로 반감기 3년 평균 회귀(게임용 가정).
 */
export const US_UNEMPLOYMENT_RATE: Readonly<Record<number, number>> = {
  1955: 4.4,
  1956: 4.1,
  1957: 4.3,
  1958: 6.8,
  1959: 5.5,
  1960: 5.5,
  1961: 6.7,
  1962: 5.5,
  1963: 5.7,
  1964: 5.2,
  1965: 4.5,
  1966: 3.8,
  1967: 3.8,
  1968: 3.6,
  1969: 3.5,
  1970: 4.9,
  1971: 5.9,
  1972: 5.6,
  1973: 4.9,
  1974: 5.6,
  1975: 8.5,
  1976: 7.7,
  1977: 7.1,
  1978: 6.1,
  1979: 5.8,
  1980: 7.1,
  1981: 7.6,
  1982: 9.7,
  1983: 9.6,
  1984: 7.5,
  1985: 7.2,
  1986: 7.0,
  1987: 6.2,
  1988: 5.5,
  1989: 5.3,
  1990: 5.6,
  1991: 6.8,
  1992: 7.5,
  1993: 6.9,
  1994: 6.1,
  1995: 5.6,
  1996: 5.4,
  1997: 4.9,
  1998: 4.5,
  1999: 4.2,
  2000: 4.0,
  2001: 4.7,
  2002: 5.8,
  2003: 6.0,
  2004: 5.5,
  2005: 5.1,
  2006: 4.6,
  2007: 4.6,
  2008: 5.8,
  2009: 9.3,
  2010: 9.6,
  2011: 8.9,
  2012: 8.1,
  2013: 7.4,
  2014: 6.2,
  2015: 5.3,
  2016: 4.9,
  2017: 4.4,
  2018: 3.9,
  2019: 3.7,
  2020: 8.1,
  2021: 5.3,
  2022: 3.6,
  2023: 3.6,
  2024: 4.0,
  2025: 4.3,
};

export const UNEMPLOYMENT_SERIES: AnnualSeries = {
  table: US_UNEMPLOYMENT_RATE,
  before: { kind: 'hold' },
  after: { kind: 'meanRevert', longRunMean: 5.0, halfLifeYears: 3 },
  interpolation: 'linear',
};

/** 퍼센트(예: 9.7). 확률로 쓰려면 /100. */
export function unemploymentRateAt(year: number): number {
  return valueAt(UNEMPLOYMENT_SERIES, year);
}
