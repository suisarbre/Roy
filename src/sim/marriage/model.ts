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
 * 출산(3과 4 사이): 희망 자녀 수에 못 미치면 나이별 가임력 × sigmoid(속도 + 헌신 − 금전 스트레스)로
 * 출산, 채웠으면 계획 외 출산만. 자녀는 투자(떠나기 어려움)를 올리고, 6세 미만이면 양육 스트레스를
 * 더하고, 태어난 달에 만족도를 깎는다. 흔들리는 부부는 출산을 미룬다(Lillard & Waite 1993의 양방향).
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

export function desiredChildrenFor(couple: Couple, p: MarriageParams): number {
  const traditionalism = (couple.husband.traits.traditionalism + couple.wife.traits.traditionalism) / 2;
  const raw =
    p.desireBase -
    (couple.wife.education === 'bachelorsOrMore' ? p.desireCollegeDrop : 0) +
    S.DESIRE_TRADITIONALISM * traditionalism +
    S.DESIRE_SD * couple.desiredChildren;
  return Math.max(0, Math.round(raw));
}

/** 이번 달 "시도하면 출산으로 이어질" 확률 — 30세까지 평탄, 45세에 0. */
export function monthlyFecundity(wifeAge: number): number {
  const { fecundityPeakMonthly: peak, fecundityDeclineStartAge: start, fecundityEndAge: end } = FIXED_ASSUMPTIONS;
  if (wifeAge < 16 || wifeAge >= end) return 0;
  if (wifeAge <= start) return peak;
  return peak * (1 - (wifeAge - start) / (end - start));
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
  const desired = desiredChildrenFor(couple, p);
  const birthDurations: number[] = [];
  let lastCommitment = 1; // 첫 달의 출산 판단용(신혼은 안정적이라고 본다)
  let wifeDied = false;
  let wifeAgeAtEnd = couple.wifeAgeAtMarriage;
  const layoffRate = FIXED_ASSUMPTIONS.monthlyLayoffByEducation[husband.education];

  let endReason: MarriageEndReason = 'censored';
  let duration = 0;

  for (; ; duration++) {
    const month = couple.marriedAtMonth + duration;
    const husbandAge = (month - husband.birthYear * 12) / 12;
    const wifeAge = (month - wife.birthYear * 12) / 12;

    wifeAgeAtEnd = wifeAge;
    if (husbandAge >= options.censorAtHusbandAge) {
      endReason = 'censored';
      break;
    }
    const husbandDies = rng() < monthlyDeathProbability(husband.birthYear, 'male', husbandAge);
    const wifeDies = rng() < monthlyDeathProbability(wife.birthYear, 'female', wifeAge);
    if (husbandDies || wifeDies) {
      endReason = 'widowed';
      wifeDied = wifeDies;
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
    const financialWifeStress = blocked ? 0 : householdStrain + wifeThreat + wifeBlame;
    const financialHusbandStress = blocked ? 0 : householdStrain + husbandThreat;

    // ---- 출산 ----
    const children = birthDurations.length;
    const lastBirth = children > 0 ? birthDurations[children - 1] : undefined;
    const spacingOk = lastBirth === undefined || duration - lastBirth >= S.MIN_BIRTH_SPACING_MONTHS;
    let birthThisMonth = false;
    if (spacingOk) {
      const wanting = children < desired;
      const readiness = sigmoid(p.birthPace + p.birthCommitment * lastCommitment - p.birthStressAversion * Math.max(0, financialWifeStress));
      const chance = monthlyFecundity(wifeAge) * (wanting ? readiness : S.UNPLANNED_BIRTH_RATIO);
      if (rng() < chance) {
        birthDurations.push(duration);
        birthThisMonth = true;
      }
    }
    const childrenNow = birthDurations.length;
    const youngestAge = childrenNow > 0 ? duration - birthDurations[childrenNow - 1] : undefined;
    let youngChildren = 0;
    let childBond = 0;
    for (const b of birthDurations) {
      const age = duration - b;
      if (age < S.YOUNG_CHILD_MONTHS) youngChildren += 1;
      childBond +=
        age < S.INFANT_MONTHS
          ? S.INFANT_BOND_MULTIPLIER
          : age < S.CHILD_BOND_FULL_UNTIL_MONTHS
          ? 1
          : Math.max(S.CHILD_BOND_FLOOR, 1 - ((1 - S.CHILD_BOND_FLOOR) * (age - S.CHILD_BOND_FULL_UNTIL_MONTHS)) / (216 - S.CHILD_BOND_FULL_UNTIL_MONTHS));
    }
    const parentingStrain = p.youngChildStrain * youngChildren;

    const wifeStress = financialWifeStress + parentingStrain;
    const husbandStress = financialHusbandStress + parentingStrain;

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
      (confronts === 2 ? S.MUTUAL_CONFRONT_LOSS : 0) -
      (birthThisMonth ? p.postBirthDip : 0) +
      gaussian(rng) * S.SATISFACTION_NOISE;
    scar = scar * (1 - S.SCAR_HEAL_RATE) + S.SCAR_PER_CONFRONT * confronts;

    // ---- 6. 헌신 ----
    const investment = p.investmentPerLogYear * Math.log1p(duration / 12) + p.childInvestment * childBond;
    const husbandCommitment = satisfaction + investment - alternatives(husband, husbandAge, p) + barrier(husband, false, p);
    const wifeCommitment = satisfaction + investment - alternatives(wife, wifeAge, p) + barrier(wife, couple.wifeIsHomemaker, p);

    // ---- 7. 떠남 ----
    lastCommitment = (husbandCommitment + wifeCommitment) / 2;
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
      childrenCount: childrenNow,
      youngestChildAgeMonths: youngestAge,
      birthThisMonth,
    };
    onMonth?.(record, couple);
    if (keepMonths) months.push(record);

    if (leaver) {
      endReason = 'divorce';
      duration += 1;
      break;
    }
  }

  // 완결 출산 모집단: 아내가 45세까지 산 결혼. 이혼·남편 사망으로 끝난 결혼은 그 뒤 아내가 45세까지
  // 살았다고 본다(결혼 중 출산만 센다). 아내 사망이나 관측 종료가 45세 전에 오면 제외.
  const wifeReached45 = wifeAgeAtEnd >= 45 || endReason === 'divorce' || (endReason === 'widowed' && !wifeDied);
  return { couple, endReason, durationMonths: duration, months, birthDurations, wifeReached45 };
}
