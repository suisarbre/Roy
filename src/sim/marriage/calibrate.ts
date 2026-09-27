import { writeFileSync } from 'node:fs';
import { CALIBRATED_CAREER_PARAMS } from '../career/calibratedParams';
import { OCCUPATION_TARGET_GROUPS } from '../career/moments';
import type { WomenLaborParams } from '../career/types';
import { WOMEN_WORK_MOMENTS } from '../data';
import { createRng } from '../rng';
import { gaussian } from '../stats';
import { CALIBRATED_PARAMS, CALIBRATED_WOMEN_PARAMS } from './calibratedParams';
import { buildTargets, loss, measure } from './moments';
import { FREE_PARAMS, INITIAL_PARAMS, INITIAL_WOMEN_PARAMS, WOMEN_FREE_PARAMS, type MarriageParams } from './params';

/**
 * `npm run sim:marriage:calibrate` — 시뮬레이션 적률법으로 FREE_PARAMS를 맞춘다.
 *
 * - 목적 함수: moments.ts의 loss(17개 적률의 표준화 제곱 오차 합).
 * - 공통 난수: 모든 후보가 같은 부부 집합(seed 고정)을 쓴다 — 후보 간 차이가 운이 아니라
 *   파라미터에서만 나오게.
 * - 최적화 1단계(전역): 대각 공분산 진화 전략(λ개 후보 → 상위 μ개 가중 평균으로 이동, 축별 탐색
 *   폭은 엘리트의 퍼짐으로 적응). 정규화된 [0,1] 공간에서 탐색하고 경계는 자른다.
 * - 최적화 2단계(국소): 좌표별 패턴 탐색(Hooke–Jeeves식) — 각 축을 ±step 움직여 보고 나아지면
 *   채택, 한 바퀴 동안 개선이 없으면 step을 절반으로.
 * - 최적화 3단계(결합 이동): 넬더–미드 심플렉스 — 투자·신혼 효과를 올리면서 떠남 절편도 같이
 *   올려야 하는 것처럼 여러 축을 동시에 움직여야 나아지는 방향을 좌표별 탐색은 못 찾는다.
 * - 4단계(드문 사건 정밀 조정): 장애처럼 드문 사건에 묶인 파라미터는 보정 표본(1만 쌍)에서 우연에
 *   맞춰진다(실제로 supportSympathy가 2.46까지 가서 대규모 표본에선 장애 위험비 0.67). 보정·검증과
 *   다른 시드(5, 7)의 3만 쌍 × 2로 해당 적률만 이분법으로 다시 맞춘다. --refine-only면 이 단계만.
 * - 시작점: 기존 calibratedParams.ts가 있으면 거기서 이어서(웜 스타트), --fresh면 INITIAL_PARAMS.
 * - 결과는 calibratedParams.ts로 저장된다(커밋되는 산출물).
 *
 * 인자: --n=10000(부부 수) --gens=20 --sweeps=12 --nm=300 --seed=1 --fresh
 */

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
}

/**
 * 통합 보정: 결혼·출산 파라미터(FREE_PARAMS)와 여성 노동 공급 파라미터(WOMEN_FREE_PARAMS)를 한 벡터로.
 * 남성 경력 파라미터는 src/sim/career에서 이미 보정돼 고정이다. 여성 직업 분포는 적률법 차원에 넣지 않고
 * 단계 사이마다 비례 조정(raking)한다(경력 보정과 같은 방식).
 */
interface Joint {
  marriage: MarriageParams;
  women: WomenLaborParams;
}

let womenOccupationWeights: Record<string, number> = {
  ...((CALIBRATED_WOMEN_PARAMS.occupationWeights as Record<string, number> | undefined) ?? (CALIBRATED_CAREER_PARAMS.occupationWeights as Record<string, number>)),
};

function toVector(j: Joint): number[] {
  return [
    ...FREE_PARAMS.map((spec) => (j.marriage[spec.name] - spec.min) / (spec.max - spec.min)),
    ...WOMEN_FREE_PARAMS.map((spec) => (j.women[spec.name] - spec.min) / (spec.max - spec.min)),
  ];
}

function fromVector(v: readonly number[]): Joint {
  const marriage = { ...INITIAL_PARAMS };
  FREE_PARAMS.forEach((spec, i) => {
    marriage[spec.name] = spec.min + Math.max(0, Math.min(1, v[i])) * (spec.max - spec.min);
  });
  const women: WomenLaborParams = { ...INITIAL_WOMEN_PARAMS, occupationWeights: womenOccupationWeights };
  WOMEN_FREE_PARAMS.forEach((spec, k) => {
    women[spec.name] = spec.min + Math.max(0, Math.min(1, v[FREE_PARAMS.length + k])) * (spec.max - spec.min);
  });
  return { marriage, women };
}

function rakeWomen(j: Joint, n: number, seed: number, iterations: number): void {
  const targets = WOMEN_WORK_MOMENTS.find((m) => m.id === 'women.occupation.distributionFullTime.1999')!.values;
  for (let it = 0; it < iterations; it++) {
    const shares = measure(j.marriage, { ...j.women, occupationWeights: womenOccupationWeights }, { n, seed }).womenOccupationShares;
    let worst = 0;
    let worstGroup = '';
    const next = { ...womenOccupationWeights };
    for (const [group, occs] of Object.entries(OCCUPATION_TARGET_GROUPS)) {
      const ratio = targets[group] / Math.max(1e-4, shares[group]);
      if (Math.abs(Math.log(ratio)) > worst) {
        worst = Math.abs(Math.log(ratio));
        worstGroup = group;
      }
      for (const occ of occs) next[occ] = Math.min(500, Math.max(0.002, (next[occ] ?? 1) * Math.pow(ratio, 0.5)));
    }
    womenOccupationWeights = next;
    console.log(`여성 직업 rake ${it + 1}: 최대 |log(목표/모델)| = ${worst.toFixed(3)} (${worstGroup})`);
  }
}

function main(): void {
  const n = arg('n', 5000);
  const generations = arg('gens', 0);
  const sweeps = arg('sweeps', 8);
  const nmEvals = arg('nm', 300);
  const fresh = process.argv.includes('--fresh');
  const seed = arg('seed', 1);
  const lambda = 16;
  const mu = 5;
  const weights = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const start: Joint = fresh
    ? { marriage: { ...INITIAL_PARAMS }, women: { ...INITIAL_WOMEN_PARAMS } }
    : { marriage: { ...INITIAL_PARAMS, ...CALIBRATED_PARAMS }, women: { ...INITIAL_WOMEN_PARAMS, ...CALIBRATED_WOMEN_PARAMS } };

  if (process.argv.includes('--refine-only')) {
    const refined = refineRareEventParams({ ...start, women: { ...start.women, occupationWeights: womenOccupationWeights } });
    writeParams(refined, NaN, '--refine-only');
    return;
  }

  const targets = buildTargets();
  const evaluate = (v: readonly number[]) => {
    const j = fromVector(v);
    return loss(measure(j.marriage, j.women, { n, seed }), targets);
  };
  const started = Date.now();
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;

  rakeWomen(start, n, seed, 6);
  const rng = createRng(seed + 7);
  const dim = FREE_PARAMS.length + WOMEN_FREE_PARAMS.length;
  let mean = toVector(start);
  let sigma = new Array<number>(dim).fill(0.15);
  let best = { v: mean, loss: evaluate(mean) };
  console.log(`초기 loss=${best.loss.toFixed(2)} (n=${n}, dim=${dim}, λ=${lambda}) ${elapsed()}`);
  const reRake = (label: string) => {
    rakeWomen(fromVector(best.v), n, seed, 2);
    best = { v: best.v, loss: evaluate(best.v) };
    console.log(`${label} 뒤 재조정 loss=${best.loss.toFixed(2)}`);
    writeParams(fromVector(best.v), best.loss, `${label} 체크포인트 --n=${n} --seed=${seed}`);
  };

  // ---- 1단계: 대각 진화 전략 ----
  for (let gen = 0; gen < generations; gen++) {
    const candidates = Array.from({ length: lambda }, () => {
      const v = mean.map((m, i) => Math.max(0, Math.min(1, m + sigma[i] * gaussian(rng))));
      return { v, loss: evaluate(v) };
    });
    candidates.sort((a, b) => a.loss - b.loss);
    if (candidates[0].loss < best.loss) best = candidates[0];
    const elites = candidates.slice(0, mu);
    const nextMean = new Array<number>(dim).fill(0);
    elites.forEach((e, k) => e.v.forEach((x, i) => (nextMean[i] += (weights[k] / weightSum) * x)));
    sigma = sigma.map((sg, i) => {
      const spread = Math.sqrt(elites.reduce((acc, e) => acc + (e.v[i] - nextMean[i]) ** 2, 0) / mu);
      return Math.max(0.01, Math.min(0.3, 0.6 * sg + 0.6 * spread));
    });
    mean = nextMean;
    console.log(`gen ${String(gen + 1).padStart(2)} best=${best.loss.toFixed(2)} genBest=${candidates[0].loss.toFixed(2)} ${elapsed()}`);
  }
  if (generations > 0) reRake('1단계');

  // ---- 2단계: 좌표별 패턴 탐색 ----
  let step = 0.04;
  for (let sweep = 0; sweep < sweeps && step >= 0.0025; sweep++) {
    let improved = false;
    for (let i = 0; i < dim; i++) {
      for (const direction of [1, -1]) {
        const v = [...best.v];
        v[i] = Math.max(0, Math.min(1, v[i] + direction * step));
        if (v[i] === best.v[i]) continue;
        const l = evaluate(v);
        if (l < best.loss) {
          best = { v, loss: l };
          improved = true;
          break;
        }
      }
    }
    console.log(`sweep ${sweep + 1} step=${step.toFixed(4)} best=${best.loss.toFixed(2)} ${elapsed()}`);
    if (!improved) step /= 2;
    if (sweep % 3 === 2) reRake(`sweep ${sweep + 1}`);
  }
  reRake('2단계');

  // ---- 3단계: 넬더–미드 ----
  const clampV = (v: number[]) => v.map((x) => Math.max(0, Math.min(1, x)));
  let simplex = [
    best,
    ...Array.from({ length: dim }, (_, i) => {
      const v = [...best.v];
      v[i] += v[i] > 0.5 ? -0.04 : 0.04;
      return { v, loss: evaluate(v) };
    }),
  ];
  let evals = dim;
  while (evals < nmEvals) {
    simplex.sort((a, b) => a.loss - b.loss);
    const worst = simplex[dim];
    const centroid = new Array<number>(dim).fill(0);
    for (let k = 0; k < dim; k++) simplex[k].v.forEach((x, i) => (centroid[i] += x / dim));
    const at = (t: number) => clampV(centroid.map((c, i) => c + t * (worst.v[i] - c)));
    const reflected = { v: at(-1), loss: 0 };
    reflected.loss = evaluate(reflected.v);
    evals += 1;
    if (reflected.loss < simplex[0].loss) {
      const expanded = { v: at(-2), loss: 0 };
      expanded.loss = evaluate(expanded.v);
      evals += 1;
      simplex[dim] = expanded.loss < reflected.loss ? expanded : reflected;
    } else if (reflected.loss < simplex[dim - 1].loss) {
      simplex[dim] = reflected;
    } else {
      const contracted = { v: at(0.5), loss: 0 };
      contracted.loss = evaluate(contracted.v);
      evals += 1;
      if (contracted.loss < worst.loss) simplex[dim] = contracted;
      else {
        const b = simplex[0];
        simplex = simplex.map((sv, k) => (k === 0 ? sv : { v: clampV(b.v.map((x, i) => x + 0.5 * (sv.v[i] - x))), loss: 0 }));
        for (let k = 1; k <= dim; k++) simplex[k].loss = evaluate(simplex[k].v);
        evals += dim;
      }
    }
    simplex.sort((a, b) => a.loss - b.loss);
    if (simplex[0].loss < best.loss) best = simplex[0];
    if (evals % 50 < 2) console.log(`nelder-mead evals=${evals} best=${best.loss.toFixed(2)} ${elapsed()}`);
  }
  reRake('3단계');

  // ---- 4단계: 드문 사건 정밀 조정 ----
  const refined = refineRareEventParams(fromVector(best.v));
  writeParams(refined, best.loss, `--n=${n} --gens=${generations} --sweeps=${sweeps} --nm=${nmEvals} --seed=${seed}`);
}

/** 드문 사건 적률 ↔ 그 적률을 주로 움직이는 파라미터(단조 관계). */
const RARE_EVENT_REFINEMENTS: { param: keyof MarriageParams; momentKey: string; target: number; increasingEffect: boolean }[] = [
  // 연민이 클수록 장애 후 이혼 위험비는 내려간다.
  { param: 'supportSympathy', momentKey: 'rr_disability', target: 1, increasingEffect: false },
];

function refineRareEventParams(start: Joint): Joint {
  const marriage = { ...start.marriage };
  const big = (p: MarriageParams, key: string) =>
    [5, 7].map((sd) => measure(p, start.women, { n: 20000, seed: sd }).values[key]).reduce((a, b) => a + b, 0) / 2;
  for (const r of RARE_EVENT_REFINEMENTS) {
    const spec = FREE_PARAMS.find((sp) => sp.name === r.param)!;
    let lo = spec.min;
    let hi = spec.max;
    for (let k = 0; k < 7; k++) {
      const mid = (lo + hi) / 2;
      const v = big({ ...marriage, [r.param]: mid }, r.momentKey);
      const tooHigh = v > r.target;
      if (tooHigh !== r.increasingEffect) lo = mid;
      else hi = mid;
      console.log(`refine ${r.param}=${mid.toFixed(3)} → ${r.momentKey}=${v.toFixed(3)}`);
    }
    marriage[r.param] = (lo + hi) / 2;
  }
  return { marriage, women: start.women };
}

function writeParams(j: Joint, lossValue: number, argsLabel: string): void {
  // 자유 파라미터만이 아니라 전체를 쓴다 — 고정값(INITIAL_PARAMS)이 빠지면 undefined → NaN이 되어
  // 모든 행동이 조용히 '중립'으로 떨어진다(실제로 겪은 버그).
  const freeNames = new Set(FREE_PARAMS.map((spec) => spec.name));
  const refined = new Set(RARE_EVENT_REFINEMENTS.map((r) => r.param));
  const body = (Object.keys(j.marriage) as (keyof MarriageParams)[])
    .map((name) => {
      const spec = FREE_PARAMS.find((sp) => sp.name === name);
      const note = refined.has(name) ? `${spec!.drives} (4단계 대규모 표본 정밀 조정)` : freeNames.has(name) ? spec!.drives : '고정(보정 대상 아님)';
      return `  ${name}: ${Number(j.marriage[name].toFixed(4))}, // ${note}`;
    })
    .join('\n');
  const womenBody = WOMEN_FREE_PARAMS.map((spec) => `  ${spec.name}: ${Number(j.women[spec.name].toFixed(4))}, // ${spec.drives}`).join('\n');
  const weights = Object.entries(womenOccupationWeights)
    .map(([occ, w]) => `    ${occ}: ${Number(w.toPrecision(4))},`)
    .join('\n');
  const lossNote = Number.isFinite(lossValue) ? `보정 loss(표준화 제곱 오차 합) = ${lossValue.toFixed(2)}.` : '드문 사건 정밀 조정만 다시 실행.';
  const file = `import type { WomenLaborParams } from '../career/types';
import type { MarriageParams } from './params';

/**
 * \`npm run sim:marriage:calibrate -- ${argsLabel}\`가 생성한 파일 — 손으로 고치지 말 것.
 * ${lossNote} 표본 외 검증은 \`npm run sim:marriage\`.
 * 결혼·출산과 여성 노동 공급을 한 번에 보정했다(남성 경력은 src/sim/career에서 고정).
 */
export const CALIBRATED_PARAMS: MarriageParams = {
${body}
};

export const CALIBRATED_WOMEN_PARAMS: WomenLaborParams = {
${womenBody}
  // 여성 직업별 제안 가중치 배수(CPS 1999 여성 직업 분포에 비례 조정).
  occupationWeights: {
${weights}
  },
};
`;
  writeFileSync(new URL('./calibratedParams.ts', import.meta.url), file);
  console.log(`→ src/sim/marriage/calibratedParams.ts 저장`);
}

main();
