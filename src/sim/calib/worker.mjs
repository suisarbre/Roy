// 공용 보정 워커 부트스트랩: tsx 로더를 등록한 뒤 workerData.entry(.ts)를 불러 그 모듈의 evaluate(payload)를 돌린다.
import { register } from 'tsx/esm/api';
import { parentPort, workerData } from 'node:worker_threads';

register();
const mod = await import(workerData.entry);
parentPort.on('message', async (msg) => {
  try {
    const result = await mod.evaluate(msg.payload);
    parentPort.postMessage({ id: msg.id, result });
  } catch (error) {
    parentPort.postMessage({ id: msg.id, error: String(error && error.stack ? error.stack : error) });
  }
});
