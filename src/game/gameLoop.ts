import { advanceClock } from './clock';
import type { MainModelClient, RecentLogSummary, RouterModelClient } from './llm/types';
import { AMBIENT_RECALL_THRESHOLD, EFFORTFUL_RECALL_THRESHOLD } from './memoryActivation';
import {
  applyMemoryGraphDelta,
  filterDeltaForParticipant,
  getParticipantNpcIdsInDelta,
  getRecalledMemoryNodeIds,
} from './memoryGraphOps';
import {
  applyImportanceDecay,
  createNpcsFromRouterOutput,
  registerNpcAppearance,
  resolveNewNpcReferences,
  shouldEncodeIntoNpcMemory,
} from './npcImportance';
import { createEmptyMemoryGraph } from './types';
import type { GameState, Npc, NpcId, TurnLogEntry } from './types';

export interface GameLoopDeps {
  routerModel: RouterModelClient;
  mainModel: MainModelClient;
}

export interface TurnResult {
  state: GameState;
  logEntry: TurnLogEntry;
}

const RECENT_LOG_TAIL_SIZE = 5;

function buildRecentLog(log: TurnLogEntry[]): RecentLogSummary[] {
  return log.slice(-RECENT_LOG_TAIL_SIZE).map((entry) => ({
    kind: entry.kind,
    narrative: entry.narrative,
    playerInput: entry.playerInput,
  }));
}

function buildSkipNarrative(elapsedMonths: number): string {
  // TODO: 지금은 템플릿 문구. 나중에 라우터가 맥락(예: contextTags)을 반영한 한 줄 요약을
  // 직접 생성하도록 바꿀 수 있음 — 우선은 문서 예시("그렇게 3개월이 별일 없이 흘렀다")만 구현.
  if (elapsedMonths <= 0) return '별다른 사건 없이 시간이 흘렀다.';
  if (elapsedMonths === 1) return '그렇게 한 달이 별일 없이 흘렀다.';
  return `그렇게 ${elapsedMonths}개월이 별일 없이 흘렀다.`;
}

/**
 * 한 턴을 처리한다: 라우터 호출 → 그래프 갱신 → (detail이면) 메인 모델 호출 → 상태/로그 갱신.
 *
 * 아직 구현하지 않은 것 (설계 미확정이라 의도적으로 비워둠):
 * - 시대 강제 이벤트 체크 (이벤트 풀 내용 자체가 문서상 미정)
 * - observable/hidden 스탯 드리프트 (밸런스 수치가 아직 없어서, 지금은 상태를 그대로 통과시킴)
 */
export async function runTurn(state: GameState, playerInput: string | null, deps: GameLoopDeps): Promise<TurnResult> {
  if (state.status === 'dead') {
    throw new Error('게임이 이미 종료된 상태에서는 턴을 진행할 수 없습니다.');
  }

  const nextTurnIndex = state.clock.turnIndex + 1;
  const recentLog = buildRecentLog(state.log);
  const knownNpcNames = Object.values(state.npcs).map((npc) => npc.name);

  const routerOutput = await deps.routerModel.runRouterTurn({
    clock: state.clock,
    playerInput,
    recentLog,
    knownNpcNames,
  });

  // 신규 NPC는 이 시점엔 아직 실제 NpcId가 없다 — 먼저 발급하고, 델타 안의 참조(localId)를
  // 실제 id로 치환한 다음에 그래프에 반영한다. applyMemoryGraphDelta는 NPC 생성을 몰라도 된다.
  const npcLocalIdToRealId = new Map(routerOutput.newNpcs.map((proposed) => [proposed.localId, crypto.randomUUID()]));
  const resolvedDelta = resolveNewNpcReferences(routerOutput.memoryGraphDelta, npcLocalIdToRealId);

  const {
    graph: memoryGraph,
    newNodeIds,
    localIdToRealId: memoryNodeLocalIdToRealId,
  } = applyMemoryGraphDelta(state.memoryGraph, resolvedDelta, nextTurnIndex);
  const nextClock = advanceClock(state.clock, nextTurnIndex, routerOutput.elapsedMonths);

  const newNpcs = createNpcsFromRouterOutput(
    state.npcs,
    routerOutput.newNpcs,
    npcLocalIdToRealId,
    memoryNodeLocalIdToRealId,
    nextTurnIndex,
  );

  // 모든 NPC(기존 + 신규)를 한 번씩 갱신한다: 이번 턴 참여자는 중요도가 오르고(+확률적으로
  // 자기 그래프에 각인), 참여하지 않은 가족 아닌 NPC는 elapsedMonths만큼 중요도가 깎여
  // 임계값 아래로 내려가면 강등된다. 스케일이 작아서(수십 명 x 수백 턴) 매턴 전수 순회해도
  // 비용 문제 없다.
  const participantNpcIds = new Set(getParticipantNpcIdsInDelta(resolvedDelta, memoryGraph));
  const npcs: Record<NpcId, Npc> = {};
  for (const [npcId, npc] of Object.entries({ ...state.npcs, ...newNpcs })) {
    if (!participantNpcIds.has(npcId)) {
      npcs[npcId] = applyImportanceDecay(npc, routerOutput.elapsedMonths);
      continue;
    }

    let updatedNpc = registerNpcAppearance(npc, memoryGraph);
    if (shouldEncodeIntoNpcMemory(updatedNpc)) {
      const npcDelta = filterDeltaForParticipant(resolvedDelta, npcId);
      const { graph: npcMemoryGraph } = applyMemoryGraphDelta(
        updatedNpc.memoryGraph ?? createEmptyMemoryGraph(),
        npcDelta,
        nextTurnIndex,
      );
      updatedNpc = { ...updatedNpc, memoryGraph: npcMemoryGraph };
    }
    npcs[npcId] = updatedNpc;
  }

  let narrative: string;
  let plausibilityJudgment: TurnLogEntry['plausibilityJudgment'];
  let status: GameState['status'] = state.status;
  let deathInfo: GameState['deathInfo'];

  if (routerOutput.turnType === 'detail' && routerOutput.intent) {
    const isDeliberateRecall = routerOutput.intent.actionType === 'recall';
    const recallThreshold = isDeliberateRecall ? EFFORTFUL_RECALL_THRESHOLD : AMBIENT_RECALL_THRESHOLD;
    const seedNodeIds = [...newNodeIds, ...resolvedDelta.accessedNodeIds];
    const recalledMemoryNodeIds = getRecalledMemoryNodeIds(memoryGraph, nextTurnIndex, seedNodeIds, recallThreshold);
    const recalledMemories = recalledMemoryNodeIds
      .map((id) => memoryGraph.nodes[id])
      .filter((node) => node !== undefined)
      .map((node) => ({ id: node.id, type: node.type, content: node.content }));

    const response = await deps.mainModel.runDetailTurn({
      clock: nextClock,
      observable: state.observable,
      intent: routerOutput.intent,
      recentLog,
      recalledMemories,
    });

    narrative = response.narrative;
    plausibilityJudgment = response.plausibilityJudgment;

    if (response.death) {
      status = 'dead';
      deathInfo = { cause: response.death.cause, ageAtDeath: nextClock.ageYears };
    }
  } else {
    narrative = buildSkipNarrative(routerOutput.elapsedMonths);

    if (routerOutput.suddenDeath) {
      status = 'dead';
      deathInfo = { cause: routerOutput.suddenDeath.cause, ageAtDeath: nextClock.ageYears };
    }
  }

  const logEntry: TurnLogEntry = {
    turnIndex: nextTurnIndex,
    date: nextClock.date,
    kind: routerOutput.turnType,
    playerInput: playerInput ?? undefined,
    narrative,
    routerOutput,
    plausibilityJudgment,
  };

  const nextState: GameState = {
    ...state,
    status,
    clock: nextClock,
    memoryGraph,
    npcs,
    log: [...state.log, logEntry],
    deathInfo: deathInfo ?? state.deathInfo,
  };

  return { state: nextState, logEntry };
}
