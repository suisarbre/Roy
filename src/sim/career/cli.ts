import { averageAnnualWageAt } from '../data';
import { createRng } from '../rng';
import { CALIBRATED_CAREER_PARAMS } from './calibratedParams';
import { simulateCareer } from './model';
import { buildCareerTargets, careerLoss, measureCareer, measureOccupationShares, occupationTargets } from './moments';
import { OCCUPATION_BY_ID, OCCUPATIONS, type OccupationId } from './occupations';
import { INITIAL_CAREER_PARAMS, type CareerParams } from './params';
import { buildWorker, drawWorker } from './population';
import type { CareerOutcome, Worker } from './types';

/**
 * `npm run sim:career` — 보정에 쓰지 않은 시드(2)로 표본 외 검증 + 보정에 쓰지 않은 사실(LA 항공우주
 * 노동자의 행로, RAND)로 외부 검증 + 운과 기질의 몫 + Roy 시나리오.
 */

const params: CareerParams = { ...INITIAL_CAREER_PARAMS, ...CALIBRATED_CAREER_PARAMS };
const n = Number(process.argv.find((a) => a.startsWith('--n='))?.split('=')[1] ?? 40000);

function fmt(x: number, digits = 3): string {
  return Number.isFinite(x) ? x.toFixed(digits) : 'NaN';
}

function validation(): CareerOutcome[] {
  console.log(`\n=== 표본 외 검증 (seed 2, ${n}명; 보정은 seed 1) ===`);
  const result = measureCareer(params, { n, seed: 2, keepOutcomes: true });
  const targets = buildCareerTargets();
  const tally = { PASS: 0, WARN: 0, FAIL: 0, KNOWN: 0 };
  for (const t of targets) {
    const x = result.values[t.key];
    const z = Math.abs((x - t.target) / t.tolerance);
    const ok = t.oneSided === 'min' ? x >= t.target || z <= 1 : z <= 1;
    let verdict: keyof typeof tally = ok ? 'PASS' : z <= 2 ? 'WARN' : 'FAIL';
    if (verdict !== 'PASS' && t.knownGap) verdict = 'KNOWN';
    tally[verdict] += 1;
    console.log(`${verdict.padEnd(5)} ${t.label.padEnd(38)} 목표 ${fmt(t.target).padStart(8)}  모델 ${fmt(x).padStart(8)}  (±${fmt(t.tolerance)})`);
  }
  console.log(`\nloss=${careerLoss(result, targets).toFixed(2)}  PASS ${tally.PASS} / WARN ${tally.WARN} / KNOWN ${tally.KNOWN} / FAIL ${tally.FAIL}  (JLS 사건 ${result.values.jlsEvents}건)`);
  const known = targets.filter((t) => t.knownGap);
  if (known.length) console.log(`KNOWN 이유: ${known[0].knownGap}`);
  return result.outcomes!;
}

function occupationShares(outcomes: CareerOutcome[]): void {
  console.log('\n=== 직업 분포: 남성 풀타임 임금근로자 1999(CPS) 대 모델 18–64세 (%, 제안 가중치 비례 조정의 결과) ===');
  const targets = occupationTargets();
  const shares = measureOccupationShares(outcomes);
  const cells = Object.keys(targets).map((k) => `${k} ${(100 * targets[k]).toFixed(1)}/${(100 * shares[k]).toFixed(1)}`);
  for (let i = 0; i < cells.length; i += 4) console.log('  ' + cells.slice(i, i + 4).join(' · '));
}

function occupationTable(outcomes: CareerOutcome[]): void {
  console.log('\n=== 40세 직업 분포(학력별, %) — 가정한 입직 가중치 + 이동의 결과 ===');
  const groups: Record<string, Record<string, number>> = {};
  for (const o of outcomes) {
    const r = o.years[40];
    if (!r) continue;
    const key = o.worker.schooling;
    const occ = r.selfEmployedMonths > 6 ? 'selfEmployed' : r.occupationAtBirthday ?? (r.employedMonths > 0 ? 'other' : 'notWorking');
    groups[key] ??= {};
    groups[key][occ] = (groups[key][occ] ?? 0) + 1;
  }
  for (const [schooling, counts] of Object.entries(groups)) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([occ, c]) => `${OCCUPATION_BY_ID[occ as OccupationId]?.label ?? (occ === 'selfEmployed' ? '자영업' : occ === 'notWorking' ? '무직' : occ)} ${((100 * c) / total).toFixed(0)}`)
      .join(', ');
    console.log(`${schooling.padEnd(18)} (${total}명) ${top}`);
  }
}

/** 운 대 기질: 평생 소득(22–61세 합)의 로그를 관측 가능한 개인 특성에 회귀한 R². 나머지는 운. */
function luckVersusTraits(outcomes: CareerOutcome[]): void {
  const rows: number[][] = [];
  const ys: number[] = [];
  for (const o of outcomes) {
    let s = 0;
    for (let a = 22; a <= 61; a++) s += o.years[a]?.earnings ?? 0;
    if (s <= 0) continue;
    const w = o.worker;
    const t = w.traits;
    rows.push([
      1,
      t.ability,
      t.conscientiousness,
      t.neuroticism,
      t.agreeableness,
      t.openness,
      t.extraversion,
      t.riskTolerance,
      w.parentRank,
      w.education === 'highSchool' ? 1 : 0,
      w.education === 'someCollege' ? 1 : 0,
      w.schooling === 'bachelorsOrMore' ? 1 : 0,
      w.schooling === 'masters' || w.schooling === 'doctorate' ? 1 : 0,
      w.schooling === 'professional' ? 1 : 0,
    ]);
    ys.push(Math.log(s));
  }
  const k = rows[0].length;
  const xtx = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  const xty = new Array<number>(k).fill(0);
  rows.forEach((r, i) => {
    for (let a = 0; a < k; a++) {
      xty[a] += r[a] * ys[i];
      for (let b = 0; b < k; b++) xtx[a][b] += r[a] * r[b];
    }
  });
  // 가우스 소거.
  const m = xtx.map((row, i) => [...row, xty[i]]);
  for (let c = 0; c < k; c++) {
    let pivot = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let cc = c; cc <= k; cc++) m[r][cc] -= f * m[c][cc];
    }
  }
  const beta = m.map((row, i) => row[k] / row[i]);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssTot = 0;
  let ssRes = 0;
  rows.forEach((r, i) => {
    const fit = r.reduce((acc, x, j) => acc + x * beta[j], 0);
    ssTot += (ys[i] - mean) ** 2;
    ssRes += (ys[i] - fit) ** 2;
  });
  const names = ['절편', '능력', '성실성', '신경성', '친화성', '개방성', '외향성', '위험감수', '부모순위', '고졸', '대학중퇴', '학사', '석박사', '전문직'];
  console.log('\n=== 운 대 기질: 평생 소득(22–61세) 로그의 분산 분해 ===');
  console.log(`학력·성격·능력·집안으로 설명되는 몫 R² = ${(1 - ssRes / ssTot).toFixed(2)} — 나머지 ${(ssRes / ssTot).toFixed(2)}는 운(입사 시점의 경기, 짝, 해고, 공장 폐쇄, 장애, 사업 성패, 승진 운)`);
  console.log(beta.map((b, i) => `${names[i]} ${b >= 0 ? '+' : ''}${b.toFixed(2)}`).slice(1).join(' · '));
}

/** RAND RB7510: 1989년 항공우주 노동자 중 1994년 취업자의 2/3가 항공우주에 남았고, 서비스업으로 간 사람은
 *  임금이 17% 떨어졌다. 모델은 이 숫자로 보정하지 않았다(외부 검증). LA 거주 남성만. */
function aerospaceCheck(): void {
  console.log('\n=== 외부 검증: LA 항공우주 노동자, 1989 → 1994 (RAND RB7510) ===');
  // 모델엔 산업이 없어 서비스업을 직업으로 근사: 판매·사무·음식·경비·영업·경영 전문직·관리자(항공우주 밖으로 옮긴 경우).
  const services = new Set<string>(['foodService', 'retailSales', 'clerical', 'salesRep', 'protectiveService', 'businessProfessional', 'manager']);
  let inAero = 0;
  let employed94 = 0;
  let stillAero = 0;
  let toServices = 0;
  let serviceChange = 0;
  let stayerChange = 0;
  let stayers = 0;
  const years: Record<number, number> = {};
  for (let i = 0; i < n; i++) {
    const worker = buildWorker(drawWorker(createRng(9_000_000 + i * 2), [1940, 1966], true), params);
    const o = simulateCareer(worker, params, createRng(9_000_000 + i * 2 + 1), { untilAge: 60 });
    for (const r of o.years) if (r?.aerospaceIndustryAtBirthday) years[r.year] = (years[r.year] ?? 0) + 1;
    const r89 = o.years.find((r) => r?.year === 1989);
    const r94 = o.years.find((r) => r?.year === 1994);
    if (!r89 || !r94 || !r89.aerospaceIndustryAtBirthday || r94.age > 58) continue;
    inAero += 1;
    const occ94 = r94.occupationAtBirthday;
    if (!occ94 && r94.selfEmployedMonths === 0) continue;
    employed94 += 1;
    if (r94.aerospaceIndustryAtBirthday) {
      stillAero += 1;
      stayers += 1;
      stayerChange += r94.logWageAtBirthday - r89.logWageAtBirthday;
    } else if (occ94 && services.has(occ94)) {
      toServices += 1;
      serviceChange += r94.logWageAtBirthday - r89.logWageAtBirthday;
    }
  }
  console.log(`1989 항공우주 ${inAero}명 → 1994 취업 ${employed94}명 중 항공우주 잔류 ${fmt(stillAero / employed94, 2)} (RAND 0.67), 서비스 이동 ${fmt(toServices / employed94, 2)} (RAND 0.14)`);
  console.log(`서비스 이동자 임금 변화(잔류자 대비) ${fmt(Math.exp(serviceChange / toServices - stayerChange / stayers) - 1, 2)} (RAND −0.17)`);
  const idx = (y: number) => (years[y] ?? 0) / (years[1987] ?? 1);
  console.log(`LA 표본의 항공우주 고용 지수(1987=1): 1990 ${fmt(idx(1990), 2)}, 1995 ${fmt(idx(1995), 2)} — RAND: LA 카운티 50% 수준(코호트 노화도 섞임)`);
}

function describe(o: CareerOutcome): string {
  const w = o.worker;
  const peak = Math.max(...o.years.filter(Boolean).map((r) => r.earnings));
  const r50 = o.years[50];
  const job40 = o.years[40]?.occupationAtBirthday;
  const shocks = o.jobs.filter((j) => j.endReason === 'layoff' || j.endReason === 'plantClosing').length;
  const biz = o.businesses.length;
  return `${w.schooling.padEnd(18)} 40세 ${job40 ? OCCUPATION_BY_ID[job40].label : o.years[40]?.selfEmployedMonths ? '자영업' : '무직'} · 고용주 ${o.jobs.filter((j) => !j.student).length}곳 · 실직 ${shocks}번 · 창업 ${biz}번 · 최고 연소득 $${Math.round((peak * averageAnnualWageAt(1995)) / 1000)}k(1995 달러) · 50세 순자산 $${Math.round(((r50?.netWorth ?? 0) * averageAnnualWageAt(1995)) / 1000)}k`;
}

/** Roy: 1962년 잉글우드생. 같은 기질로 운만 바꿔 여러 번, 그리고 기질을 바꿔서. */
function roy(): void {
  console.log('\n=== Roy (1962년생, 잉글우드) — 같은 사람, 다른 운 ===');
  const base = drawWorker(createRng(1962), [1962, 1962], true);
  base.parentRank = 0.35;
  base.traits = { conscientiousness: 0.3, neuroticism: 0.4, agreeableness: 0.5, openness: -0.2, extraversion: 0.2, riskTolerance: 0.3 };
  base.abilityNoise = 0.1;
  base.educationNoise = -0.3;
  const worker: Worker = buildWorker(base, params);
  console.log(`학력 ${worker.schooling}, 능력 z=${worker.traits.ability.toFixed(2)}`);
  for (let s = 0; s < 6; s++) console.log(`  운 #${s + 1}: ${describe(simulateCareer(worker, params, createRng(500 + s)))}`);

  console.log('\n--- 같은 운(시드 500), 첫 직장만 강제 ---');
  for (const occ of ['aerospaceAssembler', 'truckDriver', 'constructionTrades', 'clerical'] as OccupationId[]) {
    console.log(`  ${OCCUPATION_BY_ID[occ].label.padEnd(16)} ${describe(simulateCareer(worker, params, createRng(500), { forcedFirstOccupation: occ }))}`);
  }

  console.log('\n--- 한 인생의 사건 기록(시드 500, 첫 직장 항공우주, 18–45세) ---');
  const traced = simulateCareer(worker, params, createRng(500), { keepMonths: true, forcedFirstOccupation: 'aerospaceAssembler' });
  for (const m of traced.months!) {
    if (!m.event || m.ageMonths < 18 * 12 || m.ageMonths > 45 * 12) continue;
    const wage = m.logWage !== undefined ? ` 연봉 $${Math.round((Math.exp(m.logWage) * averageAnnualWageAt(m.year)) / 1000)}k` : '';
    console.log(`  ${m.year}.${String(m.month + 1).padStart(2, '0')} (${Math.floor(m.ageMonths / 12)}세) ${m.event}${wage}`);
  }
}

const outcomes = validation();
occupationShares(outcomes);
occupationTable(outcomes);
luckVersusTraits(outcomes);
aerospaceCheck();
roy();
void OCCUPATIONS;
