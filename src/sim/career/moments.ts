import { WORK_MOMENTS, AWI_2022, unemploymentRateAt } from '../data';
import { createRng } from '../rng';
import { realAwiGrowth, simulateCareer } from './model';
import type { CareerParams } from './params';
import { buildWorker, drawWorker } from './population';
import type { OccupationId } from './occupations';
import { EDUCATIONS, type CareerOutcome, type Education } from './types';

/**
 * 몬테카를로 결과에서 적률을 재고 목표(data/work.ts)와 비교한다. 측정 정의는 원 연구와 비교 가능하게:
 * - 임금 성장: 연속한 두 생일에 모두 임금근로자인 사람의 로그 임금(AWI 배수) 변화 + 그 해 AWI 실질
 *   성장률(CPI-U 기준) → 실질 시급 성장(%). 이직자 포함(NLSY79 표 5와 같음).
 * - 고용 상태: 월 단위 비율(자영업은 취업).
 * - 일자리 지속: 시작 나이대별, 1년/5년 안에 끝난 비율(자영업 포함, 학생 알바 포함 — NLSY79 정의).
 * - 실직 장기 손실(JLS): 생일에 근속 6년 이상이던 해에 공장 폐쇄·대량 해고를 겪은 25–50세의 5년 뒤
 *   연소득 ÷ (직전 해 연소득 × 같은 층(나이 5세 구간 × 학력)의 비실직 장기근속자 소득 변화비). JLS 표본은
 *   1980–86년 펜실베이니아(실업률이 높던 시기)라서 전국 실업률 7% 이상인 해의 실직만 센다 — 호황기 실직의
 *   손실은 더 작다는 것이 후속 연구(Davis & von Wachter 2011)의 결론이다.
 * - 불황 졸업(Kahn): 학사(대학원 제외)의 졸업 1년 뒤·15년 뒤 로그 임금을 졸업 해 실업률에 회귀한 기울기.
 * - 재산: 나이별 순자산 중앙값(AWI 배수). 목표는 SCF 2022 ÷ 2022 AWI, 허용오차 ±30%.
 */

function values(id: string): Readonly<Record<string, number>> {
  const m = WORK_MOMENTS.find((x) => x.id === id);
  if (!m) throw new Error(`moment ${id} not found`);
  return m.values;
}

export interface CareerTarget {
  key: string;
  label: string;
  target: number;
  tolerance: number;
  /** 한쪽만 벌점: 'min'이면 target 이상이면 통과("최소 3분의 1"). */
  oneSided?: 'min';
  knownGap?: string;
}

export const AGE_BANDS: readonly { key: string; from: number; to: number }[] = [
  { key: '18to24', from: 18, to: 24 },
  { key: '25to34', from: 25, to: 34 },
  { key: '35to44', from: 35, to: 44 },
  { key: '45to54', from: 45, to: 54 },
  { key: '55to58', from: 55, to: 58 },
];

const EDU_LABEL: Record<Education, string> = {
  lessThanHighSchool: '고졸 미만',
  highSchool: '고졸',
  someCollege: '대학 중퇴',
  bachelorsOrMore: '대졸+',
};

export function buildCareerTargets(): CareerTarget[] {
  const anchor = values('earnings.menFullTimeMedianToAwi.1999');
  const earn = values('earnings.meanByEducation.1998');
  const growth = values('wageGrowth.byAgeEducation.men');
  const byAge = values('employmentStatus.byAge.men');
  const byEdu = values('employmentStatus.byEducation.men');
  const dur = values('jobDuration.byAgeAtStart.men');
  const mobility = values('jobMobility.youngMen');
  const jls = values('displacement.longTermEarningsLoss');
  const kahn = values('recessionGraduates.wageScar');
  const rr = values('mobility.rankRank');
  const bed = values('business.establishmentSurvival');
  const se = values('selfEmployment.shareMen');
  const wealth = values('wealth.medianNetWorthByAge.2022');

  const targets: CareerTarget[] = [
    { key: 'medianWage', label: '남성 풀타임 임금 중앙값(AWI 배수)', target: anchor.ratio, tolerance: 0.06 },
    { key: 'earn_lessThanHighSchool', label: '평균 소득비 — 고졸 미만/고졸', target: earn.lessThanHighSchool / earn.highSchool, tolerance: 0.08 },
    { key: 'earn_someCollege', label: '평균 소득비 — 대학 중퇴/고졸', target: earn.someCollege / earn.highSchool, tolerance: 0.08 },
    { key: 'earn_bachelors', label: '평균 소득비 — 학사/고졸', target: earn.bachelors / earn.highSchool, tolerance: 0.15 },
    { key: 'earn_advanced', label: '평균 소득비 — 대학원/고졸', target: earn.advanced / earn.highSchool, tolerance: 0.3 },
  ];
  for (const edu of EDUCATIONS) {
    for (const band of AGE_BANDS.slice(0, 4)) {
      targets.push({
        key: `growth_${edu}_${band.key}`,
        label: `실질 임금 성장 %/년 — ${EDU_LABEL[edu]} ${band.from}–${band.to}세`,
        target: growth[`${edu}_${band.key}`],
        tolerance: 1.0,
      });
    }
  }
  for (const band of AGE_BANDS) {
    targets.push({ key: `emp_${band.key}`, label: `취업 비율 ${band.from}–${band.to}세`, target: byAge[`employed_${band.key}`], tolerance: 0.03 });
    targets.push({ key: `unemp_${band.key}`, label: `실업 비율 ${band.from}–${band.to}세`, target: byAge[`unemployed_${band.key}`], tolerance: 0.012 });
  }
  for (const edu of EDUCATIONS) {
    targets.push({ key: `emp_${edu}`, label: `취업 비율 — ${EDU_LABEL[edu]}`, target: byEdu[`employed_${edu}`], tolerance: 0.03 });
    targets.push({ key: `unemp_${edu}`, label: `실업 비율 — ${EDU_LABEL[edu]}`, target: byEdu[`unemployed_${edu}`], tolerance: 0.012 });
  }
  for (const band of AGE_BANDS.slice(0, 4)) {
    targets.push({ key: `dur1_${band.key}`, label: `${band.from}–${band.to}세 시작 일자리 1년 내 종료`, target: dur[`under1y_${band.key}`], tolerance: 0.05 });
    targets.push({ key: `dur5_${band.key}`, label: `${band.from}–${band.to}세 시작 일자리 5년 내 종료`, target: dur[`under5y_${band.key}`], tolerance: 0.05 });
  }
  targets.push(
    { key: 'employers10', label: '첫 10년 고용주 수', target: mobility.employersFirst10Years, tolerance: 1.2 },
    { key: 'jobChangeShare', label: '첫 10년 임금 성장 중 이직 몫(≥)', target: mobility.shareOfEarlyWageGrowthFromJobChanges, tolerance: 0.07, oneSided: 'min' },
    { key: 'jlsLoss', label: '장기근속 실직 5년 뒤 소득 손실(불황기)', target: jls.annualLossShare, tolerance: 0.06 },
    { key: 'kahnInitial', label: '불황 졸업 — 1년 뒤 임금/실업률 1%p', target: kahn.initialLossPerPoint, tolerance: 0.025 },
    { key: 'kahn15', label: '불황 졸업 — 15년 뒤 임금/실업률 1%p', target: kahn.lossAfter15YearsPerPoint, tolerance: 0.015 },
    // personality.earnings.men(Judge et al.): 비친화 남성 +18% — 비교 기준 SD가 불명이라 1SD당 −0.03~−0.12 범위의 중간.
    { key: 'agreeablenessSlope', label: '친화성 1SD당 로그 임금(35–45세)', target: -0.075, tolerance: 0.045 },
    { key: 'rankRank', label: '부모-자녀 소득 순위 기울기', target: rr.rankRankSlope, tolerance: 0.05 },
    { key: 'bed1', label: '사업 1년 생존', target: bed.after1y, tolerance: 0.04 },
    { key: 'bed2', label: '사업 2년 생존', target: bed.after2y, tolerance: 0.04 },
    { key: 'bed5', label: '사업 5년 생존', target: bed.after5y, tolerance: 0.04 },
    { key: 'bed10', label: '사업 10년 생존', target: bed.after10y, tolerance: 0.04 },
    { key: 'bed20', label: '사업 20년 생존', target: bed.after20y, tolerance: 0.04 },
    { key: 'seShare', label: '자영업 비율(25–58세 취업 중)', target: se.share, tolerance: 0.03 },
  );
  const wealthTargets: [string, number, number][] = [
    ['wealth30', 30, wealth.median_under35],
    ['wealth40', 40, wealth.median_35to44],
    ['wealth50', 50, wealth.median_45to54],
    ['wealth60', 60, wealth.median_55to64],
    ['wealth70', 70, wealth.median_65to74],
  ];
  const householdGap = 'SCF는 가구(맞벌이·배우자 자산 포함) — 이 모델은 남성 1인. 결혼 모델과 통합 전까지 구조적 격차.';
  for (const [key, age, dollars] of wealthTargets) {
    const target = dollars / AWI_2022;
    targets.push({ key, label: `순자산 중앙값 ${age}세 (AWI 배수)`, target, tolerance: Math.max(0.15, 0.3 * target), knownGap: householdGap });
  }
  targets.push({
    key: 'wealthMeanMedian60',
    label: '60세 순자산 평균/중앙값',
    target: wealth.mean_55to64 / wealth.median_55to64,
    tolerance: 1.5,
    knownGap: householdGap,
  });
  return targets;
}

export interface CareerMeasureResult {
  values: Record<string, number>;
  outcomes?: CareerOutcome[];
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function slope(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  return sxx > 0 ? sxy / sxx : NaN;
}

export function simulatePopulation(params: CareerParams, n: number, seed: number): CareerOutcome[] {
  const outcomes: CareerOutcome[] = [];
  for (let i = 0; i < n; i++) {
    const worker = buildWorker(drawWorker(createRng(seed * 1_000_003 + i * 2)), params);
    outcomes.push(simulateCareer(worker, params, createRng(seed * 1_000_003 + i * 2 + 1)));
  }
  return outcomes;
}

export function measureCareer(params: CareerParams, opts: { n: number; seed: number; keepOutcomes?: boolean }): CareerMeasureResult {
  const outcomes = simulatePopulation(params, opts.n, opts.seed);
  return measureOutcomes(outcomes, opts.keepOutcomes);
}

export function measureOutcomes(outcomes: CareerOutcome[], keepOutcomes = false): CareerMeasureResult {
  const v: Record<string, number> = {};

  // ---- 임금 수준·학력별 소득 ----
  const wages: number[] = [];
  const earnSum: Record<string, number> = { lessThanHighSchool: 0, highSchool: 0, someCollege: 0, bachelors: 0, advanced: 0 };
  const earnCount: Record<string, number> = { lessThanHighSchool: 0, highSchool: 0, someCollege: 0, bachelors: 0, advanced: 0 };
  for (const o of outcomes) {
    const eduKey = o.worker.education !== 'bachelorsOrMore' ? o.worker.education : o.worker.schooling === 'bachelorsOrMore' ? 'bachelors' : 'advanced';
    for (const r of o.years) {
      if (!r || r.age < 18 || r.age > 64) continue;
      if (r.occupationAtBirthday && r.occupationAtBirthday !== 'military' && Number.isFinite(r.logWageAtBirthday)) wages.push(Math.exp(r.logWageAtBirthday));
      if (r.earnings > 0.02) {
        earnSum[eduKey] += r.earnings;
        earnCount[eduKey] += 1;
      }
    }
  }
  v.medianWage = median(wages);
  const meanEarn = (k: string) => earnSum[k] / Math.max(1, earnCount[k]);
  v.earn_lessThanHighSchool = meanEarn('lessThanHighSchool') / meanEarn('highSchool');
  v.earn_someCollege = meanEarn('someCollege') / meanEarn('highSchool');
  v.earn_bachelors = meanEarn('bachelors') / meanEarn('highSchool');
  v.earn_advanced = meanEarn('advanced') / meanEarn('highSchool');

  // ---- 임금 성장 ----
  const gSum: Record<string, number> = {};
  const gCount: Record<string, number> = {};
  for (const o of outcomes) {
    for (let a = 18; a < 55; a++) {
      const r0 = o.years[a];
      const r1 = o.years[a + 1];
      if (!r0 || !r1 || !Number.isFinite(r0.logWageAtBirthday) || !Number.isFinite(r1.logWageAtBirthday)) continue;
      const band = AGE_BANDS.find((b) => a >= b.from && a <= b.to)!;
      const key = `growth_${o.worker.education}_${band.key}`;
      const g = r1.logWageAtBirthday - r0.logWageAtBirthday + Math.log(1 + realAwiGrowth(r0.year));
      gSum[key] = (gSum[key] ?? 0) + g;
      gCount[key] = (gCount[key] ?? 0) + 1;
    }
  }
  for (const key of Object.keys(gSum)) v[key] = (100 * gSum[key]) / gCount[key];

  // ---- 고용 상태 ----
  const status = (filter: (o: CareerOutcome, age: number) => boolean) => {
    let emp = 0;
    let unemp = 0;
    let total = 0;
    for (const o of outcomes) {
      for (const r of o.years) {
        if (!r || !filter(o, r.age)) continue;
        emp += r.employedMonths;
        unemp += r.unemployedMonths;
        total += 12;
      }
    }
    return { emp: emp / total, unemp: unemp / total };
  };
  for (const band of AGE_BANDS) {
    const s = status((_, age) => age >= band.from && age <= band.to);
    v[`emp_${band.key}`] = s.emp;
    v[`unemp_${band.key}`] = s.unemp;
  }
  for (const edu of EDUCATIONS) {
    const s = status((o, age) => o.worker.education === edu && age >= 18 && age <= 58);
    v[`emp_${edu}`] = s.emp;
    v[`unemp_${edu}`] = s.unemp;
  }

  // ---- 일자리 지속 ----
  const durEnded1: Record<string, number> = {};
  const durEnded5: Record<string, number> = {};
  const durCount: Record<string, number> = {};
  for (const o of outcomes) {
    for (const j of o.jobs) {
      const startAge = j.startAgeMonths / 12;
      const band = AGE_BANDS.slice(0, 4).find((b) => startAge >= b.from && startAge < b.to + 1);
      if (!band) continue;
      const length = j.endAgeMonths !== undefined ? j.endAgeMonths - j.startAgeMonths : Infinity;
      durCount[band.key] = (durCount[band.key] ?? 0) + 1;
      if (length < 12) durEnded1[band.key] = (durEnded1[band.key] ?? 0) + 1;
      if (length < 60) durEnded5[band.key] = (durEnded5[band.key] ?? 0) + 1;
    }
  }
  for (const band of AGE_BANDS.slice(0, 4)) {
    v[`dur1_${band.key}`] = (durEnded1[band.key] ?? 0) / Math.max(1, durCount[band.key] ?? 0);
    v[`dur5_${band.key}`] = (durEnded5[band.key] ?? 0) / Math.max(1, durCount[band.key] ?? 0);
  }

  // ---- 첫 10년: 고용주 수, 이직의 임금 몫 ----
  let employerTotal = 0;
  let between = 0;
  let within = 0;
  for (const o of outcomes) {
    const entry = Math.round(o.worker.schoolExitAge * 12);
    const end = entry + 120;
    const early = o.jobs.filter((j) => !j.student && j.startAgeMonths >= entry && j.startAgeMonths < end);
    employerTotal += early.length;
    const wageJobs = early.filter((j) => j.occupation !== 'selfEmployed' && j.occupation !== 'military');
    const endWage = o.years[Math.floor(end / 12)]?.logWageAtBirthday;
    for (let k = 0; k < wageJobs.length; k++) {
      const j = wageJobs[k];
      if (j.endAgeMonths !== undefined && j.endAgeMonths <= end && j.endLogWage !== undefined) within += j.endLogWage - j.startLogWage;
      else if (Number.isFinite(endWage)) within += endWage - j.startLogWage;
      const next = wageJobs[k + 1];
      if (next && j.endLogWage !== undefined) between += next.startLogWage - j.endLogWage;
    }
  }
  v.employers10 = employerTotal / outcomes.length;
  v.jobChangeShare = between + within !== 0 ? between / (between + within) : NaN;

  // ---- 실직의 장기 손실 (JLS) ----
  {
    const ctrlPre: Record<string, number> = {};
    const ctrlPost: Record<string, number> = {};
    const events: { stratum: string; pre: number; post: number }[] = [];
    for (const o of outcomes) {
      for (let a = 25; a <= 50; a++) {
        const r = o.years[a];
        const pre = o.years[a - 1];
        const post = o.years[a + 5];
        // JLS 표본처럼 노동시장이 느슨할 때(전국 실업률 ≥ 7%: 1980–86, 1991–93, 2009–12)의 실직만.
        if (!r || !pre || !post || !r.longTenureAtBirthday || pre.earnings <= 0 || unemploymentRateAt(r.year) < 7) continue;
        const stratum = `${Math.floor(a / 5)}_${o.worker.education}`;
        if (r.displaced) events.push({ stratum, pre: pre.earnings, post: post.earnings });
        else {
          let clean = true;
          for (let k = a; k <= a + 5 && clean; k++) if (o.years[k]?.displaced) clean = false;
          if (clean) {
            ctrlPre[stratum] = (ctrlPre[stratum] ?? 0) + pre.earnings;
            ctrlPost[stratum] = (ctrlPost[stratum] ?? 0) + post.earnings;
          }
        }
      }
    }
    let actual = 0;
    let expected = 0;
    for (const e of events) {
      if (!ctrlPre[e.stratum]) continue;
      actual += e.post;
      expected += e.pre * (ctrlPost[e.stratum] / ctrlPre[e.stratum]);
    }
    v.jlsLoss = expected > 0 ? 1 - actual / expected : NaN;
    v.jlsEvents = events.length;
  }

  // ---- 불황 졸업 (Kahn) ----
  {
    const x1: number[] = [];
    const y1: number[] = [];
    const x15: number[] = [];
    const y15: number[] = [];
    for (const o of outcomes) {
      if (o.worker.schooling !== 'bachelorsOrMore') continue;
      const exitAge = Math.floor(o.worker.schoolExitAge);
      const w1 = o.years[exitAge + 1]?.logWageAtBirthday;
      const w15 = o.years[exitAge + 15]?.logWageAtBirthday;
      if (Number.isFinite(w1) && o.years[exitAge + 1].occupationAtBirthday) {
        x1.push(o.unemploymentAtSchoolExit);
        y1.push(w1);
      }
      if (Number.isFinite(w15) && o.years[exitAge + 15].occupationAtBirthday) {
        x15.push(o.unemploymentAtSchoolExit);
        y15.push(w15);
      }
    }
    v.kahnInitial = slope(x1, y1);
    v.kahn15 = slope(x15, y15);
  }

  // ---- 성격 ----
  {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const o of outcomes) {
      for (let a = 35; a <= 45; a++) {
        const r = o.years[a];
        if (r && r.occupationAtBirthday && Number.isFinite(r.logWageAtBirthday)) {
          xs.push(o.worker.traits.agreeableness);
          ys.push(r.logWageAtBirthday);
        }
      }
    }
    v.agreeablenessSlope = slope(xs, ys);
  }

  // ---- 세대 간 이동 ----
  {
    const earnings = outcomes.map((o) => {
      let s = 0;
      for (let a = 30; a <= 32; a++) s += o.years[a]?.earnings ?? 0;
      return s / 3;
    });
    const order = earnings.map((e, i) => [e, i] as const).sort((a, b) => a[0] - b[0]);
    const rank = new Array<number>(outcomes.length);
    order.forEach(([, i], k) => (rank[i] = (k + 0.5) / outcomes.length));
    v.rankRank = slope(
      outcomes.map((o) => o.worker.parentRank),
      rank,
    );
  }

  // ---- 사업 생존 ----
  {
    const horizon = 72 * 12;
    for (const [key, yrs] of [['bed1', 1], ['bed2', 2], ['bed5', 5], ['bed10', 10], ['bed20', 20]] as const) {
      let eligible = 0;
      let survived = 0;
      for (const o of outcomes) {
        for (const b of o.businesses) {
          if (b.startAgeMonths + yrs * 12 > horizon) continue;
          eligible += 1;
          if (b.endAgeMonths === undefined || b.endAgeMonths - b.startAgeMonths >= yrs * 12) survived += 1;
        }
      }
      v[key] = eligible ? survived / eligible : NaN;
    }
    let se = 0;
    let emp = 0;
    for (const o of outcomes) {
      for (const r of o.years) {
        if (!r || r.age < 25 || r.age > 58) continue;
        se += r.selfEmployedMonths;
        emp += r.employedMonths;
      }
    }
    v.seShare = se / emp;
  }

  // ---- 재산 ----
  for (const age of [30, 40, 50, 60, 70]) {
    const xs = outcomes.map((o) => o.years[age]?.netWorth).filter((x): x is number => Number.isFinite(x));
    const m = median(xs);
    v[`wealth${age}`] = m;
    if (age === 60) v.wealthMeanMedian60 = xs.reduce((a, b) => a + b, 0) / xs.length / Math.max(0.01, m);
  }

  return { values: v, outcomes: keepOutcomes ? outcomes : undefined };
}

/** 직업 분포 목표의 묶음(목표 키 → 모델 직업들). */
export const OCCUPATION_TARGET_GROUPS: Readonly<Record<string, readonly OccupationId[]>> = {
  aerospaceEngineer: ['aerospaceEngineer'],
  engineer: ['engineer'],
  physician: ['physician'],
  nurse: ['nurse'],
  professor: ['professor'],
  teacher: ['teacher'],
  lawyer: ['lawyer'],
  otherProfessional: ['otherProfessional'],
  managerAndBusiness: ['manager', 'businessProfessional'],
  technician: ['technician'],
  salesRep: ['salesRep'],
  retailSales: ['retailSales'],
  clerical: ['clerical'],
  protectiveService: ['protectiveService'],
  foodService: ['foodService'],
  mechanic: ['mechanic'],
  constructionTrades: ['constructionTrades'],
  operativeAndAerospaceAssembler: ['operative', 'aerospaceAssembler'],
  truckDriver: ['truckDriver'],
  laborer: ['laborer'],
  farmLabor: ['farmLabor'],
};

export function occupationTargets(): Readonly<Record<string, number>> {
  return values('occupation.distributionMenFullTime.1999');
}

/** 18–64세 임금근로자(학생·군인 제외)의 생일 시점 직업 분포를 목표 묶음으로. */
export function measureOccupationShares(outcomes: readonly CareerOutcome[]): Record<string, number> {
  const groupOf = new Map<string, string>();
  for (const [group, occs] of Object.entries(OCCUPATION_TARGET_GROUPS)) for (const occ of occs) groupOf.set(occ, group);
  const counts: Record<string, number> = {};
  let total = 0;
  for (const o of outcomes) {
    for (const r of o.years) {
      if (!r || r.age < 18 || r.age > 64 || !r.occupationAtBirthday || r.occupationAtBirthday === 'military') continue;
      const g = groupOf.get(r.occupationAtBirthday);
      if (!g) continue;
      counts[g] = (counts[g] ?? 0) + 1;
      total += 1;
    }
  }
  const shares: Record<string, number> = {};
  for (const g of Object.keys(OCCUPATION_TARGET_GROUPS)) shares[g] = (counts[g] ?? 0) / Math.max(1, total);
  return shares;
}

export function careerLoss(result: CareerMeasureResult, targets: readonly CareerTarget[]): number {
  let total = 0;
  for (const t of targets) {
    const x = result.values[t.key];
    if (!Number.isFinite(x)) {
      total += 100;
      continue;
    }
    if (t.oneSided === 'min' && x >= t.target) continue;
    const z = (x - t.target) / t.tolerance;
    total += z * z;
  }
  return total;
}
