import { advanceClock } from './clock';
import { getOpenEraEventCandidates, monthsRemainingInEraEventWindow, rollEraEventTrigger } from './eraEvents';
import { getSkipNarrative, type Language } from '../i18n';
import type { GameModelClient, RecentLogSummary, TurnResponse } from './llm/types';
import { EFFORTFUL_RECALL_THRESHOLD } from './memoryActivation';
import { extractMemoryUpdate } from './memoryExtraction';
import {
  applyMemoryGraphDelta,
  filterDeltaForParticipant,
  getParticipantNpcIdsInDelta,
  getRecalledMemoriesForNpc,
  getRecalledMemoryNodeIds,
} from './memoryGraphOps';
import {
  applyImportanceDecay,
  createNpcsFromProposals,
  driftNpcRelationship,
  registerNpcAppearance,
  resolveNewNpcReferences,
  shouldEncodeIntoNpcMemory,
} from './npcImportance';
import { applyHiddenStatDrift } from './statDrift';
import { applyOutcomeImpact } from './statImpact';
import { pickRandomSuddenDeathCause } from './textTemplates';
import { createEmptyMemoryGraph } from './types';
import type {
  EraEventDefinition,
  EraEventOccurrence,
  GameClock,
  GameState,
  HiddenStats,
  MemoryGraph,
  MemoryGraphDelta,
  Npc,
  NpcId,
  ObservableStats,
  PlausibilityJudgment,
  ProposedNpc,
  RecalledMemory,
  SceneExchange,
  TurnKind,
  TurnLogEntry,
} from './types';

export interface GameLoopDeps {
  model: GameModelClient;
  /** 스킵 서사 템플릿, 급사 원인 등 코드가 직접 만들어내는 텍스트의 언어. */
  language: Language;
}

export interface TurnResult {
  state: GameState;
  logEntry: TurnLogEntry;
}

const RECENT_LOG_TAIL_SIZE = 5;
const MAX_SCENE_EXCHANGES = 12;
/** 한 번의 "계속하기" 클릭이 체이닝할 수 있는 최대 스킵 사이클 수. 대부분의 사이클이 이제
 *  모델 호출 없이(순수 코드) 끝나므로 예전보다 훨씬 싸지만, 그래도 한 클릭이 인생을 통째로
 *  건너뛰지 않도록 상한은 유지한다. */
const MAX_CHAINED_SKIPS = 10;
const MIN_SKIP_STRETCH_MONTHS = 6;
const MAX_SKIP_STRETCH_MONTHS = 18;
/** 평범한 스킵 사이클(6-18개월) 하나당 "뭔가 돌발적으로 일어날" 확률 — 걸리면 그 순간만
 *  모델을 불러 즉석 묘사시킨다(라우터 제거 + 모델 호출 최소화, 사용자 결정). */
const SURPRISE_EVENT_CHANCE = 0.12;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildRecentLog(log: TurnLogEntry[]): RecentLogSummary[] {
  return log.slice(-RECENT_LOG_TAIL_SIZE).map((entry) => ({
    kind: entry.kind,
    narrative: entry.narrative,
    playerInput: entry.playerInput,
  }));
}

/**
 * 급사 확률(스킵 사이클 하나당). 나이가 들수록, 숨겨진 만성질환/스트레스가 쌓일수록 올라간다
 * — "확인 안 하면 위험도 모른다"는 문서 원칙을 사망 위험에도 반영한 것. statImpact.ts의 등급
 * 테이블과 같은 성격의 조정 가능한 임시 상수.
 */
function computeSuddenDeathChance(ageYears: number, hidden: HiddenStats): number {
  const ageFactor = ageYears < 40 ? 0.0004 : ageYears < 60 ? 0.0015 : ageYears < 75 ? 0.006 : 0.02;
  const worstChronicSeverity = hidden.health.chronicSeeds.reduce((max, seed) => Math.max(max, seed.severity), 0);
  const healthFactor = 1 + worstChronicSeverity / 100;
  const stressFactor = 1 + hidden.mentalHealth.burnoutLevel / 200;
  return ageFactor * healthFactor * stressFactor;
}

/** 조용히 흘러간 시간 동안 모든 NPC를(참여자 없이) 중요도 감쇠+관계 냉각시킨다. */
function decayAllNpcs(npcs: Record<NpcId, Npc>, elapsedMonths: number): Record<NpcId, Npc> {
  if (elapsedMonths <= 0) return npcs;
  const next: Record<NpcId, Npc> = {};
  for (const [id, npc] of Object.entries(npcs)) {
    next[id] = driftNpcRelationship(applyImportanceDecay(npc, elapsedMonths), elapsedMonths);
  }
  return next;
}

/** 그래프 델타 반영 + NPC 생성/중요도 갱신. 참여하지 않은 NPC의 감쇠는 이미 호출부에서
 *  (조용한 시간 동안) 끝냈으므로 elapsedMonths=0으로만 취급한다 — 여기선 참여자 등록만. */
interface DeltaApplicationResult {
  memoryGraph: MemoryGraph;
  npcs: Record<NpcId, Npc>;
  participantNpcIds: Set<NpcId>;
  resolvedDelta: MemoryGraphDelta;
}

function applyDeltaAndNpcs(
  memoryGraph: MemoryGraph,
  npcs: Record<NpcId, Npc>,
  nextTurnIndex: number,
  delta: MemoryGraphDelta,
  proposedNpcs: ProposedNpc[],
): DeltaApplicationResult {
  const npcLocalIdToRealId = new Map(proposedNpcs.map((proposed) => [proposed.localId, crypto.randomUUID()]));
  const resolvedDelta = resolveNewNpcReferences(delta, npcLocalIdToRealId);

  const {
    graph: nextMemoryGraph,
    localIdToRealId: memoryNodeLocalIdToRealId,
  } = applyMemoryGraphDelta(memoryGraph, resolvedDelta, nextTurnIndex);

  const newNpcs = createNpcsFromProposals(npcs, proposedNpcs, npcLocalIdToRealId, memoryNodeLocalIdToRealId, nextTurnIndex);

  const participantNpcIds = new Set(getParticipantNpcIdsInDelta(resolvedDelta, nextMemoryGraph));
  const nextNpcs: Record<NpcId, Npc> = {};
  for (const [npcId, npc] of Object.entries({ ...npcs, ...newNpcs })) {
    nextNpcs[npcId] = participantNpcIds.has(npcId) ? registerNpcAppearance(npc, nextMemoryGraph) : npc;
  }

  return { memoryGraph: nextMemoryGraph, npcs: nextNpcs, participantNpcIds, resolvedDelta };
}

/**
 * 이번 사건이 참여자로 태그된 major NPC 각자의 독립 그래프에도 각인될지를 확률적으로 정하고,
 * 각인되면 그 NPC 시점으로 필터링된 델타를 그의 그래프에 반영한다.
 */
function encodeIntoParticipantGraphs(
  npcs: Record<NpcId, Npc>,
  resolvedDelta: MemoryGraphDelta,
  participantNpcIds: ReadonlySet<NpcId>,
  nextTurnIndex: number,
  wasSignificantEvent: boolean,
): Record<NpcId, Npc> {
  const updated = { ...npcs };
  for (const npcId of participantNpcIds) {
    const npc = updated[npcId];
    if (!npc || !shouldEncodeIntoNpcMemory(npc, wasSignificantEvent)) continue;

    const npcDelta = filterDeltaForParticipant(resolvedDelta, npcId);
    const { graph: npcMemoryGraph } = applyMemoryGraphDelta(npc.memoryGraph ?? createEmptyMemoryGraph(), npcDelta, nextTurnIndex);
    updated[npcId] = { ...npc, memoryGraph: npcMemoryGraph };
  }
  return updated;
}

interface FinalizeParams {
  kind: TurnKind;
  playerInput?: string;
  narrative: string;
  plausibilityJudgments: PlausibilityJudgment[];
  death?: { cause: string } | null;
  eraEventOccurrence?: EraEventOccurrence;
}

/**
 * 클록 진행 + 로그 엔트리 생성 + 다음 GameState 조립. activeScene은 커밋 시점에 항상 비운다.
 */
function finalizeTurn(
  state: GameState,
  nextTurnIndex: number,
  nextClock: GameClock,
  memoryGraph: MemoryGraph,
  npcs: Record<NpcId, Npc>,
  hidden: HiddenStats,
  observable: ObservableStats,
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
    plausibilityJudgments: params.plausibilityJudgments,
  };

  const nextState: GameState = {
    ...state,
    status,
    clock: nextClock,
    memoryGraph,
    npcs,
    hidden,
    observable,
    log: [...state.log, logEntry],
    deathInfo: deathInfo ?? state.deathInfo,
    activeScene: undefined,
    eraEventOccurrences: params.eraEventOccurrence
      ? [...state.eraEventOccurrences, params.eraEventOccurrence]
      : state.eraEventOccurrences,
  };

  return { state: nextState, logEntry };
}

/** 씬 진입이 신호되면 activeScene을 세팅한다. */
function attachSceneIfNeeded(
  result: TurnResult,
  entersScene: { involvedNpcIds: string[] } | null | undefined,
  nextTurnIndex: number,
): TurnResult {
  if (!entersScene || result.state.status !== 'alive') return result;
  return {
    ...result,
    state: {
      ...result.state,
      activeScene: {
        id: crypto.randomUUID(),
        involvedNpcIds: entersScene.involvedNpcIds,
        startedAtTurn: nextTurnIndex,
        exchanges: [],
        judgments: [],
      },
    },
  };
}

/**
 * 모델 응답 하나를 실제 GameState 변화로 커밋한다 — 그래프 델타/NPC 갱신, outcomeImpact 반영,
 * NPC 자기 그래프 각인, 로그 엔트리 생성까지. runPlayerAction/runForcedEvent가 공유한다.
 */
function commitTurnResponse(
  baseState: GameState,
  nextTurnIndex: number,
  nextClock: GameClock,
  memoryGraph: MemoryGraph,
  npcs: Record<NpcId, Npc>,
  hidden: HiddenStats,
  observable: ObservableStats,
  playerInput: string | undefined,
  response: TurnResponse,
  language: Language,
  recalledMemories: RecalledMemory[],
  eraEventOccurrence?: EraEventOccurrence,
): TurnResult {
  const wasSignificantEvent = response.plausibilityJudgment.verdict !== 'neutral' || response.outcomeImpact !== undefined;
  const shouldRecordEvent = wasSignificantEvent || Boolean(response.death) || Boolean(response.entersScene);
  const { delta, proposedNpcs } = extractMemoryUpdate({
    narrative: response.narrative,
    npcs,
    recalledMemories,
    shouldRecordEvent,
  });

  const {
    memoryGraph: nextMemoryGraph,
    npcs: npcsAfterDelta,
    participantNpcIds,
    resolvedDelta,
  } = applyDeltaAndNpcs(memoryGraph, npcs, nextTurnIndex, delta, proposedNpcs);

  const {
    hidden: nextHidden,
    observable: nextObservable,
    npcs: npcsAfterImpact,
  } = applyOutcomeImpact(hidden, observable, npcsAfterDelta, response.outcomeImpact, response.newVisibleSymptom, language);

  const npcsFinal = encodeIntoParticipantGraphs(npcsAfterImpact, resolvedDelta, participantNpcIds, nextTurnIndex, wasSignificantEvent);

  return finalizeTurn(baseState, nextTurnIndex, nextClock, nextMemoryGraph, npcsFinal, nextHidden, nextObservable, {
    kind: 'detail',
    playerInput,
    narrative: response.narrative,
    plausibilityJudgments: [response.plausibilityJudgment],
    death: response.death,
    eraEventOccurrence,
  });
}

/** 그래프 전체가 아니라 활성화 상위(전역 top-activation)만 회수한다 — 이번 턴이 정확히 뭘
 *  건드릴지는 모델 호출 전에는 알 수 없으므로(추출 자체가 같은 호출에서 일어남), 컨텍스트
 *  시드 없이 "요즘 자주/최근 떠오르는 기억"으로 대체한다. */
function recallMemories(graph: MemoryGraph, turnIndex: number): RecalledMemory[] {
  const ids = getRecalledMemoryNodeIds(graph, turnIndex, [], EFFORTFUL_RECALL_THRESHOLD);
  return ids
    .map((id) => graph.nodes[id])
    .filter((node) => node !== undefined)
    .map((node) => ({ id: node.id, type: node.type, content: node.content }));
}

/** 플레이어가 직접 입력한 행동. 항상 모델 호출 1번으로 끝나고(체이닝 없음), 결과가 무엇이든
 *  즉시 제어권을 플레이어에게 돌려준다. */
async function runPlayerAction(state: GameState, playerInput: string, deps: GameLoopDeps): Promise<TurnResult> {
  const nextTurnIndex = state.clock.turnIndex + 1;
  const nextClock = advanceClock(state.clock, nextTurnIndex, 0);
  const recentLog = buildRecentLog(state.log);
  const knownNpcNames = Object.values(state.npcs).map((npc) => npc.name);
  const recalledMemories = recallMemories(state.memoryGraph, state.clock.turnIndex);

  const response = await deps.model.runTurn({
    clock: nextClock,
    observable: state.observable,
    trigger: { kind: 'playerAction', playerInput },
    recentLog,
    recalledMemories,
    knownNpcNames,
  });

  const result = commitTurnResponse(
    state,
    nextTurnIndex,
    nextClock,
    state.memoryGraph,
    state.npcs,
    state.hidden,
    state.observable,
    playerInput,
    response,
    deps.language,
    recalledMemories,
  );
  return attachSceneIfNeeded(result, response.entersScene, nextTurnIndex);
}

type ForcedTrigger = { kind: 'eraEvent'; definition: EraEventDefinition } | { kind: 'unpromptedEvent' };

/**
 * 코드가 이미 "지금이 그 순간"이라고 정한 시대 이벤트, 또는 낮은 확률로 뽑힌 돌발 사건.
 * monthsUntil만큼은 조용히 흘러간 뒤(그동안 NPC 감쇠/hidden 드리프트만 적용) 이 순간을
 * 모델이 서술한다.
 */
async function runForcedEvent(state: GameState, monthsUntil: number, trigger: ForcedTrigger, deps: GameLoopDeps): Promise<TurnResult> {
  const nextTurnIndex = state.clock.turnIndex + 1;
  const nextClock = advanceClock(state.clock, nextTurnIndex, monthsUntil);
  const hiddenAfterQuietTime = applyHiddenStatDrift(state.hidden, monthsUntil, state.clock.lifeStage);
  const npcsAfterQuietTime = decayAllNpcs(state.npcs, monthsUntil);

  const recentLog = buildRecentLog(state.log);
  const knownNpcNames = Object.values(state.npcs).map((npc) => npc.name);
  const recalledMemories = recallMemories(state.memoryGraph, state.clock.turnIndex);

  const response = await deps.model.runTurn({
    clock: nextClock,
    observable: state.observable,
    trigger,
    recentLog,
    recalledMemories,
    knownNpcNames,
  });

  const eraEventOccurrence: EraEventOccurrence | undefined =
    trigger.kind === 'eraEvent' ? { definitionId: trigger.definition.id, occurredAt: nextClock.date, turnIndex: nextTurnIndex } : undefined;

  const result = commitTurnResponse(
    state,
    nextTurnIndex,
    nextClock,
    state.memoryGraph,
    npcsAfterQuietTime,
    hiddenAfterQuietTime,
    state.observable,
    undefined,
    response,
    deps.language,
    recalledMemories,
    eraEventOccurrence,
  );
  return attachSceneIfNeeded(result, response.entersScene, nextTurnIndex);
}

/** 모델 호출 없는 평범한 시간 경과 — 클록 전진 + 드리프트 + 템플릿 서사. */
function runPureSkip(state: GameState, months: number, language: Language): TurnResult {
  const nextTurnIndex = state.clock.turnIndex + 1;
  const nextClock = advanceClock(state.clock, nextTurnIndex, months);
  const hidden = applyHiddenStatDrift(state.hidden, months, state.clock.lifeStage);
  const npcs = decayAllNpcs(state.npcs, months);

  return finalizeTurn(state, nextTurnIndex, nextClock, state.memoryGraph, npcs, hidden, state.observable, {
    kind: 'skip',
    narrative: getSkipNarrative(months, language),
    plausibilityJudgments: [],
  });
}

/** 모델 호출 없는 급사 — 코드가 원인을 템플릿에서 뽑는다. 문서 원칙("사인+나이만, 부연설명
 *  없음")상 이 편이 LLM이 장황하게 서술하는 것보다 오히려 스펙에 맞는다. */
function runSuddenDeath(state: GameState, monthsUntil: number, cause: string, language: Language): TurnResult {
  const nextTurnIndex = state.clock.turnIndex + 1;
  const nextClock = advanceClock(state.clock, nextTurnIndex, monthsUntil);
  const hidden = applyHiddenStatDrift(state.hidden, monthsUntil, state.clock.lifeStage);
  const npcs = decayAllNpcs(state.npcs, monthsUntil);

  return finalizeTurn(state, nextTurnIndex, nextClock, state.memoryGraph, npcs, hidden, state.observable, {
    kind: 'skip',
    narrative: getSkipNarrative(monthsUntil, language),
    plausibilityJudgments: [],
    death: { cause },
  });
}

type SkipDecision =
  | { type: 'pureSkip'; months: number }
  | { type: 'suddenDeath'; monthsUntil: number; cause: string }
  | { type: 'eraEvent'; monthsUntil: number; definition: EraEventDefinition }
  | { type: 'unpromptedEvent'; monthsUntil: number };

/**
 * "계속하기"(빈 입력) 한 사이클이 뭘로 이어질지 코드가 직접 굴린다 — 예전엔 이 판단 자체가
 * 매번 라우터 호출이었다. 순서: 자격 구간이 열린 시대 이벤트 확인(창이 닫혀갈수록 확률
 * 상승) → 낮은 확률의 돌발 사건 → 나이/건강 기반 급사 확률 → 셋 다 아니면 순수 스킵.
 */
function decideSkipStretch(state: GameState, language: Language): SkipDecision {
  const stretchMonths = randomInt(MIN_SKIP_STRETCH_MONTHS, MAX_SKIP_STRETCH_MONTHS);
  const occurredEraEventIds = new Set(state.eraEventOccurrences.map((o) => o.definitionId));
  const candidates = getOpenEraEventCandidates(state.clock.date, state.clock.ageYears, occurredEraEventIds);

  for (const definition of candidates) {
    const remaining = monthsRemainingInEraEventWindow(state.clock.date, state.clock.ageYears, definition);
    if (rollEraEventTrigger(remaining)) {
      const cap = Math.max(0, Math.min(stretchMonths, remaining));
      return { type: 'eraEvent', definition, monthsUntil: randomInt(0, cap) };
    }
  }

  if (Math.random() < SURPRISE_EVENT_CHANCE) {
    return { type: 'unpromptedEvent', monthsUntil: randomInt(0, stretchMonths) };
  }

  const deathChance = computeSuddenDeathChance(state.clock.ageYears, state.hidden);
  if (Math.random() < deathChance) {
    return { type: 'suddenDeath', monthsUntil: randomInt(0, stretchMonths), cause: pickRandomSuddenDeathCause(language) };
  }

  return { type: 'pureSkip', months: stretchMonths };
}

export interface SceneExchangeResult {
  state: GameState;
  exchange: SceneExchange;
  /** 이번 교환으로 씬이 끝났다면, 매크로 로그/그래프에 커밋된 결과도 같이 온다 */
  concluded?: TurnResult;
}

/**
 * 씬(대화 등) 안에서 플레이어 입력 하나를 처리한다. 라우터가 없으므로 분류 단계 없이 매
 * 교환마다 곧장 모델을 불러 대사+판단을 받는다. 씬은 모델이 종료를 신호하거나 교환 횟수가
 * 캡(MAX_SCENE_EXCHANGES)을 넘으면 끝나며, 그 시점에 전체 교환을 한 번 요약해서
 * (summarizeScene) 매크로 로그/그래프에 커밋한다.
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

  const seedNodeIds = scene.involvedNpcIds
    .map((id) => state.npcs[id]?.memoryNodeId)
    .filter((id): id is string => Boolean(id));
  const recalledMemories = scene.involvedNpcIds.flatMap((npcId) => {
    const npc = state.npcs[npcId];
    if (!npc) return [];
    return getRecalledMemoriesForNpc(state.memoryGraph, npc, state.clock.turnIndex, seedNodeIds);
  });
  const dedupedMemories = [...new Map(recalledMemories.map((memory) => [memory.id, memory])).values()];

  const response = await deps.model.runSceneTurn({
    clock: state.clock,
    involvedNpcNames,
    exchangesSoFar: scene.exchanges,
    playerInput,
    recalledMemories: dedupedMemories,
  });

  // 씬 진행 중에도(요약을 기다리지 않고) 즉시 반영 — 위험한 시도의 대가는 그 자리에서 나야 한다.
  const { hidden, observable, npcs } = applyOutcomeImpact(
    state.hidden,
    state.observable,
    state.npcs,
    response.outcomeImpact,
    response.newVisibleSymptom,
    deps.language,
  );

  const exchange: SceneExchange = {
    index: scene.exchanges.length,
    playerInput,
    reply: response.reply,
    wasSignificant: response.plausibilityJudgment.verdict !== 'neutral' || response.outcomeImpact !== undefined,
  };
  const updatedExchanges = [...scene.exchanges, exchange];
  const updatedJudgments = [...scene.judgments, response.plausibilityJudgment];
  const hitCap = updatedExchanges.length >= MAX_SCENE_EXCHANGES;
  const stateWithImpact: GameState = { ...state, hidden, observable, npcs };

  if (!response.sceneEnded && !hitCap && !response.death) {
    const nextState: GameState = {
      ...stateWithImpact,
      activeScene: { ...scene, exchanges: updatedExchanges, judgments: updatedJudgments },
    };
    return { state: nextState, exchange };
  }

  const summary = await deps.model.summarizeScene({ clock: state.clock, involvedNpcNames, exchanges: updatedExchanges });

  const nextTurnIndex = state.clock.turnIndex + 1;

  // 씬 전체에서 나온 판단 중 하나라도 neutral이 아니면 significant로 취급.
  const wasSceneSignificant = updatedJudgments.some((judgment) => judgment.verdict !== 'neutral');
  const shouldRecordEvent = wasSceneSignificant || updatedExchanges.some((exchange) => exchange.wasSignificant) || Boolean(response.death);
  const { delta, proposedNpcs } = extractMemoryUpdate({
    narrative: summary.narrative,
    npcs: stateWithImpact.npcs,
    recalledMemories: recallMemories(stateWithImpact.memoryGraph, state.clock.turnIndex),
    shouldRecordEvent,
  });

  const {
    memoryGraph,
    npcs: npcsAfterDelta,
    participantNpcIds,
    resolvedDelta,
  } = applyDeltaAndNpcs(stateWithImpact.memoryGraph, stateWithImpact.npcs, nextTurnIndex, delta, proposedNpcs);
  const hiddenAfterDrift = applyHiddenStatDrift(stateWithImpact.hidden, summary.elapsedMonths, state.clock.lifeStage);
  const nextClock = advanceClock(state.clock, nextTurnIndex, summary.elapsedMonths);

  const npcsAfterEncoding = encodeIntoParticipantGraphs(
    npcsAfterDelta,
    resolvedDelta,
    participantNpcIds,
    nextTurnIndex,
    wasSceneSignificant,
  );

  const concluded = finalizeTurn(stateWithImpact, nextTurnIndex, nextClock, memoryGraph, npcsAfterEncoding, hiddenAfterDrift, observable, {
    kind: 'detail',
    narrative: summary.narrative,
    plausibilityJudgments: updatedJudgments,
    death: response.death,
  });

  return { state: concluded.state, exchange, concluded };
}

export interface AutoAdvanceResult {
  state: GameState;
  /** 이번 호출에서 처리된 모든 턴 결과 — 플레이어 입력이면 항상 1개, 빈 입력이면 스킵
   *  여러 개(+마지막에 강제 이벤트 하나 또는 없음)일 수 있다. */
  turns: TurnResult[];
}

/**
 * 플레이어 입력 하나를 처리한다.
 *
 * playerInput이 있으면: 항상 모델 호출 1번(runPlayerAction)으로 끝나고 체이닝하지 않는다 —
 * 플레이어가 뭔가 입력했다면 그 하나의 결과를 보여주고 제어권을 돌려준다.
 *
 * playerInput이 없으면("계속하기"): 코드가 매 사이클 시대 이벤트/돌발 사건/급사/순수 스킵
 * 중 하나를 결정한다(decideSkipStretch). 순수 스킵은 모델 호출이 전혀 없으므로 빠르게
 * 이어지고, 강제 이벤트에 도달하거나 사망하거나 씬에 진입하면(또는 MAX_CHAINED_SKIPS에
 * 도달하면) 멈춰서 제어권을 돌려준다.
 */
export async function advanceUntilInputNeeded(
  state: GameState,
  deps: GameLoopDeps,
  initialPlayerInput: string | null = null,
  onTurnResolved?: (result: TurnResult) => void,
): Promise<AutoAdvanceResult> {
  if (initialPlayerInput !== null) {
    const result = await runPlayerAction(state, initialPlayerInput, deps);
    onTurnResolved?.(result);
    return { state: result.state, turns: [result] };
  }

  const turns: TurnResult[] = [];
  let current = state;
  let chainedSkips = 0;

  while (current.status !== 'dead' && !current.activeScene) {
    const decision = decideSkipStretch(current, deps.language);

    let result: TurnResult;
    switch (decision.type) {
      case 'pureSkip':
        result = runPureSkip(current, decision.months, deps.language);
        break;
      case 'suddenDeath':
        result = runSuddenDeath(current, decision.monthsUntil, decision.cause, deps.language);
        break;
      case 'eraEvent':
        result = await runForcedEvent(current, decision.monthsUntil, { kind: 'eraEvent', definition: decision.definition }, deps);
        break;
      case 'unpromptedEvent':
        result = await runForcedEvent(current, decision.monthsUntil, { kind: 'unpromptedEvent' }, deps);
        break;
    }

    turns.push(result);
    current = result.state;
    onTurnResolved?.(result);

    if (current.status === 'dead' || current.activeScene || result.logEntry.kind === 'detail') {
      break;
    }

    chainedSkips++;
    if (chainedSkips >= MAX_CHAINED_SKIPS) break;
  }

  return { state: current, turns };
}
