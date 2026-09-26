import { HOMEOWNERSHIP_BY_AGE_ROY_COHORT } from './housing';
import { lifeExpectancyAtBirth, survivalProbability } from './lifeTables';

/**
 * 3단계 헤드리스 하네스(LLM 없는 몬테카를로)의 검증 타깃.
 *
 * 원칙: "아무 선택도 하지 않은(또는 무작위 봇이 사는) 평범한 인생 수천 개"의 분포가 Roy 세대의
 * 실제 분포와 맞아야 한다. 그래야 플레이어의 선택이 그 분포에서 벗어나는 게 의미를 가진다.
 *
 * 기준 모집단: 가능한 한 NLSY79(1957–1964년생 미국인을 1979년부터 평생 추적한 BLS 종단조사)을
 * 쓴다 — Roy(1962년생)가 정확히 이 코호트 한가운데라 횡단면 통계보다 훨씬 맞는 비교 대상이다.
 *
 * 허용오차(tolerance): N=1,000 인생 기준 표본오차(비율 ±1.5%p 안팎)에 모델 단순화 여유를 더한
 * 초안이다. 하네스를 돌려보고 조정할 것 — 타깃 값 자체는 사실, 허용오차는 설계 판단이다.
 *
 * 주의: 대부분 "전국 평균"이다. Roy는 LA 노동계급 가정 출신이라 교육 수준 등으로 조건을 걸면
 * 결과가 달라진다 — 교육별 값이 있는 항목은 byEducation으로 같이 적었다.
 */

export interface ValidationTarget {
  id: string;
  description: string;
  /** 비율은 0~1, 평균은 해당 단위 그대로. */
  value: number;
  unit: 'proportion' | 'years' | 'count' | 'percent';
  tolerance: number;
  population: string;
  source: string;
  /** 하네스에서 어떻게 측정해야 이 값과 비교 가능한지. */
  howToMeasure: string;
  byEducation?: Readonly<Record<string, number>>;
}

const NLSY79_MARRIAGE =
  'BLS Monthly Labor Review (2024), "Patterns of marriage and divorce from ages 15 to 55: evidence from the NLSY79" — https://www.bls.gov/opub/mlr/2024/article/patterns-of-marriage-and-divorce-from-ages-15-to-55-evidence-from-the-nlsy79.htm';
const NLSY79_JOBS =
  'BLS news release, "Number of Jobs, Labor Market Experience, Marital Status, and Health: Results from a National Longitudinal Survey" (NLSY79, 1979–2022/23), Table 1 — https://www.bls.gov/news.release/nlsoy.nr0.htm';
const NLSY79_FERTILITY =
  'BLS Monthly Labor Review (2016), "Fertility of women in the NLSY79" — https://www.bls.gov/opub/mlr/2016/article/fertility-of-women-in-the-nlsy79.htm';
const SSA_COHORT = 'SSA Actuarial Study No. 120, 코호트 생명표(lifeTables.ts), 1960·1970 코호트 보간';

const ROY_BIRTH_YEAR = 1962;

export const VALIDATION_TARGETS: readonly ValidationTarget[] = [
  // ---- 사망 ----
  {
    id: 'mortality.lifeExpectancyAtBirth',
    description: '1962년생 남성의 출생 시 기대수명',
    value: lifeExpectancyAtBirth(ROY_BIRTH_YEAR, 'male'),
    unit: 'years',
    tolerance: 1.0,
    population: '1962년생 미국 남성(사회보장 가입 인구)',
    source: SSA_COHORT,
    howToMeasure: '모든 인생의 사망 나이 평균. 건강 실타래의 위험 배수 평균이 1에서 벗어나면 여기서 드러난다.',
  },
  {
    id: 'mortality.survivalTo65',
    description: '1962년생 남성이 65세까지 생존할 확률',
    value: survivalProbability(ROY_BIRTH_YEAR, 'male', 0, 65),
    unit: 'proportion',
    tolerance: 0.03,
    population: '1962년생 미국 남성',
    source: SSA_COHORT,
    howToMeasure: '사망 나이 ≥ 65인 인생의 비율.',
  },
  {
    id: 'mortality.survivalTo85',
    description: '1962년생 남성이 85세까지 생존할 확률',
    value: survivalProbability(ROY_BIRTH_YEAR, 'male', 0, 85),
    unit: 'proportion',
    tolerance: 0.03,
    population: '1962년생 미국 남성',
    source: SSA_COHORT,
    howToMeasure: '사망 나이 ≥ 85인 인생의 비율.',
  },

  // ---- 결혼·이혼 (NLSY79, 15–55세) ----
  {
    id: 'marriage.everMarriedBy55',
    description: '55세까지 한 번이라도 결혼한 남성 비율',
    value: 0.85,
    unit: 'proportion',
    tolerance: 0.04,
    population: 'NLSY79 남성(1957–64년생)',
    source: NLSY79_MARRIAGE,
    howToMeasure: '55세 이상 생존한 인생 중 결혼 이력이 있는 비율(55세 전 사망자는 분모에서 제외).',
    byEducation: { lessThanHighSchool: 0.71, bachelorsOrMore: 0.89 },
  },
  {
    id: 'marriage.meanAgeAtFirstMarriage',
    description: '남성 초혼 평균 나이',
    value: 26,
    unit: 'years',
    tolerance: 1.5,
    population: 'NLSY79 남성, 55세까지 결혼한 사람',
    source: NLSY79_MARRIAGE,
    howToMeasure: '결혼한 인생들의 첫 결혼 나이 평균.',
    byEducation: { lessThanHighSchool: 24, bachelorsOrMore: 28 },
  },
  {
    id: 'marriage.firstMarriageEndsInDivorce',
    description: '남성 첫 결혼이 (55세까지) 이혼으로 끝난 비율',
    value: 0.43,
    unit: 'proportion',
    tolerance: 0.05,
    population: 'NLSY79 남성, 첫 결혼 보유자',
    source: NLSY79_MARRIAGE,
    howToMeasure: '첫 결혼 중 55세 이전에 이혼으로 종료된 비율. 사별은 이혼이 아님.',
    // 원문 HTML 표에서 재확인(2026-09-26): 남성 고졸 미만 52.0%, 고졸 50.2%, 대학 중퇴·전문대 49.7%, 대졸 이상 27.1%.
    byEducation: { lessThanHighSchool: 0.52, highSchool: 0.502, someCollege: 0.497, bachelorsOrMore: 0.271 },
  },
  {
    id: 'marriage.firstMarriageDurationBeforeDivorce',
    description: '이혼으로 끝난 첫 결혼의 평균 지속 기간',
    value: 11.1,
    unit: 'years',
    tolerance: 2,
    population: 'NLSY79 전체(남녀), 첫 결혼이 이혼으로 끝난 사람',
    source: NLSY79_MARRIAGE,
    howToMeasure: '이혼한 첫 결혼들의 결혼~이혼 기간 평균.',
  },
  {
    id: 'marriage.remarriedAfterDivorce',
    description: '이혼 후 재혼한 비율',
    value: 0.66,
    unit: 'proportion',
    tolerance: 0.06,
    population: 'NLSY79 전체(남녀), 이혼 경험자',
    source: NLSY79_MARRIAGE,
    howToMeasure: '이혼 경험자 중 55세 전에 재혼한 비율. 평균 재혼까지 4.8년.',
  },
  {
    id: 'marriage.marriedTwice',
    description: '55세까지 정확히 두 번 결혼한 비율',
    value: 0.22,
    unit: 'proportion',
    tolerance: 0.04,
    population: 'NLSY79 전체(남녀) — 논문 표기상 결혼 경험자 기준으로 보임, 원문 확인 필요',
    source: NLSY79_MARRIAGE,
    howToMeasure: '결혼 횟수 분포: 2회 22%, 3회 6%, 4회 이상 1%. 평균 결혼 횟수 1.2.',
  },

  // ---- 일 ----
  {
    id: 'work.jobsHeld18to58',
    description: '18~58세 동안 가진 일자리 수(남성)',
    value: 13.1,
    unit: 'count',
    tolerance: 2,
    population: 'NLSY79 남성',
    source: NLSY79_JOBS,
    howToMeasure:
      '고용주가 바뀌면 1개로 센다(같은 고용주 재입사는 원문 정의 확인 필요). 연령대별: 18–24세 5.8, 25–34세 4.7, 35–44세 2.9, 45–54세 2.1, 55–58세 1.3. 젊을 때 몰리는 모양이 핵심.',
    byEducation: { lessThanHighSchool: 14.3, highSchool: 13.2, someCollege: 13.2, bachelorsOrMore: 12.4 },
  },
  {
    id: 'work.shareOfWeeksEmployed',
    description: '18~58세 중 취업 상태였던 주의 비율(남성)',
    value: 0.83,
    unit: 'proportion',
    tolerance: 0.04,
    population: 'NLSY79 남성',
    source: NLSY79_JOBS,
    howToMeasure:
      '월 tick 기준 취업 월 / 18~58세 전체 월. 남성 비경제활동 12%, 나머지 약 5%가 실업(차감으로 계산한 값). 전체(남녀) 실업 비중은 4%.',
  },

  // ---- 출산 (배우자 쪽 기준) ----
  {
    id: 'fertility.childlessBy46',
    description: '46세까지 자녀가 없는 여성 비율',
    value: 0.169,
    unit: 'proportion',
    tolerance: 0.04,
    population: 'NLSY79 여성 — Roy 배우자 NPC 쪽 검증용(남성 기준 통계가 아님)',
    source: NLSY79_FERTILITY,
    howToMeasure: '자녀 수 분포: 0명 16.9%, 1명 16.4%, 2명 35.9%, 3명 20.1%, 4명 이상 10.7%. 평균 2.0명.',
  },
];

/** 코호트 자가 보유율 — housing.ts의 대각선 값을 그대로 타깃으로 쓴다. */
export const HOMEOWNERSHIP_TARGETS = HOMEOWNERSHIP_BY_AGE_ROY_COHORT.map((row) => ({
  id: `housing.ownership.${row.ageFrom}to${row.ageTo}`,
  description: `${row.ageFrom}~${row.ageTo}세 가구주의 자가 보유율`,
  value: Math.round(row.percent * 10) / 1000,
  tolerance: 0.06,
  note: row.note,
  howToMeasure: '해당 연령대를 지나는 동안 자가 보유 상태였던 인생-월의 비율(가구주 여부는 단순화).',
}));

/** 자녀 수 분포 전체(0,1,2,3,4+) — 분포 비교(예: 카이제곱)용. */
export const FERTILITY_DISTRIBUTION_NLSY79_WOMEN = [0.1691, 0.1639, 0.3591, 0.2009, 0.1069] as const;

/** 결혼 횟수 분포(1회는 차감 계산이 아니라 원문에 없으므로 비워둔다). */
export const MARRIAGE_COUNT_SHARES_NLSY79 = { twice: 0.22, threeTimes: 0.06, fourOrMore: 0.01 } as const;
