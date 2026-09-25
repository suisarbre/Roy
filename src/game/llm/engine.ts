import { CreateMLCEngine, type InitProgressReport, type MLCEngine } from '@mlc-ai/web-llm';

/**
 * 라우터: 빠른 분류/파싱 전용 소형 모델. 메인: 서사 생성/개연성 판단용 대형 모델.
 * 하나의 엔진에 두 모델을 동시에 올려서(reload 배열) 매 턴 모델을 스왑하는 비용 없이
 * chatCompletion 호출마다 `model` 필드로 어느 쪽을 쓸지만 고른다.
 */
export const ROUTER_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
// 7B는 체감 지연이 너무 커서 3B로 내림 — 다국어/CJK 강점은 Qwen 계열이라 유지되고,
// 서사 길이가 짧은 이 게임 특성상 품질 손실보다 응답 속도 이득이 크다는 판단(사용자 결정).
export const MAIN_MODEL_ID = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';

export type EngineLoadProgress = InitProgressReport;

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

/**
 * 두 모델을 순차 로드하는 단일 MLCEngine을 만든다. 실패하면(WebGPU 없음, OOM, 네트워크 등)
 * 그대로 던진다 — 호출부(App.tsx)가 로딩 화면에서 에러로 보여준다.
 */
export function loadSharedEngine(onProgress: (report: EngineLoadProgress) => void): Promise<MLCEngine> {
  if (!isWebGPUAvailable()) {
    return Promise.reject(new Error('WebGPU_UNAVAILABLE'));
  }
  return CreateMLCEngine([ROUTER_MODEL_ID, MAIN_MODEL_ID], { initProgressCallback: onProgress });
}
