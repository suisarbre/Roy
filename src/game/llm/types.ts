import type {
  EraEventDefinition,
  GameClock,
  ObservableStats,
  ParsedIntent,
  PlausibilityJudgment,
  ProposedNpc,
  RecalledMemory,
  RouterOutput,
  SceneExchange,
} from '../types';

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
  /**
   * 지금 시점 근방에 해당 가능한 시대 이벤트 후보 (eraEvents.ts의 getRelevantEraEvents로
   * 값싸게 미리 추려진 것). 실제로 겪는지, 정확히 언제인지는 라우터가 최종 판단한다.
   */
  relevantEraEvents: EraEventDefinition[];
}

/**
 * 씬(대화 등) 안에서 매 교환마다 호출 — "이 한 마디가 사소한가/중요한가"만 판단.
 * 매크로 라우터 호출과 스케일만 다를 뿐 같은 역할(저렴한 분류)의 재사용.
 */
export interface SceneClassifyRequest {
  clock: GameClock;
  involvedNpcNames: string[];
  exchangesSoFar: SceneExchange[];
  playerInput: string;
}

export interface SceneClassifyResponse {
  significance: 'trivial' | 'significant';
  /** significance가 'trivial'일 때만 사용 — 라우터가 직접 생성한 짧은 대사 */
  trivialReply?: string;
  /** 이 교환으로 씬이 자연스럽게 끝난다고 판단하면 true (하드 캡과 별개의 모델 신호) */
  sceneEnded: boolean;
}

/** 씬이 끝날 때 전체 교환 로그를 한 번에 압축 — 매크로 로그/그래프엔 이 결과 하나만 커밋된다. */
export interface SceneSummaryRequest {
  clock: GameClock;
  involvedNpcNames: string[];
  exchanges: SceneExchange[];
}

export interface SceneSummary {
  /** 매크로 로그에 남을 한 줄 요약 */
  narrative: string;
  /** 씬 자체가 게임 시간에 기여하는 개월 수. 보통 0. */
  elapsedMonths: number;
  newNpcs: ProposedNpc[];
  memoryGraphDelta: RouterOutput['memoryGraphDelta'];
}

/** 소형 라우터 모델을 감싸는 클라이언트. 구현체는 나중에 WebLLM으로 붙인다. */
export interface RouterModelClient {
  runRouterTurn(request: RouterTurnRequest): Promise<RouterOutput>;
  classifySceneExchange(request: SceneClassifyRequest): Promise<SceneClassifyResponse>;
  summarizeScene(request: SceneSummaryRequest): Promise<SceneSummary>;
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
  /** 이 서사가 왕복 대화로 이어진다면 씬 진입 — 누가 그 자리에 있는지. */
  entersScene?: { involvedNpcIds: string[] } | null;
}

/** 씬 안에서 "중요함"으로 분류된 교환에만 호출 — recalledMemories는 관련 NPC 관점으로 필터링된 것. */
export interface SceneTurnRequest {
  clock: GameClock;
  involvedNpcNames: string[];
  exchangesSoFar: SceneExchange[];
  playerInput: string;
  recalledMemories: RecalledMemory[];
}

export interface SceneTurnResponse {
  reply: string;
  plausibilityJudgment: PlausibilityJudgment;
  sceneEnded: boolean;
  death?: { cause: string } | null;
}

/** 무거운 메인 모델을 감싸는 클라이언트. 구현체는 나중에 WebLLM으로 붙인다. */
export interface MainModelClient {
  runDetailTurn(request: MainTurnRequest): Promise<MainTurnResponse>;
  runSceneTurn(request: SceneTurnRequest): Promise<SceneTurnResponse>;
}
