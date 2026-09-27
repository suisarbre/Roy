import { CALIBRATED_CAREER_PARAMS } from '../career/calibratedParams';
import type { Schooling } from '../career/occupations';
import { CAREER_STRUCTURE, INITIAL_CAREER_PARAMS, type CareerParams } from '../career/params';
import { buildWorker, drawWorker, inverseNormal } from '../career/population';
import type { Education, Worker } from '../career/types';
import type { Sex } from '../data';
import { gaussian } from '../marriage/population';
import type { Spouse } from '../marriage/types';
import { createRng } from '../rng';

/**
 * 한 사람 — Roy든 NPC든 같은 모양. 경력 모델(src/sim/career)과 결혼 모델(src/sim/marriage)이 각자
 * 따로 들고 있던 "기질·배경"을 하나로 합친 것. 한 번 뽑으면 바뀌지 않고, 모든 도메인 모델이 이
 * 프로필 하나를 읽는다: 경력은 `toWorker`, 결혼은 `toSpouse`, 실타래 관심 배분은 temperament.ts.
 *
 * 프로필은 `lifeSeed` 하나로 완전히 재현된다 — 게임 저장에는 프로필(작은 객체)만 넣으면 되고, 경력
 * 같은 긴 궤적은 필요할 때 다시 계산한다(careerTrack.ts, 같은 시드 = 같은 운).
 */

export interface PersonTraits {
  /** 인지 능력(z) — 부모 순위와 상관 0.3(경력 모델 가정). */
  ability: number;
  conscientiousness: number;
  neuroticism: number;
  agreeableness: number;
  openness: number;
  extraversion: number;
  riskTolerance: number;
  /** 돈 문제에 대한 불안 — 결혼 모델의 금전 갈등 경로 입구. */
  financialAnxiety: number;
  /** 생계부양자·결혼 규범에 대한 믿음. */
  traditionalism: number;
}

export interface PersonProfile {
  sex: Sex;
  birthYear: number;
  /** 생일 달(0~11). NPC는 sim/gameDate.ageInYearsAt과 맞추려고 0(1월)으로 둔다. */
  birthMonth: number;
  traits: PersonTraits;
  /** 부모 소득 백분위(0~1). */
  parentRank: number;
  parentsDivorced: boolean;
  education: Education;
  schooling: Schooling;
  degree?: 'law' | 'medicine' | 'doctorate';
  schoolExitAge: number;
  losAngeles: boolean;
  /** 이 사람의 모든 운(경력 궤적 등)을 재현하는 시드. */
  lifeSeed: number;
}

/** 결혼 모델의 가정(부모 이혼 경험 비율, 원문 미확인)과 같은 값. */
const PARENTS_DIVORCED_SHARE = 0.17;

export const DEFAULT_CAREER_PARAMS: CareerParams = { ...INITIAL_CAREER_PARAMS, ...CALIBRATED_CAREER_PARAMS };

export interface SampleProfileOptions {
  sex: Sex;
  birthYear: number;
  losAngeles?: boolean;
  /** 부분 지정 — 시나리오용(예: Linda의 금전 불안을 높게). 지정 안 한 값은 뽑는다. */
  traits?: Partial<PersonTraits>;
  parentRank?: number;
}

/**
 * 시드 하나에서 한 사람을 뽑는다. 학력은 경력 모델의 교육 잠재변수(능력·집안·성실성·개방성)로 정해진다.
 *
 * 한계: 학력 분포는 1960–64년생(1999 CPS 35–39세) 기준이다. 1930년대생 부모 세대는 실제로 학력이
 * 훨씬 낮았다 — 코호트별 학력 분포를 넣기 전까지는 부모 NPC의 학력이 높게 나온다.
 */
export function sampleProfile(seed: number, options: SampleProfileOptions, careerParams: CareerParams = DEFAULT_CAREER_PARAMS): PersonProfile {
  const rng = createRng(seed);
  const draw = drawWorker(rng, [options.birthYear, options.birthYear], options.losAngeles ?? true);
  draw.birthMonth = 0;
  if (options.parentRank !== undefined) draw.parentRank = options.parentRank;
  const financialAnxiety = gaussian(rng);
  const traditionalism = gaussian(rng);
  const parentsDivorced = rng() < PARENTS_DIVORCED_SHARE;
  const lifeSeed = Math.floor(rng() * 4294967296);

  const override = options.traits ?? {};
  for (const key of ['conscientiousness', 'neuroticism', 'agreeableness', 'openness', 'extraversion', 'riskTolerance'] as const) {
    if (override[key] !== undefined) draw.traits[key] = override[key]!;
  }
  if (override.ability !== undefined) {
    // 능력은 부모 순위와 섞여 만들어지므로(population.ts) 잡음 쪽을 역산해 원하는 값이 나오게 한다.
    const rho = CAREER_STRUCTURE.abilityParentCorrelation;
    const parentZ = inverseNormal(draw.parentRank);
    draw.abilityNoise = (override.ability - rho * parentZ) / Math.sqrt(1 - rho * rho);
  }
  const worker = buildWorker(draw, careerParams);

  return {
    sex: options.sex,
    birthYear: options.birthYear,
    birthMonth: 0,
    traits: {
      ...worker.traits,
      financialAnxiety: override.financialAnxiety ?? financialAnxiety,
      traditionalism: override.traditionalism ?? traditionalism,
    },
    parentRank: worker.parentRank,
    parentsDivorced,
    education: worker.education,
    schooling: worker.schooling,
    degree: worker.degree,
    schoolExitAge: worker.schoolExitAge,
    losAngeles: worker.losAngeles,
    lifeSeed,
  };
}

/** 경력 모델 입력으로. */
export function toWorker(profile: PersonProfile): Worker {
  const t = profile.traits;
  return {
    birthYear: profile.birthYear,
    birthMonth: profile.birthMonth,
    traits: {
      ability: t.ability,
      conscientiousness: t.conscientiousness,
      neuroticism: t.neuroticism,
      agreeableness: t.agreeableness,
      openness: t.openness,
      extraversion: t.extraversion,
      riskTolerance: t.riskTolerance,
    },
    parentRank: profile.parentRank,
    education: profile.education,
    schooling: profile.schooling,
    degree: profile.degree,
    schoolExitAge: profile.schoolExitAge,
    losAngeles: profile.losAngeles,
  };
}

/** 결혼 모델 입력으로(다음 단계: 결혼 모델이 이 프로필을 직접 받게 된다). */
export function toSpouse(profile: PersonProfile): Spouse {
  const t = profile.traits;
  return {
    sex: profile.sex,
    birthYear: profile.birthYear,
    education: profile.education,
    traits: {
      neuroticism: t.neuroticism,
      conscientiousness: t.conscientiousness,
      agreeableness: t.agreeableness,
      openness: t.openness,
      financialAnxiety: t.financialAnxiety,
      traditionalism: t.traditionalism,
    },
    parentsDivorced: profile.parentsDivorced,
  };
}
