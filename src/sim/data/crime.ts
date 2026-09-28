import type { CalibrationMoment } from './marriage';

/**
 * 범죄·체포·유죄·수감·재진입 도메인(src/sim/crime)의 보정 목표와 구조 사실.
 *
 * 원칙(REALISM_V2): 인종 격차는 "범행 성향의 인종 계수"가 아니라 구조 — 동네 노출, 단속 강도(특히 마약),
 * 양형·시대 정책(1980–2000년대 대량 수감) — 에서 나와야 한다. 그래서 여기에는 (1) 인종별 "결과" 적률
 * (누적 수감 위험, 체포 유병률, 수감률)과 (2) 인종 차이가 "작아야 하는" 자기 보고 적률(마약 사용, 1979
 * 코호트 체포)과 (3) 단속·양형 구조 사실을 함께 둔다. 모델은 (2)를 재현하면서 (1)을 만들어야 한다.
 *
 * 수집 원칙: 원문(PDF/HTML)에서 가져온 숫자만. 다만 이 파일의 PDF 표 값은 WebFetch 요약 도구로
 * 추출했다(직접 다운로드가 프록시에서 막힘). 같은 값을 다른 질문으로 두 번 확인한 것은 확인으로 두고,
 * 한 번만 보았거나 문맥이 섞였을 가능성이 있으면 `unverified`로 적었다.
 *
 * 단위 약속: 율(per 100,000)은 1인당 값으로 나눠 적었다(예: 1,148.7 → 0.011487). 체포율은 "사건 수 /
 * 인구"라서 한 사람이 여러 번 체포되면 중복된다 — 사람 단위 확률이 아니다(howToMeasure 참고).
 *
 * 인종 표기: UCR(FBI 체포 통계)은 히스패닉을 인종이 아니라 별도 민족으로 다루며, 대부분 연도에 히스패닉이
 * "white"에 섞여 있다. BJS 수감 통계(2000년 이후)는 비히스패닉 white/black과 Hispanic을 나눈다.
 */

const WW_2009 =
  'Western & Wildeman (2009), The Black Family and Mass Incarceration, Annals AAPSS 621:231 — Wildeman & Western (2010), Incarceration in Fragile Families, Future of Children 20(2), Table 1에 재수록';
const WW_2009_URL = 'https://files.eric.ed.gov/fulltext/EJ901827.pdf';
const PW_2004 = 'Pettit & Western (2004), Mass Imprisonment and the Life Course, ASR 69(2):151–169';
const PW_2004_URL = 'https://faculty.washington.edu/matsueda/courses/401D/Readings/Pettit-Western-2004.pdf';
const WP_2010 = 'Western & Pettit (2010), Incarceration & social inequality, Daedalus 139(3):8–19';
const WP_2010_URL = 'https://scholar.harvard.edu/files/brucewestern/files/westernpettit10.pdf';
const BONCZAR = 'Bonczar (2003), Prevalence of Imprisonment in the U.S. Population, 1974–2001, BJS NCJ 197976';
const BONCZAR_URL = 'https://bjs.ojp.gov/content/pub/pdf/piusp01.pdf';
const FBI_AGE = 'FBI UCR (2003), Age-Specific Arrest Rates and Race-Specific Arrest Rates for Selected Offenses, 1993–2001';
const FBI_AGE_URL = 'https://ucr.fbi.gov/additional-ucr-publications/age_race_arrest93-01.pdf';
const PEW_2010 = "Pew Charitable Trusts (2010), Collateral Costs: Incarceration's Effect on Economic Mobility (Western & Pettit 분석, NLSY79)";
const PEW_2010_URL = 'https://www.pew.org/-/media/legacy/uploadedfiles/pcs_assets/2010/collateralcosts1pdf.pdf';

export const CRIME_MOMENTS: readonly CalibrationMoment[] = [
  // ======================================================================
  // 1. 누적 수감 위험 (주 교도소·연방 교도소만 — 구치소(jail) 제외)
  // ======================================================================
  {
    id: 'imprisonmentRisk.by30to34.cohortRaceEducation',
    kind: 'conditional',
    description: '30–34세까지 주·연방 교도소 수감 경험 누적 확률 — 출생 코호트 × 인종 × 학력(비히스패닉 남성)',
    values: {
      // Roy 코호트 (1955–59, 1960–64년생)
      white_dropout_1955_59: 0.08,
      white_highSchool_1955_59: 0.021,
      white_noncollege_1955_59: 0.032,
      white_someCollege_1955_59: 0.006,
      white_all_1955_59: 0.02,
      black_dropout_1955_59: 0.276,
      black_highSchool_1955_59: 0.094,
      black_noncollege_1955_59: 0.147,
      black_someCollege_1955_59: 0.043,
      black_all_1955_59: 0.115,
      white_dropout_1960_64: 0.08,
      white_highSchool_1960_64: 0.025,
      white_noncollege_1960_64: 0.037,
      white_someCollege_1960_64: 0.008,
      white_all_1960_64: 0.022,
      black_dropout_1960_64: 0.416,
      black_highSchool_1960_64: 0.124,
      black_noncollege_1960_64: 0.199,
      black_someCollege_1960_64: 0.055,
      black_all_1960_64: 0.152,
      // 시대 추세 확인용 앞뒤 코호트
      white_all_1945_49: 0.012,
      black_all_1945_49: 0.09,
      black_dropout_1945_49: 0.147,
      white_all_1965_69: 0.028,
      black_all_1965_69: 0.203,
      black_dropout_1965_69: 0.57,
      white_dropout_1965_69: 0.105,
      white_all_1975_79: 0.033,
      black_all_1975_79: 0.207,
      black_dropout_1975_79: 0.69,
      white_dropout_1975_79: 0.153,
    },
    unit: 'proportion',
    population: '미국 비히스패닉 백인·흑인 남성, 1945–79년생, 30–34세 시점(1955–59년생은 1989년, 1960–64년생은 1994년 무렵)',
    cohortFit: 'exact',
    source: WW_2009,
    url: WW_2009_URL,
    howToMeasure:
      '세계의 남성을 출생 5년 코호트 × 인종 × 최종 학력(고교 중퇴 / 고졸·GED / 대학 일부 이상)으로 나눠, 30–34세(끝, 즉 35세 생일 전)까지 한 번이라도 "주 또는 연방 교도소"에 입소한 비율. 구치소(jail) 단기 구금·미결 구금은 세지 않는다. 사망자는 분모에서 빼지 않는 생명표 방식(원 논문은 사망 경쟁 위험을 별도 표로 둠). "noncollege" = 중퇴+고졸 합산. 이 적률이 인종 × 학력 × 시대 상호작용의 핵심 목표다 — 1960–64년생 흑인 중퇴자 41.6% vs 백인 중퇴자 8.0%가 구조(동네·단속·양형)로 재현돼야 한다. 히스패닉은 이 표에 없다(아래 revised 적률 참고).',
  },
  {
    id: 'imprisonmentRisk.by30to34.pettitWestern2004',
    kind: 'conditional',
    description: 'Pettit & Western 원 논문의 30–34세까지 누적 수감 위험 — 1945–49년생(1979년) vs 1965–69년생(1999년)',
    values: {
      white_lessThanHS_1945_49: 0.04,
      white_HS_1945_49: 0.01,
      white_someCollege_1945_49: 0.005,
      white_all_1945_49: 0.014,
      black_lessThanHS_1945_49: 0.171,
      black_HS_1945_49: 0.065,
      black_someCollege_1945_49: 0.059,
      black_all_1945_49: 0.105,
      white_lessThanHS_1965_69: 0.112,
      white_HS_1965_69: 0.036,
      white_someCollege_1965_69: 0.007,
      white_all_1965_69: 0.029,
      black_lessThanHS_1965_69: 0.589,
      black_HS_1965_69: 0.184,
      black_someCollege_1965_69: 0.049,
      black_all_1965_69: 0.205,
    },
    unit: 'proportion',
    population: '비히스패닉 백인·흑인 남성, 1945–49년생 및 1965–69년생',
    cohortFit: 'close',
    source: `${PW_2004}, Table 4`,
    url: PW_2004_URL,
    howToMeasure:
      '위 Western & Wildeman(2009) 표와 같은 개념의 원 추정치. 두 표의 차이(예: 1965–69 흑인 전체 20.5% vs 20.3%, 흑인 중퇴 58.9% vs 57.0%)는 추정 개정 폭 — 허용오차의 참고로 쓴다. 교도소만(구치소 제외).',
  },
  {
    id: 'lifeEvents.1965to69.blackMen',
    kind: 'conditional',
    description: '1965–69년생 흑인 남성(1999년 생존자)의 생애 사건 경험 — 교도소 수감이 학사 학위·군 복무보다 흔하다',
    values: {
      black_all_prison: 0.224,
      black_all_bachelors: 0.125,
      black_all_military: 0.174,
      black_noncollege_prison: 0.319,
      black_noncollege_military: 0.137,
    },
    unit: 'proportion',
    population: '비히스패닉 흑인 남성, 1965–69년생, 1999년 생존자(30–34세)',
    cohortFit: 'close',
    source: `${PW_2004}, Table 6`,
    url: PW_2004_URL,
    howToMeasure:
      '분모가 "1999년 생존자"라서 Table 4의 20.5%(생명표 누적 위험)보다 높다(22.4%). 순위 검증용: 흑인 남성에서 수감 경험 > 군 복무 > 학사. 백인 값은 확인하지 못했다.',
  },
  {
    id: 'imprisonmentRisk.by30to34.revisedWithHispanic',
    kind: 'conditional',
    description: '개정 추정치(히스패닉 포함) — 1945–49년생 vs 1975–79년생, 30–34세까지 누적 수감 위험',
    values: {
      white_all_1945_49: 0.014,
      white_dropout_1945_49: 0.038,
      white_HS_1945_49: 0.015,
      white_college_1945_49: 0.004,
      black_all_1945_49: 0.104,
      black_dropout_1945_49: 0.147,
      black_HS_1945_49: 0.11,
      black_college_1945_49: 0.053,
      hispanic_all_1945_49: 0.028,
      hispanic_dropout_1945_49: 0.041,
      hispanic_HS_1945_49: 0.029,
      hispanic_college_1945_49: 0.011,
      white_all_1975_79: 0.054,
      white_dropout_1975_79: 0.28,
      white_HS_1975_79: 0.062,
      white_college_1975_79: 0.012,
      black_all_1975_79: 0.268,
      black_dropout_1975_79: 0.68,
      black_HS_1975_79: 0.214,
      black_college_1975_79: 0.066,
      hispanic_all_1975_79: 0.122,
      hispanic_dropout_1975_79: 0.196,
      hispanic_HS_1975_79: 0.092,
      hispanic_college_1975_79: 0.034,
    },
    unit: 'proportion',
    population: '미국 남성, 1945–49년생 / 1975–79년생 (Pettit, Sykes & Western 2009 개정 인구 추정)',
    cohortFit: 'distant',
    source: `${WP_2010}, Table 2`,
    url: WP_2010_URL,
    howToMeasure:
      'Roy 코호트 값이 아니라 양 끝 코호트 — 시대 추세와 히스패닉의 위치(백인과 흑인 사이)를 확인하는 용도. 주의: 같은 저자의 2009 표(위)와 1975–79년생 값이 크게 다르다(흑인 전체 26.8% vs 20.7%, 백인 중퇴 28.0% vs 15.3%) — 개정 추정(분모 인구 수정)의 차이. 1975–79 값은 넓은 허용오차로만 쓴다. "college" = 대학 일부 이상.',
  },
  {
    id: 'everImprisoned.2001.byAgeSexRace',
    kind: 'conditional',
    description: '2001년 성인 중 주·연방 교도소 수감 경험자 비율 — 성·인종, 연령(35–44세 = 대략 1957–66년생)',
    values: {
      male_age25to34: 0.06,
      male_age35to44: 0.065,
      whiteMale_age25to34: 0.028,
      whiteMale_age35to44: 0.035,
      blackMale_age25to34: 0.204,
      blackMale_age35to44: 0.22,
      hispanicMale_age25to34: 0.09,
      hispanicMale_age35to44: 0.1,
      whiteMale_allAdults_2001: 0.026,
      blackMale_allAdults_2001: 0.166,
      hispanicMale_allAdults_2001: 0.077,
      whiteMale_allAdults_1974: 0.014,
      blackMale_allAdults_1974: 0.087,
      hispanicMale_allAdults_1974: 0.023,
      allAdults_2001: 0.027,
      allAdults_1974: 0.013,
    },
    unit: 'proportion',
    population: '미국 성인 거주자(18세 이상), 2001년 말(및 1974년), 현재 수감자 + 석방된 생존 전과자',
    cohortFit: 'exact',
    source: `${BONCZAR}, Tables 5 & 7`,
    url: BONCZAR_URL,
    howToMeasure:
      '2001년 말 시점에 살아 있는 사람 중 한 번이라도 주·연방 교도소에 입소한 적이 있는 비율(구치소 제외, 현재 수감자 포함). 35–44세 행이 Roy 코호트(1957–66년생)에 해당 — 세계의 1957–64년생 남성을 2001년에 측정한 값과 비교(흑인 22.0%, 히스패닉 10.0%, 백인 3.5%). 히스패닉은 인종 무관, white/black은 비히스패닉.',
  },
  {
    id: 'lifetimeImprisonmentChance.byBirthYearRates',
    kind: 'conditional',
    description: '평생 주·연방 교도소에 갈 확률 — 해당 연도의 입소율·사망률이 평생 유지된다고 가정(1974, 1991, 2001년 기준)',
    values: {
      all_1974: 0.019,
      male_1974: 0.036,
      female_1974: 0.003,
      whiteMale_1974: 0.022,
      blackMale_1974: 0.134,
      hispanicMale_1974: 0.04,
      all_1991: 0.052,
      male_1991: 0.091,
      female_1991: 0.011,
      whiteMale_1991: 0.044,
      blackMale_1991: 0.294,
      hispanicMale_1991: 0.163,
      all_2001: 0.066,
      male_2001: 0.113,
      female_2001: 0.018,
      whiteMale_2001: 0.059,
      blackMale_2001: 0.322,
      hispanicMale_2001: 0.172,
      whiteFemale_2001: 0.009,
      blackFemale_2001: 0.056,
      hispanicFemale_2001: 0.022,
    },
    unit: 'proportion',
    population: '미국 출생자(가상 코호트) — 1974/1991/2001년의 연령별 첫 입소율·사망률 고정',
    cohortFit: 'distant',
    source: `${BONCZAR}, Table 9`,
    url: BONCZAR_URL,
    howToMeasure:
      '실제 코호트가 아니라 "그 해의 율이 평생 유지되면"이라는 가상 코호트 값. 모델 검증은 세계의 연령별 첫 입소 해저드를 그 해 기준으로 고정해 생명표를 돌려 비교한다. 1962년생 Roy는 1974년 율(청소년기)과 1991년 율(29세) 사이를 산다. 교도소만.',
  },

  // ======================================================================
  // 2. 체포 유병률
  // ======================================================================
  {
    id: 'arrestPrevalence.nlsy79.1980',
    kind: 'marginal',
    description: 'NLSY79 1980년 조사 — 18–23세 중 경찰·법원에 "입건·기소" 된 적이 있는 비율(평생, 경미한 교통 위반 제외)',
    values: { everArrested_age18to23_bothSexes: 0.1, white: 0.1, black: 0.1 },
    unit: 'proportion',
    population: 'NLSY79 1980년 응답자, 18세 이상(18–23세), 군·저소득 백인 추가표본 제외(N=5,837), 남녀 합산',
    cohortFit: 'exact',
    source:
      'Weaver, Papachristos & Zanger-Tishler (2019), The Great Decoupling: The Disconnection Between Criminal Offending and Experience of Arrest Across Two Cohorts, RSF Journal 5(1):89–123',
    url: 'https://www.rsfjournal.org/content/rsfjss/5/1/89.full.pdf',
    howToMeasure:
      '질문: "Not counting minor traffic offenses, have you ever been booked or charged for breaking a law, either by the police or by someone connected with the courts?" (1980년 한 번만 물음). 세계의 1957–62년생 남녀를 1980년에 측정. 같은 문항에서 흑인·백인 모두 10%였다 — 1979 코호트에서는 체포의 인종 격차가 거의 없었다는 점이 중요(1997 코호트와 대비). 남녀 합산이므로 남성만은 더 높다. 이 논문은 같은 코호트의 지난 1년 자기 보고 불법 행위(마약 사용 제외) 52%, 마약 포함 56%도 보고.',
    unverified: '남녀·인종별 세부 표를 직접 보지 못했고 본문 문장으로만 확인 — 성별 분리 값 없음. 허용오차 넓게.',
  },
  {
    id: 'arrestPrevalence.nlsy79.raceGap',
    kind: 'null',
    description: '1979 코호트(1980년, 18–23세)의 평생 체포 경험 — 흑백 차이가 없어야 한다',
    values: { blackMinusWhite: 0 },
    unit: 'proportion',
    population: 'NLSY79 1980년, 18–23세 남녀',
    cohortFit: 'exact',
    source: 'Weaver, Papachristos & Zanger-Tishler (2019), RSF Journal 5(1)',
    url: 'https://www.rsfjournal.org/content/rsfjss/5/1/89.full.pdf',
    howToMeasure:
      '"the share of those over eighteen years of age who reported being arrested was 10 percent for both blacks and whites." 1980년 이전(대량 수감·마약 전쟁 이전)에 모델이 큰 흑백 체포 격차(예: 비 1.3 이상)를 만들면 실패. 1997 코호트에서 격차가 벌어지는 것(아래)은 단속 시대 효과로 나와야 한다.',
    unverified: '본문 문장 기반, 남녀 합산. 성별 분리 시 격차가 있을 수 있음.',
  },
  {
    id: 'arrestPrevalence.nlsy97.by18and23',
    kind: 'conditional',
    description: '18세·23세까지 체포 경험 누적 유병률 — 성 × 인종 (NLSY97, 1980–84년생)',
    values: {
      whiteMale_by18: 0.215,
      blackMale_by18: 0.296,
      hispanicMale_by18: 0.262,
      whiteMale_by23: 0.379,
      blackMale_by23: 0.489,
      hispanicMale_by23: 0.438,
      whiteFemale_by18: 0.12,
      blackFemale_by18: 0.12,
      hispanicFemale_by18: 0.12,
      whiteFemale_by23: 0.15,
      blackFemale_by23: 0.14,
      hispanicFemale_by23: 0.13,
    },
    unit: 'proportion',
    population: 'NLSY97(N=7,335), 1980–84년생, 1997–2008 조사',
    cohortFit: 'distant',
    source: 'Brame, Bushway, Paternoster & Turner (2014), Demographic Patterns of Cumulative Arrest Prevalence by Ages 18 and 23, Crime & Delinquency 60(3):471–486',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4443707',
    howToMeasure:
      '자기 보고 체포(경미한 교통 위반 제외), 결측은 MAR(응답자와 같은 체포율) 가정 추정치. Roy보다 20년 늦은 코호트 — 1990년대 후반 단속 강도에서의 값이므로, 세계에서 1980–84년생(Roy의 자녀 세대 또는 NPC)을 측정하거나 시대 효과 검증에 쓴다. 남성 흑/백 비 1.4(18세), 1.3(23세); 여성은 인종 차이 거의 없음.',
    unverified: '남성 값은 원문 표에서 확인. 여성 값은 요약 도구가 "~12%" 식 근삿값으로만 돌려줌 — 원 표 대조 필요.',
  },
  {
    id: 'arrestPrevalence.nlsy97.overallBounds',
    kind: 'marginal',
    description: '전체(남녀) 18세·23세까지 체포 누적 유병률 — 결측 가정별 하한·상한과 MAR 추정',
    values: { by18_lower: 0.159, by18_upper: 0.268, by23_lower: 0.253, by23_upper: 0.414, by23_MAR: 0.302, christensen1965_by23: 0.22 },
    unit: 'proportion',
    population: 'NLSY97, 8–23세',
    cohortFit: 'distant',
    source: 'Brame, Turner, Paternoster & Bushway (2012), Cumulative Prevalence of Arrest From Ages 8 to 23 in a National Sample, Pediatrics 129(1):21–27',
    url: 'https://www.prisonlegalnews.org/media/publications/pediatrics_journal_cumulative_prevalence_of_arrest_from_ages_8-23_in_a_national_sample_2011.pdf',
    howToMeasure:
      '하한 = 결측자 전원 미체포, 상한 = 결측자 전원 체포. christensen1965_by23(22%)은 1965년 조건이 유지된다고 본 Christensen(1967)의 예측 — 1960년대 기준선으로 Roy 코호트(1980년대 초 청년기)의 체포 유병률 상한·하한 감을 준다.',
  },

  // ======================================================================
  // 3. 나이–범죄 곡선 (UCR 연령별 체포율 — 사건 기준)
  // ======================================================================
  {
    id: 'ageArrestCurve.violent.1993and2001',
    kind: 'conditional',
    description: '연령별 폭력범죄(Index violent) 체포율 — 1993년(정점기)과 2001년',
    values: {
      age15_1993: 0.008286,
      age16_1993: 0.010309,
      age17_1993: 0.011153,
      age18_1993: 0.011487,
      age19_1993: 0.010084,
      age20_1993: 0.009194,
      age21_1993: 0.008766,
      age22_1993: 0.008214,
      age23_1993: 0.007815,
      age24_1993: 0.007361,
      age25to29_1993: 0.006606,
      age30to34_1993: 0.005072,
      age35to39_1993: 0.003613,
      age40to44_1993: 0.002304,
      age45to49_1993: 0.001485,
      age50to54_1993: 0.000973,
      age15_2001: 0.004769,
      age18_2001: 0.007591,
      age21_2001: 0.00711,
      age25to29_2001: 0.004674,
      age30to34_2001: 0.003845,
      age35to39_2001: 0.003339,
      age40to44_2001: 0.002483,
      age45to49_2001: 0.001548,
      age50to54_2001: 0.000897,
    },
    unit: 'annualProbability',
    population: '미국 전체(남녀·전 인종), UCR 보고 기관 기준 추정 연령별 인구 10만 명당 체포 건수 ÷ 100,000',
    cohortFit: 'close',
    source: `${FBI_AGE}`,
    url: FBI_AGE_URL,
    howToMeasure:
      '세계의 연간 폭력범죄 체포 "건수"(한 사람 여러 번 가능) ÷ 해당 연령 인구. 사람 단위 확률 아님. 남녀 합산 — 남성은 대략 4–5배 높다(이 표에는 성별 없음). 1993년 곡선은 18세 정점, 40대 초반까지 1/5로 감소. Roy 코호트는 1993년에 29–36세(25–29, 30–34 칸). 1993→2001 하락은 시대(범죄 감소) 효과.',
  },
  {
    id: 'ageArrestCurve.property.1993',
    kind: 'conditional',
    description: '연령별 재산범죄(Index property) 체포율 — 1993년 (16세 정점, 폭력보다 빠른 감소)',
    values: {
      age15: 0.03948,
      age16: 0.041141,
      age17: 0.03819,
      age18: 0.034746,
      age19: 0.026754,
      age20: 0.021139,
      age21: 0.018373,
      age22: 0.016723,
      age23: 0.015582,
      age24: 0.014761,
      age25to29: 0.013408,
      age30to34: 0.011058,
      age35to39: 0.008293,
      age40to44: 0.005404,
      age45to49: 0.003281,
      age50to54: 0.00215,
    },
    unit: 'annualProbability',
    population: '미국 전체(남녀·전 인종), 1993년',
    cohortFit: 'close',
    source: FBI_AGE,
    url: FBI_AGE_URL,
    howToMeasure:
      '폭력 곡선과 같은 방식(체포 건수/인구). 재산범죄는 16세 정점 후 20세까지 절반으로 — 폭력(18세 정점, 완만)보다 가파르다. 곡선 "모양"(정점 나이, 정점 대비 30–34세 비율 ≈ 0.27)을 우선 맞춘다. 마약 위반 연령표는 추출하지 못했다.',
  },

  // ======================================================================
  // 4. 마약: 자기 보고 사용 vs 체포 (단속 구조의 핵심)
  // ======================================================================
  {
    id: 'drugUse.selfReport.byRace.2010',
    kind: 'conditional',
    description: '지난 1개월 불법 약물 사용률(12세 이상) — 인종·민족별. 차이가 작다',
    values: { black: 0.107, white: 0.091, hispanic: 0.081, asian: 0.035, twoOrMore: 0.125, americanIndian: 0.121 },
    unit: 'proportion',
    population: 'NSDUH 2010, 미국 12세 이상 민간 비시설 인구',
    cohortFit: 'distant',
    source: 'SAMHSA, Results from the 2010 National Survey on Drug Use and Health: Summary of National Findings',
    url: 'https://www.samhsa.gov/data/sites/default/files/NSDUHNationalFindingsResults2010-web/2k10ResultsRev/NSDUHresultsRev2010.htm',
    howToMeasure:
      '세계의 "마약 사용" 상태(지난 30일)의 인종별 비율. 흑/백 비 ≈ 1.18 — 같은 시기 흑/백 마약 체포율 비(≈3–3.6, 아래)보다 훨씬 작아야 한다. 이 차이를 모델은 인종 계수가 아니라 동네 단속 강도·거리 거래(야외 시장) 노출로 만들어야 한다. 2002–2010 인종별 변화는 유의하지 않았다고 명시. 판매(유통) 참여는 이 적률에 없음.',
  },
  {
    id: 'drugArrest.rateByRace.1980to2007',
    kind: 'conditional',
    description: '성인 마약 체포율(인구 대비) — 흑인 vs 백인, 1980·1989(정점)·2007년',
    values: {
      black_1980: 0.00554,
      white_1980: 0.0019,
      black_1989: 0.02009,
      white_1989: 0.00363,
      black_2007: 0.01721,
      white_2007: 0.00476,
      blackToWhiteRatio_min_1980to2007: 2.8,
      blackToWhiteRatio_max_1980to2007: 5.5,
      blackShareOfDrugArrests_1980: 0.27,
      blackShareOfDrugArrests_2007: 0.35,
    },
    unit: 'annualProbability',
    population: '미국 성인, FBI UCR 체포 자료(히스패닉은 대부분 white에 포함)',
    cohortFit: 'exact',
    source: 'Human Rights Watch (2009), Decades of Disparity: Drug Arrests and Race in the United States (FBI UCR 분석)',
    url: 'https://www.hrw.org/report/2009/03/02/decades-disparity/drug-arrests-and-race-united-states',
    howToMeasure:
      '성인 인구 10만 명당 마약 체포 건수 ÷ 100,000(사건 기준). Roy 코호트의 18–45세가 그대로 겹치는 기간. 흑/백 비는 1981년 2.8배(최저), 1988–93년 5.1–5.5배(정점). 흑인 비중은 1989–93년 40–42%가 정점. 자기 보고 사용률 비(≈1.2)와의 간극이 단속 구조 검증 목표. 1999–2007년 마약 체포의 80% 이상이 소지(판매 아님). UCR "white"에 히스패닉이 섞여 있어 세계의 white+hispanic을 합쳐 비교할 것.',
    unverified: '2차 분석(HRW)이 UCR 원자료로 계산 — 원자료 대조 안 함. 1989년 흑인 비중 "40–42%"는 범위로만 보고됨(값 생략).',
  },

  // ======================================================================
  // 5. 수감률(시점 스톡)
  // ======================================================================
  {
    id: 'imprisonmentRate.series.1970to2020',
    kind: 'marginal',
    description: '주·연방 교도소 기결수(1년 초과 형) 수감률 — 전체 거주 인구 대비, 연말',
    values: {
      y1970: 0.00096,
      y1975: 0.00111,
      y1980: 0.00138,
      y1990: 0.00292,
      y2000: 0.00478,
      y2005: 0.00491,
      y2007: 0.00506,
      y2008: 0.00504,
      y2010: 0.005,
      y2015: 0.00459,
      y2019: 0.00419,
      y2020: 0.00358,
    },
    unit: 'proportion',
    population: '미국 전체 거주 인구(전 연령) 대비 주·연방 관할 기결수',
    cohortFit: 'exact',
    source:
      'BJS: Prisoners 1925–81 (1970–80), Prisoners in 2000 (1990, 2000), Prisoners in 2010 App. Table 9 (2005–2010), Prisoners in 2020 Table 5 (2015–2020)',
    url: 'https://bjs.ojp.gov/content/pub/pdf/p2581.pdf ; https://bjs.ojp.gov/content/pub/pdf/p00.pdf ; https://bjs.ojp.gov/content/pub/pdf/p10.pdf ; https://bjs.ojp.gov/content/pub/pdf/p20st.pdf',
    howToMeasure:
      '세계 전체(전 연령) 인구 중 연말에 교도소 수감 중인 비율. 구치소 제외. 1977년에 집계 기준이 수용(custody)에서 관할(jurisdiction)로 바뀜. 1980년은 후속 보고서에서 139로 개정, 1990년은 293/297로도 보고됨(개정) — ±2% 허용. 1970–2007 5배 증가 후 정점(2007–09), 2020 코로나 급감. 세계는 1957–64 코호트만 실체화하므로 전 인구 비교는 세계의 배경 인구 모델로 한다.',
  },
  {
    id: 'imprisonmentRate.2000.maleByAgeRace',
    kind: 'conditional',
    description: '2000년 연령 × 인종별 남성 교도소 수감률(기결수) — Roy 코호트는 35–44세',
    values: {
      male_25to29: 0.0252,
      male_30to34: 0.02355,
      male_35to39: 0.01889,
      male_40to44: 0.01316,
      white_25to29: 0.01108,
      white_30to34: 0.01219,
      white_35to39: 0.00995,
      white_40to44: 0.00697,
      black_25to29: 0.09749,
      black_30to34: 0.0869,
      black_35to39: 0.07511,
      black_40to44: 0.04955,
      hispanic_25to29: 0.0289,
      hispanic_30to34: 0.0274,
      hispanic_35to39: 0.02134,
      hispanic_40to44: 0.02088,
      male_allAges: 0.00904,
      white_allAges: 0.00449,
      black_allAges: 0.03457,
      hispanic_allAges: 0.0122,
    },
    unit: 'proportion',
    population: '미국 남성 거주자, 2000년 연말, 주·연방 기결수(white/black = 비히스패닉)',
    cohortFit: 'exact',
    source: 'BJS (2001), Prisoners in 2000, Table 15',
    url: 'https://bjs.ojp.gov/content/pub/pdf/p00.pdf',
    howToMeasure:
      '2000년 말 세계의 해당 연령·인종 남성 중 교도소 수감 중인 비율(구치소 제외). 본문: "9.7% of black non-Hispanic males age 25 to 29 were in prison in 2000, compared to 2.9% of Hispanic males and about 1.1% of white males." Roy 코호트(36–43세)는 35–39, 40–44 칸 — 흑인 7.5%/5.0%, 백인 1.0%/0.7%. 구치소 포함 총 수감률(prison+jail)은 전체 인구 10만 명당 699(2000), 458(1990)(Table 1).',
  },
  {
    id: 'imprisonmentRate.2010and2020.maleByRace',
    kind: 'conditional',
    description: '2010·2020년 남성 교도소 수감률 — 인종별, 2020년은 연령 × 인종',
    values: {
      male_2010: 0.00943,
      whiteMale_2010: 0.00459,
      blackMale_2010: 0.03074,
      male_2020: 0.00678,
      whiteMale_2020: 0.00332,
      blackMale_2020: 0.0189,
      hispanicMale_2020: 0.00837,
      white_25to29_2020: 0.00576,
      black_25to29_2020: 0.03547,
      hispanic_25to29_2020: 0.01638,
      white_30to34_2020: 0.00747,
      black_30to34_2020: 0.03827,
      hispanic_30to34_2020: 0.01807,
    },
    unit: 'proportion',
    population: '미국 남성 거주자(전 연령), 주·연방 기결수',
    cohortFit: 'close',
    source: 'BJS, Prisoners in 2010 (App. Table 9), Prisoners in 2020 (Tables 5, 11)',
    url: 'https://bjs.ojp.gov/content/pub/pdf/p10.pdf ; https://bjs.ojp.gov/content/pub/pdf/p20st.pdf',
    howToMeasure:
      '대량 수감 이후 감소기의 격차 축소 검증(흑/백 비 2000년 7.7 → 2010년 6.7 → 2020년 5.7). Roy 코호트는 2010년 46–53세, 2020년 56–63세 — 해당 연령 칸은 추출 못 함(전 연령 값만).',
  },
  {
    id: 'prisonOrJail.men20to34.raceEducation.1980and2008',
    kind: 'conditional',
    description: '20–34세 남성 중 교도소 또는 구치소에 있는 비율 — 인종 × 학력, 1980 vs 2008',
    values: {
      white_all_1980: 0.006,
      white_dropout_1980: 0.014,
      white_HS_1980: 0.006,
      white_someCollege_1980: 0.002,
      hispanic_all_1980: 0.008,
      hispanic_dropout_1980: 0.014,
      hispanic_HS_1980: 0.007,
      hispanic_someCollege_1980: 0.003,
      black_all_1980: 0.024,
      black_dropout_1980: 0.104,
      black_HS_1980: 0.023,
      black_someCollege_1980: 0.008,
      white_all_2008: 0.012,
      white_dropout_2008: 0.06,
      white_HS_2008: 0.012,
      white_someCollege_2008: 0.004,
      hispanic_all_2008: 0.016,
      hispanic_dropout_2008: 0.039,
      hispanic_HS_2008: 0.014,
      hispanic_someCollege_2008: 0.005,
      black_all_2008: 0.065,
      black_dropout_2008: 0.37,
      black_HS_2008: 0.105,
      black_someCollege_2008: 0.015,
    },
    unit: 'proportion',
    population: '미국 20–34세 남성(시설 수용 포함), 1980년·2008년 한 시점',
    cohortFit: 'close',
    source: `${WP_2010}, Table 1 (Pettit, Sykes & Western 2009 기술 보고서 기반)`,
    url: WP_2010_URL,
    howToMeasure:
      '1980년 20–34세 = 1946–60년생(Roy 코호트 앞부분 포함, 18세였던 Roy는 제외). 구치소 포함이라 교도소만인 적률보다 높다. 세계의 1980년 20–34세 남성을 측정(1957–60년생만 실체화되므로 나머지는 배경 모델). 2008년 값은 더 젊은 코호트 — 시대 추세 검증.',
  },

  // ======================================================================
  // 6. 처리 과정: 유죄·양형
  // ======================================================================
  {
    id: 'processing.felonyDefendants.2009',
    kind: 'marginal',
    description: '대도시(75개 최대 카운티) 중범죄 피고인의 결과 — 유죄율, 형 종류, 전과',
    values: {
      convictedAny: 0.66,
      convictedFelony: 0.54,
      convictedMisdemeanor: 0.12,
      dismissed: 0.26,
      acquitted: 0.01,
      ofConvicted_prison: 0.36,
      ofConvicted_jail: 0.37,
      ofConvicted_probation: 0.25,
      releasedPretrial: 0.62,
      priorArrest_2009: 0.75,
      priorConviction_2009: 0.6,
      priorFelonyConviction_2009: 0.43,
      priorArrest_1990: 0.68,
      priorConviction_1990: 0.53,
      priorFelonyConviction_1990: 0.36,
    },
    unit: 'proportion',
    population: '2009년 5월 중범죄로 기소된 75개 최대 카운티 피고인(State Court Processing Statistics)',
    cohortFit: 'close',
    source: 'BJS (2013), Felony Defendants in Large Urban Counties, 2009 — Statistical Tables, Tables 7, 9, 10, 12, 21, 24',
    url: 'https://bjs.ojp.gov/content/pub/pdf/fdluc09.pdf',
    howToMeasure:
      '분모는 "중범죄 기소" 피고인(체포 전체가 아님 — 체포 → 기소 단계의 탈락은 별도). 1년 추적 내 결과. LA 카운티가 표본에 포함되는 대도시 기준이므로 Roy의 환경에 가깝다. 1990 대비 전과 비율 상승은 대량 수감기 누적의 결과로 재현돼야 한다.',
  },
  {
    id: 'processing.felonySentences.stateCourts.2006',
    kind: 'conditional',
    description: '주 법원 중범죄 유죄 판결의 형 종류 — 교도소 / 구치소 / 보호관찰, 범죄 유형별(2006)',
    values: {
      all_prison: 0.41,
      all_jail: 0.28,
      all_probation: 0.27,
      violent_prison: 0.54,
      violent_jail: 0.23,
      violent_probation: 0.2,
      property_prison: 0.38,
      property_jail: 0.29,
      property_probation: 0.29,
      drug_prison: 0.38,
      drug_jail: 0.28,
      drug_probation: 0.3,
      drugPossession_prison: 0.33,
      drugPossession_jail: 0.31,
      drugPossession_probation: 0.33,
      drugTrafficking_prison: 0.41,
      drugTrafficking_jail: 0.26,
      drugTrafficking_probation: 0.29,
      murder_prison: 0.93,
      guiltyPlea: 0.94,
    },
    unit: 'proportion',
    population: '2006년 미국 주 법원 중범죄 유죄 판결(전국 표본)',
    cohortFit: 'close',
    source: 'BJS (2009), Felony Sentences in State Courts, 2006 — Statistical Tables, Tables 1.2, 4.1',
    url: 'https://bjs.ojp.gov/content/pub/pdf/fssc06st.pdf',
    howToMeasure:
      '세계의 중범죄 유죄 판결 중 가장 무거운 형이 교도소(1년 이상)/구치소(보통 1년 미만)/보호관찰인 비율. 나머지 4%는 기타. 교도소형 평균 최대 형기 4년 11개월(Table 1.3; 실제 복역은 아래 구조 사실). 1980년대 값은 얻지 못함 — 시대 추세는 prisonAdmissionsPerArrest 적률로.',
  },
  {
    id: 'processing.prisonAdmissionsPerArrest.trend',
    kind: 'directional',
    description: '체포 1건당 교도소 입소 — 1985년 대비 2000년대 크게 증가(마약 소지 3배 이상, 마약 거래 2배 이상)',
    values: { drugTrafficking_1985_perArrest: 0.074, drugTrafficking_ratio2005to1985_atLeast: 2, drugPossession_ratio_atLeast: 3 },
    unit: 'proportion',
    population: '미국 주 교도소 입소(NCRP) ÷ UCR 체포, 1985–2005',
    cohortFit: 'exact',
    source: 'Neal & Rick (2014), The Prison Boom and the Lack of Black Progress after Smith and Welch, NBER WP 20283, Tables 7a–7c, 8',
    url: 'https://www.nber.org/system/files/working_papers/w20283/w20283.pdf',
    howToMeasure:
      '세계의 연도별 (교도소 입소 수 / 같은 유형 체포 수)가 1985→2005에 단조 증가해야 한다(방향·배수 하한만). 범죄율 자체가 아니라 양형 강도 증가가 대량 수감을 만든다 — Roy 코호트는 23–43세에 이 변화를 겪는다. 폭행·자동차 절도도 3배 이상.',
    unverified: '요약 도구 경유. 1985년 거래 74/1,000은 본문 인용, 배수는 "more than doubled / more than tripled" 문구만 — 원 표 값 미확인.',
  },

  // ======================================================================
  // 7. 재범
  // ======================================================================
  {
    id: 'recidivism.3yr.releaseCohorts',
    kind: 'conditional',
    description: '주 교도소 석방자의 3년 내 재체포·재유죄·재수감 — 1983, 1994, 2005년 석방 코호트',
    values: {
      rearrest_1983: 0.625,
      reconvict_1983: 0.468,
      returnPrisonOrJail_1983: 0.414,
      rearrest_1994: 0.675,
      reconvict_1994: 0.469,
      resentencedToPrison_1994: 0.254,
      returnedToPrisonAny_1994: 0.518,
      rearrest_2005: 0.678,
      convictedArrest_2005: 0.452,
      returnedToPrisonAny_2005: 0.497,
    },
    unit: 'proportion',
    population: '1983년 11개 주, 1994년 15개 주, 2005년 30개 주의 주 교도소 석방자',
    cohortFit: 'exact',
    source:
      'BJS: Beck & Shipley (1989) Recidivism of Prisoners Released in 1983 (Table 2); Langan & Levin (2002) Recidivism of Prisoners Released in 1994 (Table 2); Durose, Cooper & Snyder (2014) Recidivism of Prisoners Released in 30 States in 2005',
    url: 'https://bjs.ojp.gov/content/pub/pdf/rpr83.pdf ; https://bjs.ojp.gov/content/pub/pdf/rpr94.pdf ; https://bjs.ojp.gov/content/pub/pdf/rprts05p0510.pdf',
    howToMeasure:
      '석방일부터 3년 안에 한 번 이상 체포(재체포), 그 체포로 유죄(재유죄), 교도소 복귀(새 형 또는 가석방 기술 위반 포함). 1983년 "returned"는 교도소 또는 구치소. 1994년 resentenced = 새 교도소형만, returnedToPrisonAny = 기술 위반 포함. 1983→1994 재체포 비교는 같은 11개 주 기준 62.5 → 67.5. 기술 위반 재수감(가석방 강도)이 1994년에 크게 늘어난 점(새 형 25.4% vs 전체 복귀 51.8%)이 구조 신호.',
  },
  {
    id: 'recidivism.2005cohort.5and9yr',
    kind: 'conditional',
    description: '2005년 석방 코호트의 장기 재체포 — 1·3·5·9년, 인종·나이·범죄 유형별',
    values: {
      rearrest_1y: 0.434,
      rearrest_2y: 0.595,
      rearrest_3y: 0.678,
      rearrest_4y: 0.73,
      rearrest_5y: 0.766,
      rearrest_9y: 0.834,
      convictedArrest_5y: 0.554,
      returnedToPrison_5y: 0.551,
      rearrest5y_white: 0.731,
      rearrest5y_black: 0.808,
      rearrest5y_hispanic: 0.753,
      rearrest5y_age24orYounger: 0.841,
      rearrest5y_age25to39: 0.786,
      rearrest5y_age40plus: 0.692,
      rearrest5y_violent: 0.713,
      rearrest5y_property: 0.821,
      rearrest5y_drug: 0.769,
      rearrest5y_publicOrder: 0.736,
      rearrest9y_white: 0.809,
      rearrest9y_black: 0.869,
      rearrest9y_hispanic: 0.813,
      rearrest9y_age24orYounger: 0.901,
      rearrest9y_age40plus: 0.765,
      arrestedInYear9Only: 0.24,
    },
    unit: 'proportion',
    population: '2005년 30개 주 교도소 석방자(약 40만 명)',
    cohortFit: 'close',
    source:
      'BJS: Durose, Cooper & Snyder (2014), Recidivism of Prisoners Released in 30 States in 2005: Patterns from 2005 to 2010 (Tables 8, 14–16); Alper, Durose & Markman (2018), 2018 Update on Prisoner Recidivism: A 9-Year Follow-up Period (2005–2014)',
    url: 'https://bjs.ojp.gov/content/pub/pdf/rprts05p0510.pdf ; https://bjs.ojp.gov/content/pub/pdf/18upr9yfup0514.pdf',
    howToMeasure:
      '석방 후 누적 재체포 곡선의 모양(1년에 이미 43%, 이후 완만)이 핵심. 9년 보고서는 표본 가중이 달라 3·5년 값이 68.4/77.0으로 약간 다르다(허용오차). 9년간 1인당 평균 5회 체포. 인종 차이(흑 80.8 vs 백 73.1)는 재진입 동네의 단속 강도·고용 차이로 나와야 한다. arrestedInYear9Only = 9년째 해 한 해 동안 체포된 비율. 1983 코호트의 나이별 3년 재체포(18–24세 68.0%, 30–34세 63.4%, 45세+ 40.3%), 1994(18–24세 75.4%, 45세+ 45.3%)도 원문에 있음.',
  },
  {
    id: 'recidivism.3yr.byRace.1983and1994',
    kind: 'conditional',
    description: '3년 재체포 — 인종별(1983, 1994 석방 코호트)',
    values: {
      white_1983: 0.587,
      black_1983: 0.671,
      hispanic_1983: 0.685,
      white_1994: 0.627,
      black_1994: 0.729,
      hispanic_1994: 0.646,
      age18to24_1983: 0.68,
      age30to34_1983: 0.634,
      age40to44_1983: 0.489,
      age45plus_1983: 0.403,
    },
    unit: 'proportion',
    population: '1983년 11개 주, 1994년 15개 주 교도소 석방자',
    cohortFit: 'exact',
    source: 'BJS: Beck & Shipley (1989), Table 7; Langan & Levin (2002), Table 8',
    url: 'https://bjs.ojp.gov/content/pub/pdf/rpr83.pdf ; https://bjs.ojp.gov/content/pub/pdf/rpr94.pdf',
    howToMeasure:
      'white/black은 인종(히스패닉 여부 별도 질문) — hispanic은 인종 무관. Roy 코호트가 첫 석방될 시기(1980–90년대)의 값. 나이에 따른 재체포 감소(나이–범죄 곡선의 재진입판)를 재현해야 한다.',
  },
  {
    id: 'parole.outcomes.1990and1999',
    kind: 'conditional',
    description: '주 가석방 종료의 성공률과 교도소 입소 중 가석방 위반자 비중',
    values: {
      paroleSuccess_1990: 0.446,
      paroleSuccess_1999: 0.419,
      paroleViolatorShareOfAdmissions_1980: 0.17,
      paroleViolatorShareOfAdmissions_1990: 0.288,
      paroleViolatorShareOfAdmissions_1999: 0.348,
    },
    unit: 'proportion',
    population: '미국 주 가석방 종료자 / 주 교도소 입소자',
    cohortFit: 'exact',
    source: 'BJS (2001), Hughes, Wilson & Beck, Trends in State Parole, 1990–2000 (Table 16, Table 19, Figure 4)',
    url: 'https://bjs.ojp.gov/content/pub/pdf/tsp00.pdf',
    howToMeasure:
      '성공 = 가석방 기간을 재수감·도주 없이 마친 종료 비율(1999년 약 43% 재수감, 10% 도주). 입소 중 가석방 위반 비중이 1980 17% → 1999 35%로 오른 것은 감독 강도(기술 위반 적발) 상승 — 재범률이 아니라 제도에서 나와야 한다.',
    unverified: '성공률 표에 첫 석방/재석방/의무 가석방 구분 값이 섞여 요약됨(1999 첫 석방 63.5%, 의무 33.1%) — 전체 값은 본문 인용이지만 원 표 대조 권장.',
  },

  // ======================================================================
  // 8. 결과: 노동시장·결혼
  // ======================================================================
  {
    id: 'consequences.hiringCallback.pager2003',
    kind: 'conditional',
    description: '구직 감사 실험 — 인종 × 범죄 기록별 회신(콜백) 비율',
    values: {
      white_noRecord: 0.34,
      white_record: 0.17,
      black_noRecord: 0.14,
      black_record: 0.05,
      recordPenaltyRatio_white: 0.5,
    },
    unit: 'proportion',
    population: '밀워키 초급 일자리 350곳(2001년 6–12월; 백인 쌍 150곳, 흑인 쌍 200곳), 남성 테스터 쌍',
    cohortFit: 'close',
    source: 'Pager (2003), The Mark of a Criminal Record, American Journal of Sociology 108(5):937–975',
    url: 'https://faculty.washington.edu/matsueda/courses/587/readings/Pager%202003%20Mark.pdf',
    howToMeasure:
      '기록 = 코카인 판매 목적 소지 중범죄 + 18개월 복역. 세계의 채용 단계에서 같은 이력서 조건의 제안(면접 초대) 확률 비를 측정: 기록 효과 백인 ×0.5, 흑인 ×약 0.36; 인종 효과(무기록) ×0.41. 흑인 무기록(14%) < 백인 유기록(17%)이 순위 목표. 경력 모델의 채용 차별 크기와 공유되는 파라미터.',
    unverified: 'black_record 5%는 요약 도구가 "약 3:1 비율"에서 유도했다고 표시 — 원문 그림 값 대조 필요.',
  },
  {
    id: 'consequences.laborMarket.nlsy79',
    kind: 'conditional',
    description: '수감 경험의 노동시장 불이익 — 45세 시점 시급·근로 주수·연소득 (NLSY79)',
    values: {
      hourlyWageReduction: 0.11,
      annualEarningsReduction: 0.4,
      weeksWorkedShare_neverIncarcerated: 0.923,
      weeksWorkedShare_formerlyIncarcerated: 0.75,
      lifetimeEarningsLossTo48_white: 0.52,
      lifetimeEarningsLossTo48_hispanic: 0.41,
      lifetimeEarningsLossTo48_black: 0.44,
      bottomQuintile1986_stayed2006_formerlyIncarcerated: 0.67,
      bottomQuintile1986_reachTopQuintile_formerlyIncarcerated: 0.02,
      bottomQuintile1986_reachTopQuintile_never: 0.15,
    },
    unit: 'proportion',
    population: 'NLSY79 남성(1957–64년생), 45세·48세까지, 1986–2006 소득 이동',
    cohortFit: 'exact',
    source: PEW_2010,
    url: PEW_2010_URL,
    howToMeasure:
      '관측 특성 통제 후 수감 경험자 vs 비경험자의 45세 차이. 근로 주수는 연 48주 → 39주를 52로 나눠 비율로 환산(원문 단위는 주). 연소득 $39,100 → $23,500. 세계의 1957–64년생 남성을 45세에 측정(수감 경험 × 경력 결과). 이는 인과 효과가 아니라 통제된 연관 — 모델은 선택(낮은 자기통제·학력)과 수감의 직접 효과(경력 단절, 낙인)를 합쳐 이 크기를 내야 한다. 1986년 하위 5분위 중 비수감자는 약 1/3만 남았다(원문 "only one-third").',
  },
  {
    id: 'consequences.marriage.imprisonment',
    kind: 'directional',
    description: '수감과 결혼 — 수감 전 기혼자의 이혼 위험은 뚜렷이 증가, 미혼자의 결혼 가능성 감소는 대부분 선택 효과(석방 1년 뒤 사라짐)',
    values: { divorceHazardSign_marriedAtEntry: 1, marriageFormationEffectAfterFirstYear: 0 },
    unit: 'oddsRatio',
    population: '네덜란드 유죄 판결 코호트(장기 추적) — 미국 근거는 Lopoo & Western (2005, NLSY79; 수치 미확인)',
    cohortFit: 'distant',
    source: 'Apel, Blokland, Nieuwbeerta & van Schellen (2010), The Impact of Imprisonment on Marriage and Divorce: A Risk Set Matching Approach, J. Quantitative Criminology 26:269–300',
    url: 'https://link.springer.com/article/10.1007/s10940-009-9087-5',
    howToMeasure:
      '값은 부호 약속: divorceHazardSign=1 → 수감 중·후 이혼 해저드 > 매칭된 비수감 기혼자; marriageFormationEffectAfterFirstYear=0 → 선택을 통제하면 석방 1년 뒤 결혼 해저드 차이 없음(수감 기간 자체는 결혼 시장에서 빠짐 = 기계적 감소). 모델은 "수감 → 결혼 확률 × 계수"가 아니라 부재·낙인·소득 감소로 이 방향을 내야 한다.',
    unverified: '크기(오즈비)를 원문 표에서 확인하지 못함 — 방향만. Lopoo & Western(2005) JMF 초록 접근 실패.',
  },
];

/**
 * 구조 사실 — 모델 파라미터(단속 강도, 양형, 제도 변화 시점)의 근거.
 * 적률이 아니라 입력/사전 정보다. 인종은 여기서도 "제도가 어디에 작동하는가"(동네·약물 형태)로만 들어간다.
 */
export const CRIME_STRUCTURE_FACTS = {
  /** 연방 크랙/분말 코카인 양형. 크랙 사용·거래가 흑인 저소득 도심에 집중된 것이 인종 격차의 구조 경로. */
  crackPowderSentencing: {
    antiDrugAbuseAct1986: {
      year: 1986,
      fiveYearMandatoryMin_grams: { crack: 5, powder: 500 },
      tenYearMandatoryMin_grams: { crack: 50, powder: 5000 },
      ratio: 100,
    },
    fairSentencingAct2010: {
      year: 2010,
      fiveYearMandatoryMin_grams_crack: 28,
      tenYearMandatoryMin_grams_crack: 280,
      ratio: 18,
    },
    blackShareOfFederalCrackOffenders: { fy2010: 0.787, fy2014: 0.834 },
    source: 'U.S. Sentencing Commission (2015), Report to the Congress: Impact of the Fair Sentencing Act of 2010',
    url: 'https://www.ussc.gov/sites/default/files/pdf/news/congressional-testimony-and-reports/drug-topics/201507_RtC_Fair-Sentencing-Act.pdf',
  },

  /** 마약 체포의 성격 — 대부분 소지. 야외 시장·순찰 밀도가 높은 동네에서 적발 확률이 높다는 모델 가정의 근거. */
  drugArrestComposition: {
    possessionShareOfDrugArrests_1999to2007_atLeast: 0.8,
    marijuanaPossessionShareOfDrugArrests_2000to2007: { min: 0.377, max: 0.421 },
    blackToWhiteDrugArrestRatio: { lowest: 2.8, lowestYear: 1981, peakRange: [5.1, 5.5], peakYears: '1988–1993' },
    source: 'Human Rights Watch (2009), Decades of Disparity (UCR 분석)',
    url: 'https://www.hrw.org/report/2009/03/02/decades-disparity/drug-arrests-and-race-united-states',
  },

  /** 1980–2009 체포율의 인종 비 추세(BJS). 약물 소지: 백인 체포율 2배, 흑인 3배 증가 → 2009년 흑/백 3배. */
  arrestRaceRatios_1980to2009: {
    drugPossessionBlackToWhite_2009: 3,
    robberyBlackToWhite_1980: 10,
    robberyBlackToWhite_2009: 8,
    note: '약물 소지 1980→2009: 백인 체포율 2배, 흑인 3배. 강도는 1980년 10배 → 2009년 8배(그림 설명 문장).',
    source: 'BJS (2011), Snyder, Arrest in the United States, 1980–2009',
    url: 'https://bjs.ojp.gov/content/pub/pdf/aus8009.pdf',
  },

  /** 대량 수감의 분해: 범죄율이 아니라 체포당 입소와 복역 기간. */
  prisonGrowthDecomposition_1980to1996: {
    nonDrug_shareFromCommitmentsPerArrest: 0.42,
    nonDrug_shareFromTimeServed: 0.58,
    drug: '마약 범죄 증가는 먼저 체포율 증가, 다음 체포당 입소 증가가 주도',
    finding: '비마약 범죄는 신고 범죄당 체포 변화 없음, 범행률은 순감소; 최근 증가의 지배 요인은 복역 기간',
    source: 'Blumstein & Beck (1999), Population Growth in U.S. Prisons, 1980–1996, Crime and Justice 26:17–61 (NCJRS 초록)',
    url: 'https://ojp.gov/ncjrs/virtual-library/abstracts/population-growth-us-prisons-1980-1996-prisons-p-17-61-1999-michael',
  },

  /** 복역 기간. 1990년대에 늘고, 2016년 기준 유형별. 단위: 년(y)/월(mo). */
  timeServed: {
    firstReleases_meanTotalMonths: { y1990: 28, y1999: 34 },
    firstReleases_meanPrisonOnlyMonths: { y1990: 22, y1999: 29 },
    source1990s: 'BJS (2001), Trends in State Parole, 1990–2000, Table 5',
    url1990s: 'https://bjs.ojp.gov/content/pub/pdf/tsp00.pdf',
    released2016: {
      all: { medianYears: 1.3, meanYears: 2.6, shareOfSentenceServed: 0.455 },
      violent: { medianYears: 2.4, meanYears: 4.7, shareOfSentenceServed: 0.537 },
      murder: { medianYears: 13.4, meanYears: 15.0, shareOfSentenceServed: 0.572 },
      rapeSexualAssault: { medianYears: 4.2, meanYears: 6.2, shareOfSentenceServed: 0.619 },
      robbery: { medianYears: 3.2, meanYears: 4.7, shareOfSentenceServed: 0.577 },
      property: { medianMonths: 13, meanMonths: 21, shareOfSentenceServed: 0.424 },
      burglary: { medianMonths: 17, meanMonths: 26, shareOfSentenceServed: 0.431 },
      drug: { medianMonths: 14, meanMonths: 22, shareOfSentenceServed: 0.406 },
      drugPossession: { medianMonths: 10, meanMonths: 15, shareOfSentenceServed: 0.375 },
      publicOrder: { medianMonths: 13, meanMonths: 20, shareOfSentenceServed: 0.445 },
    },
    source2016: 'BJS (2021), Kaeble, Time Served in State Prison, 2016, Tables 1 & 3',
    url2016: 'https://bjs.ojp.gov/content/pub/pdf/tssp16.pdf',
    meanMaxPrisonSentence2006_months: 59,
    meanMaxPrisonSentence2006_source: 'BJS, Felony Sentences in State Courts, 2006, Table 1.3 ("4 years and 11 months"); violent 평균 96개월',
    meanMaxPrisonSentence2006_url: 'https://bjs.ojp.gov/content/pub/pdf/fssc06st.pdf',
  },

  /** 석방 방식 — 재량 가석방에서 의무 가석방으로(양형 개혁·truth-in-sentencing). */
  releaseMethodShares: {
    y1980: { discretionaryParole: 0.55, mandatoryParole: 0.19, expiration: 0.13 },
    y1990: { discretionaryParole: 0.39, mandatoryParole: 0.29, expiration: 0.13 },
    y1999: { discretionaryParole: 0.24, mandatoryParole: 0.41, expiration: 0.18 },
    source: 'BJS (2001), Trends in State Parole, 1990–2000, Figure 1/Table 3',
    url: 'https://bjs.ojp.gov/content/pub/pdf/tsp00.pdf',
  },

  /** 전체 수감(교도소+구치소) — 구치소가 대략 1/3. */
  totalIncarcerationRatePer100k: {
    y1990: 458,
    y2000: 699,
    note: '전 거주 인구 대비 prison+jail. 같은 해 교도소 기결수만은 292(1990), 478(2000).',
    source: 'BJS (2001), Prisoners in 2000, Table 1',
    url: 'https://bjs.ojp.gov/content/pub/pdf/p00.pdf',
  },

  /** 현재 수감 인구 비율(2008, 18–64세) — Pew. */
  shareIncarcerated2008: {
    whiteMen18to64: 1 / 87,
    hispanicMen18to64: 1 / 36,
    blackMen18to64: 1 / 12,
    blackMen20to34NoHS: 0.371,
    note: 'Pew 원문 "1 in 87 / 1 in 36 / 1 in 12". 20–34세 무고졸 흑인 37.1%는 Western & Pettit(2010) Table 1의 37.0%와 일치. 같은 보고서의 "무고졸 백인 1 in 8"은 Daedalus 표(6.0%)와 맞지 않아 제외.',
    source: PEW_2010,
    url: PEW_2010_URL,
  },

  /** 수감 전 상태 — 입소자는 대체로 일하던 사람이다(고용 → 수감 → 경력 단절 경로). */
  preIncarceration: {
    employedBeforeAdmission_moreThan: 2 / 3,
    primaryEarnerForChildren: { fathers: 0.54, mothers: 0.52 },
    source: PEW_2010,
    url: PEW_2010_URL,
  },

  /** 캘리포니아(Roy의 LA) 맥락. */
  california: {
    prisonPopulationPeak: { year: 2006, count: 173000, growthSince1977: '거의 8배' },
    realignment: { year: 2011, law: 'AB 109 — 저위험 수형자를 카운티(구치소·보호관찰)로 이관' },
    recentRatePer100k: { year: 2025, rate: 294 },
    raceShare2025: { latino: 0.47, black: 0.27, white: 0.19, other: 0.07 },
    source: 'PPIC, California’s Prison Population (fact sheet)',
    url: 'https://www.ppic.org/publication/californias-prison-population/',
    unverified:
      'Three Strikes(1994)·Prop 47(2014)의 수치 효과, LA 카운티 구치소 인구, LAPD 크랙 시대 체포 통계는 확인하지 못함.',
  },

  /** 모델 설계 메모(출처 아님): 이 파일의 적률을 쓰는 방식. */
  modelingNotes: [
    '범행 성향에는 인종 항을 두지 않는다. 인종 격차는 (a) 동네 지수(빈곤 집중·야외 마약 시장·순찰 밀도) → 적발 확률, (b) 약물 형태(크랙 vs 분말) × 양형, (c) 시대별 체포당 입소·복역 기간, (d) 전과 누적 → 가중 양형·가석방 위반 적발로만 생긴다.',
    '검증 쌍: drugUse.selfReport(흑/백 ≈1.2)와 drugArrest.rateByRace(≈3–5.5)를 동시에 맞춰야 한다. arrestPrevalence.nlsy79.raceGap(1980년 차이 없음)도 동시에.',
    '수감 적률은 대부분 교도소(prison)만 — 구치소(jail)·미결 구금을 섞어 세면 과대가 된다. prisonOrJail 적률만 둘 다 센다.',
  ],
} as const;
