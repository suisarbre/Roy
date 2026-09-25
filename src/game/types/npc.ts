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

export interface Npc {
  id: NpcId;
  name: string;
  relationType: NpcRelationType;
  alive: boolean;
  firstAppearedTurn: number;
  /** 그래프 기억 노드로 연결하기 위한 참조 */
  memoryNodeId: string;
}
