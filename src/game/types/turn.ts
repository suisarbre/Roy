import type { MemoryEdge, MemoryNode } from './memory';
import type { NpcId, NpcRelationType } from './npc';

export type TurnKind = 'skip' | 'detail';

/** 모델이 새로 제안하는 노드. 실제 id는 아직 없으므로, 같은 응답의 newEdges가 이 노드를
 *  가리킬 수 있도록 모델이 임의로 붙인 임시 참조용 id. */
export interface ProposedMemoryNode extends Pick<MemoryNode, 'type' | 'content' | 'participantNpcIds'> {
  localId: string;
}

export interface ProposedMemoryEdge extends Pick<MemoryEdge, 'relation' | 'weight'> {
  /** 기존 노드의 실제 id 또는 같은 델타 안 newNodes[].localId 중 하나 */
  from: string;
  to: string;
}

/**
 * 모델이 처음 소개하는 인물. `knownNpcNames`에 없는 이름이 등장할 때만 제안해야 한다
 * (이미 아는 사람이면 대신 그 사람의 실제 NpcId를 participantNpcIds에 바로 써야 함).
 */
export interface ProposedNpc {
  /** 이 NPC 자신을 가리키는 임시 id — 실제 NpcId가 아직 없으므로, 같은 델타의 다른 노드가
   *  participantNpcIds로 이 NPC를 태그할 때 이 localId를 대신 쓴다. */
  localId: string;
  name: string;
  relationType: NpcRelationType;
  /** 이 NPC를 설명하는 newNodes[] 중 하나의 localId (보통 type: 'person') */
  personNodeLocalId: string;
}

/**
 * 모델이 한 턴/씬 요약에서 제안하는 기억 그래프 변경분. 예전엔 RouterOutput 안에 중첩된
 * 타입이었지만, 라우터가 없어진 뒤에도 단일 모델의 턴 응답과 씬 요약 양쪽에서 똑같은
 * 모양이 재사용되므로 독립 타입으로 뺐다.
 */
export interface MemoryGraphDelta {
  newNodes: ProposedMemoryNode[];
  newEdges: ProposedMemoryEdge[];
  /** 이번에 참조된 기존 노드 id — 활성화 강화 대상 */
  accessedNodeIds: string[];
}

export type PlausibilityVerdict = 'reckless' | 'prepared' | 'neutral';

/** 모델이 플레이어 행동/사건을 서술할 때 같이 내는 개연성 판단 */
export interface PlausibilityJudgment {
  verdict: PlausibilityVerdict;
  /** 판단 근거로 인용한 기억 노드 id들 (서사 생성 프롬프트에 근거로 재사용) */
  citedMemoryNodeIds: string[];
  successBias: 'low' | 'medium' | 'high';
}

/**
 * statImpact의 예전 9개 숫자 필드를 대신하는 정성적 등급 — 실제 숫자 변환은 코드
 * (statImpact.ts)가 테이블로 담당한다. 작은 모델일수록 여러 숫자를 동시에 잘 보정하기보다
 * 등급 하나를 고르는 쪽이 훨씬 안정적이라는 판단(라우터 제거 + 모델 축소와 함께 도입,
 * 사용자 결정).
 */
export type OutcomeAxis = 'finance' | 'health' | 'mentalHealth' | 'relationship';

export interface OutcomeImpact {
  axis: OutcomeAxis;
  direction: 'positive' | 'negative';
  magnitude: 'minor' | 'moderate' | 'major';
  /** axis가 'relationship'일 때만 의미 있음 — 어느 NPC와의 관계인지. */
  relationshipNpcId?: NpcId;
  /** axis가 'health'이고 새 만성질환 시드가 생길 때만 의미 있음 — 시드에 붙일 이름
   *  (생략 시 언어별 기본 라벨을 코드가 채운다). */
  note?: string;
}
