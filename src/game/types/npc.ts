import type { MemoryGraph } from './memory';
import type { ContactFrequency } from './stats';
import type { GameDate } from './time';

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

/** 이 NPC에 대한 실제 숨겨진 감정 상태. 플레이어에게 직접 노출되지 않는다. */
export interface NpcHiddenRelationship {
  accumulatedResentment: number;
  trust: number; // 0-100
  affection: number; // 0-100
}

/** 이 NPC와의 관계에 대해 플레이어가 직접 보는 값. */
export interface NpcObservableRelationship {
  contactFrequency: ContactFrequency;
  lastContactDate: GameDate | null;
}

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
  /**
   * 관계 데이터는 예전엔 npcs/hidden.relationships/observable.relationships 세 곳에
   * 흩어져 있었다 — 여기 하나로 합쳐서 단일 소스로 만든다.
   */
  hiddenRelationship: NpcHiddenRelationship;
  observableRelationship: NpcObservableRelationship;
}
