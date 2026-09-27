/**
 * 공유 세계의 파라미터 — 만남, 연애 → 동거 → 결혼, 헤어짐, 혼외 임신, 급한 결혼, 외도, 재혼.
 * 결혼 단계의 행동 역학(만족도·헌신·떠남)과 여성 노동 공급은 이미 보정된 결혼 모델 파라미터를 그대로 쓰고,
 * 여기서는 그 앞뒤(결혼 전 관계와 결혼 밖 관계)만 정한다.
 */

export interface WorldParams {
  // ---- 만남 ----
  /** 싱글의 월간 만남 확률(20세 기준). */
  meetBase: number;
  /** 20세 이후 1년당 만남 감소(로그). */
  meetAgeDecline: number;
  /** 외향성 1SD당 만남(로그). */
  meetExtraversion: number;
  /** 사람마다 다른 "짝 찾는 힘"(관찰 안 되는 매력·기회)의 표준편차(로그) — 평생 미혼의 꼬리를 만든다. */
  meetHeterogeneity: number;
  /** 이혼·사별한 사람의 만남 배수(재혼 속도). */
  remarriageMeet: number;
  /** 직장에서 만날 상대 가중치(친구 소개 = 1 기준) — 부부가 만난 경로. */
  channelWork: number;

  // ---- 단계 전이(월간 로짓) ----
  /** 연애 → 결혼(직행). */
  toMarryBase: number;
  /** 연애 → 동거. */
  toCohabitBase: number;
  /** 동거의 연도 추세(10년당 로짓) — 1970년대 15% → 1990년대 45%. */
  cohabTrend: number;
  /** 전통성 → 동거 대신 결혼(평균 전통성 1SD당). */
  marryTraditionalism: number;
  /** 동거 → 결혼 가산. */
  cohabToMarry: number;
  /** 남성의 경제적 형편 → 결혼(로그 연소득/AWI당, 무직이면 −1로 봄) — 저학력 남성의 낮은 결혼률. */
  marryEconomics: number;
  /** 학교를 마친 직후엔 결혼을 미룬다: 로짓 감점 × exp(−졸업 후 연수/3) — 대졸의 늦은 결혼. */
  schoolMarryPenalty: number;

  // ---- 단계별 헤어짐 ----
  /** 연애의 떠남 절편 가산(결혼보다 쉽게 헤어진다). */
  datingLeaveOffset: number;
  cohabLeaveOffset: number;

  // ---- 결혼 밖 임신 ----
  /** 연애·동거 중 계획 외 출산의 상대 확률(가임력 대비). */
  unplannedConception: number;
  /** 학력 한 단계(고졸 미만 → 고졸 → 대학 중퇴 → 대졸)당 계획 외 출산 감소(로그) — 혼외 출산의 가파른 학력 기울기. */
  unplannedEducation: number;
  /** 결혼 밖 임신 중 월간 결혼 로짓(급한 결혼). */
  shotgunMarriage: number;
  /** 연애 중 임신하면 같이 살기 시작하는 월간 로짓. */
  pregnancyCohabit: number;

  // ---- 외도 ----
  /** 동거·결혼 중 월간 유혹(대안이 실제로 나타남) 확률. */
  affairOpportunity: number;
  /** 헌신이 낮을수록 외도 — 로짓 절편(헌신 0 기준). */
  affairBase: number;
  /** 헌신 1단위당 외도 로짓 감소. */
  affairCommitment: number;
  /** 여성의 외도 기회 배수(로그) — GSS의 남녀 차이. */
  affairWomen: number;
  /** 실체화된 상대가 이미 가진 아이(20세 이후 10년당 포아송 평균) — 새 상대마다 출산을 처음부터 다시 하지 않게. */
  partnerPriorKids: number;
  /** 새 결합의 희망 자녀 계산에서 남성 쪽 기존 자녀의 무게(여성 쪽은 1; 남성의 아이는 대개 따로 산다). */
  stepChildWeight: number;
  /** 외도의 월간 발각 확률. */
  affairDiscovery: number;
  /** 발각 시 만족도 하락. */
  discoveryShock: number;
}

export type WorldParamName = keyof WorldParams;

export interface WorldParamSpec {
  name: WorldParamName;
  min: number;
  max: number;
  drives: string;
}

export const WORLD_FREE_PARAMS: readonly WorldParamSpec[] = [
  { name: 'meetBase', min: 0.005, max: 0.2, drives: '결혼 경험, 첫 결혼 나이' },
  { name: 'meetAgeDecline', min: 0, max: 0.15, drives: '늦은 결혼·재혼' },
  { name: 'meetExtraversion', min: 0, max: 0.8, drives: '(성격과 만남)' },
  { name: 'meetHeterogeneity', min: 0, max: 2.5, drives: '평생 미혼 비율' },
  { name: 'remarriageMeet', min: 0.1, max: 3, drives: '재혼 비율·속도' },
  { name: 'channelWork', min: 0.1, max: 3, drives: '만난 경로(직장 대 친구)' },
  { name: 'toMarryBase', min: -8, max: -1, drives: '첫 결혼 나이' },
  { name: 'toCohabitBase', min: -8, max: -1, drives: '결혼 전 동거' },
  { name: 'cohabTrend', min: 0, max: 4, drives: '동거의 시대 변화' },
  { name: 'marryTraditionalism', min: 0, max: 2, drives: '결혼 대 동거' },
  { name: 'cohabToMarry', min: -2, max: 4, drives: '동거 → 결혼' },
  { name: 'marryEconomics', min: 0, max: 2, drives: '학력별 남성 결혼률' },
  { name: 'schoolMarryPenalty', min: 0, max: 6, drives: '대졸 첫 결혼 나이' },
  { name: 'datingLeaveOffset', min: 0, max: 6, drives: '연애 헤어짐' },
  { name: 'cohabLeaveOffset', min: 0, max: 5, drives: '동거 헤어짐' },
  { name: 'unplannedConception', min: 0, max: 1.5, drives: '혼외 출산 비율' },
  { name: 'unplannedEducation', min: 0, max: 1.5, drives: '혼외 출산 학력 기울기' },
  { name: 'shotgunMarriage', min: -6, max: 1, drives: '혼외 출산 대 급한 결혼' },
  { name: 'pregnancyCohabit', min: -6, max: 1, drives: '혼외 출생 중 동거 커플' },
  { name: 'affairOpportunity', min: 0, max: 0.05, drives: '외도 경험' },
  { name: 'affairBase', min: -6, max: 2, drives: '외도 경험' },
  { name: 'affairCommitment', min: 0, max: 2, drives: '외도와 이혼의 연결' },
  { name: 'affairWomen', min: -2, max: 1, drives: '외도 남녀 차이' },
  { name: 'partnerPriorKids', min: 0, max: 1.5, drives: '여러 상대와의 출산, 남성 자녀 수' },
  { name: 'stepChildWeight', min: 0, max: 1.5, drives: '재혼 가정의 출산, 여러 상대와의 출산' },
  { name: 'affairDiscovery', min: 0.005, max: 0.2, drives: '외도 발각' },
  { name: 'discoveryShock', min: 0, max: 3, drives: '외도 후 이혼' },
];

export const INITIAL_WORLD_PARAMS: WorldParams = {
  meetBase: 0.05,
  meetAgeDecline: 0.04,
  meetExtraversion: 0.25,
  meetHeterogeneity: 1,
  remarriageMeet: 1,
  channelWork: 0.6,
  toMarryBase: -4,
  toCohabitBase: -4.5,
  cohabTrend: 0.6,
  marryTraditionalism: 0.5,
  cohabToMarry: 1,
  marryEconomics: 0.7,
  schoolMarryPenalty: 3,
  datingLeaveOffset: 3,
  cohabLeaveOffset: 1.5,
  unplannedConception: 0.4,
  unplannedEducation: 0.5,
  shotgunMarriage: -2.5,
  pregnancyCohabit: -2,
  affairOpportunity: 0.01,
  affairBase: -2,
  affairCommitment: 0.5,
  affairWomen: -0.5,
  affairDiscovery: 0.05,
  discoveryShock: 1,
  partnerPriorKids: 0.5,
  stepChildWeight: 0.5,
};

/** 구조 상수(가정). */
export const WORLD_STRUCTURE = {
  /** 만남이 시작되는 나이. */
  minDatingAge: 16,
  /** 연애 상대의 나이 차: 남자가 평균 2살 많고 표준편차 3살. */
  ageGapMean: 2,
  ageGapSd: 3,
  /** 만난 상대의 학력이 같을 확률(학교·대학에서 만나면 항상 같음). */
  meetEducationHomogamy: 0.5,
  /** 연애 단계의 헌신 투자 비율(결혼 = 1), 동거. */
  datingInvestment: 0,
  cohabInvestment: 0.5,
  /** 동거 추세가 연애 → 결혼 직행을 줄이는 비율(1 = 동거가 느는 만큼 직행 로짓이 준다). */
  directMarriageTrend: 1,
  /** 동거 전이에 들어가는 결혼 준비(경제력·졸업 후 연수)의 비율. */
  cohabReadiness: 0.5,
  /** 외도가 진행 중일 때 바람피우는 쪽의 대안 가산. */
  affairAlternative: 1,
  /** 발각 뒤 외도가 끝날 확률. */
  affairEndsOnDiscovery: 0.6,
  /** 외도의 월간 자연 종료 확률. */
  affairFade: 0.05,
  /** 만남 경로 기본 가중치(친구 소개 = 1): 바·교회·이웃·가족 등 그 밖, 학생일 때 학교. */
  channelOther: 1.1,
  channelSchool: 1.5,
};

/** 세계 보정에서 함께 움직이는 결혼 모델 파라미터(출산 수준·이혼 수준·학력 기울기) — 결혼 모델만일 때와 달리
 *  이제 결혼 밖 출산과 재혼까지 합쳐 맞춰야 해서 다시 연다. 나머지 결혼·여성 노동 파라미터는 고정. */
export const REOPENED_MARRIAGE_PARAMS = ['desireBase', 'birthPace', 'desireCollegeDrop', 'leaveIntercept', 'chronicStrainBase'] as const;

export interface JointWorldParams {
  world: WorldParams;
  marriage: import('../marriage/params').MarriageParams;
  women: import('../career/types').WomenLaborParams;
}
