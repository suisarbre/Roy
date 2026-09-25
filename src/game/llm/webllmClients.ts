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

/** 응답 길이 안전장치. 라우터는 서사가 거의 없어 짧게, 메인은 한 장면 분량으로 넉넉히 잡되
 *  무한정 늘어지진 않게 캡을 둔다 — 캡에 걸리면 grammar가 강제로 객체를 닫으려 시도한다. */
const ROUTER_MAX_TOKENS = 512;
const MAIN_MAX_TOKENS = 768;

const MAX_JSON_RETRIES = 1;

function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value === null ? undefined : value;
}

/**
 * 스트리밍 중인 누적 버퍼에서 `"fieldName": "..."` 문자열 값을 부분적으로(아직 안 끝났어도)
 * 추출한다. 전체 JSON 파서가 아니라 이 한 필드만 훑는 가벼운 스캐너 — narrative/reply를
 * 스키마의 첫 필드로 선언해뒀기 때문에(schemas.ts 참고) 문법 제약 생성기가 이 필드부터
 * 채우는 것에 의존한다. 키를 아직 못 찾았으면 null(= 아직 표시할 게 없음), 찾았으면
 * 지금까지 디코딩된 문자열(끝났든 안 끝났든)을 반환한다.
 */
export function extractStreamingStringField(buffer: string, fieldName: string): string | null {
  const keyToken = `"${fieldName}"`;
  const keyIndex = buffer.indexOf(keyToken);
  if (keyIndex === -1) return null;

  let i = keyIndex + keyToken.length;
  while (i < buffer.length && (buffer[i] === ' ' || buffer[i] === '\n' || buffer[i] === '\t' || buffer[i] === ':')) {
    i++;
  }
  if (i >= buffer.length || buffer[i] !== '"') return '';
  i++;

  let result = '';
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === '\\') {
      if (i + 1 >= buffer.length) break; // 이스케이프 시퀀스가 아직 안 끝남 — 다음 청크를 기다린다.
      const next = buffer[i + 1];
      if (next === 'n') result += '\n';
      else if (next === 't') result += '\t';
      else if (next === 'r') result += '\r';
      else if (next === 'u') {
        if (i + 6 > buffer.length) break; // \uXXXX가 아직 안 끝남
        result += String.fromCharCode(parseInt(buffer.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      } else result += next; // ", \\, / 등은 그대로
      i += 2;
      continue;
    }
    if (ch === '"') return result; // 닫는 따옴표 — 필드 완성
    result += ch;
    i++;
  }
  return result; // 버퍼가 문자열 중간에서 끝남 — 지금까지 디코딩된 부분을 그대로 반환
}

async function completeJson(
  engine: MLCEngine,
  modelId: string,
  system: string,
  user: string,
  schema: JsonSchema,
  temperature: number,
  maxTokens: number,
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
        max_tokens: maxTokens,
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

/**
 * completeJson과 동일하지만 스트리밍으로 받아서, 누적 버퍼에서 streamFieldName(narrative/reply)
 * 값이 채워지는 대로 onPartial로 흘려보낸다. UI가 이걸로 "생성 중" 텍스트를 실시간 표시한다 —
 * 실제 총 대기 시간은 줄지 않지만 체감 반응성이 크게 좋아진다.
 */
async function completeJsonStreaming(
  engine: MLCEngine,
  modelId: string,
  system: string,
  user: string,
  schema: JsonSchema,
  temperature: number,
  maxTokens: number,
  streamFieldName: string,
  onPartial?: (text: string) => void,
): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    try {
      const stream = await engine.chat.completions.create({
        model: modelId,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object', schema: JSON.stringify(schema) },
        stream: true,
      });

      let buffer = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (!delta) continue;
        buffer += delta;
        if (onPartial) {
          const partial = extractStreamingStringField(buffer, streamFieldName);
          if (partial !== null) onPartial(partial);
        }
      }

      if (!buffer) throw new Error('WebLLM returned an empty streamed completion.');
      const parsed = JSON.parse(buffer);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('WebLLM returned non-object JSON.');
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('WebLLM streaming completion failed.');
}

// ---- 응답 정규화: 스키마상 생략된(optional) 필드를 TS의 undefined로 다룬다 ----

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
      const raw = await completeJson(engine, ROUTER_MODEL_ID, system, user, ROUTER_OUTPUT_SCHEMA, ROUTER_TEMPERATURE, ROUTER_MAX_TOKENS);
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
      const raw = await completeJson(engine, ROUTER_MODEL_ID, system, user, SCENE_CLASSIFY_SCHEMA, ROUTER_TEMPERATURE, ROUTER_MAX_TOKENS);
      return {
        significance: raw.significance === 'significant' ? 'significant' : 'trivial',
        trivialReply: nullToUndefined(raw.trivialReply as string | null | undefined),
        requiresPlausibilityJudgment: Boolean(raw.requiresPlausibilityJudgment),
        sceneEnded: Boolean(raw.sceneEnded),
      };
    },

    async summarizeScene(request: SceneSummaryRequest): Promise<SceneSummary> {
      const { system, user } = buildSceneSummaryPrompt(request, language);
      const raw = await completeJson(engine, ROUTER_MODEL_ID, system, user, SCENE_SUMMARY_SCHEMA, ROUTER_TEMPERATURE, ROUTER_MAX_TOKENS);
      return {
        narrative: String(raw.narrative ?? ''),
        elapsedMonths: typeof raw.elapsedMonths === 'number' ? Math.max(0, Math.round(raw.elapsedMonths)) : 0,
        newNpcs: normalizeNewNpcs(raw.newNpcs),
        memoryGraphDelta: normalizeMemoryGraphDelta(raw.memoryGraphDelta),
      };
    },
  };
}

/**
 * onNarrativeChunk를 주면 narrative/reply 필드가 스트리밍으로 채워지는 대로 콜백된다 —
 * App.tsx가 이걸 store의 streamingNarrative에 연결해서 "생성 중" 텍스트를 실시간으로 보여준다.
 * 최종 반환값은 스트림이 끝나고 전체 JSON이 파싱된 뒤에나 resolve된다(다른 필드들은
 * 스트리밍 중엔 아직 불완전하므로).
 */
export function createWebLLMMainModel(
  engine: MLCEngine,
  language: Language,
  onNarrativeChunk?: (text: string) => void,
): MainModelClient {
  return {
    async runDetailTurn(request: MainTurnRequest): Promise<MainTurnResponse> {
      const { system, user } = buildMainTurnPrompt(request, language);
      const raw = await completeJsonStreaming(
        engine,
        MAIN_MODEL_ID,
        system,
        user,
        MAIN_TURN_RESPONSE_SCHEMA,
        MAIN_TEMPERATURE,
        MAIN_MAX_TOKENS,
        'narrative',
        onNarrativeChunk,
      );
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
      const raw = await completeJsonStreaming(
        engine,
        MAIN_MODEL_ID,
        system,
        user,
        SCENE_TURN_RESPONSE_SCHEMA,
        MAIN_TEMPERATURE,
        MAIN_MAX_TOKENS,
        'reply',
        onNarrativeChunk,
      );
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
