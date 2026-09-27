import { createCareerStepper, type CareerStepResult } from '../career/model';
import type { CareerParams } from '../career/params';
import { DEFAULT_CAREER_PARAMS, sampleProfile, toSpouse, toWorker, type PersonProfile } from '../person/profile';
import { createRng, type Rng } from '../rng';
import { gaussian } from '../stats';
import { FIXED_ASSUMPTIONS } from './params';
import type { Couple, HusbandTrack } from './types';

export { gaussian, sigmoid } from '../stats';

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function nextSeed(rng: Rng): number {
  return Math.floor(rng() * 4294967296);
}

/**
 * NLSY79 코호트(1957–64년생) 남성과 그 아내의 첫 결혼 하나. 두 사람은 sim/person 프로필 — 학력은
 * 경력 모델의 교육 잠재변수(능력·집안·성실성·개방성)에서 나오고, 기질은 경력과 결혼이 같이 본다.
 *
 * 동류혼(가정 0.6): 아내 후보를 최대 8명 뽑아 학력이 남편과 같은 첫 사람을 고른다 — 학력을 덮어쓰지
 * 않으므로 아내의 능력·집안과 학력의 관계가 유지된다.
 *
 * 전부 한 rng에서 뽑으므로 같은 시드는 같은 부부다(공통 난수). 학력 절단점이 eduParentWeight에
 * 달려 있어 경력 파라미터가 바뀌면 부부도 바뀐다 — 결혼 보정 동안 경력 파라미터는 고정이다.
 */
export function sampleHousehold(rng: Rng, careerParams: CareerParams = DEFAULT_CAREER_PARAMS): Couple {
  const [minYear, maxYear] = FIXED_ASSUMPTIONS.husbandBirthYears;
  const husbandBirthYear = minYear + Math.floor(rng() * (maxYear - minYear + 1));
  const husbandProfile = sampleProfile(nextSeed(rng), { sex: 'male', birthYear: husbandBirthYear }, careerParams);

  const husbandAgeAtMarriage = clamp(
    FIXED_ASSUMPTIONS.meanAgeAtMarriageByEducation[husbandProfile.education] + gaussian(rng) * FIXED_ASSUMPTIONS.ageAtMarriageSd,
    18,
    45,
  );
  const wifeAgeAtMarriage = clamp(husbandAgeAtMarriage - 2 + gaussian(rng) * 2, 17, 45);
  const marriedAtMonth = husbandBirthYear * 12 + Math.round(husbandAgeAtMarriage * 12);
  const wifeBirthYear = Math.floor(marriedAtMonth / 12 - wifeAgeAtMarriage);

  const wantSameEducation = rng() < FIXED_ASSUMPTIONS.educationHomogamy;
  let wifeProfile: PersonProfile | undefined;
  for (let k = 0; k < 8; k++) {
    const candidate = sampleProfile(nextSeed(rng), { sex: 'female', birthYear: wifeBirthYear }, careerParams);
    if (!wifeProfile) wifeProfile = candidate;
    if (!wantSameEducation) break;
    if (candidate.education === husbandProfile.education) {
      wifeProfile = candidate;
      break;
    }
  }
  const desiredChildren = gaussian(rng);

  return {
    husband: toSpouse(husbandProfile),
    wife: toSpouse(wifeProfile!),
    husbandProfile,
    wifeProfile: wifeProfile!,
    marriedAtMonth,
    husbandAgeAtMarriage,
    wifeAgeAtMarriage: (marriedAtMonth - wifeBirthYear * 12) / 12,
    desiredChildren,
  };
}

/** 비혼 여성(여성 노동 적률의 모집단 일부). */
export function sampleSingleWoman(rng: Rng, careerParams: CareerParams = DEFAULT_CAREER_PARAMS): PersonProfile {
  const [minYear, maxYear] = FIXED_ASSUMPTIONS.husbandBirthYears;
  const birthYear = minYear + Math.floor(rng() * (maxYear - minYear + 1));
  return sampleProfile(nextSeed(rng), { sex: 'female', birthYear }, careerParams);
}

/** 남편의 경력을 16~60세까지 굴려 결혼 모델이 읽는 압축 궤적으로. 결혼과 무관하므로 보정 내내 재사용. */
export function buildHusbandTrack(profile: PersonProfile, careerParams: CareerParams = DEFAULT_CAREER_PARAMS, untilAge = 60, collect?: CareerStepResult[]): HusbandTrack {
  const stepper = createCareerStepper(toWorker(profile), careerParams, createRng(profile.lifeSeed), { untilAge });
  const months = (untilAge - 16) * 12;
  const employment = new Uint8Array(months);
  const shock = new Uint8Array(months);
  const earnings = new Float32Array(months);
  let i = 0;
  for (let r = stepper.step(); r && i < months; r = stepper.step(), i++) {
    collect?.push(r);
    const out = r.state === 'unemployed' || (r.state === 'outOfLaborForce' && !r.disabled);
    employment[i] = r.disabled ? 2 : out ? 1 : 0;
    shock[i] = r.eventKind === 'laidOff' ? 1 : r.eventKind === 'plantClosing' ? 2 : r.eventKind === 'disabled' ? 3 : 0;
    earnings[i] = r.earnings;
  }
  const outcome = stepper.finish();
  const wages: number[] = [];
  for (const y of outcome.years) {
    if (y && y.age >= 18 && y.age <= 64 && y.occupationAtBirthday && y.occupationAtBirthday !== 'military' && Number.isFinite(y.logWageAtBirthday)) {
      wages.push(Math.exp(y.logWageAtBirthday));
    }
  }
  return {
    startTotalMonth: profile.birthYear * 12 + profile.birthMonth + 16 * 12,
    employment,
    shock,
    earnings,
    birthdayWages: Float32Array.from(wages),
  };
}
