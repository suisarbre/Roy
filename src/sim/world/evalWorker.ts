import { parentPort } from 'node:worker_threads';
import { buildWorldTargets, measureWorld, worldLoss } from './moments';
import type { JointWorldParams } from './params';

/** 보정용 평가 워커 — 파라미터를 받아 loss를 돌려준다(코어마다 하나). */
const targets = buildWorldTargets();
parentPort!.on('message', (msg: { id: number; params: JointWorldParams; n: number; seed: number }) => {
  const { values } = measureWorld(msg.params, { n: msg.n, seed: msg.seed });
  parentPort!.postMessage({ id: msg.id, loss: worldLoss(values, targets) });
});
