import type { CalibrationMoment } from './marriage';

/**
 * 인종 — 인구 구성과 경제(학력·고용·임금·이동성·자산). REALISM_V2.md의 "격차는 행동이 아니라 구조에서"를 위한 자료.
 *
 * 두 부분으로 나뉜다.
 * 1. `RACE_ECONOMY_MOMENTS` — 인종(×성별)별 **결과** 적률. 검증용 정답지다. 모델은 이 격차를 인종 계수로 직접
 *    만들면 안 되고, 부모 소득·자산, 동네, 측정된 노동시장 차별, 단속을 거쳐 창발시켜야 한다.
 * 2. `RACE_STRUCTURE_FACTS` — **구조 경로**의 입력(부모 소득 분포, 자산 격차, 거주 분리, 고빈곤 동네 노출,
 *    감사 연구로 측정된 채용 차별 크기, 임금 격차 분해). 파라미터의 근거.
 *
 * 수집 원칙은 marriage.ts와 같다: 원문(HTML 표·보고서 본문)에서 확인한 숫자만. 2차 자료로만 본 값은 `unverified`
 * (구조 사실에서는 `unverified` 문자열 필드). 금액은 가능하면 비율(백인 대비 배수, AWI 배수)로 바꿔 쓴다.
 *
 * 인종 범주: white(비히스패닉 백인), black(비히스패닉 흑인), hispanic, other(아시아계 등). 출처마다 정의가 조금
 * 다르다(CPS 1999의 White/Black은 히스패닉 포함 가능 — 해당 적률 howToMeasure에 적었다).
 */

const NLSY79_RELEASE = 'BLS news release USDL-25-1322, Number of Jobs, Labor Market Experience, Marital Status, and Health for those Born 1957-1964 (NLSY79, 1978–2022)';
const CHETTY_RACE = 'Chetty, Hendren, Jones & Porter (2020), Race and Economic Opportunity in the United States: An Intergenerational Perspective, QJE 135(2)';
const CHETTY_RACE_URL = 'https://opportunityinsights.org/wp-content/uploads/2018/04/race_paper.pdf';
const FED_SCF_2019 = 'Bhutta, Chang, Dettling & Hsu (2020), Disparities in Wealth by Race and Ethnicity in the 2019 Survey of Consumer Finances, FEDS Notes';
const FED_SCF_2019_URL =
  'https://www.federalreserve.gov/econres/notes/feds-notes/disparities-in-wealth-by-race-and-ethnicity-in-the-2019-survey-of-consumer-finances-20200928.html';
const CPS_1999 = 'BLS CPS 1999 annual averages';

/** SSA AWI(wages.ts와 같은 값) — 금액을 평균임금 배수로 바꿀 때. */
const AWI_1999 = 30469.84;
const AWI_2019 = 54099.99;
const AWI_2022 = 63795.13;

export const RACE_ECONOMY_MOMENTS: readonly CalibrationMoment[] = [
  // ---- 학력 ----
  {
    id: 'race.education.age25to29.1990',
    kind: 'conditional',
    description: '25–29세의 고졸 이상·학사 이상 비율 — 인종별(1990년, 즉 1960–65년생)',
    values: {
      hsOrMore_white: 0.901,
      hsOrMore_black: 0.817,
      hsOrMore_hispanic: 0.582,
      hsOrMore_asian: 0.915,
      baOrMore_white: 0.264,
      baOrMore_black: 0.134,
      baOrMore_hispanic: 0.081,
      baOrMore_asian: 0.43,
    },
    unit: 'proportion',
    population: 'CPS 3월, 1990년 25–29세 미국 민간인(비시설) — White·Black은 비히스패닉',
    cohortFit: 'close',
    source: 'NCES Digest of Education Statistics 2023, Table 104.20 (Percentage of persons 25 to 29 years old with selected levels of educational attainment, by race/ethnicity and sex)',
    url: 'https://nces.ed.gov/programs/digest/d23/tables/dt23_104.20.asp',
    howToMeasure:
      '코호트 1960–64년생이 25–29세일 때(모델 1989–1991년) 인종별 최종 학력 ≥ 고졸(GED 포함)과 ≥ 학사 비율. 분모: 그 인종의 생존·국내 거주자 전체(수감자 제외 — CPS는 비시설 인구라 수감 중인 흑인 남성이 빠져 흑인 고졸률이 약간 높게 나온다). 같은 표 1980년(1951–55년생) 값: 고졸 이상 백인 89.2%·흑인 76.7%·히스패닉 58.0%, 학사 이상 25.0%·11.6%·7.7%. 히스패닉 값에는 성인 이민자가 섞여 있다 — 모델이 미국 출생 히스패닉만 굴리면 이 값보다 높아야 정상. 성별 값은 요약 도구가 불일치를 보여 넣지 않았다.',
  },
  // ---- 임금 ----
  {
    id: 'race.earnings.fullTimeMedianWeekly.1999',
    kind: 'conditional',
    description: '풀타임 임금근로자 주급 중앙값 — 인종 × 성별, 백인 남성 대비 비율(1999)',
    values: {
      whiteMen: 1,
      blackMen: 488 / 638,
      hispanicMen: 406 / 638,
      whiteWomen: 483 / 638,
      blackWomen: 409 / 638,
      hispanicWomen: 348 / 638,
      whiteMenToAwiWeekly: 638 / (AWI_1999 / 52),
    },
    unit: 'proportion',
    population: 'CPS 1999 연평균, 16세 이상 풀타임 임금근로자(자영업 제외). White·Black은 히스패닉 포함 가능, Hispanic은 인종 무관',
    cohortFit: 'close',
    source: `${CPS_1999}, Table 37 (median weekly earnings; 백인 남성 $638, 흑인 남성 $488, 히스패닉 남성 $406, 백인 여성 $483, 흑인 여성 $409, 히스패닉 여성 $348)`,
    url: 'https://www.bls.gov/cps/aa1999/aat37.txt',
    howToMeasure:
      '1999년 횡단면(16세 이상 전 연령)이라 코호트(당시 35–42세)보다 젊은 층이 섞여 있다. 모델: 전 연령 합성 횡단면에서 풀타임 임금근로자 주급 중앙값을 인종×성별로 내고 백인 남성 값으로 나눈다. 히스패닉 격차의 상당 부분은 성인 이민자(낮은 학력·영어) 몫 — 모델이 이민을 넣지 않으면 히스패닉 비율은 이보다 높아도 된다. 흑인 남성 0.76은 강한 목표.',
  },
  {
    id: 'race.wageGap.afqtAdjusted.nlsy79',
    kind: 'conditional',
    description: 'NLSY79 1990년 로그 시급의 인종 격차 — 나이만 통제 vs 나이+AFQT 통제(Neal & Johnson 방식)',
    values: {
      black_men_ageOnly: -0.25,
      black_men_withAfqt: -0.06,
      hispanic_men_ageOnly: -0.174,
      hispanic_men_withAfqt: -0.035,
      black_women_ageOnly: -0.172,
      black_women_withAfqt: 0.041,
      hispanic_women_ageOnly: -0.003,
      hispanic_women_withAfqt: 0.154,
    },
    unit: 'logitCoefficient',
    population: 'NLSY79 중 1961년 이후 출생자(1962–64년생 — AFQT를 18세 이하에 치른 사람), 1990년 임금',
    cohortFit: 'exact',
    source: 'Carneiro, Heckman & Masterov (2005), Labor Market Discrimination and Racial Differences in Premarket Factors, J. Law & Econ 48(1), Table 1 (IZA DP 1453)',
    url: 'https://docs.iza.org/dp1453.pdf',
    howToMeasure:
      '단위는 로그 시급 회귀계수(백인=0). 모델: 1990년 취업 중인 1962–64년생의 log(시급)을 인종 더미 + 나이로 회귀, 이어 청소년기 인지능력(모델의 AFQT 대응물) 추가. 남성 격차의 약 3/4이 노동시장 진입 전 기술 격차로 설명되고 약 0.06이 남는다 → 모델의 "채용·임금 차별" 잔차는 이 크기여야 한다. 여성은 AFQT 통제 뒤 격차가 뒤집힌다(과도한 차별 파라미터 금지 신호). 주의: 임금만 본 것이라 고용 격차(아래 적률들)는 따로 설명되어야 한다. 원 Neal & Johnson(1996)의 수치는 원문을 열지 못해 넣지 않았다.',
  },
  // ---- 고용 ----
  {
    id: 'race.employment.age25to54.1999',
    kind: 'conditional',
    description: '25–54세 고용률(인구 대비 취업자)과 실업률 — 인종 × 성별(1999)',
    values: {
      epop_whiteMen: 0.904,
      epop_blackMen: 0.803,
      epop_hispanicMen: 0.879,
      epop_whiteWomen: 0.745,
      epop_blackWomen: 0.746,
      epop_hispanicWomen: 0.621,
      unemp_whiteMen: 0.026,
      unemp_blackMen: 0.056,
      unemp_hispanicMen: 0.041,
      unemp_whiteWomen: 0.03,
      unemp_blackWomen: 0.061,
      unemp_hispanicWomen: 0.064,
    },
    unit: 'proportion',
    population: 'CPS 1999 연평균, 민간 비시설 인구 25–54세(수감자 제외). White·Black은 히스패닉 포함 가능',
    cohortFit: 'close',
    source: `${CPS_1999}, Table 3 (race) & Table 4 (Hispanic origin)`,
    url: 'https://www.bls.gov/cps/aa1999/aat3.txt',
    howToMeasure:
      '1999년 코호트는 35–42세로 25–54 안에 있다. 모델: 1999년 25–54세 **비수감** 인구 중 취업 비율(epop)과 경제활동인구 중 실업 비율. 수감자를 분모에서 빼야 CPS와 같다 — 흑인 남성은 수감자 포함 시 고용률이 몇 %p 더 낮다(crime 모듈과 결합). 히스패닉은 Table 4(https://www.bls.gov/cps/aa1999/aat4.txt). 흑인 여성 고용률은 백인 여성과 같다(격차는 남성에 집중 — Chetty 2020과 같은 방향).',
  },
  {
    id: 'race.unemploymentRatio.blackToWhite.1999',
    kind: 'conditional',
    description: '흑인 실업률 ÷ 백인 실업률 — 25–54세(1999). "흑인 실업률은 백인의 약 2배" 규칙성',
    values: { men: 0.056 / 0.026, women: 0.061 / 0.03, hispanicToWhiteMen: 0.041 / 0.026 },
    unit: 'oddsRatio',
    population: 'CPS 1999 연평균, 25–54세',
    cohortFit: 'close',
    source: `${CPS_1999}, Tables 3–4 (원자료: 백인 남성 실업자 1,183천/경활 44,861천, 흑인 남성 317천/5,662천)`,
    url: 'https://www.bls.gov/cps/aa1999/aat3.txt',
    howToMeasure:
      '단위는 오즈비가 아니라 **실업률의 비(rate ratio)** — enum에 맞는 값이 없어 oddsRatio 칸을 빌렸다. 약 2.0–2.2. 경기 순환 내내 대략 2배가 유지되는 것이 요점: 모델 1980–2010 매년 이 비를 계산해 1.8–2.5 범위인지 본다(호황기 1999는 낮은 쪽).',
  },
  {
    id: 'race.weeksStatus.nlsy79.18to58',
    kind: 'conditional',
    description: '18–58세 동안 주 단위 고용·실업·비경활 비율 — 인종별, 학력별(NLSY79)',
    values: {
      employed_white: 0.795,
      unemployed_white: 0.037,
      employed_black: 0.679,
      unemployed_black: 0.079,
      employed_hispanic: 0.73,
      unemployed_hispanic: 0.052,
      employed_white_lessThanHS: 0.615,
      employed_black_lessThanHS: 0.429,
      employed_hispanic_lessThanHS: 0.576,
      employed_white_hsOnly: 0.777,
      employed_black_hsOnly: 0.632,
      employed_hispanic_hsOnly: 0.719,
      employed_white_someCollege: 0.792,
      employed_black_someCollege: 0.732,
      employed_hispanic_someCollege: 0.792,
      employed_white_baPlus: 0.849,
      employed_black_baPlus: 0.826,
      employed_hispanic_baPlus: 0.842,
      unemployed_black_hsOnly: 0.095,
      unemployed_white_hsOnly: 0.046,
    },
    unit: 'proportion',
    population: 'NLSY79(1957–64년생) 남녀 합, 1978–2022 — White·Black은 비히스패닉',
    cohortFit: 'exact',
    source: `${NLSY79_RELEASE}, Table 3`,
    url: 'https://www.bls.gov/news.release/nlsoy.t03.htm',
    howToMeasure:
      '18–58세 모든 주(week) 중 취업/실업 주의 비율, 인종별·최종학력별(남녀 합 — 인종×성별 교차는 원표에 없음). 모델: 코호트 전원의 18–58세 월 상태를 인종×학력으로 집계(수감 개월은 NLSY처럼 "비경활"로). 핵심 구조 검증: 학사 이상에서는 인종 격차가 거의 사라지고(84.9/82.6/84.2) 고졸 이하에서 크다 — 학력 경로 + 저숙련 시장의 차별·동네·수감으로 설명되어야 한다.',
  },
  {
    id: 'race.weeksStatus.nlsy79.byAge',
    kind: 'conditional',
    description: '나이대별 주 단위 고용·실업 비율 — 인종별(NLSY79)',
    values: {
      employed_white_18to24: 0.708,
      employed_white_25to34: 0.822,
      employed_white_35to44: 0.842,
      employed_white_45to54: 0.812,
      employed_white_55to58: 0.744,
      employed_black_18to24: 0.556,
      employed_black_25to34: 0.711,
      employed_black_35to44: 0.757,
      employed_black_45to54: 0.694,
      employed_black_55to58: 0.613,
      employed_hispanic_18to24: 0.647,
      employed_hispanic_25to34: 0.746,
      employed_hispanic_35to44: 0.789,
      employed_hispanic_45to54: 0.744,
      employed_hispanic_55to58: 0.673,
      unemployed_white_18to24: 0.069,
      unemployed_black_18to24: 0.135,
      unemployed_hispanic_18to24: 0.085,
      unemployed_white_35to44: 0.026,
      unemployed_black_35to44: 0.061,
      unemployed_hispanic_35to44: 0.041,
    },
    unit: 'proportion',
    population: 'NLSY79(1957–64년생) 남녀 합',
    cohortFit: 'exact',
    source: `${NLSY79_RELEASE}, Table 4`,
    url: 'https://www.bls.gov/news.release/nlsoy.t04.htm',
    howToMeasure:
      '나이대별 전체 주 중 취업/실업 주 비율(남녀 합). 흑인 18–24세 실업 13.5%는 백인의 약 2배. 45–58세에 흑인 고용이 다시 벌어지는 것(69.4 vs 81.2)은 건강 제한(흑인 58세 34% vs 백인 21%, 같은 보도자료 Table 9)과 연결 — health 모듈 결합 목표.',
  },
  {
    id: 'race.realWageGrowth.nlsy79.byAge',
    kind: 'conditional',
    description: '실질 시급의 연평균 증가율 — 인종별, 나이대별(NLSY79)',
    values: {
      white_18to24: 0.069,
      white_25to34: 0.034,
      white_35to44: 0.019,
      black_18to24: 0.045,
      black_25to34: 0.029,
      black_35to44: 0.015,
      hispanic_18to24: 0.062,
      hispanic_25to34: 0.028,
      hispanic_35to44: 0.019,
    },
    unit: 'proportion',
    population: 'NLSY79(1957–64년생) 남녀 합, 1978–2022',
    cohortFit: 'exact',
    source: `${NLSY79_RELEASE}, Table 5`,
    url: 'https://www.bls.gov/news.release/nlsoy.t05.htm',
    howToMeasure:
      '같은 사람의 인플레 조정 시급이 나이대 안에서 연평균 몇 % 오르는지(취업 중인 해만). 흑인의 18–24세 증가율이 낮은 것(4.5% vs 6.9%) — 초기 경력의 직업 사다리 접근 차이(인맥·차별·동네 일자리). 45세 이후 값(0.0–1.0%)은 표본 작아 생략.',
  },
  // ---- 세대 간 이동성(Chetty 2020) ----
  {
    id: 'race.mobility.chetty.p25HouseholdRank',
    kind: 'conditional',
    description: '부모 소득 25백분위 가정 자녀의 성인 가구소득 평균 백분위 — 인종별',
    values: { white: 0.45, black: 0.326, hispanic: 0.43 },
    unit: 'proportion',
    population: '1978–83년생 미국 출생 자녀, 2014–15년(31–37세) 가구소득 순위; 부모 소득은 1994–2000년 가구소득 순위',
    cohortFit: 'close',
    source: CHETTY_RACE,
    url: CHETTY_RACE_URL,
    howToMeasure:
      '백분위를 0–1로. 이 자녀들은 **Roy 코호트의 자녀 세대**(부모가 대략 1945–60년생) — kin 모듈이 자녀 결과를 지연 생성할 때의 직접 목표, Roy 자신의 이동성에는 근사. 모델: 자녀의 30대 중반 가구소득을 같은 출생 코호트 안에서 백분위화, 부모 순위 20–30 구간 자녀의 평균을 인종별로. 순위-순위 기울기: 백인 0.32(절편 36.8), 흑인 0.28. 부모 결혼·학력·자산을 통제해도 흑–백 격차가 거의 줄지 않는다(논문 결론 2) — 모델이 부모 자산만으로 격차를 다 만들면 틀린 것.',
  },
  {
    id: 'race.mobility.chetty.quintileTransitions',
    kind: 'conditional',
    description: '가구소득 5분위 이동 — 하위 5분위 → 상위 5분위, 상위 유지, 상위 → 하위',
    values: {
      bottomToTop_white: 0.106,
      bottomToTop_black: 0.025,
      topStayTop_white: 0.411,
      topStayTop_black: 0.18,
      topToBottom_black: 0.167,
    },
    unit: 'proportion',
    population: '1978–83년생 자녀(Chetty et al. 2020 표본 약 2천만 명)',
    cohortFit: 'close',
    source: CHETTY_RACE,
    url: CHETTY_RACE_URL,
    howToMeasure:
      '부모가 하위(상위) 5분위인 자녀 중 성인 가구소득이 상위(하위) 5분위인 비율. 흑인 상위 5분위 가정 자녀가 상위 유지(18%)만큼 하위로 추락(16.7%) — 하향 이동이 핵심. 모델: kin 모듈의 자녀 결과 전이행렬. 전체 행렬은 온라인 Table 2(https://opportunityinsights.org/wp-content/uploads/2018/09/table_2-3.csv)에 있으나 이 에이전트는 열지 못했다.',
  },
  {
    id: 'race.mobility.chetty.menEmploymentGap',
    kind: 'conditional',
    description: '부모 소득이 같을 때 흑인 남성이 한 해 동안 일할 확률의 격차(백인 남성 대비, %p)',
    values: { gapAtParentP25: -0.189, gapAtParentP75: -0.114, individualIncomeRankGapMen: -0.1 },
    unit: 'proportion',
    population: '1978–83년생 남성, 2014–15년',
    cohortFit: 'close',
    source: CHETTY_RACE,
    url: CHETTY_RACE_URL,
    howToMeasure:
      '부모 순위 25(75) 근처 남성 중 해당 연도 W-2 소득이 있는 비율의 흑–백 차이. 개인소득 순위 격차는 부모 소득 전 구간에서 약 10백분위(남성). 흑인 남성은 시급 순위가 약 7백분위 낮고 주당 약 9시간 덜 일한다. 모델: 수감(crime) + 채용 차별 + 동네 인맥 경로로 이 격차가 나와야 한다. 참고로 가장 낮은 소득 가정 출신 흑인 남성의 21%가 어느 날 수감 중(백인 6%) — crime 모듈 목표.',
  },
  {
    id: 'race.mobility.chetty.womenNoGap',
    kind: 'null',
    description: '부모 소득이 같을 때 흑인 여성과 백인 여성의 개인소득 순위는 거의 같다(흑인 여성 약 +1백분위)',
    values: { blackMinusWhiteWomenIndividualRank: 0.01 },
    unit: 'proportion',
    population: '1978–83년생 여성',
    cohortFit: 'close',
    source: CHETTY_RACE,
    url: CHETTY_RACE_URL,
    howToMeasure:
      '부모 순위를 통제한 개인소득 순위의 흑–백 차이(여성). 0 근처여야 한다. 모델이 모든 흑인에게 같은 임금·채용 차별을 적용하면 여성 격차가 생겨 이 null 적률에서 실패한다 — 차별·수감·동네 효과의 성별 차이를 요구하는 제약. 단 가구소득 격차는 여성에서도 있다(결혼 시장 경로).',
  },
  {
    id: 'race.mobility.chetty.meanRanks',
    kind: 'conditional',
    description: '자녀 세대의 인종별 평균 소득 순위, 히스패닉 부모·자녀 평균 순위',
    values: { childMeanRank_white: 0.557, childMeanRank_black: 0.348, parentMeanRank_hispanic: 0.362, childMeanRank_hispanic: 0.457 },
    unit: 'proportion',
    population: '1978–83년생 자녀와 그 부모',
    cohortFit: 'close',
    source: CHETTY_RACE,
    url: CHETTY_RACE_URL,
    howToMeasure:
      '자녀 세대 전체 분포에서 인종별 평균 가구소득 순위. 히스패닉은 부모 36.2 → 자녀 45.7로 수렴(흑인은 수렴 안 함). 흑인·백인 **부모** 평균 순위는 원문에서 확인 못 했다(RACE_STRUCTURE_FACTS.parentIncome 참고).',
  },
  // ---- 자산 ----
  {
    id: 'race.wealth.scfMedian',
    kind: 'conditional',
    description: '가구(family) 순자산 중앙값 — 인종별, 백인 대비 비율과 AWI 배수',
    values: {
      whiteToBlack_1989_cbo: 171300 / 14200,
      whiteToHispanic_1989_cbo: 171300 / 14700,
      whiteToBlack_2019_cbo: 260000 / 40300,
      whiteToBlack_2019_fed: 188200 / 24100,
      whiteToHispanic_2019_fed: 188200 / 36100,
      whiteToBlack_2022_fed: 285000 / 44900,
      whiteToHispanic_2022_fed: 285000 / 61600,
      whiteMedianToAwi_2019: 188200 / AWI_2019,
      blackMedianToAwi_2019: 24100 / AWI_2019,
      hispanicMedianToAwi_2019: 36100 / AWI_2019,
      whiteMedianToAwi_2022: 285000 / AWI_2022,
      blackMedianToAwi_2022: 44900 / AWI_2022,
    },
    unit: 'proportion',
    population: 'SCF 전 연령 가구. 1989는 CBO(2019년 달러, 확정급여 연금 등 포함한 CBO 자산 정의)',
    cohortFit: 'distant',
    source:
      `${FED_SCF_2019} (2019: 백인 $188,200, 흑인 $24,100, 히스패닉 $36,100; 평균 $983,400/$142,500/$165,500); Fed FEDS Notes (2023) Greater Wealth, Greater Uncertainty (2022: $285,000/$44,900/$61,600); CBO (2022) Trends in the Distribution of Family Wealth, 1989 to 2019 (1989: $171,300/$14,200/$14,700)`,
    url: FED_SCF_2019_URL,
    howToMeasure:
      '비율은 무차원. 모든 연령을 합친 횡단면이라 코호트 적합도 낮음 — 모델: 해당 연도 전 연령 가구의 순자산 중앙값 비율. CBO는 자산 정의가 넓어(2019 백인 $260,000) Fed 값과 섞지 말 것: 1989→2019 추세는 CBO끼리(12.1배 → 6.5배), 수준은 Fed끼리. 2022 URL: https://www.federalreserve.gov/econres/notes/feds-notes/greater-wealth-greater-uncertainty-changes-in-racial-inequality-in-the-survey-of-consumer-finances-20231018.html ; CBO: https://www.cbo.gov/system/files/2022-09/57598-family-wealth.pdf . **1957–64년생 가구주 45–55세 인종별 자산은 찾지 못했다**(SCF 2007–2019 연령×인종 교차 필요).',
  },
  {
    id: 'race.wealth.inheritanceAndFamilyHelp.2019',
    kind: 'conditional',
    description: '상속·증여를 받은 적 있는 가구 비율, 받을 것으로 기대하는 비율, 가족에게서 $3,000을 빌릴 수 있는 비율 — 인종별',
    values: {
      everReceived_white: 0.3,
      everReceived_black: 0.1,
      everReceived_hispanic: 0.07,
      everReceived_other: 0.18,
      expectInheritance_white: 0.171,
      expectInheritance_black: 0.06,
      expectInheritance_hispanic: 0.042,
      familyCan3000_white: 0.719,
      familyCan3000_black: 0.409,
      familyCan3000_hispanic: 0.578,
    },
    unit: 'proportion',
    population: 'SCF 2019 전 연령 가구',
    cohortFit: 'distant',
    source: FED_SCF_2019,
    url: FED_SCF_2019_URL,
    howToMeasure:
      '받은 가구의 상속 중앙값은 인종 간 비슷(백인 $88,500, 흑인 $85,800, 히스패닉 $52,200) — 격차는 금액보다 **수혜율**에서. 모델(kin): 가구주 생애 중 상속·증여 수혜 경험 비율을 2019년 전 연령 횡단면으로. 백인 "nearly 30 percent", 흑인 "about 10 percent" 표현이라 허용오차 ±2%p.',
  },
  // ---- 자가 보유(헤드라인만 — 자세한 것은 place) ----
  {
    id: 'race.homeownership.scf2019.byAge',
    kind: 'conditional',
    description: '자가 보유율 — 인종 × 나이(SCF 2019)',
    values: { under35_white: 0.46, under35_black: 0.17, age35to54_white: 0.73, age35to54_black: 0.51 },
    unit: 'proportion',
    population: 'SCF 2019 가구, 가구주 나이 35세 미만 / 35–54세',
    cohortFit: 'distant',
    source: FED_SCF_2019,
    url: FED_SCF_2019_URL,
    howToMeasure:
      '나이대 가구 중 자가 비율. 2019년 35–54세는 1965–84년생이라 Roy 코호트가 아니다 — 격차 크기(약 22%p, 젊은 층 29%p)만 참고. 부모 자산(계약금) 경로의 목표. 원문 표현이 "about 46 percent", "just 17 percent", "about 51 percent"라 허용오차 ±2%p. 2022년 흑인 가구 전체 자가율은 "about 45 percent"(Fed 2023 note).',
  },
  // ---- 자영업 ----
  {
    id: 'race.selfEmployment.2015',
    kind: 'conditional',
    description: '취업자 중 자영업 비율(비법인 + 법인) — 인종별(2015)',
    values: {
      white: 0.069 + 0.04,
      black: 0.036 + 0.016,
      asian: 0.056 + 0.04,
      hispanic: 0.064 + 0.019,
      incorporated_white: 0.04,
      incorporated_black: 0.016,
    },
    unit: 'proportion',
    population: 'CPS 2015 연평균, 취업자 전체(남녀·전 연령)',
    cohortFit: 'distant',
    source: 'BLS Spotlight on Statistics (2016), Self-employment in the United States',
    url: 'https://www.bls.gov/spotlight/2016/self-employment-in-the-united-states/home.htm',
    howToMeasure:
      '2015년 취업자 중 자영업(비법인 백인 6.9%·흑인 3.6%·아시아 5.6%·히스패닉 6.4%; 법인 4.0/1.6/4.0/1.9). 코호트는 51–58세로 자영업률이 평균보다 높은 나이 — 모델: 2015년 전 연령 취업자 횡단면. 흑인 자영업이 백인의 약 절반인 것이 요점(창업 자금 = 부모·본인 자산 경로).',
  },
];

// ---- 구조 경로 입력(모델 파라미터의 근거) ----

/**
 * 구조 사실. 각 항목에 출처·URL. `unverified`가 있는 항목은 2차 자료 경유이거나 요약 도구가 불안정했던 값이다.
 * 비율은 0–1, 지수는 0–100(원문 단위 그대로).
 */
export const RACE_STRUCTURE_FACTS = {
  /**
   * 코호트 인종 구성.
   */
  cohortComposition: {
    /**
     * 1980년 18–24세 미국 거주 인구(1955/56–1962년생 — Roy 코호트의 앞쪽 절반과 겹침), 천 명.
     * White·Black·Asian·AIAN은 비히스패닉. 출처: NCES Digest 2022, Table 101.20
     * (Estimates of resident population, by race/ethnicity and age group: Selected years, 1980 through 2022),
     * https://nces.ed.gov/programs/digest/d22/tables/dt22_101.20.asp
     */
    national1980Age18to24Thousands: { total: 30103, white: 23278, black: 3872, hispanic: 2284, asian: 468, americanIndian: 201 },
    /** 위 값의 비율(other = 아시아 + 원주민). 전국 NPC 인종 추출에 쓴다. 1990년 이후 이민 유입으로 히스패닉·아시아 비중이 커진다. */
    national1980Age18to24Share: { white: 23278 / 30103, black: 3872 / 30103, hispanic: 2284 / 30103, other: (468 + 201) / 30103 },
    /**
     * LA 카운티 전 연령 인종 구성(1980, 1990, 2000). 비히스패닉 기준.
     * 출처: Wikipedia, Demographics of Los Angeles County (센서스 집계 인용), https://en.wikipedia.org/wiki/Demographics_of_Los_Angeles_County
     */
    laCountyAllAges: {
      y1980: { white: 0.5287, hispanic: 0.2763, black: 0.1239, asian: 0.0582 },
      y1990: { white: 0.4083, hispanic: 0.3781, black: 0.1055, asian: 0.1024 },
      y2000: { white: 0.3109, hispanic: 0.4456, black: 0.0947, asian: 0.1181 },
      unverified: '2차 자료(위키백과) — 센서스 원표 미확인. 전 연령이라 18–30세 코호트 구성과 다름(LA 청년층은 히스패닉 비중이 더 높다). LA 카운티 연령×인종 원표(1980 STF, 1990 CP-1-6)를 찾지 못함.',
    },
  },

  /**
   * 부모 소득 분포(자녀 인종별). Chetty et al. (2020) — 1978–83년생 자녀의 부모(대략 1945–60년생 = Roy 코호트와
   * 겹치는 부모 세대). Roy 코호트 자신의 부모(1920–40년대생)에 대한 같은 분포는 없다 — 근사로 쓴다.
   * 출처: Race and Economic Opportunity in the United States, QJE 2020, https://opportunityinsights.org/wp-content/uploads/2018/04/race_paper.pdf
   */
  parentIncome: {
    /** 부모 가구소득 중앙값(2015년 달러). */
    medianParentHouseholdIncome2015Usd: { white: 70640, black: 29200, hispanic: 33060, asian: 53010, americanIndian: 34850 },
    /** 흑인 부모 중앙값 ÷ 백인 부모 중앙값 ≈ 0.41. parentRank의 인종 조건부 분포를 이 비율과 맞춘다. */
    blackToWhiteParentMedianRatio: 29200 / 70640,
    /** 히스패닉 부모 평균 순위(백분위). */
    hispanicParentMeanRank: 36.2,
    /** 표본 인종 구성(인종 정보 있는 자녀). */
    sampleShares: { white: 0.67, black: 0.14, hispanic: 0.13, asian: 0.03, americanIndian: 0.008 },
    /** 순위-순위(가구소득) 기울기·절편. 흑인 절편은 p25 값 32.6에서 역산 가능(≈25.6)하나 원문 미확인. */
    rankRankSlope: { white: 0.32, black: 0.28 },
    whiteIntercept: 36.8,
    /** 지금 이동성이 유지될 때의 정상상태 평균 순위(백분위). */
    steadyStateMeanRank: { white: 54.4, black: 35.2 },
    unverified:
      '흑인·백인 부모 평균 순위와 부모 5분위 분포(Table 2 CSV의 par_q1..q5)는 열지 못했다. 정상상태 백인 54.4는 요약 도구 한 번만 확인.',
  },

  /**
   * 동네·계층을 넘는 격차(Chetty 2020 결론). 모델 설계 제약으로 쓴다.
   */
  chettyNeighborhoodFacts: {
    /** 부모 소득을 통제하면 흑인 소년은 인구조사 트랙의 99%에서 백인 소년보다 성인 소득이 낮다. */
    tractsWhereBlackBoysEarnLess: 0.99,
    /** 격차가 작은 동네(저빈곤·백인 편견 낮음·흑인 아버지 동거율 높음)에서 자라는 흑인 아이 비율 상한. */
    blackChildrenInLowGapAreasMax: 0.05,
    /** 부모 결혼 상태·학력·자산은 부모 소득 조건부 흑–백 격차를 "거의 설명하지 못한다". */
    parentMaritalEducationWealthExplain: 'little',
    /** 최저 소득 가정 출신 남성의 특정일 수감률(2010 센서스): 흑인 21%, 백인 6%. crime 모듈과 공유. */
    incarceratedOnGivenDayLowestIncome: { black: 0.21, white: 0.06 },
    source: 'Chetty, Hendren, Jones & Porter (2020), QJE; abstract https://www.nber.org/papers/w24441',
    url: 'https://opportunityinsights.org/wp-content/uploads/2018/04/race_paper.pdf',
  },

  /**
   * 부모 자산 격차(자산 격차 > 소득 격차). 금액은 그 해 달러(1989는 CBO가 2019년 달러로 환산한 값).
   */
  parentWealth: {
    /** CBO 정의(확정급여 연금 포함 등, Fed 공표치보다 큼). 1989 → 백인/흑인 12.1배. */
    cboMedianFamilyWealth1989In2019Usd: { white: 171300, black: 14200, hispanic: 14700, asianAndOther: 66100 },
    cboMedianFamilyWealth2019: { white: 260000, black: 40300, hispanic: 47600, asianAndOther: 95400 },
    cboSource: 'CBO (2022), Trends in the Distribution of Family Wealth, 1989 to 2019',
    cboUrl: 'https://www.cbo.gov/system/files/2022-09/57598-family-wealth.pdf',
    /** Fed SCF 공표 정의. 중앙값 대비 평균이 훨씬 크다(백인 평균/중앙값 ≈ 5.2). */
    fedMedian2019: { white: 188200, black: 24100, hispanic: 36100 },
    fedMean2019: { white: 983400, black: 142500, hispanic: 165500 },
    fedSource: 'Bhutta et al. (2020), FEDS Notes',
    fedUrl: 'https://www.federalreserve.gov/econres/notes/feds-notes/disparities-in-wealth-by-race-and-ethnicity-in-the-2019-survey-of-consumer-finances-20200928.html',
    /** 상속·증여 수혜 경험(2019): 백인 ~30%, 흑인 ~10%, 히스패닉 7%, 기타 18%. 받은 사람의 중앙값은 비슷. */
    everReceivedInheritance2019: { white: 0.3, black: 0.1, hispanic: 0.07, other: 0.18 },
    conditionalMedianInheritance2019Usd: { white: 88500, black: 85800, hispanic: 52200 },
    /** 모든 1950년 이후 출생 코호트는 같은 나이에서 앞 코호트보다 순자산 중앙값이 낮았다(CBO). */
    cohortNote: 'CBO: "The median wealth of every cohort born since 1950 was less than the preceding cohort\'s median wealth when that cohort was the same age."',
  },

  /**
   * 거주 분리 — 상이 지수(dissimilarity, 0–100): 두 집단이 같은 분포가 되려면 한 집단의 몇 %가 이사해야 하는가(트랙 단위).
   */
  segregation: {
    /**
     * 전국 대도시 평균(소수 집단 인구 가중 — "평균적인 흑인/히스패닉이 사는 대도시의 분리 수준"), 비히스패닉 백인 대비.
     * 출처: Logan & Stults (2011), The Persistence of Segregation in the Metropolis: New Findings from the 2010 Census
     * (US2010 Project), Summary Table, https://s4.ad.brown.edu/Projects/Diversity/Data/Report/report2.pdf
     */
    nationalMetroAverage: {
      blackWhite: { y1980: 72.8, y1990: 67.3, y2000: 63.8, y2010: 59.1 },
      hispanicWhite: { y1980: 50.3, y1990: 50.0, y2000: 50.8, y2010: 48.5 },
    },
    /** 같은 보고서 Table 1·4: Los Angeles-Long Beach-Glendale 대도시 구역. */
    laMetro: {
      blackWhite: { y1980: 81.1, y1990: 73.1, y2000: 67.4, y2010: 65.0 },
      hispanicWhite: { y1980: 57.3, y1990: 61.1, y2000: 63.1, y2010: 63.4 },
    },
    /**
     * LA 카운티(트랙 단위, 1970–2000 센서스, 2010–14 ACS). 출처: Ong et al., UCLA Ziman Center,
     * Race, Ethnicity, and Income Segregation in Los Angeles, Table 1,
     * https://www.anderson.ucla.edu/documents/areas/ctr/ziman/Ziman-Segregation-LA-Ong.pdf
     * 같은 보고서: 소득 분포만으로 시뮬레이션한 상이 지수는 1.2–10.6 — 인종 분리의 극히 일부만 소득으로 설명된다
     * (모델이 "소득 → 동네"만으로 분리를 만들면 부족하다는 제약).
     */
    laCounty: {
      blackWhite: { y1970: 89.7, y1980: 79.3, y1990: 72.4, y2000: 68.9, y2014: 66.4 },
      hispanicWhite: { y1970: 60.9, y1980: 54.5, y1990: 57.3, y2000: 60.6, y2014: 60.1 },
      asianWhite: { y1970: 52.1, y1980: 46.6, y1990: 46.2, y2000: 49.2, y2014: 48.6 },
      incomeOnlySimulatedDissimilarityRange: [1.2, 10.6] as const,
    },
  },

  /**
   * 고빈곤 동네 노출(아동기). PSID 흑·백 부모–자녀 2,430쌍, 지오코딩된 트랙 빈곤율.
   * 출처: Sharkey (2009), Neighborhoods and the Black-White Mobility Gap, Pew Economic Mobility Project,
   * https://www.pew.org/-/media/legacy/uploadedfiles/wwwpewtrustsorg/reports/economic_mobility/pewsharkeyv12pdf.pdf
   */
  childhoodNeighborhoodPoverty: {
    /** 1955–70년생(Roy 코호트 포함) — 동네 빈곤율 ≥20%에서 자란 비율. */
    cohort1955to70_povertyAtLeast20: { black: 0.62, white: 0.04 },
    cohort1955to70_povertyUnder10: { black: 0.09, white: 0.74 },
    cohort1955to70_povertyAtLeast30: { black: 0.29, white: 0 },
    cohort1985to2000_povertyAtLeast20: { black: 0.66, white: 0.06 },
    cohort1985to2000_povertyUnder10: { black: 0.1, white: 0.6 },
    /** 중상위 소득(상위 3개 5분위) 가정 아이 중 고빈곤 동네 비율: 흑인 49%, 백인 1% — 소득만으로 동네를 뽑으면 안 되는 이유. */
    middleIncomeInHighPoverty: { black: 0.49, white: 0.01 },
    /** 동네 빈곤 <10% → 20–30%로 바뀌면 (중상위 가정 아이의) 하향 이동 확률 +52%. */
    downwardMobilityIncreaseLowToMidPoverty: 0.52,
    /** 흑–백 하향 이동 격차 중 동네 빈곤이 설명하는 몫: 1/4 ~ 1/3. */
    shareOfDownwardMobilityGapExplained: [0.25, 0.33] as const,
    unverified: '≥30% 행(흑인 29%, 백인 사실상 0)은 요약 도구 1회 확인. 나머지는 본문 수치.',
  },

  /**
   * 노동시장 차별 — 감사/현장 실험.
   */
  hiringDiscrimination: {
    /**
     * Bertrand & Mullainathan (2004, AER 94(4)) — 보스턴·시카고 신문 구인광고에 가상 이력서(~5,000장, 1,300+ 광고,
     * 영업·사무·고객서비스). 콜백률: 백인 이름 9.65%, 흑인 이름 6.45%(비 1.50, 차 3.20%p).
     * 백인 이름 = 경력 약 8년 추가와 같은 효과. 이력서 질 향상의 이득이 흑인 이름에서 훨씬 작다.
     * URL: https://web.mit.edu/cortiz/www/Diversity/Bertrand%20and%20Mullainathan,%202004.pdf (Table 1)
     */
    bertrandMullainathan2004: {
      callbackWhite: 0.0965,
      callbackBlack: 0.0645,
      ratio: 1.5,
      byCity: { chicago: { white: 0.0806, black: 0.054 }, boston: { white: 0.1163, black: 0.0776 } },
      bySex: { female: { white: 0.0989, black: 0.0663 }, male: { white: 0.0887, black: 0.0583 } },
      experienceEquivalentYears: 8,
    },
    /**
     * Pager (2003), The Mark of a Criminal Record, AJS 108(5) — 밀워키 입문직 대면 감사(짝지은 남성 지원자).
     * 콜백률: 백인 전과 없음 34%, 백인 전과 17%, 흑인 전과 없음 14%, 흑인 전과 5%.
     * 전과 없는 흑인 < 전과 있는 백인. 전과 벌점: 백인 1/2, 흑인 1/3.
     * URL: https://www.irp.wisc.edu/publications/focus/pdfs/foc232i.pdf (IRP Focus 23(2) 요약, Figure 2 수치)
     */
    pager2003: {
      callbackWhiteNoRecord: 0.34,
      callbackWhiteRecord: 0.17,
      callbackBlackNoRecord: 0.14,
      callbackBlackRecord: 0.05,
      unverified: '원 AJS 논문 PDF는 열지 못하고 IRP Focus 요약본(저자 기사)에서 확인.',
    },
    /**
     * Quillian, Pager, Hexel & Midtbøen (2017), Meta-analysis of field experiments shows no change in racial
     * discrimination in hiring over time, PNAS 114(41) — 미국 현장 실험 24개, 지원서 54,000+건, 일자리 25,000+개.
     * 평균: 백인이 흑인보다 콜백 36% 많음(비 1.36), 히스패닉보다 24% 많음(비 1.24). 1989/1990년 이후 흑인 대상 차별은
     * 추세 변화 없음(통계적으로 평평), 히스패닉은 감소 조짐(불확실).
     * URL: https://hbr.org/2017/10/hiring-discrimination-against-black-americans-hasnt-declined-in-25-years (저자들의 HBR 요약)
     */
    quillian2017: {
      callbackRatioWhiteToBlack: 1.36,
      callbackRatioWhiteToHispanic: 1.24,
      trendBlackSince1989: 'flat',
      trendHispanicSince1989: 'possibly declining (inconclusive)',
      nStudies: 24,
      unverified: 'PNAS/PMC 원문은 차단(403·reCAPTCHA) — 저자들의 HBR 기고에서 확인. 신뢰구간·연간 추세 계수는 미확인.',
    },
    /**
     * 모델 사용법: 채용(제안→수락) 단계에서 흑인 지원자의 제안 확률에 1/1.36(≈0.74), 히스패닉에 1/1.24(≈0.81)를
     * 곱하는 것이 "측정된 차별" 경로. 시대에 따라 줄이지 않는다(Quillian: 추세 없음). 전과 벌점은 crime 모듈과 결합:
     * 백인 ×0.5, 흑인 ×0.36(Pager 5/14).
     */
  },

  /**
   * 흑–백 임금 격차 분해(노동시장 진입 전 기술). Carneiro, Heckman & Masterov (2005) Table 1 — NLSY79 1961년 이후
   * 출생자, 1990년 로그 시급. https://docs.iza.org/dp1453.pdf
   */
  wageGapDecomposition: {
    blackMen: { ageOnly: -0.25, withAfqt: -0.06, shareExplainedByAfqt: 1 - 0.06 / 0.25 },
    hispanicMen: { ageOnly: -0.174, withAfqt: -0.035 },
    blackWomen: { ageOnly: -0.172, withAfqt: 0.041 },
    hispanicWomen: { ageOnly: -0.003, withAfqt: 0.154 },
    /** Neal & Johnson (1996) 초록: 청소년기 시험 점수 하나가 젊은 여성의 격차 전부와 남성 격차의 상당 부분을 설명. */
    nealJohnson1996Abstract: 'https://ideas.repec.org/p/nbr/nberwo/5124.html',
    note:
      'AFQT 격차 자체가 가족 배경·학교(동네)·부모 자산의 산물이므로 "차별 없음"이 아니라 "진입 전 경로로 이동"이다. 모델: 청소년기 인지능력을 부모 순위·동네로 만들고, 그 뒤 남는 임금 차별은 로그 -0.06 안팎.',
  },
} as const;
