import type { GameDate } from '../../game/types';

/**
 * 결혼 도메인 — 행위자 기반 모델(ABM)을 보정할 "정답지"와 메커니즘 근거.
 *
 * 설계 방침(2026-09-26 결정): 결혼/이혼을 "실직했으니 이혼 확률 ×1.3" 같은 배수로 직접 굴리지
 * 않는다. 대신 사람마다 기질·배경·신념을 주고, 그 사람이 상황을 평가해서 행동(대립/회피/지지…)을
 * 고르고, 행동이 관계 상태를 바꾸고, 누적된 상태에서 이혼이 터지게 한다. 그리고 그 행위자 모델을
 * 수천 번 돌렸을 때 아래 적률(moment)들이 재현되도록 파라미터를 보정한다(시뮬레이션 적률법).
 * 즉 이 파일의 숫자는 메커니즘이 아니라 **검증 목표**다.
 *
 * 수집 원칙: 원문(또는 원문 HTML 표)에서 직접 확인한 숫자만 넣었다. PDF 표를 요약 도구로 읽으면
 * 존재하지 않는 숫자를 지어내는 경우를 실제로 겪었다(Bramlett & Mosher 2002 표 — 폐기). 확인
 * 못 한 건 숫자 없이 "구조만" 또는 `unverified`로 적었다.
 *
 * `null` 효과(효과 없음)도 적률이다 — 모델이 거기서 효과를 만들어내면 틀린 것이다.
 */

export type MomentKind =
  /** 한 집단 안의 비율/평균. */
  | 'marginal'
  /** 두 집단의 비교(위험비, 오즈비, 집단별 비율). */
  | 'conditional'
  /** "효과가 없어야 한다" — 모델이 여기서 큰 차이를 만들면 실패. */
  | 'null'
  /** 방향·순위만 확실하고 크기는 불확실. 부호/순서만 검증한다. */
  | 'directional';

export interface CalibrationMoment {
  id: string;
  kind: MomentKind;
  description: string;
  /** 집단별 값(비율 0~1, 오즈비, 연간 확률 등 — unit 참고). */
  values: Readonly<Record<string, number>>;
  unit: 'proportion' | 'annualProbability' | 'oddsRatio' | 'logitCoefficient' | 'correlation' | 'oddsChangePerYear';
  population: string;
  /** Roy(1962년생, 1980년대 결혼 추정)와 얼마나 가까운 모집단인가. */
  cohortFit: 'exact' | 'close' | 'distant';
  source: string;
  url: string;
  /** 모델 결과와 비교하는 법 + 해석 주의점. */
  howToMeasure: string;
  unverified?: string;
}

export const MARRIAGE_MOMENTS: readonly CalibrationMoment[] = [
  // ---- 주변 분포 ----
  {
    id: 'firstMarriageDisruption.5and10yr',
    kind: 'marginal',
    description: '첫 결혼이 별거 또는 이혼으로 끝날 확률 — 5년, 10년 안',
    values: { within5y: 0.2, within10y: 0.33 },
    unit: 'proportion',
    population: '미국 여성 15–44세(1995 NSFG) — 1950~80년생',
    cohortFit: 'close',
    source: 'CDC/NCHS press release on Bramlett & Mosher (2002), Vital Health Stat 23(22)',
    url: 'https://archive.cdc.gov/www_cdc_gov/media/pressrel/r020724.htm',
    howToMeasure: '결혼 시작부터 별거 "또는" 이혼까지(이혼만이 아님). 별거 후 3년 안에 이혼으로 가는 비율은 백인 여성 91%.',
  },
  {
    id: 'secondMarriageDisruption.5and10yr',
    kind: 'marginal',
    description: '재혼이 별거 또는 이혼으로 끝날 확률 — 5년, 10년 안',
    values: { within5y: 0.23, within10y: 0.39 },
    unit: 'proportion',
    population: '미국 여성(1995 NSFG)',
    cohortFit: 'close',
    source: 'CDC/NCHS press release on Bramlett & Mosher (2002)',
    url: 'https://archive.cdc.gov/www_cdc_gov/media/pressrel/r020724.htm',
    howToMeasure: '재혼 시작부터. 첫 결혼(0.20/0.33)보다 약간 높아야 한다.',
  },
  {
    id: 'remarriageWithin5yAfterDivorce',
    kind: 'marginal',
    description: '이혼한 여성이 5년 안에 재혼할 확률',
    values: { all: 0.54, white: 0.58, hispanic: 0.44, black: 0.32 },
    unit: 'proportion',
    population: '미국 여성(1995 NSFG)',
    cohortFit: 'close',
    source: 'CDC/NCHS press release on Bramlett & Mosher (2002)',
    url: 'https://archive.cdc.gov/www_cdc_gov/media/pressrel/r020724.htm',
    howToMeasure: '이혼 시점부터 5년. 1950년대 이혼자 65% → 1980년대 50%로 하락했다는 추세도 같은 자료에 있음.',
  },

  // ---- 학력 (Roy 코호트 그대로) ----
  {
    id: 'firstMarriageEndsInDivorce.byEducation',
    kind: 'conditional',
    description: '55세까지 첫 결혼이 이혼으로 끝난 비율 — 학력별',
    values: {
      men_lessThanHighSchool: 0.52,
      men_highSchool: 0.502,
      men_someCollege: 0.497,
      men_bachelorsOrMore: 0.271,
      women_lessThanHighSchool: 0.558,
      women_highSchool: 0.534,
      women_someCollege: 0.526,
      women_bachelorsOrMore: 0.405,
    },
    unit: 'proportion',
    population: 'NLSY79(1957–64년생), 15–55세',
    cohortFit: 'exact',
    source: 'BLS Monthly Labor Review (2024), Patterns of marriage and divorce from ages 15 to 55 (NLSY79)',
    url: 'https://www.bls.gov/opub/mlr/2024/article/patterns-of-marriage-and-divorce-from-ages-15-to-55-evidence-from-the-nlsy79.htm',
    howToMeasure:
      '모양이 핵심이다: 고졸 미만~대학 중퇴까지는 거의 평평하고(50% 안팎) 대졸에서만 뚝 떨어진다. 학력을 연속 변수로 선형 효과를 주면 이 모양이 안 나온다.',
  },

  // ---- 결혼 나이 ----
  {
    id: 'divorceOdds.byAgeAtMarriage',
    kind: 'conditional',
    description: '결혼 나이 1살당 이혼 오즈 변화 — 32세까지는 감소, 이후 증가',
    values: { perYearUntil32: -0.11, perYearAfter32: 0.05 },
    unit: 'oddsChangePerYear',
    population: 'NSFG 2006–2010, 성별·인종·원가족·학력·종교 등 통제',
    cohortFit: 'distant',
    source: 'Wolfinger, Institute for Family Studies (2015)',
    url: 'https://ifstudies.org/blog/want-to-avoid-divorce-wait-to-get-married-but-not-too-long/',
    howToMeasure:
      '25세 결혼은 20세 결혼보다 이혼 가능성이 "50% 넘게 낮다"(원문). 32세 이후 상승은 최근 코호트 현상일 수 있어 Roy 세대엔 약하게 적용할 것.',
  },

  // ---- 경제 충격: Linda 예시의 핵심 근거 ----
  {
    id: 'divorceRisk.husbandNotFullTime',
    kind: 'conditional',
    description: '남편이 풀타임 고용이 아닐 때 연간 이혼 확률',
    values: { husbandFullTime: 0.025, husbandNotFullTime: 0.033 },
    unit: 'annualProbability',
    population: 'PSID, 1975년 이후 결혼한 부부(둘 다 18–55세)',
    cohortFit: 'exact',
    source: 'Killewald (2016), American Sociological Review — summary on Work in Progress (ASA OOW section)',
    url: 'https://workinprogress.oowsection.org/2016/10/07/how-work-gender-norms-and-money-shape-the-risk-of-divorce/',
    howToMeasure: '위험비 약 1.32. 1975년 이전 결혼에서는 대신 아내의 가사 분담이 중요했다(시대 효과).',
  },
  {
    id: 'divorceRisk.wifeEconomicDependence',
    kind: 'null',
    description: '아내의 경제적 의존도(가구 소득 중 아내 몫)와 가구 총소득은 이혼 위험을 거의 바꾸지 않는다',
    values: {},
    unit: 'annualProbability',
    population: 'PSID, 1975년 이후 결혼',
    cohortFit: 'exact',
    source: 'Killewald (2016) — summary on Work in Progress',
    url: 'https://workinprogress.oowsection.org/2016/10/07/how-work-gender-norms-and-money-shape-the-risk-of-divorce/',
    howToMeasure:
      '"Linda가 전업주부라서" 자체로 이혼 위험이 크게 오르면 틀린 모델이다. 아내 고용 여부, 가사 분담도 1975년 이후 결혼에선 유의하지 않음.',
  },
  {
    id: 'divorceRisk.afterSpouseJobLoss',
    kind: 'conditional',
    description: '배우자 실직 후 이혼 위험 — 해고(layoff)는 올리고, 공장 폐쇄와 장애는 안 올린다',
    values: { husbandLayoff_years1to3: 0.309, wifeLayoff_years1to3: 0.194, wifeLayoff_years5plus: 0.207, plantClosing: 0, disability: 0 },
    unit: 'logitCoefficient',
    population: 'PSID',
    cohortFit: 'close',
    source: 'Charles & Stephens (2004), Job Displacement, Disability, and Divorce, Journal of Labor Economics 22(2)',
    url: 'https://spinup-000d1a-wp-offload-media.s3.amazonaws.com/faculty/wp-content/uploads/sites/73/2019/10/divorce_final.pdf',
    howToMeasure:
      '남편 해고 계수 0.309(SE 0.095) → 이산 시간 로짓이면 오즈비 약 1.36. 공장 폐쇄와 장애는 "통계적으로 유의한 효과 없음"(0으로 둠). 저자 해석: 돈이 아니라 "배우자가 어떤 사람인가"에 대한 정보가 이혼을 부른다.',
    unverified: '추정 모형이 로짓/해저드 중 무엇인지 원문에서 재확인 필요(오즈비 환산의 전제).',
  },
  {
    id: 'divorce.financialDisagreements',
    kind: 'directional',
    description: '금전 갈등은 모든 갈등 유형 중 이혼을 가장 강하게 예측한다. 금전 갈등을 통제하면 재정 상태 자체는 이혼과 무관해진다',
    values: {},
    unit: 'correlation',
    population: 'NSFH, 부부 4,574쌍(양쪽 응답)',
    cohortFit: 'close',
    source: 'Dew, Britt & Huston (2012), Examining the Relationship Between Financial Issues and Divorce, Family Relations 61',
    url: 'https://eric.ed.gov/?id=EJ999306',
    howToMeasure:
      '경로 검증: 돈 문제 → 금전 갈등 행동 → (만족도, 갈등 방식) → 이혼. 모델에서 "금전 갈등 행동"을 제거하면 재정 상태의 효과가 사라져야 한다.',
  },

  // ---- 원가족 ----
  {
    id: 'divorceOdds.parentalDivorce',
    kind: 'conditional',
    description: '부모가 이혼한 자녀의 이혼 오즈비',
    values: { gss1994: 1.89, gss1973: 4.03, ukAdjusted: 1.71 },
    unit: 'oddsRatio',
    population: 'GSS 완결 코호트(결혼 1901–1964), 영국 BHPS/UKHLS(참고)',
    cohortFit: 'distant',
    source:
      'Wolfinger (2011), More Evidence for Trends in the Intergenerational Transmission of Divorce (GSS); Li & Wu (2008) Demography — NSFH에선 추세 없음; UK: PMC9950316',
    url: 'https://www.researchgate.net/publication/51067041_More_Evidence_for_Trends_in_the_Intergenerational_Transmission_of_Divorce_A_Completed_Cohort_Approach_Using_Data_From_the_General_Social_Survey',
    howToMeasure:
      'Roy 세대 목표는 1.7~1.9 구간. 약해지는 추세 여부는 학계 논쟁 중(NSFH 분석은 "추세 없음"). Add Health: 부모 관계 전환 1회당 자녀 해체 오즈 +16%, "안정적이지만 불행한 가정" +22%.',
  },

  // ---- 기질 ----
  {
    id: 'divorceOdds.bigFivePerSD',
    kind: 'conditional',
    description: '성격 5요인 1표준편차당 관계 해체 오즈비(무통제)',
    values: { neuroticism: 1.36, openness: 1.35, conscientiousness: 0.88, agreeableness: 0.91 },
    unit: 'oddsRatio',
    population: '대규모 패널 부부 자료(원문 참고)',
    cohortFit: 'distant',
    source: 'Solomon & Jackson (2014), Why do personality traits predict divorce? Multiple pathways through satisfaction, JPSP',
    url: 'https://gwern.net/doc/psychology/personality/2014-solomon.pdf',
    howToMeasure:
      '다른 기질·인구학을 통제하면 신경성과 개방성만 유의. 효과는 거의 전부 "관계 만족도"를 거쳐 간다 — 기질이 이혼 해저드에 직접 곱해지면 안 되고 만족도를 통해 가야 한다. 큰 생애사건(사망, 재정 스트레스, 이직)이 있을 때 "만족도 변화" 경로가 추가로 드러난다.',
    unverified: '데이터셋 국가와 표본 크기는 원문 재확인 필요.',
  },
  {
    id: 'maritalStability.vsaMetaCorrelations',
    kind: 'conditional',
    description: '취약성-스트레스-적응 메타분석 상관 — 결혼 안정성과의 r',
    values: {
      neuroticism_wives: -0.22,
      neuroticism_husbands: -0.2,
      stressfulEvents_couples: -0.14,
      negativeBehavior_husbands: -0.37,
      negativeBehavior_wives: -0.34,
      positiveBehavior_husbands: 0.46,
    },
    unit: 'correlation',
    population: '결혼 종단 연구 메타분석(1995년 이전 출판)',
    cohortFit: 'close',
    source: 'Karney & Bradbury (1995), The longitudinal course of marital quality and stability, Psychological Bulletin 118',
    url: 'https://www.healthymarriageinfo.org/wp-content/uploads/2017/12/The-Longitudinal-Course-of.pdf',
    howToMeasure:
      '상대 크기가 핵심: 부부의 "행동"(|r| 0.34~0.46)이 기질(0.20)이나 스트레스 사건(0.14)보다 안정성을 훨씬 강하게 예측한다. 행동 효과는 연구 2편뿐이라 불확실.',
  },
  {
    id: 'gottman.replicationCaveat',
    kind: 'directional',
    description: 'Gottman의 성별 특화 상호작용 예측(부정적 시작, 영향 거부 등)은 위험군 지역 표본에서 재현되지 않았다',
    values: {},
    unit: 'correlation',
    population: '위험군 커플 85쌍',
    cohortFit: 'distant',
    source: 'Kim, Capaldi & Crosby (2007), Generalizability of Gottman and colleagues’ affective process models',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1828692/',
    howToMeasure: '"네 기수(비난·경멸·방어·담쌓기)"를 정교한 순서 규칙으로 하드코딩하지 말 것. 긍정/부정 행동의 균형 정도만 쓰는 게 안전하다(22개 과정 중 2개만 해체를 예측).',
  },
];

// ---- 메커니즘 뼈대 (숫자 없이 구조만) ----

/**
 * 행위자 모델의 뼈대가 되는 두 이론. 파라미터는 전부 보정 대상이라 여기엔 구조만 둔다.
 */
export const MARRIAGE_MECHANISM_NOTES = {
  vulnerabilityStressAdaptation: {
    source: 'Karney & Bradbury (1995)',
    structure:
      '지속적 취약성(기질·원가족·계층) → 적응 과정(갈등을 다루는 행동)과 스트레스 사건 노출에 영향 → 적응 과정 ↔ 결혼 만족도(상호) → 결혼 안정성.',
  },
  investmentModel: {
    source: 'Rusbult; meta-analysis Le & Agnew (2003), Personal Relationships',
    structure:
      '헌신 ≈ 만족도 + 투자(자녀·집·세월·공동 친구) − 대안의 질. 떠남/머묾은 만족도가 아니라 헌신이 예측한다 — 불행하지만 머무는 부부, 만족했는데 대안 때문에 떠나는 경우가 둘 다 나온다.',
    unverified: '메타분석의 상관 크기(만족도·대안·투자 각각)는 원문 접근 실패로 미확인 — 구조만 사용하고 크기는 보정으로 정할 것.',
  },
} as const;

// ---- 시대 장벽 ----

export interface DivorceRegime {
  from: GameDate;
  label: string;
  description: string;
}

/**
 * 캘리포니아 이혼 제도. Roy가 결혼할 무렵(1980년대)엔 이미 무과실이지만, 그의 부모 세대 NPC
 * (1960년대 결혼)는 유책주의 시절을 거친다 — NPC 지연 평가에서 쓰인다.
 * 출처: California Assembly Judiciary Committee report "The Direction of Divorce Reform in California"
 * (https://ajud.assembly.ca.gov/sites/ajud.assembly.ca.gov/files/reports/1197%20divorcereform97.pdf),
 * 시행일은 https://en.wikipedia.org/wiki/January_1970.
 */
export const CALIFORNIA_DIVORCE_REGIMES: readonly DivorceRegime[] = [
  {
    from: { year: 1900, month: 1 },
    label: 'fault',
    description: '유책주의: 상대의 잘못을 입증해야 이혼. 위자료와 재산 대부분이 "무고한" 배우자에게.',
  },
  {
    from: { year: 1970, month: 1 },
    label: 'noFault',
    description:
      'Family Law Act(1969-09-05 레이건 주지사 서명, 1970-01-01 시행, 미국 최초): "화해 불가능한 차이"로 이혼. 재산 균등 분할, 위자료는 필요 기준, 양쪽 모두 자립·양육비 책임.',
  },
];

/** 해당 월의 캘리포니아 이혼 제도. */
export function californiaDivorceRegimeAt(date: GameDate): DivorceRegime {
  const m = date.year * 12 + date.month;
  let current = CALIFORNIA_DIVORCE_REGIMES[0];
  for (const regime of CALIFORNIA_DIVORCE_REGIMES) {
    if (regime.from.year * 12 + regime.from.month <= m) current = regime;
  }
  return current;
}

/**
 * 미국 "정밀 이혼율"(기혼 여성 1,000명당 연간 이혼) 기준점. 중간 연도 값은 원문에서 확인하지
 * 못했으므로 보간하지 않는다 — 시대 효과 보정은 이 기준점과 아래 사실만 목표로 삼을 것.
 * 출처: NCFMR Family Profiles FP-24-11, FP-20-22 (NCHS/Census/ACS 분석).
 */
export const US_REFINED_DIVORCE_RATE_ANCHORS: Readonly<Record<number, number>> = {
  1900: 4.1,
  1980: 22.6, // 역대 정점
  2018: 15.7,
  2022: 14.6,
};

export const DIVORCE_ERA_FACTS = {
  /** California Assembly 보고서: 캘리포니아 무과실 도입 후 5년간 전국 이혼율이 "거의 40%" 증가. */
  nationalRateIncreaseFiveYearsAfterNoFault: 0.4,
  /** 연간 이혼 건수: 1950~60년대 40만 건 미만 → 1975년 100만 건 → 1980년 정점 118.9만 건. */
  annualDivorcesPeak1980: 1_189_000,
  /** 이혼 후 재혼 가능성: 1950년대 이혼자 65% → 1980년대 50% (CDC 보도자료). */
  remarriageChance1950s: 0.65,
  remarriageChance1980s: 0.5,
} as const;
