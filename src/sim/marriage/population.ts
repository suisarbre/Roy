import type { Rng } from '../rng';
import { FIXED_ASSUMPTIONS } from './params';
import { EDUCATIONS, type Couple, type Education, type Spouse, type Traits } from './types';

/** 표준정규 난수(Box–Muller). */
export function gaussian(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function logit(p: number): number {
  return Math.log(p / (1 - p));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function sampleEducation(rng: Rng): Education {
  let roll = rng();
  for (const education of EDUCATIONS) {
    roll -= FIXED_ASSUMPTIONS.educationShare[education];
    if (roll <= 0) return education;
  }
  return 'bachelorsOrMore';
}

export function sampleTraits(rng: Rng): Traits {
  return {
    neuroticism: gaussian(rng),
    conscientiousness: gaussian(rng),
    agreeableness: gaussian(rng),
    openness: gaussian(rng),
    financialAnxiety: gaussian(rng),
    traditionalism: gaussian(rng),
  };
}

/**
 * NLSY79 코호트(1957–64년생) 남성과 그 배우자로 이뤄진 첫 결혼 하나를 뽑는다. 배우자 간 기질
 * 상관(동류혼)은 무시한다(가정). 전부 couple 전용 rng에서 뽑아서 파라미터가 바뀌어도 같은 시드면
 * 같은 부부가 나온다(공통 난수 — 보정의 매끄러움에 중요).
 */
export function sampleCouple(rng: Rng): Couple {
  const [minYear, maxYear] = FIXED_ASSUMPTIONS.husbandBirthYears;
  const husbandBirthYear = minYear + Math.floor(rng() * (maxYear - minYear + 1));
  const husbandEducation = sampleEducation(rng);
  const wifeEducation = rng() < FIXED_ASSUMPTIONS.educationHomogamy ? husbandEducation : sampleEducation(rng);

  const husbandAgeAtMarriage = clamp(
    FIXED_ASSUMPTIONS.meanAgeAtMarriageByEducation[husbandEducation] + gaussian(rng) * FIXED_ASSUMPTIONS.ageAtMarriageSd,
    18,
    45,
  );
  const wifeAgeAtMarriage = clamp(husbandAgeAtMarriage - 2 + gaussian(rng) * 2, 17, 45);

  const marriedAtMonth = husbandBirthYear * 12 + Math.round(husbandAgeAtMarriage * 12);
  const wifeBirthYear = Math.floor(marriedAtMonth / 12 - wifeAgeAtMarriage);

  const husband: Spouse = {
    sex: 'male',
    birthYear: husbandBirthYear,
    education: husbandEducation,
    traits: sampleTraits(rng),
    parentsDivorced: rng() < FIXED_ASSUMPTIONS.parentsDivorcedShare,
  };
  const wife: Spouse = {
    sex: 'female',
    birthYear: wifeBirthYear,
    education: wifeEducation,
    traits: sampleTraits(rng),
    parentsDivorced: rng() < FIXED_ASSUMPTIONS.parentsDivorcedShare,
  };

  // 전업주부는 전통성이 높을수록, 대졸일수록 덜(가정). 평균 비율은 homemakerShare 근처.
  const homemakerLogit = logit(FIXED_ASSUMPTIONS.homemakerShare) + 0.5 * wife.traits.traditionalism - 0.5 * (wifeEducation === 'bachelorsOrMore' ? 1 : 0);
  const wifeIsHomemaker = rng() < sigmoid(homemakerLogit);

  return { husband, wife, marriedAtMonth, husbandAgeAtMarriage, wifeAgeAtMarriage, wifeIsHomemaker };
}
