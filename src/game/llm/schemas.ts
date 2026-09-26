/**
 * WebLLM의 response_format: { type: 'json_object', schema } 용 JSON Schema 정의.
 *
 * 관례: 항상 의미 있는 필드만 `required`에 넣고, 나머지는 진짜 optional(생략 가능)로 둔다 —
 * "아무 일도 없었다"가 흔한 응답 모양이라, 그 경우 해당 필드를 통째로 생략하는 쪽이 토큰도
 * 절약되고 자연스럽다. 파싱 쪽(webllmClients.ts)은 필드 부재를 undefined로 방어적으로
 * 처리한다.
 *
 * 라우터를 없애면서 예전 RouterOutput/MainTurnResponse/StatImpact 스키마가 하나의
 * TURN_RESPONSE_SCHEMA로 합쳐졌다 — turnType/elapsedMonths/eraEventTriggered는 전부
 * 코드(gameLoop.ts, eraEvents.ts)가 직접 결정하므로 모델이 낼 필요가 없어졌고,
 * statImpact의 9개 숫자 필드는 axis/direction/magnitude 3개짜리 정성적 등급으로 줄었다.
 *
 * 7단계(LLM 축소)에서 newNpcs/memoryGraphDelta도 스키마에서 빠졌다 — 그래프 추출은 작은
 * 모델이 가장 못하는 일이라(비용은 디코딩 토큰인데, narrative 하나 쓰는 것보다 구조화된
 * 그래프를 환각 없이 뽑아내는 쪽이 훨씬 어렵다), 이제 memoryExtraction.ts가 narrative
 * 텍스트에서 코드(경량 NER + 표면 유사도)로 직접 뽑아낸다. 모델은 narrative(+판정/영향)만
 * 내면 된다.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonSchema = Record<string, any>;

const MENTAL_SYMPTOM_TAGS = ['insomnia', 'irritability', 'fatigue', 'appetiteChange', 'lossOfInterest', 'panicEpisode'];
const OUTCOME_AXES = ['finance', 'health', 'mentalHealth', 'relationship'];

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

/** statImpact의 9개 숫자 필드 대신 정성적 등급 하나 — 실제 숫자 변환은 statImpact.ts가
 *  코드 테이블로 담당한다(작은 모델이 여러 숫자를 동시에 잘 보정하긴 어렵다는 판단). */
const OUTCOME_IMPACT_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    axis: { type: 'string', enum: OUTCOME_AXES },
    direction: { type: 'string', enum: ['positive', 'negative'] },
    magnitude: { type: 'string', enum: ['minor', 'moderate', 'major'] },
    relationshipNpcId: { type: 'string' },
    note: { type: 'string' },
  },
  required: ['axis', 'direction', 'magnitude'],
  additionalProperties: false,
};

const DEATH_SCHEMA: JsonSchema = {
  type: 'object',
  properties: { cause: { type: 'string' } },
  required: ['cause'],
  additionalProperties: false,
};

/**
 * runTurn 응답 — 플레이어 입력, 코드가 강제한 시대 이벤트, 코드가 주사위를 굴려 만든
 * 돌발 사건, 이 세 가지 트리거 중 하나로 호출된다(라우터가 있던 시절의 RouterOutput +
 * MainTurnResponse가 합쳐진 자리). narrative를 첫 필드로 선언해서(스트리밍 추출이 이
 * 순서에 의존 — webllmClients.ts의 extractStreamingStringField 참고) 문법 제약
 * 생성기가 이 필드부터 채우게 한다.
 */
export const TURN_RESPONSE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    narrative: { type: 'string' },
    plausibilityJudgment: PLAUSIBILITY_JUDGMENT_SCHEMA,
    outcomeImpact: OUTCOME_IMPACT_SCHEMA,
    newVisibleSymptom: { type: 'string', enum: MENTAL_SYMPTOM_TAGS },
    death: DEATH_SCHEMA,
    entersScene: {
      type: 'object',
      properties: { involvedNpcIds: { type: 'array', items: { type: 'string' } } },
      required: ['involvedNpcIds'],
      additionalProperties: false,
    },
  },
  required: ['narrative', 'plausibilityJudgment'],
  additionalProperties: false,
};

/** runSceneTurn 응답. reply가 첫 필드 — 위 TURN_RESPONSE_SCHEMA와 같은 이유. */
export const SCENE_TURN_RESPONSE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    plausibilityJudgment: PLAUSIBILITY_JUDGMENT_SCHEMA,
    sceneEnded: { type: 'boolean' },
    outcomeImpact: OUTCOME_IMPACT_SCHEMA,
    newVisibleSymptom: { type: 'string', enum: MENTAL_SYMPTOM_TAGS },
    death: DEATH_SCHEMA,
  },
  required: ['reply', 'plausibilityJudgment', 'sceneEnded'],
  additionalProperties: false,
};

/** summarizeScene 응답 — 씬 전체를 매크로 로그 한 줄로 압축. 그래프 델타/신규 NPC 추출은
 *  더 이상 모델이 하지 않는다(위 파일 머리 주석 참고) — memoryExtraction.ts가 이 narrative
 *  텍스트에서 코드로 직접 뽑는다. */
export const SCENE_SUMMARY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    narrative: { type: 'string' },
    elapsedMonths: { type: 'integer' },
  },
  required: ['narrative', 'elapsedMonths'],
  additionalProperties: false,
};
