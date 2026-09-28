import { cpus } from 'node:os';
import { Worker } from 'node:worker_threads';

/**
 * 보정용 워커 풀. `entry`는 `export function evaluate(payload): number | Promise<number>`를 내보내는 .ts 파일의 URL.
 * 워커마다 모듈을 한 번 불러 두고(캐시·인구 표본 재사용) 페이로드만 주고받는다. 페이로드는 구조화 복제 가능한
 * 순수 데이터여야 한다(함수·클래스 인스턴스 불가 — 모듈 객체는 워커 안에서 파라미터로 다시 만든다).
 *
 * 워커 수: 기본은 코어 수. 이 머신은 2코어라 에이전트 여러 명이 동시에 보정하면 `ROY_WORKERS=1`로 줄여라.
 */
export class WorkerPool<P, R = number> {
  private readonly workers: Worker[];
  private readonly idle: Worker[] = [];
  private readonly queue: (() => void)[] = [];
  private readonly pending = new Map<number, { resolve: (r: R) => void; reject: (e: Error) => void }>();
  private nextId = 0;

  constructor(entry: URL, size = Number(process.env.ROY_WORKERS ?? cpus().length)) {
    this.workers = Array.from({ length: Math.max(1, size) }, () => {
      const w = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { entry: entry.href } });
      w.on('message', (m: { id: number; result?: R; error?: string }) => {
        const p = this.pending.get(m.id);
        this.pending.delete(m.id);
        this.idle.push(w);
        const next = this.queue.shift();
        if (next) next();
        if (!p) return;
        if (m.error !== undefined) p.reject(new Error(m.error));
        else p.resolve(m.result as R);
      });
      w.on('error', (e) => {
        for (const p of this.pending.values()) p.reject(e);
      });
      return w;
    });
    this.idle.push(...this.workers);
  }

  get size(): number {
    return this.workers.length;
  }

  run(payload: P): Promise<R> {
    return new Promise((resolve, reject) => {
      const go = () => {
        const w = this.idle.pop()!;
        const id = this.nextId++;
        this.pending.set(id, { resolve, reject });
        w.postMessage({ id, payload });
      };
      if (this.idle.length > 0) go();
      else this.queue.push(go);
    });
  }

  runAll(payloads: readonly P[]): Promise<R[]> {
    return Promise.all(payloads.map((p) => this.run(p)));
  }

  close(): void {
    for (const w of this.workers) void w.terminate();
  }
}
