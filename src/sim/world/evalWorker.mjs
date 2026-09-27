// 워커 스레드는 tsx 로더를 물려받지 않는다 — 여기서 등록하고 TS 워커를 불러온다.
import { register } from 'tsx/esm/api';
register();
await import('./evalWorker.ts');
