import { computeActivation } from './memoryActivation';
import type { MemoryGraph, MemoryNode, Npc, NpcId } from './types';

/**
 * 9단계(1차) — "오래된 기록은 요약으로 풍화". 리포 어디에도 이 개념이 설계된 적이 없어서
 * (탐색 확인 — MemoryNode.content는 생성된 후 단 한 번도 수정되는 곳이 없었다) 이번에 새로
 * 만든다. 진짜 임베딩/LLM 요약이 아니라 값싼 휴리스틱(첫 문장만 남기거나 길이 상한으로
 * 자름)이다 — 6단계 sim/input/similarity.ts와 같은 "지금 당장 돌아가는 자리 표시" 패턴.
 * `weathered` 플래그로 한 번만 적용한다 — 계속 깎이면 결국 아무것도 안 남으므로, "흐려지지만
 * 사라지지 않는다"(memoryActivation.ts의 활성화 공식과 같은 원칙)를 content 자체에도 지킨다.
 */

/** 이보다 활성화가 낮아야(=AMBIENT_RECALL_THRESHOLD보다도 한참 낮음) 풍화 대상. */
const WEATHERING_ACTIVATION_THRESHOLD = -3;
/** 활성화가 낮아도 아직 "최근" 생긴 기억은 풍화하지 않는다 — 순간적으로 안 쓰였다고 바로
 *  흐려지면 이상하다, 진짜 오래돼야 한다. */
const WEATHERING_MIN_AGE_TURNS = 24;
const WEATHERING_MAX_LENGTH = 40;

/** 첫 문장만 남기거나(마침표/느낌표/물음표 기준), 그마저 없으면 길이 상한으로 자른다. */
export function weatherContent(content: string): string {
  const sentenceMatch = content.match(/^[^.!?]*[.!?]/);
  const firstSentence = sentenceMatch?.[0].trim();
  if (firstSentence && firstSentence.length < content.length) return firstSentence;
  if (content.length <= WEATHERING_MAX_LENGTH) return content;
  return `${content.slice(0, WEATHERING_MAX_LENGTH).trimEnd()}…`;
}

function weatherNode(node: MemoryNode, currentTurn: number): MemoryNode {
  if (node.weathered) return node;
  if (currentTurn - node.createdAtTurn < WEATHERING_MIN_AGE_TURNS) return node;
  if (computeActivation(node, currentTurn) >= WEATHERING_ACTIVATION_THRESHOLD) return node;

  return { ...node, content: weatherContent(node.content), weathered: true };
}

export function weatherMemoryGraph(graph: MemoryGraph, currentTurn: number): MemoryGraph {
  let changed = false;
  const nodes: MemoryGraph['nodes'] = {};
  for (const [id, node] of Object.entries(graph.nodes)) {
    const next = weatherNode(node, currentTurn);
    if (next !== node) changed = true;
    nodes[id] = next;
  }
  return changed ? { ...graph, nodes } : graph;
}

/** 공유 그래프 + major NPC 각자의 독립 그래프까지 한 번에 풍화한다 — gameLoop.ts의
 *  finalizeTurn이 매 커밋마다 호출하는 단일 진입점. */
export function weatherAllGraphs(
  memoryGraph: MemoryGraph,
  npcs: Record<NpcId, Npc>,
  currentTurn: number,
): { memoryGraph: MemoryGraph; npcs: Record<NpcId, Npc> } {
  const weatheredMemoryGraph = weatherMemoryGraph(memoryGraph, currentTurn);

  let npcsChanged = false;
  const nextNpcs: Record<NpcId, Npc> = {};
  for (const [id, npc] of Object.entries(npcs)) {
    if (!npc.memoryGraph) {
      nextNpcs[id] = npc;
      continue;
    }
    const weatheredNpcGraph = weatherMemoryGraph(npc.memoryGraph, currentTurn);
    if (weatheredNpcGraph === npc.memoryGraph) {
      nextNpcs[id] = npc;
    } else {
      npcsChanged = true;
      nextNpcs[id] = { ...npc, memoryGraph: weatheredNpcGraph };
    }
  }

  return { memoryGraph: weatheredMemoryGraph, npcs: npcsChanged ? nextNpcs : npcs };
}
