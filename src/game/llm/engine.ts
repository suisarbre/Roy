import { CreateMLCEngine, type InitProgressReport, type MLCEngine } from '@mlc-ai/web-llm';

/**
 * 라우터 모델을 완전히 없앴다(사용자 결정) — 평범한 시간 경과/급사/시대 이벤트 시점 판단은
 * 전부 코드가 직접 결정하고(gameLoop.ts, eraEvents.ts), LLM은 "이제 실제로 뭔가 서술해야
 * 하는 순간"에만 호출된다. 그래서 모델이 하나뿐이고, 그마저도 호출 빈도가 크게 줄어든
 * 만큼 크기를 1.5B로 낮췄다 — 11개 언어(특히 CJK) 서사 품질이 0.5B보다 훨씬 안정적이다.
 */
export const MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export type EngineLoadProgress = InitProgressReport;

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * 단일 모델 MLCEngine을 만든다. 실패하면(WebGPU 없음, OOM, 네트워크 등) 그대로 던진다 —
 * 호출부(App.tsx)가 로딩 화면에서 에러로 보여준다.
 */
export function loadSharedEngine(onProgress: (report: EngineLoadProgress) => void): Promise<MLCEngine> {
  if (!isWebGPUAvailable()) {
    return Promise.reject(new Error('WebGPU_UNAVAILABLE'));
  }
  return CreateMLCEngine(MODEL_ID, { initProgressCallback: onProgress });
}
