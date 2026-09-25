import { AMBIENT_RECALL_THRESHOLD, computeActivation } from './memoryActivation';
import type { MemoryGraph, RouterOutput } from './types';

export interface ApplyDeltaResult {
  graph: MemoryGraph;
  /** 이번 델타로 새로 생성된 노드의 실제 id (회상 시드로 쓰인다) */
  newNodeIds: string[];
  /** newNodes[].localId -> 실제 id. 신규 NPC의 personNodeLocalId를 해소하는 데도 쓰인다. */
  localIdToRealId: Map<string, string>;
}

/**
 * 라우터가 제안한 그래프 델타(신규 노드/엣지, 접근된 노드)를 기존 그래프에 반영한다.
 * newEdges의 from/to는 기존 노드의 실제 id이거나, 같은 델타의 newNodes[].localId일 수 있다 —
 * 신규 노드에는 아직 실제 id가 없으므로 이번 호출 안에서 즉석으로 매핑해서 해소한다.
 */
export function applyMemoryGraphDelta(
  graph: MemoryGraph,
  delta: RouterOutput['memoryGraphDelta'],
  currentTurn: number,
): ApplyDeltaResult {
  const nodes = { ...graph.nodes };
  const edges = { ...graph.edges };
  const adjacency: Record<string, string[]> = {};
  for (const [nodeId, edgeIds] of Object.entries(graph.adjacency)) {
    adjacency[nodeId] = [...edgeIds];
  }

  const localIdToRealId = new Map<string, string>();
  const newNodeIds: string[] = [];
  for (const proposed of delta.newNodes) {
    const id = crypto.randomUUID();
    localIdToRealId.set(proposed.localId, id);
    newNodeIds.push(id);
    nodes[id] = {
      id,
      type: proposed.type,
      content: proposed.content,
      createdAtTurn: currentTurn,
      accessTurns: [currentTurn],
      participantNpcIds: proposed.participantNpcIds,
    };
  }

  const resolveNodeId = (ref: string): string => localIdToRealId.get(ref) ?? ref;

  for (const proposedEdge of delta.newEdges) {
    const from = resolveNodeId(proposedEdge.from);
    const to = resolveNodeId(proposedEdge.to);
    // 존재하지 않는 노드를 가리키면 무시한다 — 라우터가 환각으로 만들어낸 참조에 대한 방어.
    if (!nodes[from] || !nodes[to]) continue;

    const id = crypto.randomUUID();
    edges[id] = { id, from, to, relation: proposedEdge.relation, weight: proposedEdge.weight };
    adjacency[from] = [...(adjacency[from] ?? []), id];
    adjacency[to] = [...(adjacency[to] ?? []), id];
  }

  for (const nodeId of delta.accessedNodeIds) {
    const node = nodes[nodeId];
    if (!node) continue;
    nodes[nodeId] = { ...node, accessTurns: [...node.accessTurns, currentTurn] };
  }

  return { graph: { nodes, edges, adjacency }, newNodeIds, localIdToRealId };
}

function getGlobalTopActivation(
  graph: MemoryGraph,
  currentTurn: number,
  minActivation: number,
  limit: number,
): string[] {
  return Object.values(graph.nodes)
    .map((node) => ({ id: node.id, activation: computeActivation(node, currentTurn) }))
    .filter((entry) => entry.activation >= minActivation)
    .sort((a, b) => b.activation - a.activation)
    .slice(0, limit)
    .map((entry) => entry.id);
}

const SPREADING_MAX_HOPS = 2;
const SPREADING_HOP_DECAY = 0.5;

/**
 * 이번 턴과 관련된 기억을 고른다. `seedNodeIds`(이번 턴에 새로 생겼거나 참조된 노드)에서
 * 시작해 그래프를 얕게 순회하며, 홉이 멀어질수록 가중치가 감쇠하는 방식으로 연상을 시뮬레이션한다
 * — "지금 그 사람 얘기가 나오니 그때 그 일이 떠올랐다" 같은 맥락 기반 회상.
 * 시드가 없으면(예: 첫 턴) 맥락이 없으므로 전역 활성화 상위로 대체한다.
 *
 * `minActivation`을 낮추면(EFFORTFUL_RECALL_THRESHOLD) 평소엔 안 떠오르는 흐린 기억까지
 * 의도적 회상 행동에서 끌어올 수 있다.
 */
export function getRecalledMemoryNodeIds(
  graph: MemoryGraph,
  currentTurn: number,
  seedNodeIds: string[],
  minActivation: number = AMBIENT_RECALL_THRESHOLD,
  limit = 12,
): string[] {
  if (seedNodeIds.length === 0) {
    return getGlobalTopActivation(graph, currentTurn, minActivation, limit);
  }

  const scores = new Map<string, number>();

  const visit = (nodeId: string, hops: number, pathWeight: number) => {
    const node = graph.nodes[nodeId];
    if (!node) return;

    const activation = computeActivation(graph.nodes[nodeId], currentTurn);
    if (activation >= minActivation) {
      const contribution = pathWeight * Math.max(activation, 0.1);
      scores.set(nodeId, Math.max(scores.get(nodeId) ?? -Infinity, contribution));
    }

    if (hops >= SPREADING_MAX_HOPS) return;
    for (const edgeId of graph.adjacency[nodeId] ?? []) {
      const edge = graph.edges[edgeId];
      if (!edge) continue;
      const nextNodeId = edge.from === nodeId ? edge.to : edge.from;
      visit(nextNodeId, hops + 1, pathWeight * SPREADING_HOP_DECAY * edge.weight);
    }
  };

  for (const seedId of seedNodeIds) {
    visit(seedId, 0, 1);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

/**
 * 이번 턴 델타에 참여자로 태그된 NPC id들을 모은다 (신규 노드의 participantNpcIds +
 * accessedNodeIds가 가리키는 기존 노드의 participantNpcIds). NPC 중요도 갱신 여부를
 * 판단하는 입력으로 쓰인다.
 */
export function getParticipantNpcIdsInDelta(
  delta: RouterOutput['memoryGraphDelta'],
  graphAfterDelta: MemoryGraph,
): string[] {
  const ids = new Set<string>();
  for (const node of delta.newNodes) {
    for (const npcId of node.participantNpcIds ?? []) ids.add(npcId);
  }
  for (const nodeId of delta.accessedNodeIds) {
    for (const npcId of graphAfterDelta.nodes[nodeId]?.participantNpcIds ?? []) ids.add(npcId);
  }
  return [...ids];
}

/**
 * 델타를 특정 NPC 시점으로 좁힌다 — 그 NPC가 참여자로 태그된 신규 노드만 남긴다.
 * newEdges/accessedNodeIds는 그대로 넘겨도 된다: applyMemoryGraphDelta가 대상 그래프에
 * 존재하지 않는 참조는 알아서 무시하므로, 이 NPC의 그래프에 없는 노드를 가리키는 엣지/접근은
 * 자연히 드롭된다.
 */
export function filterDeltaForParticipant(
  delta: RouterOutput['memoryGraphDelta'],
  npcId: string,
): RouterOutput['memoryGraphDelta'] {
  return {
    newNodes: delta.newNodes.filter((node) => node.participantNpcIds?.includes(npcId)),
    newEdges: delta.newEdges,
    accessedNodeIds: delta.accessedNodeIds,
  };
}
