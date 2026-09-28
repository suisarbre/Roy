import { createRng } from '../rng';
import { gaussian } from '../stats';

/**
 * 시뮬레이션 적률법의 공용 최적화기 — 결혼·경력·세계 보정이 각자 쓰던 3단계(대각 진화 전략 → 좌표별 패턴 탐색 →
 * 넬더–미드)를 한 곳에. 벡터는 [0,1]로 정규화된 파라미터(각 모듈의 params.ts 범위로 변환).
 *
 * `evaluateAll`은 후보 여러 개를 한 번에 받는다 — 워커 풀(pool.ts)이 병렬로 나눠 평가할 수 있게.
 * 과적합을 막으려면 evaluate 안에서 여러 시드(서로 다른 주인공 표본)의 loss를 합쳐라(REALISM_V2.md).
 */

export interface OptimizeOptions {
  start: number[];
  evaluateAll: (vs: readonly (readonly number[])[]) => Promise<number[]>;
  /** 1단계 세대 수(0이면 건너뜀). */
  generations?: number;
  /** 2단계 좌표 스윕 수. */
  sweeps?: number;
  /** 3단계 넬더–미드 평가 횟수. */
  nmEvals?: number;
  seed?: number;
  /** 1단계 초기 탐색 폭(정규화 단위). */
  sigma?: number;
  /** 2단계 초기 보폭. */
  step?: number;
  /** 새 최선이 나올 때마다(저장용). */
  onImprove?: (v: readonly number[], loss: number, stage: string) => void;
  log?: (line: string) => void;
}

export interface OptimizeResult {
  v: number[];
  loss: number;
}

const clamp = (v: readonly number[]) => v.map((x) => Math.max(0, Math.min(1, x)));

export async function optimize(o: OptimizeOptions): Promise<OptimizeResult> {
  const log = o.log ?? ((line: string) => console.log(line));
  const started = Date.now();
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;
  const evaluate = async (v: readonly number[]) => (await o.evaluateAll([v]))[0];
  const dim = o.start.length;
  let best: OptimizeResult = { v: clamp(o.start), loss: await evaluate(clamp(o.start)) };
  log(`초기 loss=${best.loss.toFixed(2)} (dim=${dim}) ${elapsed()}`);
  const improve = (cand: OptimizeResult, stage: string) => {
    if (cand.loss < best.loss) {
      best = { v: [...cand.v], loss: cand.loss };
      o.onImprove?.(best.v, best.loss, stage);
    }
  };

  // ---- 1단계: 대각 진화 전략 ----
  const generations = o.generations ?? 0;
  if (generations > 0) {
    const rng = createRng((o.seed ?? 1) + 11);
    const lambda = Math.max(8, 4 + Math.floor(3 * Math.log(dim)) * 2);
    const mu = Math.floor(lambda / 3);
    const weights = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
    const wsum = weights.reduce((a, b) => a + b, 0);
    let mean = [...best.v];
    let sigma = new Array<number>(dim).fill(o.sigma ?? 0.1);
    for (let gen = 0; gen < generations; gen++) {
      const vs = Array.from({ length: lambda }, () => clamp(mean.map((m, i) => m + sigma[i] * gaussian(rng))));
      const losses = await o.evaluateAll(vs);
      const cands = vs.map((v, i) => ({ v, loss: losses[i] })).sort((a, b) => a.loss - b.loss);
      improve(cands[0], `es${gen + 1}`);
      const elites = cands.slice(0, mu);
      const next = new Array<number>(dim).fill(0);
      elites.forEach((e, k) => e.v.forEach((x, i) => (next[i] += (weights[k] / wsum) * x)));
      sigma = sigma.map((sg, i) => {
        const spread = Math.sqrt(elites.reduce((a, e) => a + (e.v[i] - next[i]) ** 2, 0) / mu);
        return Math.max(0.01, Math.min(0.3, 0.6 * sg + 0.6 * spread));
      });
      mean = next;
      log(`gen ${gen + 1} best=${best.loss.toFixed(2)} genBest=${cands[0].loss.toFixed(2)} ${elapsed()}`);
    }
    improve({ v: mean, loss: await evaluate(mean) }, 'esMean');
  }

  // ---- 2단계: 좌표별 패턴 탐색(±를 한 번에) ----
  let step = o.step ?? 0.05;
  for (let sweep = 0; sweep < (o.sweeps ?? 0) && step >= 0.004; sweep++) {
    let improved = false;
    for (let i = 0; i < dim; i++) {
      const plus = [...best.v];
      const minus = [...best.v];
      plus[i] = Math.min(1, plus[i] + step);
      minus[i] = Math.max(0, minus[i] - step);
      const [lp, lm] = await o.evaluateAll([plus, minus]);
      const before = best.loss;
      improve(lp <= lm ? { v: plus, loss: lp } : { v: minus, loss: lm }, `sweep${sweep + 1}`);
      if (best.loss < before) improved = true;
    }
    log(`sweep ${sweep + 1} step=${step.toFixed(3)} best=${best.loss.toFixed(2)} ${elapsed()}`);
    if (!improved) step /= 2;
  }

  // ---- 3단계: 넬더–미드 ----
  const nmEvals = o.nmEvals ?? 0;
  if (nmEvals > 0) {
    const init = [best.v, ...Array.from({ length: dim }, (_, i) => {
      const v = [...best.v];
      v[i] += v[i] > 0.5 ? -0.04 : 0.04;
      return v;
    })];
    const initLoss = await o.evaluateAll(init);
    let simplex = init.map((v, i) => ({ v, loss: initLoss[i] }));
    let evals = dim + 1;
    let lastLog = 0;
    while (evals < nmEvals) {
      simplex.sort((a, b) => a.loss - b.loss);
      const worst = simplex[dim];
      const centroid = new Array<number>(dim).fill(0);
      for (let k = 0; k < dim; k++) simplex[k].v.forEach((x, i) => (centroid[i] += x / dim));
      const at = (t: number) => clamp(centroid.map((c, i) => c + t * (worst.v[i] - c)));
      const [rv, ev] = [at(-1), at(-2)];
      const [rl, el] = await o.evaluateAll([rv, ev]);
      evals += 2;
      if (rl < simplex[0].loss) simplex[dim] = el < rl ? { v: ev, loss: el } : { v: rv, loss: rl };
      else if (rl < simplex[dim - 1].loss) simplex[dim] = { v: rv, loss: rl };
      else {
        const cv = at(0.5);
        const cl = await evaluate(cv);
        evals += 1;
        if (cl < worst.loss) simplex[dim] = { v: cv, loss: cl };
        else {
          const b = simplex[0];
          const shrunk = simplex.slice(1).map((sx) => clamp(b.v.map((x, i) => x + 0.5 * (sx.v[i] - x))));
          const sl = await o.evaluateAll(shrunk);
          simplex = [b, ...shrunk.map((v, i) => ({ v, loss: sl[i] }))];
          evals += dim;
        }
      }
      simplex.sort((a, b) => a.loss - b.loss);
      improve(simplex[0], 'nm');
      if (evals - lastLog >= 20) {
        lastLog = evals;
        log(`nelder-mead evals=${evals} best=${best.loss.toFixed(2)} ${elapsed()}`);
      }
    }
  }
  return best;
}

/** 정규화 벡터 ↔ 파라미터 객체(범위 명세 목록으로). */
export interface ParamSpec<K extends string> {
  name: K;
  min: number;
  max: number;
}

export function toUnit<K extends string>(specs: readonly ParamSpec<K>[], values: Record<K, number>): number[] {
  return specs.map((s) => (values[s.name] - s.min) / (s.max - s.min));
}

export function fromUnit<K extends string, T extends Record<K, number>>(specs: readonly ParamSpec<K>[], v: readonly number[], base: T): T {
  const out = { ...base };
  specs.forEach((s, i) => ((out as Record<K, number>)[s.name] = s.min + Math.max(0, Math.min(1, v[i])) * (s.max - s.min)));
  return out;
}

/** 표준화 제곱 오차 합(보정 loss 공통 정의). NaN 적률은 100점 벌점. */
export function momentLoss(values: Record<string, number>, targets: readonly { key: string; target: number; tolerance: number; weight?: number }[]): number {
  let total = 0;
  for (const t of targets) {
    const x = values[t.key];
    if (!Number.isFinite(x)) {
      total += 100;
      continue;
    }
    total += (t.weight ?? 1) * ((x - t.target) / t.tolerance) ** 2;
  }
  return total;
}

/** PASS/WARN/FAIL 표(표본 외 검증 CLI 공통). */
export function verdictTable(values: Record<string, number>, targets: readonly { key: string; label: string; target: number; tolerance: number }[]): string {
  const fmt = (x: number) => (Number.isFinite(x) ? (Math.abs(x) >= 100 ? x.toFixed(1) : x.toFixed(3)) : 'NaN');
  const tally = { PASS: 0, WARN: 0, FAIL: 0 };
  const lines = targets.map((t) => {
    const x = values[t.key];
    const z = Math.abs((x - t.target) / t.tolerance);
    const verdict = !Number.isFinite(z) || z > 2 ? 'FAIL' : z > 1 ? 'WARN' : 'PASS';
    tally[verdict] += 1;
    return `${verdict.padEnd(5)} ${t.label.padEnd(40)} 목표 ${fmt(t.target).padStart(8)}  모델 ${fmt(x).padStart(8)}  (±${t.tolerance})`;
  });
  lines.push(`loss=${momentLoss(values, targets).toFixed(2)}  PASS ${tally.PASS} / WARN ${tally.WARN} / FAIL ${tally.FAIL}`);
  return lines.join('\n');
}
