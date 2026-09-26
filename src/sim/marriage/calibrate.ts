import { writeFileSync } from 'node:fs';
import { createRng } from '../rng';
import { CALIBRATED_PARAMS } from './calibratedParams';
import { buildTargets, loss, measure } from './moments';
import { FREE_PARAMS, INITIAL_PARAMS, type MarriageParams } from './params';
import { gaussian } from './population';

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
 * - 시작점: 기존 calibratedParams.ts가 있으면 거기서 이어서(웜 스타트), --fresh면 INITIAL_PARAMS.
 * - 결과는 calibratedParams.ts로 저장된다(커밋되는 산출물).
 *
 * 인자: --n=10000(부부 수) --gens=20 --sweeps=12 --nm=300 --seed=1 --fresh
 */

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
}

function toVector(p: MarriageParams): number[] {
  return FREE_PARAMS.map((spec) => (p[spec.name] - spec.min) / (spec.max - spec.min));
}

function fromVector(v: readonly number[]): MarriageParams {
  const p = { ...INITIAL_PARAMS };
  FREE_PARAMS.forEach((spec, i) => {
    const x = Math.max(0, Math.min(1, v[i]));
    p[spec.name] = spec.min + x * (spec.max - spec.min);
  });
  return p;
}

function main(): void {
  const n = arg('n', 10000);
  const generations = arg('gens', 20);
  const sweeps = arg('sweeps', 12);
  const nmEvals = arg('nm', 300);
  const fresh = process.argv.includes('--fresh');
  const seed = arg('seed', 1);
  const lambda = 16;
  const mu = 5;
  const weights = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const targets = buildTargets();
  const evaluate = (v: readonly number[]) => loss(measure(fromVector(v), { n, seed }), targets);

  const rng = createRng(seed + 7);
  const dim = FREE_PARAMS.length;
  let mean = toVector(fresh ? INITIAL_PARAMS : { ...INITIAL_PARAMS, ...CALIBRATED_PARAMS });
  let sigma = new Array<number>(dim).fill(0.2);
  let best = { v: mean, loss: evaluate(mean) };
  console.log(`초기 loss=${best.loss.toFixed(2)} (n=${n}, dim=${dim}, λ=${lambda})`);

  const started = Date.now();
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
    sigma = sigma.map((s, i) => {
      const spread = Math.sqrt(elites.reduce((acc, e) => acc + (e.v[i] - nextMean[i]) ** 2, 0) / mu);
      return Math.max(0.01, Math.min(0.3, 0.6 * s + 0.6 * spread));
    });
    mean = nextMean;
    console.log(
      `gen ${String(gen + 1).padStart(2)}  best=${best.loss.toFixed(2)}  genBest=${candidates[0].loss.toFixed(2)}  σ̄=${(sigma.reduce((a, b) => a + b, 0) / dim).toFixed(3)}  ${((Date.now() - started) / 1000).toFixed(0)}s`,
    );
  }

  // 마지막 평균점도 후보로 확인(엘리트 평균이 개별 최고보다 나을 때가 있다).
  const meanLoss = evaluate(mean);
  if (meanLoss < best.loss) best = { v: mean, loss: meanLoss };

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
    console.log(`sweep ${sweep + 1}  step=${step.toFixed(4)}  best=${best.loss.toFixed(2)}  ${((Date.now() - started) / 1000).toFixed(0)}s`);
    if (!improved) step /= 2;
  }

  // ---- 3단계: 넬더–미드 ----
  {
    const clampV = (v: number[]) => v.map((x) => Math.max(0, Math.min(1, x)));
    let simplex = [best, ...Array.from({ length: dim }, (_, i) => {
      const v = [...best.v];
      v[i] = v[i] + (v[i] > 0.5 ? -0.05 : 0.05);
      return { v, loss: evaluate(v) };
    })];
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
        if (contracted.loss < worst.loss) {
          simplex[dim] = contracted;
        } else {
          const bestVertex = simplex[0];
          simplex = simplex.map((s, k) => {
            if (k === 0) return s;
            const v = clampV(bestVertex.v.map((x, i) => x + 0.5 * (s.v[i] - x)));
            return { v, loss: evaluate(v) };
          });
          evals += dim;
        }
      }
      simplex.sort((a, b) => a.loss - b.loss);
      if (simplex[0].loss < best.loss) best = simplex[0];
      if (evals % 40 < 2) console.log(`nelder-mead evals=${evals} best=${best.loss.toFixed(2)} ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
    console.log(`nelder-mead 완료 best=${best.loss.toFixed(2)}`);
  }

  const params = fromVector(best.v);
  // 자유 파라미터만이 아니라 전체를 쓴다 — 고정값(INITIAL_PARAMS)이 빠지면 undefined → NaN이 되어
  // 모든 행동이 조용히 '중립'으로 떨어진다(실제로 겪은 버그).
  const freeNames = new Set(FREE_PARAMS.map((spec) => spec.name));
  const body = (Object.keys(params) as (keyof MarriageParams)[])
    .map((name) => {
      const spec = FREE_PARAMS.find((s) => s.name === name);
      const note = freeNames.has(name) ? spec!.drives : '고정(보정 대상 아님)';
      return `  ${name}: ${Number(params[name].toFixed(4))}, // ${note}`;
    })
    .join('\n');
  const file = `import type { MarriageParams } from './params';

/**
 * \`npm run sim:marriage:calibrate -- --n=${n} --gens=${generations} --sweeps=${sweeps} --nm=${nmEvals} --seed=${seed}\`가 생성한 파일 — 손으로 고치지 말 것.
 * 보정 loss(표준화 제곱 오차 합, 적률 17개) = ${best.loss.toFixed(2)}. 표본 외 검증은 \`npm run sim:marriage\`.
 */
export const CALIBRATED_PARAMS: MarriageParams = {
${body}
};
`;
  writeFileSync(new URL('./calibratedParams.ts', import.meta.url), file);
  console.log(`\n최종 loss=${best.loss.toFixed(2)} → src/sim/marriage/calibratedParams.ts 저장`);
}

main();
