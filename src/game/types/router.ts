import type { MemoryEdge, MemoryNode } from './memory';

export type TurnKind = 'skip' | 'detail';

/**
 * 플레이어 입력에서 파싱되는 행동 분류.
 * 범죄도 창업/이민/도박과 동일하게 'majorLifeAttempt'로 묶는다 — 문서 원칙:
 * "범죄뿐 아니라 모든 인생 역전 시도에 동일하게 적용되는 프레임". 세부 구분은
 * contextTags(예: 'crime', 'startup', 'immigration', 'gambling')로 한다.
 * 시대 강제 이벤트(징병 등)는 플레이어 의도가 아니므로 여기 포함하지 않는다 —
 * eraEvent.ts의 별도 트리거 파이프라인에서 처리한다.
 */
export type ActionCategory = 'routine' | 'career' | 'relationship' | 'health' | 'finance' | 'majorLifeAttempt';

export interface ParsedIntent {
  actionType: ActionCategory;
  target?: string; // 대상 NPC/기관 등
  contextTags: string[];
}

/** 소형 라우터 모델이 매 턴 산출하는 구조화 출력 */
export interface RouterOutput {
  turnType: TurnKind;
  intent: ParsedIntent | null; // skip 턴에는 null일 수 있음
  memoryGraphDelta: {
    newNodes: Array<Pick<MemoryNode, 'type' | 'content'>>;
    newEdges: Array<Pick<MemoryEdge, 'from' | 'to' | 'relation' | 'weight'>>;
    /** 이번 턴에 참조된 기존 노드 id — 활성화 강화 대상 */
    accessedNodeIds: string[];
  };
}

export type PlausibilityVerdict = 'reckless' | 'prepared' | 'neutral';

/** 무거운 모델이 detail 턴에서 산출하는 개연성 판단 */
export interface PlausibilityJudgment {
  verdict: PlausibilityVerdict;
  /** 판단 근거로 인용한 기억 노드 id들 (서사 생성 프롬프트에 근거로 재사용) */
  citedMemoryNodeIds: string[];
  successBias: 'low' | 'medium' | 'high';
}
