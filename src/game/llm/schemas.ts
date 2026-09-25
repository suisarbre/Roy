/**
 * WebLLM의 response_format: { type: 'json_object', schema } 용 JSON Schema 정의.
 *
 * 관례: 선택 필드(TS의 `field?: T`)는 스키마에서도 `required`에 넣되 타입에 'null'을 추가해서
 * "생략 가능"이 아니라 "값이 있거나 명시적으로 null"로 강제한다. 문법 제약 생성기가 필드
 * 생략을 지원하지 않는 경우가 있어, 모든 필드를 항상 채우게 하는 쪽이 안정적이다. 파싱 쪽
 * (webllmClients.ts)에서 null을 undefined로 취급한다.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonSchema = Record<string, any>;

const ACTION_CATEGORIES = ['routine', 'career', 'relationship', 'health', 'finance', 'majorLifeAttempt', 'recall'];
const MEMORY_NODE_TYPES = ['person', 'event', 'place', 'object', 'emotionState'];
const MEMORY_RELATIONS = ['causedBy', 'causes', 'involves', 'locatedAt', 'owns', 'relatedTo', 'feelsTowards'];
const NPC_RELATION_TYPES = ['parent', 'sibling', 'spouse', 'child', 'friend', 'coworker', 'boss', 'acquaintance', 'other'];
const MENTAL_SYMPTOM_TAGS = ['insomnia', 'irritability', 'fatigue', 'appetiteChange', 'lossOfInterest', 'panicEpisode'];

const PROPOSED_MEMORY_NODE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    localId: { type: 'string' },
    type: { type: 'string', enum: MEMORY_NODE_TYPES },
    content: { type: 'string' },
    participantNpcIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['localId', 'type', 'content', 'participantNpcIds'],
  additionalProperties: false,
};

const PROPOSED_MEMORY_EDGE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    from: { type: 'string' },
    to: { type: 'string' },
    relation: { type: 'string', enum: MEMORY_RELATIONS },
    weight: { type: 'number' },
  },
  required: ['from', 'to', 'relation', 'weight'],
  additionalProperties: false,
};

const PROPOSED_NPC_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    localId: { type: 'string' },
    name: { type: 'string' },
    relationType: { type: 'string', enum: NPC_RELATION_TYPES },
    personNodeLocalId: { type: 'string' },
  },
  required: ['localId', 'name', 'relationType', 'personNodeLocalId'],
  additionalProperties: false,
};

const MEMORY_GRAPH_DELTA_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    newNodes: { type: 'array', items: PROPOSED_MEMORY_NODE_SCHEMA },
    newEdges: { type: 'array', items: PROPOSED_MEMORY_EDGE_SCHEMA },
    accessedNodeIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['newNodes', 'newEdges', 'accessedNodeIds'],
  additionalProperties: false,
};

const PLAUSIBILITY_JUDGMENT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['reckless', 'prepared', 'neutral'] },
    citedMemoryNodeIds: { type: 'array', items: { type: 'string' } },
    successBias: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['verdict', 'citedMemoryNodeIds', 'successBias'],
  additionalProperties: false,
};

const STAT_IMPACT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    netWorthDelta: { type: ['number', 'null'] },
    hiddenDebtDelta: { type: ['number', 'null'] },
    creditStandingDelta: { type: ['number', 'null'] },
    stressDelta: { type: ['number', 'null'] },
    burnoutDelta: { type: ['number', 'null'] },
    relationshipDelta: {
      type: ['object', 'null'],
      properties: {
        npcId: { type: 'string' },
        trustDelta: { type: ['number', 'null'] },
        affectionDelta: { type: ['number', 'null'] },
        resentmentDelta: { type: ['number', 'null'] },
      },
      required: ['npcId', 'trustDelta', 'affectionDelta', 'resentmentDelta'],
      additionalProperties: false,
    },
    newChronicSeed: {
      type: ['object', 'null'],
      properties: {
        label: { type: 'string' },
        severity: { type: 'number' },
      },
      required: ['label', 'severity'],
      additionalProperties: false,
    },
    diseaseProgressDelta: {
      type: ['object', 'null'],
      additionalProperties: { type: 'number' },
    },
    newVisibleSymptom: { type: ['string', 'null'], enum: [...MENTAL_SYMPTOM_TAGS, null] },
  },
  required: [
    'netWorthDelta',
    'hiddenDebtDelta',
    'creditStandingDelta',
    'stressDelta',
    'burnoutDelta',
    'relationshipDelta',
    'newChronicSeed',
    'diseaseProgressDelta',
    'newVisibleSymptom',
  ],
  additionalProperties: false,
};

const DEATH_SCHEMA: JsonSchema = {
  type: ['object', 'null'],
  properties: { cause: { type: 'string' } },
  required: ['cause'],
  additionalProperties: false,
};

/** runRouterTurn 응답 (RouterOutput) */
export const ROUTER_OUTPUT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    turnType: { type: 'string', enum: ['skip', 'detail'] },
    intent: {
      type: ['object', 'null'],
      properties: {
        actionType: { type: 'string', enum: ACTION_CATEGORIES },
        target: { type: ['string', 'null'] },
        contextTags: { type: 'array', items: { type: 'string' } },
      },
      required: ['actionType', 'target', 'contextTags'],
      additionalProperties: false,
    },
    elapsedMonths: { type: 'integer' },
    suddenDeath: DEATH_SCHEMA,
    eraEventTriggered: { type: ['string', 'null'] },
    newNpcs: { type: 'array', items: PROPOSED_NPC_SCHEMA },
    memoryGraphDelta: MEMORY_GRAPH_DELTA_SCHEMA,
  },
  required: ['turnType', 'intent', 'elapsedMonths', 'suddenDeath', 'eraEventTriggered', 'newNpcs', 'memoryGraphDelta'],
  additionalProperties: false,
};

/** classifySceneExchange 응답 */
export const SCENE_CLASSIFY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    significance: { type: 'string', enum: ['trivial', 'significant'] },
    trivialReply: { type: ['string', 'null'] },
    requiresPlausibilityJudgment: { type: 'boolean' },
    sceneEnded: { type: 'boolean' },
  },
  required: ['significance', 'trivialReply', 'requiresPlausibilityJudgment', 'sceneEnded'],
  additionalProperties: false,
};

/** summarizeScene 응답 */
export const SCENE_SUMMARY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    narrative: { type: 'string' },
    elapsedMonths: { type: 'integer' },
    newNpcs: { type: 'array', items: PROPOSED_NPC_SCHEMA },
    memoryGraphDelta: MEMORY_GRAPH_DELTA_SCHEMA,
  },
  required: ['narrative', 'elapsedMonths', 'newNpcs', 'memoryGraphDelta'],
  additionalProperties: false,
};

/** runDetailTurn 응답 */
export const MAIN_TURN_RESPONSE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    narrative: { type: 'string' },
    plausibilityJudgment: PLAUSIBILITY_JUDGMENT_SCHEMA,
    death: DEATH_SCHEMA,
    entersScene: {
      type: ['object', 'null'],
      properties: { involvedNpcIds: { type: 'array', items: { type: 'string' } } },
      required: ['involvedNpcIds'],
      additionalProperties: false,
    },
    statImpact: STAT_IMPACT_SCHEMA,
  },
  required: ['narrative', 'plausibilityJudgment', 'death', 'entersScene', 'statImpact'],
  additionalProperties: false,
};

/** runSceneTurn 응답 */
export const SCENE_TURN_RESPONSE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    plausibilityJudgment: PLAUSIBILITY_JUDGMENT_SCHEMA,
    sceneEnded: { type: 'boolean' },
    death: DEATH_SCHEMA,
    statImpact: STAT_IMPACT_SCHEMA,
  },
  required: ['reply', 'plausibilityJudgment', 'sceneEnded', 'death', 'statImpact'],
  additionalProperties: false,
};
