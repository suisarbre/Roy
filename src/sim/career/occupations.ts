import { MEN_FULL_TIME_MEDIAN_WEEKLY_1999 as W } from '../data';
import type { Education } from './types';

/**
 * 직업 클러스터 — 고졸 미만부터 전문대학원까지. 게임에서 Roy가 "될 수 있는" 모든 길의 목록이자,
 * 경력 모델의 구조 상수.
 *
 * 숫자의 출처:
 * - `payRatio`: CPS 1999 남성 풀타임 주급 중앙값 ÷ 전체 남성 중앙값($618). **검증된 값**(data/work.ts).
 *   "경력 20년쯤 된 평범한 사람"의 임금으로 해석한다(모델의 인적자본은 경력 20년에 0이 되게 맞춘다).
 * - 그 밖의 값(입직 가중치, 경기 민감도, 사다리, 성격 적합도, 직업 내 분산)은 **가정**이다 — 직업별
 *   해고율·학력별 직업 분포를 원문으로 확인하지 못했다. 크기는 보정되는 전역 파라미터가 곱해지고,
 *   직업 간 상대적 모양만 여기서 정한다. README "가정" 절 참고.
 */

export type OccupationId =
  | 'farmLabor'
  | 'laborer'
  | 'foodService'
  | 'retailSales'
  | 'operative'
  | 'aerospaceAssembler'
  | 'truckDriver'
  | 'mechanic'
  | 'constructionTrades'
  | 'clerical'
  | 'military'
  | 'salesRep'
  | 'protectiveService'
  | 'technician'
  | 'nurse'
  | 'teacher'
  | 'businessProfessional'
  | 'engineer'
  | 'aerospaceEngineer'
  | 'otherProfessional'
  | 'manager'
  | 'professor'
  | 'lawyer'
  | 'physician';

/** 학력 사다리. 모델 안에서는 대학원을 석사/박사/전문(법·의)로 나눈다. */
export type Schooling = Education | 'masters' | 'doctorate' | 'professional';
export const SCHOOLING_RANK: Readonly<Record<Schooling, number>> = {
  lessThanHighSchool: 0,
  highSchool: 1,
  someCollege: 2,
  bachelorsOrMore: 3,
  masters: 4,
  doctorate: 5,
  professional: 5,
};

export interface Occupation {
  id: OccupationId;
  label: string;
  /** 1999 남성 풀타임 주급 중앙값 ÷ 전체 남성 중앙값. */
  payRatio: number;
  /** 최소 학력(이 아래로는 제안이 오지 않는다). */
  minSchooling: Schooling;
  /** 특정 학위만 받는 직업(변호사=professional/law, 의사=professional/med, 교수=doctorate). */
  requiresDegree?: 'law' | 'medicine' | 'doctorate';
  /** 최소 경력(년) — 관리자는 승진·경력직으로만. */
  minExperienceYears?: number;
  /** 학력별 입직 제안 가중치(가정). 0이면 그 학력엔 거의 안 온다. */
  offerWeight: Partial<Record<Schooling, number>>;
  /** 경기 민감도: 해고 위험이 실업률에 반응하는 정도(1 = 평균, 제조·건설 > 1, 공공 < 1). */
  cyclicality: number;
  /** 기본 해고 위험 배수. */
  layoffScale: number;
  /** 승진 사다리 칸 수와 칸당 로그 임금 상승. */
  rungs: number;
  rungStep: number;
  /** 직업 내 고용주 짝(매치) 분산 배수 — 판매·전문직은 크다. */
  matchSdScale: number;
  /** 능력(인지) 수익 배수 — 복잡한 일일수록 크다. */
  abilityLoad: number;
  /** 성격 적합도(제안 가중치의 로그에 더해짐) — 이 직업으로 끌리는/뽑히는 경향. */
  fit: Partial<Record<'ability' | 'conscientiousness' | 'agreeableness' | 'extraversion' | 'openness' | 'neuroticism' | 'riskTolerance', number>>;
  /** 외향성이 임금에 주는 효과(판매직). */
  extraversionPay?: number;
  /** 육체노동 — 장애 위험 배수. */
  manual: boolean;
  /** 항공우주 산업(1987~95 구조조정의 대상). */
  aerospace?: boolean;
  /** 입직 후 자동으로 오르는 칸(레지던트 → 전문의). */
  automaticRung?: { afterMonths: number };
  /** 의무 복무 기간(개월) — 군대. */
  termMonths?: number;
}

const r = (weekly: number) => weekly / W.allMen;

export const OCCUPATIONS: readonly Occupation[] = [
  {
    id: 'farmLabor', label: '농장·원예 일꾼', payRatio: r(W.farmingForestryFishing), minSchooling: 'lessThanHighSchool',
    offerWeight: { lessThanHighSchool: 5, highSchool: 1.5 }, cyclicality: 0.8, layoffScale: 1.5, rungs: 1, rungStep: 0.08,
    matchSdScale: 0.8, abilityLoad: 0.3, fit: { conscientiousness: 0.1 }, manual: true,
  },
  {
    id: 'laborer', label: '건설·창고 인부', payRatio: (r(W.handlersHelpersLaborers) + r(W.constructionLaborers)) / 2, minSchooling: 'lessThanHighSchool',
    offerWeight: { lessThanHighSchool: 18, highSchool: 9, someCollege: 2 }, cyclicality: 1.6, layoffScale: 1.6, rungs: 1, rungStep: 0.1,
    matchSdScale: 0.9, abilityLoad: 0.3, fit: { riskTolerance: 0.1 }, manual: true,
  },
  {
    id: 'foodService', label: '식당·패스트푸드', payRatio: r(W.foodPreparationService), minSchooling: 'lessThanHighSchool',
    offerWeight: { lessThanHighSchool: 12, highSchool: 6, someCollege: 4, bachelorsOrMore: 1 }, cyclicality: 0.7, layoffScale: 1.3, rungs: 2, rungStep: 0.12,
    matchSdScale: 0.8, abilityLoad: 0.3, fit: { extraversion: 0.1 }, manual: false,
  },
  {
    id: 'retailSales', label: '소매 판매', payRatio: r(W.retailAndPersonalSales), minSchooling: 'lessThanHighSchool',
    offerWeight: { lessThanHighSchool: 8, highSchool: 10, someCollege: 9, bachelorsOrMore: 3 }, cyclicality: 0.8, layoffScale: 1.1, rungs: 2, rungStep: 0.15,
    matchSdScale: 1.1, abilityLoad: 0.4, fit: { extraversion: 0.3 }, extraversionPay: 0.04, manual: false,
  },
  {
    id: 'operative', label: '공장 기계조작·조립', payRatio: r(W.machineOperatorsAssemblers), minSchooling: 'lessThanHighSchool',
    offerWeight: { lessThanHighSchool: 20, highSchool: 16, someCollege: 4 }, cyclicality: 1.5, layoffScale: 1.2, rungs: 2, rungStep: 0.08,
    matchSdScale: 0.8, abilityLoad: 0.3, fit: { conscientiousness: 0.1 }, manual: true,
  },
  {
    // RAND RB7510: 항공우주 노동자는 비항공 내구재 제조업보다 10~15% 더 벌었다.
    id: 'aerospaceAssembler', label: '항공기 조립·정비(항공우주)', payRatio: r(W.assemblers) * 1.125, minSchooling: 'highSchool',
    offerWeight: { highSchool: 2.5, someCollege: 1.5 }, cyclicality: 1.2, layoffScale: 0.9, rungs: 3, rungStep: 0.08,
    matchSdScale: 0.7, abilityLoad: 0.4, fit: { conscientiousness: 0.2 }, manual: true, aerospace: true,
  },
  {
    id: 'truckDriver', label: '트럭 운전', payRatio: r(W.truckDrivers), minSchooling: 'lessThanHighSchool',
    offerWeight: { lessThanHighSchool: 8, highSchool: 9, someCollege: 3 }, cyclicality: 1.2, layoffScale: 1.0, rungs: 1, rungStep: 0.1,
    matchSdScale: 0.8, abilityLoad: 0.2, fit: { extraversion: -0.1 }, manual: true,
  },
  {
    id: 'mechanic', label: '정비·수리·정밀가공', payRatio: r(W.mechanicsRepairers), minSchooling: 'lessThanHighSchool',
    offerWeight: { lessThanHighSchool: 5, highSchool: 9, someCollege: 5 }, cyclicality: 0.9, layoffScale: 0.8, rungs: 2, rungStep: 0.1,
    matchSdScale: 0.8, abilityLoad: 0.5, fit: { conscientiousness: 0.2, openness: -0.1 }, manual: true,
  },
  {
    id: 'constructionTrades', label: '건설 기능직(목수·전기·배관)', payRatio: r(W.constructionTrades), minSchooling: 'lessThanHighSchool',
    offerWeight: { lessThanHighSchool: 8, highSchool: 11, someCollege: 4 }, cyclicality: 1.8, layoffScale: 1.5, rungs: 2, rungStep: 0.12,
    matchSdScale: 0.9, abilityLoad: 0.4, fit: { riskTolerance: 0.2 }, manual: true,
  },
  {
    id: 'clerical', label: '사무·행정 보조', payRatio: r(W.generalOfficeClerks), minSchooling: 'highSchool',
    offerWeight: { highSchool: 5, someCollege: 6, bachelorsOrMore: 2 }, cyclicality: 0.8, layoffScale: 0.9, rungs: 2, rungStep: 0.1,
    matchSdScale: 0.7, abilityLoad: 0.5, fit: { conscientiousness: 0.3, extraversion: -0.1 }, manual: false,
  },
  {
    // 군 급여는 확인하지 못해 가정값(숙식·수당 포함 체감 수준). 복무 4년.
    id: 'military', label: '군 입대(사병)', payRatio: 0.75, minSchooling: 'highSchool',
    offerWeight: {}, cyclicality: 0, layoffScale: 0, rungs: 3, rungStep: 0.08,
    matchSdScale: 0.2, abilityLoad: 0.2, fit: {}, manual: true, termMonths: 48,
  },
  {
    id: 'salesRep', label: '영업(도매·제조)', payRatio: r(W.salesRepresentativesNonRetail), minSchooling: 'highSchool',
    offerWeight: { highSchool: 3, someCollege: 5, bachelorsOrMore: 6 }, cyclicality: 1.1, layoffScale: 1.2, rungs: 2, rungStep: 0.1,
    matchSdScale: 1.6, abilityLoad: 0.6, fit: { extraversion: 0.6, agreeableness: -0.1, riskTolerance: 0.2 }, extraversionPay: 0.08, manual: false,
  },
  {
    id: 'protectiveService', label: '경찰·소방', payRatio: (r(W.police) + r(W.firefighters)) / 2, minSchooling: 'highSchool',
    offerWeight: { highSchool: 1.5, someCollege: 3, bachelorsOrMore: 1.5 }, cyclicality: 0.2, layoffScale: 0.25, rungs: 3, rungStep: 0.1,
    matchSdScale: 0.4, abilityLoad: 0.3, fit: { conscientiousness: 0.3, riskTolerance: 0.2, neuroticism: -0.2 }, manual: true,
  },
  {
    id: 'technician', label: '기술자(전자·엔지니어링 테크니션)', payRatio: r(W.engineeringTechnicians), minSchooling: 'someCollege',
    offerWeight: { someCollege: 5, bachelorsOrMore: 2 }, cyclicality: 1.0, layoffScale: 0.9, rungs: 3, rungStep: 0.08,
    matchSdScale: 0.7, abilityLoad: 0.7, fit: { ability: 0.3, openness: 0.1 }, manual: false,
  },
  {
    id: 'nurse', label: '간호사·보건 기술직', payRatio: r(W.registeredNurses), minSchooling: 'someCollege',
    offerWeight: { someCollege: 1.2, bachelorsOrMore: 1.2 }, cyclicality: 0.1, layoffScale: 0.4, rungs: 2, rungStep: 0.08,
    matchSdScale: 0.5, abilityLoad: 0.5, fit: { agreeableness: 0.5, conscientiousness: 0.2 }, manual: false,
  },
  {
    id: 'teacher', label: '초중고 교사', payRatio: r(W.teachersExceptCollege), minSchooling: 'bachelorsOrMore',
    offerWeight: { bachelorsOrMore: 6, masters: 8 }, cyclicality: 0.1, layoffScale: 0.3, rungs: 3, rungStep: 0.08,
    matchSdScale: 0.3, abilityLoad: 0.4, fit: { agreeableness: 0.4, openness: 0.3, extraversion: 0.1 }, manual: false,
  },
  {
    id: 'businessProfessional', label: '회계·재무·경영 전문직', payRatio: r(W.accountantsAuditors), minSchooling: 'bachelorsOrMore',
    offerWeight: { someCollege: 1, bachelorsOrMore: 10, masters: 10 }, cyclicality: 0.7, layoffScale: 0.8, rungs: 3, rungStep: 0.12,
    matchSdScale: 1.1, abilityLoad: 1.0, fit: { conscientiousness: 0.3, ability: 0.3 }, manual: false,
  },
  {
    id: 'engineer', label: '엔지니어', payRatio: r(W.engineers), minSchooling: 'bachelorsOrMore',
    offerWeight: { bachelorsOrMore: 5, masters: 7 }, cyclicality: 0.8, layoffScale: 0.7, rungs: 3, rungStep: 0.1,
    matchSdScale: 0.7, abilityLoad: 1.2, fit: { ability: 0.9, openness: 0.1, extraversion: -0.1 }, manual: false,
  },
  {
    id: 'aerospaceEngineer', label: '항공우주 엔지니어', payRatio: r(W.aerospaceEngineers), minSchooling: 'bachelorsOrMore',
    offerWeight: { bachelorsOrMore: 0.8, masters: 1.2 }, cyclicality: 0.8, layoffScale: 0.7, rungs: 3, rungStep: 0.1,
    matchSdScale: 0.6, abilityLoad: 1.2, fit: { ability: 1.0 }, manual: false, aerospace: true,
  },
  {
    // 전산·과학·건축·사회복지·성직 등. 개별 중앙값이 없어 전문직 전체 남성 중앙값($939)을 쓴다.
    id: 'otherProfessional', label: '기타 전문직(전산·과학·건축·사회복지)', payRatio: r(W.professionalSpecialty), minSchooling: 'bachelorsOrMore',
    offerWeight: { bachelorsOrMore: 6, masters: 8 }, cyclicality: 0.6, layoffScale: 0.7, rungs: 3, rungStep: 0.1,
    matchSdScale: 0.9, abilityLoad: 1.0, fit: { openness: 0.4, ability: 0.4 }, manual: false,
  },
  {
    id: 'manager', label: '관리자·중간 경영진', payRatio: r(W.executiveAdministrativeManagerial), minSchooling: 'highSchool', minExperienceYears: 6,
    offerWeight: { highSchool: 1, someCollege: 2, bachelorsOrMore: 5, masters: 7 }, cyclicality: 0.8, layoffScale: 0.8, rungs: 4, rungStep: 0.15,
    matchSdScale: 1.3, abilityLoad: 0.9, fit: { conscientiousness: 0.4, extraversion: 0.4, agreeableness: -0.2 }, manual: false,
  },
  {
    id: 'professor', label: '교수·연구 과학자', payRatio: r(W.collegeTeachers), minSchooling: 'doctorate', requiresDegree: 'doctorate',
    offerWeight: { doctorate: 10 }, cyclicality: 0.1, layoffScale: 0.3, rungs: 3, rungStep: 0.15,
    matchSdScale: 0.6, abilityLoad: 1.0, fit: { openness: 0.3 }, manual: false,
  },
  {
    id: 'lawyer', label: '변호사', payRatio: r(W.lawyers), minSchooling: 'professional', requiresDegree: 'law',
    offerWeight: { professional: 10 }, cyclicality: 0.4, layoffScale: 0.4, rungs: 3, rungStep: 0.2,
    matchSdScale: 1.4, abilityLoad: 1.0, fit: { agreeableness: -0.2, extraversion: 0.2 }, manual: false,
  },
  {
    // 레지던트 3년(첫 칸)은 전문의 중앙값의 절반쯤 — 이후 자동 승급.
    id: 'physician', label: '의사', payRatio: r(W.physicians), minSchooling: 'professional', requiresDegree: 'medicine',
    offerWeight: { professional: 10 }, cyclicality: 0.05, layoffScale: 0.1, rungs: 2, rungStep: 0.7,
    matchSdScale: 1.0, abilityLoad: 0.8, fit: {}, manual: false, automaticRung: { afterMonths: 36 },
  },
];

export const OCCUPATION_BY_ID: Readonly<Record<OccupationId, Occupation>> = Object.fromEntries(
  OCCUPATIONS.map((o) => [o.id, o]),
) as Record<OccupationId, Occupation>;

/** 학생 아르바이트는 식당·소매에서. */
export const STUDENT_JOBS: readonly OccupationId[] = ['foodService', 'retailSales'];
