import { advanceClock } from './clock';
import { getRelevantEraEvents } from './eraEvents';
import type { MainModelClient, RecentLogSummary, RouterModelClient } from './llm/types';
import { AMBIENT_RECALL_THRESHOLD, EFFORTFUL_RECALL_THRESHOLD } from './memoryActivation';
import {
  applyMemoryGraphDelta,
  filterDeltaForParticipant,
  getParticipantNpcIdsInDelta,
  getRecalledMemoriesForNpc,
  getRecalledMemoryNodeIds,
} from './memoryGraphOps';
import {
  applyImportanceDecay,
  createNpcsFromRouterOutput,
  driftNpcRelationship,
  registerNpcAppearance,
  resolveNewNpcReferences,
  shouldEncodeIntoNpcMemory,
} from './npcImportance';
import { applyHiddenStatDrift } from './statDrift';
import { createEmptyMemoryGraph } from './types';
import type {
  EraEventOccurrence,
  GameClock,
  GameState,
  HiddenStats,
  MemoryGraph,
  Npc,
  NpcId,
  PlausibilityJudgment,
  ProposedNpc,
  RouterOutput,
  SceneExchange,
  TurnKind,
  TurnLogEntry,
} from './types';

export interface GameLoopDeps {
  routerModel: RouterModelClient;
  mainModel: MainModelClient;
}

export interface TurnResult {
  state: GameState;
  logEntry: TurnLogEntry;
}

const RECENT_LOG_TAIL_SIZE = 5;
const MAX_SCENE_EXCHANGES = 12;
const MAX_CHAINED_SKIPS = 20;

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

interface DeltaApplicationResult {
  memoryGraph: MemoryGraph;
  npcs: Record<NpcId, Npc>;
  newNodeIds: string[];
  /** 이번에 참여자로 태그된 NPC id — 관계 스탯 드리프트(안 만난 관계만 식음)에도 재사용된다. */
  participantNpcIds: Set<NpcId>;
}

/**
 * runTurn(매크로)과 씬 종료 커밋이 공유하는 부분: 그래프 델타 반영 + NPC 생성/중요도 갱신.
 * 둘 다 "이번에 뭐가 일어났는지"를 결정하는 방식은 다르지만, 그 결과(델타+신규 NPC 제안)를
 * 실제 상태에 반영하는 절차는 완전히 동일하다.
 */
function applyDeltaAndNpcs(
  state: GameState,
  nextTurnIndex: number,
  elapsedMonths: number,
  memoryGraphDelta: RouterOutput['memoryGraphDelta'],
  proposedNpcs: ProposedNpc[],
): DeltaApplicationResult {
  const npcLocalIdToRealId = new Map(proposedNpcs.map((proposed) => [proposed.localId, crypto.randomUUID()]));
  const resolvedDelta = resolveNewNpcReferences(memoryGraphDelta, npcLocalIdToRealId);

  const {
    graph: memoryGraph,
    newNodeIds,
    localIdToRealId: memoryNodeLocalIdToRealId,
  } = applyMemoryGraphDelta(state.memoryGraph, resolvedDelta, nextTurnIndex);

  const newNpcs = createNpcsFromRouterOutput(
    state.npcs,
    proposedNpcs,
    npcLocalIdToRealId,
    memoryNodeLocalIdToRealId,
    nextTurnIndex,
  );

  // 모든 NPC(기존 + 신규)를 한 번씩 갱신한다: 이번에 등장한 참여자는 중요도가 오르고(+확률적으로
  // 자기 그래프에 각인), 참여하지 않은 NPC는 elapsedMonths만큼 중요도가 깎이고(가족 예외)
  // 관계 감정도 식는다(가족도 예외 없음 — 별개의 축).
  const participantNpcIds = new Set(getParticipantNpcIdsInDelta(resolvedDelta, memoryGraph));
  const npcs: Record<NpcId, Npc> = {};
  for (const [npcId, npc] of Object.entries({ ...state.npcs, ...newNpcs })) {
    if (!participantNpcIds.has(npcId)) {
      npcs[npcId] = driftNpcRelationship(applyImportanceDecay(npc, elapsedMonths), elapsedMonths);
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

  return { memoryGraph, npcs, newNodeIds, participantNpcIds };
}

interface FinalizeParams {
  kind: TurnKind;
  playerInput?: string;
  narrative: string;
  plausibilityJudgment?: PlausibilityJudgment;
  death?: { cause: string } | null;
  /** 매크로 턴에서만 채워짐 — 씬 종료 커밋에는 없음 */
  routerOutput?: RouterOutput;
  eraEventOccurrence?: EraEventOccurrence;
}

/**
 * 클록 진행 + 로그 엔트리 생성 + 다음 GameState 조립. activeScene은 커밋 시점에 항상 비운다.
 * observable은 인자로 안 받는다 — 관계 레코드가 Npc로 옮겨간 뒤로는 드리프트가 절대
 * observable을 안 건드리므로(무지가 리스크 원칙), state.observable을 그대로 spread하면 된다.
 */
function finalizeTurn(
  state: GameState,
  nextTurnIndex: number,
  nextClock: GameClock,
  memoryGraph: MemoryGraph,
  npcs: Record<NpcId, Npc>,
  hidden: HiddenStats,
  params: FinalizeParams,
): TurnResult {
  let status: GameState['status'] = state.status;
  let deathInfo: GameState['deathInfo'];
  if (params.death) {
    status = 'dead';
    deathInfo = { cause: params.death.cause, ageAtDeath: nextClock.ageYears };
  }

  const logEntry: TurnLogEntry = {
    turnIndex: nextTurnIndex,
    date: nextClock.date,
    kind: params.kind,
    playerInput: params.playerInput,
    narrative: params.narrative,
    routerOutput: params.routerOutput,
    plausibilityJudgment: params.plausibilityJudgment,
  };

  const nextState: GameState = {
    ...state,
    status,
    clock: nextClock,
    memoryGraph,
    npcs,
    hidden,
    log: [...state.log, logEntry],
    deathInfo: deathInfo ?? state.deathInfo,
    activeScene: undefined,
    eraEventOccurrences: params.eraEventOccurrence
      ? [...state.eraEventOccurrences, params.eraEventOccurrence]
      : state.eraEventOccurrences,
  };

  return { state: nextState, logEntry };
}

/**
 * 한 매크로 턴을 처리한다: 라우터 호출(시대 이벤트 후보 포함) → 그래프/NPC 갱신 →
 * hidden 스탯 드리프트 → (detail이면) 메인 모델 호출 → 상태/로그 갱신. 메인 모델이 씬
 * 진입을 신호하면 activeScene을 세팅하고 반환한다 — 다음 입력부터는 이 함수가 아니라
 * runSceneExchange로 처리해야 한다.
 */
export async function runTurn(state: GameState, playerInput: string | null, deps: GameLoopDeps): Promise<TurnResult> {
  if (state.status === 'dead') {
    throw new Error('게임이 이미 종료된 상태에서는 턴을 진행할 수 없습니다.');
  }
  if (state.activeScene) {
    throw new Error('씬 진행 중에는 runTurn이 아니라 runSceneExchange를 써야 합니다.');
  }

  const nextTurnIndex = state.clock.turnIndex + 1;
  const recentLog = buildRecentLog(state.log);
  const knownNpcNames = Object.values(state.npcs).map((npc) => npc.name);
  const occurredEraEventIds = new Set(state.eraEventOccurrences.map((o) => o.definitionId));
  const relevantEraEvents = getRelevantEraEvents(state.clock.date, state.clock.ageYears, occurredEraEventIds);

  const routerOutput = await deps.routerModel.runRouterTurn({
    clock: state.clock,
    playerInput,
    recentLog,
    knownNpcNames,
    relevantEraEvents,
  });

  const { memoryGraph, npcs, newNodeIds } = applyDeltaAndNpcs(
    state,
    nextTurnIndex,
    routerOutput.elapsedMonths,
    routerOutput.memoryGraphDelta,
    routerOutput.newNpcs,
  );
  const hidden = applyHiddenStatDrift(state.hidden, routerOutput.elapsedMonths, state.clock.lifeStage);
  const nextClock = advanceClock(state.clock, nextTurnIndex, routerOutput.elapsedMonths);

  let narrative: string;
  let plausibilityJudgment: PlausibilityJudgment | undefined;
  let death: { cause: string } | null | undefined;
  let entersScene: { involvedNpcIds: string[] } | null | undefined;

  if (routerOutput.turnType === 'detail' && routerOutput.intent) {
    const isDeliberateRecall = routerOutput.intent.actionType === 'recall';
    const recallThreshold = isDeliberateRecall ? EFFORTFUL_RECALL_THRESHOLD : AMBIENT_RECALL_THRESHOLD;
    const seedNodeIds = [...newNodeIds, ...routerOutput.memoryGraphDelta.accessedNodeIds];
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
    death = response.death;
    entersScene = response.entersScene;
  } else {
    narrative = buildSkipNarrative(routerOutput.elapsedMonths);
    death = routerOutput.suddenDeath;
  }

  // 시대 이벤트는 항상 detail로 제대로 서술돼야 기록한다. 라우터가 skip 턴에 잘못 끼워
  // 넣었거나(모순), 이번 턴에 제시하지도 않은 id를 지어냈거나(환각), 라우터가 계산한
  // elapsedMonths 때문에 실제 도착 날짜가 그 이벤트의 연도 범위를 벗어나면 무시한다.
  const triggeredEraEventDefinition =
    routerOutput.turnType === 'detail' && routerOutput.eraEventTriggered
      ? relevantEraEvents.find((definition) => definition.id === routerOutput.eraEventTriggered)
      : undefined;
  const eraEventOccurrence: EraEventOccurrence | undefined =
    triggeredEraEventDefinition &&
    nextClock.date.year >= triggeredEraEventDefinition.yearRange[0] &&
    nextClock.date.year <= triggeredEraEventDefinition.yearRange[1]
      ? { definitionId: triggeredEraEventDefinition.id, occurredAt: nextClock.date, turnIndex: nextTurnIndex }
      : undefined;

  const result = finalizeTurn(state, nextTurnIndex, nextClock, memoryGraph, npcs, hidden, {
    kind: routerOutput.turnType,
    playerInput: playerInput ?? undefined,
    narrative,
    plausibilityJudgment,
    death,
    routerOutput,
    eraEventOccurrence,
  });

  if (entersScene && result.state.status === 'alive') {
    return {
      ...result,
      state: {
        ...result.state,
        activeScene: {
          id: crypto.randomUUID(),
          involvedNpcIds: entersScene.involvedNpcIds,
          startedAtTurn: nextTurnIndex,
          exchanges: [],
        },
      },
    };
  }

  return result;
}

export interface SceneExchangeResult {
  state: GameState;
  exchange: SceneExchange;
  /** 이번 교환으로 씬이 끝났다면, 매크로 로그/그래프에 커밋된 결과도 같이 온다 */
  concluded?: TurnResult;
}

/**
 * 씬(대화 등) 안에서 플레이어 입력 하나를 처리한다. 매크로 스킵/디테일 판단을 완전히
 * 건너뛰고, 라우터가 "사소함/중요함"만 판단한다: 사소하면 라우터가 직접 짧은 대사를 생성하고
 * (메인 모델 호출 없음), 중요하면 메인 모델로 넘긴다. 씬은 모델이 종료를 신호하거나
 * 교환 횟수가 캡(MAX_SCENE_EXCHANGES)을 넘으면 끝나며, 그 시점에 전체 교환을 한 번
 * 요약해서(summarizeScene) 매크로 로그/그래프에 커밋한다 — 대사 한 줄 한 줄이 아니라.
 */
export async function runSceneExchange(state: GameState, playerInput: string, deps: GameLoopDeps): Promise<SceneExchangeResult> {
  if (state.status === 'dead') {
    throw new Error('게임이 이미 종료된 상태에서는 턴을 진행할 수 없습니다.');
  }
  const scene = state.activeScene;
  if (!scene) {
    throw new Error('진행 중인 씬이 없습니다 — runTurn을 써야 합니다.');
  }

  const involvedNpcNames = scene.involvedNpcIds
    .map((id) => state.npcs[id]?.name)
    .filter((name): name is string => Boolean(name));

  const classification = await deps.routerModel.classifySceneExchange({
    clock: state.clock,
    involvedNpcNames,
    exchangesSoFar: scene.exchanges,
    playerInput,
  });

  let reply: string;
  let sceneEnded = classification.sceneEnded;
  let plausibilityJudgment: PlausibilityJudgment | undefined;
  let death: { cause: string } | null | undefined;

  if (classification.significance === 'trivial') {
    reply = classification.trivialReply ?? '...';
  } else {
    const seedNodeIds = scene.involvedNpcIds
      .map((id) => state.npcs[id]?.memoryNodeId)
      .filter((id): id is string => Boolean(id));
    const recalledMemories = scene.involvedNpcIds.flatMap((npcId) => {
      const npc = state.npcs[npcId];
      if (!npc) return [];
      return getRecalledMemoriesForNpc(state.memoryGraph, npc, state.clock.turnIndex, seedNodeIds);
    });
    const dedupedMemories = [...new Map(recalledMemories.map((memory) => [memory.id, memory])).values()];

    const response = await deps.mainModel.runSceneTurn({
      clock: state.clock,
      involvedNpcNames,
      exchangesSoFar: scene.exchanges,
      playerInput,
      recalledMemories: dedupedMemories,
    });

    reply = response.reply;
    plausibilityJudgment = response.plausibilityJudgment;
    sceneEnded = sceneEnded || response.sceneEnded;
    death = response.death;
  }

  const exchange: SceneExchange = {
    index: scene.exchanges.length,
    playerInput,
    reply,
    wasSignificant: classification.significance === 'significant',
  };
  const updatedExchanges = [...scene.exchanges, exchange];
  const hitCap = updatedExchanges.length >= MAX_SCENE_EXCHANGES;

  if (!sceneEnded && !hitCap && !death) {
    const nextState: GameState = { ...state, activeScene: { ...scene, exchanges: updatedExchanges } };
    return { state: nextState, exchange };
  }

  const summary = await deps.routerModel.summarizeScene({
    clock: state.clock,
    involvedNpcNames,
    exchanges: updatedExchanges,
  });

  const nextTurnIndex = state.clock.turnIndex + 1;
  const { memoryGraph, npcs } = applyDeltaAndNpcs(
    state,
    nextTurnIndex,
    summary.elapsedMonths,
    summary.memoryGraphDelta,
    summary.newNpcs,
  );
  const hidden = applyHiddenStatDrift(state.hidden, summary.elapsedMonths, state.clock.lifeStage);
  const nextClock = advanceClock(state.clock, nextTurnIndex, summary.elapsedMonths);

  const concluded = finalizeTurn(state, nextTurnIndex, nextClock, memoryGraph, npcs, hidden, {
    kind: 'detail',
    narrative: summary.narrative,
    plausibilityJudgment,
    death,
  });

  return { state: concluded.state, exchange, concluded };
}

export interface AutoAdvanceResult {
  state: GameState;
  /** 이번 호출에서 체이닝된 모든 턴 결과 — 대개 skip 여러 개 뒤에 detail 하나(또는 없음). */
  turns: TurnResult[];
}

/**
 * 플레이어 입력 하나를 처리한 뒤, "의미있는 선택이 필요한 시점"까지 스킵 턴을 자동으로
 * 이어붙인다. `initialPlayerInput`은 첫 번째 호출에만 쓰이고(플레이어의 실제 행동), 이후
 * 반복은 전부 playerInput=null로 진행된다. 즉 플레이어 행동 자체가 스킵으로 판정되면
 * (예: "그냥 하루를 보낸다") 그 즉시 다음 detail 턴까지 자동으로 흘러간다.
 *
 * detail 턴(플레이어 행동이 detail로 판정됐든, 자동 진행 중 환경이 강제로 만든 것이든)에
 * 도달하거나, 사망하거나, 씬에 진입하면 멈춘다 — 전부 "이제 플레이어 입력이 필요한 시점"이다.
 * 라우터가 계속 skip만 반환해도 MAX_CHAINED_SKIPS에서 강제로 멈춰서 제어권을 돌려준다
 * (서사를 억지로 만들어내지 않고, 그냥 거기까지 보여주고 플레이어가 계속할지 정하게 한다).
 */
export async function advanceUntilInputNeeded(
  state: GameState,
  deps: GameLoopDeps,
  initialPlayerInput: string | null = null,
): Promise<AutoAdvanceResult> {
  const turns: TurnResult[] = [];
  let current = state;
  let playerInput = initialPlayerInput;
  let chainedSkips = 0;

  while (current.status !== 'dead' && !current.activeScene) {
    const result = await runTurn(current, playerInput, deps);
    playerInput = null;
    turns.push(result);
    current = result.state;

    if (current.status === 'dead' || current.activeScene || result.logEntry.kind === 'detail') {
      break;
    }

    chainedSkips++;
    if (chainedSkips >= MAX_CHAINED_SKIPS) break;
  }

  return { state: current, turns };
}
