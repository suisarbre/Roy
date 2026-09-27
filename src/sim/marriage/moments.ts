import type { CareerStepResult } from '../career/model';
import { OCCUPATION_TARGET_GROUPS } from '../career/moments';
import type { CareerOutcome, WomenLaborParams } from '../career/types';
import { FERTILITY_MOMENTS, MARRIAGE_MOMENTS, WOMEN_WORK_MOMENTS } from '../data';
import { realAwiGrowth } from '../career/model';
import type { PersonProfile } from '../person/profile';
import { createRng } from '../rng';
import { simulateCouple, simulateSingleWoman } from './model';
import { FIXED_ASSUMPTIONS, type MarriageParams } from './params';
import { buildHusbandTrack, sampleHousehold, sampleSingleWoman } from './population';
import { EDUCATIONS, type Couple, type Education, type HusbandTrack, type JobShockKind, type MonthRecord, type SimulateOptions } from './types';

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
 * - 출산: 아내가 45세까지 산 결혼의 결혼 중 출산 수(분포, 평균, 아내 학력별). 출산 후 만족도 변화는
 *   첫 출산 3개월 전 → 12개월 후 변화에서 같은 결혼 연차 무자녀 부부의 같은 길이 변화를 빼고 만족도
 *   표준편차로 나눈 값. 실직 후 출산 변화는 사건 기준 비교: 남편 실직(해고·공장 폐쇄, 아내 40세 전)
 *   시점부터 아내 45세·결혼 종료까지의 출산 수를, 실직을 겪지 않은 부부의 같은 조건(아내 학력 × 그
 *   시점 자녀 수 × 아내 나이대) 기준점 이후 출산 수와 비교. "평생 실직 여부"로 나누면 오래 결혼한
 *   부부가 실직도 출산도 많이 겪는 노출 기간 편향으로 +0.66이 나왔다(실제로 겪음).
 * - 전업주부 위험비: 아내가 그 달 가사·육아로 노동시장 밖인 개월 대 취업 중인 개월(층별 SMR). 이제 전업
 *   여부는 결혼 때 고정이 아니라 출산·자녀 나이·이혼에 따라 오가는 아내의 경력 상태다.
 * - 여성 노동: 아내(결혼 전·중·후, 58세까지)와 비혼 여성(15%)을 합친 월 단위 고용 상태, 연속 생일 임금
 *   성장, 임금 중앙값(남편들과의 비), 1985–95년 막내 나이별 어머니 경제활동 참가율.
 */

const MAX_DURATION_MONTHS = 12 * 60;
const SHOCK_WINDOW_MONTHS = 36;

function momentValues(id: string): Readonly<Record<string, number>> {
  const moment = [...MARRIAGE_MOMENTS, ...FERTILITY_MOMENTS, ...WOMEN_WORK_MOMENTS].find((m) => m.id === id);
  if (!moment) throw new Error(`moment ${id} not found`);
  return moment.values;
}

export interface Target {
  key: string;
  label: string;
  target: number;
  tolerance: number;
  /** 모델과 목표의 정의가 구조적으로 어긋나는 알려진 격차. 보정 loss에는 그대로 들어가지만(보정기는
   *  계속 맞추려 함) 검증 판정에서는 FAIL 대신 KNOWN으로 표시하고 이유를 보인다. 허용오차를 몰래
   *  넓히지 않기 위한 장치. */
  knownGap?: string;
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
  const parity = momentValues('childrenEverBorn.distributionAge46');
  const fertEdu = momentValues('childrenEverBorn.byEducation');
  const tp = momentValues('maritalSatisfaction.transitionToParenthood');
  const displaced = momentValues('fertility.afterHusbandDisplacement');
  const netDip =
    (tp.mothers_pregnancyTo12m - tp.nonparentMothers_sameWindow + (tp.fathers_pregnancyTo12m - tp.nonparentFathers_sameWindow)) / 2;

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
    // ---- 출산 (전체 여성 기준 분포와 결혼 중 출산을 비교 — 허용오차 넓게, fertility.ts 참고) ----
    { key: 'parity_0', label: '자녀 0명', target: parity.none, tolerance: 0.035 },
    {
      key: 'parity_1',
      label: '자녀 1명',
      target: parity.one,
      tolerance: 0.035,
      knownGap: '모델은 첫 결혼 안의 출산만 센다 — "한 명 낳고 이혼"한 뒤 새 관계에서의 출산이 빠져 1명이 과대.',
    },
    { key: 'parity_2', label: '자녀 2명', target: parity.two, tolerance: 0.035 },
    { key: 'parity_3', label: '자녀 3명', target: parity.three, tolerance: 0.035 },
    { key: 'parity_4plus', label: '자녀 4명 이상', target: parity.fourPlus, tolerance: 0.035 },
    { key: 'parity_mean', label: '평균 자녀 수', target: parity.mean, tolerance: 0.15 },
    {
      key: 'kids_lessThanHighSchool',
      label: '평균 자녀 — 고졸 미만(아내)',
      target: fertEdu.mean_lessThanHighSchool,
      tolerance: 0.2,
      knownGap: '목표에는 결혼 전·결혼 밖 출산(10대 출산 등)이 포함된다 — 고졸 미만에서 가장 크고, 모델에는 없다.',
    },
    { key: 'kids_highSchool', label: '평균 자녀 — 고졸(아내)', target: fertEdu.mean_highSchool, tolerance: 0.2 },
    { key: 'kids_someCollege', label: '평균 자녀 — 대학 중퇴(아내)', target: fertEdu.mean_someCollege, tolerance: 0.2 },
    { key: 'kids_bachelorsOrMore', label: '평균 자녀 — 대졸 이상(아내)', target: fertEdu.mean_bachelorsOrMore, tolerance: 0.2 },
    { key: 'childless_lessThanHighSchool', label: '무자녀 — 고졸 미만(아내)', target: fertEdu.childless_lessThanHighSchool, tolerance: 0.05 },
    { key: 'childless_bachelorsOrMore', label: '무자녀 — 대졸 이상(아내)', target: fertEdu.childless_bachelorsOrMore, tolerance: 0.05 },
    { key: 'postBirthSatisfaction', label: '첫 출산 후 1년 만족도 순변화(SD)', target: netDip, tolerance: 0.07 },
    { key: 'displacementFertility', label: '남편 실직 후 완결 출산 변화(명)', target: displaced.completedFertilityChange, tolerance: 0.12 },
    ...buildWomenTargets(),
  ];
}

const AGE_BANDS: readonly { key: string; from: number; to: number }[] = [
  { key: '18to24', from: 18, to: 24 },
  { key: '25to34', from: 25, to: 34 },
  { key: '35to44', from: 35, to: 44 },
  { key: '45to54', from: 45, to: 54 },
  { key: '55to58', from: 55, to: 58 },
];
const EDU_LABEL: Record<Education, string> = { lessThanHighSchool: '고졸 미만', highSchool: '고졸', someCollege: '대학 중퇴', bachelorsOrMore: '대졸+' };

function buildWomenTargets(): Target[] {
  const byAge = momentValues('women.employmentStatus.byAge');
  const byEdu = momentValues('women.employmentStatus.byEducation');
  const growth = momentValues('women.wageGrowth.byAgeEducation');
  const ratio = momentValues('women.fullTimeMedianToMen.1999');
  const lfp = momentValues('women.laborForceParticipation.byYoungestChild');
  const targets: Target[] = [];
  for (const band of AGE_BANDS) {
    targets.push({ key: `w_emp_${band.key}`, label: `여성 취업 ${band.from}–${band.to}세`, target: byAge[`employed_${band.key}`], tolerance: 0.03 });
    targets.push({ key: `w_unemp_${band.key}`, label: `여성 실업 ${band.from}–${band.to}세`, target: byAge[`unemployed_${band.key}`], tolerance: 0.012 });
  }
  for (const edu of EDUCATIONS) {
    targets.push({ key: `w_emp_${edu}`, label: `여성 취업 — ${EDU_LABEL[edu]}`, target: byEdu[`employed_${edu}`], tolerance: 0.03 });
    targets.push({ key: `w_unemp_${edu}`, label: `여성 실업 — ${EDU_LABEL[edu]}`, target: byEdu[`unemployed_${edu}`], tolerance: 0.012 });
    for (const band of AGE_BANDS.slice(0, 4)) {
      targets.push({ key: `w_growth_${edu}_${band.key}`, label: `여성 임금 성장 %/년 — ${EDU_LABEL[edu]} ${band.from}–${band.to}세`, target: growth[`${edu}_${band.key}`], tolerance: 1.0 });
    }
  }
  targets.push(
    { key: 'w_wageRatio', label: '여성/남성 임금 중앙값', target: ratio.ratio, tolerance: 0.04 },
    { key: 'w_lfp_under3', label: '어머니 참가율 — 막내 3세 미만', target: lfp.under3, tolerance: 0.04 },
    { key: 'w_lfp_under6', label: '어머니 참가율 — 막내 6세 미만', target: lfp.under6, tolerance: 0.04 },
    { key: 'w_lfp_6to17', label: '어머니 참가율 — 막내 6–17세', target: lfp.age6to17, tolerance: 0.04 },
  );
  return targets;
}

// ---- 보정 내내 고정인 것(부부 표본, 남편 궤적)의 캐시 — 결혼·여성 파라미터와 무관 ----

interface CachedHousehold {
  couple: Couple;
  track: HusbandTrack;
}
const householdCache = new Map<string, CachedHousehold>();
const singleCache = new Map<string, PersonProfile>();

export function householdAt(seed: number, i: number): CachedHousehold {
  const key = `${seed}:${i}`;
  let h = householdCache.get(key);
  if (!h) {
    const couple = sampleHousehold(createRng(seed * 1_000_003 + i * 2));
    h = { couple, track: buildHusbandTrack(couple.husbandProfile) };
    householdCache.set(key, h);
  }
  return h;
}

function singleWomanAt(seed: number, i: number): PersonProfile {
  const key = `${seed}:${i}`;
  let w = singleCache.get(key);
  if (!w) {
    w = sampleSingleWoman(createRng(seed * 1_000_003 + 777_777 + i * 2));
    singleCache.set(key, w);
  }
  return w;
}

/** 여성 노동 적률 집계기. */
class WomenLaborTally {
  private readonly status = new Map<string, [number, number, number]>(); // [월 수, 취업, 실업]
  private readonly growth = new Map<string, [number, number]>();
  readonly wages: number[] = [];
  readonly occupations = new Map<string, number>();
  occupationTotal = 0;
  private readonly lfp = new Map<string, [number, number]>();

  addCareer(outcome: CareerOutcome, education: Education): void {
    for (const r of outcome.years) {
      if (!r || r.age < 18 || r.age > 58) continue;
      const band = AGE_BANDS.find((b) => r.age >= b.from && r.age <= b.to)!.key;
      for (const key of [band, education]) {
        const cell = this.status.get(key) ?? [0, 0, 0];
        cell[0] += 12;
        cell[1] += r.employedMonths;
        cell[2] += r.unemployedMonths;
        this.status.set(key, cell);
      }
      if (r.occupationAtBirthday && r.occupationAtBirthday !== 'military' && Number.isFinite(r.logWageAtBirthday)) {
        this.wages.push(Math.exp(r.logWageAtBirthday));
        this.occupations.set(r.occupationAtBirthday, (this.occupations.get(r.occupationAtBirthday) ?? 0) + 1);
        this.occupationTotal += 1;
      }
    }
    for (let a = 18; a < 55; a++) {
      const r0 = outcome.years[a];
      const r1 = outcome.years[a + 1];
      if (!r0 || !r1 || !Number.isFinite(r0.logWageAtBirthday) || !Number.isFinite(r1.logWageAtBirthday)) continue;
      const band = AGE_BANDS.find((b) => a >= b.from && a <= b.to)!.key;
      const key = `${education}_${band}`;
      const cell = this.growth.get(key) ?? [0, 0];
      cell[0] += 1;
      cell[1] += r1.logWageAtBirthday - r0.logWageAtBirthday + Math.log(1 + realAwiGrowth(r0.year));
      this.growth.set(key, cell);
    }
  }

  onMonth = (result: CareerStepResult, youngest: number | undefined): void => {
    if (youngest === undefined || result.year < 1985 || result.year > 1995 || youngest >= 216) return;
    const inForce = result.state === 'employed' || result.state === 'selfEmployed' || result.state === 'unemployed';
    const brackets = youngest < 36 ? ['under3', 'under6'] : youngest < 72 ? ['under6'] : ['age6to17'];
    for (const b of brackets) {
      const cell = this.lfp.get(b) ?? [0, 0];
      cell[0] += 1;
      if (inForce) cell[1] += 1;
      this.lfp.set(b, cell);
    }
  };

  write(values: Record<string, number>, menWages: number[]): void {
    for (const [key, [months, emp, unemp]] of this.status) {
      values[`w_emp_${key}`] = emp / months;
      values[`w_unemp_${key}`] = unemp / months;
    }
    for (const [key, [n, sum]] of this.growth) values[`w_growth_${key}`] = (100 * sum) / n;
    values.w_wageRatio = median(this.wages) / median(menWages);
    for (const b of ['under3', 'under6', 'age6to17']) {
      const cell = this.lfp.get(b);
      values[`w_lfp_${b === 'age6to17' ? '6to17' : b}`] = cell ? cell[1] / cell[0] : NaN;
    }
  }

  occupationShares(): Record<string, number> {
    const shares: Record<string, number> = {};
    for (const [group, occs] of Object.entries(OCCUPATION_TARGET_GROUPS)) {
      let c = 0;
      for (const o of occs) c += this.occupations.get(o) ?? 0;
      shares[group] = c / Math.max(1, this.occupationTotal);
    }
    return shares;
  }
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// ---- 집계기 ----

type ExposureKey = 'notFullTime' | 'homemaker' | 'youngChild' | 'olderChild' | JobShockKind;

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
  /** 여성 직업 분포(목표 묶음) — 비례 조정용. */
  womenOccupationShares: Record<string, number>;
}

export interface MeasureOptions {
  n: number;
  seed: number;
  disableFinancialConflict?: boolean;
}

/** 부부 n쌍(+ 비혼 여성)을 시뮬레이션해서 적률을 잰다. 부부 i는 항상 시드 (seed, i)로 만든다(공통 난수). */
export function measure(params: MarriageParams, women: WomenLaborParams, options: MeasureOptions): MeasureResult {
  const womenTally = new WomenLaborTally();
  const menWages: number[] = [];
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
    youngChild: new StandardizedRate(),
    olderChild: new StandardizedRate(),
  };
  const parityCounts = [0, 0, 0, 0, 0];
  let parityTotal = 0;
  let paritySum = 0;
  const kidsByEdu: Record<Education, [number, number, number]> = {
    lessThanHighSchool: [0, 0, 0],
    highSchool: [0, 0, 0],
    someCollege: [0, 0, 0],
    bachelorsOrMore: [0, 0, 0],
  }; // [부부 수, 자녀 합, 무자녀 수]
  // 실직 후 출산(사건 기준): 층(아내 학력|그 시점 자녀 수|아내 나이대)별 [노출 수, 이후 출산 합, 대조 수, 대조 이후 출산 합]
  const displacement = new Map<string, [number, number, number, number]>();
  let displacementEvents: { stratum: string; atDuration: number }[] = [];
  // 출산 후 만족도: 부부별 만족도 시계열 버퍼 + 무자녀 기준 변화(결혼 연차별)
  const satSeries = new Float64Array(12 * 60 + 2);
  let satLen = 0;
  let displacedBefore40 = false;
  const stratumAt = (couple: Couple, duration: number, kidsSoFar: number) => {
    const wifeAge = couple.wifeAgeAtMarriage + duration / 12;
    return `${couple.wife.education}|${Math.min(kidsSoFar, 3)}|${Math.floor(wifeAge / 5)}`;
  };
  const baselineDelta = new Map<number, [number, number]>();
  const parentDeltas: { year: number; delta: number }[] = [];
  let satSum = 0;
  let satSqSum = 0;
  let satN = 0;
  const ageX: number[] = [];
  const ageY: number[] = [];
  const within10: { couple: Couple; divorced: number }[] = [];
  let notFullTimeMonths = 0;
  let totalMonths = 0;
  let financialConflictMonths = 0;

  const ageBand = (age: number) => (age < 22 ? 0 : age < 26 ? 1 : age < 30 ? 2 : 3);
  const onMonth = (r: MonthRecord, couple: Couple) => {
    satSeries[satLen++] = r.satisfaction;
    satSum += r.satisfaction;
    satSqSum += r.satisfaction * r.satisfaction;
    satN += 1;
    if (r.monthsSinceShock === 0 && (r.lastShock === 'layoff' || r.lastShock === 'plantClosing')) {
      const wifeAge = couple.wifeAgeAtMarriage + r.duration / 12;
      if (wifeAge < 40) {
        displacedBefore40 = true;
        // 이번 달 출생은 사건 이전으로 친다(사건 이후 출산만 셈).
        displacementEvents.push({ stratum: stratumAt(couple, r.duration, r.childrenCount), atDuration: r.duration });
      }
    }
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
    // 전업 개월은 어린 자녀가 있는 달에 몰린다 — 자녀가 이혼을 막는 효과가 섞이지 않게 자녀 수·막내 6세
    // 미만 여부까지 층에 넣는다(원 연구의 가구 공변량 통제에 해당).
    const homeStratum = `${year}|k${Math.min(r.childrenCount, 2)}|y${r.youngestChildAgeMonths !== undefined && r.youngestChildAgeMonths < 72 ? 1 : 0}`;
    if (r.wifeAtHome) rates.homemaker.add('exposed', homeStratum, d);
    else if (r.wifeEmployed) rates.homemaker.add('baseline', homeStratum, d);

    if (r.childrenCount === 0) {
      rates.youngChild.add('baseline', year, d);
      rates.olderChild.add('baseline', year, d);
    } else if (r.youngestChildAgeMonths !== undefined && r.youngestChildAgeMonths < 36) {
      rates.youngChild.add('exposed', year, d);
    } else if (r.youngestChildAgeMonths !== undefined && r.youngestChildAgeMonths >= 72) {
      rates.olderChild.add('exposed', year, d);
    }

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
    wifeUntilAge: 59,
    onWifeMonth: womenTally.onMonth,
  };

  for (let i = 0; i < options.n; i++) {
    const { couple, track } = householdAt(options.seed, i);
    for (const w of track.birthdayWages) menWages.push(w);
    satLen = 0;
    displacedBefore40 = false;
    displacementEvents = [];
    const outcome = simulateCouple(couple, params, { husbandTrack: track, women, seed: options.seed * 1_000_003 + i * 2 + 1 }, simOptions, onMonth);
    if (outcome.wifeCareer) womenTally.addCareer(outcome.wifeCareer, couple.wifeProfile.education);
    const divorced = outcome.endReason === 'divorce';

    // ---- 출산 집계 ----
    const kids = outcome.birthDurations.length;
    if (outcome.wifeReached45) {
      parityCounts[Math.min(kids, 4)] += 1;
      parityTotal += 1;
      paritySum += kids;
      const e = kidsByEdu[couple.wife.education];
      e[0] += 1;
      e[1] += kids;
      if (kids === 0) e[2] += 1;
    }
    // 실직 후 출산(사건 기준). 노출: 실직 시점 이후 출산. 대조: 한 번도 실직 안 한 부부의 매 결혼 기념일
    // (아내 40세 전) 기준점 이후 출산. 둘 다 결혼 안에서만(이혼하면 거기서 멈춤 — 효과의 일부).
    const birthsAfter = (d: number) => outcome.birthDurations.filter((b) => b > d).length;
    const kidsAt = (d: number) => outcome.birthDurations.filter((b) => b <= d).length;
    if (outcome.wifeReached45) {
      if (displacedBefore40) {
        for (const ev of displacementEvents) {
          const cell = displacement.get(ev.stratum) ?? [0, 0, 0, 0];
          cell[0] += 1;
          cell[1] += birthsAfter(ev.atDuration);
          displacement.set(ev.stratum, cell);
        }
      } else {
        for (let d = 12; d < outcome.durationMonths && couple.wifeAgeAtMarriage + d / 12 < 40; d += 12) {
          const stratum = stratumAt(couple, d, kidsAt(d));
          const cell = displacement.get(stratum) ?? [0, 0, 0, 0];
          cell[2] += 1;
          cell[3] += birthsAfter(d);
          displacement.set(stratum, cell);
        }
      }
    }
    // 출산 후 만족도: 첫 출산 전후 [b−3, b+12]
    const first = outcome.birthDurations[0];
    if (first !== undefined && first >= 3 && first + 12 < satLen) {
      parentDeltas.push({ year: Math.floor(first / 12), delta: satSeries[first + 12] - satSeries[first - 3] });
    }
    // 무자녀 기준: 1년 간격으로 창을 잡되 그 창 끝까지 출산이 없어야 한다.
    const noBirthUntil = first ?? Number.POSITIVE_INFINITY;
    for (let w = 0; w + 15 < satLen && w + 15 < noBirthUntil; w += 12) {
      const year = Math.floor((w + 3) / 12);
      const cell = baselineDelta.get(year) ?? [0, 0];
      cell[0] += 1;
      cell[1] += satSeries[w + 15] - satSeries[w];
      baselineDelta.set(year, cell);
    }

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

  // 비혼 여성: 결혼한 아내 n명 대비 15/85.
  const singles = Math.round((options.n * FIXED_ASSUMPTIONS.neverMarriedWomenShare) / (1 - FIXED_ASSUMPTIONS.neverMarriedWomenShare));
  for (let i = 0; i < singles; i++) {
    const profile = singleWomanAt(options.seed, i);
    womenTally.addCareer(simulateSingleWoman(profile, women, 59, undefined, womenTally.onMonth), profile.education);
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
    const [kn, ksum, kzero] = kidsByEdu[education];
    values[`kids_${education}`] = kn > 0 ? ksum / kn : NaN;
    if (education === 'lessThanHighSchool' || education === 'bachelorsOrMore') values[`childless_${education}`] = kn > 0 ? kzero / kn : NaN;
  }
  ['parity_0', 'parity_1', 'parity_2', 'parity_3', 'parity_4plus'].forEach((key, k) => (values[key] = parityCounts[k] / parityTotal));
  values.parity_mean = paritySum / parityTotal;

  const satMean = satSum / satN;
  const satSd = Math.sqrt(Math.max(1e-9, satSqSum / satN - satMean * satMean));
  let dipSum = 0;
  let dipN = 0;
  for (const { year, delta } of parentDeltas) {
    const base = baselineDelta.get(year);
    if (!base || base[0] < 20) continue;
    dipSum += delta - base[1] / base[0];
    dipN += 1;
  }
  values.postBirthSatisfaction = dipN > 0 ? dipSum / dipN / satSd : NaN;

  let dispWeight = 0;
  let dispDiff = 0;
  for (const [en, esum, un, usum] of displacement.values()) {
    if (en === 0 || un === 0) continue;
    dispDiff += en * (esum / en - usum / un);
    dispWeight += en;
  }
  values.displacementFertility = dispWeight > 0 ? dispDiff / dispWeight : NaN;
  womenTally.write(values, menWages);

  return {
    values,
    womenOccupationShares: womenTally.occupationShares(),
    extras: {
      shareMonthsHusbandNotFullTime: notFullTimeMonths / totalMonths,
      shareMonthsWithFinancialConflict: financialConflictMonths / totalMonths,
      rr_youngChild: rates.youngChild.ratio(),
      rr_olderChild: rates.olderChild.ratio(),
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
