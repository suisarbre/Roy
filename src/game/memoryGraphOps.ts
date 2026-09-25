import { AMBIENT_RECALL_THRESHOLD, computeActivation } from './memoryActivation';
import type { MemoryGraph, RouterOutput } from './types';

/**
 * 라우터가 제안한 그래프 델타(신규 노드/엣지, 접근된 노드)를 기존 그래프에 반영한다.
 * newEdges의 from/to는 기존 노드의 실제 id이거나, 같은 델타의 newNodes[].localId일 수 있다 —
 * 신규 노드에는 아직 실제 id가 없으므로 이번 호출 안에서 즉석으로 매핑해서 해소한다.
 */
export function applyMemoryGraphDelta(
  graph: MemoryGraph,
  delta: RouterOutput['memoryGraphDelta'],
  currentTurn: number,
): MemoryGraph {
  const nodes = { ...graph.nodes };
  const edges = { ...graph.edges };
  const adjacency: Record<string, string[]> = {};
  for (const [nodeId, edgeIds] of Object.entries(graph.adjacency)) {
    adjacency[nodeId] = [...edgeIds];
  }

  const localIdToRealId = new Map<string, string>();
  for (const proposed of delta.newNodes) {
    const id = crypto.randomUUID();
    localIdToRealId.set(proposed.localId, id);
    nodes[id] = {
      id,
      type: proposed.type,
      content: proposed.content,
      createdAtTurn: currentTurn,
      accessTurns: [currentTurn],
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

  return { nodes, edges, adjacency };
}

/**
 * 일반적인(의도적 회상이 아닌) 컨텍스트 구성 시 프롬프트에 포함할 기억 노드를 고른다.
 * 활성화 임계값을 넘는 노드 중 상위 `limit`개.
 */
export function getAmbientlyRecalledNodeIds(graph: MemoryGraph, currentTurn: number, limit = 12): string[] {
  return Object.values(graph.nodes)
    .map((node) => ({ id: node.id, activation: computeActivation(node, currentTurn) }))
    .filter((entry) => entry.activation >= AMBIENT_RECALL_THRESHOLD)
    .sort((a, b) => b.activation - a.activation)
    .slice(0, limit)
    .map((entry) => entry.id);
}
