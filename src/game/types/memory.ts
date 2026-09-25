export type MemoryNodeType = 'person' | 'event' | 'place' | 'object' | 'emotionState';

export interface MemoryNode {
  id: string;
  type: MemoryNodeType;
  /** 압축된 서술 (예: "1975년, 아버지가 공장에서 해고됨") */
  content: string;
  createdAtTurn: number;
  /** 이 노드가 참조/언급된 턴들. 활성화 계산의 입력값. */
  accessTurns: number[];
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
