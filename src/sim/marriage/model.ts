import { monthlyDeathProbability } from '../data';
import type { Rng } from '../rng';
import { FIXED_ASSUMPTIONS, STRUCTURE as S, type MarriageParams } from './params';
import { gaussian, sigmoid } from './population';
import type {
  Behavior,
  Couple,
  EmploymentState,
  Education,
  JobShockKind,
  MarriageEndReason,
  MarriageOutcome,
  MonthRecord,
  SimulateOptions,
  Spouse,
} from './types';

/**
 * 결혼 행위자 모델 — 한 달 루프.
 *
 *   1. 사망/관측 종료 확인
 *   2. 남편 고용 전이(해고·공장 폐쇄·장애·재취업) — 결혼 모델 바깥 세계(가정값)
 *   3. 평가: 각자의 금전 스트레스 = 만성 경제 긴장(학력) + 실직 위협(금전 불안·외벌이로 증폭)
 *      + (아내) 해고에 대한 비난(전통성으로 증폭, 공장 폐쇄는 거의 0)
 *   4. 행동: 지지/중립/대립 로짓 선택 — 기질이 효용을 정하고 스트레스는 대립 쪽으로 민다
 *   5. 결혼 만족도(부부 공유): 지지는 올리고 대립은 깎고, 대립은 설정점을 깎는 흉터를 남긴다
 *   6. 헌신(각자) = 만족도 + 투자(결혼 연수) − 대안(젊음·개방성) + 장벽(전통성·부모 이혼·전업주부)
 *   7. 떠남: 월간 확률 sigmoid(절편 − 헌신). 한 명이라도 떠나면 이혼.
 *
 * 이혼 확률은 어디에도 직접 쓰여 있지 않다. 기질은 오직 행동·대안·장벽을 통해서만 작동한다
 * (Solomon & Jackson 2014: 기질 효과는 만족도를 거쳐 간다).
 */

const EDUCATION_RANK: Record<Education, number> = { lessThanHighSchool: 0, highSchool: 1, someCollege: 2, bachelorsOrMore: 3 };

export function chronicStrain(education: Education, p: MarriageParams): number {
  const rank = EDUCATION_RANK[education];
  const steps = Math.min(rank, 2);
  const collegeDrop = rank === 3 ? p.chronicStrainCollegeDrop : 0;
  return p.chronicStrainBase - p.chronicStrainPerStep * steps - collegeDrop;
}

function chooseBehavior(spouse: Spouse, stress: number, sympathy: number, p: MarriageParams, rng: Rng): Behavior {
  const t = spouse.traits;
  // 연민(배우자 장애)은 지지를 끌어올리는 동시에 대립을 누른다 — "그의 탓이 아닌 불운".
  const uConfront = p.confrontBase + p.confrontNeuroticism * t.neuroticism + S.STRESS_TO_CONFRONT * stress - sympathy;
  const uSupport =
    S.SUPPORT_BASE + p.supportAgreeableness * t.agreeableness + p.supportConscientiousness * t.conscientiousness + S.STRESS_TO_SUPPORT * stress + sympathy;
  const eC = Math.exp(uConfront);
  const eS = Math.exp(uSupport);
  const total = eC + eS + 1;
  const roll = rng() * total;
  if (roll < eS) return 'support';
  if (roll < eS + eC) return 'confront';
  return 'neutral';
}

function alternatives(spouse: Spouse, ageYears: number, p: MarriageParams): number {
  return S.ALTERNATIVES_BASE + p.alternativesYouth * Math.max(0, 32 - ageYears) + p.alternativesOpenness * spouse.traits.openness;
}

function barrier(spouse: Spouse, isHomemakerWife: boolean, p: MarriageParams): number {
  return (
    S.BARRIER_TRADITIONALISM * spouse.traits.traditionalism -
    (spouse.parentsDivorced ? p.parentalDivorceBarrierDrop : 0) +
    (isHomemakerWife ? p.homemakerBarrier : 0)
  );
}

export function simulateCouple(
  couple: Couple,
  p: MarriageParams,
  rng: Rng,
  options: SimulateOptions,
  onMonth?: (record: MonthRecord, couple: Couple) => void,
): MarriageOutcome {
  const { husband, wife } = couple;
  const keepMonths = options.keepMonths ?? true;
  const months: MonthRecord[] = [];

  let satisfaction = S.SET_POINT + p.honeymoonBoost + gaussian(rng) * S.SATISFACTION_INITIAL_SD;
  let scar = 0;
  let employment: EmploymentState = 'employed';
  let lastShock: JobShockKind | undefined;
  let monthsSinceShock: number | undefined;
  let wifeBlame = 0;

  const householdStrain = chronicStrain(husband.education, p) + (couple.wifeIsHomemaker ? S.SINGLE_INCOME_STRAIN : 0);
  const layoffRate = FIXED_ASSUMPTIONS.monthlyLayoffByEducation[husband.education];

  let endReason: MarriageEndReason = 'censored';
  let duration = 0;

  for (; ; duration++) {
    const month = couple.marriedAtMonth + duration;
    const husbandAge = (month - husband.birthYear * 12) / 12;
    const wifeAge = (month - wife.birthYear * 12) / 12;

    if (husbandAge >= options.censorAtHusbandAge) {
      endReason = 'censored';
      break;
    }
    if (rng() < monthlyDeathProbability(husband.birthYear, 'male', husbandAge) || rng() < monthlyDeathProbability(wife.birthYear, 'female', wifeAge)) {
      endReason = 'widowed';
      break;
    }

    // ---- 2. 고용 ----
    let shock: JobShockKind | undefined;
    if (options.forcedShock && options.forcedShock.atDuration === duration) {
      shock = options.forcedShock.kind;
    } else if (employment === 'employed' && !options.forcedShock) {
      const r = rng();
      if (r < layoffRate) shock = 'layoff';
      else if (r < layoffRate + FIXED_ASSUMPTIONS.monthlyPlantClosing) shock = 'plantClosing';
      else if (r < layoffRate + FIXED_ASSUMPTIONS.monthlyPlantClosing + FIXED_ASSUMPTIONS.monthlyDisability) shock = 'disability';
    } else if (employment === 'unemployed') {
      if (rng() < FIXED_ASSUMPTIONS.monthlyReemployment) employment = 'employed';
    } else if (employment === 'disabled') {
      if (rng() < FIXED_ASSUMPTIONS.monthlyDisabilityRecovery) employment = 'employed';
    }

    if (shock) {
      employment = shock === 'disability' ? 'disabled' : 'unemployed';
      lastShock = shock;
      monthsSinceShock = 0;
      const blameScale = Math.max(0, 1 + S.BLAME_TRADITIONALISM * wife.traits.traditionalism);
      wifeBlame = shock === 'layoff' ? p.layoffBlame * blameScale : shock === 'plantClosing' ? p.layoffBlame * S.BLAME_PLANT_RATIO * blameScale : 0;
    } else if (monthsSinceShock !== undefined) {
      monthsSinceShock += 1;
      if (employment === 'employed') wifeBlame *= 1 - S.BLAME_DECAY;
    }

    // ---- 3. 평가 ----
    const notFullTime = employment !== 'employed';
    const threatScale = employment === 'disabled' ? S.DISABILITY_THREAT_RATIO : 1;
    const wifeThreat = notFullTime
      ? threatScale * p.jobLossThreat * Math.max(0, 1 + S.THREAT_FINANCIAL_ANXIETY * wife.traits.financialAnxiety) * (couple.wifeIsHomemaker ? S.THREAT_HOMEMAKER_MULTIPLIER : 1)
      : 0;
    const husbandThreat = notFullTime
      ? threatScale * p.jobLossThreat *
        Math.max(0, 1 + S.THREAT_FINANCIAL_ANXIETY * husband.traits.financialAnxiety + S.HUSBAND_SHAME_TRADITIONALISM * husband.traits.traditionalism)
      : 0;

    const blocked = options.disableFinancialConflict === true;
    const wifeStress = blocked ? 0 : householdStrain + wifeThreat + wifeBlame;
    const husbandStress = blocked ? 0 : householdStrain + husbandThreat;

    // ---- 4. 행동 ----
    const wifeSympathy = employment === 'disabled' ? p.supportSympathy : 0;
    // 장애는 본인에게도 "내 탓이 아닌" 사건이라 아내의 연민이 남편의 방어적 대립도 누그러뜨린다고 본다(절반).
    const husbandBehavior = chooseBehavior(husband, husbandStress, wifeSympathy / 2, p, rng);
    const wifeBehavior = chooseBehavior(wife, wifeStress, wifeSympathy, p, rng);
    const confronts = (husbandBehavior === 'confront' ? 1 : 0) + (wifeBehavior === 'confront' ? 1 : 0);
    const supports = (husbandBehavior === 'support' ? 1 : 0) + (wifeBehavior === 'support' ? 1 : 0);

    // ---- 5. 만족도 ----
    const setPoint = S.SET_POINT - scar;
    satisfaction +=
      S.SATISFACTION_REVERSION * (setPoint - satisfaction) +
      S.SUPPORT_GAIN * supports -
      S.CONFRONT_LOSS * confronts -
      (confronts === 2 ? S.MUTUAL_CONFRONT_LOSS : 0) +
      gaussian(rng) * S.SATISFACTION_NOISE;
    scar = scar * (1 - S.SCAR_HEAL_RATE) + S.SCAR_PER_CONFRONT * confronts;

    // ---- 6. 헌신 ----
    const investment = p.investmentPerLogYear * Math.log1p(duration / 12);
    const husbandCommitment = satisfaction + investment - alternatives(husband, husbandAge, p) + barrier(husband, false, p);
    const wifeCommitment = satisfaction + investment - alternatives(wife, wifeAge, p) + barrier(wife, couple.wifeIsHomemaker, p);

    // ---- 7. 떠남 ----
    let leaver: 'husband' | 'wife' | undefined;
    if (rng() < sigmoid(p.leaveIntercept - S.LEAVE_SLOPE * husbandCommitment)) leaver = 'husband';
    else if (rng() < sigmoid(p.leaveIntercept - S.LEAVE_SLOPE * wifeCommitment)) leaver = 'wife';

    const record: MonthRecord = {
      duration,
      husbandEmployment: employment,
      lastShock,
      monthsSinceShock,
      husbandBehavior,
      wifeBehavior,
      financialConflict: confronts > 0 && (notFullTime || wifeBlame > 0.1),
      satisfaction,
      husbandCommitment,
      wifeCommitment,
      divorcedThisMonth: leaver !== undefined,
      leaver,
    };
    onMonth?.(record, couple);
    if (keepMonths) months.push(record);

    if (leaver) {
      endReason = 'divorce';
      duration += 1;
      break;
    }
  }

  return { couple, endReason, durationMonths: duration, months };
}
