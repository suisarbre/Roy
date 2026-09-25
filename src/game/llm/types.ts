import type {
  EraEventDefinition,
  GameClock,
  MemoryGraphDelta,
  ObservableStats,
  PlausibilityJudgment,
  ProposedNpc,
  RecalledMemory,
  SceneExchange,
  OutcomeImpact,
  MentalSymptomTag,
} from '../types';

export interface RecentLogSummary {
  kind: 'skip' | 'detail';
  narrative: string;
  playerInput?: string;
}

/**
 * 모델이 호출되는 계기는 딱 셋뿐이다 — 나머지(평범한 시간 경과, 급사, "지금이 그 순간인가"
 * 판단)는 전부 코드가 직접 결정한다(gameLoop.ts, eraEvents.ts). 라우터가 있던 시절엔 매 턴
 * 이 판단 자체를 모델에게 물었지만, 지금은 "이미 뭔가 서술해야 한다고 코드가 정한 순간"에만
 * 모델이 불려온다.
 */
export type TurnTrigger =
  | { kind: 'playerAction'; playerInput: string }
  | { kind: 'eraEvent'; definition: EraEventDefinition }
  | { kind: 'unpromptedEvent' };

/**
 * 모델에게도 전체 GameState/그래프를 주지 않는다 — 그래프에서 활성화 기준으로 이미
 * 회수된 `recalledMemories`만 넘겨서, "기억의 흐릿함"이 인터페이스 수준에서 강제되도록
 * 한다(구현자가 실수로 그래프 전체를 프롬프트에 넣을 수 없게).
 */
export interface TurnRequest {
  clock: GameClock;
  observable: ObservableStats;
  trigger: TurnTrigger;
  recentLog: RecentLogSummary[];
  recalledMemories: RecalledMemory[];
  /** newNpcs 중복 제안 방지용 기존 NPC 이름 목록 */
  knownNpcNames: string[];
}

export interface TurnResponse {
  narrative: string;
  plausibilityJudgment: PlausibilityJudgment;
  /** 이번 사건이 hidden/observable 값에 준 실제 영향 — statImpact.ts가 실제 숫자로 변환한다. */
  outcomeImpact?: OutcomeImpact;
  /** 서사를 통해 겉으로 드러난 정신건강 증상 — observable에 바로 반영된다. */
  newVisibleSymptom?: MentalSymptomTag;
  /** 이번 사건으로 사망했다면 사인. 아니면 undefined. */
  death?: { cause: string } | null;
  /** 이 서사가 왕복 대화로 이어진다면 씬 진입 — 누가 그 자리에 있는지. */
  entersScene?: { involvedNpcIds: string[] } | null;
  newNpcs?: ProposedNpc[];
  memoryGraphDelta?: MemoryGraphDelta;
}

/** 씬(대화 등) 안에서 "중요함/판단 필요"로 분류된 교환에만 호출 — recalledMemories는
 *  관련 NPC 관점으로 필터링된 것. (분류 자체는 없어졌다 — 모든 교환이 이 호출 하나로 간다.) */
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
  outcomeImpact?: OutcomeImpact;
  newVisibleSymptom?: MentalSymptomTag;
  death?: { cause: string } | null;
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
  memoryGraphDelta: MemoryGraphDelta;
}

/** 단일 모델(라우터 없음)을 감싸는 클라이언트. 구현체는 webllmClients.ts. */
export interface GameModelClient {
  runTurn(request: TurnRequest): Promise<TurnResponse>;
  runSceneTurn(request: SceneTurnRequest): Promise<SceneTurnResponse>;
  summarizeScene(request: SceneSummaryRequest): Promise<SceneSummary>;
}
