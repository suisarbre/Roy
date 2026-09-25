import type { MLCEngine } from '@mlc-ai/web-llm';
import type { Language } from '../../i18n';
import { MAIN_MODEL_ID, ROUTER_MODEL_ID } from './engine';
import {
  buildMainTurnPrompt,
  buildRouterTurnPrompt,
  buildSceneClassifyPrompt,
  buildSceneSummaryPrompt,
  buildSceneTurnPrompt,
} from './prompts';
import {
  MAIN_TURN_RESPONSE_SCHEMA,
  ROUTER_OUTPUT_SCHEMA,
  SCENE_CLASSIFY_SCHEMA,
  SCENE_SUMMARY_SCHEMA,
  SCENE_TURN_RESPONSE_SCHEMA,
  type JsonSchema,
} from './schemas';
import type {
  MainModelClient,
  MainTurnRequest,
  MainTurnResponse,
  RouterModelClient,
  RouterTurnRequest,
  SceneClassifyRequest,
  SceneClassifyResponse,
  SceneSummary,
  SceneSummaryRequest,
  SceneTurnRequest,
  SceneTurnResponse,
} from './types';
import type {
  ParsedIntent,
  PlausibilityJudgment,
  ProposedMemoryEdge,
  ProposedMemoryNode,
  ProposedNpc,
  RouterOutput,
  StatImpact,
} from '../types';

/**
 * 라우터는 분류/파싱이 목적이라 낮은 온도(거의 결정적), 메인은 서사를 쓰므로 약간의 다양성을
 * 허용한다. 둘 다 response_format의 grammar 제약 때문에 형식이 깨질 위험은 낮지만, 온도가
 * 너무 높으면 grammar 제약 안에서도 내용이 산만해질 수 있어 보수적으로 잡는다.
 */
const ROUTER_TEMPERATURE = 0.3;
const MAIN_TEMPERATURE = 0.8;

const MAX_JSON_RETRIES = 1;

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

async function completeJson(
  engine: MLCEngine,
  modelId: string,
  system: string,
  user: string,
  schema: JsonSchema,
  temperature: number,
): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    try {
      const completion = await engine.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        response_format: { type: 'json_object', schema: JSON.stringify(schema) },
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('WebLLM returned an empty completion.');
      const parsed = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('WebLLM returned non-object JSON.');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('WebLLM structured completion failed.');
}

// ---- 응답 정규화: 스키마가 강제한 null을 TS의 optional(undefined)로 옮긴다 ----

function normalizeParsedIntent(raw: unknown): ParsedIntent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    actionType: r.actionType as ParsedIntent['actionType'],
    target: nullToUndefined(r.target as string | null | undefined),
    contextTags: Array.isArray(r.contextTags) ? (r.contextTags as string[]) : [],
  };
}

function normalizeMemoryGraphDelta(raw: unknown): RouterOutput['memoryGraphDelta'] {
  const r = (raw ?? {}) as Record<string, unknown>;
  const newNodes = Array.isArray(r.newNodes)
    ? (r.newNodes as Record<string, unknown>[]).map(
        (n): ProposedMemoryNode => ({
          localId: String(n.localId),
          type: n.type as ProposedMemoryNode['type'],
          content: String(n.content ?? ''),
          participantNpcIds: Array.isArray(n.participantNpcIds) ? (n.participantNpcIds as string[]) : undefined,
        }),
      )
    : [];
  const newEdges = Array.isArray(r.newEdges)
    ? (r.newEdges as Record<string, unknown>[]).map(
        (e): ProposedMemoryEdge => ({
          from: String(e.from),
          to: String(e.to),
          relation: e.relation as ProposedMemoryEdge['relation'],
          weight: typeof e.weight === 'number' ? e.weight : 1,
        }),
      )
    : [];
  const accessedNodeIds = Array.isArray(r.accessedNodeIds) ? (r.accessedNodeIds as string[]) : [];
  return { newNodes, newEdges, accessedNodeIds };
}

function normalizeNewNpcs(raw: unknown): ProposedNpc[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map(
    (n): ProposedNpc => ({
      localId: String(n.localId),
      name: String(n.name ?? ''),
      relationType: n.relationType as ProposedNpc['relationType'],
      personNodeLocalId: String(n.personNodeLocalId),
    }),
  );
}

function normalizePlausibilityJudgment(raw: unknown): PlausibilityJudgment {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    verdict: (r.verdict as PlausibilityJudgment['verdict']) ?? 'neutral',
    citedMemoryNodeIds: Array.isArray(r.citedMemoryNodeIds) ? (r.citedMemoryNodeIds as string[]) : [],
    successBias: (r.successBias as PlausibilityJudgment['successBias']) ?? 'medium',
  };
}

function normalizeStatImpact(raw: unknown): StatImpact | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const relationshipDeltaRaw = r.relationshipDelta as Record<string, unknown> | null | undefined;
  return {
    netWorthDelta: nullToUndefined(r.netWorthDelta as number | null | undefined),
    hiddenDebtDelta: nullToUndefined(r.hiddenDebtDelta as number | null | undefined),
    creditStandingDelta: nullToUndefined(r.creditStandingDelta as number | null | undefined),
    stressDelta: nullToUndefined(r.stressDelta as number | null | undefined),
    burnoutDelta: nullToUndefined(r.burnoutDelta as number | null | undefined),
    relationshipDelta: relationshipDeltaRaw
      ? {
          npcId: String(relationshipDeltaRaw.npcId),
          trustDelta: nullToUndefined(relationshipDeltaRaw.trustDelta as number | null | undefined),
          affectionDelta: nullToUndefined(relationshipDeltaRaw.affectionDelta as number | null | undefined),
          resentmentDelta: nullToUndefined(relationshipDeltaRaw.resentmentDelta as number | null | undefined),
        }
      : undefined,
    newChronicSeed: nullToUndefined(r.newChronicSeed as StatImpact['newChronicSeed'] | null | undefined),
    diseaseProgressDelta: nullToUndefined(r.diseaseProgressDelta as StatImpact['diseaseProgressDelta'] | null | undefined),
    newVisibleSymptom: nullToUndefined(r.newVisibleSymptom as StatImpact['newVisibleSymptom'] | null | undefined),
  };
}

function normalizeDeath(raw: unknown): { cause: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return r.cause ? { cause: String(r.cause) } : null;
}

// ---- 클라이언트 팩토리 ----

export function createWebLLMRouterModel(engine: MLCEngine, language: Language): RouterModelClient {
  return {
    async runRouterTurn(request: RouterTurnRequest): Promise<RouterOutput> {
      const { system, user } = buildRouterTurnPrompt(request, language);
      const raw = await completeJson(engine, ROUTER_MODEL_ID, system, user, ROUTER_OUTPUT_SCHEMA, ROUTER_TEMPERATURE);
      const turnType = raw.turnType === 'detail' ? 'detail' : 'skip';
      return {
        turnType,
        intent: turnType === 'detail' ? normalizeParsedIntent(raw.intent) : null,
        elapsedMonths: typeof raw.elapsedMonths === 'number' ? Math.max(0, Math.round(raw.elapsedMonths)) : 0,
        suddenDeath: normalizeDeath(raw.suddenDeath),
        eraEventTriggered: nullToUndefined(raw.eraEventTriggered as string | null | undefined),
        newNpcs: normalizeNewNpcs(raw.newNpcs),
        memoryGraphDelta: normalizeMemoryGraphDelta(raw.memoryGraphDelta),
      };
    },

    async classifySceneExchange(request: SceneClassifyRequest): Promise<SceneClassifyResponse> {
      const { system, user } = buildSceneClassifyPrompt(request, language);
      const raw = await completeJson(engine, ROUTER_MODEL_ID, system, user, SCENE_CLASSIFY_SCHEMA, ROUTER_TEMPERATURE);
      return {
        significance: raw.significance === 'significant' ? 'significant' : 'trivial',
        trivialReply: nullToUndefined(raw.trivialReply as string | null | undefined),
        requiresPlausibilityJudgment: Boolean(raw.requiresPlausibilityJudgment),
        sceneEnded: Boolean(raw.sceneEnded),
      };
    },

    async summarizeScene(request: SceneSummaryRequest): Promise<SceneSummary> {
      const { system, user } = buildSceneSummaryPrompt(request, language);
      const raw = await completeJson(engine, ROUTER_MODEL_ID, system, user, SCENE_SUMMARY_SCHEMA, ROUTER_TEMPERATURE);
      return {
        narrative: String(raw.narrative ?? ''),
        elapsedMonths: typeof raw.elapsedMonths === 'number' ? Math.max(0, Math.round(raw.elapsedMonths)) : 0,
        newNpcs: normalizeNewNpcs(raw.newNpcs),
        memoryGraphDelta: normalizeMemoryGraphDelta(raw.memoryGraphDelta),
      };
    },
  };
}

export function createWebLLMMainModel(engine: MLCEngine, language: Language): MainModelClient {
  return {
    async runDetailTurn(request: MainTurnRequest): Promise<MainTurnResponse> {
      const { system, user } = buildMainTurnPrompt(request, language);
      const raw = await completeJson(engine, MAIN_MODEL_ID, system, user, MAIN_TURN_RESPONSE_SCHEMA, MAIN_TEMPERATURE);
      const entersSceneRaw = raw.entersScene as Record<string, unknown> | null | undefined;
      return {
        narrative: String(raw.narrative ?? ''),
        plausibilityJudgment: normalizePlausibilityJudgment(raw.plausibilityJudgment),
        death: normalizeDeath(raw.death),
        entersScene:
          entersSceneRaw && Array.isArray(entersSceneRaw.involvedNpcIds)
            ? { involvedNpcIds: entersSceneRaw.involvedNpcIds as string[] }
            : null,
        statImpact: normalizeStatImpact(raw.statImpact),
      };
    },

    async runSceneTurn(request: SceneTurnRequest): Promise<SceneTurnResponse> {
      const { system, user } = buildSceneTurnPrompt(request, language);
      const raw = await completeJson(engine, MAIN_MODEL_ID, system, user, SCENE_TURN_RESPONSE_SCHEMA, MAIN_TEMPERATURE);
      return {
        reply: String(raw.reply ?? ''),
        plausibilityJudgment: normalizePlausibilityJudgment(raw.plausibilityJudgment),
        sceneEnded: Boolean(raw.sceneEnded),
        death: normalizeDeath(raw.death),
        statImpact: normalizeStatImpact(raw.statImpact),
      };
    },
  };
}
