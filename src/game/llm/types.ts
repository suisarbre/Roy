import type { GameState, ParsedIntent, PlausibilityJudgment, RouterOutput } from '../types';

export interface RouterTurnRequest {
  state: GameState;
  /** null = 플레이어가 이번엔 아무 입력도 하지 않고 그냥 다음으로 넘긴 경우 */
  playerInput: string | null;
}

/** 소형 라우터 모델을 감싸는 클라이언트. 구현체는 나중에 WebLLM으로 붙인다. */
export interface RouterModelClient {
  runRouterTurn(request: RouterTurnRequest): Promise<RouterOutput>;
}

export interface MainTurnRequest {
  state: GameState;
  intent: ParsedIntent;
  /** 라우터가 만든 그래프 델타까지 반영된 이후, 활성화 상위로 회수된 기억 노드 id */
  recalledMemoryNodeIds: string[];
}

export interface MainTurnResponse {
  narrative: string;
  plausibilityJudgment: PlausibilityJudgment;
  /** 이번 사건으로 사망했다면 사인. 아니면 null/undefined. */
  death?: { cause: string } | null;
}

/** 무거운 메인 모델을 감싸는 클라이언트. 구현체는 나중에 WebLLM으로 붙인다. */
export interface MainModelClient {
  runDetailTurn(request: MainTurnRequest): Promise<MainTurnResponse>;
}
