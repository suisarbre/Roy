import { createEmptyMemoryGraph } from './types';
import type { MemoryGraph, MemoryGraphDelta, Npc, NpcId, NpcRelationType, ProposedNpc } from './types';

/** 승격 임계값이자, 강등이 허용되는 관계에서 다시 minor로 떨어지는 기준선이기도 하다. */
export const IMPORTANCE_PROMOTION_THRESHOLD = 50;
const IMPORTANCE_GAIN_PER_APPEARANCE = 3;
const IMPORTANCE_DECAY_PER_MONTH = 0.5;
const MAX_IMPORTANCE = 100;

/** 가족 관계는 강등 대상이 아니다 — 한 번 중요해진 가족이 안 만난다고 하찮아지진 않는다는 단순화. */
const FAMILY_RELATION_TYPES: readonly NpcRelationType[] = ['parent', 'spouse', 'child', 'sibling'];

export function isFamilyRelation(relationType: NpcRelationType): boolean {
  return FAMILY_RELATION_TYPES.includes(relationType);
}

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

const NEUTRAL_RELATIONSHIP_VALUE = 50;

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
    hiddenRelationship: {
      accumulatedResentment: 0,
      trust: NEUTRAL_RELATIONSHIP_VALUE,
      affection: NEUTRAL_RELATIONSHIP_VALUE,
    },
    observableRelationship: { contactFrequency: 'none', lastContactDate: null },
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
 * 이번 턴에 등장하지 않은 NPC에게 호출 — 가족이 아니면 시간이 지날수록(elapsedMonths만큼)
 * 중요도가 깎이고, 임계값 아래로 떨어지면 major -> minor로 강등된다.
 * 강등돼도 그동안 쌓인 memoryGraph는 지우지 않는다: 관계가 뜸해졌다고 과거 기억이 통째로
 * 사라지는 게 아니라, 그 그래프 자체도 자기 활성화 곡선을 따라 서서히 흐려질 뿐이다.
 */
export function applyImportanceDecay(npc: Npc, elapsedMonths: number): Npc {
  if (isFamilyRelation(npc.relationType)) return npc;
  if (npc.importanceTier !== 'major') return npc;
  if (elapsedMonths <= 0) return npc;

  const importanceScore = Math.max(npc.importanceScore - IMPORTANCE_DECAY_PER_MONTH * elapsedMonths, 0);
  const importanceTier = importanceScore >= IMPORTANCE_PROMOTION_THRESHOLD ? 'major' : 'minor';
  return { ...npc, importanceScore, importanceTier };
}

function easeTowardNeutral(value: number, amount: number): number {
  if (value > NEUTRAL_RELATIONSHIP_VALUE) return Math.max(value - amount, NEUTRAL_RELATIONSHIP_VALUE);
  if (value < NEUTRAL_RELATIONSHIP_VALUE) return Math.min(value + amount, NEUTRAL_RELATIONSHIP_VALUE);
  return value;
}

const MONTHLY_RESENTMENT_GROWTH = 0.5;
const MONTHLY_RELATIONSHIP_COOLING = 0.3;

/**
 * 이번 턴에 등장하지 않은 NPC에게 호출 — 서운함이 쌓이고 trust/affection이 중립(50)으로
 * 식는다. 가족도 예외 없이 적용된다(안 만나면 서운한 건 가족도 마찬가지) — 이건
 * applyImportanceDecay의 가족 예외(그래프 추적 지속 여부)와는 다른 축이다.
 * 등장했다고 자동으로 좋아지진 않는다 — 긍정적 변화는 서사(메인 모델/씬 요약)의 몫이다.
 */
export function driftNpcRelationship(npc: Npc, elapsedMonths: number): Npc {
  if (elapsedMonths <= 0) return npc;

  return {
    ...npc,
    hiddenRelationship: {
      accumulatedResentment: npc.hiddenRelationship.accumulatedResentment + MONTHLY_RESENTMENT_GROWTH * elapsedMonths,
      trust: easeTowardNeutral(npc.hiddenRelationship.trust, MONTHLY_RELATIONSHIP_COOLING * elapsedMonths),
      affection: easeTowardNeutral(npc.hiddenRelationship.affection, MONTHLY_RELATIONSHIP_COOLING * elapsedMonths),
    },
  };
}

/**
 * 델타의 participantNpcIds 안에 섞여 있는 "아직 실제 id가 없는 신규 NPC" 참조를
 * 실제 NpcId로 치환한다. applyMemoryGraphDelta는 NPC 생성 개념을 몰라도 되도록,
 * 이 해소는 그래프 적용 전에 미리 끝내둔다.
 */
export function resolveNewNpcReferences(
  delta: MemoryGraphDelta,
  npcLocalIdToRealId: Map<string, string>,
): MemoryGraphDelta {
  return {
    ...delta,
    newNodes: delta.newNodes.map((node) => ({
      ...node,
      participantNpcIds: node.participantNpcIds?.map((id) => npcLocalIdToRealId.get(id) ?? id),
    })),
  };
}

/**
 * 모델이 이번 턴 처음 소개한 인물들의 Npc 레코드를 만든다.
 * `knownNpcNames`로 이미 안내했음에도 모델이 같은 이름을 다시 신규로 제안하면
 * (환각/실수) 무시한다 — 중복 NPC 생성 방지.
 */
export function createNpcsFromProposals(
  existingNpcs: Record<NpcId, Npc>,
  proposedNpcs: ProposedNpc[],
  npcLocalIdToRealId: Map<string, string>,
  memoryNodeLocalIdToRealId: Map<string, string>,
  currentTurn: number,
): Record<NpcId, Npc> {
  const created: Record<NpcId, Npc> = {};
  const existingNames = new Set(Object.values(existingNpcs).map((npc) => npc.name));

  for (const proposed of proposedNpcs) {
    if (existingNames.has(proposed.name)) continue;

    const id = npcLocalIdToRealId.get(proposed.localId);
    const memoryNodeId = memoryNodeLocalIdToRealId.get(proposed.personNodeLocalId);
    if (!id || !memoryNodeId) continue; // 대응하는 노드가 없으면 무시 (환각 방어)

    created[id] = createNpc({ id, name: proposed.name, relationType: proposed.relationType, firstAppearedTurn: currentTurn, memoryNodeId });
    existingNames.add(proposed.name);
  }

  return created;
}

/** 사건의 무게(PlausibilityJudgment가 neutral이 아님)가 각인 확률에 주는 보정치. */
const SIGNIFICANCE_ENCODING_BOOST = 0.3;
const MAX_ENCODING_PROBABILITY = 0.98;

/**
 * 이번 사건이 이 NPC 자신의 독립 그래프에도 각인될지를 확률로 정한다. minor는 항상 false.
 * "안 맞아떨어짐"이 아니라 "애초에 다 기억하진 않는다"는 선택적 각인을 표현한다 —
 * 중요도가 높을수록 각인 확률도 높다. `wasSignificantEvent`(개연성 판단이 neutral이
 * 아니었거나 이 NPC를 겨냥한 statImpact가 있었음)가 참이면 확률을 추가로 끌어올린다 —
 * 배우자가 목격한 큰 사건이 순전히 평소 중요도만으로 묻히는 걸 막기 위함.
 */
export function shouldEncodeIntoNpcMemory(npc: Npc, wasSignificantEvent = false): boolean {
  if (npc.importanceTier !== 'major') return false;
  const baseProbability = Math.min(Math.max(npc.importanceScore / MAX_IMPORTANCE, 0.1), 0.95);
  const probability = wasSignificantEvent
    ? Math.min(baseProbability + SIGNIFICANCE_ENCODING_BOOST, MAX_ENCODING_PROBABILITY)
    : baseProbability;
  return Math.random() < probability;
}
