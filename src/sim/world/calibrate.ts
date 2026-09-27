import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { WomenLaborParams } from '../career/types';
import { CALIBRATED_PARAMS, CALIBRATED_WOMEN_PARAMS } from '../marriage/calibratedParams';
import { FREE_PARAMS, INITIAL_PARAMS, INITIAL_WOMEN_PARAMS, type MarriageParams } from '../marriage/params';
import { createRng } from '../rng';
import { gaussian } from '../stats';
import { CALIBRATED_WORLD_PARAMS, CALIBRATED_WORLD_MARRIAGE } from './calibratedParams';
import { INITIAL_WORLD_PARAMS, REOPENED_MARRIAGE_PARAMS, WORLD_FREE_PARAMS, type JointWorldParams, type WorldParams } from './params';

/**
 * `npm run sim:world:calibrate` — 공유 세계의 시뮬레이션 적률법. 결혼·경력 보정과 같은 단계(대각 진화 전략 →
 * 좌표별 패턴 탐색 → 넬더–미드)지만 평가 한 번이 길어서(주인공 2천 명의 50년, 약 12초) 코어 수만큼 워커를 띄워
 * 후보를 나눠 평가한다.
 *
 * 자유 파라미터: 세계(만남·단계 전이·헤어짐·혼외 임신·외도) + 결혼 모델에서 다시 여는 5개(REOPENED_MARRIAGE_PARAMS).
 * 인자: --n=2000 --gens=6 --sweeps=5 --nm=150 --seed=1 --fresh
 */

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
}

const women: WomenLaborParams = { ...INITIAL_WOMEN_PARAMS, ...CALIBRATED_WOMEN_PARAMS };
const reopened = REOPENED_MARRIAGE_PARAMS.map((name) => FREE_PARAMS.find((s) => s.name === name)!);

function toVector(world: WorldParams, marriage: MarriageParams): number[] {
  return [
    ...WORLD_FREE_PARAMS.map((s) => (world[s.name] - s.min) / (s.max - s.min)),
    ...reopened.map((s) => (marriage[s.name] - s.min) / (s.max - s.min)),
  ];
}

function fromVector(v: readonly number[]): JointWorldParams {
  const world = { ...INITIAL_WORLD_PARAMS };
  WORLD_FREE_PARAMS.forEach((s, i) => (world[s.name] = s.min + Math.max(0, Math.min(1, v[i])) * (s.max - s.min)));
  const marriage = { ...INITIAL_PARAMS, ...CALIBRATED_PARAMS, ...CALIBRATED_WORLD_MARRIAGE };
  reopened.forEach((s, k) => (marriage[s.name] = s.min + Math.max(0, Math.min(1, v[WORLD_FREE_PARAMS.length + k])) * (s.max - s.min)));
  return { world, marriage, women };
}

class Pool {
  private readonly workers: Worker[];
  private nextId = 0;
  private readonly pending = new Map<number, (loss: number) => void>();

  constructor(size: number) {
    this.workers = Array.from({ length: size }, () => {
      const w = new Worker(new URL('./evalWorker.mjs', import.meta.url));
      w.on('message', (m: { id: number; loss: number }) => {
        this.pending.get(m.id)?.(m.loss);
        this.pending.delete(m.id);
      });
      return w;
    });
  }

  private queue: (() => void)[] = [];
  private busy = new Set<Worker>();

  evaluate(params: JointWorldParams, n: number, seed: number): Promise<number> {
    return new Promise((resolve) => {
      const run = () => {
        const worker = this.workers.find((w) => !this.busy.has(w))!;
        this.busy.add(worker);
        const id = this.nextId++;
        this.pending.set(id, (loss) => {
          this.busy.delete(worker);
          resolve(loss);
          const next = this.queue.shift();
          if (next) next();
        });
        worker.postMessage({ id, params, n, seed });
      };
      if (this.busy.size < this.workers.length) run();
      else this.queue.push(run);
    });
  }

  close(): void {
    for (const w of this.workers) void w.terminate();
  }
}

async function main(): Promise<void> {
  const n = arg('n', 2000);
  const generations = arg('gens', 6);
  const sweeps = arg('sweeps', 5);
  const nmEvals = arg('nm', 150);
  const seed = arg('seed', 1);
  const fresh = process.argv.includes('--fresh');
  const pool = new Pool(Math.max(1, cpus().length));
  const started = Date.now();
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;
  const evaluate = (v: readonly number[]) => pool.evaluate(fromVector(v), n, seed);
  const evaluateAll = (vs: readonly (readonly number[])[]) => Promise.all(vs.map(evaluate));

  const startWorld = fresh ? INITIAL_WORLD_PARAMS : { ...INITIAL_WORLD_PARAMS, ...CALIBRATED_WORLD_PARAMS };
  const startMarriage = { ...INITIAL_PARAMS, ...CALIBRATED_PARAMS, ...(fresh ? {} : CALIBRATED_WORLD_MARRIAGE) };
  let mean = toVector(startWorld, startMarriage);
  const dim = mean.length;
  let best = { v: mean, loss: await evaluate(mean) };
  console.log(`초기 loss=${best.loss.toFixed(2)} (n=${n}, dim=${dim}, 워커 ${cpus().length}) ${elapsed()}`);
  const save = (label: string) => writeParams(fromVector(best.v), best.loss, `${label} --n=${n} --seed=${seed}`);

  // ---- 1단계: 대각 진화 전략 ----
  const rng = createRng(seed + 11);
  const lambda = 12;
  const mu = 4;
  const weights = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1));
  const wsum = weights.reduce((a, b) => a + b, 0);
  let sigma = new Array<number>(dim).fill(0.15);
  for (let gen = 0; gen < generations; gen++) {
    const vs = Array.from({ length: lambda }, () => mean.map((m, i) => Math.max(0, Math.min(1, m + sigma[i] * gaussian(rng)))));
    const losses = await evaluateAll(vs);
    const cands = vs.map((v, i) => ({ v, loss: losses[i] })).sort((a, b) => a.loss - b.loss);
    if (cands[0].loss < best.loss) best = cands[0];
    const elites = cands.slice(0, mu);
    const next = new Array<number>(dim).fill(0);
    elites.forEach((e, k) => e.v.forEach((x, i) => (next[i] += (weights[k] / wsum) * x)));
    sigma = sigma.map((sg, i) => {
      const spread = Math.sqrt(elites.reduce((a, e) => a + (e.v[i] - next[i]) ** 2, 0) / mu);
      return Math.max(0.01, Math.min(0.3, 0.6 * sg + 0.6 * spread));
    });
    mean = next;
    console.log(`gen ${gen + 1} best=${best.loss.toFixed(2)} genBest=${cands[0].loss.toFixed(2)} ${elapsed()}`);
  }
  if (generations > 0) {
    const ml = await evaluate(mean);
    if (ml < best.loss) best = { v: mean, loss: ml };
    save('stage1');
  }

  // ---- 2단계: 좌표별 패턴 탐색(±를 동시에 평가) ----
  let step = 0.05;
  for (let sweep = 0; sweep < sweeps && step >= 0.005; sweep++) {
    let improved = false;
    for (let i = 0; i < dim; i++) {
      const plus = [...best.v];
      const minus = [...best.v];
      plus[i] = Math.min(1, plus[i] + step);
      minus[i] = Math.max(0, minus[i] - step);
      const [lp, lm] = await evaluateAll([plus, minus]);
      if (Math.min(lp, lm) < best.loss) {
        best = lp <= lm ? { v: plus, loss: lp } : { v: minus, loss: lm };
        improved = true;
      }
    }
    console.log(`sweep ${sweep + 1} step=${step.toFixed(3)} best=${best.loss.toFixed(2)} ${elapsed()}`);
    save(`sweep${sweep + 1}`);
    if (!improved) step /= 2;
  }

  // ---- 3단계: 넬더–미드(반사·확장을 같이 평가) ----
  const clampV = (v: number[]) => v.map((x) => Math.max(0, Math.min(1, x)));
  const init = [best.v, ...Array.from({ length: dim }, (_, i) => {
    const v = [...best.v];
    v[i] += v[i] > 0.5 ? -0.04 : 0.04;
    return v;
  })];
  const initLoss = await evaluateAll(init);
  let simplex = init.map((v, i) => ({ v, loss: initLoss[i] }));
  let evals = dim;
  while (evals < nmEvals) {
    simplex.sort((a, b) => a.loss - b.loss);
    const worst = simplex[dim];
    const centroid = new Array<number>(dim).fill(0);
    for (let k = 0; k < dim; k++) simplex[k].v.forEach((x, i) => (centroid[i] += x / dim));
    const at = (t: number) => clampV(centroid.map((c, i) => c + t * (worst.v[i] - c)));
    const [rv, ev] = [at(-1), at(-2)];
    const [rl, el] = await evaluateAll([rv, ev]);
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
        const shrunk = simplex.slice(1).map((s) => clampV(b.v.map((x, i) => x + 0.5 * (s.v[i] - x))));
        const sl = await evaluateAll(shrunk);
        simplex = [b, ...shrunk.map((v, i) => ({ v, loss: sl[i] }))];
        evals += dim;
      }
    }
    simplex.sort((a, b) => a.loss - b.loss);
    if (simplex[0].loss < best.loss) best = simplex[0];
    if (evals % 20 < 3) console.log(`nelder-mead evals=${evals} best=${best.loss.toFixed(2)} ${elapsed()}`);
  }
  save(`--gens=${generations} --sweeps=${sweeps} --nm=${nmEvals}`);
  pool.close();
}

function writeParams(j: JointWorldParams, loss: number, label: string): void {
  const world = WORLD_FREE_PARAMS.map((s) => `  ${s.name}: ${Number(j.world[s.name].toPrecision(4))}, // ${s.drives}`).join('\n');
  const marriage = reopened.map((s) => `  ${s.name}: ${Number(j.marriage[s.name].toPrecision(4))}, // ${s.drives} (세계에서 다시 보정)`).join('\n');
  writeFileSync(
    new URL('./calibratedParams.ts', import.meta.url),
    `import type { MarriageParams } from '../marriage/params';
import type { WorldParams } from './params';

/**
 * \`npm run sim:world:calibrate -- ${label}\`가 생성한 파일 — 손으로 고치지 말 것.
 * 보정 loss(표준화 제곱 오차 합) = ${loss.toFixed(2)}. 표본 외 검증은 \`npm run sim:world\`.
 */
export const CALIBRATED_WORLD_PARAMS: WorldParams = {
${world}
};

/** 세계에서 다시 연 결혼 모델 파라미터(결혼 모델의 calibratedParams 위에 덮어쓴다). */
export const CALIBRATED_WORLD_MARRIAGE: Partial<MarriageParams> = {
${marriage}
};
`,
  );
  console.log(`→ world/calibratedParams.ts 저장 (loss ${loss.toFixed(2)})`);
}

void main();
