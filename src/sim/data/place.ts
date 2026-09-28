import type { CalibrationMoment } from './marriage';

/**
 * place 모듈(이사·동네·자가 보유·관계망)의 보정 목표와 구조 사실.
 *
 * 원칙은 다른 data 파일과 같다: 원문(또는 원문 PDF/HTML)에서 확인한 숫자만. 요약 도구가 읽을 때마다 다른 값을
 * 돌려준 표(Logan & Stults 전국 평균 등)는 `unverified`로 두거나 뺐다.
 * 중복 금지: 관계망 크기(network.size), 던바 층(network.dunbarLayers), 부부가 만난 경로(couples.howMet)는
 * social.ts에, 코호트 연령대별 자가 보유율·주거비 시계열은 housing.ts에 있다 — 여기서는 인종·학력·혼인
 * 조건부 값과 LA 겹쳐 놓기로 확장한다.
 *
 * 접근 제약(2026-09 수집 시): www2.census.gov의 CPS 역사 표(hst_mig_a_*.xlsx)는 robots로 막혀
 * 연도별 P20 보고서 본문에서 값을 뽑았다. 1985–91년 P20 PDF는 스캔본이라 읽지 못했다.
 */

const P20_538 = 'Census P20-538 (Schachter 2001), Geographical Mobility: March 1999 to March 2000';
const P20_538_URL = 'https://cps.ipums.org/cps/resources/cpr/p20-538.pdf';
const P20_497 = 'Census P20-497 (Hansen 1997), Geographical Mobility: March 1995 to March 1996';
const P20_497_URL = 'https://www.census.gov/content/dam/Census/library/publications/1997/demo/p20-497.pdf';
const BLS_HOME = 'Aughinbaugh, A. (2013), Patterns of homeownership, delinquency, and foreclosure among youngest baby boomers, BLS Beyond the Numbers 2(2) (NLSY79)';
const BLS_HOME_URL = 'https://www.bls.gov/opub/btn/volume-2/patterns-of-homeownership.htm';
const SHARKEY_2008 = 'Sharkey, P. (2008), The Intergenerational Transmission of Context, American Journal of Sociology 113(4):931–969 (PSID)';
const SHARKEY_2008_URL = 'https://cpi.stanford.edu/_media/pdf/Reference%20Media/Sharkey_2008.pdf';
const SHARKEY_PEW = 'Sharkey, P. (2009), Neighborhoods and the Black-White Mobility Gap, Pew Economic Mobility Project (PSID)';
const SHARKEY_PEW_URL = 'https://www.pew.org/~/media/legacy/uploadedfiles/wwwpewtrustsorg/reports/economic_mobility/PEWSHARKEYv12pdf.pdf';
const MCPHERSON = 'McPherson, Smith-Lovin & Brashears (2006), Social Isolation in America: Changes in Core Discussion Networks over Two Decades, ASR 71(3), Table 1';
const MCPHERSON_URL = 'https://www.almendron.com/tribuna/wp-content/uploads/2018/02/social-isolation-in-america-changes-in-core-discus.pdf';
const IOANNIDES_LOURY = 'Ioannides & Loury (2004), Job Information Networks, Neighborhood Effects, and Inequality, Journal of Economic Literature 42(4)';
const IOANNIDES_LOURY_URL = 'https://cpi.stanford.edu/_media/pdf/Reference%20Media/Ioannides%20and%20Loury_2004_Social%20Networks.pdf';

export const PLACE_MOMENTS: readonly CalibrationMoment[] = [
  // ======================= 이사(거주 이동) =======================
  {
    id: 'mobility.annualRate.byYear',
    kind: 'marginal',
    description: '1년 동안 이사한 사람의 비율(1세 이상 전 인구) — 연도별 추세',
    values: { y1983: 0.166, y1985: 0.202, y1996: 0.163, y2000: 0.161, y2020: 0.093 },
    unit: 'annualProbability',
    population: '미국 1세 이상 민간 비시설 인구(CPS 3월/ASEC), 해당 연도 3월 기준 직전 1년',
    cohortFit: 'close',
    source: `${P20_497} (1983·1985·1996, 본문의 역사 비교) · ${P20_538} (2000) · Census 보도자료 2020 CPS ASEC Geographic Mobility (2020)`,
    url: P20_497_URL,
    howToMeasure:
      '횡단면 전 연령 비율이라 코호트 값이 아니다. 모델: 세계 합성 인구(모든 출생 코호트, 1세 이상)의 해당 연도 12개월 이사 경험 비율. ' +
      '1950–60년대는 약 20%, 1983년 16.6%, 1984–85년 20.2%로 반등 후 1990년대 16%대, 2020년 9.3%(역대 최저). 2000년 값: P20-538, 2020년 값: ' +
      'https://census.gov/newsroom/press-releases/2020/cps-asec-geographic-mobility.html . 장기 하락 추세(연령 구성·맞벌이·자가 증가)를 재현하는지가 핵심.',
  },
  {
    id: 'mobility.byAge.1996',
    kind: 'conditional',
    description: '연령대별 1년 이사율(1995–96) — Roy 코호트가 32–39세일 때',
    values: { age20to29: 0.33, age30to34: 0.219, age35to44: 0.141, age45to54: 0.098, age55to64: 0.066 },
    unit: 'annualProbability',
    population: '미국 CPS 1996년 3월, 해당 연령대 전원',
    cohortFit: 'close',
    source: P20_497,
    url: P20_497_URL,
    howToMeasure:
      '1995–96년 연령대별 12개월 이사 비율. 20–29세는 본문의 "약 33%"(20–24와 25–29의 대략값). 1957–64년생은 1996년에 32–39세 — 30–34·35–44 칸이 코호트 대각선에 해당. ' +
      '전체 1996년 16.3%.',
  },
  {
    id: 'mobility.byAge.2000',
    kind: 'conditional',
    description: '연령대별 1년 이사율(1999–2000) — Roy 코호트가 36–43세일 때',
    values: {
      age20to24: 0.352,
      age25to29: 0.324,
      age30to34: 0.22,
      age35to44: 0.148,
      age45to54: 0.093,
      age55to64: 0.07,
      age65to84: 0.043,
    },
    unit: 'annualProbability',
    population: '미국 CPS 2000년 3월, 해당 연령대 전원',
    cohortFit: 'close',
    source: P20_538,
    url: P20_538_URL,
    howToMeasure:
      '연령 곡선의 모양(20대 초반 정점, 45세 이후 10% 미만)이 주 목표. 1980년대 20대의 이사율은 이보다 약간 높았을 것(전체율 1985년 20.2%) — ' +
      '코호트 대각선(1980년대 20대, 2000년 30대 후반)으로 비교하되 1980년대 20대 칸은 허용오차를 넓게.',
  },
  {
    id: 'mobility.moveType.shares',
    kind: 'marginal',
    description: '이사자 중 같은 카운티 안 / 같은 주 다른 카운티 / 다른 주 / 해외에서 온 비율',
    values: {
      sameCounty_1996: 0.628,
      diffCountySameState_1996: 0.188,
      diffState_1996: 0.152,
      abroad_1996: 0.032,
      sameCounty_2000: 0.56,
      diffCountySameState_2000: 0.2,
      diffState_2000: 0.19,
      abroad_2000: 0.04,
    },
    unit: 'proportion',
    population: '미국 CPS 1996·2000년 3월, 직전 1년 이사자',
    cohortFit: 'close',
    source: `${P20_497} · ${P20_538}`,
    url: P20_538_URL,
    howToMeasure:
      '분모는 이사자. 모델의 이사 사건을 거리 유형(동네 안 이사 / 대도시권 안 / 주 경계 넘기)으로 나눠 비교. 해외 유입은 국내 출생 주인공 모델에선 제외하고 나머지 셋을 재정규화.',
  },
  {
    id: 'mobility.byTenure',
    kind: 'conditional',
    description: '점유 형태별 1년 이사율 — 세입자 대 자가',
    values: { renters_1996: 0.335, owners_1996: 0.083, renters_2000: 0.325, owners_2000: 0.091 },
    unit: 'annualProbability',
    population: '미국 CPS 1996·2000년 3월, 조사 시점 거주 주택의 점유 형태별 1세 이상 인구',
    cohortFit: 'close',
    source: `${P20_497} · ${P20_538}`,
    url: P20_538_URL,
    howToMeasure:
      '주의: 점유 형태는 이사 "후"(조사 시점) 기준 — 막 집을 산 이사자는 자가 쪽에 잡힌다. 1996년 자가 값은 본문 "열두 명 중 한 명"(1/12 ≈ 0.083). ' +
      '비율 약 4배가 핵심 목표. 모델도 12개월 뒤 점유 형태로 분류해서 측정.',
  },
  {
    id: 'mobility.byMaritalStatus.2000',
    kind: 'conditional',
    description: '혼인 상태별 1년 이사율(16세 이상, 1999–2000)',
    values: { neverMarried: 0.229, divorcedOrSeparated: 0.205, married: 0.12 },
    unit: 'annualProbability',
    population: '미국 CPS 2000년 3월, 16세 이상',
    cohortFit: 'close',
    source: P20_538,
    url: P20_538_URL,
    howToMeasure:
      '조사 시점 혼인 상태 기준(이혼으로 인한 이사가 이 칸에 들어간다). 생애 사건 → 이사 연결(결혼·이혼·실직)의 직접 측정치는 찾지 못했다 — 이 조건부 비율과 이사 이유(mobility.reasons.2000)로 간접 보정.',
  },
  {
    id: 'mobility.byIncomePoverty.2000',
    kind: 'conditional',
    description: '소득·빈곤 상태별 1년 이사율(1999–2000)',
    values: { householdIncomeUnder25k: 0.21, householdIncomeOver100k: 0.12, belowPoverty: 0.276, above150pctPoverty: 0.137 },
    unit: 'annualProbability',
    population: '미국 CPS 2000년 3월(가구 소득은 1999년 명목 달러)',
    cohortFit: 'close',
    source: P20_538,
    url: P20_538_URL,
    howToMeasure: '가난할수록 이사가 잦다(비자발 이사 포함). 모델: 빈곤선 이하 대 150% 초과의 이사율 비 ≈ 2.',
  },
  {
    id: 'mobility.byRace.2000',
    kind: 'conditional',
    description: '인종·민족별 1년 이사율(1999–2000)',
    values: { whiteNonHispanic: 0.14, black: 0.19, hispanic: 0.2, asianPacificIslander: 0.2 },
    unit: 'annualProbability',
    population: '미국 CPS 2000년 3월, 1세 이상',
    cohortFit: 'close',
    source: P20_538,
    url: P20_538_URL,
    howToMeasure: '격차는 대부분 연령·점유 형태·소득 구성에서 와야 한다(구조로 재현). 흑인·히스패닉 값은 본문 반올림("약 20%", "19%").',
  },
  {
    id: 'mobility.reasons.2000',
    kind: 'marginal',
    description: '이사 이유 — 주거 / 가족 / 일 / 기타, 거리별 차이',
    values: {
      housing: 0.52,
      family: 0.26,
      work: 0.16,
      other: 0.06,
      newOrBetterHome: 0.19,
      newJobOrTransfer: 0.1,
      intracounty_housing: 0.65,
      intracounty_work: 0.06,
      intercounty_housing: 0.32,
      intercounty_work: 0.31,
    },
    unit: 'proportion',
    population: '미국 CPS 2000년 3월, 직전 1년 이사자(주된 이유 하나)',
    cohortFit: 'close',
    source: 'Census P23-204 (Schachter 2001), Why People Move: Exploring the March 2000 Current Population Survey',
    url: 'https://www.census.gov/content/dam/Census/library/publications/2001/demo/p23-204.pdf',
    howToMeasure:
      '모델의 이사 사건에 원인 태그(주거 개선·자가 구입 / 결혼·이혼·독립 / 새 일자리·전근·실직)를 붙여 분포 비교. 근거리 이사는 주거, 원거리(카운티 간)는 일이 주도해야 한다. ' +
      '원거리 일 관련 이사의 2/3 이상이 새 일자리·전근. 실업 상태는 일 관련 이사를 강하게 예측하지 않았다(보고서) — 실직 → 원거리 이사 배수를 크게 두지 말 것.',
  },
  {
    id: 'mobility.fiveYear',
    kind: 'marginal',
    description: '5년 동안 이사한 사람의 비율(5세 이상) — 기간별, 1990–95년 25–29세',
    values: { y1975to80: 0.464, y1980to85: 0.417, y1985to90: 0.467, y1990to95: 0.441, age25to29_1990to95: 0.747 },
    unit: 'proportion',
    population: '미국 5세 이상(1980·1990 센서스, 1985·1995 CPS)',
    cohortFit: 'close',
    source: 'Census P23-200 (2000), 1990–1995 5년 거주 이동 보고서(1995년 3월 CPS)',
    url: 'https://www.census.gov/content/dam/Census/library/publications/2000/demo/p23-200.pdf',
    howToMeasure:
      '5년 전 거주지와 다른 곳에 사는 비율(중간 이사 횟수 무시). Roy 코호트는 1990–95년에 26–38세 — 25–29세 74.7%는 코호트 초입. 1년 이사율과 함께 보정하면 반복 이사자(같은 사람이 여러 번) 집중도를 잡는다.',
    unverified: '보고서 제목·저자 미확인(수치는 PDF 본문에서 확인). 1975–80·1985–90은 센서스, 1980–85·1990–95는 CPS라 출처 조사가 섞여 있다.',
  },
  {
    id: 'mobility.lifetimeMoves',
    kind: 'marginal',
    description: '평생 기대 이사 횟수 — 출생 시, 18세, 45세의 남은 횟수',
    values: { atBirth: 11.7, remainingAt18: 9.1, remainingAt45: 2.7 },
    unit: 'proportion',
    population: '2007 ACS 연령별 1년 이사율을 가상 코호트(10만 명, 사망 반영)에 적용',
    cohortFit: 'distant',
    source: 'U.S. Census Bureau, Calculating Migration Expectancy Using ACS Data',
    url: 'https://www.census.gov/topics/population/migration/guidance/calculating-migration-expectancy.html',
    howToMeasure:
      '단위는 횟수(unit 필드는 관례상 proportion). 2007년 횡단면 이사율 기반 기간 생명표식 계산이라 실제 코호트 값이 아니다 — 1980년대 이사율이 더 높았으므로 1957–64년생의 18세 이후 실제 횟수는 9.1보다 약간 많을 것. ' +
      '모델: 코호트의 18세 이후 이사 횟수 평균, 목표 9–11, 45세 이후 약 3.',
  },

  // ======================= 자가 보유 =======================
  {
    id: 'homeownership.nlsy79.byRace',
    kind: 'conditional',
    description: 'NLSY79 코호트의 자가 보유율 — 인종별, 1988·2000·2008년',
    values: {
      all_1988: 0.35,
      nonBlackNonHispanic_1988: 0.396,
      hispanic_1988: 0.244,
      black_1988: 0.148,
      all_2000: 0.677,
      nonBlackNonHispanic_2000: 0.737,
      hispanic_2000: 0.544,
      black_2000: 0.404,
      all_2008: 0.736,
      nonBlackNonHispanic_2008: 0.788,
      hispanic_2008: 0.597,
      black_2008: 0.493,
    },
    unit: 'proportion',
    population: 'NLSY79(1957–64년생), 1988년 23–31세 · 2000년 35–43세 · 2008년 43–51세 — 응답자 또는 배우자가 집을 소유',
    cohortFit: 'exact',
    source: `${BLS_HOME}, Chart 1`,
    url: BLS_HOME_URL,
    howToMeasure:
      '개인 기준(가구주 기준 HVS와 다르다 — housing.ts의 HOMEOWNERSHIP_BY_AGE_ROY_COHORT보다 약간 높다). "비흑인·비히스패닉"은 백인+기타. ' +
      '인종 격차(2008년 백인 79% 대 흑인 49%)는 소득·부모 자산(계약금)·혼인·동네 구조로 재현해야 한다 — 인종 더미 직접 배수 금지.',
  },
  {
    id: 'homeownership.nlsy79.byEducation',
    kind: 'conditional',
    description: 'NLSY79 자가 보유율 — 학력별, 1988년 대 2008년',
    values: {
      lessThanHS_1988: 0.236,
      highSchool_1988: 0.373,
      someCollege_1988: 0.374,
      college_1988: 0.343,
      lessThanHS_2008: 0.53,
      highSchool_2008: 0.686,
      someCollege_2008: 0.737,
      college_2008: 0.868,
    },
    unit: 'proportion',
    population: 'NLSY79, 1988년(23–31세)·2008년(43–51세)',
    cohortFit: 'exact',
    source: `${BLS_HOME}, Chart 2`,
    url: BLS_HOME_URL,
    howToMeasure:
      '교차가 핵심: 1988년엔 대졸이 고졸보다 낮다(학교에 오래 있어 늦게 시작) → 2008년엔 대졸이 가장 높다. 모델이 이 순위 역전을 재현해야 한다.',
  },
  {
    id: 'homeownership.nlsy79.byMarital.2008',
    kind: 'conditional',
    description: 'NLSY79 자가 보유율 — 혼인 상태별(2008, 43–51세)',
    values: { marriedWomen: 0.895, marriedMen: 0.876, neverMarriedMen: 0.42, neverMarriedWomen: 0.473 },
    unit: 'proportion',
    population: 'NLSY79, 2008년',
    cohortFit: 'exact',
    source: BLS_HOME,
    url: BLS_HOME_URL,
    howToMeasure: '결혼이 자가 전환의 가장 큰 계기. 모델: 2008년(43–51세) 혼인 상태별 자가 비율.',
  },
  {
    id: 'foreclosure.nlsy79.2007to2010',
    kind: 'conditional',
    description: '2007–2010년 주택 보유자의 연체·압류 통지·압류로 집을 잃음 — 인종·학력별',
    values: {
      delinquent_all: 0.07,
      foreclosureNotice_all: 0.026,
      lostHome_all: 0.014,
      delinquent_nonBlackNonHispanic: 0.057,
      foreclosureNotice_nonBlackNonHispanic: 0.022,
      lostHome_nonBlackNonHispanic: 0.014,
      delinquent_hispanic: 0.128,
      foreclosureNotice_hispanic: 0.044,
      lostHome_hispanic: 0.024,
      delinquent_black: 0.159,
      foreclosureNotice_black: 0.055,
      lostHome_black: 0.015,
      delinquent_college: 0.034,
      delinquent_lessThanHS: 0.112,
    },
    unit: 'proportion',
    population: 'NLSY79, 2007–2010 사이 주택 보유자(43–53세)',
    cohortFit: 'exact',
    source: `${BLS_HOME}, Chart 4`,
    url: BLS_HOME_URL,
    howToMeasure:
      '연체 = 2개월 이상 밀림. 분모는 기간 중 보유자. 흑인의 연체율은 백인의 약 3배지만 실제 상실률은 비슷(1.5% 대 1.4%) — 모델이 상실률 격차를 과장하면 틀린 것. ' +
      '이 코호트는 2000년대 중반 첫 구입자가 아니라 이미 보유 중인 중년이라 전국 서브프라임 압류율(2004–08년 대출 기준)보다 훨씬 낮다.',
  },
  {
    id: 'homeownership.hvs.byRace',
    kind: 'conditional',
    description: '가구주 인종·민족별 자가 보유율(전 연령) — 1994·2000·2005',
    values: {
      total_1994: 0.64,
      whiteNonHispanic_1994: 0.7,
      black_1994: 0.423,
      hispanic_1994: 0.412,
      other_1994: 0.477,
      total_2000: 0.674,
      whiteNonHispanic_2000: 0.738,
      black_2000: 0.472,
      hispanic_2000: 0.463,
      other_2000: 0.535,
      total_2005: 0.689,
      whiteNonHispanic_2005: 0.758,
      black_2005: 0.482,
      hispanic_2005: 0.495,
      other_2005: 0.592,
    },
    unit: 'proportion',
    population: '미국 가구(CPS/HVS 연평균), 가구주 기준 전 연령',
    cohortFit: 'close',
    source: 'Census CPS/HVS Annual Statistics 2005, Table 20: Homeownership Rates by Race and Ethnicity of Householder: 1994 to 2005',
    url: 'https://www.census.gov/housing/hvs/files/annual05/ann05t20.txt',
    howToMeasure: '세계 전체 인구(모든 코호트) 가구주 기준 횡단면. 연령 구성이 달라 코호트 값(NLSY79)과 직접 비교하지 말 것.',
  },
  {
    id: 'firstHome.familyHelp',
    kind: 'marginal',
    description: '첫 집 구입자 중 친척에게 계약금 도움을 받은 비율과 도움의 크기',
    values: { receivedHelpShare: 0.2, giftShareOfDownPayment: 0.5, meanAge_withGift: 32.3, meanAge_noGift: 35.7 },
    unit: 'proportion',
    population: '미국 첫 주택 구입자(Chicago Title "Who\'s Buying Homes in America" 1976–82·1988–92) · 나이는 1990년 보스턴 HMDA 대출 신청자',
    cohortFit: 'close',
    source: 'Engelhardt & Mayer (1994), Gifts for home purchase and housing market behavior, New England Economic Review May/June 1994',
    url: 'https://www.bostonfed.org/-/media/Documents/neer/neer394d.pdf',
    howToMeasure:
      '"첫 구입자 약 다섯 명 중 한 명이 친척 도움, 받은 사람은 계약금의 평균 절반". 캘리포니아 비싼 도시에서 도움의 중요성이 가장 크다(LA 겹침: 부모 자산 효과 강화). ' +
      '모델: 코호트 첫 구입 중 부모 이전으로 계약금 일부를 채운 비율. 나이(선물 32.3세 대 무선물 35.7세)는 보스턴 대출 신청자 평균 — 방향 검증용(선물이 구입을 앞당긴다).',
    unverified: '연도별 표(1976–82년 8.7–32.6%)와 도시별 값은 PDF 표를 요약 도구로 읽은 것이라 미확인 — 헤드라인 20%·50%만 사용.',
  },
  {
    id: 'la.priceToIncome',
    kind: 'conditional',
    description: 'LA 집값 대 소득 배수 — 전국과 비교',
    values: {
      laCounty_1980: 5.0,
      laCounty_2023: 9.57,
      laMetro_peak2005to09: 11.7,
      laMetro_2024: 10.8,
      us_1988: 3.2,
      us_1980to99_low: 3.1,
      us_1980to99_high: 3.4,
      us_2005: 4.7,
      us_2024: 5.0,
    },
    unit: 'proportion',
    population: 'LA 카운티(센서스/ACS 주택 중위가치 ÷ 가구 중위소득) · LA 대도시권과 전국(JCHS: 단독주택 중위가격 ÷ 가구 중위소득)',
    cohortFit: 'close',
    source:
      'LA County: Neighborhood Data for Social Change, SOLACHAN 2025 Homeowners (1980 $369,300 대 $73,700, 2023 $828,700 대 $86,600) · 대도시권·전국: Harvard JCHS 블로그(2018 "Price-to-income ratios are nearing historic highs", 2025 "Home prices surge to five times median income")',
    url: 'https://la.myneighborhooddata.org/solachan-2025-homeowners/',
    howToMeasure:
      '단위는 배수. 두 계열은 정의가 다르다(자가 평가 중위가치 대 거래 가격) — 계열 안에서만 비교. 1980년 LA 5배 대 전국 약 3.2배: LA 겹침에서 구입 장벽은 1.5배로 시작해 2000년대 이후 2배 이상. ' +
      'JCHS URL: https://www.jchs.harvard.edu/blog/price-to-income-ratios-are-nearing-historic-highs , https://www.jchs.harvard.edu/blog/home-prices-surge-five-times-median-income-nearing-historic-highs . laCounty_2023은 828.7/86.6으로 계산.',
  },
  {
    id: 'la.homeownership.byRace.2023',
    kind: 'conditional',
    description: 'LA 카운티 자가 보유율 — 인종별(2023), 주·전국 비교',
    values: { laCounty_all: 0.45, laCounty_white: 0.53, laCounty_asianPacificIslander: 0.56, laCounty_hispanic: 0.39, laCounty_black: 0.31, california: 0.56, us: 0.65 },
    unit: 'proportion',
    population: 'LA 카운티 가구(ACS 2023), 가구주 인종 기준',
    cohortFit: 'distant',
    source: 'Neighborhood Data for Social Change (USC Price), SOLACHAN 2025 — Homeowners chapter',
    url: 'https://la.myneighborhooddata.org/solachan-2025-homeowners/',
    howToMeasure:
      '2023년 전 연령 횡단면. LA 카운티 자가율은 1970년 이후 늘 주·전국보다 낮았고 1980년 이후 하락(53년 만의 최저). 흑인 2010년 35% → 2023년 31%. ' +
      'LA에 사는 NPC의 자가 전환 해저드를 전국 대비 낮추는 겹침 계수의 근거. 1980–2000년 LA 자가율 원값은 찾지 못함.',
  },

  // ======================= 동네 =======================
  {
    id: 'neighborhood.childhoodPoverty.byRace',
    kind: 'conditional',
    description: '어린 시절 동네 빈곤 노출 — 빈곤율 20%/30% 이상 동네에서 자란 비율, 인종별',
    values: {
      black_pov20plus_born1955to70: 0.62,
      white_pov20plus_born1955to70: 0.04,
      black_pov30plus_born1955to70: 0.3,
      white_pov30plus_born1955to70: 0.0,
      black_pov20plus_born1985to2000: 0.66,
      white_pov20plus_born1985to2000: 0.06,
    },
    unit: 'proportion',
    population: 'PSID 흑인·백인 아동, 1955–70년생(Roy 코호트 포함) 및 1985–2000년생 — 아동기 평균 센서스 트랙트 빈곤율',
    cohortFit: 'exact',
    source: SHARKEY_PEW,
    url: SHARKEY_PEW_URL,
    howToMeasure:
      '초기 동네 지수 배정의 목표. 30% 이상 백인 값은 본문 "essentially no white children"(≈0). 히스패닉·기타는 PSID 표본 한계로 없음. ' +
      '빈곤 동네가 하향 이동 확률을 올리는 크기(빈곤 10% 미만 → 20–30%: 하향 이동 52% 증가)와 인종 하향 이동 격차의 1/4–1/3 설명은 PLACE_STRUCTURE_FACTS 참고.',
  },
  {
    id: 'neighborhood.intergenerationalPersistence',
    kind: 'conditional',
    description: '동네의 세대 간 대물림 — 부모 세대 최하위 사분위(십분위) 동네 출신이 성인이 되어서도 거기 사는 비율',
    values: {
      black_bottomQuartileStay: 0.7,
      white_bottomQuartileStay: 0.4,
      black_bottomDecileStay: 0.55,
      white_bottomDecileStay: 0.19,
      black_bothGenerationsBottomQuartile: 0.5,
      white_bothGenerationsBottomQuartile: 0.07,
      black_bothGenerationsBottomDecile: 0.25,
      white_topDecileStay: 0.45,
    },
    unit: 'proportion',
    population: 'PSID 부모-자녀 4,464쌍(흑인·백인), 1968–2003 — 동네 = 센서스 트랙트 소득 분포상 위치',
    cohortFit: 'close',
    source: SHARKEY_2008,
    url: SHARKEY_2008_URL,
    howToMeasure:
      '흑인 bottomQuartileStay는 "70% 이상"(하한). bothGenerations는 전체 가족 중 두 세대 모두 최하위 사분위에 산 비율(흑인은 "절반 이상" → 0.5 하한). ' +
      '모델: 부모 동네 지수 분위 → 자녀의 성인기(대략 30–40세) 동네 분위 전이 행렬. 동네 소득 세대 간 탄력성(0.64 전체)은 구조 사실로.',
  },
  {
    id: 'neighborhood.concentratedPoverty',
    kind: 'conditional',
    description: '빈곤층 중 고빈곤(40% 이상) 트랙트에 사는 비율 — 인종별, 1990·2000, LA',
    values: {
      black_1990: 0.304,
      black_2000: 0.186,
      hispanic_1990: 0.212,
      hispanic_2000: 0.138,
      white_1990: 0.071,
      white_2000: 0.059,
      la_black_1990: 0.173,
      la_black_2000: 0.213,
      la_hispanic_1990: 0.091,
      la_hispanic_2000: 0.169,
    },
    unit: 'proportion',
    population: '빈곤선 이하 인구(센서스 1990·2000), 대도시권 트랙트',
    cohortFit: 'close',
    source: 'Jargowsky, P. (2003), Stunning Progress, Hidden Problems: The Dramatic Decline of Concentrated Poverty in the 1990s, Brookings',
    url: 'https://www.brookings.edu/wp-content/uploads/2016/06/jargowskypoverty.pdf',
    howToMeasure:
      '분모가 "빈곤한 사람"이다(전체 성인이 아님). 전국은 1990년대 크게 줄었지만 LA는 거꾸로 늘었다(고빈곤 동네 인구 +109%). 고빈곤 동네 거주 인구: 1970 530만, 1980 650만, 1990 1,040만, 2000 790만. ' +
      '모델: 빈곤 상태인 세계 인구 중 동네 지수가 고빈곤 문턱 아래인 비율. 전체 성인 기준(20%/40% 트랙트 거주 비율, 인종별) 원값은 찾지 못함.',
  },
  {
    id: 'segregation.la.dissimilarity',
    kind: 'directional',
    description: 'LA 대도시권 거주 분리(상이 지수) — 흑인-백인, 히스패닉-백인',
    values: {
      blackWhite_1980: 81.1,
      blackWhite_1990: 73.1,
      blackWhite_2000: 67.4,
      blackWhite_2010: 65.0,
      hispanicWhite_1980: 57.3,
      hispanicWhite_1990: 61.1,
      hispanicWhite_2000: 63.1,
      hispanicWhite_2010: 63.4,
    },
    unit: 'proportion',
    population: 'LA 대도시권 센서스 트랙트(1980–2010)',
    cohortFit: 'close',
    source: 'Logan & Stults (2011), The Persistence of Segregation in the Metropolis: New Findings from the 2010 Census, US2010 Project, Tables 1·4',
    url: 'https://s4.ad.brown.edu/Projects/Diversity/Data/Report/report2.pdf',
    howToMeasure:
      '0–100 지수(unit 관례상 proportion). 방향: 흑인-백인은 크게 하락, 히스패닉-백인은 상승(이민 유입). 전국 평균은 race.ts 담당 — 이 보고서의 전국 요약표는 요약 도구가 호출마다 다른 값을 내서 넣지 않았다. ' +
      '보고서 문장: 전국 흑인-백인 분리는 1970년대 6, 1980년대 6, 1990년대 3, 2000년 이후 5포인트 하락.',
  },

  // ======================= 관계망 =======================
  {
    id: 'network.coreDiscussion',
    kind: 'marginal',
    description: '"중요한 일을 의논하는 사람" 수 — GSS 1985 대 2004, Pew 2008',
    values: {
      mean_1985: 2.94,
      mean_2004: 2.08,
      none_1985: 0.1,
      none_2004: 0.246,
      spouseOnly_1985: 0.064,
      spouseOnly_2004: 0.093,
      kinShare_1985: 0.53,
      kinShare_2004: 0.6,
      noDiscussionConfidant_pew2008: 0.12,
      noConfidantAtAll_pew2008: 0.06,
    },
    unit: 'proportion',
    population: 'GSS 1985·2004 미국 성인(최대 5명 이름) · Pew Internet 2008 전화 조사 성인',
    cohortFit: 'close',
    source: `${MCPHERSON} · Pew Research (2009), Social Isolation and New Technology`,
    url: MCPHERSON_URL,
    howToMeasure:
      '평균 크기는 5명 상한(공감 집단 15명보다 훨씬 좁은 "핵심" 층). 2004년 급감은 방법 인공물 논쟁이 있다(Fischer 2009 ASR "An Artifact?": 훈련·피로 효과, 코딩 오류; ' +
      'https://journals.sagepub.com/doi/10.1177/000312240907400408) — Pew 2008의 "의논 상대 없음" 12%(중요 인물까지 넓히면 6%)가 더 현실적. 1985년 값(평균 약 3, 무 10%)을 주 목표로, 2004년은 쓰지 말 것. ' +
      'Pew URL: https://www.pewresearch.org/internet/2009/11/04/social-isolation-and-new-technology/ . 모델: 성인 NPC의 지지 집단 중 "의논" 관계 수(5 상한).',
  },
  {
    id: 'network.closeFriends',
    kind: 'marginal',
    description: '친한 친구 수 분포 — 1990 대 2021',
    values: {
      none_1990: 0.03,
      threeOrFewer_1990: 0.27,
      tenPlus_1990: 0.33,
      none_2021: 0.12,
      threeOrFewer_2021: 0.49,
      fourToNine_2021: 0.36,
      tenPlus_2021: 0.13,
      metCloseFriendAtWork_2021: 0.54,
    },
    unit: 'proportion',
    population: '미국 성인 — 1990 Gallup, 2021년 5월 American Perspectives Survey',
    cohortFit: 'close',
    source: 'Survey Center on American Life (Cox 2021), The State of American Friendship: Change, Challenges, and Loss',
    url: 'https://www.americansurveycenter.org/research/the-state-of-american-friendship-change-challenges-and-loss/',
    howToMeasure:
      '"친한 친구" 자기 보고(가족 제외). threeOrFewer에 none이 포함되는지 불분명(2021 합 0.49+0.36+0.13 ≈ 1이라 포함으로 보임). Roy 코호트는 1990년에 26–33세 — 1990 값이 코호트 초년 목표. ' +
      '친구를 만난 곳: 본인·배우자 직장 54%(중복 응답). 연령별 친구 수는 이 요약에 없음.',
  },
  {
    id: 'network.racialHomophily.2013',
    kind: 'conditional',
    description: '의논 관계망의 인종 동질성 — 전부 같은 인종인 비율, 평균 구성',
    values: {
      white_allWhite: 0.75,
      black_allBlack: 0.65,
      hispanic_allHispanic: 0.46,
      white_networkShareWhite: 0.91,
      black_networkShareBlack: 0.83,
      black_networkShareWhite: 0.08,
      hispanic_networkShareHispanic: 0.64,
      hispanic_networkShareWhite: 0.19,
    },
    unit: 'proportion',
    population: 'PRRI 2013 American Values Survey, 미국 성인(지난 6개월 중요한 일을 의논한 최대 7명)',
    cohortFit: 'close',
    source: 'PRRI (2014), Race and Americans\' Social Networks',
    url: 'https://prri.org/research/analysis-social-network/',
    howToMeasure:
      '백인 하위 집단(나이·지역·정당·성별) 모두 68–82%가 전원 백인 — 나이 차이 작음. 모델: 실체화된 공감 집단의 인종 구성(동네 분리 + 동질 선호로 재현). 흑인 약 65%는 본문 "roughly".',
  },
  {
    id: 'jobs.viaPersonalContacts',
    kind: 'conditional',
    description: '인맥으로 일자리를 얻는 비율, 구직 방법으로 친구·친척을 쓴 실업자 비율',
    values: {
      currentJobHeardViaFriendRelative: 0.5,
      rangeLow: 0.3,
      rangeHigh: 0.6,
      unemployedUsingFriends_1971: 0.15,
      unemployedUsingFriends_1992: 0.23,
      unemployedUsingFriends_1992_men: 0.266,
      unemployedUsingFriends_1992_women: 0.2,
      unemployedUsingFriends_1992_white: 0.239,
      unemployedUsingFriends_1992_black: 0.215,
      unemployedUsingFriends_1992_hispanic: 0.328,
    },
    unit: 'proportion',
    population: '현재 직장 경로: PSID(Corcoran et al. 1980) · 범위: Bewley(1999) 요약 · 구직 방법: CPS 실업자, 직전 4주',
    cohortFit: 'close',
    source: IOANNIDES_LOURY,
    url: IOANNIDES_LOURY_URL,
    howToMeasure:
      '경력 모델의 일자리 제안 중 "인맥 경유" 비율 목표 ≈ 0.5(허용 0.3–0.6). CPS 값은 실업자가 그 달 쓴 방법(성공 여부 무관, 중복)이라 다른 개념 — 방향용: 히스패닉 > 백인 ≈ 흑인, 남 > 여. ' +
      '인맥 임금 효과는 연구마다 엇갈린다(백인만 19% 프리미엄이라는 연구 포함) — 평균 임금 배수는 0에 가깝게.',
  },
  {
    id: 'jobs.weakTies',
    kind: 'directional',
    description: '약한 연결의 일자리 정보 — 인맥으로 찾은 일자리를 알려준 사람과의 접촉 빈도',
    values: { weakTie_rarely: 0.278, intermediate_occasionally: 0.556, strongTie_often: 0.167, linEtAl_weakTieShareOfContactJobs: 0.34 },
    unit: 'proportion',
    population: 'Granovetter(1974) 보스턴 교외 전문·기술·관리직 이직자 중 인맥으로 찾은 사람 · Lin, Ensel & Vaughn(1981) 뉴욕주 올버니 남성',
    cohortFit: 'distant',
    source: 'Granovetter, M. (1983), The Strength of Weak Ties: A Network Theory Revisited, Sociological Theory 1',
    url: 'https://www.csc2.ncsu.edu/faculty/mpsingh/local/Social/f15/wrap/readings/Granovetter-revisited.pdf',
    howToMeasure:
      '인맥 경유 일자리 중 정보원이 "드물게 보는" 사람 27.8%, "자주 보는" 사람 16.7%, 중간 55.6%. 방향 검증: 인맥 제안 중 공감 집단 밖(150명 층) 비율 > 지지 집단 비율. ' +
      '약한 연결 정보원은 지위가 높았다(Lin 등: 약한 연결 76.2% 대 강한 연결 28.9%가 고지위, 첫 직장). 1960년대 전문직 표본이라 일반화 주의.',
  },
  {
    id: 'church.membership',
    kind: 'conditional',
    description: '교회·회당·모스크 등록 교인 비율 — 세대별·인종별, 1998–2000 대 2018–2020',
    values: {
      all_1999: 0.7,
      all_2020: 0.47,
      boomers_1998to2000: 0.67,
      boomers_2018to2020: 0.58,
      genX_1998to2000: 0.62,
      genX_2018to2020: 0.5,
      traditionalists_1998to2000: 0.77,
      traditionalists_2018to2020: 0.66,
      whiteNH_1998to2000: 0.68,
      whiteNH_2018to2020: 0.52,
      blackNH_1998to2000: 0.78,
      blackNH_2018to2020: 0.59,
      hispanic_2018to2020: 0.37,
    },
    unit: 'proportion',
    population: 'Gallup 미국 성인 3개년 합산',
    cohortFit: 'close',
    source: 'Gallup (Jones 2021), U.S. Church Membership Falls Below Majority for First Time',
    url: 'https://news.gallup.com/poll/341963/church-membership-falls-below-majority-first-time.aspx',
    howToMeasure:
      '출석이 아니라 "교인 등록". 베이비붐(1946–64년생, Roy 포함) 67% → 58%: 같은 코호트 안에서도 20년간 9포인트 하락 — 모델은 코호트 내 이탈을 만들어야 한다. ' +
      '히스패닉 과거 값은 2011년 스페인어 조사 도입으로 비교 불가(Gallup). 주간 출석은 1950년 이후 자기 보고 37–49% 사이(Gallup 2013), 2022년 매주·거의 매주 31%, 어릴 때 67%.',
  },
  {
    id: 'loneliness.age45plus',
    kind: 'conditional',
    description: '45세 이상 외로움 비율(UCLA 외로움 척도) — 추세와 위험 집단',
    values: {
      lonely_2010: 0.35,
      lonely_2018: 0.35,
      lonely_2024: 0.4,
      men_2024: 0.42,
      women_2024: 0.37,
      incomeUnder25k_2018: 0.5,
      neverSpokeToNeighbor_2018: 0.61,
      spokeToNeighbor_2018: 0.33,
      satisfiedWithPartner_2018: 0.26,
      unsatisfiedWithPartner_2018: 0.48,
    },
    unit: 'proportion',
    population: 'AARP 조사, 미국 45세 이상(2018: N=3,020, 6월 5–15일)',
    cohortFit: 'exact',
    source: 'AARP Research (2018, 2025), Loneliness and Social Connections: A National Survey of Adults 45 and Older',
    url: 'https://www.aarp.org/pri/topics/social-leisure/relationships/loneliness-social-connections-2025/',
    howToMeasure:
      '2018년에 Roy 코호트는 54–61세 — 측정 모집단 안. 연령 내 기울기: 45–59세가 60세 이상보다 높다(세부 값 미확인). 저소득 "두 명 중 한 명". ' +
      '2018 URL: https://www.aarp.org/pri/topics/social-leisure/relationships/loneliness-social-connections/ . 모델: 관계망 크기·배우자 관계 질·이웃 접촉에서 외로움 상태를 파생하고 비율 비교.',
  },
];

/**
 * 구조 사실 — 적률이 아니라 메커니즘의 모양을 정하는 근거(인과 효과, 정의, 제도). 필드마다 출처와 URL.
 */
export const PLACE_STRUCTURE_FACTS = {
  /** 동네 노출 효과(인과): 더 나은 통근권으로 이사한 아이는 해마다 거주자 결과 차이의 약 4%씩 수렴한다(9–23세 선형). */
  childhoodExposureEffect: {
    convergencePerYear: 0.04,
    ageRange: [9, 23] as const,
    fromBirthShare: 0.8, // 태어나서 20년 살면 차이의 약 80%를 얻는다(저자 문장)
    population: '1980–88년생, 세금 기록 1996–2012, 통근권 간 1회 이사자 약 160만',
    source: 'Chetty & Hendren (2018), The Impacts of Neighborhoods on Intergenerational Mobility I: Childhood Exposure Effects, QJE 133(3)',
    url: 'https://opportunityinsights.org/wp-content/uploads/2018/03/movers_paper1.pdf',
    note: '성인이 된 뒤의 이사에는 효과가 없다고 두는 근거(아래 MTO). 동네 지수 → 아동 결과 경로는 "노출 연수 × 차이 × 0.04".',
  },
  /** MTO 실험: 13세 전에 저빈곤 동네로 옮긴 아이는 20대 중반 소득 31% 증가, 13세 이후는 효과 없음·음(-), 성인은 효과 없음. */
  movingToOpportunity: {
    earningsGainMovedBefore13: 0.31,
    earningsGainDollars: 3477, // 통제군 평균 $11,270 대비
    collegeAttendanceGainPp: 0.025, // 18–20세 대학 진학 +2.5%p(통제군 16.5%)
    olderChildrenEffect: 'null-or-negative',
    adultEconomicEffect: 'none',
    source: 'Chetty, Hendren & Katz (2016), The Effects of Exposure to Better Neighborhoods on Children: New Evidence from the MTO Experiment, AER 106(4)',
    url: 'https://opportunityinsights.org/wp-content/uploads/2018/03/mto_paper.pdf',
    note: '성인 이사의 소득 효과는 0으로(성인 대상 null 적률로 써도 된다). 요약 도구가 성인 추정치 -$734를 돌려줬으나 원문 확인 전이라 값은 쓰지 않는다.',
  },
  /** 동네 소득의 세대 간 탄력성 — 부모 동네 소득 1% 차이가 자녀 성인기 동네 소득 0.64% 차이. */
  neighborhoodIncomeElasticity: {
    all: 0.64, // "적어도 0.64"
    blackOnly: 0.39,
    whiteOnly: 0.58,
    source: `${SHARKEY_2008}, Table 2`,
    url: SHARKEY_2008_URL,
    note: '흑인 내부 탄력성이 더 낮은 것은 좋은 동네에 오른 흑인 가족이 그 위치를 대물림하지 못하기 때문(저자 해석) — 인종 격차는 평균 수준 차이에서 온다.',
  },
  /** 아동기 동네 빈곤 → 하향 이동. */
  neighborhoodPovertyDownwardMobility: {
    downwardMobilityIncrease_pov10to_20_30: 0.52, // 빈곤 10% 미만 → 20–30% 동네: 하향 이동 확률 52% 증가
    shareOfRacialDownwardGapExplained: [0.25, 0.33] as const,
    source: SHARKEY_PEW,
    url: SHARKEY_PEW_URL,
    note: '중산층 흑인 가정 자녀의 하향 이동을 동네가 부분 설명 — 경력 모델의 동네 경로 크기 상한 점검용.',
  },
  /** 이사 이유의 구조: 근거리 = 주거, 원거리 = 일. 실업이 일 관련 이사를 강하게 예측하지 않음. */
  moveReasonStructure: {
    source: 'Census P23-204 (Schachter 2001), Why People Move',
    url: 'https://www.census.gov/content/dam/Census/library/publications/2001/demo/p23-204.pdf',
    note: '일 관련 원거리 이사의 2/3 이상이 새 일자리·전근(실직 뒤 탐색 이사가 아님). 대학원 학력자는 고졸의 약 2배 비율로 일 때문에 이사.',
  },
  /** 첫 구입자 나이·가족 도움(최근): 2024–25 NAR — 첫 구입자 중위 나이 40세(역대 최고), 21% 비중, 가족·친구 선물·대출 22%. */
  firstTimeBuyerRecent: {
    medianAge_2025: 40,
    firstTimeShare_2025: 0.21,
    firstTimeSharePreRecession: 0.4,
    familyGiftOrLoanShare_2025: 0.22,
    medianDownPayment_2025: 0.1,
    source: 'NAR (2025), Profile of Home Buyers and Sellers — 보도자료 · How NAR Research Collects First-Time Buyer Data',
    url: 'https://www.nar.realtor/press-releases/first-time-home-buyer-share-falls-to-historic-low-of-21-median-age-rises-to-40',
    note: '과거 첫 구입자는 "20대 후반–30대 초반"(NAR 문장) — 1980년대 정확한 중위 나이(흔히 인용되는 1981년 29세)는 원문 미확인. 게임의 2020년대 NPC 첫 구입 나이 참고용.',
    unverified: '1980–90년대 첫 구입 나이 수치는 NAR 원표를 확인하지 못함.',
  },
  /** 인종·민족 분리 전국 추세는 race.ts 담당. 여기엔 LA만(적률 segregation.la.dissimilarity). */
  segregationNationalNote: {
    source: 'Logan & Stults (2011), US2010 Project',
    url: 'https://s4.ad.brown.edu/Projects/Diversity/Data/Report/report2.pdf',
    unverified: '전국 가중 평균 표는 요약 도구가 호출마다 다른 값(흑백 1980 68.4 등)을 돌려줘 채택하지 않음 — race.ts에서 원표 확인.',
  },
} as const;
