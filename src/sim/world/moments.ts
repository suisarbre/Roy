import type { WomenLaborParams } from '../career/types';
import { FERTILITY_MOMENTS, MARRIAGE_MOMENTS, SOCIAL_MOMENTS } from '../data';
import type { MarriageParams } from '../marriage/params';
import type { Education } from '../marriage/types';
import { sampleProfile, type PersonProfile } from '../person/profile';
import { createRng } from '../rng';
import { World, type WorldPerson, type WorldUnion } from './engine';
import type { WorldModule } from './modules';
import type { WorldParams } from './params';

/**
 * 공유 세계의 적률 — 주인공(1957–64년생 남녀 반반)들의 인생에서 잰다. 상대들은 만날 때 실체화된 사람들.
 *
 * - 결혼 이력은 55세 시점(55세 전에 죽은 주인공은 제외 — NLSY79는 생존자 조사).
 * - 첫 결혼 해체율: 첫 결혼 지속기간의 카플란–마이어(사별·55세는 중도절단).
 * - 혼외 출생: 주인공 여성의 1985–95년 출생 중 결혼 밖 비율(횡단면 목표와 나이 구성이 달라 허용오차 넓게).
 * - 출산: 45세까지 산 주인공 여성의 모든 출산(결혼 안팎) — 결혼 모델만일 때의 알려진 격차(자녀 1명 과대,
 *   고졸 미만 과소)가 여기서 풀리는지 본다.
 */

export interface WorldTarget {
  key: string;
  label: string;
  target: number;
  tolerance: number;
}

function values(id: string): Readonly<Record<string, number>> {
  const m = [...SOCIAL_MOMENTS, ...MARRIAGE_MOMENTS, ...FERTILITY_MOMENTS].find((x) => x.id === id);
  if (!m) throw new Error(`moment ${id} not found`);
  return m.values;
}

const EDU: readonly Education[] = ['lessThanHighSchool', 'highSchool', 'someCollege', 'bachelorsOrMore'];

export function buildWorldTargets(): WorldTarget[] {
  const h = values('marriageHistory.by55');
  const e = values('marriageHistory.byEducation');
  const rem = values('remarriage');
  const cohab = values('cohabitation.beforeFirstMarriage');
  const nm = values('births.nonmaritalShare');
  const nmEdu = values('births.nonmaritalByEducation.1992');
  const nmCohab = values('births.nonmaritalCohabitingShare');
  const inf = values('infidelity.ever');
  const mpf = values('births.multiPartnerFertility');
  const met = values('couples.howMet.1995');
  const men = values('firstMarriageEndsInDivorce.byEducation');
  const disruption = values('firstMarriageDisruption.5and10yr');
  const parity = values('childrenEverBorn.distributionAge46');
  const fertEdu = values('childrenEverBorn.byEducation');
  return [
    { key: 'everMarried_men', label: '55세까지 결혼 경험 — 남', target: h.everMarried_men, tolerance: 0.03 },
    { key: 'everMarried_women', label: '55세까지 결혼 경험 — 여', target: h.everMarried_women, tolerance: 0.03 },
    { key: 'everDivorced_men', label: '55세까지 이혼 경험 — 남(전체)', target: h.everDivorced_men, tolerance: 0.04 },
    { key: 'everDivorced_women', label: '55세까지 이혼 경험 — 여(전체)', target: h.everDivorced_women, tolerance: 0.04 },
    { key: 'marriages_0', label: '결혼 0번', target: h.marriages_0, tolerance: 0.03 },
    { key: 'marriages_1', label: '결혼 1번', target: h.marriages_1, tolerance: 0.04 },
    { key: 'marriages_2', label: '결혼 2번', target: h.marriages_2, tolerance: 0.03 },
    { key: 'marriages_3plus', label: '결혼 3번 이상', target: h.marriages_3plus, tolerance: 0.02 },
    { key: 'everMarried_men_lessThanHighSchool', label: '결혼 경험 — 남 고졸 미만', target: e.everMarried_men_lessThanHighSchool, tolerance: 0.05 },
    { key: 'everMarried_men_bachelorsOrMore', label: '결혼 경험 — 남 대졸+', target: e.everMarried_men_bachelorsOrMore, tolerance: 0.04 },
    { key: 'everMarried_women_lessThanHighSchool', label: '결혼 경험 — 여 고졸 미만', target: e.everMarried_women_lessThanHighSchool, tolerance: 0.05 },
    { key: 'everMarried_women_bachelorsOrMore', label: '결혼 경험 — 여 대졸+', target: e.everMarried_women_bachelorsOrMore, tolerance: 0.04 },
    ...EDU.map((edu) => ({ key: `divorced_men_${edu}`, label: `결혼 경험 남성의 이혼 — ${edu}`, target: men[`men_${edu}`], tolerance: 0.04 })),
    { key: 'divorced_women_lessThanHighSchool', label: '결혼 경험 여성의 이혼 — 고졸 미만', target: e.divorcedAmongMarried_women_lessThanHighSchool, tolerance: 0.05 },
    { key: 'divorced_women_bachelorsOrMore', label: '결혼 경험 여성의 이혼 — 대졸+', target: e.divorcedAmongMarried_women_bachelorsOrMore, tolerance: 0.05 },
    { key: 'remarried', label: '이혼 후 재혼', target: rem.remarriedShare, tolerance: 0.05 },
    { key: 'yearsToRemarriage', label: '재혼까지 평균(년)', target: rem.meanYearsToRemarriage, tolerance: 1 },
    { key: 'secondDivorced', label: '두 번째 결혼의 이혼', target: rem.secondMarriageDivorced, tolerance: 0.06 },
    { key: 'firstDisruption5y', label: '첫 결혼 5년 내 해체', target: disruption.within5y, tolerance: 0.025 },
    { key: 'firstDisruption10y', label: '첫 결혼 10년 내 해체', target: disruption.within10y, tolerance: 0.025 },
    { key: 'ageFirstMarriage_men_lessThanHighSchool', label: '첫 결혼 나이 — 남 고졸 미만', target: 24, tolerance: 1 },
    { key: 'ageFirstMarriage_men_bachelorsOrMore', label: '첫 결혼 나이 — 남 대졸+', target: 28, tolerance: 1 },
    { key: 'cohab_1980to84', label: '결혼 전 동거 — 1980–84년 결혼', target: cohab.married1980to84, tolerance: 0.07 },
    { key: 'cohab_1985to89', label: '결혼 전 동거 — 1985–89년 결혼', target: cohab.married1985to89, tolerance: 0.08 },
    { key: 'cohab_1990to94', label: '결혼 전 동거 — 1990–94년 결혼', target: cohab.married1990to94, tolerance: 0.1 },
    { key: 'nonmarital', label: '혼외 출생 비율(1985–95)', target: (nm.y1985 + nm.y1990 + nm.y1995) / 3, tolerance: 0.06 },
    { key: 'nonmarital_lessThanHighSchool', label: '혼외 출생 — 고졸 미만 산모', target: (nmEdu.years0to8 + nmEdu.years9to11) / 2, tolerance: 0.1 },
    { key: 'nonmarital_highSchool', label: '혼외 출생 — 고졸 산모', target: nmEdu.years12, tolerance: 0.08 },
    { key: 'nonmarital_someCollege', label: '혼외 출생 — 대학 중퇴 산모', target: nmEdu.years13to15, tolerance: 0.07 },
    { key: 'nonmarital_bachelorsOrMore', label: '혼외 출생 — 대졸+ 산모', target: nmEdu.years16plus, tolerance: 0.04 },
    { key: 'nonmaritalCohabiting', label: '혼외 출생 중 동거 커플', target: (nmCohab.y1980to84 + nmCohab.y1990to94) / 2, tolerance: 0.1 },
    { key: 'mpf_mothers2plus', label: '자녀 2명+ 어머니 중 아버지 둘 이상', target: mpf.mothersTwoPlus, tolerance: 0.04 },
    { key: 'cheated_men', label: '결혼 중 외도 경험 — 남', target: inf.men, tolerance: 0.04 },
    { key: 'cheated_women', label: '결혼 중 외도 경험 — 여', target: inf.women, tolerance: 0.04 },
    { key: 'metWorkToFriends', label: '만난 경로 — 직장/친구 비', target: met.coworkers / met.friends, tolerance: 0.15 },
    { key: 'parity_0', label: '자녀 0명(여, 45세)', target: parity.none, tolerance: 0.035 },
    { key: 'parity_1', label: '자녀 1명', target: parity.one, tolerance: 0.035 },
    { key: 'parity_2', label: '자녀 2명', target: parity.two, tolerance: 0.035 },
    { key: 'parity_3', label: '자녀 3명', target: parity.three, tolerance: 0.035 },
    { key: 'parity_4plus', label: '자녀 4명 이상', target: parity.fourPlus, tolerance: 0.035 },
    ...EDU.map((edu) => ({ key: `kids_${edu}`, label: `평균 자녀 — ${edu}(여)`, target: fertEdu[`mean_${edu}`], tolerance: 0.2 })),
    { key: 'childless_lessThanHighSchool', label: '무자녀 — 고졸 미만(여)', target: fertEdu.childless_lessThanHighSchool, tolerance: 0.05 },
    { key: 'childless_bachelorsOrMore', label: '무자녀 — 대졸+(여)', target: fertEdu.childless_bachelorsOrMore, tolerance: 0.05 },
  ];
}

const profileCache = new Map<string, PersonProfile>();

export function focalProfile(seed: number, i: number): PersonProfile {
  const key = `${seed}:${i}`;
  let p = profileCache.get(key);
  if (!p) {
    const rng = createRng(seed * 1_000_003 + i * 7 + 3);
    const birthYear = 1957 + Math.floor(rng() * 8);
    p = sampleProfile(Math.floor(rng() * 4294967296), { sex: i % 2 === 0 ? 'male' : 'female', birthYear });
    profileCache.set(key, p);
  }
  return p;
}

export interface WorldMeasure {
  values: Record<string, number>;
  world: World;
  focal: WorldPerson[];
}

export interface FocalWorldOptions {
  /** 붙일 도메인 모듈(건강·범죄·친족·주거). */
  modules?: readonly WorldModule[];
  /** 언제까지 굴릴지(총 개월). 기본: 1965년생이 58세가 되는 2023년 초. 건강(기대수명)은 더 길게. */
  until?: number;
}

export function runFocalWorld(
  params: { world: WorldParams; marriage: MarriageParams; women: WomenLaborParams },
  n: number,
  seed: number,
  options: FocalWorldOptions = {},
): { world: World; focal: WorldPerson[] } {
  const world = new World(params, 1957 * 12 + 16 * 12, { modules: options.modules });
  const focal: WorldPerson[] = [];
  for (let i = 0; i < n; i++) focal.push(world.addPerson(focalProfile(seed, i), true));
  world.runUntil(options.until ?? 1965 * 12 + 58 * 12);
  return { world, focal };
}

export function measureWorld(params: { world: WorldParams; marriage: MarriageParams; women: WomenLaborParams }, opts: { n: number; seed: number }): WorldMeasure {
  const { world, focal } = runFocalWorld(params, opts.n, opts.seed);
  const v: Record<string, number> = {};
  const age = (p: WorldPerson, years: number) => p.birthTotal + years * 12;
  const unionsOf = (p: WorldPerson): WorldUnion[] => p.unionIds.map((id) => world.unions.get(id)!);
  const marriagesBy = (p: WorldPerson, until: number) =>
    unionsOf(p)
      .filter((u) => u.marriedAt !== undefined && u.marriedAt < until)
      .sort((a, b) => a.marriedAt! - b.marriedAt!);

  // ---- 55세 결혼 이력 ----
  const tally = new Map<string, [number, number]>();
  const add = (key: string, yes: boolean) => {
    const c = tally.get(key) ?? [0, 0];
    c[0] += 1;
    if (yes) c[1] += 1;
    tally.set(key, c);
  };
  const marriageCounts = [0, 0, 0, 0];
  let countTotal = 0;
  let remarriedYears = 0;
  let remarriedN = 0;
  const firstAges = new Map<string, [number, number]>();
  let workMet = 0;
  let friendsMet = 0;
  // 첫 결혼 카플란–마이어
  const MAXD = 12 * 45;
  const atRisk = new Float64Array(MAXD + 1);
  const events = new Float64Array(MAXD + 1);

  for (const p of focal) {
    const until = age(p, 55);
    if (p.diedAt !== undefined && p.diedAt < until) continue;
    const sex = p.profile.sex === 'male' ? 'men' : 'women';
    const edu = p.profile.education;
    const marriages = marriagesBy(p, until);
    const everMarried = marriages.length > 0;
    const divorces = marriages.filter((u) => u.endReason === 'divorce' && u.endedAt! < until);
    add(`everMarried_${sex}`, everMarried);
    add(`everDivorced_${sex}`, divorces.length > 0);
    if (edu === 'lessThanHighSchool' || edu === 'bachelorsOrMore') add(`everMarried_${sex}_${edu}`, everMarried);
    if (everMarried) {
      add(`divorced_${sex}_${edu}`, divorces.length > 0);
      add(`cheated_${sex}`, p.cheatedWhileMarried);
      const first = marriages[0];
      if (sex === 'men') {
        const a = (first.marriedAt! - p.birthTotal) / 12;
        const c = firstAges.get(edu) ?? [0, 0];
        c[0] += 1;
        c[1] += a;
        firstAges.set(edu, c);
      }
      if (first.channel === 'work') workMet += 1;
      if (first.channel === 'friends') friendsMet += 1;
      // 첫 결혼 해체(연차별)
      const end = first.endedAt !== undefined && first.endedAt < until ? first.endedAt : until;
      const d = Math.min(MAXD, end - first.marriedAt!);
      for (let m = 0; m < d; m++) atRisk[m] += 1;
      if (first.endReason === 'divorce' && first.endedAt! < until && d > 0) events[d - 1] += 1;
      if (sex === 'women' && first.marriedAt! >= 1980 * 12 && first.marriedAt! < 1995 * 12) {
        const y = Math.floor(first.marriedAt! / 12);
        const period = y < 1985 ? '1980to84' : y < 1990 ? '1985to89' : '1990to94';
        add(`cohab_${period}`, first.cohabitedAt !== undefined && first.cohabitedAt < first.marriedAt!);
      }
    }
    marriageCounts[Math.min(3, marriages.length)] += 1;
    countTotal += 1;
    // 재혼: 첫 이혼 뒤
    if (divorces.length > 0) {
      const firstDivorce = divorces[0];
      const next = marriages.find((u) => u.marriedAt! > firstDivorce.endedAt!);
      add('remarried', next !== undefined);
      if (next) {
        remarriedYears += (next.marriedAt! - firstDivorce.endedAt!) / 12;
        remarriedN += 1;
      }
    }
    if (marriages.length >= 2) add('secondDivorced', marriages[1].endReason === 'divorce' && marriages[1].endedAt! < until);
  }

  for (const [key, [n, yes]] of tally) v[key] = yes / n;
  v.marriages_0 = marriageCounts[0] / countTotal;
  v.marriages_1 = marriageCounts[1] / countTotal;
  v.marriages_2 = marriageCounts[2] / countTotal;
  v.marriages_3plus = marriageCounts[3] / countTotal;
  v.yearsToRemarriage = remarriedN ? remarriedYears / remarriedN : NaN;
  for (const edu of ['lessThanHighSchool', 'bachelorsOrMore']) {
    const c = firstAges.get(edu);
    v[`ageFirstMarriage_men_${edu}`] = c ? c[1] / c[0] : NaN;
  }
  v.metWorkToFriends = friendsMet ? workMet / friendsMet : NaN;
  let survival = 1;
  for (let m = 0; m <= MAXD; m++) {
    if (atRisk[m] > 0) survival *= 1 - events[m] / atRisk[m];
    if (m === 59) v.firstDisruption5y = 1 - survival;
    if (m === 119) v.firstDisruption10y = 1 - survival;
  }

  // ---- 출산 ----
  const parity = [0, 0, 0, 0, 0];
  let parityN = 0;
  const kidsByEdu = new Map<Education, [number, number, number]>();
  const nmByEdu = new Map<string, [number, number]>();
  let nmCohab = 0;
  let nmTotal = 0;
  // 여러 상대와의 출산(남, 40세) + 남녀 평균 자녀(45세, 진단용)
  let mpfN = 0;
  let mpfYes = 0;
  let menKids = 0;
  let menN = 0;
  for (const p of focal) {
    if (p.profile.sex !== 'male') continue;
    if (p.diedAt !== undefined && p.diedAt < age(p, 45)) continue;
    const by40 = p.children.filter((c) => c.bornAt < age(p, 40));
    mpfN += 1;
    if (new Set(by40.map((c) => c.unionId)).size > 1) mpfYes += 1;
    menKids += p.children.filter((c) => c.bornAt < age(p, 46)).length;
    menN += 1;
  }
  v.mpf_men_by40 = mpfN ? mpfYes / mpfN : NaN;
  v.kids_men = menN ? menKids / menN : NaN;
  let mpfMothers = 0;
  let mothers = 0;
  let mpf2 = 0;
  let mothers2 = 0;
  for (const p of focal) {
    if (p.profile.sex !== 'female') continue;
    const edu = p.profile.education;
    if (p.children.length > 0 && (p.diedAt === undefined || p.diedAt >= age(p, 45))) {
      mothers += 1;
      const multi = new Set(p.children.map((c) => c.unionId)).size > 1;
      if (multi) mpfMothers += 1;
      if (p.children.filter((c) => c.bornAt < age(p, 46)).length >= 2) {
        mothers2 += 1;
        if (multi) mpf2 += 1;
      }
    }
    for (const c of p.children) {
      const y = Math.floor(c.bornAt / 12);
      if (y < 1985 || y > 1995) continue;
      for (const key of ['all', edu]) {
        const cell = nmByEdu.get(key) ?? [0, 0];
        cell[0] += 1;
        if (!c.marital) cell[1] += 1;
        nmByEdu.set(key, cell);
      }
      if (!c.marital) {
        nmTotal += 1;
        if (c.cohabiting) nmCohab += 1;
      }
    }
    if (p.diedAt !== undefined && p.diedAt < age(p, 45)) continue;
    const k = p.children.filter((c) => c.bornAt < age(p, 46)).length;
    parity[Math.min(4, k)] += 1;
    parityN += 1;
    const cell = kidsByEdu.get(edu) ?? [0, 0, 0];
    cell[0] += 1;
    cell[1] += k;
    if (k === 0) cell[2] += 1;
    kidsByEdu.set(edu, cell);
  }
  ['parity_0', 'parity_1', 'parity_2', 'parity_3', 'parity_4plus'].forEach((key, k) => (v[key] = parity[k] / parityN));
  v.parity_mean = parity.reduce((a, c, k) => a + c * k, 0) / parityN;
  for (const [edu, [n, sum, zero]] of kidsByEdu) {
    v[`kids_${edu}`] = sum / n;
    v[`childless_${edu}`] = zero / n;
  }
  for (const [key, [n, nm]] of nmByEdu) v[key === 'all' ? 'nonmarital' : `nonmarital_${key}`] = nm / n;
  v.nonmaritalCohabiting = nmTotal ? nmCohab / nmTotal : NaN;
  v.mpf_mothers = mothers ? mpfMothers / mothers : NaN;
  v.mpf_mothers2plus = mothers2 ? mpf2 / mothers2 : NaN;
  return { values: v, world, focal };
}

export function worldLoss(values: Record<string, number>, targets: readonly WorldTarget[]): number {
  let total = 0;
  for (const t of targets) {
    const x = values[t.key];
    if (!Number.isFinite(x)) {
      total += 100;
      continue;
    }
    total += ((x - t.target) / t.tolerance) ** 2;
  }
  return total;
}
