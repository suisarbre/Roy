import { childhoodTractPoverty, drawRace, IMMIGRANT_SHARE, parentIncomeRank, parentWealthRank } from '../demography';
import { createRng, type Rng } from '../rng';
import { gaussian } from '../stats';
import type { Schooling } from './occupations';
import { CAREER_STRUCTURE as S, type CareerParams } from './params';
import { EDUCATIONS, type Education, type Race, type Worker, type WorkerTraits } from './types';

/** 표준정규 누적분포의 역함수(Acklam 근사, 상대오차 < 1.2e-9). */
export function inverseNormal(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  if (q < 0.02425) {
    const t = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1);
  }
  if (q > 1 - 0.02425) return -inverseNormal(1 - q);
  const t = q - 0.5;
  const r = t * t;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * t) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * 한 사람을 이루는 "운"의 원재료 — 파라미터와 무관하게 뽑아 두고, 학력 같은 파생값은 파라미터와
 * 합쳐 나중에 계산한다(공통 난수: 파라미터가 바뀌어도 같은 시드는 같은 사람).
 */
export interface WorkerDraw {
  birthYear: number;
  birthMonth: number;
  parentRank: number;
  abilityNoise: number;
  traits: Omit<WorkerTraits, 'ability'>;
  educationNoise: number;
  graduateNoise: number;
  graduateTypeRoll: number;
  exitAgeNoise: number;
  losAngeles: boolean;
  // ---- 출생 배경(src/sim/demography.ts) — 기존 추출 뒤에 뽑아 공통 난수를 지킨다 ----
  race: Race;
  immigrant: boolean;
  /** 부모 소득 잠재변수(인종 조건부 정규) — parentRank = 전국 혼합 CDF(이 값). */
  parentIncomeLatent: number;
  parentWealthRank: number;
  /** 자란 동네(센서스 트랙트)의 빈곤율 0~1. */
  childhoodPoverty: number;
  /** 원재료 — 인종을 바꿔 다시 유도할 때(시나리오). */
  parentRankRoll: number;
  immigrantRoll: number;
  wealthNoise: number;
  neighborhoodNoise: number;
}

/** 인종이 정해진 뒤의 출생 배경을 유도한다(parentRank는 인종 조건부로 바뀐다). */
export function applyBackground(draw: WorkerDraw, race: Race): void {
  draw.race = race;
  const { rank, latent } = parentIncomeRank(draw.parentRankRoll, race);
  draw.parentRank = rank;
  draw.parentIncomeLatent = latent;
  draw.parentWealthRank = parentWealthRank(latent, draw.wealthNoise, race);
  draw.childhoodPoverty = childhoodTractPoverty(rank, draw.neighborhoodNoise, race);
  draw.immigrant = draw.immigrantRoll < IMMIGRANT_SHARE[race];
}

export function drawWorker(rng: Rng, birthYears: readonly [number, number] = [1957, 1964], losAngeles?: boolean, race?: Race): WorkerDraw {
  const [minYear, maxYear] = birthYears;
  const draw: Omit<WorkerDraw, 'race' | 'immigrant' | 'parentIncomeLatent' | 'parentWealthRank' | 'childhoodPoverty' | 'parentRankRoll' | 'immigrantRoll' | 'wealthNoise' | 'neighborhoodNoise'> = {
    birthYear: minYear + Math.floor(rng() * (maxYear - minYear + 1)),
    birthMonth: Math.floor(rng() * 12),
    parentRank: rng(),
    abilityNoise: gaussian(rng),
    traits: {
      conscientiousness: gaussian(rng),
      neuroticism: gaussian(rng),
      agreeableness: gaussian(rng),
      openness: gaussian(rng),
      extraversion: gaussian(rng),
      riskTolerance: gaussian(rng),
    },
    educationNoise: gaussian(rng),
    graduateNoise: gaussian(rng),
    graduateTypeRoll: rng(),
    exitAgeNoise: gaussian(rng),
    losAngeles: losAngeles ?? rng() < S.losAngelesShare,
  };
  const raceRoll = rng();
  const full: WorkerDraw = {
    ...draw,
    race: race ?? drawRace(raceRoll, draw.birthYear, draw.losAngeles),
    immigrant: false,
    parentIncomeLatent: 0,
    parentWealthRank: 0.5,
    childhoodPoverty: 0.1,
    parentRankRoll: draw.parentRank,
    immigrantRoll: rng(),
    wealthNoise: gaussian(rng),
    neighborhoodNoise: gaussian(rng),
  };
  applyBackground(full, full.race);
  return full;
}

function abilityOf(draw: WorkerDraw): number {
  const rho = S.abilityParentCorrelation;
  return rho * inverseNormal(draw.parentRank) + Math.sqrt(1 - rho * rho) * draw.abilityNoise;
}

function educationLatent(draw: WorkerDraw, ability: number, p: CareerParams): number {
  return (
    ability +
    p.eduParentWeight * inverseNormal(draw.parentRank) +
    S.eduConscientiousness * draw.traits.conscientiousness +
    S.eduOpenness * draw.traits.openness +
    draw.educationNoise
  );
}

/** 교육 잠재변수는 정규분포의 합이라 정확히 정규 — 절단점을 해석적으로 구해 학력 비율을 정확히 맞춘다. */
function educationCutpoints(p: CareerParams): number[] {
  const rho = S.abilityParentCorrelation;
  const variance = (rho + p.eduParentWeight) ** 2 + (1 - rho * rho) + S.eduConscientiousness ** 2 + S.eduOpenness ** 2 + 1;
  const sd = Math.sqrt(variance);
  let cumulative = 0;
  return EDUCATIONS.slice(0, 3).map((education) => {
    cumulative += S.educationShare[education];
    return sd * inverseNormal(cumulative);
  });
}

function graduateScore(draw: WorkerDraw, ability: number): number {
  return ability + 0.5 * draw.traits.conscientiousness + draw.graduateNoise;
}

const graduateCutCache = new Map<string, number>();

/** 대졸자 중 상위 graduateShareOfBachelors가 대학원에 가는 기준 — 대졸자의 분포가 파라미터에 따라
 *  달라지므로 고정 시드 대표본으로 분위수를 구해 캐시한다. */
function graduateCut(p: CareerParams): number {
  const key = p.eduParentWeight.toFixed(3);
  const cached = graduateCutCache.get(key);
  if (cached !== undefined) return cached;
  const rng = createRng(424242);
  const cuts = educationCutpoints(p);
  const scores: number[] = [];
  for (let i = 0; i < 60000; i++) {
    const draw = drawWorker(rng);
    const ability = abilityOf(draw);
    if (educationLatent(draw, ability, p) >= cuts[2]) scores.push(graduateScore(draw, ability));
  }
  scores.sort((a, b) => a - b);
  const cut = scores[Math.floor(scores.length * (1 - S.graduateShareOfBachelors))];
  graduateCutCache.set(key, cut);
  return cut;
}

export function buildWorker(draw: WorkerDraw, p: CareerParams): Worker {
  const ability = abilityOf(draw);
  const latent = educationLatent(draw, ability, p);
  const cuts = educationCutpoints(p);
  const education: Education = latent < cuts[0] ? 'lessThanHighSchool' : latent < cuts[1] ? 'highSchool' : latent < cuts[2] ? 'someCollege' : 'bachelorsOrMore';

  let schooling: Schooling = education;
  let degree: Worker['degree'];
  let exitKey: keyof typeof S.schoolExitAge = education;
  if (education === 'bachelorsOrMore' && graduateScore(draw, ability) >= graduateCut(p)) {
    // 대학원 종류: 능력은 의대, 개방성은 박사, 외향성은 로스쿨 쪽으로 기운다(가정).
    const t = draw.traits;
    const weights = {
      masters: S.graduateMix.masters,
      law: S.graduateMix.law * Math.exp(0.3 * t.extraversion - 0.2 * t.agreeableness),
      medicine: S.graduateMix.medicine * Math.exp(0.8 * ability),
      doctorate: S.graduateMix.doctorate * Math.exp(0.5 * t.openness + 0.5 * ability),
    };
    const total = weights.masters + weights.law + weights.medicine + weights.doctorate;
    let roll = draw.graduateTypeRoll * total;
    const kind = (Object.keys(weights) as (keyof typeof weights)[]).find((k) => (roll -= weights[k]) <= 0) ?? 'masters';
    exitKey = kind;
    if (kind === 'masters') schooling = 'masters';
    else if (kind === 'doctorate') {
      schooling = 'doctorate';
      degree = 'doctorate';
    } else {
      schooling = 'professional';
      degree = kind === 'law' ? 'law' : 'medicine';
    }
  }

  const baseExit = S.schoolExitAge[exitKey];
  const spread = education === 'lessThanHighSchool' ? 0.7 : education === 'highSchool' ? 0.2 : 0.8;
  const schoolExitAge = Math.max(16, baseExit + spread * Math.max(-1.5, Math.min(2.5, draw.exitAgeNoise)));

  return {
    birthYear: draw.birthYear,
    birthMonth: draw.birthMonth,
    traits: { ability, ...draw.traits },
    parentRank: draw.parentRank,
    education,
    schooling,
    degree,
    schoolExitAge,
    losAngeles: draw.losAngeles,
    race: draw.race,
    immigrant: draw.immigrant,
    childhoodPoverty: draw.childhoodPoverty,
    parentWealthRank: draw.parentWealthRank,
  };
}
