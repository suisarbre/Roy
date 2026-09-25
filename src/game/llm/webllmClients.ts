import type { MLCEngine } from '@mlc-ai/web-llm';
import type { Language } from '../../i18n';
import { buildSceneSummaryPrompt, buildSceneTurnPrompt, buildTurnPrompt } from './prompts';
import { SCENE_SUMMARY_SCHEMA, SCENE_TURN_RESPONSE_SCHEMA, TURN_RESPONSE_SCHEMA, type JsonSchema } from './schemas';
import type {
  GameModelClient,
  SceneSummary,
  SceneSummaryRequest,
  SceneTurnRequest,
  SceneTurnResponse,
  TurnRequest,
  TurnResponse,
} from './types';
import type { MentalSymptomTag, OutcomeImpact, PlausibilityJudgment, ProposedMemoryEdge, ProposedMemoryNode, ProposedNpc, MemoryGraphDelta } from '../types';

/** 서사를 쓰는 호출이라 약간의 다양성을 허용한다. 문법 제약(response_format) 덕에 형식이
 *  깨질 위험은 낮지만, 온도가 너무 높으면 그 안에서도 내용이 산만해질 수 있어 보수적으로 잡는다. */
const TEMPERATURE = 0.8;

/**
 * 응답 길이 안전장치이자 실질적인 속도 레버 — 디코딩(출력 생성)은 토큰당 순차 비용이라
 * prefill보다 훨씬 비싸다. 프롬프트에서 "2-4문장/1-3문장"으로 분량을 조여둔 것과 맞춰서
 * 캡도 그만큼만 넉넉히 둔다. 캡에 걸리면 grammar가 강제로 객체를 닫으려 시도한다.
 */
const MAX_TOKENS = 400;

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
  system: string,
  user: string,
  schema: JsonSchema,
): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    try {
      const completion = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
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
  system: string,
  user: string,
  schema: JsonSchema,
  streamFieldName: string,
  onPartial?: (text: string) => void,
): Promise<Record<string, unknown>> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    try {
      const stream = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
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

function normalizeMemoryGraphDelta(raw: unknown): MemoryGraphDelta {
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

function normalizeOutcomeImpact(raw: unknown): OutcomeImpact | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (!r.axis || !r.direction || !r.magnitude) return undefined; // 필수 필드 없이는 불완전한 판단이라 무시.
  return {
    axis: r.axis as OutcomeImpact['axis'],
    direction: r.direction as OutcomeImpact['direction'],
    magnitude: r.magnitude as OutcomeImpact['magnitude'],
    relationshipNpcId: nullToUndefined(r.relationshipNpcId as string | null | undefined),
    note: nullToUndefined(r.note as string | null | undefined),
  };
}

function normalizeDeath(raw: unknown): { cause: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return r.cause ? { cause: String(r.cause) } : null;
}

// ---- 클라이언트 팩토리 ----

/**
 * onNarrativeChunk를 주면 narrative/reply 필드가 스트리밍으로 채워지는 대로 콜백된다 —
 * App.tsx가 이걸 store의 streamingNarrative에 연결해서 "생성 중" 텍스트를 실시간으로 보여준다.
 * runTurn/runSceneTurn만 스트리밍한다(서사가 사용자에게 보이는 호출) — summarizeScene은
 * 매크로 로그에 한 번에 커밋될 압축 결과라 스트리밍할 이유가 없다.
 */
export function createWebLLMModel(engine: MLCEngine, language: Language, onNarrativeChunk?: (text: string) => void): GameModelClient {
  return {
    async runTurn(request: TurnRequest): Promise<TurnResponse> {
      const { system, user } = buildTurnPrompt(request, language);
      const raw = await completeJsonStreaming(engine, system, user, TURN_RESPONSE_SCHEMA, 'narrative', onNarrativeChunk);
      const entersSceneRaw = raw.entersScene as Record<string, unknown> | null | undefined;
      return {
        narrative: String(raw.narrative ?? ''),
        plausibilityJudgment: normalizePlausibilityJudgment(raw.plausibilityJudgment),
        outcomeImpact: normalizeOutcomeImpact(raw.outcomeImpact),
        newVisibleSymptom: nullToUndefined(raw.newVisibleSymptom as MentalSymptomTag | null | undefined),
        death: normalizeDeath(raw.death),
        entersScene:
          entersSceneRaw && Array.isArray(entersSceneRaw.involvedNpcIds)
            ? { involvedNpcIds: entersSceneRaw.involvedNpcIds as string[] }
            : null,
        newNpcs: normalizeNewNpcs(raw.newNpcs),
        memoryGraphDelta: normalizeMemoryGraphDelta(raw.memoryGraphDelta),
      };
    },

    async runSceneTurn(request: SceneTurnRequest): Promise<SceneTurnResponse> {
      const { system, user } = buildSceneTurnPrompt(request, language);
      const raw = await completeJsonStreaming(engine, system, user, SCENE_TURN_RESPONSE_SCHEMA, 'reply', onNarrativeChunk);
      return {
        reply: String(raw.reply ?? ''),
        plausibilityJudgment: normalizePlausibilityJudgment(raw.plausibilityJudgment),
        sceneEnded: Boolean(raw.sceneEnded),
        outcomeImpact: normalizeOutcomeImpact(raw.outcomeImpact),
        newVisibleSymptom: nullToUndefined(raw.newVisibleSymptom as MentalSymptomTag | null | undefined),
        death: normalizeDeath(raw.death),
      };
    },

    async summarizeScene(request: SceneSummaryRequest): Promise<SceneSummary> {
      const { system, user } = buildSceneSummaryPrompt(request, language);
      const raw = await completeJson(engine, system, user, SCENE_SUMMARY_SCHEMA);
      return {
        narrative: String(raw.narrative ?? ''),
        elapsedMonths: typeof raw.elapsedMonths === 'number' ? Math.max(0, Math.round(raw.elapsedMonths)) : 0,
        newNpcs: normalizeNewNpcs(raw.newNpcs),
        memoryGraphDelta: normalizeMemoryGraphDelta(raw.memoryGraphDelta),
      };
    },
  };
}
