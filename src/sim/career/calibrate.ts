import { writeFileSync } from 'node:fs';
import { gaussian } from '../marriage/population';
import { createRng } from '../rng';
import { CALIBRATED_CAREER_PARAMS } from './calibratedParams';
import { buildCareerTargets, careerLoss, measureCareer, measureOccupationShares, OCCUPATION_TARGET_GROUPS, occupationTargets, simulatePopulation } from './moments';
import type { OccupationId } from './occupations';
import { CAREER_FREE_PARAMS, INITIAL_CAREER_PARAMS, type CareerParams, type CareerScalarParams } from './params';

/**
 * `npm run sim:career:calibrate` — 결혼 모델과 같은 시뮬레이션 적률법(src/sim/marriage/calibrate.ts):
 * 공통 난수(고정 시드의 같은 사람들) 위에서
 *   1단계 대각 진화 전략(전역) → 2단계 좌표별 패턴 탐색 → 3단계 넬더–미드(결합 이동).
 * 시작점은 기존 calibratedCareerParams(웜 스타트), --fresh면 INITIAL_CAREER_PARAMS.
 *
 * 직업 분포(CPS 1999, 21개 묶음)는 적률법 차원에 넣지 않고 단계 사이마다 비례 조정(raking)한다:
 * 직업별 제안 가중치 m ← m × (목표 비율 / 모델 비율)^0.8. 가중치는 이직·승진과 얽혀 있어 한 번에 맞지
 * 않으므로 반복하고, 다른 파라미터가 움직일 때마다 다시 맞춘다. --rake-only면 이것만.
 *
 * 인자: --n=5000 --gens=25 --sweeps=8 --nm=400 --seed=1 --fresh
 */

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
}

function toVector(p: CareerParams): number[] {
  return CAREER_FREE_PARAMS.map((spec) => (p[spec.name] - spec.min) / (spec.max - spec.min));
}

let occupationWeights: Partial<Record<OccupationId, number>> = { ...(CALIBRATED_CAREER_PARAMS.occupationWeights ?? {}) };

function fromVector(v: readonly number[]): CareerParams {
  const p: CareerParams = { ...INITIAL_CAREER_PARAMS, occupationWeights };
  CAREER_FREE_PARAMS.forEach((spec, i) => {
    p[spec.name] = spec.min + Math.max(0, Math.min(1, v[i])) * (spec.max - spec.min);
  });
  return p;
}

function rake(params: CareerParams, n: number, seed: number, iterations: number): void {
  const targets = occupationTargets();
  for (let it = 0; it < iterations; it++) {
    const shares = measureOccupationShares(simulatePopulation({ ...params, occupationWeights }, n, seed));
    let worst = 0;
    let worstGroup = '';
    const next = { ...occupationWeights };
    for (const [group, occs] of Object.entries(OCCUPATION_TARGET_GROUPS)) {
      const ratio = targets[group] / Math.max(1e-4, shares[group]);
      if (Math.abs(Math.log(ratio)) > worst) {
        worst = Math.abs(Math.log(ratio));
        worstGroup = group;
      }
      for (const occ of occs) next[occ] = Math.min(500, Math.max(0.002, (next[occ] ?? 1) * Math.pow(ratio, 0.5)));
    }
    occupationWeights = next;
    console.log(`rake ${it + 1}: 최대 |log(목표/모델)| = ${worst.toFixed(3)} (${worstGroup})`);
  }
}

interface Point {
  v: number[];
  loss: number;
}

function main(): void {
  const n = arg('n', 5000);
  const generations = arg('gens', 25);
  const sweeps = arg('sweeps', 8);
  const nmEvals = arg('nm', 400);
  const seed = arg('seed', 1);
  const fresh = process.argv.includes('--fresh');
  const lambda = 16;
  const mu = 5;
  const weights = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const targets = buildCareerTargets();
  const startParams = fresh ? INITIAL_CAREER_PARAMS : { ...INITIAL_CAREER_PARAMS, ...CALIBRATED_CAREER_PARAMS };
  if (fresh) occupationWeights = {};
  rake(startParams, n, seed, 10);
  if (process.argv.includes('--rake-only')) {
    writeParams({ ...startParams, occupationWeights }, NaN, '--rake-only');
    return;
  }
  const evaluate = (v: readonly number[]) => careerLoss(measureCareer(fromVector(v), { n, seed }), targets);
  const dim = CAREER_FREE_PARAMS.length;
  const started = Date.now();
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;

  let mean = toVector(startParams);
  let best: Point = { v: mean, loss: evaluate(mean) };
  const reRake = (label: string) => {
    rake(fromVector(best.v), n, seed, 2);
    best = { v: best.v, loss: evaluate(best.v) };
    console.log(`${label} 뒤 재조정 loss=${best.loss.toFixed(2)}`);
  };
  console.log(`초기 loss=${best.loss.toFixed(2)} (n=${n}, dim=${dim})`);
  const checkpoint = (label: string) => writeParams(fromVector(best.v), best.loss, `${label} --n=${n} --seed=${seed}`);

  // ---- 1단계: 대각 진화 전략 ----
  const rng = createRng(seed + 7);
  let sigma = new Array<number>(dim).fill(0.15);
  for (let gen = 0; gen < generations; gen++) {
    const candidates: Point[] = Array.from({ length: lambda }, () => {
      const v = mean.map((m, i) => Math.max(0, Math.min(1, m + sigma[i] * gaussian(rng))));
      return { v, loss: evaluate(v) };
    });
    candidates.sort((a, b) => a.loss - b.loss);
    if (candidates[0].loss < best.loss) best = candidates[0];
    const elites = candidates.slice(0, mu);
    const next = new Array<number>(dim).fill(0);
    elites.forEach((e, k) => e.v.forEach((x, i) => (next[i] += (weights[k] / weightSum) * x)));
    sigma = sigma.map((s, i) => {
      const spread = Math.sqrt(elites.reduce((acc, e) => acc + (e.v[i] - next[i]) ** 2, 0) / mu);
      return Math.max(0.01, Math.min(0.3, 0.6 * s + 0.6 * spread));
    });
    mean = next;
    console.log(`gen ${String(gen + 1).padStart(2)} best=${best.loss.toFixed(2)} genBest=${candidates[0].loss.toFixed(2)} ${elapsed()}`);
  }
  const meanLoss = evaluate(mean);
  if (meanLoss < best.loss) best = { v: mean, loss: meanLoss };
  reRake('1단계');
  checkpoint('stage1');

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
  checkpoint('stage2');

  // ---- 3단계: 넬더–미드 ----
  const clampV = (v: number[]) => v.map((x) => Math.max(0, Math.min(1, x)));
  let simplex: Point[] = [
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
    const at = (s: number) => clampV(centroid.map((c, i) => c + s * (worst.v[i] - c)));
    const reflected: Point = { v: at(-1), loss: 0 };
    reflected.loss = evaluate(reflected.v);
    evals += 1;
    if (reflected.loss < simplex[0].loss) {
      const expanded: Point = { v: at(-2), loss: 0 };
      expanded.loss = evaluate(expanded.v);
      evals += 1;
      simplex[dim] = expanded.loss < reflected.loss ? expanded : reflected;
    } else if (reflected.loss < simplex[dim - 1].loss) {
      simplex[dim] = reflected;
    } else {
      const contracted: Point = { v: at(0.5), loss: 0 };
      contracted.loss = evaluate(contracted.v);
      evals += 1;
      if (contracted.loss < worst.loss) simplex[dim] = contracted;
      else {
        const b = simplex[0];
        simplex = simplex.map((s, k) => {
          if (k === 0) return s;
          const v = clampV(b.v.map((x, i) => x + 0.5 * (s.v[i] - x)));
          return { v, loss: evaluate(v) };
        });
        evals += dim;
      }
    }
    simplex.sort((a, b) => a.loss - b.loss);
    if (simplex[0].loss < best.loss) best = simplex[0];
    if (evals % 50 < 2) console.log(`nelder-mead evals=${evals} best=${best.loss.toFixed(2)} ${elapsed()}`);
  }
  reRake('3단계');
  checkpoint(`--gens=${generations} --sweeps=${sweeps} --nm=${nmEvals}`);
}

function writeParams(params: CareerParams, lossValue: number, argsLabel: string): void {
  const scalars = (Object.keys(params) as (keyof CareerParams)[]).filter((k): k is keyof CareerScalarParams => k !== 'occupationWeights');
  const body = scalars
    .map((name) => {
      const spec = CAREER_FREE_PARAMS.find((s) => s.name === name);
      return `  ${name}: ${Number(params[name].toPrecision(4))}, // ${spec ? spec.drives : '고정'}`;
    })
    .join('\n');
  const weights = Object.entries(params.occupationWeights ?? {})
    .map(([occ, w]) => `    ${occ}: ${Number((w as number).toPrecision(4))},`)
    .join('\n');
  const file = `import type { CareerParams } from './params';

/**
 * \`npm run sim:career:calibrate -- ${argsLabel}\`가 생성한 파일 — 손으로 고치지 말 것.
 * 보정 loss(표준화 제곱 오차 합) = ${lossValue.toFixed(2)}. 표본 외 검증은 \`npm run sim:career\`.
 */
export const CALIBRATED_CAREER_PARAMS: CareerParams = {
${body}
  // 직업별 제안 가중치 배수(CPS 1999 직업 분포에 비례 조정).
  occupationWeights: {
${weights}
  },
};
`;
  writeFileSync(new URL('./calibratedParams.ts', import.meta.url), file);
  console.log(`→ calibratedParams.ts 저장 (loss ${lossValue.toFixed(2)})`);
}

main();
