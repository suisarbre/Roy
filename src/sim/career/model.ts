import { averageAnnualWageAt, cpiAt, unemploymentRateAt } from '../data';
import { createRng, type Rng } from '../rng';
import { gaussian, mixSeed } from '../stats';
import { OCCUPATIONS, OCCUPATION_BY_ID, SCHOOLING_RANK, STUDENT_JOBS, type Occupation, type OccupationId } from './occupations';
import { CAREER_STRUCTURE as S, type CareerParams } from './params';
import type { BusinessSpell, CareerEventKind, CareerOutcome, HouseholdContext, JobSpell, LaborState, MonthTrace, SeparationReason, SimulateCareerOptions, Worker, YearRecord } from './types';

/**
 * 한 사람의 16세~은퇴 후까지를 월 단위로 굴린다. 확률표는 없다 — 사건은 전부 개인 상태(능력·성격·
 * 근속·짝·인적자본)와 세계 상태(그 해 실업률, 항공우주 구조조정)의 함수다.
 *
 * 로그 임금(AWI 배수) = 직업 수준 + 전역 수준 + 능력·성격 + 사다리 칸 + 고용주 짝 + 근속 + 일반 인적자본
 *                      + 영구 충격.
 * - 직업 수준은 CPS 1999 남성 풀타임 중앙값(검증)이고, 인적자본은 경력 20년에 0이 되도록 음수에서
 *   시작해 오목하게 자란다 — 그래서 직업 수준은 "경력 20년의 평범한 사람" 임금이 된다.
 * - 실직의 장기 손실(JLS)은 따로 적지 않았다: 근속 자본, 좋은 짝, 사다리 칸을 한꺼번에 잃고, 같은
 *   직업 제안이 줄어 다른 직업으로 밀려나는 것에서 나온다.
 * - 불황 졸업의 상처(Kahn)도 따로 적지 않았다: 실업률이 높은 해에 입사하면 짝이 나쁘고, 재직 중 더 좋은
 *   제안을 기다리는 사다리 오르기가 느려서 오래 남는다.
 */

const unemploymentCache = new Map<number, number>();
function unemployment(year: number): number {
  let u = unemploymentCache.get(year);
  if (u === undefined) {
    u = unemploymentRateAt(year);
    unemploymentCache.set(year, u);
  }
  return u;
}

const realGrowthCache = new Map<number, number>();
/** 평균임금의 실질 성장률(y → y+1). 재산을 AWI 단위로 이월할 때와 실질 임금 성장 측정에 쓴다. */
export function realAwiGrowth(year: number): number {
  let g = realGrowthCache.get(year);
  if (g === undefined) {
    g = (averageAnnualWageAt(year + 1) / averageAnnualWageAt(year)) * (cpiAt(year) / cpiAt(year + 1)) - 1;
    realGrowthCache.set(year, g);
  }
  return g;
}

/** 공통 시장 수익 충격 — 모든 사람이 같은 "역사"를 산다(연도로만 결정). */
const marketCache = new Map<number, number>();
function marketShock(year: number): number {
  let m = marketCache.get(year);
  if (m === undefined) {
    m = gaussian(createRng(year * 7919 + 17)) * S.marketReturnSd;
    marketCache.set(year, m);
  }
  return m;
}

function hcGrowthFor(worker: Worker, p: CareerParams): number {
  switch (worker.education) {
    case 'lessThanHighSchool':
      return p.hcGrowthLessThanHighSchool;
    case 'highSchool':
      return p.hcGrowthHighSchool;
    case 'someCollege':
      return p.hcGrowthSomeCollege;
    default:
      return p.hcGrowthBachelors;
  }
}

/** 경력 20년에 0이 되는 시작점. */
function initialHumanCapital(growth: number, decay: number): number {
  return -(growth / decay) * (1 - Math.exp(-20 * decay));
}

/** 이 사람에게 이 직업 제안이 올 정적 가중치(학력·학위·성격 적합). 경력·연도 조건은 동적으로. */
function staticOfferWeight(worker: Worker, occ: Occupation): number {
  if (occ.id === 'military') return 0;
  const rank = SCHOOLING_RANK[worker.schooling];
  if (rank < SCHOOLING_RANK[occ.minSchooling]) return 0;
  if (occ.requiresDegree && occ.requiresDegree !== worker.degree) return 0;
  let w = occ.offerWeight[worker.schooling];
  if (w === undefined) {
    // 대학원 학위자의 비전공 경로: 대졸 직업으로, 전문·박사는 약하게.
    if (rank >= 4) w = (occ.offerWeight.masters ?? occ.offerWeight.bachelorsOrMore ?? 0) * (worker.schooling === 'masters' ? 1 : S.offFieldDegreeWeight);
    else w = 0;
  }
  if (w <= 0) return 0;
  if (occ.aerospace && worker.losAngeles) w *= S.laAerospaceConcentration;
  return w * Math.exp(fitScore(worker, occ));
}

/** 성격·능력과 직업의 맞음 — 끌림(제안 가중치)과 생산성(짝 평균) 둘 다에 쓴다. */
function fitScore(worker: Worker, occ: Occupation): number {
  let fit = 0;
  for (const [trait, loading] of Object.entries(occ.fit) as [keyof Worker['traits'], number][]) fit += loading * worker.traits[trait];
  return fit;
}

function aerospaceOfferMultiplier(year: number): number {
  const d = S.aerospaceDecline;
  if (year < d.fromYear) return 1;
  if (year <= d.toYear) return d.offerMultiplier;
  return d.afterMultiplier;
}

interface Job {
  occupation: Occupation;
  employerId: number;
  rung: number;
  match: number;
  tenureMonths: number;
  student: boolean;
  spell: JobSpell;
  termMonthsLeft?: number;
  /** 항공우주 산업 고용주 — 같은 회사 안에서 관리자로 승진해도 산업은 그대로다. */
  aerospace: boolean;
}


/** 학력별 기술 프리미엄 추세의 가중치(고졸 = 0). */
const SKILL_TREND_WEIGHT: Record<Worker['schooling'], number> = {
  lessThanHighSchool: -1,
  highSchool: 0,
  someCollege: 0.5,
  bachelorsOrMore: 1,
  masters: 1.2,
  doctorate: 1.2,
  professional: 1.2,
};

/**
 * 공통 난수를 강하게: 난수열을 달마다 (사람 시드, 나이 개월)로 새로 시작한다. 파라미터가 조금 바뀌어
 * 어떤 달의 분기(이직했나 안 했나)가 달라져도 다음 달의 운은 같다 — 한 번의 분기가 평생의 난수를 밀어내는
 * 일이 없어 보정의 목적 함수가 훨씬 매끄럽다(실제로 친화성 임금 효과가 잡음에 묻혀 보정되지 않던 문제).
 */
export function simulateCareer(worker: Worker, p: CareerParams, seedRng: Rng, options: SimulateCareerOptions = {}): CareerOutcome {
  const stepper = createCareerStepper(worker, p, seedRng, options);
  while (stepper.step()) {
    // 한 달씩.
  }
  return stepper.finish();
}

/** 한 달 진행 결과 — 가구(결혼 모델)가 매달 읽는 값. */
export interface CareerStepResult {
  ageMonths: number;
  year: number;
  state: LaborState;
  /** 가사·육아로 노동시장 밖(여성의 출산 후 이탈 등). */
  atHome: boolean;
  /** 장애로 노동시장 밖. */
  disabled: boolean;
  occupation?: OccupationId;
  /** 임금근로 중이면 로그 임금(AWI 배수). */
  logWage?: number;
  /** 이번 달 소득(AWI 배수, 월). */
  earnings: number;
  eventKind?: CareerEventKind;
}

export interface CareerStepper {
  /** 한 달 진행. 끝났으면 undefined. ctx는 가구 상황(결혼·자녀·배우자 소득) — 여성의 노동 공급이 읽는다. */
  step(ctx?: HouseholdContext): CareerStepResult | undefined;
  finish(): CareerOutcome;
}

/**
 * 월 단위로 밖에서 굴릴 수 있는 경력. 결혼 모델이 매달 부부를 한 칸씩 진행시키며 출산·결혼 상태를
 * 아내의 경력에 넘기고(출산 후 이탈, 아이가 크면 복귀), 남편의 실직을 결혼 쪽 스트레스로 받는다.
 */
export function createCareerStepper(worker: Worker, p: CareerParams, seedRng: Rng, options: SimulateCareerOptions = {}): CareerStepper {
  const baseSeed = Math.floor(seedRng() * 4294967296);
  let rng: Rng = createRng(baseSeed);
  const untilAge = options.untilAge ?? 72;
  const t = worker.traits;
  const growth = hcGrowthFor(worker, p);
  let hc = initialHumanCapital(growth, p.hcDecay);
  let experienceYears = 0;
  let perm = 0;

  const female = worker.sex === 'female';
  const women = options.women;
  if (female && !women) throw new Error('여성 경력에는 options.women(WomenLaborParams)이 필요하다');
  const traditionalism = worker.traditionalism ?? 0;
  const staticWeights = OCCUPATIONS.map(
    (occ) => staticOfferWeight(worker, occ) * ((female ? women!.occupationWeights?.[occ.id] : undefined) ?? p.occupationWeights?.[occ.id] ?? 1),
  );
  const skillTrend = p.skillPremiumTrend * SKILL_TREND_WEIGHT[worker.schooling];
  let currentYear = worker.birthYear + 16;
  const fitPay = new Map(OCCUPATIONS.map((occ) => [occ.id, S.fitPay * fitScore(worker, occ)]));
  const personalPay =
    p.agreeablenessPay * t.agreeableness +
    S.conscientiousnessPay * t.conscientiousness +
    S.neuroticismPay * t.neuroticism +
    S.opennessPay * t.openness +
    (worker.schooling === 'masters' ? S.mastersPremium : 0) +
    (female ? women!.payGap : 0);
  const logMedian = Math.log(S.MEN_MEDIAN_TO_AWI);

  const years: YearRecord[] = [];
  const jobs: JobSpell[] = [];
  const businesses: BusinessSpell[] = [];
  const months: MonthTrace[] | undefined = options.keepMonths ? [] : undefined;

  let state = 'student' as LaborState;
  let job: Job | undefined;
  let lastOccupation: Occupation | undefined;
  /** 현재(또는 마지막) 직업에서 쌓은 연수 — 다른 직업으로 가면 0부터. */
  let occupationYears = 0;
  const occupationYearsFor = (occ: Occupation): number => (lastOccupation && occ.id === lastOccupation.id ? occupationYears : 0);
  let lastLogWage = Math.log(0.4);
  let monthsUnemployed = 0;
  let disabled = false;
  /** 가사·육아로 노동시장 밖(여성). */
  let atHome = false;
  let uiMonthsLeft = 0;
  let uiMonthly = 0;
  let employerCounter = 0;
  let business: { spell: BusinessSpell; lnIncome: number; annualIncome: number } | undefined;
  let wealth = 0;
  let bizEquity = 0;
  let socialSecurityMonthly = 0;
  let unemploymentAtSchoolExit = NaN;
  let schoolDone = false;
  let firstJobForced = false;

  const startAgeMonths = 16 * 12;
  const schoolExitMonths = Math.round(worker.schoolExitAge * 12);
  const studentFindRate = (0.06 * p.studentWorkShare) / Math.max(0.05, 1 - p.studentWorkShare);

  const wageOf = (occ: Occupation, rung: number, match: number, tenureMonths: number, student: boolean): number => {
    const tenureYears = Math.min(tenureMonths / 12, 10);
    return (
      Math.log(occ.payRatio) +
      logMedian +
      p.wageLevel +
      occ.abilityLoad * p.abilityReturn * t.ability +
      personalPay +
      (occ.extraversionPay ?? 0) * t.extraversion +
      (rung - (occ.rungs - 1) / 2) * occ.rungStep * p.rungStepScale +
      match +
      skillTrend * (currentYear - 1999) +
      p.tenureReturn * (tenureYears - 5) +
      (student ? p.studentWageDiscount : hc + perm + p.occupationReturn * (Math.min(occupationYearsFor(occ), 10) - 5))
    );
  };
  const currentWage = (): number => (job ? wageOf(job.occupation, job.rung, job.match, job.tenureMonths, job.student) : NaN);

  const drawOccupation = (year: number, ageMonths: number, preferSame: boolean): Occupation | undefined => {
    if (preferSame && lastOccupation && lastOccupation.id !== 'military' && staticWeights[OCCUPATIONS.indexOf(lastOccupation)] > 0) {
      const sameChance = S.sameOccupationOfferShare * (lastOccupation.aerospace ? aerospaceOfferMultiplier(year) : 1);
      if (rng() < sameChance) return lastOccupation;
    }
    const ageYears = ageMonths / 12;
    let total = 0;
    const weights = OCCUPATIONS.map((occ, i) => {
      let w = staticWeights[i];
      if (w === 0) return 0;
      if (occ.minExperienceYears && experienceYears < occ.minExperienceYears) return 0;
      if (occ.aerospace) w *= aerospaceOfferMultiplier(year);
      // 불황엔 좋은 자리가 먼저 사라진다: 임금이 높은 직업일수록 제안이 준다(하향 취업).
      w *= Math.exp(-p.occupationCyclicality * (unemployment(year) - S.UNEMPLOYMENT_REFERENCE) * Math.log(occ.payRatio));
      if (occ.id === 'foodService' || occ.id === 'retailSales') w *= ageYears < 25 ? 1 : 0.5;
      total += w;
      return w;
    });
    if (total <= 0) return undefined;
    let roll = rng() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return OCCUPATIONS[i];
    }
    return undefined;
  };

  const drawMatch = (occ: Occupation, year: number): number =>
    fitPay.get(occ.id)! - p.matchCyclicality * (unemployment(year) - S.UNEMPLOYMENT_REFERENCE) + gaussian(rng) * p.matchSd * occ.matchSdScale;

  const startJob = (occ: Occupation, rung: number, match: number, ageMonths: number, student: boolean): void => {
    employerCounter += 1;
    const spell: JobSpell = {
      employerId: employerCounter,
      occupation: occ.id,
      startAgeMonths: ageMonths,
      startLogWage: wageOf(occ, rung, match, 0, student),
      student,
    };
    jobs.push(spell);
    job = { occupation: occ, employerId: employerCounter, rung, match, tenureMonths: 0, student, spell, termMonthsLeft: occ.termMonths, aerospace: !!occ.aerospace };
    if (!student) {
      if (!lastOccupation || lastOccupation.id !== occ.id) occupationYears = 0;
      lastOccupation = occ;
    }
    state = student ? 'student' : 'employed';
    monthsUnemployed = 0;
    uiMonthsLeft = 0;
  };

  const endJob = (ageMonths: number, reason: SeparationReason): void => {
    if (!job) return;
    const w = currentWage();
    job.spell.endAgeMonths = ageMonths;
    job.spell.endReason = reason;
    job.spell.endLogWage = w;
    if (!job.student) {
      lastLogWage = w;
      if (reason === 'layoff' || reason === 'plantClosing') {
        uiMonthsLeft = S.unemploymentInsuranceMonths;
        uiMonthly = (S.unemploymentInsuranceReplacement * Math.exp(w)) / 12;
      }
    }
    job = undefined;
  };

  let record: YearRecord | undefined;
  const careerEarnings: number[] = [];

  let ageMonths = startAgeMonths - 1;
  let ctx: HouseholdContext | undefined;
  let monthEarnings = 0;
  let lastEventKind: CareerEventKind | undefined;

  const stepBody = (): void => {
    const total = worker.birthYear * 12 + worker.birthMonth + ageMonths;
    const year = Math.floor(total / 12);
    currentYear = year;
    rng = createRng(mixSeed(baseSeed, ageMonths));
    const u = unemployment(year);
    const age = ageMonths / 12;
    const ageYear = Math.floor(age);
    let event: string | undefined;
    let eventKind: CareerEventKind | undefined;

    if (ageMonths % 12 === 0) {
      // 생일: 연간 기록 시작, 영구 충격.
      perm += gaussian(rng) * S.permanentShockSd;
      const w = job ? currentWage() : NaN;
      record = {
        age: ageYear,
        year,
        employedMonths: 0,
        selfEmployedMonths: 0,
        unemployedMonths: 0,
        outOfLaborForceMonths: 0,
        studentMonths: 0,
        logWageAtBirthday: job && job.occupation.id !== 'military' ? w : NaN,
        occupationAtBirthday: job && !job.student ? job.occupation.id : undefined,
        longTenureAtBirthday: !!job && !job.student && job.tenureMonths >= 72,
        aerospaceIndustryAtBirthday: !!job && job.aerospace,
        earnings: 0,
        netWorth: wealth + bizEquity,
        displaced: false,
        laidOff: false,
      };
      years[ageYear] = record;
    }
    const rec = record!;

    // ---- 학교 ----
    if (!schoolDone) {
      if (ageMonths >= schoolExitMonths) {
        schoolDone = true;
        unemploymentAtSchoolExit = u;
        if (job) endJob(ageMonths, 'schoolExit');
        event = '학교를 마침'; eventKind = 'schoolExit';
        const militaryEligible = worker.education === 'highSchool' || worker.education === 'someCollege';
        if (!female && militaryEligible && rng() < S.militaryEnlistShare) {
          startJob(OCCUPATION_BY_ID.military, 0, 0, ageMonths, false);
          event = '입대'; eventKind = 'enlisted';
        } else {
          state = 'unemployed';
        }
      } else {
        // 재학 중 아르바이트.
        if (job) {
          if (rng() < 0.06) endJob(ageMonths, 'quit');
        } else if (age >= 16 && rng() < studentFindRate) {
          const occ = OCCUPATION_BY_ID[STUDENT_JOBS[rng() < 0.5 ? 0 : 1]];
          startJob(occ, 0, gaussian(rng) * p.matchSd * 0.5, ageMonths, true);
        }
        rec.studentMonths += 1;
        if (job) {
          rec.employedMonths += 1;
          rec.earnings += (Math.exp(currentWage()) * S.studentHoursShare) / 12;
          job.tenureMonths += 1;
        }
        if (months) months.push({ ageMonths, year, month: total % 12, state: 'student', occupation: job?.occupation.id, logWage: job ? currentWage() : undefined, netWorth: wealth, event, eventKind });
        if (ageMonths % 12 === 11) annualMoney(rec, year, age, true);
        lastEventKind = eventKind;
        return;
      }
    }

    // ---- 은퇴 ----
    if (state !== 'retired' && state !== 'student' && age >= 55) {
      const h = age >= 65 ? S.retireHazard.from65 : age >= 62 ? S.retireHazard.from62 : S.retireHazard.from55;
      if (rng() < h * Math.exp(0.3 * Math.log1p(Math.max(0, wealth)))) {
        if (job) endJob(ageMonths, 'retirement');
        if (business) closeBusiness(ageMonths, true);
        state = 'retired';
        const positive = careerEarnings.filter((e) => e > 0);
        const avg = positive.length ? positive.reduce((a, b) => a + b, 0) / Math.max(35, positive.length) : 0;
        socialSecurityMonthly = Math.min(1, S.socialSecurityReplacement * avg) / 12;
        event = '은퇴'; eventKind = 'retired';
      }
    }

    // ---- 출산: 여성은 노동시장을 떠날 수 있다(출산 한 달 기준 결정) ----
    if (female && ctx?.birthThisMonth && (state === 'employed' || state === 'unemployed')) {
      const own = state === 'employed' && job ? currentWage() : lastLogWage;
      const logit =
        women!.homeExitBirth +
        women!.homeExitTraditionalism * traditionalism -
        women!.homeExitCollege * (SCHOOLING_RANK[worker.schooling] >= 3 ? 1 : 0) +
        women!.homeExitSpouseIncome * Math.log((ctx.spouseAnnualEarnings + 0.05) / (Math.exp(own) + 0.05));
      if (rng() < 1 / (1 + Math.exp(-logit))) {
        if (job) endJob(ageMonths, 'family');
        state = 'outOfLaborForce';
        atHome = true;
        event = '가사·육아로 일을 쉼'; eventKind = 'leftForFamily';
      }
    }

    // ---- 임금근로 ----
    if (state === 'employed' && job) {
      const occ = job.occupation;
      const tenureYears = job.tenureMonths / 12;
      const disabilityHazard = p.disabilityBase * Math.exp(p.disabilityAgeSlope * (age - 40)) * (occ.manual ? S.manualDisabilityMultiplier : 1);
      const aero = job.aerospace && year >= S.aerospaceDecline.fromYear && year <= S.aerospaceDecline.toYear
        ? worker.losAngeles ? S.aerospaceDecline.closureLA : S.aerospaceDecline.closureNational
        : 0;
      const cyc = Math.pow(u / S.UNEMPLOYMENT_REFERENCE, occ.cyclicality);
      const closureHazard = p.plantClosingRate * cyc * Math.sqrt(occ.layoffScale) + aero;
      const layoffHazard =
        p.layoffBase *
        occ.layoffScale *
        Math.pow(u / S.UNEMPLOYMENT_REFERENCE, p.layoffCyclicality * occ.cyclicality) *
        Math.exp(-p.layoffTenureProtection * Math.min(tenureYears, 10) / 10 - p.layoffConscientiousness * t.conscientiousness - (S.layoffMatchSensitivity * job.match) / Math.max(0.05, p.matchSd));
      const inResidency = !!occ.automaticRung && job.rung === 0;
      const quitHazard = inResidency
        ? 0
        : p.quitYoung * Math.exp(-p.quitAgeDecay * Math.max(0, age - 18) + 0.3 * t.neuroticism - 0.3 * t.conscientiousness) * (1 + p.earlyMismatch * Math.exp(-job.tenureMonths / 6));

      if (occ.id === 'military') {
        job.termMonthsLeft = (job.termMonthsLeft ?? 48) - 1;
        if (job.termMonthsLeft <= 0) {
          endJob(ageMonths, 'termEnd');
          state = 'unemployed';
          event = '전역'; eventKind = 'discharged';
        }
      } else if (rng() < disabilityHazard) {
        endJob(ageMonths, 'disability');
        state = 'outOfLaborForce';
        disabled = true;
        event = '장애'; eventKind = 'disabled';
      } else if (rng() < closureHazard) {
        endJob(ageMonths, 'plantClosing');
        state = 'unemployed';
        rec.displaced = true;
        event = aero > 0 ? '항공우주 구조조정으로 공장 폐쇄' : '공장 폐쇄·대량 해고'; eventKind = 'plantClosing';
      } else if (rng() < layoffHazard) {
        endJob(ageMonths, 'layoff');
        state = 'unemployed';
        rec.laidOff = true;
        event = '해고'; eventKind = 'laidOff';
      } else if (rng() < quitHazard) {
        endJob(ageMonths, 'quit');
        state = 'unemployed';
        event = '그만둠'; eventKind = 'quit';
      } else if (
        age >= 23 &&
        experienceYears >= 2 &&
        rng() < p.seEntry * Math.exp(0.5 * t.riskTolerance + 0.2 * t.openness + 0.2 * t.extraversion + 0.2 * t.ability) * (wealth >= S.seStartupCapital ? 1 : 0.4)
      ) {
        const w = currentWage();
        endJob(ageMonths, 'businessStart');
        const quality = 0.3 * t.ability + 0.2 * t.conscientiousness + gaussian(rng);
        const spell: BusinessSpell = { startAgeMonths: ageMonths, quality };
        businesses.push(spell);
        employerCounter += 1;
        jobs.push({ employerId: employerCounter, occupation: 'selfEmployed', startAgeMonths: ageMonths, startLogWage: w, student: false });
        business = { spell, lnIncome: w + S.seQualityIncome * quality - 0.2, annualIncome: 0 };
        wealth -= S.seStartupCapital;
        state = 'selfEmployed';
        event = '창업'; eventKind = 'businessStarted';
      } else {
        // 재직 중 탐색: 더 나은 짝이 오면 옮긴다.
        const offerRate = p.offerRateEmployed * Math.exp(-p.offerAgeDecline * Math.max(0, age - 18)) * Math.pow(S.UNEMPLOYMENT_REFERENCE / u, 0.5);
        if (!inResidency && rng() < offerRate) {
          const nextOcc = drawOccupation(year, ageMonths, true);
          if (nextOcc) {
            const sameOcc = nextOcc.id === occ.id;
            const rung = sameOcc ? job.rung : nextOcc.id === 'manager' ? 0 : Math.min(nextOcc.rungs - 1, 0);
            const match = drawMatch(nextOcc, year);
            const offered = wageOf(nextOcc, rung, match, 0, false);
            if (offered > currentWage() + p.switchCost + (sameOcc ? 0 : S.occupationSwitchCost)) {
              endJob(ageMonths, 'jobToJob');
              startJob(nextOcc, rung, match, ageMonths, false);
              event = `이직: ${nextOcc.label}`; eventKind = 'jobToJob';
            }
          }
        }
        // 승진.
        if (job && job.rung < job.occupation.rungs - 1) {
          const auto = job.occupation.automaticRung;
          if (auto) {
            if (job.tenureMonths + 1 >= auto.afterMonths && job.rung === 0) job.rung = 1;
          } else if (rng() < (p.promotionRate / 12) * Math.exp(p.promotionConscientiousness * t.conscientiousness + 0.3 * t.ability)) {
            job.rung += 1;
            event = '승진'; eventKind = 'promoted';
          }
        }
        if (
          job &&
          !job.occupation.requiresDegree &&
          job.occupation.id !== 'manager' &&
          job.occupation.id !== 'military' &&
          experienceYears >= 6 &&
          (job.rung >= 1 || job.occupation.rungs === 1) &&
          rng() <
            (p.managerPromotionRate / 12) *
              Math.exp(
                p.promotionConscientiousness * t.conscientiousness + 0.3 * t.extraversion + 0.3 * t.ability - 0.2 * t.agreeableness +
                  S.managerEducationGradient * Math.min(3, SCHOOLING_RANK[worker.schooling]) - S.managerEducationGradient * 2,
              )
        ) {
          // 사다리 끝에서 같은 회사 관리자로(근속 유지, 직업 특수 자본은 새로 쌓는다).
          job.occupation = OCCUPATION_BY_ID.manager;
          job.rung = 0;
          lastOccupation = job.occupation;
          occupationYears = 0;
          event = '관리자로 승진'; eventKind = 'promotedToManager';
        }
      }
    } else if (state === 'selfEmployed' && business) {
      const yearsIn = (ageMonths - business.spell.startAgeMonths) / 12;
      const hazard =
        p.seHazard0 *
        (S.seHazardFloor + (1 - S.seHazardFloor) * Math.exp(-p.seHazardDecay * yearsIn)) *
        Math.exp(-0.5 * business.spell.quality) *
        Math.pow(u / S.UNEMPLOYMENT_REFERENCE, 0.8);
      if (rng() < hazard) {
        closeBusiness(ageMonths, false);
        state = 'unemployed';
        event = '폐업'; eventKind = 'businessClosed';
      }
    } else if (state === 'unemployed') {
      monthsUnemployed += 1;
      const nilfLow = female ? women!.nilfLowEducation : p.nilfLowEducation;
      const lowEdu = worker.education === 'lessThanHighSchool' ? nilfLow : worker.education === 'highSchool' ? Math.sqrt(nilfLow) : 1;
      const network = 0.15 * t.extraversion + (age < 30 ? 0.4 * (worker.parentRank - 0.5) : 0);
      const firstJob = !lastOccupation;
      const offerRate = Math.min(0.95, p.offerRateUnemployed * (S.UNEMPLOYMENT_REFERENCE / u) * Math.exp(network));
      const homeLogit =
        female && ctx?.married
          ? women!.homeFromUnemployment +
            women!.homeExitTraditionalism * traditionalism -
            women!.homeExitCollege * (SCHOOLING_RANK[worker.schooling] >= 3 ? 1 : 0) +
            women!.homeExitSpouseIncome * Math.log((ctx.spouseAnnualEarnings + 0.05) / (Math.exp(lastLogWage) + 0.05))
          : undefined;
      if (homeLogit !== undefined && rng() < 1 / (1 + Math.exp(-homeLogit))) {
        // 결혼한 여성: 일자리를 잃으면 구직 대신 가사로(배우자 소득이 클수록) — 여성 실업률이 낮은 이유의 하나.
        state = 'outOfLaborForce';
        atHome = true;
        event = '구직을 접고 가사로'; eventKind = 'leftForFamily';
      } else if (rng() < p.nilfEntry * lowEdu * (female ? women!.nilfMultiplier : 1) * Math.exp(-0.3 * t.conscientiousness)) {
        state = 'outOfLaborForce';
        event = '구직 단념'; eventKind = 'leftLaborForce';
      } else if (rng() < offerRate) {
        let occ = drawOccupation(year, ageMonths, true);
        if (options.forcedFirstOccupation && !firstJobForced) {
          occ = OCCUPATION_BY_ID[options.forcedFirstOccupation];
          firstJobForced = true;
        }
        if (occ) {
          const match = drawMatch(occ, year);
          const offered = wageOf(occ, 0, match, 0, false);
          const reservation = lastLogWage - S.reservationDrop - S.reservationDropPerMonth * monthsUnemployed;
          if (firstJob || offered >= reservation) {
            startJob(occ, 0, match, ageMonths, false);
            event = `취업: ${occ.label}`; eventKind = 'hired';
          }
        }
      }
    } else if (state === 'outOfLaborForce' && atHome) {
      const youngestYears = ctx?.youngestChildAgeMonths !== undefined ? Math.min(18, ctx.youngestChildAgeMonths / 12) : 18;
      const logit =
        women!.homeReturnBase + women!.homeReturnChildAge * youngestYears - women!.homeReturnTraditionalism * traditionalism + (ctx?.married ? 0 : women!.homeReturnSingle);
      if (rng() < 1 / (1 + Math.exp(-logit))) {
        state = 'unemployed';
        atHome = false;
        monthsUnemployed = 0;
        event = '다시 일을 찾기 시작'; eventKind = 'returnedToWork';
      }
    } else if (state === 'outOfLaborForce') {
      const exit = disabled ? S.disabilityRecovery : p.nilfExit;
      if (rng() < exit) {
        state = 'unemployed';
        disabled = false;
        monthsUnemployed = 0;
      }
    }

    // ---- 이 달의 집계 ----
    if (state === 'employed' && job) {
      rec.employedMonths += 1;
      job.tenureMonths += 1;
      occupationYears += 1 / 12;
      rec.earnings += Math.exp(currentWage()) / 12;
      accumulateHumanCapital(age);
    } else if (state === 'selfEmployed' && business) {
      rec.employedMonths += 1;
      rec.selfEmployedMonths += 1;
      const monthly = Math.exp(business.lnIncome) / 12;
      rec.earnings += monthly;
      business.annualIncome += monthly;
      accumulateHumanCapital(age);
    } else {
      if (state === 'unemployed') rec.unemployedMonths += 1;
      else if (state === 'outOfLaborForce') rec.outOfLaborForceMonths += 1;
      if (state !== 'retired') hc -= S.nonemploymentDepreciation / 12;
    }
    if (months) months.push({ ageMonths, year, month: total % 12, state, occupation: job?.occupation.id, logWage: job ? currentWage() : undefined, netWorth: wealth + bizEquity, event, eventKind });

    if (ageMonths % 12 === 11) {
      if (business) {
        // 연간 사업 소득 흔들림과 지분 가치.
        business.lnIncome += gaussian(rng) * S.seIncomeShockSd * 0.5;
        bizEquity = S.seEquityMultiple * Math.max(0, business.annualIncome - 1);
        business.annualIncome = 0;
      }
      annualMoney(rec, year, age, false);
      if (age >= 22 && age < 62) careerEarnings.push(rec.earnings);
    }
    lastEventKind = eventKind;
  };

  return {
    step(householdContext?: HouseholdContext): CareerStepResult | undefined {
      if (ageMonths + 1 >= untilAge * 12) return undefined;
      ageMonths += 1;
      ctx = householdContext;
      const earningsBefore = record?.earnings ?? 0;
      const ageYearBefore = record?.age;
      stepBody();
      monthEarnings = record!.age === ageYearBefore ? record!.earnings - earningsBefore : record!.earnings;
      return {
        ageMonths,
        year: record!.year,
        state,
        atHome,
        disabled,
        occupation: job?.occupation.id,
        logWage: job && !job.student ? currentWage() : undefined,
        earnings: monthEarnings,
        eventKind: lastEventKind,
      };
    },
    finish: () => ({ worker, years, jobs, businesses, unemploymentAtSchoolExit, months }),
  };

  function accumulateHumanCapital(age: number): void {
    hc += (growth / 12) * Math.exp(-p.hcDecay * experienceYears);
    experienceYears += 1 / 12;
    if (age >= 45) hc -= p.hcLateDepreciation / 12;
  }

  function closeBusiness(ageMonths: number, retiring: boolean): void {
    if (!business) return;
    business.spell.endAgeMonths = ageMonths;
    const spell = jobs[jobs.length - 1];
    if (spell.occupation === 'selfEmployed') {
      spell.endAgeMonths = ageMonths;
      spell.endReason = retiring ? 'retirement' : 'plantClosing';
      spell.endLogWage = business.lnIncome;
    }
    lastLogWage = Math.min(business.lnIncome, lastLogWage + 0.2);
    if (retiring) wealth += 0.7 * bizEquity;
    bizEquity = 0;
    business = undefined;
  }

  /** 생일 전 달: 한 해 소득으로 쓰고 모으고, 자산이 불어난다. 전부 AWI 배수 → 다음 해 AWI로 이월. */
  function annualMoney(rec: YearRecord, year: number, age: number, student: boolean): void {
    let income = rec.earnings;
    // 실업급여·장애연금·사회보장(연간 합으로 근사).
    const uiPaid = Math.min(uiMonthsLeft, rec.unemployedMonths);
    income += uiPaid * uiMonthly;
    uiMonthsLeft = Math.max(0, uiMonthsLeft - uiPaid);
    if (disabled) income += (S.disabilityBenefitReplacement * Math.exp(lastLogWage) * rec.outOfLaborForceMonths) / 12;
    if (state === 'retired') income += socialSecurityMonthly * 12;
    const afterTax = income * (1 - S.taxRate);

    let saving: number;
    if (student) saving = 0;
    else if (state === 'retired') saving = -S.retireeDrawdown * Math.max(0, wealth);
    else {
      const floor = S.consumptionFloor;
      if (afterTax >= floor) {
        const rate = Math.max(-0.1, Math.min(0.6, p.saveBase + p.saveConscientiousness * t.conscientiousness + p.saveRich * Math.log(afterTax / 0.8)));
        saving = rate * (afterTax - floor);
      } else {
        // 바닥 아래: 모은 돈을 먼저 헐고, 빚은 조금만(가족·공적 부조가 나머지를 메운다고 본다).
        saving = -Math.min(floor - afterTax, 0.1 + 0.3 * Math.max(0, wealth));
      }
    }

    let r: number;
    if (wealth > 0) {
      const equity = Math.min(0.8, 0.25 + 0.15 * Math.log1p(wealth));
      r = p.returnMean + equity * (marketShock(year) + gaussian(rng) * S.idiosyncraticReturnSd);
    } else {
      r = S.debtRate;
    }
    let inheritance = 0;
    if (age >= 40 && age < 70 && rng() < S.inheritanceAnnualProbability * (0.3 + 1.4 * worker.parentRank)) {
      inheritance = p.inheritanceScale * Math.exp(gaussian(rng)) * (0.2 + 2 * worker.parentRank ** 2);
    }
    wealth = Math.max(S.debtLimit, (wealth * (1 + r)) / (1 + realAwiGrowth(year)) + saving + inheritance);
    rec.netWorth = wealth + bizEquity;
  }
}

export { type OccupationId };
