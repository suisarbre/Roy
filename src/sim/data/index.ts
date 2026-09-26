/**
 * 세계 데이터 — 시뮬레이션이 "그 시절 현실"과 맞게 돌아가도록 하는 사실 테이블 모음.
 * 출처와 가정은 각 파일 머리 주석과 README.md에 있다.
 */
export { valueAt, coveredRange, type AnnualSeries, type AnnualTable, type Extrapolation } from './series';
export { CPI_U_ANNUAL_AVERAGE, CPI_SERIES, cpiAt, convertDollars, priceIn } from './cpi';
export {
  SSA_AVERAGE_WAGE_INDEX,
  AVERAGE_WAGE_SERIES,
  averageAnnualWageAt,
  FEDERAL_MINIMUM_WAGE,
  CALIFORNIA_MINIMUM_WAGE,
  minimumWageAt,
  effectiveMinimumWageAt,
  type MinimumWageChange,
} from './wages';
export { US_UNEMPLOYMENT_RATE, UNEMPLOYMENT_SERIES, unemploymentRateAt } from './unemployment';
export {
  MORTGAGE_30Y_RATE,
  MORTGAGE_SERIES,
  mortgageRateAt,
  monthlyMortgagePayment,
  MEDIAN_NEW_HOME_PRICE,
  HOME_PRICE_SERIES,
  medianNewHomePriceAt,
  MEDIAN_GROSS_RENT,
  RENT_SERIES,
  medianGrossRentAt,
  HOMEOWNERSHIP_BY_AGE_ROY_COHORT,
} from './housing';
export {
  COHORT_LIFE_TABLES,
  annualDeathProbability,
  monthlyDeathProbability,
  lifeExpectancyAtBirth,
  survivalProbability,
  sampleAgeAtDeath,
  type Sex,
} from './lifeTables';
export {
  US_RECESSIONS,
  isInRecession,
  SELECTIVE_SERVICE,
  selectiveServiceRegistrationDate,
  type Recession,
} from './eraFacts';
export {
  VALIDATION_TARGETS,
  HOMEOWNERSHIP_TARGETS,
  FERTILITY_DISTRIBUTION_NLSY79_WOMEN,
  MARRIAGE_COUNT_SHARES_NLSY79,
  type ValidationTarget,
} from './validationTargets';
export {
  MARRIAGE_MOMENTS,
  MARRIAGE_MECHANISM_NOTES,
  CALIFORNIA_DIVORCE_REGIMES,
  californiaDivorceRegimeAt,
  US_REFINED_DIVORCE_RATE_ANCHORS,
  DIVORCE_ERA_FACTS,
  type CalibrationMoment,
  type MomentKind,
  type DivorceRegime,
} from './marriage';
