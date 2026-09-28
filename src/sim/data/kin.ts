import type { CalibrationMoment } from './marriage';

/**
 * 가족·친족·세대(kin 모듈)의 보정 목표 — 원가족(형제 수, 어린 시절 가족 구조), 부모 생존, 상속·증여,
 * 노부모 돌봄, 세대 간 이동성(자녀의 결과), 손주.
 *
 * 원칙은 다른 data 파일과 같다: 원문(HTML 본문 문장)에서 확인한 숫자만 그대로. PDF 표를 요약 도구로 읽은
 * 값은 `unverified`로 표시했다 — 이번 수집에서도 요약 도구가 Chetty et al.(2014) 5분위 이동 행렬의 칸을
 * 지어낸 것을 실제로 확인했다(행 합 102.6%). 본문 문장으로 확인된 칸만 넣었다.
 *
 * "파생(derived)"이라고 적은 값은 원문 숫자를 이 저장소의 표(lifeTables.ts 등)로 계산한 것이다 —
 * 원문이 직접 준 값이 아니므로 howToMeasure에 계산법을 적었다.
 *
 * 코호트 주의: Roy 코호트(1957–64년생)의 부모는 1920–40년대생, 자녀는 1980–2000년대생이다. 세대 간
 * 이동성(Chetty 2014/2020)의 "아이"는 1978–83년생이라 Roy 세대가 "부모" 쪽이다 — 자녀 프로필 생성의
 * 목표로 쓴다.
 */

const CHETTY_2014 =
  'Chetty, Hendren, Kline & Saez (2014), Where is the Land of Opportunity? The Geography of Intergenerational Mobility in the United States, QJE 129(4) (NBER WP 19843)';
const CHETTY_2014_URL = 'https://www.nber.org/system/files/working_papers/w19843/w19843.pdf';
const CHETTY_2020 =
  'Chetty, Hendren, Jones & Porter (2020), Race and Economic Opportunity in the United States: An Intergenerational Perspective, QJE 135(2) (NBER WP 24441)';
const CHETTY_2020_URL = 'https://www.nber.org/system/files/working_papers/w24441/w24441.pdf';
const FED_SCF2019_RACE =
  'Bhutta, Chang, Dettling & Hsu (2020), Disparities in Wealth by Race and Ethnicity in the 2019 Survey of Consumer Finances, FEDS Notes';
const FED_SCF2019_RACE_URL =
  'https://www.federalreserve.gov/econres/notes/feds-notes/disparities-in-wealth-by-race-and-ethnicity-in-the-2019-survey-of-consumer-finances-20200928.html';
const BLS_ELDERCARE_2324 = 'BLS (2025), Unpaid Eldercare in the United States — 2023–2024 (ATUS), USDL news release';
const BLS_ELDERCARE_2324_URL = 'https://www.bls.gov/news.release/archives/elcare_09252025.htm';

export const KIN_MOMENTS: readonly CalibrationMoment[] = [
  // ---- 원가족: 형제 수 ----
  {
    id: 'sibship.mothersCompletedFertility1980',
    kind: 'conditional',
    description: 'Roy 세대의 어머니 세대(1980년 40–44세 여성, 1936–40년생)의 완결 출산력 — 평균 자녀 수와 분포',
    values: {
      meanChildren: 3.0,
      childless: 0.1,
      oneChild: 0.1,
      twoChildren: 0.25,
      threeChildren: 0.23,
      fourPlus: 0.33,
      meanChildren_black: 4.07,
      meanChildren_hispanic: 3.18,
      meanChildren_white: 2.81,
      meanChildren_bachelorsPlus: 2.2,
    },
    unit: 'proportion',
    population: 'CPS 6월 출산력 부가조사 1980, 40–44세 여성(1936–40년생)',
    cohortFit: 'close',
    source: 'Guzzo & Loo (2023), Number of Children Ever Born to Women Aged 40-44, 1980-2022, NCFMR Family Profile FP-23-29',
    url: 'https://www.bgsu.edu/content/dam/BGSU/college-of-arts-and-sciences/NCFMR/documents/FP/guzzo-loo-number-children-ever-born-women-aged-40-44-1980-2022-fp-23-29.pdf',
    howToMeasure:
      '어머니 기준 분포다 — 아이(Roy) 기준 형제 수는 크기 편향이라 더 크다: 형제 수 기대값 = E[n²]/E[n] − 1(파생 ≈ 3.1–3.3명, KIN_STRUCTURE_FACTS.derivedSiblings). 모델의 부모 세대 여성(1930년대생) 40–44세 시점 출생아 수 분포와 비교. 무자녀 여성은 Roy 같은 "아이"를 만들지 않으므로 형제 수 생성에는 n≥1 분포를 크기 가중해 쓴다. 이 연령대는 1957–64년 출생아 어머니의 가장 젊은 쪽(1920년대생 어머니는 더 많이 낳았다 — 베이비붐 정점).',
    unverified:
      '본문 문장으로 확인: 평균 3.0, 무자녀 10%, 1명 10%, 4명+ 33%, 흑인 4.07, 학사+ 2.20. 2명 25%·3명 23%와 백인 2.81·히스패닉 3.18은 그림/요약 경유 — 원 그림 대조 필요.',
  },
  // ---- 부모 나이 ----
  {
    id: 'parents.motherAgeAtBirth1970',
    kind: 'marginal',
    description: '어머니의 평균 출산 나이(모든 출생)와 첫 출산 평균 나이 — 1970년',
    values: { meanAgeAllBirths: 24.6, meanAgeFirstBirth: 21.4 },
    unit: 'proportion',
    population: '미국 전체 출생(출생증명서), 1970',
    cohortFit: 'close',
    source: 'Mathews & Hamilton (2002), Mean Age of Mother, 1970–2000, NVSR 51(1)',
    url: 'https://www.cdc.gov/nchs/data/nvsr/nvsr51/nvsr51_01.pdf',
    howToMeasure:
      '단위는 "세"(unit 필드는 형식상 proportion). 1970년 출생아의 어머니 나이 평균 — Roy의 동생 세대에 가깝다. 1960년은 원문에 없음; 1960년 연령별 출산율로 만든 "출산율 스케줄 평균 나이"는 26.4세(파생, 인구 구조 미반영이라 실제 평균보다 높게 나온다 — KIN_STRUCTURE_FACTS.asfr1960). 부모 나이는 Roy 생성 때 이 분포에서 뽑고, 1970년 적률로 검증.',
  },
  // ---- 어린 시절 가족 구조 ----
  {
    id: 'childhood.livingArrangements1970_1980',
    kind: 'conditional',
    description: '18세 미만 아동의 거주 형태 — 두 부모(계부모 포함)/엄마만/아빠만/부모 없음, 인종별, 1970·1980',
    values: {
      twoParents_1970_all: 0.85,
      twoParents_1970_white: 0.9,
      twoParents_1970_black: 0.58,
      motherOnly_1970_all: 0.11,
      motherOnly_1970_white: 0.08,
      motherOnly_1970_black: 0.3,
      noParent_1970_black: 0.1,
      twoParents_1980_all: 0.77,
      twoParents_1980_white: 0.83,
      twoParents_1980_black: 0.42,
      twoParents_1980_hispanic: 0.75,
      motherOnly_1980_all: 0.18,
      motherOnly_1980_white: 0.14,
      motherOnly_1980_black: 0.44,
      motherOnly_1980_hispanic: 0.2,
      noParent_1980_black: 0.12,
    },
    unit: 'proportion',
    population: 'CPS 18세 미만 아동(단면), 1970·1980 — 1970년 Roy 코호트는 6–13세',
    cohortFit: 'close',
    source: 'ASPE/HHS, Trends in the Well-Being of America\'s Youth, PF 2.1.A (Census CPS 자료)',
    url: 'https://aspe.hhs.gov/sites/default/files/migrated_legacy_files//133256/pf-2-familystruc.pdf',
    howToMeasure:
      '단면 비율이다(그해의 0–17세 전원). 모델의 1970년 3월, 1980년 3월 시점 0–17세 아동의 거주 부모 수를 센다. "두 부모"는 계부모 포함 — "친부모 둘 다"보다 크다. 1980년 단면에는 Roy 코호트(16–23세)가 일부만 들어간다. NLSY79의 "14세 때 친부모 둘 다와 거주" 비율은 원문 확보 실패(주요 공백).',
  },
  {
    id: 'childhood.childrenInvolvedInDivorce',
    kind: 'marginal',
    description: '해마다 부모의 이혼을 겪는 18세 미만 아동의 비율(1,000명당 → 연간 확률)',
    values: { y1960: 0.0064, y1965: 0.0064, y1970: 0.0087, y1975: 0.0147, y1980: 0.0173, y1984: 0.0172 },
    unit: 'annualProbability',
    population: '미국 18세 미만 아동, 이혼 신고(NCHS)',
    cohortFit: 'exact',
    source: 'NCHS (1989), Children of Divorce, Vital and Health Statistics Series 21 No. 46',
    url: 'https://www.cdc.gov/nchs/data/series/sr_21/sr21_046.pdf',
    howToMeasure:
      '연도별 (그해 부모가 이혼한 아동 수) ÷ (18세 미만 아동 수). 모델: 연도별 0–17세 아동 중 그해 부모 이혼 사건을 겪은 비율. 파생: 이 연간율을 1962년생의 0–17세(1962–79)에 적용하면 18세 전 부모 이혼 누적 ≈ 17%(1957년생 13%, 1964년생 19%) — 반복 이혼과 혼외 출생 후 결별은 빠지므로 "부모와 떨어져 산 경험"보다 작다. 원문의 "기혼 여성에게 태어난 아이의 41%가 16세 전에 부모 결혼 해체"는 더 뒤 코호트 전망치(인용) — 목표로 쓰지 않는다. 인종별 값은 이 자료에 없음.',
  },
  {
    id: 'childhood.parentalSeparationByCohort',
    kind: 'directional',
    description: '청소년기 말까지 부모의 결별을 겪은 비율 — 1950년대생 1/5–1/4, 1960년대생 약 1/3',
    values: { born1950s_low: 0.2, born1950s_high: 0.25, born1960s: 0.33 },
    unit: 'proportion',
    population: '1950·60년대 출생 코호트(Bumpass & Sweet 1989 인용)',
    cohortFit: 'exact',
    source: 'U.S. Congress Joint Economic Committee (2020), The Demise of the Happy Two-Parent Home (Bumpass & Sweet 1989 인용)',
    url: 'https://www.jec.senate.gov/public/index.cfm/republicans/2020/7/the-demise-of-the-happy-two-parent-home',
    howToMeasure:
      '혼외 출생·결별 포함 "친부모 둘과 계속 살지 못한" 비율로 읽는다. 위 NCHS 누적 이혼(≈17%)보다 커야 한다(부등호 검증). 인종 차이는 크다(흑인 아동 대다수가 한부모 경험 — 수치 미확인).',
    unverified: '2차 인용(JEC 보고서가 Bumpass & Sweet 1989를 요약) — 원문 미확인. 방향·대략 크기만.',
  },
  // ---- 부모 생존 ----
  {
    id: 'parents.survivalByChildAge.derived',
    kind: 'marginal',
    description: '1962년생 아이의 어머니·아버지가 아이 나이 30/40/50/60세에 살아 있을 확률(파생)',
    values: {
      mother_at30: 0.92,
      mother_at40: 0.84,
      mother_at50: 0.67,
      mother_at60: 0.41,
      father_at30: 0.83,
      father_at40: 0.68,
      father_at50: 0.46,
      father_at60: 0.2,
    },
    unit: 'proportion',
    population: '1962년생 아이의 부모(어머니 1918–47년생, 아버지 +3세) — 인종·SES 평균',
    cohortFit: 'exact',
    source: 'SSA OCACT Actuarial Study No. 120 코호트 생명표(lifeTables.ts) × NCHS 1960 연령별 출산율(Health, United States 2016 Table 3)',
    url: 'https://www.ssa.gov/oact/NOTES/as120/LifeTables_Tbl_7_1930.html',
    howToMeasure:
      '파생값(derived): 어머니 출산 나이를 1960년 연령별 출산율 스케줄(15–44세, 5세 구간 균등)에서 뽑고, 출산 시점 생존을 조건으로 survivalProbability(1962−나이, female, 나이, 나이+k)를 평균. 아버지는 어머니 나이 +3세로 가정(부부 나이 차 원문 미확인). 인종·학력 사망률 차이가 없는 평균이다 — 흑인·저학력 부모는 더 일찍 사망(아래 SIPP 2021 인종 격차). 모델의 부모 생존 곡선이 이 평균을 인구 전체에서 재현하는지 확인하는 용도.',
    unverified: '원문 직접값이 아닌 파생값. 아버지 +3세 나이 차는 가정. 1918–47년생 사이는 1930·1940 코호트 표 보간.',
  },
  {
    id: 'parents.lossBy2021.sipp',
    kind: 'conditional',
    description: '부모 중 최소 한 명을 잃은 비율 — 나이·인종별(2021)',
    values: {
      lostAtLeastOne_age0to17: 0.043,
      lostAtLeastOne_age18to29: 0.115,
      lostAtLeastOne_age30to39: 0.234,
      lostAtLeastOne_18to29_black: 0.196,
      lostAtLeastOne_18to29_whiteNonHispanic: 0.095,
      lostAtLeastOne_18to29_hispanic: 0.115,
      lostAtLeastOne_allAges: 0.442,
      lostMother_allAges: 0.308,
      lostFather_allAges: 0.398,
      lostBoth_allAges: 0.264,
    },
    unit: 'proportion',
    population: 'SIPP 2021 전 인구 — 30–39세는 1982–91년생(부모가 대략 Roy 세대)',
    cohortFit: 'close',
    source: 'U.S. Census Bureau (2023), Losing Our Parents (America Counts, SIPP 2021)',
    url: 'https://www.census.gov/library/stories/2023/03/losing-our-parents.html',
    howToMeasure:
      '2021년 시점, 해당 나이대 사람 중 친부모 중 1명 이상 사망 비율. Roy 세대가 "부모"가 되는 방향의 검증: 모델에서 Roy 세대 사람의 자녀(1982–91년생)가 2021년에 부모를 잃은 비율. 18–29세 흑인 19.6% vs 비히스패닉 백인 9.5% — 인종 격차는 부모 사망률(건강 모듈)의 구조에서 나와야 한다. "전 연령" 값은 연령 구성 혼합이라 진단용.',
  },
  // ---- 상속·증여 ----
  {
    id: 'inheritance.everReceived.byRace2019',
    kind: 'conditional',
    description: '상속 또는 증여를 받은 적이 있는 가구 비율과 받은 가구의 중앙값, 앞으로 받을 기대, 가족에게 $3,000 빌릴 수 있음 — 인종별',
    values: {
      received_white: 0.299,
      received_black: 0.101,
      received_hispanic: 0.072,
      received_other: 0.178,
      conditionalMedian2019usd_white: 88500,
      conditionalMedian2019usd_black: 85800,
      conditionalMedian2019usd_hispanic: 52200,
      conditionalMedian2019usd_other: 59400,
      expectsInheritance_white: 0.171,
      expectsInheritance_black: 0.06,
      expectsInheritance_hispanic: 0.042,
      could3000FromFamily_white: 0.719,
      could3000FromFamily_black: 0.409,
      could3000FromFamily_hispanic: 0.578,
      parentsCollege_white: 0.344,
      parentsCollege_black: 0.248,
      parentsCollege_hispanic: 0.152,
    },
    unit: 'proportion',
    population: 'SCF 2019 전 가구(가구주 전 연령)',
    cohortFit: 'close',
    source: FED_SCF2019_RACE,
    url: FED_SCF2019_RACE_URL,
    howToMeasure:
      '금액 값은 2019년 달러(unit은 형식상 proportion). 2019년 모델 인구의 모든 가구에서 "지금까지 상속·증여를 받은 적 있음" 비율을 인종별로(모든 나이 혼합 — 모델의 2019년 가구주 연령 구성이 SCF와 맞아야 한다). 인종 격차는 부모 자산·부모 생존·형제 수의 구조에서 나와야 하고, 인종 자체에 상속 확률을 걸지 않는다. 조건부 중앙값은 인종 간 비슷(흑인 $85.8k ≈ 백인 $88.5k) — 격차는 "받느냐"에 있다(방향 검증).',
  },
  {
    id: 'inheritance.everReceived.byAge2007',
    kind: 'conditional',
    description: '상속·증여를 받은 적 있는 가구 비율 — 가구주 나이별·인종별(2007), 평생 약 29%',
    values: {
      age_under35: 0.122,
      age_35to44: 0.164,
      age_45to54: 0.208,
      age_55to64: 0.281,
      age_65to74: 0.277,
      age_75plus: 0.303,
      lifetimeApprox: 0.29,
      white_nonHispanic: 0.256,
      black_nonHispanic: 0.091,
      hispanic: 0.042,
      asianOther: 0.148,
      recipientMean2007usd: 476200,
      recipientMedian2007usd: 89700,
    },
    unit: 'proportion',
    population: 'SCF 2007 전 가구 — 2007년 45–50세 = Roy 코호트',
    cohortFit: 'exact',
    source: 'Wolff & Gittleman (2011), Inheritances and the Distribution of Wealth, BLS Working Paper 445, Table 4',
    url: 'https://www.bls.gov/osmr/research-papers/2011/pdf/ec110030.pdf',
    howToMeasure:
      '2007년 모델 가구의 가구주 나이별 "지금까지 받은 적 있음". 나이 기울기(젊을수록 낮고 55세 이후 ~28–30%)가 핵심 — 부모 사망 시점(부모 생존 적률)과 연결된다. 75세 이상 값(~29%)을 "평생 수혜율"로 쓴 것은 저자 해석. 평균이 중앙값의 5배 — 극단적 우편향(로그정규 이상).',
    unverified: 'PDF 표를 요약 도구로 읽음 — 원표 대조 필요(본문 문장 "about 29 percent ... over their lifetime"만 확인). 인종값은 Fed SCF 2019(29.9/10.1/7.2%)와 대체로 일치.',
  },
  {
    id: 'inheritance.fiveYear.byAgeAndRace',
    kind: 'conditional',
    description: '5년 안에 상속을 받을 확률 — 나이별(56–65세 정점), 인종별, 받은 가구의 중앙값',
    values: {
      age_under26: 0.05,
      age_26to35: 0.045,
      age_36to45: 0.063,
      age_46to55: 0.084,
      age_56to65: 0.112,
      age_66to75: 0.068,
      age_76to85: 0.05,
      white: 0.09,
      black: 0.032,
      hispanic: 0.021,
      conditionalMedian2019usd_all: 183914,
      conditionalMedian2019usd_white: 191864,
      conditionalMedian2019usd_black: 76287,
      conditionalMedian2019usd_hispanic: 128062,
    },
    unit: 'proportion',
    population: 'SCF 2001–2019 가구(PEU), 조사 직전 5년 안의 상속, 조사 연도 간 중앙값',
    cohortFit: 'close',
    source: 'Penn Wharton Budget Model (2021), Inheritances by Age and Income Group; Inheritances by Race',
    url: 'https://budgetmodel.wharton.upenn.edu/issues/2021/7/16/inheritances-by-age-and-income-group',
    howToMeasure:
      '5년 창 확률이다(연간 ≈ 1−(1−p)^(1/5)). 모델: 매 조사 연도에 직전 5년 동안 상속 사건이 있었던 가구 비율을 가구주 나이 구간·인종별로. 인종별 값은 https://budgetmodel.wharton.upenn.edu/issues/2021/12/17/inheritances-by-race. 백인은 흑인보다 2.8배 자주, 조건부 중앙값도 2.5배 — Fed 2019(평생, 중앙값 비슷)와 다른 창·정의라 섞지 말 것.',
  },
  {
    id: 'transfers.concentration',
    kind: 'conditional',
    description: '세대 간 이전(상속·큰 증여)의 집중 — 소득 상위 10%가 약 40%, 자산 상위 10%가 절반 이상, 자산 하위 50%는 8%',
    values: {
      shareToTop10Income: 0.4,
      shareToBottom50Income: 0.2,
      shareToTop10Wealth: 0.5,
      shareToBottom50Wealth: 0.08,
      recipientsWhite: 0.88,
      populationWhite: 0.73,
      recipientsCollege: 0.43,
      populationCollege: 0.3,
      wealthShareFromTransfers_r3pct: 0.26,
      wealthShareFromTransfers_r5pct: 0.51,
    },
    unit: 'proportion',
    population: 'SCF(1995–2016) 이전 수혜 가구 vs 전체',
    cohortFit: 'close',
    source: 'Feiveson & Sabelhaus (2018), How Does Intergenerational Wealth Transmission Affect Wealth Concentration?, FEDS Notes',
    url: 'https://www.federalreserve.gov/econres/notes/feds-notes/how-does-intergenerational-wealth-transmission-affect-wealth-concentration-20180601.html',
    howToMeasure:
      '받은 금액의 몇 %가 받는 가구의 현재 소득/자산 상위 10%·하위 50%에 가는지. 상위 10% 자산 몫은 "more than half"(하한 0.5). 총자산 중 이전 비중은 이자율 가정(3%/5%)에 크게 좌우 — 26–51% 범위로 느슨하게. 건수의 절반은 $5만 미만인데 금액의 5%, $100만 이상 건수 2%가 금액의 40%.',
  },
  {
    id: 'transfers.downPaymentHelp',
    kind: 'conditional',
    description: '주택 계약금에 가족 증여/상속을 쓴 구매자 비율, 부모 자산별 큰 이전(≥$5,000) 수혜',
    values: {
      buyersGiftFromFriendOrRelative2024: 0.25,
      familyHelpPeak2010: 0.36,
      firstTimeUsedInheritance2024: 0.07,
      hrsTransferToNonOwner_parentWealthBottomQuartile: 0.014,
      hrsTransferToNonOwner_parentWealthTopQuartile: 0.18,
      hrsTransferToNonOwner_white: 0.083,
      hrsTransferToNonOwner_black: 0.026,
      hrsTransferToNonOwner_hispanic: 0.019,
    },
    unit: 'proportion',
    population: 'NAR 2024 구매자(첫 구매자 문맥) · HRS 1998–2004 부모의 무주택 성인 자녀',
    cohortFit: 'distant',
    source:
      'NAR (2025), Tackling Home Financing and Down Payment Misconceptions (2024 Profile of Home Buyers and Sellers) · Myers, Painter & Zissimopoulos (2016), The Role of Parental Financial Assistance in the Transition to Homeownership by Young Adults, Fannie Mae',
    url: 'https://www.nar.realtor/news/economists-outlook/tackling-home-financing-and-down-payment-misconceptions',
    howToMeasure:
      'NAR: 그해 구매자 중 계약금에 친구·친척 증여를 쓴 비율(2010 정점 36%), 첫 구매자 중 상속 사용 7%(역대 최고). HRS: 부모가 HRS 응답자인 무주택 자녀가 한 조사 기간(2년) 안에 $5,000 이상 이전을 받을 확률 — 부모 자산 상위 4분위 17–20% vs 하위 1–2%(값은 두 시기 중간). place 모듈의 자가 전환에 부모 자산 경로로. Roy 세대(1980년대 첫 구매)의 직접 값은 확보 실패.',
    unverified:
      'NAR 25%는 본문이 "buyers"라고만 해 첫 구매자 한정인지 불확실. HRS 값(Myers et al.)은 PDF 요약 도구 경유 — 원표 대조 필요, 시기 중간값으로 뭉갬.',
  },
  // ---- 노부모 돌봄 ----
  {
    id: 'caregiving.eldercareProviders2023_24',
    kind: 'conditional',
    description: '무급 노인 돌봄 제공자 비율(최근 3–4개월) — 나이·성별, 부모 돌봄 비중, 하루 시간',
    values: {
      men_45to54: 0.171,
      women_45to54: 0.204,
      men_55to64: 0.202,
      women_55to64: 0.279,
      all_45to54: 0.19,
      all_55to64: 0.24,
      providersCaringForParent_all: 0.47,
      providersCaringForParent_45to54: 0.706,
      providersActiveOnGivenDay: 0.28,
      hoursOnCareDays_women: 4.0,
      hoursOnCareDays_men: 3.8,
    },
    unit: 'proportion',
    population: 'ATUS 2023–24, 15세 이상 민간 비시설 인구 — 55–64세는 1959–69년생(Roy 코호트 포함)',
    cohortFit: 'close',
    source: BLS_ELDERCARE_2324,
    url: BLS_ELDERCARE_2324_URL,
    howToMeasure:
      '"최근 3–4개월 사이 노화 관련 상태가 있는 사람을 돌봄"(가구 밖 포함, 무급). 모델: 해당 연령·성별 인구 중 부모(또는 다른 노인)를 돌보는 상태인 비율. 45–54세 제공자의 71%가 부모를 돌본다(전 연령 47%). 시간은 "돌본 날" 평균(시간 단위) — 매일 하는 게 아니다(제공자의 28%만 특정일에 돌봄). 성별 차이는 55–64세에서 크다(28% vs 20%) — 딸·근거리 우선 규칙으로 재현. 표 값: https://www.bls.gov/news.release/elcare.t01.htm',
  },
  {
    id: 'caregiving.laborSupplyEffect',
    kind: 'conditional',
    description: '돌봄이 일에 미치는 효과 — 신체 돌봄 남성 취업 −2.4%p, 계속 일하는 여성은 주 3–10시간 감소·임금 −3%',
    values: {
      men_personalCare_employmentPp: -0.024,
      women_working_hoursPerWeekLow: -3,
      women_working_hoursPerWeekHigh: -10,
      women_wageEffect: -0.03,
    },
    unit: 'proportion',
    population: 'HRS 성인 자녀(개인 고정효과 패널)',
    cohortFit: 'close',
    source: 'Van Houtven, Coe & Skira (2013), The effect of informal care on work and wages, Journal of Health Economics 32(1):240–252',
    url: 'https://ideas.repec.org/a/eee/jhecon/v32y2013i1p240-252.html',
    howToMeasure:
      '초록 문장 그대로. 남성: 개인 돌봄 제공 시 취업 확률 −2.4%p(일하는 남성의 시간·임금 효과는 거의 없음 — null). 여성: 집안일 돌봄 제공자는 은퇴 가능성 ↑, 계속 일하면 주당 3–10시간 감소, 임금 3% 낮음. Johnson & Lo Sasso(2006, HRS 55–67세 여성)도 "부모에게 준 시간이 중년 여성 노동 공급을 강하게 줄인다"(방향만 확인, https://www.urban.org/research/publication/impact-elder-care-womens-labor-supply). 모델에 배수로 걸지 말고 시간 예산 경로로 재현되는지 검증.',
  },
  // ---- 세대 간 이동성(자녀 결과) ----
  {
    id: 'mobility.rankRank.national',
    kind: 'marginal',
    description: '부모 소득 순위 → 자녀 소득 순위 기울기 0.341, 소득 탄력성 0.344, 최하위 5분위 → 최상위 5분위 7.5%',
    values: { rankRankSlope: 0.341, ige: 0.344, pQ5givenQ1: 0.075 },
    unit: 'correlation',
    population: '1980–82년생 아이(세금 기록), 부모 소득 1996–2000년 가구소득(아이 15–20세), 아이 소득 2011–12년(≈30세) 가구소득',
    cohortFit: 'close',
    source: CHETTY_2014,
    url: CHETTY_2014_URL,
    howToMeasure:
      '자녀는 Roy 세대가 낳은 아이들(부모 = 1950–60년대생)이다. 모델: 1980–82년생 자녀의 부모 가구소득 순위(자녀 15–20세 평균)와 자녀 가구소득 순위(29–32세)의 OLS 기울기. 순위는 같은 출생 코호트 안의 백분위. IGE는 소득 0 제외, 명세에 따라 0.26–0.70으로 불안정 — 보정은 순위 기울기로. 5분위 행렬의 다른 칸은 KIN_STRUCTURE_FACTS 참고.',
  },
  {
    id: 'mobility.quintilePersistence',
    kind: 'marginal',
    description: '5분위 대물림 — 하위 5분위에 남음 33.7%, 상위 5분위에 남음 36.5%',
    values: { pQ1givenQ1: 0.337, pQ5givenQ5: 0.365 },
    unit: 'proportion',
    population: '1980–82년생(Chetty et al. 2014 Table II/III)',
    cohortFit: 'close',
    source: CHETTY_2014,
    url: 'https://www.aeaweb.org/conference/2014/retrieve.php?pdfid=1273',
    howToMeasure: '부모 5분위별 자녀 5분위 조건부 확률. 위 rankRank와 같은 표본·정의.',
    unverified: 'PDF 표를 요약 도구로 읽음(같은 도구가 다른 버전에서 행렬 칸을 지어냄) — 원표 대조 필요.',
  },
  {
    id: 'mobility.byRace.p25',
    kind: 'conditional',
    description: '부모 소득 25백분위에서 자란 아이의 평균 가구소득 순위와 순위 기울기 — 인종별',
    values: {
      meanRankAtP25_white: 45,
      meanRankAtP25_black: 32.6,
      meanRankAtP25_hispanic: 43,
      meanRankAtP25_asian: 51,
      slope_white: 0.32,
      slope_black: 0.28,
      slope_asian: 0.18,
    },
    unit: 'proportion',
    population: '1978–83년생 아이, 소득 2014–15년(31–37세)',
    cohortFit: 'close',
    source: CHETTY_2020,
    url: CHETTY_2020_URL,
    howToMeasure:
      '순위 단위(0–100 백분위). 인종별 부모 순위 → 자녀 가구소득 순위 회귀의 p=25 적합값과 기울기. 핵심: 같은 부모 소득에서도 흑인 아이가 12–13 백분위 낮다 — 이 격차는 부모 소득이 아니라 구조(동네·차별·수감 등)에서 나와야 하고, 모델이 부모 소득만으로 인종 격차를 만들면 이 적률이 실패한다. 아시아계 값은 부모 소득 최하위 기준 문장("lowest-income parents")이라 p25와 다를 수 있음.',
  },
  {
    id: 'mobility.byRace.quintiles',
    kind: 'conditional',
    description: '하위 5분위 → 상위 5분위, 상위 5분위 유지 — 백인 vs 흑인',
    values: { pQ5givenQ1_white: 0.106, pQ5givenQ1_black: 0.025, pQ5givenQ5_white: 0.411, pQ5givenQ5_black: 0.18 },
    unit: 'proportion',
    population: '1978–83년생 아이, 가구소득 2014–15년',
    cohortFit: 'close',
    source: CHETTY_2020,
    url: CHETTY_2020_URL,
    howToMeasure: '부모 5분위(전국 분포)별 자녀 5분위 확률, 인종별. 흑인 상위 가정 아이의 하강이 크다(상위 유지 18% vs 41%).',
  },
  {
    id: 'mobility.byRaceGender',
    kind: 'directional',
    description: '성별 차이 — 흑인 남성은 같은 부모 소득의 백인 남성보다 개인소득 순위가 약 10백분위 낮고, 흑인 여성은 백인 여성보다 약 1백분위 높다',
    values: { blackWhiteGap_men_individualIncome: -10, blackWhiteGap_women_individualIncome: 1 },
    unit: 'proportion',
    population: '1978–83년생, 개인소득 순위',
    cohortFit: 'close',
    source: CHETTY_2020,
    url: CHETTY_2020_URL,
    howToMeasure:
      '부모 소득을 조건으로 한 흑백 개인소득 순위 차이(백분위). 남성 격차는 부모 소득 전 구간에서 비슷하게 ~10. 여성은 격차가 거의 없고 임금률·근로시간 차이도 거의 없다 — 모델이 여성에게도 남성만큼 격차를 만들면 실패(구조가 남성 쪽 경로: 수감·고용 차별이어야 함).',
  },
  {
    id: 'mobility.collegeAndTeenBirthGradient',
    kind: 'conditional',
    description: '부모 소득 순위 10백분위 상승당 대학 진학 +6.7%p, 여성 10대 출산 −3%p',
    values: { collegePerParentPercentile: 0.0067, teenBirthPerParentPercentile_women: -0.003 },
    unit: 'proportion',
    population: '1980–82년생(세금 기록)',
    cohortFit: 'close',
    source: CHETTY_2014,
    url: CHETTY_2014_URL,
    howToMeasure: '자녀의 대학 진학 여부(0/1)를 부모 소득 순위(0–100)에 회귀한 기울기. 10대 출산은 여성 자녀가 13–19세에 출산.',
  },
  {
    id: 'mobility.educationByParentEducation',
    kind: 'conditional',
    description: '부모 학력별 자녀의 대학 진학과 학사 취득 — 2002년 고1(1986년 전후생), 10년 추적',
    values: {
      enrolled_parentsNoCollege: 0.72,
      enrolled_parentsSomeCollege: 0.84,
      enrolled_parentsBachelors: 0.93,
      bachelorsAmongEnrollees_firstGen: 0.2,
      bachelorsAmongEnrollees_continuingGen: 0.42,
      bachelorsWithin8y_lowSES: 0.14,
      bachelorsWithin8y_middleSES: 0.29,
      bachelorsWithin8y_highSES: 0.6,
      bachelors_firstGen_1992seniors: 0.24,
      bachelors_parentBA_1992seniors: 0.68,
    },
    unit: 'proportion',
    population: 'ELS:2002 고1(2012년까지) · NELS 1992 고3(Chen 2005 인용)',
    cohortFit: 'close',
    source: 'NCES (2018), First-Generation Students: College Access, Persistence, and Postbachelor\'s Outcomes (NCES 2018-421); NCES 2018-009; Condition of Education, Postsecondary Attainment by SES',
    url: 'https://nces.ed.gov/pubs2018/2018421.pdf',
    howToMeasure:
      '자녀 = Roy 세대의 아이들. 진학률 분모는 전체 고1, 학사 20% vs 42%의 분모는 "진학자"만(1세대 = 부모 모두 대학 경험 없음, 계속 세대 = 부모 중 1명 이상 대학 경험) — https://nces.ed.gov/pubs2018/2018009.pdf. 파생: 부모 무대학 자녀의 무조건 학사율 ≈ 0.72 × 0.20 ≈ 14%. SES 5분위 값(https://nces.ed.gov/programs/coe/pdf/coe_tva.pdf)은 SES가 부모 학력·직업·소득 합성지수. 1992 고3 값은 Chen(2005) 인용(부모 학사 이상 vs 1세대).',
  },
  {
    id: 'siblings.earningsCorrelation',
    kind: 'marginal',
    description: '형제 간 상관 — 소득·임금·가구소득·근로시간·학력·AFQT',
    values: {
      brothers_earnings: 0.49,
      brothers_familyIncome: 0.47,
      brothers_wages: 0.54,
      brothers_hours: 0.39,
      sisters_earnings: 0.34,
      sisters_familyIncome: 0.45,
      sisters_wages: 0.36,
      sisters_hours: 0.15,
      schooling: 0.6,
      afqt: 0.62,
    },
    unit: 'correlation',
    population: 'NLSY79(1957–64년생) 형제·자매 4,000쌍 이상, 여러 해 평균(영구 소득)',
    cohortFit: 'exact',
    source: 'Mazumder (2004), What Similarities between Siblings Tell Us about Inequality in the U.S., Chicago Fed Letter No. 209',
    url: 'https://www.chicagofed.org/publications/chicago-fed-letter/2004/december-209',
    howToMeasure:
      '같은 가족에서 난 형제 쌍의 다년 평균 소득(로그) 상관 = 가족·동네 공통 요인이 설명하는 분산 비율. 모델: 형제를 실체화할 때 공통 가족 효과의 분산 몫으로 보정 — 부모 순위 효과만으로는 부족(순위 기울기² ≈ 0.12보다 훨씬 큼). 원문 그림 라벨 값.',
  },
  // ---- 손주 ----
  {
    id: 'grandparents.coresidence2012',
    kind: 'conditional',
    description: '30세 이상 중 손주와 함께 사는 비율, 함께 사는 조부모 중 손주를 책임지는 비율 — 인종별',
    values: {
      livesWithGrandchild_all30plus: 0.04,
      livesWithGrandchild_whiteNonHispanic: 0.03,
      livesWithGrandchild_black: 0.06,
      livesWithGrandchild_asian: 0.06,
      livesWithGrandchild_hispanic: 0.07,
      livesWithGrandchild_aian: 0.08,
      responsibleAmongCoresident_all: 0.39,
      responsibleAmongCoresident_black: 0.48,
      responsibleAmongCoresident_hispanic: 0.31,
      responsibleAmongCoresident_asian: 0.15,
      responsibleAmongCoresident_aian: 0.54,
      grandparentsLivingWithGrandchild: 0.1,
    },
    unit: 'proportion',
    population: 'ACS 2012, 30세 이상 — Roy 코호트는 48–55세',
    cohortFit: 'close',
    source: 'Ellis & Simmons (2014), Coresident Grandparents and Their Grandchildren: 2012, Census P20-576; Census press release CB14-194',
    url: 'https://www.census.gov/content/dam/Census/library/publications/2014/demo/p20-576.pdf',
    howToMeasure:
      '"책임" = 함께 사는 18세 미만 손주의 기본 필요를 주로 책임짐(grandparent caregiver). grandparentsLivingWithGrandchild(10%)는 분모가 "조부모"(보도자료 https://www.census.gov/newsroom/archives/2014-pr/cb14-194.html), 나머지 거주율은 분모가 30세 이상 전원. 비히스패닉 백인의 책임 비율은 본문에서 확인 못 함. 인종 차이는 가족 구조·주거비·부모(중간 세대) 수감/사망에서 나와야 한다.',
    unverified: '인종별 값은 PDF 본문 문장을 요약 도구로 인용 — 문장은 두 번 대조했으나 원문 직접 확인 권장.',
  },
];

/**
 * 구조 사실(모델 입력·생성 분포) — 적률이 아니라 원가족을 만들 때 쓰는 분포와 파생값.
 */
export const KIN_STRUCTURE_FACTS = {
  /**
   * 1960년 연령별 출산율(여성 1,000명당). 출처: NCHS, Health, United States 2016, Table 3
   * (https://www.cdc.gov/nchs/data/hus/2016/003.pdf). "white"/"black"은 아이의 인종 기준.
   * Roy(1962년생)의 어머니 나이 분포를 만드는 스케줄 — 인구 구조를 곱하지 않은 스케줄 자체의 평균은 26.4세
   * (파생; 비중 15–19 12%, 20–24 35%, 25–29 27%, 30–34 15%, 35–39 8%, 40–44 2%).
   */
  asfr1960: {
    all: { a15to19: 89.1, a20to24: 258.1, a25to29: 197.4, a30to34: 112.7, a35to39: 56.2, a40to44: 15.5, a15to17: 43.9, a18to19: 166.7 },
    white: { a15to19: 79.4, a20to24: 252.8, a25to29: 194.9, a30to34: 109.6, a35to39: 54.0, a40to44: 14.7 },
    /** 흑인 1960년은 15–19세(156.1)와 일반출산율(153.5)만 있음. */
    black: { a15to19: 156.1, generalFertilityRate: 153.5 },
    all_generalFertilityRate: 118.0,
    derivedScheduleMeanAge: 26.4,
  },
  /** 1970년 흑인 연령별 출산율 — 1960년 흑인 연령별 값이 없어 스케줄 모양 참고용(같은 출처). */
  asfr1970_black: { a15to19: 140.7, a20to24: 202.7, a25to29: 136.3, a30to34: 79.6, a35to39: 41.9, a40to44: 12.5 },
  /**
   * 파생: 아이 기준 형제 수. 1980년 40–44세 여성의 자녀 수 분포(sibship.mothersCompletedFertility1980)에서
   * E[n²]/E[n] − 1. 4명+ 구간 평균은 전체 평균 3.0에서 역산한 5.18, 구간 분산 1–3 가정 → 3.1–3.3명.
   * 외동 비율(아이 기준) ≈ 0.10 × 1 / 3.0 ≈ 3%. 인종별(흑인 어머니 평균 4.07)은 같은 식으로 더 크다.
   * NLSY79 응답자의 실제 형제 수 평균은 원문 확보 실패 — 목표가 아니라 생성 분포의 근거.
   */
  derivedSiblings: { meanSiblingsChildView: [3.1, 3.3] as const, onlyChildShareChildView: 0.03 },
  /**
   * 파생: 1962년생 아이의 부모 생존(출산 시점 생존 조건). lifeTables.ts(SSA AS120 코호트 생명표) × asfr1960.
   * 아버지는 어머니 +3세 가정(미확인). 대표 사례: 1935년생 어머니(27세 출산) 30/40/50/60 → 0.93/0.84/0.67/0.36,
   * 1932년생 아버지(30세) → 0.83/0.67/0.43/0.13.
   */
  derivedParentSurvival1962: {
    mother: { at30: 0.92, at40: 0.84, at50: 0.67, at60: 0.41 },
    father: { at30: 0.83, at40: 0.68, at50: 0.46, at60: 0.2 },
  },
  /**
   * 파생: 부모 이혼 누적(18세 전) — NCHS 아동 1,000명당 이혼 연간율을 연도 선형보간해 곱함.
   * 1957년생 0.13, 1962년생 0.17, 1964년생 0.19. 출처 적률: childhood.childrenInvolvedInDivorce.
   */
  derivedParentalDivorceBy18: { born1957: 0.13, born1962: 0.17, born1964: 0.19 },
  /**
   * Chetty et al. (2014) 5분위 이동 행렬 중 확인된 칸. 1행(Q1): Q1 0.337(요약 경유), Q5 0.075(본문).
   * 5행(Q5): Q5 0.365(요약 경유). 나머지 칸은 확보 실패 — 요약 도구가 지어낸 값이 있어 넣지 않았다.
   * 비교: 덴마크 Q1→Q5 11.7%, 캐나다 13.4%(본문). 도시별 Q1→Q5: 샬럿 4.4%, 산호세 12.9%(본문) — LA는 미확인.
   */
  quintileMatrixKnownCells: { q1q1: 0.337, q1q5: 0.075, q5q5: 0.365 },
  /** 흑인 남성 수감: 최저소득 가정에서 자란 흑인 남성의 21%가 특정일(2010 센서스)에 수감, 백인 6% (Chetty et al. 2020 본문). crime 모듈과 공유. */
  incarceratedOnGivenDay_lowestIncomeFamilies: { blackMen: 0.21, whiteMen: 0.06 },
} as const;
