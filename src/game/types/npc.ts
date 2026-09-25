import type { MemoryGraph } from './memory';

export type NpcId = string;

export type NpcRelationType =
  | 'parent'
  | 'sibling'
  | 'spouse'
  | 'child'
  | 'friend'
  | 'coworker'
  | 'boss'
  | 'acquaintance'
  | 'other';

/**
 * 'minor'는 독립 그래프 없이 hidden relationship stats로만 존재.
 * 'major'는 자기만의 memoryGraph를 가짐 — 강등은 없고 승격만 있다
 * (한 번 중요해진 관계가 다시 하찮아지진 않는다는 단순화).
 */
export type NpcImportanceTier = 'minor' | 'major';

export interface Npc {
  id: NpcId;
  name: string;
  relationType: NpcRelationType;
  alive: boolean;
  firstAppearedTurn: number;
  /** 공유 기억 그래프 상의 이 NPC 자신을 가리키는 노드 */
  memoryNodeId: string;
  /** 상호작용 누적으로 오르는 점수 (0-100). npcImportance.ts에서 관리. */
  importanceScore: number;
  importanceTier: NpcImportanceTier;
  /** major로 승격된 NPC만 가짐 — 이 NPC 자신의 관점에서 본 독립 기억 그래프 */
  memoryGraph?: MemoryGraph;
}
