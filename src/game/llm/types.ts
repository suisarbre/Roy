import type { GameClock, MemoryNodeType, ObservableStats, ParsedIntent, PlausibilityJudgment, RouterOutput } from '../types';

export interface RecentLogSummary {
  kind: 'skip' | 'detail';
  narrative: string;
  playerInput?: string;
}

/**
 * 라우터에게 주는 입력은 전체 GameState가 아니라 이것뿐이다 — 라우터는 빠른 분류/파싱이
 * 목적이라 최근 로그 tail 정도만 보면 충분하고, 전체 로그/그래프를 주면 속도 이점이 사라진다.
 */
export interface RouterTurnRequest {
  clock: GameClock;
  playerInput: string | null;
  recentLog: RecentLogSummary[];
  /** target 파싱 시 참고할 기존 NPC 이름 목록 */
  knownNpcNames: string[];
}

/** 소형 라우터 모델을 감싸는 클라이언트. 구현체는 나중에 WebLLM으로 붙인다. */
export interface RouterModelClient {
  runRouterTurn(request: RouterTurnRequest): Promise<RouterOutput>;
}

export interface RecalledMemory {
  id: string;
  type: MemoryNodeType;
  content: string;
}

/**
 * 메인 모델에게도 전체 GameState/그래프를 주지 않는다 — 그래프에서 활성화 기준으로
 * 이미 회수된 `recalledMemories`만 넘겨서, "기억의 흐릿함"이 인터페이스 수준에서
 * 강제되도록 한다 (구현자가 실수로 그래프 전체를 프롬프트에 넣을 수 없게).
 */
export interface MainTurnRequest {
  clock: GameClock;
  observable: ObservableStats;
  intent: ParsedIntent;
  recentLog: RecentLogSummary[];
  recalledMemories: RecalledMemory[];
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
