import { MARRIAGE_MOMENTS } from '../data';
import { createRng } from '../rng';
import { simulateCouple } from './model';
import type { MarriageParams } from './params';
import { sampleCouple } from './population';
import { EDUCATIONS, type Couple, type Education, type JobShockKind, type MonthRecord, type SimulateOptions } from './types';

/**
 * 몬테카를로 결과에서 보정 적률을 계산하고 목표(src/sim/data/marriage.ts)와 비교한다.
 *
 * 측정 정의(모델과 원 연구의 비교 가능성을 위해):
 * - 5년/10년 해체율: 결혼 지속기간에 대한 카플란–마이어(사별·관측 종료는 중도절단).
 * - 학력별 55세까지 이혼: 남편 55세까지 관측됐거나 그 전에 이혼한 부부 중 이혼 비율(남편 학력).
 * - 위험비(실업, 전업주부, 충격 후 3년): (결혼 연차 × 남편 학력 × 결혼 나이대) 층별 기준 위험으로
 *   표준화한 관측/기대 비(SMR). 원 연구들은 공변량을 통제한 추정치라 비교 가능하려면 필요하다 —
 *   연차로만 표준화하면 해고가 저학력·조혼 부부에 몰린 구성 효과(≈1.15배)가 위험비에 섞인다(매개
 *   검증에서 경로를 끊어도 1.15가 남는 걸로 발견).
 * - 결혼 나이 기울기, 부모 이혼·성격 오즈비: "10년 안 이혼" 이진 결과에 대한 단변량 로지스틱
 *   회귀(남편 기준). 10년 전에 사별·중도절단된 부부는 제외.
 */

const MAX_DURATION_MONTHS = 12 * 60;
const SHOCK_WINDOW_MONTHS = 36;

function momentValues(id: string): Readonly<Record<string, number>> {
  const moment = MARRIAGE_MOMENTS.find((m) => m.id === id);
  if (!moment) throw new Error(`moment ${id} not found`);
  return moment.values;
}

export interface Target {
  key: string;
  label: string;
  target: number;
  tolerance: number;
}

/** 보정 목표 17개 — 숫자는 전부 MARRIAGE_MOMENTS에서 읽는다(중복 정의 없음). */
export function buildTargets(): Target[] {
  const disruption = momentValues('firstMarriageDisruption.5and10yr');
  const edu = momentValues('firstMarriageEndsInDivorce.byEducation');
  const age = momentValues('divorceOdds.byAgeAtMarriage');
  const ft = momentValues('divorceRisk.husbandNotFullTime');
  const shock = momentValues('divorceRisk.afterSpouseJobLoss');
  const pd = momentValues('divorceOdds.parentalDivorce');
  const big5 = momentValues('divorceOdds.bigFivePerSD');

  return [
    { key: 'disruption5y', label: '첫 결혼 5년 내 해체', target: disruption.within5y, tolerance: 0.02 },
    { key: 'disruption10y', label: '첫 결혼 10년 내 해체', target: disruption.within10y, tolerance: 0.02 },
    { key: 'by55_lessThanHighSchool', label: '55세까지 이혼 — 고졸 미만(남)', target: edu.men_lessThanHighSchool, tolerance: 0.035 },
    { key: 'by55_highSchool', label: '55세까지 이혼 — 고졸(남)', target: edu.men_highSchool, tolerance: 0.03 },
    { key: 'by55_someCollege', label: '55세까지 이혼 — 대학 중퇴(남)', target: edu.men_someCollege, tolerance: 0.03 },
    { key: 'by55_bachelorsOrMore', label: '55세까지 이혼 — 대졸 이상(남)', target: edu.men_bachelorsOrMore, tolerance: 0.03 },
    { key: 'ageAtMarriageLogOddsPerYear', label: '결혼 나이 1살당 이혼 로그오즈(≤32세)', target: Math.log(1 + age.perYearUntil32), tolerance: 0.025 },
    { key: 'rr_notFullTime', label: '남편 실업 중 위험비', target: ft.husbandNotFullTime / ft.husbandFullTime, tolerance: 0.1 },
    { key: 'rr_homemaker', label: '전업주부 위험비 (null)', target: 1, tolerance: 0.08 },
    // 허용오차 0.13 ≈ 원 추정치(계수 0.309, SE 0.095)의 1 표준오차를 위험비로 환산한 폭.
    { key: 'rr_layoff', label: '남편 해고 후 3년 위험비', target: Math.exp(shock.husbandLayoff_years1to3), tolerance: 0.13 },
    { key: 'rr_plantClosing', label: '공장 폐쇄 후 3년 위험비 (null)', target: Math.exp(shock.plantClosing), tolerance: 0.12 },
    { key: 'rr_disability', label: '장애 후 3년 위험비 (null)', target: Math.exp(shock.disability), tolerance: 0.15 },
    // 목표 구간 1.7~1.9 + 추세 논쟁 → ±0.2.
    { key: 'or_parentsDivorced', label: '부모 이혼 오즈비', target: (pd.gss1994 + pd.ukAdjusted) / 2, tolerance: 0.2 },
    { key: 'or_neuroticism', label: '신경성 1SD 오즈비', target: big5.neuroticism, tolerance: 0.06 },
    { key: 'or_openness', label: '개방성 1SD 오즈비', target: big5.openness, tolerance: 0.06 },
    { key: 'or_conscientiousness', label: '성실성 1SD 오즈비', target: big5.conscientiousness, tolerance: 0.04 },
    { key: 'or_agreeableness', label: '친화성 1SD 오즈비', target: big5.agreeableness, tolerance: 0.04 },
  ];
}

// ---- 집계기 ----

type ExposureKey = 'notFullTime' | 'homemaker' | JobShockKind;

class StandardizedRate {
  /** 기준 집단의 층별 [개월, 이혼]. */
  private readonly baseline = new Map<string, [number, number]>();
  private readonly exposed = new Map<string, [number, number]>();

  add(kind: 'baseline' | 'exposed', stratum: string, divorced: boolean): void {
    const map = kind === 'baseline' ? this.baseline : this.exposed;
    const cell = map.get(stratum) ?? [0, 0];
    cell[0] += 1;
    if (divorced) cell[1] += 1;
    map.set(stratum, cell);
  }

  /** 관측 이혼 / (노출 개월 × 같은 연차 기준 위험)의 합. */
  ratio(): number {
    let observed = 0;
    let expected = 0;
    for (const [stratum, [months, divorces]] of this.exposed) {
      const base = this.baseline.get(stratum);
      if (!base || base[0] === 0) continue;
      observed += divorces;
      expected += months * (base[1] / base[0]);
    }
    return expected > 0 ? observed / expected : NaN;
  }
}

function logisticSlope(xs: readonly number[], ys: readonly number[]): number {
  let b0 = 0;
  let b1 = 0;
  for (let iter = 0; iter < 30; iter++) {
    let g0 = 0;
    let g1 = 0;
    let h00 = 0;
    let h01 = 0;
    let h11 = 0;
    for (let i = 0; i < xs.length; i++) {
      const pr = 1 / (1 + Math.exp(-(b0 + b1 * xs[i])));
      const w = pr * (1 - pr);
      g0 += ys[i] - pr;
      g1 += (ys[i] - pr) * xs[i];
      h00 += w;
      h01 += w * xs[i];
      h11 += w * xs[i] * xs[i];
    }
    const det = h00 * h11 - h01 * h01;
    if (Math.abs(det) < 1e-12) break;
    const d0 = (h11 * g0 - h01 * g1) / det;
    const d1 = (-h01 * g0 + h00 * g1) / det;
    b0 += d0;
    b1 += d1;
    if (Math.abs(d0) + Math.abs(d1) < 1e-9) break;
  }
  return b1;
}

export interface MeasureResult {
  values: Record<string, number>;
  /** 참고용 부가 지표(보정 대상 아님). */
  extras: Record<string, number>;
}

export interface MeasureOptions {
  n: number;
  seed: number;
  disableFinancialConflict?: boolean;
}

/** 부부 n쌍을 시뮬레이션해서 적률을 잰다. 부부 i는 항상 시드 (seed, i)로 만든다(공통 난수). */
export function measure(params: MarriageParams, options: MeasureOptions): MeasureResult {
  const atRisk = new Float64Array(MAX_DURATION_MONTHS + 1);
  const events = new Float64Array(MAX_DURATION_MONTHS + 1);
  const by55: Record<Education, [number, number]> = {
    lessThanHighSchool: [0, 0],
    highSchool: [0, 0],
    someCollege: [0, 0],
    bachelorsOrMore: [0, 0],
  };
  const rates: Record<ExposureKey, StandardizedRate> = {
    notFullTime: new StandardizedRate(),
    homemaker: new StandardizedRate(),
    layoff: new StandardizedRate(),
    plantClosing: new StandardizedRate(),
    disability: new StandardizedRate(),
  };
  const ageX: number[] = [];
  const ageY: number[] = [];
  const within10: { couple: Couple; divorced: number }[] = [];
  let notFullTimeMonths = 0;
  let totalMonths = 0;
  let financialConflictMonths = 0;

  const ageBand = (age: number) => (age < 22 ? 0 : age < 26 ? 1 : age < 30 ? 2 : 3);
  const onMonth = (r: MonthRecord, couple: Couple) => {
    const year = `${Math.min(Math.floor(r.duration / 12), 30)}|${couple.husband.education}|${ageBand(couple.husbandAgeAtMarriage)}`;
    const d = r.divorcedThisMonth;
    totalMonths += 1;
    if (r.financialConflict) financialConflictMonths += 1;

    const notFullTime = r.husbandEmployment !== 'employed';
    if (notFullTime) notFullTimeMonths += 1;
    // Killewald의 "풀타임 아님"은 대부분 실업·시간제다. 장애 개월은 여기서 빼고 Charles & Stephens의
    // 장애 목표(≈1)로 따로 검증한다 — 두 목표를 한 집단에 섞으면 서로 모순된다(README 참고).
    if (r.husbandEmployment === 'unemployed') rates.notFullTime.add('exposed', year, d);
    else if (r.husbandEmployment === 'employed') rates.notFullTime.add('baseline', year, d);
    rates.homemaker.add(couple.wifeIsHomemaker ? 'exposed' : 'baseline', year, d);

    const inWindow = r.lastShock !== undefined && r.monthsSinceShock !== undefined && r.monthsSinceShock < SHOCK_WINDOW_MONTHS;
    for (const kind of ['layoff', 'plantClosing', 'disability'] as const) {
      if (inWindow && r.lastShock === kind) rates[kind].add('exposed', year, d);
      else if (!inWindow) rates[kind].add('baseline', year, d);
    }
  };

  const simOptions: SimulateOptions = {
    censorAtHusbandAge: 55,
    keepMonths: false,
    disableFinancialConflict: options.disableFinancialConflict,
  };

  for (let i = 0; i < options.n; i++) {
    const couple = sampleCouple(createRng(options.seed * 1_000_003 + i * 2));
    const outcome = simulateCouple(couple, params, createRng(options.seed * 1_000_003 + i * 2 + 1), simOptions, onMonth);
    const divorced = outcome.endReason === 'divorce';

    // 카플란–마이어용: 지속 개월 d까지 위험 집합에 있었다.
    const last = Math.min(outcome.durationMonths, MAX_DURATION_MONTHS);
    for (let m = 0; m < last; m++) atRisk[m] += 1;
    if (divorced && last > 0) events[last - 1] += 1;

    const edu = by55[couple.husband.education];
    if (divorced || outcome.endReason === 'censored') {
      edu[0] += 1;
      if (divorced) edu[1] += 1;
    }

    const divorcedWithin10 = divorced && outcome.durationMonths <= 120;
    const observed10 = divorcedWithin10 || outcome.durationMonths >= 120;
    if (observed10) {
      within10.push({ couple, divorced: divorcedWithin10 ? 1 : 0 });
      if (couple.husbandAgeAtMarriage <= 32) {
        ageX.push(couple.husbandAgeAtMarriage);
        ageY.push(divorcedWithin10 ? 1 : 0);
      }
    }
  }

  let survival = 1;
  const survivalAt: Record<number, number> = {};
  for (let m = 0; m <= MAX_DURATION_MONTHS; m++) {
    if (atRisk[m] > 0) survival *= 1 - events[m] / atRisk[m];
    if (m === 59) survivalAt[60] = survival;
    if (m === 119) survivalAt[120] = survival;
  }

  const ys = within10.map((w) => w.divorced);
  const oddsRatioFor = (x: (c: Couple) => number) => Math.exp(logisticSlope(within10.map((w) => x(w.couple)), ys));

  const values: Record<string, number> = {
    disruption5y: 1 - survivalAt[60],
    disruption10y: 1 - survivalAt[120],
    ageAtMarriageLogOddsPerYear: logisticSlope(ageX, ageY),
    rr_notFullTime: rates.notFullTime.ratio(),
    rr_homemaker: rates.homemaker.ratio(),
    rr_layoff: rates.layoff.ratio(),
    rr_plantClosing: rates.plantClosing.ratio(),
    rr_disability: rates.disability.ratio(),
    or_parentsDivorced: oddsRatioFor((c) => (c.husband.parentsDivorced ? 1 : 0)),
    or_neuroticism: oddsRatioFor((c) => c.husband.traits.neuroticism),
    or_openness: oddsRatioFor((c) => c.husband.traits.openness),
    or_conscientiousness: oddsRatioFor((c) => c.husband.traits.conscientiousness),
    or_agreeableness: oddsRatioFor((c) => c.husband.traits.agreeableness),
  };
  for (const education of EDUCATIONS) {
    const [n, d] = by55[education];
    values[`by55_${education}`] = n > 0 ? d / n : NaN;
  }

  return {
    values,
    extras: {
      shareMonthsHusbandNotFullTime: notFullTimeMonths / totalMonths,
      shareMonthsWithFinancialConflict: financialConflictMonths / totalMonths,
    },
  };
}

/** 표준화 제곱 오차 합 — 보정기가 최소화한다. */
export function loss(result: MeasureResult, targets: readonly Target[]): number {
  let total = 0;
  for (const t of targets) {
    const v = result.values[t.key];
    if (!Number.isFinite(v)) {
      total += 100;
      continue;
    }
    const z = (v - t.target) / t.tolerance;
    total += z * z;
  }
  return total;
}
