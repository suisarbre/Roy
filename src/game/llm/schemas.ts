/**
 * WebLLM의 response_format: { type: 'json_object', schema } 용 JSON Schema 정의.
 *
 * 관례: 항상 의미 있는 필드만 `required`에 넣고, 나머지는 진짜 optional(생략 가능)로 둔다.
 * 처음엔 "모든 필드를 required+nullable로 강제"하는 방식으로 짰었는데, 그러면 아무 일도
 * 안 일어난 턴에도 statImpact의 9개 필드를 전부 null로 써내야 해서 매 호출마다 불필요한
 * 출력 토큰이 쌓이고 응답이 느려졌다 — 대부분의 턴에서 대부분의 필드는 "해당 없음"이
 * 정상이므로, 그 경우 아예 생략하는 쪽이 토큰도 절약되고 자연스럽다. WebLLM의 JSON Schema
 * 문법 제약 생성기는 표준 optional(= required에 없는 키는 생략 가능)을 지원한다.
 * 파싱 쪽(webllmClients.ts)은 이미 필드 부재를 undefined로 방어적으로 처리하고 있어서
 * 이 변경에 추가 코드 수정이 필요 없다.
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
  required: ['localId', 'type', 'content'],
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

/** 셋 다 비어있는 게 흔한 경우라, 델타 자체는 필수로 두되 내부 배열들은 전부 optional로
 *  둬서 "이번엔 아무것도 없음"일 때 `{}` 하나로 끝나게 한다(예전엔 빈 배열 3개를 강제로
 *  써야 했다). */
const MEMORY_GRAPH_DELTA_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    newNodes: { type: 'array', items: PROPOSED_MEMORY_NODE_SCHEMA },
    newEdges: { type: 'array', items: PROPOSED_MEMORY_EDGE_SCHEMA },
    accessedNodeIds: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
};

const PLAUSIBILITY_JUDGMENT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['reckless', 'prepared', 'neutral'] },
    citedMemoryNodeIds: { type: 'array', items: { type: 'string' } },
    successBias: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
  required: ['verdict', 'successBias'],
  additionalProperties: false,
};

/** 전부 optional — "아무 영향 없음"이 훨씬 흔한 케이스라, 그 경우 statImpact가 `{}`로
 *  끝나야 한다(이전엔 9개 필드를 매번 null로 써내야 했다). */
const STAT_IMPACT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    netWorthDelta: { type: 'number' },
    hiddenDebtDelta: { type: 'number' },
    creditStandingDelta: { type: 'number' },
    stressDelta: { type: 'number' },
    burnoutDelta: { type: 'number' },
    relationshipDelta: {
      type: 'object',
      properties: {
        npcId: { type: 'string' },
        trustDelta: { type: 'number' },
        affectionDelta: { type: 'number' },
        resentmentDelta: { type: 'number' },
      },
      required: ['npcId'],
      additionalProperties: false,
    },
    newChronicSeed: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        severity: { type: 'number' },
      },
      required: ['label', 'severity'],
      additionalProperties: false,
    },
    diseaseProgressDelta: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
    newVisibleSymptom: { type: 'string', enum: MENTAL_SYMPTOM_TAGS },
  },
  additionalProperties: false,
};

const DEATH_SCHEMA: JsonSchema = {
  type: 'object',
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
      type: 'object',
      properties: {
        actionType: { type: 'string', enum: ACTION_CATEGORIES },
        target: { type: 'string' },
        contextTags: { type: 'array', items: { type: 'string' } },
      },
      required: ['actionType'],
      additionalProperties: false,
    },
    elapsedMonths: { type: 'integer' },
    suddenDeath: DEATH_SCHEMA,
    eraEventTriggered: { type: 'string' },
    newNpcs: { type: 'array', items: PROPOSED_NPC_SCHEMA },
    memoryGraphDelta: MEMORY_GRAPH_DELTA_SCHEMA,
  },
  required: ['turnType', 'elapsedMonths'],
  additionalProperties: false,
};

/** classifySceneExchange 응답 */
export const SCENE_CLASSIFY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    significance: { type: 'string', enum: ['trivial', 'significant'] },
    trivialReply: { type: 'string' },
    requiresPlausibilityJudgment: { type: 'boolean' },
    sceneEnded: { type: 'boolean' },
  },
  required: ['significance', 'requiresPlausibilityJudgment', 'sceneEnded'],
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
  required: ['narrative', 'elapsedMonths'],
  additionalProperties: false,
};

/**
 * runDetailTurn 응답. narrative를 첫 필드로 선언해서(스트리밍 추출이 이 순서에 의존 —
 * webllmClients.ts의 extractStreamingStringField 참고) 문법 제약 생성기가 이 필드부터
 * 채우게 한다.
 */
export const MAIN_TURN_RESPONSE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    narrative: { type: 'string' },
    plausibilityJudgment: PLAUSIBILITY_JUDGMENT_SCHEMA,
    death: DEATH_SCHEMA,
    entersScene: {
      type: 'object',
      properties: { involvedNpcIds: { type: 'array', items: { type: 'string' } } },
      required: ['involvedNpcIds'],
      additionalProperties: false,
    },
    statImpact: STAT_IMPACT_SCHEMA,
  },
  required: ['narrative', 'plausibilityJudgment'],
  additionalProperties: false,
};

/** runSceneTurn 응답. reply가 첫 필드 — 위 MAIN_TURN_RESPONSE_SCHEMA와 같은 이유. */
export const SCENE_TURN_RESPONSE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    plausibilityJudgment: PLAUSIBILITY_JUDGMENT_SCHEMA,
    sceneEnded: { type: 'boolean' },
    death: DEATH_SCHEMA,
    statImpact: STAT_IMPACT_SCHEMA,
  },
  required: ['reply', 'plausibilityJudgment', 'sceneEnded'],
  additionalProperties: false,
};
