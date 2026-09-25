import { createEmptyMemoryGraph } from './types';
import type { MemoryGraph, Npc, NpcId, NpcRelationType } from './types';

/** 이 점수를 넘으면 minor -> major로 승격 (강등은 없음). */
export const IMPORTANCE_PROMOTION_THRESHOLD = 50;
const IMPORTANCE_GAIN_PER_APPEARANCE = 3;
const MAX_IMPORTANCE = 100;

/** 관계 타입에 따른 초기 중요도 — 하이브리드의 "고정" 절반. */
const BASE_IMPORTANCE_BY_RELATION: Record<NpcRelationType, number> = {
  parent: 60,
  spouse: 60,
  child: 60,
  sibling: 45,
  friend: 15,
  boss: 15,
  coworker: 8,
  acquaintance: 5,
  other: 5,
};

export function createNpc(params: {
  id: NpcId;
  name: string;
  relationType: NpcRelationType;
  firstAppearedTurn: number;
  memoryNodeId: string;
}): Npc {
  const importanceScore = BASE_IMPORTANCE_BY_RELATION[params.relationType];
  const importanceTier = importanceScore >= IMPORTANCE_PROMOTION_THRESHOLD ? 'major' : 'minor';
  return {
    id: params.id,
    name: params.name,
    relationType: params.relationType,
    firstAppearedTurn: params.firstAppearedTurn,
    memoryNodeId: params.memoryNodeId,
    alive: true,
    importanceScore,
    importanceTier,
    memoryGraph: importanceTier === 'major' ? createEmptyMemoryGraph() : undefined,
  };
}

/**
 * 이 NPC가 이번 턴 사건에 참여했을 때 호출 — 하이브리드의 "동적" 절반.
 * 점수가 누적되다 임계값을 넘으면 승격하고, 그 시점까지 공유 그래프에 태그된
 * 사건들로 독립 그래프를 부트스트랩한다 (모델 호출 없이 그냥 복사).
 */
export function registerNpcAppearance(npc: Npc, sharedGraph: MemoryGraph): Npc {
  const importanceScore = Math.min(npc.importanceScore + IMPORTANCE_GAIN_PER_APPEARANCE, MAX_IMPORTANCE);

  if (npc.importanceTier === 'major' || importanceScore < IMPORTANCE_PROMOTION_THRESHOLD) {
    return { ...npc, importanceScore };
  }

  return {
    ...npc,
    importanceScore,
    importanceTier: 'major',
    memoryGraph: bootstrapMemoryGraphFromShared(sharedGraph, npc.id),
  };
}

function bootstrapMemoryGraphFromShared(sharedGraph: MemoryGraph, npcId: NpcId): MemoryGraph {
  const nodes: MemoryGraph['nodes'] = {};
  for (const node of Object.values(sharedGraph.nodes)) {
    if (node.participantNpcIds?.includes(npcId)) {
      nodes[node.id] = { ...node, accessTurns: [...node.accessTurns] };
    }
  }

  const edges: MemoryGraph['edges'] = {};
  const adjacency: MemoryGraph['adjacency'] = {};
  for (const edge of Object.values(sharedGraph.edges)) {
    if (nodes[edge.from] && nodes[edge.to]) {
      edges[edge.id] = edge;
      adjacency[edge.from] = [...(adjacency[edge.from] ?? []), edge.id];
      adjacency[edge.to] = [...(adjacency[edge.to] ?? []), edge.id];
    }
  }

  return { nodes, edges, adjacency };
}

/**
 * 이번 사건이 이 NPC 자신의 독립 그래프에도 각인될지를 확률로 정한다. minor는 항상 false.
 * "안 맞아떨어짐"이 아니라 "애초에 다 기억하진 않는다"는 선택적 각인을 표현한다 —
 * 중요도가 높을수록 각인 확률도 높다. 사건의 무게(개연성 판단 등)는 지금은 반영하지 않는다
 * (단순하게 가기로 함 — 나중에 필요하면 확률식에 보정치로 추가 가능).
 */
export function shouldEncodeIntoNpcMemory(npc: Npc): boolean {
  if (npc.importanceTier !== 'major') return false;
  const probability = Math.min(Math.max(npc.importanceScore / MAX_IMPORTANCE, 0.1), 0.95);
  return Math.random() < probability;
}
