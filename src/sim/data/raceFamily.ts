import type { CalibrationMoment } from './marriage';

/**
 * 인종별 가족 형성 + 짧은/비동거 관계 — 세계 모델(결혼 시장·연애·출산)의 인종별 검증 목표.
 *
 * 원칙(REALISM_V2.md): 인종은 어떤 행동 방정식에도 계수로 들어가지 않는다. 아래 적률의 인종 격차는
 * 부모 소득·자산, 동네, 노동시장, 수감·사망으로 인한 결혼 시장 성비 같은 구조 경로를 거쳐 **창발**해야 하고,
 * 여기 숫자는 그 결과를 검증하는 정답지다. social.ts(전체 결혼 이력·동거·혼외 출산·MPF 전체값)와 marriage.ts
 * (이혼 후 5년 재혼의 인종별 값)를 중복하지 않고 인종 차원으로 확장한다.
 *
 * 수집 방식 주의: 이 세션에서는 원문을 직접 내려받을 수 없어(프록시 차단) 모든 값을 WebFetch(원문을 요약
 * 모델이 읽어 주는 도구)로 받았다. 같은 표를 여러 번 서로 다른 질문으로 물어 값이 일치하고, 행 합계·내부 항등식
 * (예: 결혼 전 임신 중 출생 전 결혼 비율 = 임신 후 결혼 ÷ (혼전 출생 + 임신 후 결혼))이 맞는 것만 확인값으로
 * 두었다. 한 번만 받았거나 그림에서 읽은 값, 내부 모순이 있는 값은 `unverified`.
 */

const NLSY79_55 = 'BLS Monthly Labor Review (2024), Patterns of marriage and divorce from ages 15 to 55: Evidence from the NLSY79, Table 4';
const NLSY79_55_URL =
  'https://www.bls.gov/opub/mlr/2024/article/patterns-of-marriage-and-divorce-from-ages-15-to-55-evidence-from-the-nlsy79.htm';
const NLSY79_46 = 'Aughinbaugh, Robles & Sun, BLS Monthly Labor Review (2013), Marriage and divorce: patterns by gender, race, and educational attainment';
const NLSY79_46_URL = 'https://www.bls.gov/opub/mlr/2013/article/marriage-and-divorce-patterns-by-gender-race-and-educational-attainment.htm';
const HUS_2016_T4 = 'NCHS, Health, United States 2016, Table 4. Nonmarital childbearing, by detailed race and Hispanic origin of mother, and maternal age: selected years 1970–2015';
const HUS_2016_T4_URL = 'https://www.cdc.gov/nchs/data/hus/2016/004.pdf';
const NVSR_48_16 = 'NCHS, Ventura & Bachrach (2000), Nonmarital Childbearing in the United States, 1940–99, NVSR 48(16)';
const NVSR_48_16_URL = 'https://www.cdc.gov/nchs/data/nvsr/nvsr48/nvs48_16.pdf';
const P23_197 = 'U.S. Census Bureau, Bachu (1999), Trends in Premarital Childbearing: 1930 to 1994, P23-197, Table 1 (IPUMS 사본)';
const P23_197_URL = 'https://cps.ipums.org/cps/resources/cpr/p23-197.pdf';
const FF_UNION = 'Carlson, McLanahan & England (2004), Union formation in fragile families, Demography 41(2), Table 1 및 본문';
export const FF_UNION_URL = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3169423/';
const PEW_INTERMARRIAGE = 'Pew Research Center (2017), Intermarriage in the U.S. 50 Years After Loving v. Virginia, ch. 1 Trends and patterns in intermarriage';
const PEW_INTERMARRIAGE_URL = 'https://www.pewresearch.org/social-trends/2017/05/18/1-trends-and-patterns-in-intermarriage/';

export const RACE_FAMILY_MOMENTS: readonly CalibrationMoment[] = [
  // ---- 결혼 이력: 인종별 ----
  {
    id: 'raceMarriage.by55',
    kind: 'conditional',
    description: '인종별 55세까지의 결혼·이혼·재혼 이력(남녀 합산)',
    values: {
      everMarried_white: 0.906,
      everMarried_black: 0.694,
      everMarried_hispanic: 0.857,
      everDivorced_white: 0.412,
      everDivorced_black: 0.352,
      everDivorced_hispanic: 0.419,
      divorcedAmongMarried_white: 0.455,
      divorcedAmongMarried_black: 0.508,
      divorcedAmongMarried_hispanic: 0.49,
      firstMarriageEndsInDivorce_white: 0.452,
      firstMarriageEndsInDivorce_black: 0.506,
      firstMarriageEndsInDivorce_hispanic: 0.486,
      stillInFirstMarriage_white: 0.517,
      stillInFirstMarriage_black: 0.432,
      stillInFirstMarriage_hispanic: 0.479,
      remarriedAfterDivorce_white: 0.688,
      remarriedAfterDivorce_black: 0.527,
      remarriedAfterDivorce_hispanic: 0.577,
      secondMarriageEndsInDivorce_white: 0.387,
      secondMarriageEndsInDivorce_black: 0.379,
      secondMarriageEndsInDivorce_hispanic: 0.474,
    },
    unit: 'proportion',
    population: 'NLSY79(1957–64년생) 55세 시점, 남녀 합산. white = 비히스패닉 백인, black = 비히스패닉 흑인',
    cohortFit: 'exact',
    source: NLSY79_55,
    url: NLSY79_55_URL,
    howToMeasure:
      '세계의 1957–64년생 전원(실체화 여부 무관)을 55세 생일 시점에서 인종별로 집계, 남녀 합산(표에 인종×성별 교차값 없음). ' +
      'everMarried/everDivorced 분모 = 해당 인종 전체(미혼 포함). divorcedAmongMarried·stillInFirstMarriage 분모 = 결혼 경험자. ' +
      'firstMarriageEndsInDivorce 분모 = 첫 결혼 전체, remarriedAfterDivorce 분모 = 첫 결혼 이혼 경험자, secondMarriageEndsInDivorce 분모 = 두 번째 결혼 전체. ' +
      '"other" 인종은 표에 없다 — 측정하지 않음. 핵심 검증: 흑인의 낮은 결혼 경험(69% 대 91%)과 결혼 경험자 중 높은 이혼(51% 대 46%)이 ' +
      '인종 계수 없이 결혼 시장 성비·남성 소득·수감 경로에서 나와야 한다. 흑인의 전체 이혼 경험이 오히려 낮은 것(35% 대 41%)은 결혼 자체가 적기 때문 — ' +
      '모델이 이 역전을 재현하는지 확인.',
  },
  {
    id: 'raceMarriage.ageAtFirstMarriage',
    kind: 'conditional',
    description: '인종별 첫 결혼 평균 나이(결혼 경험자) — 55세 기준과 46세 기준',
    values: {
      by55_white: 24.7,
      by55_black: 27.0,
      by55_hispanic: 24.1,
      by55_all: 24.9,
      by55_men: 26.1,
      by55_women: 23.7,
      by46_nonBlackNonHispanic: 24.2,
      by46_black: 26.2,
      by46_hispanic: 23.8,
    },
    unit: 'proportion',
    population: 'NLSY79, 결혼 경험자(55세 또는 46세까지 결혼한 사람)',
    cohortFit: 'exact',
    source: `${NLSY79_55} · ${NLSY79_46}, Table 3`,
    url: NLSY79_55_URL,
    howToMeasure:
      '값의 단위는 나이(년) — unit 필드 제약상 proportion으로 적었다. 55세(또는 46세)까지 결혼한 사람의 첫 결혼 나이 산술평균(중앙값 아님). ' +
      '관측 상한(55/46세)에서 절단되므로 모델도 같은 상한으로 절단해 평균낸다. 46세 표의 비흑인·비히스패닉 범주는 백인+기타(아시아계 등)를 포함한다 — ' +
      '모델에서 white+other를 합쳐 비교. 흑인의 늦은 결혼(+2.3년)은 평균이 아니라 늦게 결혼하는 사람이 많아진 결과여야 한다.',
  },
  {
    id: 'raceMarriage.by46',
    kind: 'conditional',
    description: '인종별 46세까지의 결혼·이혼·재혼(남녀 합산) — 55세 표의 중간 검증점',
    values: {
      everMarried_nonBlackNonHispanic: 0.904,
      everMarried_black: 0.683,
      everMarried_hispanic: 0.846,
      everDivorced_nonBlackNonHispanic: 0.4,
      everDivorced_black: 0.331,
      everDivorced_hispanic: 0.393,
      divorcedAmongMarried_nonBlackNonHispanic: 0.442,
      divorcedAmongMarried_black: 0.484,
      divorcedAmongMarried_hispanic: 0.465,
      firstMarriageEndsInDivorce_nonBlackNonHispanic: 0.437,
      firstMarriageEndsInDivorce_black: 0.479,
      firstMarriageEndsInDivorce_hispanic: 0.455,
      remarriedAfterDivorce_nonBlackNonHispanic: 0.686,
      remarriedAfterDivorce_black: 0.524,
      remarriedAfterDivorce_hispanic: 0.548,
    },
    unit: 'proportion',
    population: 'NLSY79 46세 시점, 남녀 합산. nonBlackNonHispanic = 백인 + 기타',
    cohortFit: 'exact',
    source: `${NLSY79_46}, Table 3`,
    url: NLSY79_46_URL,
    howToMeasure:
      '46세 생일 시점, 분모 정의는 raceMarriage.by55와 같다. 모델의 white+other를 합쳐 nonBlackNonHispanic과 비교. ' +
      '본문: 흑인의 결혼 경험 비율은 1950–55년생 77.6%에서 NLSY79 코호트 68.3%로 떨어졌다 — 코호트 간 하락도 구조(성비·남성 소득) 변화에서 나와야 한다.',
  },
  {
    id: 'raceMarriage.neverMarriedByAge',
    kind: 'conditional',
    description: '인종별·성별 25/35/45세 시점 미혼(결혼 경험 없음) 비율 — 결혼 타이밍 곡선',
    values: {
      white_25: 0.447,
      white_35: 0.153,
      white_45: 0.1,
      black_25: 0.65,
      black_35: 0.403,
      black_45: 0.329,
      hispanic_25: 0.445,
      hispanic_35: 0.207,
      hispanic_45: 0.164,
      men_25: 0.561,
      men_35: 0.225,
      men_45: 0.163,
      women_25: 0.388,
      women_35: 0.158,
      women_45: 0.11,
    },
    unit: 'proportion',
    population: 'NLSY79, 해당 나이 생존·응답자. 인종 행은 남녀 합산, 성별 행은 인종 합산(교차표 없음)',
    cohortFit: 'exact',
    source: `${NLSY79_46}, Table 5 (Marital history at selected ages by gender, race, and Hispanic or Latino ethnicity)`,
    url: NLSY79_46_URL,
    howToMeasure:
      '각 나이 생일 시점에 한 번도 결혼하지 않은 비율(분모 = 그 나이의 해당 집단 전체). 인종 행은 남녀 합산이므로 모델도 합산. ' +
      '1 − never_45 ≈ raceMarriage.by46.everMarried와 대략 맞아야 한다(흑인 67.1% 대 68.3%, 히스패닉 83.6% 대 84.6%, 백인 90.0% 대 90.4%) — 내부 정합성 확인됨.',
    unverified:
      'WebFetch 요약 모델 경유. 인종 행의 35·45세 값은 2–3번의 서로 다른 질의에서 일치했지만, 첫 질의는 인종×성별로 쪼갠 존재하지 않는 표를 만들어냈고 ' +
      '25세 값과 성별 행은 한 번만 받았다. 원 표 대조 전까지 허용오차 ±2%p.',
  },
  {
    id: 'separationToDivorce.byRace',
    kind: 'conditional',
    description: '별거한 여성이 3년 안에 이혼으로 가는 비율 — 인종별',
    values: { white: 0.91, hispanic: 0.77, black: 0.67 },
    unit: 'proportion',
    population: '미국 여성 15–44세(1995 NSFG) — 대략 1950–80년생',
    cohortFit: 'close',
    source: 'CDC/NCHS press release on Bramlett & Mosher (2002), Cohabitation, Marriage, Divorce, and Remarriage in the United States, Vital Health Stat 23(22)',
    url: 'https://archive.cdc.gov/www_cdc_gov/media/pressrel/r020724.htm',
    howToMeasure:
      '첫 결혼에서 별거(동거 종료)가 시작된 여성 중 36개월 안에 법적 이혼이 성립한 비율. 흑인·히스패닉은 장기 별거로 머무는 비율이 높다 — ' +
      '모델이 이혼 비용(법률비·재산 분할의 이득이 작음)이나 재혼 가능성 경로로 이것을 만들어야 한다. 백인 91%는 marriage.ts에도 언급 — 여기서는 인종 비교가 목적.',
  },

  // ---- 동거 ----
  {
    id: 'cohabitation.byRace.nsfg2002',
    kind: 'conditional',
    description: '인종별 동거 경험, 첫 (혼전) 동거가 3년 안에 결혼으로 가는 확률',
    values: {
      everCohabited_women_white: 0.51,
      everCohabited_women_black: 0.51,
      everCohabited_women_hispanic: 0.49,
      everCohabited_men_white: 0.49,
      everCohabited_men_black: 0.53,
      everCohabited_men_hispanic: 0.47,
      cohabToMarriage3y_women_white: 0.59,
      cohabToMarriage3y_women_black: 0.31,
      cohabToMarriage3y_women_hispanic: 0.41,
      cohabToMarriage3y_men_white: 0.59,
      cohabToMarriage3y_men_black: 0.52,
      cohabToMarriage3y_men_hispanic: 0.38,
    },
    unit: 'proportion',
    population: '미국 15–44세 남녀(2002 NSFG) — 1958–87년생',
    cohortFit: 'distant',
    source: 'NCHS, Goodwin, Mosher & Chandra (2010), Marriage and Cohabitation in the United States: A Statistical Portrait Based on Cycle 6 (2002) of the NSFG, Series 23 No. 28',
    url: 'https://www.cdc.gov/nchs/data/series/sr_23/sr23_028.pdf',
    howToMeasure:
      'everCohabited: 조사 시점 15–44세 전원 중 한 번이라도 이성과 동거한 비율 — 나이 구성이 어리므로 모델은 1957–64년생의 30–44세 시점 값과 비교하지 말고, ' +
      '세계의 2002년 횡단면(15–44세 전 코호트)이 있을 때만 직접 비교. 코호트 모델만 있으면 "인종 간 동거 경험 차이가 거의 없다"는 방향만 검증(null에 가까움). ' +
      'cohabToMarriage3y: 첫 동거 시작 후 36개월 안에 같은 상대와 결혼한 누적 확률(생명표). 핵심 대비: 흑인 여성은 동거는 똑같이 하지만 결혼으로 덜 간다 — ' +
      '결혼 문턱(남성 소득·안정성)의 구조 경로에서 나와야 한다.',
    unverified:
      '동거 경험 남성 값(53/49/47%)은 본문 문장으로 확인. 여성 동거 경험과 3년 내 결혼 확률은 요약 모델이 그림(Figure 7, 19, 20)에서 읽은 값 — 원 표 대조 필요.',
  },

  // ---- 혼외 출산: 인종별 ----
  {
    id: 'births.nonmaritalShareByRace',
    kind: 'conditional',
    description: '출생 중 혼외 출생 비율 — 산모 인종·히스패닉 여부별, 연도별',
    values: {
      nhWhite_1980: 0.095,
      nhWhite_1990: 0.169,
      nhWhite_1995: 0.212,
      nhWhite_2000: 0.221,
      nhBlack_1980: 0.572,
      nhBlack_1990: 0.667,
      nhBlack_1995: 0.7,
      nhBlack_2000: 0.687,
      hispanic_1980: 0.236,
      hispanic_1990: 0.367,
      hispanic_1995: 0.408,
      hispanic_2000: 0.427,
      asianPI_1980: 0.073,
      asianPI_1990: 0.132,
      asianPI_1995: 0.163,
      asianPI_2000: 0.148,
      amIndian_1990: 0.536,
      all_1990: 0.28,
    },
    unit: 'proportion',
    population: '미국 전체 출생(인구동태통계), 산모 인종 기준',
    cohortFit: 'close',
    source: HUS_2016_T4,
    url: HUS_2016_T4_URL,
    howToMeasure:
      '횡단면(그 해 모든 산모) 값이다. 모델: 세계의 1957–64년생 여성이 해당 연도 ±2년에 낳은 출생 중 출생 시점 비혼 비율을 인종별로(분모 = 그 인종 코호트 여성의 출생). ' +
      '코호트 여성은 1990년에 26–33세라 전체 산모보다 나이가 많고, 나이 든 산모일수록 혼외 비율이 낮으므로 모델 값이 표보다 약간 낮은 것이 정상 — 허용오차 넓게, ' +
      '인종 간 순서와 비(흑인/백인 ≈ 4배, 히스패닉/백인 ≈ 2배)를 우선 검증. 1980년 히스패닉 값은 히스패닉 출생 보고 주(州)만의 값. "other" 인종은 아시아·태평양계 값과 비교.',
  },
  {
    id: 'firstBirth.premaritalByRace',
    kind: 'conditional',
    description: '첫 출생의 혼전 출생·혼전 임신 비율과, 혼전 임신 중 출생 전에 결혼한 비율 — 인종별, 첫 출생 시기별',
    values: {
      white_1980to84_bornBeforeMarriage: 0.213,
      white_1980to84_conceivedBeforeBornAfter: 0.137,
      white_1980to84_marriedBeforeBirthGivenPremaritalConception: 0.391,
      white_1985to89_bornBeforeMarriage: 0.246,
      white_1985to89_conceivedBeforeBornAfter: 0.12,
      white_1985to89_marriedBeforeBirthGivenPremaritalConception: 0.328,
      white_1990to94_bornBeforeMarriage: 0.324,
      white_1990to94_conceivedBeforeBornAfter: 0.129,
      white_1990to94_marriedBeforeBirthGivenPremaritalConception: 0.285,
      black_1980to84_bornBeforeMarriage: 0.712,
      black_1980to84_conceivedBeforeBornAfter: 0.056,
      black_1980to84_marriedBeforeBirthGivenPremaritalConception: 0.073,
      black_1985to89_bornBeforeMarriage: 0.733,
      black_1985to89_conceivedBeforeBornAfter: 0.049,
      black_1985to89_marriedBeforeBirthGivenPremaritalConception: 0.063,
      black_1990to94_bornBeforeMarriage: 0.769,
      black_1990to94_conceivedBeforeBornAfter: 0.087,
      black_1990to94_marriedBeforeBirthGivenPremaritalConception: 0.102,
      hispanic_1980to84_bornBeforeMarriage: 0.367,
      hispanic_1980to84_conceivedBeforeBornAfter: 0.098,
      hispanic_1980to84_marriedBeforeBirthGivenPremaritalConception: 0.211,
      hispanic_1985to89_bornBeforeMarriage: 0.36,
      hispanic_1985to89_conceivedBeforeBornAfter: 0.12,
      hispanic_1985to89_marriedBeforeBirthGivenPremaritalConception: 0.25,
      hispanic_1990to94_bornBeforeMarriage: 0.402,
      hispanic_1990to94_conceivedBeforeBornAfter: 0.142,
      hispanic_1990to94_marriedBeforeBirthGivenPremaritalConception: 0.261,
    },
    unit: 'proportion',
    population: '첫 출생 당시 15–29세 여성(CPS 1995년 6월 출산력 부가조사), 첫 출생 시기별',
    cohortFit: 'close',
    source: P23_197,
    url: P23_197_URL,
    howToMeasure:
      '분모 = 해당 시기에 15–29세로 첫 아이를 낳은 여성. bornBeforeMarriage = 첫 결혼 전 출생. conceivedBeforeBornAfter = 결혼 후 짧은 기간(센서스 정의: 대략 7개월 이내) 안에 출생 — 혼전 임신, 혼인 중 출생(정확한 개월 기준은 원문 미확인). ' +
      'marriedBeforeBirthGivenPremaritalConception = conceivedBeforeBornAfter ÷ (bornBeforeMarriage + conceivedBeforeBornAfter) — "속도위반 결혼" 확률로, ' +
      '모델의 임신 → 출생 전 결혼 전이 해저드를 직접 보정한다. 1957–64년생 여성의 첫 출생은 대부분 1980–94년이고 30세 이상 첫 출생은 표에서 빠지므로 ' +
      '모델도 첫 출생 나이 15–29세로 제한. 세 값 사이 항등식이 모든 셀에서 맞음을 확인(예: 백인 1990–94: 12.9 ÷ 45.3 = 28.5%). ' +
      '원문 요약(Guttmacher 다이제스트): 혼전 출생+혼전 임신 합계 1990–94년 흑인 86%, 히스패닉 54%, 백인 45%; 혼전 임신 중 출생 전 결혼 비율은 전체 1970–74년 49% → 1990–94년 23%.',
  },
  {
    id: 'births.nonmaritalCohabitingShareByRace',
    kind: 'directional',
    description: '혼외 출생 중 동거 커플의 몫 — 인종별(방향만)',
    values: { nhWhite_1980to84: 0.2, nhBlack_1980to84: 0.29, hispanic_1980to84: 0.36, nhWhite_1990to94: 0.39, nhBlack_1990to94: 0.4, hispanic_1990to94: 0.48 },
    unit: 'proportion',
    population: '미국 혼외 출생(NSFG 기반, Bumpass & Lu)',
    cohortFit: 'close',
    source: `${NVSR_48_16}, Figure 15`,
    url: NVSR_48_16_URL,
    howToMeasure:
      '혼외 출생 중 출생 달에 부모가 동거 중인 비율을 인종별로. 방향만 검증: (1) 1980–84 → 1990–94 증가의 대부분이 비히스패닉 백인에서 — 본문 문장 확인 ' +
      '("nearly all of this increase was among non-Hispanic white women"), (2) 히스패닉의 동거 출산 비중이 가장 높다. 크기는 쓰지 말 것. ' +
      '전체값(29%, 39%)은 social.ts births.nonmaritalCohabitingShare.',
    unverified:
      '요약 모델이 그림에서 읽은 값이며 내부 모순이 있다: 1990–94년 세 인종 값이 모두 ≥39%인데 전체가 39% — 불가능. 원 그림/Bumpass & Lu (2000) 표 대조 필요.',
  },
  {
    id: 'nonmaritalBirth.parentRelationship',
    kind: 'conditional',
    description: '혼외 출생 시점 부모 관계 — 동거 / 비동거 연인(방문) / 친구·연락 거의 없음, 인종별',
    values: {
      all_cohabiting: 0.51,
      all_visiting: 0.31,
      all_friends: 0.08,
      all_littleOrNoContact: 0.09,
      white_cohabiting: 0.675,
      white_visiting: 0.161,
      white_notRomantic: 0.164,
      black_cohabiting: 0.335,
      black_visiting: 0.494,
      black_notRomantic: 0.171,
      hispanic_cohabiting: 0.559,
      hispanic_visiting: 0.261,
      hispanic_notRomantic: 0.18,
      marriedEachOtherBy1y_all: 0.091,
      marriedEachOtherBy1y_givenCohabitingAtBirth: 0.15,
      stillCohabitingAt1y_givenCohabitingAtBirth: 0.6,
      motherThinksMarriageChance50plus: 0.74,
    },
    unit: 'proportion',
    population: 'Fragile Families 기준조사: 1998–2000년 인구 20만 이상 미국 도시의 혼외 출생(산모 대부분 1970년대생)',
    cohortFit: 'distant',
    source:
      `Fragile Families baseline national report (McLanahan et al. 2003), Table 2 (all_*, 74%) · ${FF_UNION} (인종별 분포와 1년 추적)`,
    url: 'https://ffcws.princeton.edu/sites/g/files/toruqf4356/files/nationalreport.pdf',
    howToMeasure:
      '세계의 혼외 출생(출생 달 산모 비혼) 중, 그 달 생물학적 아버지와의 관계: 동거 / 동거 아닌 연인(짧은 만남 모듈의 비동거 관계) / 관계 없음. 인종은 산모 기준. ' +
      '이것이 "짧은 만남(비동거 단기 관계)"을 보정하는 핵심 적률 — 혼외 출생의 약 1/3이 비동거 연인 관계에서 나오고, 흑인 산모에서는 절반. ' +
      'marriedEachOtherBy1y = 혼외 출생 후 12개월 안에 두 부모가 서로 결혼한 비율. ' +
      '코호트 불일치: 1998–2000년 대도시 출생이라 Roy 코호트의 1980–90년대 혼외 출생보다 동거 비중이 높을 것(1980–84년 전체 동거 비중 29%, 1990–94년 39% — social.ts). ' +
      '모델은 1990년대 코호트 여성의 혼외 출생으로 측정하고 동거 비중은 NSFG 추세 쪽에 가중, 인종 간 순서(백인 동거 > 히스패닉 > 흑인, 흑인 방문 관계 최다)를 우선 검증.',
    unverified:
      '인종별 값은 이 에이전트가 계산한 파생값: Carlson et al. Table 1의 관계 상태별 인종 구성(동거: 백인 23.8/흑인 31.5/히스패닉 39.9%, 방문 7.9/64.5/25.9, 비연인 16.2/45.2/36.0)과 ' +
      '상태 분포(분석 표본 N=3,285 중 동거 48.2/방문 34.7/비연인 17.2%, 비가중 표본 수로 계산)에 베이즈 규칙을 적용. 가중치 여부 미확인. ' +
      '구성비의 역산 합계가 표의 인종 전체 비율(17.4/44.3/34.8)과 ±1%p로 맞아 정합성은 확인. 1년 추적 값은 본문 요약 경유.',
  },

  // ---- 완결 출산력 ----
  {
    id: 'fertility.completedByRace',
    kind: 'conditional',
    description: '40–44세 여성의 무자녀 비율과 평균 출생아 수 — 인종·히스패닉 여부별',
    values: {
      childless_2002_all: 0.179,
      childless_2002_nhWhite: 0.185,
      childless_2002_black: 0.192,
      childless_2002_asianPI: 0.168,
      childless_2002_hispanic: 0.131,
      childrenEverBorn_2002_all: 1.93,
      childrenEverBorn_2002_nhWhite: 1.842,
      childrenEverBorn_2002_black: 1.991,
      childrenEverBorn_2002_asianPI: 1.974,
      childrenEverBorn_2002_hispanic: 2.437,
      childless_2004_all: 0.193,
      childless_2004_nhWhite: 0.2,
      childless_2004_black: 0.213,
      childless_2004_asian: 0.178,
      childless_2004_hispanic: 0.138,
      childrenEverBorn_2004_all: 1.895,
      childrenEverBorn_2004_nhWhite: 1.811,
      childrenEverBorn_2004_black: 1.938,
      childrenEverBorn_2004_asian: 1.923,
      childrenEverBorn_2004_hispanic: 2.301,
    },
    unit: 'proportion',
    population: 'CPS 6월 출산력 부가조사, 40–44세 여성: 2002년(1957–62년생), 2004년(1959–64년생)',
    cohortFit: 'exact',
    source:
      'U.S. Census Bureau, Fertility of American Women: June 2002 (P20-548) 및 June 2004 (P20-555), 인종·히스패닉 여부별 출산 지표 표',
    url: 'https://www.census.gov/content/dam/Census/library/publications/2005/demo/p20-555.pdf',
    howToMeasure:
      '세계의 1957–64년생 여성(주인공·NPC 전원)을 42세 생일 시점에서: 무자녀 = 출생아 0명 비율, childrenEverBorn = 여성 1인당 평균 출생아 수(값은 명 — 1,000명당 값을 1,000으로 나눔). ' +
      '분모 = 해당 인종 여성 전체(무자녀 포함). 2002년 표 URL: https://www.census.gov/content/dam/Census/library/publications/2003/demo/p20-548.pdf . ' +
      '해석: 흑인 여성의 평균 출생아는 백인보다 약간 많지만 무자녀 비율은 비슷하거나 높다 — 출산의 "몰림"(무자녀 + 다자녀 공존), 히스패닉은 무자녀가 적고 평균이 높다. ' +
      'CPS 자기 보고라 혼외·이전 관계 출생 과소 보고 가능(특히 흑인). "other"는 아시아(태평양) 값과 비교.',
  },
  {
    id: 'births.multiPartnerFertilityByRace',
    kind: 'conditional',
    description: '둘 이상의 상대와 아이를 낳은 비율 — 인종별',
    values: {
      nlsy79MothersTwoPlus_black: 0.59,
      nlsy79MothersTwoPlus_hispanic: 0.35,
      nlsy79MothersTwoPlus_white: 0.22,
      nlsy79MothersTwoPlus_all: 0.28,
      sipp2014Mothers_white: 0.147,
      sipp2014Mothers_black: 0.296,
      sipp2014Mothers_hispanic: 0.193,
      sipp2014Mothers_asian: 0.068,
      sipp2014Fathers_white: 0.129,
      sipp2014Fathers_black: 0.282,
      sipp2014Fathers_hispanic: 0.158,
      sipp2014Fathers_asian: 0.074,
      sipp2014Mothers_age40to49: 0.209,
      sipp2014Fathers_age40to49: 0.163,
    },
    unit: 'proportion',
    population: 'NLSY79 여성 중 자녀 2명 이상인 어머니(27년 추적, Dorius) · SIPP 2014 부모 전체(연령 혼합, 인종은 "alone")',
    cohortFit: 'exact',
    source:
      'Dorius (2011), University of Michigan News 보도(NLSY79 여성 약 4,000명) · Monte (2017), Multiple Partner Fertility in the United States: A Demographic Portrait, Census SEHSD-WP2017-45, Table 5',
    url: 'https://news.umich.edu/?p=8338',
    howToMeasure:
      '보정 적률은 nlsy79MothersTwoPlus_*: 45세 시점에 자녀 2명 이상인 코호트 여성 중 아이 아버지가 둘 이상인 비율, 인종별. 전체값 28%는 social.ts의 mothersTwoPlus와 같다(중복 아님 — 여기서는 인종 분해). ' +
      'SIPP 2014(URL: https://www.census.gov/content/dam/Census/library/publications/2017/demo/SEHSD-WP2017-45.pdf)는 분모 = 자녀가 있는 부모 전체(자녀 1명 포함), 연령 혼합이라 ' +
      '인종 순서·흑인/백인 비(≈2배)만 검증. 아버지 값은 과소 보고로 하한.',
    unverified: 'Dorius 값은 대학 보도자료(2차 요약) — 원 논문(PAA 2011) 미확인. 보도 문구는 확인.',
  },

  // ---- 이인종/이민족 결혼(동질혼) ----
  {
    id: 'intermarriage.1980',
    kind: 'conditional',
    description: '배우자가 다른 인종·민족인 비율 — 1980년 기혼자 전체와 신혼부부, 인종·성별',
    values: {
      allMarried_1980: 0.03,
      newlyweds_1980: 0.07,
      newlyweds_white_1980: 0.04,
      newlyweds_black_1980: 0.05,
      newlyweds_blackMen_1980: 0.08,
      newlyweds_blackWomen_1980: 0.03,
      newlyweds_metro_1980: 0.08,
      newlyweds_nonMetro_1980: 0.05,
    },
    unit: 'proportion',
    population: '미국 기혼자(1980 센서스 IPUMS), 신혼부부 = 지난 1년 안에 결혼',
    cohortFit: 'close',
    source: PEW_INTERMARRIAGE,
    url: PEW_INTERMARRIAGE_URL,
    howToMeasure:
      '인종·민족 범주는 white/black/hispanic/asian/other 다섯 개(히스패닉-비히스패닉 백인 결혼도 이인종으로 셈). ' +
      '모델: 1978–1982년에 성립한 모든 결혼(재혼 포함) 중 배우자 인종이 다른 비율 — 전체, 본인 인종별(분모 = 그 인종 신혼 개인), 흑인은 성별로. ' +
      '흑인 남성 8% 대 흑인 여성 3%의 성 비대칭은 흑인 여성의 결혼 시장을 더 좁히는 구조 요인(성비 불균형과 결합)이라 반드시 재현. ' +
      '1980년에는 학력별 이인종 결혼 차이가 거의 없었다(본문) — null 검증. LA는 대도시 값(8%)보다 높을 것이나 LA 1980 값은 미확보.',
  },
  // ---- 성 파트너 ----
  {
    id: 'sexPartners.lifetime',
    kind: 'marginal',
    description: '평생 이성 성 파트너 수 중앙값 — 30–44세, 성별',
    values: { medianMen30to44_low: 6, medianMen30to44_high: 8, medianWomen30to44: 4 },
    unit: 'proportion',
    population: '미국 30–44세 남녀(2002 NSFG) — 1958–72년생, Roy 코호트 일부 포함',
    cohortFit: 'close',
    source: 'NCHS, Mosher, Chandra & Jones (2005), Sexual Behavior and Selected Health Measures: Men and Women 15–44 Years of Age, 2002, Advance Data No. 362',
    url: 'https://www.cdc.gov/nchs/data/ad/ad362.pdf',
    howToMeasure:
      '값의 단위는 명. 본문: "Males 30–44 years of age reported an average (median) of 6–8 female sexual partners in their lifetimes. Among women 30–44 years of age, the median number of male sexual partners in their lifetimes was about 4." ' +
      '모델: 1957–64년생의 40세 시점, 성관계가 있었던 서로 다른 상대 수(결혼·동거·연애·짧은 만남·외도 전부)의 중앙값. 남성의 과대/여성의 과소 보고 때문에 남녀 중앙값이 다르다 — ' +
      '모델 세계에서는 이성 관계의 총 수가 남녀 같아야 하므로, 남녀 평균이 크게 다르면 안 되고 중앙값 목표는 약 5(4–6)로 둔다(분포의 꼬리 차이는 가능). ' +
      '인종별 분포(15명 이상: 흑인 남성 ≈34%, 백인 남성 ≈22%, 히스패닉 남성 ≈18% 등)는 그림 값이라 미확인 — 쓰지 않음.',
  },
];

/**
 * 결혼 시장의 구조 사실 — 적률이 아니라 메커니즘 근거·방향 검증용. 필드마다 출처와 URL.
 * 이 값들로 인종 계수를 만들지 말 것: 성비·남성 고용·수감이 경로다.
 */
export const PARTNERSHIP_STRUCTURE_FACTS = {
  /**
   * 결혼 가능 남성 지수(Wilson 개념)의 현대 측정: 25–34세 미혼 여성 100명당 취업 미혼 남성 수.
   * 전체 1960년 139 → 2012년 91. 흑인 2012년 51, 1960년 "거의 90".
   * 모델: 세계의 인종별 25–34세 취업 미혼 남성 ÷ 미혼 여성(수감자는 분자에서 빠짐)이 1985–95년에 흑인에서 크게 낮아야 한다.
   * 1980–90년대 값은 미확보(방향만). 출처: Pew Research Center (2014), Record Share of Americans Have Never Married.
   */
  employedNeverMarriedMenPer100NeverMarriedWomen25to34: {
    all_1960: 139,
    all_2012: 91,
    black_2012: 51,
    black_1960_approx: 90,
    source: 'Pew Research Center (2014), Record Share of Americans Have Never Married',
    url: 'https://www.pewresearch.org/social-trends/2014/09/24/record-share-of-americans-have-never-married/',
    unverified: 'black_1960_approx는 "nearly 90"이라는 본문 표현.',
  },
  /** 25세 이상 미혼(결혼 경험 없음) 비율 — 인종별 장기 추세. 같은 Pew (2014). */
  neverMarriedAge25plus: {
    black_1960: 0.09,
    black_2012: 0.36,
    white_1960: 0.08,
    white_2012: 0.16,
    hispanic_1980: 0.12,
    hispanic_2012: 0.26,
    asian_1980: 0.13,
    asian_2012: 0.19,
    source: 'Pew Research Center (2014), Record Share of Americans Have Never Married',
    url: 'https://www.pewresearch.org/social-trends/2014/09/24/record-share-of-americans-have-never-married/',
  },
  /**
   * 수감 → 결혼 시장: 수감 증가가 인종×지역×나이로 정의된 결혼 시장에서 여성의 결혼 확률을 낮추고,
   * 배우자 "질"을 약간 낮추며, 결혼의 이득을 남성 쪽으로 옮겼다. 영향받은 시장의 여성은 학업·노동 공급을 늘렸다.
   * 모델: 결혼 시장을 인종×지역×나이로 짜고, 수감 중인 남성을 후보에서 빼면 이 방향이 저절로 나와야 한다.
   * 효과 크기(퍼센트포인트)는 초록에 없어 미확보 — 방향만.
   */
  incarcerationMarriageMarket: {
    direction: 'higherMaleIncarceration_lowersWomenMarriage_raisesWomenSchoolingAndWork' as const,
    source: 'Charles & Luoh (2010), Male Incarceration, the Marriage Market, and Female Outcomes, Review of Economics and Statistics 92(3):614–627 (초록)',
    url: 'https://ideas.repec.org/a/tpr/restat/v92y2010i3p614-627.html',
    unverified: '효과 크기 미확보(본문 접근 실패: MIT Press 403, ResearchGate 429).',
  },
  /** 흑인의 결혼 경험 코호트 하락: 1950–55년생 77.6% → NLSY79(1957–64년생) 68.3%(46세까지). */
  blackEverMarriedCohortDecline: {
    born1950to55: 0.776,
    born1957to64: 0.683,
    source: NLSY79_46,
    url: NLSY79_46_URL,
  },
  /**
   * 비혼 여성 출산율(15–44세 비혼 여성 1,000명당): 1970년 흑인 96 대 백인 14(약 7배) → 1998년 흑인 73 대 백인 38(2배 미만).
   * 혼외 출생 비중의 인종 격차 축소는 흑인 비혼 출산율 하락 + 백인 상승, 그리고 흑인의 결혼 감소(분모 효과)의 합.
   * 모델은 비중(births.nonmaritalShareByRace)만이 아니라 이 비율 쪽 분해도 맞아야 "결혼이 줄어서"와 "비혼 출산이 늘어서"를 구분한다.
   */
  nonmaritalBirthRatePer1000: {
    black_1970: 96,
    white_1970: 14,
    black_1998: 73,
    white_1998: 38,
    source: NVSR_48_16,
    url: NVSR_48_16_URL,
  },
  /**
   * 혼전 임신 후 출생 전 결혼("속도위반 결혼")의 붕괴 — 전체 여성(15–29세 첫 출생): 1970–74년 49% → 1990–94년 23%.
   * 인종별 값은 RACE_FAMILY_MOMENTS의 firstBirth.premaritalByRace. 출처: Guttmacher PSRH 다이제스트(P23-197 요약).
   */
  shotgunMarriageDecline: {
    marriedBeforeBirthGivenPremaritalConception_1970to74: 0.49,
    marriedBeforeBirthGivenPremaritalConception_1990to94: 0.23,
    source: 'Guttmacher Institute, Family Planning Perspectives digest (2000), Women Aged 15–29 Are Increasingly Having First Children Before Marriage (Bachu 1999 요약)',
    url: 'https://www.guttmacher.org/journals/psrh/2000/03/women-aged-15-29-are-increasingly-having-first-children-marriage',
  },
} as const;
