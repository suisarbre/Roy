export type MemoryNodeType = 'person' | 'event' | 'place' | 'object' | 'emotionState';

export interface MemoryNode {
  id: string;
  type: MemoryNodeType;
  /** 압축된 서술 (예: "1975년, 아버지가 공장에서 해고됨") */
  content: string;
  createdAtTurn: number;
  /** 이 노드가 참조/언급된 턴들. 활성화 계산의 입력값. */
  accessTurns: number[];
  /**
   * 이 사건/맥락에 실제로 있었던 NPC id들 (NpcId를 쓰면 npc.ts와 순환 참조가 생겨 string[]로 둔다).
   * NPC별 회상 필터링과 독립 그래프 부트스트랩의 기준이 된다 — 목격하지 않은 NPC는 이 사건을
   * "알" 수 없다.
   */
  participantNpcIds?: string[];
  /** 9단계(1차) — memoryWeathering.ts가 이미 content를 압축했는지. true면 다시 건드리지
   *  않는다(무한 축소 방지 — 한 번 흐려지면 그 상태로 고정, 계속 사라지진 않는다). */
  weathered?: boolean;
}

export type MemoryRelation =
  | 'causedBy'
  | 'causes'
  | 'involves'
  | 'locatedAt'
  | 'owns'
  | 'relatedTo'
  | 'feelsTowards';

export interface MemoryEdge {
  id: string;
  from: string; // MemoryNode id
  to: string; // MemoryNode id
  relation: MemoryRelation;
  weight: number;
}

/**
 * 인생 전체의 기억 그래프. 노드 활성화는 저장된 값이 아니라
 * accessTurns + 현재 턴을 입력으로 매번 계산되는 파생값이다 (memoryActivation.ts 참고).
 * Map 대신 Record를 쓰는 이유는 직렬화(저장/디버깅) 편의성 때문.
 */
export interface MemoryGraph {
  nodes: Record<string, MemoryNode>;
  edges: Record<string, MemoryEdge>;
  /** nodeId -> 해당 노드에 연결된 edge id 목록 (순회 가속용 인덱스) */
  adjacency: Record<string, string[]>;
}

export function createEmptyMemoryGraph(): MemoryGraph {
  return { nodes: {}, edges: {}, adjacency: {} };
}

/** 회수된 기억을 LLM 클라이언트에 넘길 때 쓰는 압축 형태 — 전체 노드가 아니라 이것만 넘긴다. */
export interface RecalledMemory {
  id: string;
  type: MemoryNodeType;
  content: string;
}
