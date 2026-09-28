import type { CalibrationMoment } from './marriage';

/**
 * 건강·원인별 사망 모듈(src/sim/health)의 보정 목표와 구조 상수.
 *
 * 원칙은 다른 data 파일과 같다: 원문(1차·공식 출처)에서 확인한 숫자만 그대로, 요약본·보도자료·그림에서 읽은 값은
 * `unverified`. 이 파일의 숫자는 2026-09 웹 조회(표·초록 텍스트 추출)로 확인했다 — PMC·PubMed·NEJM·Health Affairs
 * 일부는 접근이 막혀 기관 저장소·CDC 페이지로 대체했고, 그런 경우 `unverified`에 적었다.
 *
 * 단위: `CalibrationMoment.unit` 열거형에 '년'과 '10만 명당 비율'이 없다. 기대수명(년)과 사망률(10만 명당)은
 * `unit: 'proportion'`으로 두고 각 적률의 description/howToMeasure에 실제 단위를 적었다(social.ts의 network.size와
 * 같은 편법). 모듈의 moments.ts는 id 접두어(`lifeExpectancy.*` = 년, `mortality.*`/`*.rate*` = 10만 명당)로 구분할 것.
 *
 * 인종 격차 원칙(REALISM_V2): 인종은 해저드에 직접 곱하지 않는다. 소득·학력·동네·흡연·비만·의료 접근 경로가 만든
 * 격차를 아래 인종별 적률과 비교하고, 남는 차이(설명 안 된 잔차)는 보고한다. 히스패닉 역설(소득이 낮은데 기대수명이
 * 높음)은 경로만으로는 재현되지 않을 가능성이 높다 — 잔차로 드러나야 하며 억지로 맞추지 않는다.
 *
 * 코호트: 1957–64년생(NLSY79). 25–44세 ≈ 1982–2008, 45–64세 ≈ 2002–2028, 65세+ ≈ 2022–. 대부분의 적률은 기간
 * (period) 값이라 코호트 모델과 비교할 때는 "그 해에 그 나이였던 합성 코호트"를 잘라 쓴다. 전체 사망 수준은
 * lifeTables.ts(SSA 코호트 생명표)가 이미 맞추므로, 여기의 적률은 수준이 아니라 기울기·원인 구성·추세다.
 */

const HUS2017 = 'NCHS, Health, United States, 2017 — Trend Tables';
const hus = (n: string): string => `https://www.cdc.gov/nchs/data/hus/2017/${n}.pdf`;
const NHIS_SHS2018 = 'NCHS, Summary Health Statistics: National Health Interview Survey, 2018';
const shs = (t: string): string => `https://ftp.cdc.gov/pub/Health_Statistics/NCHS/NHIS/SHS/2018_SHS_Table_${t}.pdf`;

const CHETTY = 'Chetty, Stepner, Abraham et al. (2016), The Association Between Income and Life Expectancy in the United States, 2001–2014, JAMA 315(16)';
const CHETTY_URL = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4866586/';
const CASE_DEATON_2015 = 'Case & Deaton (2015), Rising morbidity and mortality in midlife among white non-Hispanic Americans in the 21st century, PNAS 112(49)';
const CASE_DEATON_2015_URL = 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4679063/';

export const HEALTH_MOMENTS: readonly CalibrationMoment[] = [
  // ======================= 사망 기울기: 소득 =======================
  {
    id: 'lifeExpectancy.at40.byIncomePercentile',
    kind: 'conditional',
    description: '40세 기대 사망 나이(년) — 가구 소득 백분위 최하위 1% 대 최상위 1%, 성별',
    values: {
      male_p1: 72.7,
      male_p100: 87.3,
      female_p1: 78.8,
      female_p100: 88.9,
      gap_male: 14.6,
      gap_female: 10.1,
    },
    unit: 'proportion',
    population: '미국 40–76세, 1999–2014 세금 기록 × SSA 사망(14억 인년), 인종·민족 보정',
    cohortFit: 'close',
    source: CHETTY,
    url: CHETTY_URL,
    howToMeasure:
      '단위: 년(기대 사망 나이 = 40 + 잔여수명). 모델: 1957–64년생의 40세 시점(1997–2004) 가구 소득(같은 해·같은 성의 백분위)으로 묶고, 40세 이후 모의 사망 나이 평균. 원 논문은 기간 생명표 방식(2001–14 연령별 사망률을 90세 이후 Gompertz 외삽)이라 코호트 모델보다 미래 개선이 빠져 있다 — 수준보다 기울기(p100−p1, 그리고 p1 위에서 "대략 선형")를 맞출 것. 인종 보정값이므로 모델도 인종 구성을 백분위 안에서 표준화해 비교. 원문: 최하위 1% 남성의 기대수명은 수단·파키스탄 40세 남성 평균과 비슷.',
  },
  {
    id: 'lifeExpectancy.at40.trendByIncome',
    kind: 'conditional',
    description: '2001–2014년 40세 기대수명의 연간 증가(년/년) — 소득 상위 5% 대 하위 5%',
    values: { male_top5_perYear: 0.18, female_top5_perYear: 0.22, male_bottom5_perYear: 0.02, female_bottom5_perYear: 0.003 },
    unit: 'proportion',
    population: '미국 40–76세, 2001–2014',
    cohortFit: 'close',
    source: CHETTY,
    url: CHETTY_URL,
    howToMeasure:
      '단위: 년/년. 누적: 상위 5% 남 +2.34년·여 +2.91년, 하위 5% 남 +0.32년·여 +0.04년. 모델: 소득 백분위별 40세 잔여수명을 2001년과 2014년 기간 사망률로 계산해 기울기 비교(코호트 모델이면 1961·1974년생 40세 비교가 근사). 코호트 생명표의 전체 개선을 소득 상위에 몰아주는 구조(흡연 감소·의료 혜택의 기울기)가 있어야 재현된다.',
  },
  // ======================= 사망 기울기: 학력 =======================
  {
    id: 'lifeExpectancy.at25.byEducation',
    kind: 'directional',
    description: '25세 기대 사망 나이 — 고졸 초과 대 고졸 이하, 2000년; 1990년대 증가분',
    values: { moreThanHS_2000: 82, hsOrLess_2000: 75, gain1990to2000_moreThanHS: 1.6, gain1990to2000_hsOrLess: 0 },
    unit: 'proportion',
    population: '미국 25세 이상(NLMS × MCOD), 1990–2000',
    cohortFit: 'close',
    source: 'Meara, Richards & Cutler (2008), The Gap Gets Bigger: Changes in Mortality and Life Expectancy, by Education, 1981–2000, Health Affairs 27(2) — ScienceDaily 보도자료 요약',
    url: 'https://www.sciencedaily.com/releases/2008/03/080311081149.htm',
    howToMeasure:
      '단위: 년. 모델: 2000년 기간 사망률(모의 인구의 2000년 나이별 사망)을 학력(고졸 이하/그 이상)별로 생명표로 만들어 25세 잔여수명. 1990→2000: 고학력 +1.6년, 저학력 거의 0(여성 저학력은 오히려 약간 감소). 1980년대→1990년대: 고학력 약 +1.5년, 저학력 +0.5년. 흑·백 모두 같은 방향. 학력 구성이 바뀌면(저학력 집단이 작고 더 선택됨) 격차가 부풀려진다는 비판이 있다 — 방향·대략 크기만.',
    unverified: '원 논문(Health Affairs) 접근 차단 — 대학 보도자료 요약의 반올림 값. 방향 검증용.',
  },
  {
    id: 'lifeExpectancy.birth.raceEducationExtremes.2008',
    kind: 'directional',
    description: '출생 기대수명 격차(년) — 16년 이상 교육 백인 대 12년 미만 교육 흑인, 2008',
    values: { gap_male: 14.2, gap_female: 10.3 },
    unit: 'proportion',
    population: '미국 2008년 기간 사망률(학력은 사망진단서)',
    cohortFit: 'close',
    source: 'Olshansky et al. (2012), Differences in Life Expectancy Due to Race and Educational Differences Are Widening, and Many May Not Catch Up, Health Affairs 31(8) — Johns Hopkins 기관 저장소 초록',
    url: 'https://pure.johnshopkins.edu/en/publications/differences-in-life-expectancy-due-to-race-and-educational-differ-3/',
    howToMeasure:
      '단위: 년. 인종 × 학력 양 끝 칸의 격차 — 모델에서는 인종 직접 효과 없이 학력·소득·동네 경로만으로 이 격차의 대부분이 나와야 한다. 사망진단서 학력 기재 오류 때문에 저학력 사망률이 과대라는 비판이 있다(격차 상한으로 취급).',
    unverified: '초록을 요약 도구로 읽음(원문 PDF 미확인). 수치 자체는 초록의 핵심 문장.',
  },
  // ======================= 인종별 기대수명 =======================
  {
    id: 'lifeExpectancy.birth.byRaceSex',
    kind: 'conditional',
    description: '출생 기대수명(년) — 인종·성별, 1980–2019(2010년부터 히스패닉 구분)',
    values: {
      white_male_1980: 70.7, white_female_1980: 78.1, black_male_1980: 63.8, black_female_1980: 72.5,
      white_male_1990: 72.7, white_female_1990: 79.4, black_male_1990: 64.5, black_female_1990: 73.6,
      white_male_2000: 74.7, white_female_2000: 79.9, black_male_2000: 68.2, black_female_2000: 75.1,
      nhWhite_male_2010: 76.4, nhWhite_female_2010: 81.1, nhBlack_male_2010: 71.5, nhBlack_female_2010: 77.7,
      hispanic_male_2010: 78.8, hispanic_female_2010: 84.3,
      nhWhite_male_2019: 76.3, nhWhite_female_2019: 81.3, nhBlack_male_2019: 71.3, nhBlack_female_2019: 78.1,
      hispanic_male_2019: 79.1, hispanic_female_2019: 84.4, nhAsian_male_2019: 83.5, nhAsian_female_2019: 87.4,
    },
    unit: 'proportion',
    population: '미국 전체, 기간 생명표',
    cohortFit: 'close',
    source: `${HUS2017}, Table 15 (1980–2010) · NCHS, United States Life Tables, 2019, NVSR 70(19) (2019)`,
    url: hus('015'),
    howToMeasure:
      '단위: 년, 기간(period) 값 — 출생 기대수명은 1957–64년생 코호트의 사망과 직접 대응하지 않는다(그 해 모든 나이의 사망률). 모델 비교는 나이별 사망률 비(흑/백)를 25–64세에서 맞추는 쪽(mortality.allCause.byAgeRaceMale)이 우선이고, 이 값은 세계 인구 전체를 돌렸을 때의 방향·크기 점검용. 1990년 흑인 남성 64.5(AIDS·살인 정점) → 2010 71.5의 반등이 원인별 사망에서 나와야 한다. 히스패닉 역설: 2010·2019 히스패닉이 비히스패닉 백인보다 2.4–3년 길다 — 경로(소득·학력)만으로는 반대 방향이 나올 것이므로 잔차로 보고. 2019 값 출처 URL: https://www.cdc.gov/nchs/data/nvsr/nvsr70/nvsr70-19.pdf',
  },
  {
    id: 'lifeExpectancy.at65.byRaceSex',
    kind: 'conditional',
    description: '65세 잔여 기대수명(년) — 인종·성별',
    values: {
      white_male_1990: 15.2, black_male_1990: 13.2, white_female_1990: 19.1, black_female_1990: 17.2,
      white_male_2000: 16.1, black_male_2000: 14.1, white_female_2000: 19.1, black_female_2000: 17.5,
      nhWhite_male_2016: 18.0, nhBlack_male_2016: 16.2, hispanic_male_2016: 19.7,
      nhWhite_female_2016: 20.5, nhBlack_female_2016: 19.5, hispanic_female_2016: 22.7,
      nhWhite_male_2019: 18.1, nhBlack_male_2019: 16.3, hispanic_male_2019: 19.9, nhAsian_male_2019: 22.1,
    },
    unit: 'proportion',
    population: '미국 전체, 기간 생명표',
    cohortFit: 'close',
    source: `${HUS2017}, Table 15 · NCHS NVSR 70(19)`,
    url: hus('015'),
    howToMeasure:
      '단위: 년. 모델: 코호트가 65세가 되는 2022–29년 근처가 대상이지만 관측이 없다 — 2016/2019 값을 방향 목표로(흑백 격차는 출생 기대수명보다 훨씬 작다: 약 2년). 격차가 노년에 줄어드는 것(선택적 생존)을 경로 모델이 재현하는지 확인.',
  },
  {
    id: 'lifeExpectancy.at45.byRaceSex.2019',
    kind: 'conditional',
    description: '45세 잔여 기대수명(년), 2019 — 인종·히스패닉·성별',
    values: {
      nhWhite_male: 34.3, nhWhite_female: 38.0, nhBlack_male: 31.0, nhBlack_female: 35.9,
      hispanic_male: 36.7, hispanic_female: 40.9, nhAsian_male: 39.9, nhAsian_female: 43.3,
    },
    unit: 'proportion',
    population: '미국 2019년 기간 생명표',
    cohortFit: 'close',
    source: 'NCHS, United States Life Tables, 2019, NVSR 70(19)',
    url: 'https://www.cdc.gov/nchs/data/nvsr/nvsr70/nvsr70-19.pdf',
    howToMeasure:
      '단위: 년. 2019년에 45세 = 1974년생이라 코호트보다 12년 늦다. 모델: 1957–64년생의 2019년(55–62세) 이후 사망에 쓰이는 나이별 사망률 비(흑/백, 히스패닉/백)를 비교하고, 45세 잔여수명 자체는 방향 점검. 히스패닉 우위는 잔차로 보고.',
  },
  // ======================= 나이·인종별 전체 사망률 =======================
  {
    id: 'mortality.allCause.byAgeRaceMale',
    kind: 'conditional',
    description: '남성 전체 원인 사망률(10만 명당) — 나이·인종, 1980/1990/2000',
    values: {
      white_25to34_1980: 171.3, black_25to34_1980: 407.3, white_25to34_1990: 176.1, black_25to34_1990: 430.8,
      white_25to34_2000: 124.1, black_25to34_2000: 261.0,
      white_35to44_1980: 257.4, black_35to44_1980: 689.8, white_35to44_1990: 268.2, black_35to44_1990: 699.6,
      white_35to44_2000: 233.6, black_35to44_2000: 453.0,
      white_45to54_1990: 548.7, black_45to54_1990: 1261.0, white_45to54_2000: 496.9, black_45to54_2000: 1017.7,
      white_55to64_2000: 1163.3, black_55to64_2000: 2080.1,
      femaleWhite_45to54_2000: 281.4, femaleBlack_45to54_2000: 588.3,
    },
    unit: 'proportion',
    population: '미국 전체 거주 인구, 인종은 히스패닉 포함 백인/흑인',
    cohortFit: 'exact',
    source: `${HUS2017}, Table 21 (Death rates for all causes, by sex, race, Hispanic origin, and age)`,
    url: hus('021'),
    howToMeasure:
      '단위: 10만 명당 연간 사망. 1990년 25–34세 = 1956–65년생 → 코호트와 정확히 겹친다(2000년 35–44세, 2010년 45–54세도 마찬가지). 모델: 해당 연도·나이 칸의 모의 사망 수 / 인년 × 10만. 핵심 목표는 흑/백 비: 25–44세 1990년 약 2.4–2.6배 → 2000년 약 1.9–2.1배, 45–54세 약 2.0–2.3배. 이 비가 소득·학력·동네·흡연·살인·AIDS 경로로 얼마나 설명되는지 분해하고 잔차를 보고. 히스패닉 칸은 추출 시 열이 어긋나 보여 제외했다.',
    unverified: 'PDF 표를 요약 도구로 추출 — 백인/흑인 1980–2000 칸은 공표 기대수명과 정합적이나 행 대조는 사람이 한 번 더 할 것.',
  },
  // ======================= 원인 구성 =======================
  {
    id: 'causeOfDeath.shareByAge',
    kind: 'marginal',
    description: '나이대별 사망 원인 구성(전체 사망 중 비율) — 1980과 2016, 상위 5개 원인 + 기타',
    values: {
      a25to44_1980_unintentionalInjury: 0.246, a25to44_1980_cancer: 0.162, a25to44_1980_heart: 0.134,
      a25to44_1980_homicide: 0.101, a25to44_1980_suicide: 0.091, a25to44_1980_other: 0.267,
      a25to44_2016_unintentionalInjury: 0.332, a25to44_2016_cancer: 0.109, a25to44_2016_suicide: 0.106,
      a25to44_2016_heart: 0.103, a25to44_2016_homicide: 0.065, a25to44_2016_other: 0.286,
      a45to64_1980_heart: 0.349, a45to64_1980_cancer: 0.319, a45to64_1980_stroke: 0.047,
      a45to64_1980_unintentionalInjury: 0.043, a45to64_1980_liver: 0.038, a45to64_1980_other: 0.205,
      a45to64_2016_cancer: 0.292, a45to64_2016_heart: 0.209, a45to64_2016_unintentionalInjury: 0.084,
      a45to64_2016_chronicLowerRespiratory: 0.041, a45to64_2016_liver: 0.04, a45to64_2016_other: 0.334,
      a65plus_1980_heart: 0.444, a65plus_1980_cancer: 0.193, a65plus_1980_stroke: 0.109,
      a65plus_2016_heart: 0.253, a65plus_2016_cancer: 0.211, a65plus_2016_chronicLowerRespiratory: 0.065,
      a65plus_2016_stroke: 0.061, a65plus_2016_alzheimers: 0.057, a65plus_2016_other: 0.352,
    },
    unit: 'proportion',
    population: '미국 전체 사망(남녀 합)',
    cohortFit: 'close',
    source: `${HUS2017}, Table 20 (Leading causes of death and numbers of deaths, by age: 1980 and 2016)`,
    url: hus('020'),
    howToMeasure:
      '공표 사망 수를 나이대 전체 사망으로 나눠 계산(예: 2016년 25–44세 총 135,408 중 비의도 손상 44,959). 2016년 45–64세 = 1952–71년생으로 코호트와 겹친다. 1980년 25–44세는 1936–55년생(코호트보다 이르다). 모델: 코호트의 45–64세 사망(2002–2028) 원인 분포를 2016 값과, 25–44세(1982–2008) 분포는 1980과 2016 사이(그리고 1990년대 중반엔 HIV가 1위 — hiv.mortality.25to44.1994)로 비교. "비의도 손상"에는 약물 과다(우발적 중독)가 포함 — 2016년 25–44세의 급등은 대부분 과다 복용. 남녀 합이므로 모델도 합산.',
  },
  {
    id: 'hiv.mortality.25to44.1994',
    kind: 'conditional',
    description: '1994년 25–44세 HIV 사망 — 인종·성별 사망률(10만 명당)과 원인 순위·비중',
    values: {
      rate_whiteMen: 47.2, rate_blackMen: 177.9, rate_whiteWomen: 5.7, rate_blackWomen: 51.2,
      share_allMen: 0.23, share_whiteMen: 0.2, share_blackMen: 0.32, share_allWomen: 0.11, share_blackWomen: 0.22, share_whiteWomen: 0.06,
    },
    unit: 'proportion',
    population: '미국 25–44세, 1994년 잠정 사망 자료(히스패닉 별도 없음)',
    cohortFit: 'exact',
    source: 'CDC (1996), Update: Mortality Attributable to HIV Infection Among Persons Aged 25–44 Years — United States, 1994, MMWR 45(6)',
    url: 'https://www.cdc.gov/mmwr/preview/mmwrhtml/00040227.htm',
    howToMeasure:
      'rate_* 단위: 10만 명당, share_*: 그 집단 전체 사망 중 비율. 1994년 25–44세 = 1950–69년생 — 코호트(32–37세)가 한가운데. HIV는 25–44세 남성 사망 1위(백인·흑인 모두), 여성 3위(흑인 여성 1위, 백인 여성 5위). 1996년 이후 HAART로 급감(모델: 1996 이후 치명률을 크게 낮춤). 감염 위험은 인종 직접 효과가 아니라 동네 유병률·주사 약물·성적 관계망 경로로. LA는 유행 중심지 중 하나라 Roy 주변 효과가 크다.',
  },
  {
    id: 'mortality.homicide.byRaceSexAge',
    kind: 'conditional',
    description: '남성 살인 피해 사망률(10만 명당) — 인종·나이',
    values: {
      white_15to24_1980: 15.1, white_15to24_1990: 15.2, white_15to24_2000: 9.9, white_15to24_2016: 8.2,
      black_15to24_1980: 82.6, black_15to24_1990: 137.1, black_15to24_2000: 85.3, black_15to24_2016: 81.4,
      white_25to44_1980: 17.2, white_25to44_1990: 13.0, white_25to44_2000: 7.4, white_25to44_2016: 8.4,
      black_25to44_1980: 130.0, black_25to44_1990: 105.4, black_25to44_2000: 55.8, black_25to44_2016: 70.4,
      ageAdj_white_1990: 8.3, ageAdj_black_1990: 63.1,
    },
    unit: 'proportion',
    population: '미국 남성(인종은 히스패닉 포함)',
    cohortFit: 'exact',
    source: `${HUS2017}, Table 29 (Death rates for homicide, by sex, race, Hispanic origin, and age)`,
    url: hus('029'),
    howToMeasure:
      '단위: 10만 명당 연간. 코호트는 1980년 16–23세, 1990년 26–33세 — 흑인 남성 15–24세 정점(1990 137.1, 크랙 시기)은 코호트보다 조금 아래 세대, 25–44세 칸이 코호트. 모델: 해당 연도·나이 칸 모의 살인 피해 / 인년. 격차(흑/백 약 8배)는 인종 직접 효과가 아니라 동네 폭력 노출(동네 지수 × 연도별 도시 폭력 추세) × 나이 × 성에서 나와야 한다 — 설명 안 된 부분은 잔차 보고. crime 모듈과 공유. 히스패닉 칸은 추출이 어긋나 제외.',
    unverified: 'PDF 표를 요약 도구로 추출 — 백인/흑인 칸만 사용.',
  },
  {
    id: 'mortality.suicide.byRaceSexAge',
    kind: 'conditional',
    description: '남성 자살 사망률(10만 명당) — 인종·나이, 1980–2016',
    values: {
      white_25to44_1990: 25.4, white_25to44_2000: 22.9, white_25to44_2010: 26.2, white_25to44_2016: 29.2,
      black_25to44_1990: 19.6, black_25to44_2000: 14.3, black_25to44_2016: 16.4,
      white_45to64_1990: 26.0, white_45to64_2000: 23.2, white_45to64_2010: 33.0, white_45to64_2016: 33.2,
      black_45to64_1990: 13.1, black_45to64_2000: 9.9, black_45to64_2016: 9.6,
    },
    unit: 'proportion',
    population: '미국 남성(인종은 히스패닉 포함)',
    cohortFit: 'exact',
    source: `${HUS2017}, Table 30 (Death rates for suicide, by sex, race, Hispanic origin, and age)`,
    url: hus('030'),
    howToMeasure:
      '단위: 10만 명당. 코호트가 45–64세에 드는 2007–2016에 백인 중년 남성 자살이 2000년 23 → 33으로 오른다(절망사). 흑인 남성은 백인보다 낮다 — 경로(소득 낮음)만으로 만들면 반대 방향이 나오므로 자살 해저드는 우울·실직·이혼·총기 접근·알코올에서 오고 인종별 기저 차이는 잔차로 보고. 모델: 연도·나이 칸 모의 자살 / 인년.',
  },
  {
    id: 'mortality.motorVehicle.byRaceSexAge',
    kind: 'conditional',
    description: '남성 자동차 관련 사망률(10만 명당) — 인종·나이',
    values: {
      all_15to24_1980: 68.4, all_25to34_1990: 35.7, all_35to44_2000: 22.0, all_45to64_2010: 17.9,
      white_15to24_1980: 73.8, white_25to34_1990: 35.4, white_35to44_2000: 21.8, white_45to64_2010: 18.3,
      black_15to24_1980: 34.9, black_25to34_1990: 39.5, black_35to44_2000: 27.2, black_45to64_2010: 19.1,
    },
    unit: 'proportion',
    population: '미국 남성',
    cohortFit: 'exact',
    source: `${HUS2017}, Table 28 (Death rates for motor vehicle-related injuries)`,
    url: hus('028'),
    howToMeasure:
      '단위: 10만 명당. 코호트가 지나가는 대각선(1980 15–24 → 1990 25–34 → 2000 35–44 → 2010 45–64)만 골랐다. Roy(1962 LA)의 18–22세(1980–84) 교통사고가 젊은 남성 외인사 1위 — 과음·나이·기간 추세(음주운전 단속·안전벨트)로. 모델: 대각선 칸의 모의 교통사고 사망 / 인년.',
    unverified: 'PDF 표를 요약 도구로 추출.',
  },
  {
    id: 'mortality.drugOverdose.2019',
    kind: 'marginal',
    description: '약물 과다 사망률(10만 명당, 연령 표준화) — 2019, 성별; 1999 대비',
    values: { all_2019: 21.6, male_1999: 8.2, male_2019: 29.6, female_1999: 3.9, female_2019: 13.7, age35to44_2019: 40.5 },
    unit: 'proportion',
    population: '미국 전체',
    cohortFit: 'close',
    source: 'Hedegaard, Miniño, Warner (2020), Drug Overdose Deaths in the United States, 1999–2019, NCHS Data Brief No. 394',
    url: 'https://www.cdc.gov/nchs/products/databriefs/db394.htm',
    howToMeasure:
      '단위: 10만 명당. 2019년 코호트는 55–62세(35–44세 최고 칸보다 늙음). 모델: 연령 표준화는 2000 표준 인구로, 코호트 칸은 2019년 55–64세 모의 과다 사망과 비교(원문 나이별 값 미확보 — gap). 1999→2019 3.6배 증가는 처방 오피오이드(1999–2010) → 헤로인(2010–) → 펜타닐(2013–) 3파동의 기간 효과 × 저학력·실직·통증.',
  },
  {
    id: 'deathsOfDespair.midlifeWhite.1999to2013',
    kind: 'conditional',
    description: '45–54세 비히스패닉 백인 사망률 변화(10만 명당), 1999→2013 — 학력별·원인별, 다른 집단과 비교',
    values: {
      allCause_change: 33.9,
      hsOrLess_change: 134.4,
      someCollege_change: -3.3,
      baPlus_change: -57.0,
      poisoning_change: 22.2,
      suicide_change: 9.5,
      liver_change: 5.3,
      nhBlack_allCause_change: -214.8,
      hispanic_allCause_change: -63.6,
      fairPoorHealth_change_pp: 4.3,
      unableToWork_change_pp: 4.5,
    },
    unit: 'proportion',
    population: '미국 45–54세 비히스패닉 백인(학력은 사망진단서), 1999–2013',
    cohortFit: 'exact',
    source: CASE_DEATON_2015,
    url: CASE_DEATON_2015_URL,
    howToMeasure:
      '단위: 10만 명당 변화(마지막 둘은 %p). 1999년 45–54세 = 1945–54년생, 2013년 = 1959–68년생 → 코호트가 2013년 칸의 주인. 모델: 1999년과 2013년 45–54세 비히스패닉 백인 모의 사망률 차이를 학력(고졸 이하/대학 중퇴/학사+)별로. 저학력 +134 대 학사 −57의 발산이 핵심. 같은 기간 흑인·히스패닉은 계속 감소 — 인종 효과가 아니라 저학력 백인 코호트의 노동시장·가족 경로(누적 불이익) + 오피오이드 공급 기간 효과로 나와야 한다. 원 논문 Table 1 수준값(고졸 이하 1999 601.4 → 2013 735.8)은 요약 추출이라 변화량만 적률로 쓴다.',
  },
  {
    id: 'deathsOfDespair.white50to54.hsOrLess',
    kind: 'conditional',
    description: '50–54세 고졸 이하 비히스패닉 백인 사망률 대 비히스패닉 흑인 전체(10만 명당), 1999 → 2015',
    values: { whiteHsOrLess_1999: 722, whiteHsOrLess_2015: 927, blackAll_1999: 945, blackAll_2015: 703 },
    unit: 'proportion',
    population: '미국 50–54세',
    cohortFit: 'exact',
    source: 'Case & Deaton (2017), Mortality and Morbidity in the 21st Century, Brookings Papers on Economic Activity (Spring)',
    url: 'https://www.brookings.edu/wp-content/uploads/2017/08/casetextsp17bpea.pdf',
    howToMeasure:
      '단위: 10만 명당. 2015년 50–54세 = 1961–65년생 — Roy 본인의 칸. 1999년 저학력 백인은 흑인 전체보다 약 30% 낮았고 2015년엔 약 30% 높다(역전). 모델: 두 해의 50–54세 칸, 백인은 고졸 이하만, 흑인은 학력 전체. Roy가 고졸 이하 백인으로 사는 경로의 핵심 목표.',
    unverified: 'Brookings PDF를 요약 도구로 읽음 — 네 숫자와 "30% 낮음→30% 높음" 서술은 일치하나 그림/표 원 위치 미대조.',
  },
  // ======================= 위험 행동 =======================
  {
    id: 'smoking.current.byAgeSex',
    kind: 'marginal',
    description: '현재 흡연율 — 성·나이, 1985–2016',
    values: {
      male_25to34_1985: 0.382, male_25to34_1990: 0.316, male_35to44_1990: 0.345, male_35to44_2000: 0.302,
      male_45to64_2000: 0.264, male_45to64_2010: 0.232, male_45to64_2016: 0.193,
      female_25to34_1985: 0.32, female_25to34_1990: 0.282, female_35to44_2000: 0.262, female_45to64_2010: 0.191,
      whiteMale_ageAdj_1990: 0.276, blackMale_ageAdj_1990: 0.328, whiteMale_ageAdj_2010: 0.214, blackMale_ageAdj_2010: 0.233,
      whiteFemale_ageAdj_1990: 0.235, blackFemale_ageAdj_1990: 0.208,
    },
    unit: 'proportion',
    population: 'NHIS 18세 이상 성인',
    cohortFit: 'exact',
    source: `${HUS2017}, Table 47 (Current cigarette smoking among adults aged 18 and over, by sex, race, and age)`,
    url: hus('047'),
    howToMeasure:
      '코호트 대각선(1985 25–34 → 1990 25–34/35–44 → 2000 35–44 → 2010 45–64)으로 비교. 모델: 해당 연도에 그 나이인 모의 인구 중 흡연 상태=현재. 흡연 시작(10대 후반)과 중단 해저드(나이·학력·기간 추세·건강 충격)를 보정. 흑인 남성은 1985년 더 높지만 이후 격차 축소 — 흑인 여성은 백인 여성보다 낮다(방향).',
    unverified: 'PDF 표를 요약 도구로 추출 — 일부 여성 행 라벨이 어긋나 보여 25세 이상 칸만 사용.',
  },
  {
    id: 'smoking.current.byEducation',
    kind: 'conditional',
    description: '25세 이상 현재 흡연율(연령 표준화) — 학력·성별, 1995–2016',
    values: {
      male_lessThanHS_1995: 0.397, male_hs_1995: 0.327, male_someCollege_1995: 0.237, male_baPlus_1995: 0.138,
      male_lessThanHS_2010: 0.297, male_hs_2010: 0.293, male_someCollege_2010: 0.232, male_baPlus_2010: 0.087,
      female_lessThanHS_1995: 0.317, female_hs_1995: 0.264, female_someCollege_1995: 0.216, female_baPlus_1995: 0.133,
      female_lessThanHS_2010: 0.237, female_hs_2010: 0.249, female_someCollege_2010: 0.196, female_baPlus_2010: 0.079,
      all_baPlus_2016: 0.065, all_lessThanHS_2016: 0.26,
    },
    unit: 'proportion',
    population: 'NHIS 25세 이상, 연령 표준화',
    cohortFit: 'exact',
    source: `${HUS2017}, Table 48 (Age-adjusted prevalence of current cigarette smoking among adults aged 25 and over, by sex, race, and education level)`,
    url: hus('048'),
    howToMeasure:
      '1995년 코호트는 31–38세. 모델: 25세 이상 모의 인구를 2000 표준 인구로 연령 표준화하거나, 코호트만 보려면 같은 해 코호트의 학력별 흡연율과 비교(허용오차 넓게). 핵심: 학사+ 흡연은 1995→2010 약 40% 감소, 고졸은 거의 그대로 — 중단 해저드의 학력 기울기.',
  },
  {
    id: 'smoking.status.2018',
    kind: 'conditional',
    description: '흡연 상태(현재/과거/비흡연) — 나이·학력, 2018',
    values: {
      current_45to64: 0.163, former_45to64: 0.234, never_45to64: 0.604,
      current_65to74: 0.11, former_65to74: 0.37, never_65to74: 0.521,
      current_baPlus: 0.057, former_baPlus: 0.21, current_hs: 0.227, former_hs: 0.251, current_lessThanHS: 0.236, former_lessThanHS: 0.196,
      current_male: 0.156, former_male: 0.248,
    },
    unit: 'proportion',
    population: 'NHIS 2018 성인(나이별은 조율, 학력은 25세+ 연령 표준화)',
    cohortFit: 'exact',
    source: `${NHIS_SHS2018}, Table A-12a`,
    url: shs('A-12'),
    howToMeasure:
      '2018년 코호트는 54–61세(45–64세 칸). 모델: 2018년 코호트의 흡연 상태 분포. 과거 흡연/(현재+과거) = 중단 비율 — 45–64세 약 59%, 학사+ 약 79%, 고졸 약 53%. 이 중단 비율이 학력별 사망 격차의 큰 몫을 설명해야 한다.',
  },
  {
    id: 'obesity.trend',
    kind: 'marginal',
    description: '비만(BMI≥30) 유병률 — 20–74세 연령 표준화, NHANES 조사 주기별·성별',
    values: {
      all_1976to80: 0.15, male_1976to80: 0.127, female_1976to80: 0.17,
      all_1988to94: 0.232, male_1988to94: 0.205, female_1988to94: 0.259,
      all_1999to2000: 0.309, male_1999to2000: 0.277, female_1999to2000: 0.34,
      all_2009to10: 0.361, male_2009to10: 0.359, female_2009to10: 0.361,
      all_2017to18: 0.428, male_2017to18: 0.435, female_2017to18: 0.421,
    },
    unit: 'proportion',
    population: 'NHANES 20–74세(측정 BMI), 연령 표준화',
    cohortFit: 'close',
    source: 'Fryar, Carroll & Afful (2020), Prevalence of Overweight, Obesity, and Severe Obesity Among Adults Aged 20 and Over: 1960–1962 Through 2017–2018, NCHS Health E-Stats',
    url: 'https://www.cdc.gov/nchs/data/hestat/obesity-adult-17-18/obesity-adult.htm',
    howToMeasure:
      '측정 BMI(자기 보고 아님). 기간 추세가 압도적 — 코호트는 1976–80에 12–23세, 1988–94에 24–37세, 2017–18에 53–61세. 모델: BMI 궤적 = 나이 증가 + 기간 환경 이동(1980년대부터 급상승) + 학력·소득 기울기. 연령 표준화 없이 비교하려면 obesity.byAgeRaceSex.2017to18의 40–59세 칸을 쓸 것. 고도 비만(≥40): 1960–62 0.9% → 2017–18 9.6%.',
  },
  {
    id: 'obesity.byAgeRaceSex.2017to18',
    kind: 'conditional',
    description: '비만 유병률 2017–2018 — 나이·인종·성별(20세 이상)',
    values: {
      age20to39: 0.4, age40to59: 0.448, age60plus: 0.428,
      nhWhite_male: 0.447, nhWhite_female: 0.398, nhBlack_male: 0.411, nhBlack_female: 0.569,
      hispanic_male: 0.457, hispanic_female: 0.437, nhAsian_male: 0.175, nhAsian_female: 0.172,
      severe_all: 0.092, severe_male: 0.069, severe_female: 0.115,
    },
    unit: 'proportion',
    population: 'NHANES 2017–2018, 20세 이상(인종별은 연령 표준화)',
    cohortFit: 'exact',
    source: 'Hales, Carroll, Fryar & Ogden (2020), Prevalence of Obesity and Severe Obesity Among Adults: United States, 2017–2018, NCHS Data Brief No. 360',
    url: 'https://www.cdc.gov/nchs/products/databriefs/db360.htm',
    howToMeasure:
      '코호트(53–61세)는 40–59세·60세+ 칸. 모델: 2017–18년 모의 BMI≥30 비율. 흑인 여성의 높은 비만(57%)과 흑인 남성이 백인 남성보다 낮은 점(41 대 45)이 함께 나와야 한다 — 소득 경로만이면 흑인 남성도 높게 나올 것이므로 성별 차이는 잔차로 보고.',
  },
  {
    id: 'alcohol.drinkingStatus.2018',
    kind: 'conditional',
    description: '음주 상태 — 성·나이·학력, 2018(현재 정기 음주 = 지난 1년 12회 이상)',
    values: {
      currentRegular_male: 0.599, currentRegular_female: 0.473, lifetimeAbstainer_male: 0.153,
      currentRegular_45to64: 0.535, currentRegular_65to74: 0.45,
      currentRegular_lessThanHS: 0.338, currentRegular_hs: 0.472, currentRegular_someCollege: 0.544, currentRegular_baPlus: 0.66,
      lifetimeAbstainer_lessThanHS: 0.314, lifetimeAbstainer_baPlus: 0.131,
    },
    unit: 'proportion',
    population: 'NHIS 2018 성인(연령 표준화)',
    cohortFit: 'exact',
    source: `${NHIS_SHS2018}, Table A-13a`,
    url: shs('A-13'),
    howToMeasure:
      '음주 "여부"는 학력과 양의 관계(학사+ 66% 대 고졸 미만 34%) — 흡연과 반대. 그러나 알코올 사망(간경변·알코올 중독)은 저학력에 몰린다: 모델은 음주 여부와 과음(폭음) 강도를 분리해야 한다. 과음 유병률은 이 표에 없음(gap).',
  },
  // ======================= 만성 질환 =======================
  {
    id: 'chronic.prevalenceByAge.2018',
    kind: 'marginal',
    description: '의사에게 진단받은 적 있는 만성 질환 — 나이대별, 2018',
    values: {
      hypertension_18to44: 0.088, hypertension_45to64: 0.344, hypertension_65to74: 0.544, hypertension_75plus: 0.611,
      anyHeartDisease_45to64: 0.118, anyHeartDisease_65to74: 0.236, coronaryHD_45to64: 0.06, coronaryHD_65to74: 0.155, coronaryHD_75plus: 0.239,
      stroke_45to64: 0.031, stroke_65to74: 0.069,
      diabetes_18to44: 0.033, diabetes_45to64: 0.129, diabetes_65to74: 0.222, diabetes_75plus: 0.228,
      anyCancer_45to64: 0.096, anyCancer_65to74: 0.222, anyCancer_75plus: 0.313,
      arthritis_45to64: 0.303, arthritis_65to74: 0.483,
      emphysema_45to64: 0.016, emphysema_65to74: 0.041, chronicBronchitis_45to64: 0.045,
      kidneyDisease_65to74: 0.054,
    },
    unit: 'proportion',
    population: 'NHIS 2018 18세 이상(자기 보고 "의사에게 들은 적 있음")',
    cohortFit: 'exact',
    source: `${NHIS_SHS2018}, Tables A-1 (심장·고혈압·뇌졸중), A-2 (호흡기), A-3 (암), A-4 (당뇨·관절염·신장)`,
    url: shs('A-1'),
    howToMeasure:
      '2018년 코호트는 54–61세 → 45–64세 칸이 직접 목표, 65–74세 칸은 2027–2038의 방향. 모델: 모의 인구의 "진단 누적(ever)" 상태 — 발병 해저드를 누적한 유병률이지 발생률이 아니다. 자기 보고라 미진단(당뇨의 약 1/4)은 빠진다. 암 "ever"는 피부암 일부 포함. 표 URL: A-1/A-2/A-3/A-4 (같은 경로에서 파일명만 다름).',
  },
  {
    id: 'chronic.byEducationIncome.2018',
    kind: 'conditional',
    description: '만성 질환 유병률의 학력 기울기(25세+, 연령 표준화), 2018',
    values: {
      diabetes_lessThanHS: 0.16, diabetes_hs: 0.12, diabetes_someCollege: 0.117, diabetes_baPlus: 0.07,
      hypertension_lessThanHS: 0.321, hypertension_baPlus: 0.227,
      coronaryHD_lessThanHS: 0.082, coronaryHD_baPlus: 0.046,
      stroke_lessThanHS: 0.051, stroke_baPlus: 0.022,
      diabetes_white: 0.086, diabetes_black: 0.131, diabetes_hispanic: 0.132,
      hypertension_white: 0.239, hypertension_black: 0.322,
    },
    unit: 'proportion',
    population: 'NHIS 2018(학력은 25세 이상), 연령 표준화',
    cohortFit: 'close',
    source: `${NHIS_SHS2018}, Tables A-1, A-4`,
    url: shs('A-4'),
    howToMeasure:
      '연령 표준화 값이라 모델도 2000 표준 인구로 가중하거나 45–64세 내부 학력 비(고졸 미만/학사+: 당뇨 2.3배, 고혈압 1.4배, 뇌졸중 2.3배)만 비교. 흑인 고혈압(32 대 24)은 소득·비만·스트레스 경로로 얼마나 나오는지 확인하고 잔차 보고.',
    unverified: '표를 요약 도구로 추출 — 학력 칸 대응(중간 두 칸)은 원표 재대조 필요. 양 끝 칸만 적률로.',
  },
  {
    id: 'diabetes.prevalenceTrend.NHANES',
    kind: 'marginal',
    description: '당뇨 유병률(진단 + 미진단, 검사 기반) — 조사 주기·나이·인종',
    values: {
      total_20plus_1988to94: 0.088, total_20plus_1999to2002: 0.099, total_20plus_2007to10: 0.114, total_20plus_2011to14: 0.119,
      diagnosed_20plus_1988to94: 0.052, diagnosed_20plus_2011to14: 0.09,
      total_45to64_1988to94: 0.14, total_45to64_2007to10: 0.153, total_45to64_2011to14: 0.166,
      diagnosed_45to64_2011to14: 0.123,
      total_nhWhite_2011to14: 0.096, total_nhBlack_2011to14: 0.18, total_mexican_2011to14: 0.18,
    },
    unit: 'proportion',
    population: 'NHANES 20세 이상(전체·인종별 연령 표준화, 나이별 조율)',
    cohortFit: 'exact',
    source: `${HUS2017}, Table 40 (Diabetes prevalence and glycemic control among adults aged 20 and over)`,
    url: hus('040'),
    howToMeasure:
      '2007–14년 코호트는 43–57세 → 45–64세 칸. 모델: 당뇨 발병 상태(진단 여부와 별개) 유병률 — 진단 비율(2011–14 45–64세 약 74%)은 의료 접근(보험) 경로. 흑인·멕시코계 약 2배는 비만·소득 경로 + 잔차.',
    unverified: 'PDF 표를 요약 도구로 추출.',
  },
  // ======================= 건강 상태·장애 =======================
  {
    id: 'selfRatedHealth.fairPoor.2018',
    kind: 'conditional',
    description: '주관적 건강 "보통 이하(fair/poor)" 비율 — 나이·학력·빈곤, 2018',
    values: {
      age18to44: 0.063, age45to64: 0.157, age65to74: 0.194, age75plus: 0.26,
      lessThanHS: 0.252, hs: 0.167, someCollege: 0.131, baPlus: 0.061,
      poor: 0.282, nearPoor: 0.201, notPoor: 0.08,
    },
    unit: 'proportion',
    population: 'NHIS 2018 성인(학력은 25세+, 학력·빈곤은 연령 표준화)',
    cohortFit: 'exact',
    source: `${NHIS_SHS2018}, Table A-11a (Respondent-assessed health status)`,
    url: shs('A-11'),
    howToMeasure:
      '빈곤 = 빈곤선 100% 미만, 근빈곤 = 100–199%, 비빈곤 = 200% 이상. 모델: 건강 자본의 하위 꼬리(임계치 아래) 비율 — 임계치는 45–64세 15.7%에 맞추고, 학력(25 대 6%)·빈곤(28 대 8%) 기울기가 경로에서 나오는지 검증.',
  },
  {
    id: 'disability.physicalDifficulty.2018',
    kind: 'conditional',
    description: '신체 기능 어려움이 하나라도 있는 비율 — 나이·학력·빈곤, 2018',
    values: {
      age18to44: 0.051, age45to64: 0.187, age65to74: 0.3, age75plus: 0.486,
      lessThanHS: 0.257, hs: 0.208, someCollege: 0.18, baPlus: 0.098,
      poor: 0.298, nearPoor: 0.222, notPoor: 0.115,
    },
    unit: 'proportion',
    population: 'NHIS 2018 성인',
    cohortFit: 'exact',
    source: `${NHIS_SHS2018}, Table A-10a (Difficulties in physical functioning)`,
    url: shs('A-10'),
    howToMeasure:
      '"근로 제한 장애"보다 넓은 개념(걷기·계단·물건 들기 등 9개 중 하나라도 어려움). 모델의 근로 제한 장애는 이보다 작아야 한다 — 45–64세 18.7%는 상한. 학력 기울기(2.6배)는 방향 목표.',
  },
  {
    id: 'disability.ssdi.2019',
    kind: 'marginal',
    description: 'SSDI 장애 수급자 — 18–64세 인구 중 비율과 수급 장애 근로자의 나이 분포, 2019년 12월',
    values: {
      beneficiariesShareOfPop18to64: 0.044,
      disabledWorkers_share50to54_men: 0.136, disabledWorkers_share55to59_men: 0.24, disabledWorkers_share60to64_men: 0.329,
    },
    unit: 'proportion',
    population: '미국 SSDI 수급자(2019년 12월, 장애 근로자 8,378,374명)',
    cohortFit: 'close',
    source: 'SSA, Annual Statistical Report on the Social Security Disability Insurance Program, 2019 — Beneficiaries in Current-Payment Status',
    url: 'https://www.ssa.gov/policy/docs/statcomps/di_asr/2019/sect01.html',
    howToMeasure:
      '첫 값은 18–64세 인구 대비 장애 수급자(장애 근로자 외 일부 포함) 비율. 나머지는 남성 장애 근로자 수급자 중 나이대 비중(수급자 대비, 인구 대비 아님 — 55세 이상이 57%). 2019년 코호트 55–62세. 모델: 경력 모델의 장애 상태 × SSDI 신청·승인. 연령별 인구 대비 수급률은 미확보(gap).',
  },
  // ======================= 암·정신 건강 =======================
  {
    id: 'cancer.survival5y.byPeriodRace',
    kind: 'conditional',
    description: '모든 암 5년 상대 생존율 — 진단 시기·인종; 주요 부위',
    values: {
      all_1975to77: 0.49, white_1975to77: 0.5, black_1975to77: 0.39,
      all_1995to97: 0.63, white_1995to97: 0.64, black_1995to97: 0.54,
      all_2012to18: 0.68, white_2012to18: 0.69, black_2012to18: 0.64,
      lung_1975to77: 0.12, lung_2012to18: 0.23, colorectal_1975to77: 0.5, colorectal_2012to18: 0.65,
      prostate_1975to77: 0.68, prostate_2012to18: 0.97, breastFemale_1975to77: 0.75, breastFemale_2012to18: 0.91,
    },
    unit: 'proportion',
    population: 'SEER 등록 지역, 진단 후 추적',
    cohortFit: 'close',
    source: 'American Cancer Society, Cancer Facts & Figures 2023 (SEER 자료)',
    url: 'https://www.cancer.org/content/dam/cancer-org/research/cancer-facts-and-statistics/annual-cancer-facts-and-figures/2023/2023-cancer-facts-and-figures.pdf',
    howToMeasure:
      '상대 생존 = 같은 나이·성 일반 인구 대비 생존. 모델: 암 발병 후 5년 안 암 사망 확률 = 1 − 상대 생존(근사), 진단 연도로 보간(코호트의 암은 대부분 2005년 이후 진단 → 2012–18 값). 흑백 격차(64 대 69)는 진단 병기·보험 접근 경로로. 부위 구성이 시기별로 달라(전립선 PSA 검진) 전체값은 구성 효과 포함.',
  },
  {
    id: 'cancer.lifetimeRisk',
    kind: 'marginal',
    description: '평생(출생–사망) 침습성 암 발생 확률',
    values: { male: 0.409, female: 0.391 },
    unit: 'proportion',
    population: '미국 2017–2019 기간 자료(DevCan)',
    cohortFit: 'close',
    source: 'American Cancer Society, Cancer Facts & Figures 2023, Table 6',
    url: 'https://www.cancer.org/content/dam/cancer-org/research/cancer-facts-and-statistics/annual-cancer-facts-and-figures/2023/2023-cancer-facts-and-figures.pdf',
    howToMeasure:
      '모델: 코호트의 사망 전 암 진단 누적 비율(경쟁 위험 포함). 기간 기반이라 코호트 값과 1–3%p 차이는 허용. 흡연 경로(폐암 RR ~25)가 남성 초과분의 상당 부분.',
  },
  {
    id: 'depression.ncsr',
    kind: 'marginal',
    description: '주요우울장애 평생·12개월 유병률(DSM-IV)',
    values: { lifetime: 0.162, month12: 0.066 },
    unit: 'proportion',
    population: 'NCS-R 2001–2003, 18세 이상 영어 사용 가구원',
    cohortFit: 'close',
    source: 'Kessler et al. (2003), The Epidemiology of Major Depressive Disorder: Results From the National Comorbidity Survey Replication (NCS-R), JAMA 289(23):3095–3105',
    url: 'https://pubmed.ncbi.nlm.nih.gov/12813115/',
    howToMeasure:
      '2001–03년 코호트는 37–46세 — 평생 유병률은 그 나이까지 누적(회고 보고라 과소). 모델: 우울 삽화 해저드(실직·이혼·사별·빈곤이 올림)의 누적 경험 비율(45세 시점)과 12개월 유병. 여성이 약 1.7배. 자살·약물 해저드의 입력.',
    unverified: '원문(PubMed·JAMA·Harvard NCS 표) 접근 실패 — 널리 인용되는 값(16.2%/6.6%)을 기억에 의존해 넣음. 반드시 원문 대조 전까지 약한 가중치.',
  },
];

/**
 * 구조 상수 — 해저드의 곱셈 계수와 사건 크기. 보정 목표가 아니라 모델 구조의 입력(또는 사전 분포의 중심).
 * 출처 URL은 필드마다. 인과 크기가 아닌 연관 크기가 섞여 있으니 주석을 읽을 것.
 */
export const HEALTH_STRUCTURE_FACTS = {
  smoking: {
    /** 현재 흡연 대 비흡연, 25–79세 전체 사망 위험비(NHIS 1997–2004 × NDI 2006). 여성 3.0, 남성 2.8.
     *  Jha et al. (2013) NEJM 368:341 — https://www.dcp-3.org/resources/21st-century-hazards-smoking-and-benefits-cessation-united-states-0 (초록) */
    allCauseHazardRatio: { male: 2.8, female: 3.0 },
    /** 25세에서 79세까지 생존 확률: 비흡연 대 현재 흡연. 남 61% 대 26%, 여 70% 대 38%. 같은 출처. */
    survival25to79: { neverMale: 0.61, currentMale: 0.26, neverFemale: 0.7, currentFemale: 0.38 },
    /** 기대수명 손실 "10년 이상". 같은 출처. */
    lifeExpectancyLossYears: 10,
    /** 금연 나이별 계속 흡연 대비 얻는 수명(년): 25–34세 약 10, 35–44세 약 9, 45–54세 약 6.
     *  40세 전 금연은 계속 흡연의 초과 사망 위험을 약 90% 줄인다. 같은 출처. */
    yearsGainedByQuitAge: { age25to34: 10, age35to44: 9, age45to54: 6 },
    excessRiskAvoidedIfQuitBefore40: 0.9,
    /** 폐암 위험 약 25배; 흡연·간접흡연이 폐암 사망의 약 9/10.
     *  CDC, Cigarettes and Cancer — https://www.cdc.gov/tobacco/about/cigarettes-and-cancer.html */
    lungCancerRelativeRisk: 25,
    lungCancerDeathsAttributable: 0.9,
    /** 관상동맥 심장병 2–4배, 뇌졸중 2–4배; CVD 사망 4건 중 1건이 흡연 원인.
     *  금연 후 1–2년에 심근경색 위험 급감, 3–6년에 CHD 초과 위험 절반, 15년에 비흡연자 수준 근접.
     *  CDC, Cigarettes and Cardiovascular Disease — https://www.cdc.gov/tobacco/about/cigarettes-and-cardiovascular-disease.html */
    chdRelativeRiskRange: [2, 4] as const,
    strokeRelativeRiskRange: [2, 4] as const,
    cvdDeathsAttributable: 0.25,
    chdExcessRiskHalfLifeYears: [3, 6] as const,
    chdExcessRiskGoneYears: 15,
    /** 흡연·간접흡연 사망 연 48만 명 이상. CDC — https://www.cdc.gov/tobacco/about/index.html */
    annualAttributableDeathsUS: 480_000,
  },
  obesity: {
    /** 당뇨 발병 상대 위험(정상 체중 대비), 전향 코호트 18개 메타분석: 비만 7.19(95% CI 5.74–9.00),
     *  과체중 2.99(2.42–3.72). 고품질 연구만: 7.28 / 2.92.
     *  Abdullah et al. (2010), Diabetes Res Clin Pract 89:309 — https://vuir.vu.edu.au/25423/ (초록) */
    diabetesRelativeRisk: { obese: 7.19, overweight: 2.99 },
  },
  jobLoss: {
    /** 고근속 남성 대량 해고 후 1년 사망률 50–100% 증가; 20년 뒤에도 연간 사망 해저드 10–15% 높음;
     *  40세에 실직하면 기대수명 1.0–1.5년 감소. 소득 손실과 연관(건강 선택·위험 산업 아님).
     *  펜실베이니아 1970–80년대 근로자 × SSA 사망 1980–2006.
     *  Sullivan & von Wachter (2009), Job Displacement and Mortality, QJE 124(3):1265 —
     *  https://ideas.repec.org/a/oup/qjecon/v124y2009i3p1265-1306..html (초록) */
    mortalityIncreaseYear1: [0.5, 1.0] as const,
    mortalityIncreaseLongRun: [0.1, 0.15] as const,
    lifeExpectancyLossIfDisplacedAt40: [1.0, 1.5] as const,
  },
  incomeGradient: {
    /** 하위 소득 사분위 기대수명의 지역(통근권) 차이와 건강 행동의 상관: 흡연 r=−0.69, 비만 r=−0.47, 운동 r=0.32.
     *  → 소득 효과의 지역 차이는 행동 경로를 통한다(의료 접근·불평등과는 약한 상관).
     *  Chetty et al. (2016) JAMA — https://pmc.ncbi.nlm.nih.gov/articles/PMC4866586/ */
    bottomQuartileLECorrelation: { smoking: -0.69, obesity: -0.47, exercise: 0.32 },
  },
  hiv: {
    /** 1994년 25–44세 HIV 사망률(10만 명당): 흑인 남 177.9, 백인 남 47.2, 흑인 여 51.2, 백인 여 5.7.
     *  MMWR 45(6) — https://www.cdc.gov/mmwr/preview/mmwrhtml/00040227.htm */
    deathRate1994_25to44: { blackMale: 177.9, whiteMale: 47.2, blackFemale: 51.2, whiteFemale: 5.7 },
  },
} as const;
