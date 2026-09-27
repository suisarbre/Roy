import type { CalibrationMoment } from './marriage';

/**
 * 출산 도메인 — 결혼 행위자 모델에 출산을 넣을 때의 보정 목표. marriage.ts와 같은 원칙:
 * 원문(HTML 표/초록)에서 확인한 숫자만, 확인 못 한 건 방향만(`directional`) 또는 `unverified`.
 *
 * 비교 가능성 주의: 아래 자녀 수 분포는 "모든 여성"(미혼 출산 포함) 기준이다. 모델은 첫 결혼 안의
 * 출산만 센다. 미혼 출산이 빠지는 것과 이혼 뒤(재혼 등) 출산이 빠지는 것이 대략 상쇄된다고 보고
 * 허용오차를 넓게 둔다 — 결혼 안의 출산만 따로 집계한 코호트 통계는 찾지 못했다.
 */
export const FERTILITY_MOMENTS: readonly CalibrationMoment[] = [
  {
    id: 'childrenEverBorn.distributionAge46',
    kind: 'marginal',
    description: '46세까지 낳은 자녀 수 분포와 평균',
    values: { none: 0.1691, one: 0.1639, two: 0.3591, three: 0.2009, fourPlus: 0.1069, mean: 1.97 },
    unit: 'proportion',
    population: 'NLSY79 여성(1957–64년생)',
    cohortFit: 'exact',
    source: 'BLS Monthly Labor Review (2016), Fertility of women in the NLSY79, Table 5',
    url: 'https://www.bls.gov/opub/mlr/2016/article/fertility-of-women-in-the-nlsy79.htm',
    howToMeasure:
      '아내가 45세까지 생존한 첫 결혼의 결혼 중 출산 수. 교차 확인: 1998 CPS 40–44세 여성 무자녀 19.0%, 1명 17.3%, 2명 35.8%, 3명 18.2%, 4명+ 9.6%, 평균 1.877(Census P20-526).',
  },
  {
    id: 'childrenEverBorn.byEducation',
    kind: 'conditional',
    description: '학력별 평균 자녀 수와 무자녀 비율(46세까지)',
    values: {
      mean_lessThanHighSchool: 2.47,
      mean_highSchool: 2.0,
      mean_someCollege: 1.94,
      mean_bachelorsOrMore: 1.68,
      childless_lessThanHighSchool: 0.1009,
      childless_highSchool: 0.1215,
      childless_someCollege: 0.1616,
      childless_bachelorsOrMore: 0.2665,
    },
    unit: 'proportion',
    population: 'NLSY79 여성',
    cohortFit: 'exact',
    source: 'BLS Monthly Labor Review (2016), Fertility of women in the NLSY79, Table 5',
    url: 'https://www.bls.gov/opub/mlr/2016/article/fertility-of-women-in-the-nlsy79.htm',
    howToMeasure: '아내 학력 기준. 대졸 여성의 무자녀 비율(27%)이 다른 학력의 두 배 이상 — 늦은 결혼과 적은 희망 자녀 수가 함께 만들어야 한다.',
  },
  {
    id: 'maritalSatisfaction.transitionToParenthood',
    kind: 'conditional',
    description: '첫 출산 전후 결혼 만족도 변화(Hedges g) — 부모와 같은 기간의 비부모',
    values: {
      mothers_pregnancyTo12m: -0.31,
      fathers_pregnancyTo12m: -0.29,
      mothers_12to24m: -0.16,
      fathers_12to24m: -0.14,
      nonparentMothers_sameWindow: -0.12,
      nonparentFathers_sameWindow: -0.13,
    },
    unit: 'correlation',
    population: '종단 연구 메타분석',
    cohortFit: 'distant',
    source: 'Transition to Parenthood and Marital Satisfaction: A Meta-Analysis, Frontiers in Psychology (2022)',
    url: 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.901362/full',
    howToMeasure:
      '부모의 첫해 하락에서 비부모의 같은 기간 하락을 뺀 순효과 ≈ −0.18 SD(엄마 −0.19, 아빠 −0.16). 모델: 첫 출산 3개월 전 → 12개월 후 만족도 변화 − 같은 결혼 연차 무자녀 부부의 변화, 만족도 표준편차로 나눔.',
  },
  {
    id: 'divorce.childrenProtective',
    kind: 'directional',
    description: '자녀가 있는 부부는 무자녀 부부보다 이혼이 적고, 자녀가 어릴 때 특히 그렇다. 동시에 이혼 위험이 높은 부부는 출산을 미루거나 덜 한다(양방향)',
    values: {},
    unit: 'annualProbability',
    population: 'PSID 기혼 여성',
    cohortFit: 'close',
    source: 'Lillard & Waite (1993), A joint model of marital childbearing and marital disruption, Demography',
    url: 'https://link.springer.com/article/10.2307/2061812',
    howToMeasure: '어린 자녀(3세 미만) 개월의 층별 표준화 이혼 위험비 < 1, 그리고 큰 자녀(6세 이상)만 있을 때보다 더 낮아야 한다.',
    unverified: '크기(위험비)는 원문 접근 실패로 미확인 — 방향만 검증.',
  },
  {
    id: 'fertility.afterHusbandDisplacement',
    kind: 'conditional',
    description: '남편 실직(해고·공장 폐쇄) 후 완결 출산 변화 — 조금 줄지만 직후 몇 년은 오히려 앞당겨진다',
    values: { completedFertilityChange: -0.1 },
    unit: 'proportion',
    population: 'PSID 1968–1997, 남편 실직 여성 1,548명 대 대조군 2,594명',
    cohortFit: 'close',
    source: 'Lindo (2010), Are Children Really Inferior Goods? Journal of Human Resources 45(2)',
    url: 'https://bpb-us-e1.wpmucdn.com/sites.gatech.edu/dist/f/3934/files/2023/11/AreChildrenReallyInferiorGoods_Lindo10.pdf',
    howToMeasure:
      '완결 출산 −0.10명(개인 고정효과를 넣으면 유의하지 않음). 실직 후 첫 4년은 출산 오즈가 유의하게 높다가 뒤집힌다(시점 앞당김) — 이 앞당김은 현재 모델에 메커니즘이 없다(README).',
  },
];
