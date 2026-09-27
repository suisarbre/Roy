import type { CalibrationMoment } from './marriage';

/**
 * 일과 돈 — 경력·재산 행위자 모델(src/sim/career)의 보정 목표와 세계 사실.
 *
 * 원칙은 marriage.ts와 같다: 원문 HTML 표/초록에서 확인한 숫자만. 확인 못 한 건 방향만(`directional`)
 * 또는 `unverified`. 금액은 시대를 넘어 비교하려고 가능하면 "그 해 평균임금(SSA AWI) 대비 배수"로 바꿔
 * 쓴다(wages.ts의 averageAnnualWageAt).
 *
 * 범위: 지금은 **남성** 경력만 보정한다(Roy와 남성 NPC). 여성의 노동 참여는 결혼·출산과 강하게 얽혀
 * 있어서 결혼 모델과 통합하는 다음 단계에서 넣는다 — 여성 수치는 그때를 위해 같이 적어둔다.
 */

const NLSY79_RELEASE = 'BLS news release, NLSY79 2024 A01 (ages 18–58, 1978–2022)';

export const WORK_MOMENTS: readonly CalibrationMoment[] = [
  // ---- 수준 기준점 ----
  {
    id: 'earnings.menFullTimeMedianToAwi.1999',
    kind: 'marginal',
    description: '남성 풀타임 임금근로자 주급 중앙값 ÷ 그 해 평균임금(AWI) 주당 환산',
    values: { ratio: 618 / (30469.84 / 52) },
    unit: 'proportion',
    population: 'CPS 1999 연평균, 16세 이상 남성 풀타임 임금근로자(자영업 제외)',
    cohortFit: 'close',
    source: 'BLS CPS 1999 annual averages, Table 39 (남성 중앙값 $618) + SSA AWI 1999 $30,469.84',
    url: 'https://www.bls.gov/cps/aa1999/aat39.TXT',
    howToMeasure: '≈1.055. 모델: 학생·자영업 제외 임금근로자 전 연령 합성 횡단면의 임금(AWI 배수) 중앙값. 직업별 임금비(occupations.ts)가 이 값 기준.',
  },
  {
    id: 'selfEmployment.shareMen',
    kind: 'marginal',
    description: '남성 취업자 중 자영업(법인+비법인) 비율',
    values: { share: 0.12 },
    unit: 'proportion',
    population: 'CPS 2015(비법인 남성 7.4%; 자영업의 약 6/10이 비법인) — 1994년 전체 자영업률 12.1%',
    cohortFit: 'distant',
    source: 'BLS Spotlight on Statistics (2016), Self-employment in the United States',
    url: 'https://www.bls.gov/spotlight/2016/self-employment-in-the-united-states/home.htm',
    howToMeasure: '7.4% ÷ 0.6 ≈ 12%로 **유도한 값**(남성 법인 자영업 비율이 전체와 같다는 가정). 모델: 25–58세 취업 개월 중 자영업 비율. 허용오차 넓게.',
  },
  {
    id: 'occupation.distributionMenFullTime.1999',
    kind: 'marginal',
    description: '남성 풀타임 임금근로자의 직업 분포(1999) — 모델 직업 클러스터에 맞춰 묶은 비율',
    values: {
      aerospaceEngineer: 74 / 55181,
      engineer: (1749 - 74) / 55181,
      physician: 389 / 55181,
      nurse: 368 / 55181,
      professor: 397 / 55181,
      teacher: 1130 / 55181,
      lawyer: 412 / 55181,
      otherProfessional: (7556 - 1749 - 389 - 368 - 397 - 1130 - 412) / 55181,
      managerAndBusiness: 7981 / 55181,
      technician: 1802 / 55181,
      salesRep: (5402 - 1475) / 55181,
      retailSales: 1475 / 55181,
      clerical: 3322 / 55181,
      protectiveService: 1791 / 55181,
      foodService: 1583 / 55181,
      mechanic: (10861 - 4059) / 55181,
      constructionTrades: 4059 / 55181,
      operativeAndAerospaceAssembler: 4371 / 55181,
      truckDriver: 2927 / 55181,
      laborer: (3230 + (5209 - 1791 - 1583) + (4083 - 2927)) / 55181,
      farmLabor: 1364 / 55181,
    },
    unit: 'proportion',
    population: 'CPS 1999 연평균, 남성 풀타임 임금근로자 55,181천 명(자영업·군인 제외)',
    cohortFit: 'close',
    source: 'BLS CPS 1999 annual averages, Table 39 — 직업군별 남성 인원(천 명)',
    url: 'https://www.bls.gov/cps/aa1999/aat39.TXT',
    howToMeasure:
      '묶음 규칙: 정비공=정비·수리+정밀가공(기능직 10,861 − 건설 4,059), 영업=판매 전체 − 소매, 인부=하역·잡역 + 기타 서비스(청소 등) + 운반 기계, 트럭=자동차 운전 전체, 경영=경영·관리·경영 관련(회계 포함), 기타 전문직=전문직 − 개별 표시 직업. 항공우주 엔지니어는 표의 74천 명. 모델: 18–64세 임금근로자(학생·군인 제외) 생일 시점 직업 비율. 이 비율은 적률법이 아니라 직업별 제안 가중치의 비례 조정(raking)으로 맞춘다.',
  },
  // ---- 교육 ----
  {
    id: 'education.attainment.age35to39.1999',
    kind: 'marginal',
    description: '35~39세(1960~64년생)의 최종 학력 — 누적 비율',
    values: { highSchoolOrMore: 0.876, someCollegeOrMore: 0.531, bachelorsOrMore: 0.269 },
    unit: 'proportion',
    population: 'CPS 1999년 3월, 35–39세 전체(남녀)',
    cohortFit: 'exact',
    source: 'Census P20-528, Educational Attainment in the United States: March 1999, Table A',
    url: 'https://cps.ipums.org/cps/resources/cpr/p20-528.pdf',
    howToMeasure: '→ 고졸 미만 12.4%, 고졸 34.5%, 대학 중퇴·전문대 26.2%, 대졸 이상 26.9%. 성별 분리 없음(남성 모델과 비교 시 근사).',
  },
  {
    id: 'earnings.meanByEducation.1998',
    kind: 'conditional',
    description: '1998년 학력별 평균 연소득(18세 이상 근로자)',
    values: { lessThanHighSchool: 16053, highSchool: 23594, someCollege: 27566, bachelors: 43782, advanced: 63473 },
    unit: 'proportion',
    population: 'CPS 1999년 3월, 18세 이상 소득자(남녀·시간제 포함)',
    cohortFit: 'close',
    source: 'Census P20-528, Table C',
    url: 'https://cps.ipums.org/cps/resources/cpr/p20-528.pdf',
    howToMeasure: '고졸 대비 배수로 비교: 고졸 미만 0.68, 대학 중퇴 1.17, 대졸 1.86, 대학원 2.69. 남녀·전 연령 평균이라 허용오차 넓게.',
  },
  // ---- 임금 성장 (경력 곡선) ----
  {
    id: 'wageGrowth.byAgeEducation.men',
    kind: 'conditional',
    description: '실질 시급의 연평균 성장률(%) — 남성, 학력 × 나이대',
    values: {
      lessThanHighSchool_18to24: 2.5,
      lessThanHighSchool_25to34: 1.4,
      lessThanHighSchool_35to44: 0.6,
      lessThanHighSchool_45to54: -1.0,
      highSchool_18to24: 5.9,
      highSchool_25to34: 2.3,
      highSchool_35to44: 1.6,
      highSchool_45to54: -0.1,
      someCollege_18to24: 7.0,
      someCollege_25to34: 4.1,
      someCollege_35to44: 1.8,
      someCollege_45to54: 0.1,
      bachelorsOrMore_18to24: 9.6,
      bachelorsOrMore_25to34: 6.2,
      bachelorsOrMore_35to44: 2.7,
      bachelorsOrMore_45to54: 0.5,
    },
    unit: 'proportion',
    population: 'NLSY79 남성(1957–64년생), R-CPI-U-RS로 실질화',
    cohortFit: 'exact',
    source: `${NLSY79_RELEASE}, Table 5`,
    url: 'https://www.bls.gov/news.release/nlsoy.t05.htm',
    howToMeasure: '취업 중인 사람의 연간 실질 시급 로그 변화 평균(이직 포함). 대졸은 젊을 때 빠르게 오르고, 고졸 미만은 거의 안 오른다 — 학력별 경력 곡선의 모양.',
  },
  // ---- 고용 상태 ----
  {
    id: 'employmentStatus.byAge.men',
    kind: 'conditional',
    description: '주 단위 고용 상태 비율 — 남성, 나이대별(취업/실업/비경제활동)',
    values: {
      employed_18to24: 0.724,
      unemployed_18to24: 0.089,
      employed_25to34: 0.885,
      unemployed_25to34: 0.045,
      employed_35to44: 0.888,
      unemployed_35to44: 0.034,
      employed_45to54: 0.836,
      unemployed_45to54: 0.044,
      employed_55to58: 0.768,
      unemployed_55to58: 0.033,
    },
    unit: 'proportion',
    population: 'NLSY79 남성',
    cohortFit: 'exact',
    source: `${NLSY79_RELEASE}, Table 4`,
    url: 'https://www.bls.gov/news.release/nlsoy.t04.htm',
    howToMeasure: '월 단위 상태 비율. 나머지는 비경제활동(학생·장애·조기 은퇴 등). 여성: 전체 취업 72.0%, 실업 3.8%.',
  },
  {
    id: 'employmentStatus.byEducation.men',
    kind: 'conditional',
    description: '18~58세 주 단위 고용 상태 비율 — 남성, 학력별',
    values: {
      employed_lessThanHighSchool: 0.663,
      unemployed_lessThanHighSchool: 0.084,
      employed_highSchool: 0.807,
      unemployed_highSchool: 0.061,
      employed_someCollege: 0.848,
      unemployed_someCollege: 0.042,
      employed_bachelorsOrMore: 0.886,
      unemployed_bachelorsOrMore: 0.026,
    },
    unit: 'proportion',
    population: 'NLSY79 남성',
    cohortFit: 'exact',
    source: `${NLSY79_RELEASE}, Table 3`,
    url: 'https://www.bls.gov/news.release/nlsoy.t03.htm',
    howToMeasure: '고졸 미만 남성은 4분의 1이 비경제활동(25.3%) — 실업보다 노동시장 이탈이 큰 격차를 만든다.',
  },
  {
    id: 'jobDuration.byAgeAtStart.men',
    kind: 'conditional',
    description: '일자리(고용주 관계) 지속 기간 — 시작 나이별 누적 종료 비율, 남성',
    values: {
      under1y_18to24: 0.608,
      under5y_18to24: 0.864,
      under1y_25to34: 0.404,
      under5y_25to34: 0.714,
      under1y_35to44: 0.226,
      under5y_35to44: 0.588,
      under1y_45to54: 0.183,
      under5y_45to54: 0.534,
    },
    unit: 'proportion',
    population: 'NLSY79 남성, 18–58세에 시작한 일자리',
    cohortFit: 'exact',
    source: `${NLSY79_RELEASE}, Table 2`,
    url: 'https://www.bls.gov/news.release/nlsoy.t02.htm',
    howToMeasure: '젊을 때 시작한 일자리의 61%가 1년 안에 끝난다 — 좋은 짝을 찾는 탐색. 나이가 들수록 길어진다.',
  },
  {
    id: 'jobMobility.youngMen',
    kind: 'conditional',
    description: '노동시장 첫 10년 동안 고용주 수와 이직이 초기 임금 성장에서 차지하는 몫',
    values: { employersFirst10Years: 7, shareOfEarlyWageGrowthFromJobChanges: 0.33 },
    unit: 'proportion',
    population: 'LEHS 행정자료, 젊은 남성',
    cohortFit: 'close',
    source: 'Topel & Ward (1992), Job Mobility and the Careers of Young Men, QJE (NBER w2649 초록)',
    url: 'https://www.nber.org/papers/w2649',
    howToMeasure: '첫 10년 고용주 약 7곳(평생 일자리의 3분의 2), 이직 시 임금 상승이 초기 임금 성장의 "최소 3분의 1".',
  },
  // ---- 충격 ----
  {
    id: 'displacement.longTermEarningsLoss',
    kind: 'conditional',
    description: '장기근속자가 부실 기업에서 밀려난 뒤의 장기 소득 손실',
    values: { annualLossShare: 0.25 },
    unit: 'proportion',
    population: '펜실베이니아 행정자료 1980–1986, 고근속 노동자',
    cohortFit: 'close',
    source: 'Jacobson, LaLonde & Sullivan (1993), Earnings Losses of Displaced Workers (Upjohn WP 초록)',
    url: 'https://research.upjohn.org/up_workingpapers/11/',
    howToMeasure:
      '"장기 손실이 연평균 25%" — 비슷한 비실직자 대비. 비슷한 기업에 재취업해도 손실이 크다: 원인은 "고용 관계의 어떤 속성"(근속·기업 특수 자본)의 상실. 모델: 근속 6년 이상 실직자의 5년 뒤 연소득 ÷ 같은 조건 비실직자.',
  },
  {
    id: 'recessionGraduates.wageScar',
    kind: 'conditional',
    description: '불황기 대학 졸업의 임금 손실 — 졸업 시 실업률 1%p당',
    values: { initialLossPerPoint: -0.065, lossAfter15YearsPerPoint: -0.025 },
    unit: 'proportion',
    population: 'NLSY79 백인 남성 대졸자(1979–1989 졸업)',
    cohortFit: 'exact',
    source: 'Kahn (2010), The long-term labor market consequences of graduating from college in a bad economy, Labour Economics (요약)',
    url: 'https://danisreadingnotes.substack.com/p/the-long-term-labor-market-consequences',
    howToMeasure:
      '초기 6~7%(중간값 6.5% 사용), 15년 뒤에도 2.5%. 고졸 이하가 더 크게 다친다는 후속 연구도 있음(SIEPR 요약). 모델: 대졸자의 졸업 1년 뒤·15년 뒤 로그 임금을 졸업 연도 실업률에 회귀.',
    unverified: 'Kahn 원문이 아니라 요약 글에서 확인한 수치. 표본 설명(NLSY79 백인 남성)은 기억에 의존 — 원문 재확인 필요.',
  },
  // ---- 성격 ----
  {
    id: 'personality.earnings.men',
    kind: 'directional',
    description: '성격과 남성 소득: 덜 친화적인 남성이 약 18% 더 번다. 정서 안정(낮은 신경성)과 개방성은 소득에 유리',
    values: { disagreeableMenPremium: 0.18 },
    unit: 'proportion',
    population: '3개 연구, 약 1만 명·20년(Judge et al. 2012); 위스콘신 종단연구(Mueller & Plug 2006)',
    cohortFit: 'close',
    source: 'Judge, Livingston & Hurst (2012) — Notre Dame 보도; Mueller & Plug (2006) IZA DP1254 초록',
    url: 'https://mendoza.nd.edu/news/study-nice-guys-really-do-finish-last/',
    howToMeasure:
      '"덜 친화적" 대 "친화적" 남성의 비교 기준(몇 SD 차이인지)이 보도에 없어 방향과 대략적 크기만: 친화성 1SD당 로그 임금 −0.03 ~ −0.12 범위면 통과. 여성은 성실성·개방성이 보상받음(통합 단계).',
  },
  // ---- 세대 간 이동 ----
  {
    id: 'mobility.rankRank',
    kind: 'conditional',
    description: '부모 소득 순위 → 자녀 소득 순위(약 30세) 기울기',
    values: { rankRankSlope: 0.341, ige: 0.344, bottomToTopQuintile: 0.075 },
    unit: 'proportion',
    population: '1980–82년생(국세청 자료)',
    cohortFit: 'distant',
    source: 'Chetty, Hendren, Kline & Saez (2014), Where is the Land of Opportunity? (NBER w19843)',
    url: 'https://www.nber.org/system/files/working_papers/w19843/w19843.pdf',
    howToMeasure: 'Roy보다 20년 늦은 코호트지만 같은 저자들이 미국의 순위 이동성은 코호트 간 안정적이었다고 보고. 모델: 부모 계층 순위 대 본인 30~32세 소득 순위.',
  },
  // ---- 창업 ----
  {
    id: 'business.establishmentSurvival',
    kind: 'marginal',
    description: '1994년 3월 개업 사업장의 생존율',
    values: { after1y: 0.796, after2y: 0.681, after5y: 0.496, after10y: 0.336, after20y: 0.203 },
    unit: 'proportion',
    population: '미국 민간 사업장 전체(BED)',
    cohortFit: 'close',
    source: 'BLS Business Employment Dynamics, Table 7 Survival of private sector establishments by opening year',
    url: 'https://www.bls.gov/bdm/us_age_naics_00_table7.txt',
    howToMeasure: '1995·1996년 개업 코호트도 거의 같음(5년 48.8%, 48.1%). 모델: 창업한 사업의 경과 연수별 생존 비율.',
  },
  // ---- 재산 ----
  {
    id: 'wealth.medianNetWorthByAge.2022',
    kind: 'conditional',
    description: '가구주 나이별 순자산 중앙값·평균(2022)',
    values: {
      median_under35: 39000,
      median_35to44: 135600,
      median_45to54: 247200,
      median_55to64: 364500,
      median_65to74: 409900,
      mean_55to64: 1570000,
    },
    unit: 'proportion',
    population: 'SCF 2022, 가구',
    cohortFit: 'close',
    source: 'Federal Reserve Survey of Consumer Finances 2022 (Fidelity 정리본)',
    url: 'https://www.fidelity.com/learning-center/smart-money/average-net-worth-by-age',
    howToMeasure:
      '2022년 평균임금(63,795달러) 대비 배수로: <35세 0.61, 35–44 2.13, 45–54 3.87, 55–64 5.71, 65–74 6.43. 횡단면을 코호트 궤적으로 쓰는 근사. 55–64세 평균/중앙값 4.3배 = 꼬리가 두꺼운 분포. 가구 기준이라 1인 모델보다 크다(맞벌이·상속).',
    unverified: '연준 원문(Bulletin) 대신 정리본에서 확인 — 알려진 공표값과 일치하나 원문 대조 권장.',
  },
];

// ---- 세계 사실(모델 입력) ----

/**
 * LA 항공우주 산업 붕괴 — Roy가 사는 곳의 구조적 운.
 * 출처: RAND Research Brief RB7510, "Life After Cutbacks: Tracking California's Aerospace Workers"
 * (https://www.rand.org/pubs/research_briefs/RB7510.html).
 */
export const LA_AEROSPACE_FACTS = {
  peakYear: 1987,
  /** LA 카운티 항공우주 일자리가 1987년 정점의 50%까지 줄었다(보고서 시점, 1990년대 중반). */
  laCountyRemainingShare: 0.5,
  californiaDeclineShare: 0.33,
  nationalDeclineShare: 0.3,
  /** 1989년 항공우주 노동자는 비항공우주 내구재 제조업보다 10~15% 더 벌었다. */
  wagePremiumOverDurableManufacturing: [0.1, 0.15] as const,
  /** 1989년 항공우주 노동자 중 1994년에 취업 상태인 사람의 3분의 2가 여전히 항공우주. */
  stillInAerospaceShareOfEmployed1994: 0.67,
  /** 서비스업으로 옮긴 사람의 임금 하락 17%(다른 제조업→서비스 이동자는 12%). */
  wageDropMovingToServices: 0.17,
} as const;

/** 2022년 SSA 평균임금(wages.ts와 같은 값) — 재산 목표를 평균임금 배수로 바꿀 때 쓴다. */
export const AWI_2022 = 63795.13;

/**
 * 1999년 남성 풀타임 임금근로자 주급 중앙값(달러) — 직업별 임금 수준의 근거.
 * 출처: BLS CPS 1999 annual averages, Table 39 (https://www.bls.gov/cps/aa1999/aat39.TXT).
 * 전체 남성 중앙값 $618. 풀타임·중앙값이라 의사·변호사처럼 꼬리가 긴 직업의 평균은 더 높다.
 */
export const MEN_FULL_TIME_MEDIAN_WEEKLY_1999 = {
  allMen: 618,
  executiveAdministrativeManagerial: 967,
  financialManagers: 1154,
  accountantsAuditors: 891,
  engineers: 1058,
  aerospaceEngineers: 1202,
  physicians: 1364,
  registeredNurses: 791,
  collegeTeachers: 1038,
  teachersExceptCollege: 768,
  lawyers: 1340,
  engineeringTechnicians: 673,
  professionalSpecialty: 939,
  salesRepresentativesNonRetail: 792,
  retailAndPersonalSales: 423,
  cashiers: 296,
  generalOfficeClerks: 461,
  police: 766,
  firefighters: 742,
  foodPreparationService: 311,
  mechanicsRepairers: 622,
  automobileMechanics: 555,
  constructionTrades: 571,
  carpenters: 518,
  electricians: 651,
  machineOperatorsAssemblers: 487,
  assemblers: 463,
  truckDrivers: 532,
  handlersHelpersLaborers: 377,
  constructionLaborers: 413,
  farmingForestryFishing: 341,
} as const;
