import { createCareerStepper, type CareerStepResult } from '../career/model';
import type { CareerParams } from '../career/params';
import type { HouseholdContext, WomenLaborParams } from '../career/types';
import { monthlyDeathProbability } from '../data';
import { DEFAULT_CAREER_PARAMS, toWorker } from '../person/profile';
import { createRng, type Rng } from '../rng';
import { gaussian, mixSeed, sigmoid } from '../stats';
import { FIXED_ASSUMPTIONS, STRUCTURE as S, type MarriageParams } from './params';
import type {
  Behavior,
  Couple,
  EmploymentState,
  Education,
  HusbandTrack,
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
 *   2. 남편 고용 — 남편 자신의 경력 궤적(경력 행위자 모델: 해고·공장 폐쇄·장애·그만둠·재취업)을 읽는다.
 *      아내의 경력은 같은 달에 한 칸 진행한다: 출산하면 떠날 수 있고, 아이가 크거나 이혼하면 돌아온다.
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

const SHOCK_KINDS: readonly (JobShockKind | undefined)[] = [undefined, 'layoff', 'plantClosing', 'disability'];
const EMPLOYMENT_STATES: readonly EmploymentState[] = ['employed', 'unemployed', 'disabled'];

export interface HouseholdInputs {
  husbandTrack: HusbandTrack;
  women: WomenLaborParams;
  careerParams?: CareerParams;
  /** 이 부부의 운(달마다 (seed, 개월)로 재시작 — 공통 난수). */
  seed: number;
}

function stepWife(
  stepper: ReturnType<typeof createCareerStepper>,
  ctx: HouseholdContext,
  onWifeMonth: SimulateOptions['onWifeMonth'],
): CareerStepResult | undefined {
  const result = stepper.step(ctx);
  if (result) onWifeMonth?.(result, ctx.youngestChildAgeMonths);
  return result;
}

/** 한 부부(결합)의 상태 — 결혼 모델의 월 루프가 들고 다니는 것 전부. 세계(src/sim/world)도 같은 상태를 쓴다. */
export interface UnionState {
  satisfaction: number;
  scar: number;
  employment: EmploymentState;
  lastShock?: JobShockKind;
  monthsSinceShock?: number;
  wifeBlame: number;
  birthDurations: number[];
  lastCommitment: number;
  /** 결합 후 경과 개월(다음 step이 처리할 달). */
  duration: number;
  desired: number;
  baseStrain: number;
  /** 이 결합 전에 이미 있던 자녀(재혼·동거) — 희망 자녀 수를 채웠는지 셀 때 더한다. */
  priorChildren: number;
}

export function createUnionState(couple: Couple, p: MarriageParams, rng: Rng): UnionState {
  return {
    satisfaction: S.SET_POINT + p.honeymoonBoost + gaussian(rng) * S.SATISFACTION_INITIAL_SD,
    scar: 0,
    employment: 'employed',
    wifeBlame: 0,
    birthDurations: [],
    lastCommitment: 1, // 첫 달의 출산 판단용(신혼은 안정적이라고 본다)
    duration: 0,
    desired: desiredChildrenFor(couple, p),
    baseStrain: chronicStrain(couple.husband.education, p),
    priorChildren: 0,
  };
}

export interface UnionMonthInputs {
  husbandAge: number;
  wifeAge: number;
  /** 남편의 이번 달 고용과 충격(경력 궤적에서). */
  employment: EmploymentState;
  shock?: JobShockKind;
  /** 아내의 지난달 경력 결과. */
  wifeLast?: CareerStepResult;
  forceWifeAtHome?: boolean;
  disableFinancialConflict?: boolean;
  /** 계획 외 출산의 상대 확률(기본 S.UNPLANNED_BIRTH_RATIO) — 연애·동거 단계는 세계 파라미터로 바꾼다. */
  unplannedRatio?: number;
  /** 원하는 자녀가 있어도 계획 출산을 하지 않는 단계(연애·외도). */
  noPlannedBirths?: boolean;
  /** 대안의 추가분(외도 상대가 실제로 있을 때) — 남편·아내 각각. */
  extraAlternatives?: { husband: number; wife: number };
  /** 출산 결정 직후, 행동 전에 불린다 — 아내의 경력을 한 칸 진행하고 그 결과를 돌려준다(없으면 그대로). */
  onBirthsDecided?: (birthThisMonth: boolean, youngestAgeMonths: number | undefined) => CareerStepResult | undefined;
}

export interface UnionMonthResult {
  record: MonthRecord;
  wifeLast?: CareerStepResult;
}

/**
 * 결합 한 달. 평가 → 출산 → (아내 경력 한 칸) → 행동 → 만족도 → 헌신 → 떠남. 사망과 관측 종료는 부르는
 * 쪽이 먼저 확인한다. 끝나면 state.duration이 1 늘어난다.
 */
export function stepUnionMonth(state: UnionState, couple: Couple, p: MarriageParams, inputs: UnionMonthInputs, rng: Rng): UnionMonthResult {
  const { husband, wife } = couple;
  const duration = state.duration;
  const { husbandAge, wifeAge } = inputs;
  state.employment = inputs.employment;
  const employment = state.employment;
  const shock = inputs.shock;

  if (shock) {
    state.lastShock = shock;
    state.monthsSinceShock = 0;
    const blameScale = Math.max(0, 1 + S.BLAME_TRADITIONALISM * wife.traits.traditionalism);
    state.wifeBlame = shock === 'layoff' ? p.layoffBlame * blameScale : shock === 'plantClosing' ? p.layoffBlame * S.BLAME_PLANT_RATIO * blameScale : 0;
  } else if (state.monthsSinceShock !== undefined) {
    state.monthsSinceShock += 1;
    if (employment === 'employed') state.wifeBlame *= 1 - S.BLAME_DECAY;
  }

  // 아내의 지난달 상태(이번 달 평가에 쓰는 사실).
  let wifeLast = inputs.wifeLast;
  const wifeAtHome = inputs.forceWifeAtHome ?? (wifeLast?.atHome ?? false);
  const wifeEmployed = inputs.forceWifeAtHome !== undefined ? !inputs.forceWifeAtHome : wifeLast?.state === 'employed' || wifeLast?.state === 'selfEmployed';
  const householdStrain = state.baseStrain + (wifeAtHome ? S.SINGLE_INCOME_STRAIN : 0);

  // ---- 3. 평가 ----
  const notFullTime = employment !== 'employed';
  const threatScale = employment === 'disabled' ? S.DISABILITY_THREAT_RATIO : 1;
  const wifeThreat = notFullTime
    ? threatScale * p.jobLossThreat * Math.max(0, 1 + S.THREAT_FINANCIAL_ANXIETY * wife.traits.financialAnxiety) * (wifeAtHome ? S.THREAT_HOMEMAKER_MULTIPLIER : 1)
    : 0;
  const husbandThreat = notFullTime
    ? threatScale * p.jobLossThreat *
      Math.max(0, 1 + S.THREAT_FINANCIAL_ANXIETY * husband.traits.financialAnxiety + S.HUSBAND_SHAME_TRADITIONALISM * husband.traits.traditionalism)
    : 0;

  const blocked = inputs.disableFinancialConflict === true;
  const financialWifeStress = blocked ? 0 : householdStrain + wifeThreat + state.wifeBlame;
  const financialHusbandStress = blocked ? 0 : householdStrain + husbandThreat;

  // ---- 출산 ----
  const births = state.birthDurations;
  const children = births.length;
  const lastBirth = children > 0 ? births[children - 1] : undefined;
  const spacingOk = lastBirth === undefined || duration - lastBirth >= S.MIN_BIRTH_SPACING_MONTHS;
  let birthThisMonth = false;
  if (spacingOk) {
    const wanting = !inputs.noPlannedBirths && children + state.priorChildren < state.desired;
    const careerStake = wifeEmployed && wifeLast?.logWage !== undefined ? Math.max(0, wifeLast.logWage + 0.5) : 0;
    const readiness = sigmoid(
      p.birthPace + p.birthCommitment * state.lastCommitment - p.birthStressAversion * Math.max(0, financialWifeStress) - p.birthCareerCost * careerStake,
    );
    const chance = monthlyFecundity(wifeAge) * (wanting ? readiness : inputs.unplannedRatio ?? S.UNPLANNED_BIRTH_RATIO);
    if (rng() < chance) {
      births.push(duration);
      birthThisMonth = true;
    }
  }
  const childrenNow = births.length;
  const youngestAge = childrenNow > 0 ? duration - births[childrenNow - 1] : undefined;
  let youngChildren = 0;
  let childBond = 0;
  for (const b of births) {
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

  // 아내의 경력 한 칸(출산·남편 소득을 보고 떠나거나 돌아온다).
  if (inputs.onBirthsDecided) wifeLast = inputs.onBirthsDecided(birthThisMonth, youngestAge) ?? wifeLast;

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
  const setPoint = S.SET_POINT - state.scar;
  state.satisfaction +=
    S.SATISFACTION_REVERSION * (setPoint - state.satisfaction) +
    S.SUPPORT_GAIN * supports -
    S.CONFRONT_LOSS * confronts -
    (confronts === 2 ? S.MUTUAL_CONFRONT_LOSS : 0) -
    (birthThisMonth ? p.postBirthDip : 0) +
    gaussian(rng) * S.SATISFACTION_NOISE;
  state.scar = state.scar * (1 - S.SCAR_HEAL_RATE) + S.SCAR_PER_CONFRONT * confronts;

  // ---- 6. 헌신 ----
  const investment = p.investmentPerLogYear * Math.log1p(duration / 12) + p.childInvestment * childBond;
  const extra = inputs.extraAlternatives;
  const husbandCommitment = state.satisfaction + investment - alternatives(husband, husbandAge, p) - (extra?.husband ?? 0) + barrier(husband, false, p);
  const wifeCommitment = state.satisfaction + investment - alternatives(wife, wifeAge, p) - (extra?.wife ?? 0) + barrier(wife, wifeAtHome, p);

  // ---- 7. 떠남 ----
  state.lastCommitment = (husbandCommitment + wifeCommitment) / 2;
  let leaver: 'husband' | 'wife' | undefined;
  if (rng() < sigmoid(p.leaveIntercept - S.LEAVE_SLOPE * husbandCommitment)) leaver = 'husband';
  else if (rng() < sigmoid(p.leaveIntercept - S.LEAVE_SLOPE * wifeCommitment)) leaver = 'wife';

  const record: MonthRecord = {
    duration,
    husbandEmployment: employment,
    wifeAtHome,
    wifeEmployed,
    lastShock: state.lastShock,
    monthsSinceShock: state.monthsSinceShock,
    husbandBehavior,
    wifeBehavior,
    financialConflict: confronts > 0 && (notFullTime || state.wifeBlame > 0.1),
    satisfaction: state.satisfaction,
    husbandCommitment,
    wifeCommitment,
    divorcedThisMonth: leaver !== undefined,
    leaver,
    childrenCount: childrenNow,
    youngestChildAgeMonths: youngestAge,
    birthThisMonth,
  };
  state.duration += 1;
  return { record, wifeLast };
}

export function simulateCouple(
  couple: Couple,
  p: MarriageParams,
  inputs: HouseholdInputs,
  options: SimulateOptions,
  onMonth?: (record: MonthRecord, couple: Couple) => void,
): MarriageOutcome {
  const { husband, wife } = couple;
  const track = inputs.husbandTrack;
  const keepMonths = options.keepMonths ?? true;
  const months: MonthRecord[] = [];
  let rng: Rng = createRng(mixSeed(inputs.seed, 0x5eed));

  // ---- 아내의 경력: 16세부터 결혼 전까지 혼자 ----
  const wifeStepper = createCareerStepper(
    { ...toWorker(couple.wifeProfile), sex: 'female', traditionalism: couple.wifeProfile.traits.traditionalism },
    inputs.careerParams ?? DEFAULT_CAREER_PARAMS,
    createRng(couple.wifeProfile.lifeSeed),
    { women: inputs.women, untilAge: options.wifeUntilAge ?? 60 },
  );
  const wifeBirthTotal = couple.wifeProfile.birthYear * 12 + couple.wifeProfile.birthMonth;
  const single: HouseholdContext = { married: false, birthThisMonth: false, spouseAnnualEarnings: 0 };
  let wifeLast: CareerStepResult | undefined;
  const marriageAgeMonths = couple.marriedAtMonth - wifeBirthTotal;
  // 결혼 전 달(나이 개월 marriageAgeMonths − 1)까지 굴린다. 결혼 첫 달부터는 부부 루프 안에서 한 칸씩.
  while ((wifeLast?.ageMonths ?? 16 * 12 - 1) < marriageAgeMonths - 1) {
    const r = stepWife(wifeStepper, single, options.onWifeMonth);
    if (!r) break;
    wifeLast = r;
  }

  const state = createUnionState(couple, p, rng);
  let employment: EmploymentState = 'employed';
  let husbandEarnings12 = 0;
  const earningsWindow: number[] = [];
  let wifeDied = false;
  let wifeAgeAtEnd = couple.wifeAgeAtMarriage;
  let endReason: MarriageEndReason = 'censored';

  for (; ;) {
    const duration = state.duration;
    rng = createRng(mixSeed(inputs.seed, duration + 1));
    const month = couple.marriedAtMonth + duration;
    const husbandAge = (month - husband.birthYear * 12) / 12;
    const wifeAge = (month - wife.birthYear * 12) / 12;

    wifeAgeAtEnd = wifeAge;
    if (husbandAge >= options.censorAtHusbandAge) {
      endReason = 'censored';
      break;
    }
    const husbandDies = !options.ignoreMortality && rng() < monthlyDeathProbability(husband.birthYear, 'male', husbandAge);
    const wifeDies = !options.ignoreMortality && rng() < monthlyDeathProbability(wife.birthYear, 'female', wifeAge);
    if (husbandDies || wifeDies) {
      endReason = 'widowed';
      wifeDied = wifeDies;
      break;
    }

    // ---- 2. 남편 고용: 경력 궤적에서 ----
    let shock: JobShockKind | undefined;
    const idx = month - track.startTotalMonth;
    if (options.forcedShock) {
      if (options.forcedShock.atDuration === duration) shock = options.forcedShock.kind;
      else if (employment === 'unemployed' && rng() < FIXED_ASSUMPTIONS.scenarioReemployment) employment = 'employed';
      else if (employment === 'disabled' && rng() < FIXED_ASSUMPTIONS.scenarioDisabilityRecovery) employment = 'employed';
      if (shock) employment = shock === 'disability' ? 'disabled' : 'unemployed';
    } else if (idx >= 0 && idx < track.employment.length) {
      employment = EMPLOYMENT_STATES[track.employment[idx]];
      shock = SHOCK_KINDS[track.shock[idx]];
      earningsWindow.push(track.earnings[idx]);
      husbandEarnings12 += track.earnings[idx];
      if (earningsWindow.length > 12) husbandEarnings12 -= earningsWindow.shift()!;
    } else {
      employment = 'employed';
    }

    const { record, wifeLast: nextWife } = stepUnionMonth(
      state,
      couple,
      p,
      {
        husbandAge,
        wifeAge,
        employment,
        shock,
        wifeLast,
        forceWifeAtHome: options.forceWifeAtHome,
        disableFinancialConflict: options.disableFinancialConflict,
        onBirthsDecided: (birthThisMonth, youngestAge) =>
          stepWife(
            wifeStepper,
            { married: true, youngestChildAgeMonths: youngestAge, birthThisMonth, spouseAnnualEarnings: options.forcedShock ? 1 : husbandEarnings12 },
            options.onWifeMonth,
          ),
      },
      rng,
    );
    wifeLast = nextWife;
    onMonth?.(record, couple);
    if (keepMonths) months.push(record);

    if (record.leaver) {
      endReason = 'divorce';
      break;
    }
  }
  const duration = state.duration;
  const birthDurations = state.birthDurations;

  // ---- 결혼이 끝난 뒤 아내의 경력(여성 노동 적률) — 자녀는 아내와 산다고 본다 ----
  let wifeCareer;
  if (options.wifeUntilAge !== undefined && !wifeDied) {
    const lastBirth = birthDurations[birthDurations.length - 1];
    for (let d = duration; ; d++) {
      const month = couple.marriedAtMonth + d;
      const idx = month - track.startTotalMonth;
      const stillMarried = endReason === 'censored';
      const ctx: HouseholdContext = {
        married: stillMarried,
        youngestChildAgeMonths: lastBirth !== undefined ? d - lastBirth : undefined,
        birthThisMonth: false,
        spouseAnnualEarnings: stillMarried && idx >= 0 && idx < track.earnings.length ? track.earnings[idx] * 12 : 0,
      };
      const r = stepWife(wifeStepper, ctx, options.onWifeMonth);
      if (!r) break;
    }
    wifeCareer = wifeStepper.finish();
  }

  // 완결 출산 모집단: 아내가 45세까지 산 결혼. 이혼·남편 사망으로 끝난 결혼은 그 뒤 아내가 45세까지
  // 살았다고 본다(결혼 중 출산만 센다). 아내 사망이나 관측 종료가 45세 전에 오면 제외.
  const wifeReached45 = wifeAgeAtEnd >= 45 || endReason === 'divorce' || (endReason === 'widowed' && !wifeDied);
  return { couple, endReason, durationMonths: duration, months, birthDurations, wifeReached45, wifeCareer };
}

/** 비혼 여성의 경력(자녀 없음, 혼자) — 여성 노동 적률의 모집단 일부. */
export function simulateSingleWoman(
  profile: Couple['wifeProfile'],
  women: WomenLaborParams,
  untilAge: number,
  careerParams: CareerParams = DEFAULT_CAREER_PARAMS,
  onWifeMonth?: SimulateOptions['onWifeMonth'],
) {
  const stepper = createCareerStepper({ ...toWorker(profile), sex: 'female', traditionalism: profile.traits.traditionalism }, careerParams, createRng(profile.lifeSeed), {
    women,
    untilAge,
  });
  const ctx: HouseholdContext = { married: false, birthThisMonth: false, spouseAnnualEarnings: 0 };
  while (stepWife(stepper, ctx, onWifeMonth)) {
    // 한 달씩.
  }
  return stepper.finish();
}
