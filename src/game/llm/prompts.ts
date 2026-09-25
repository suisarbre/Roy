import type { Language } from '../../i18n';
import type {
  MainTurnRequest,
  RouterTurnRequest,
  SceneClassifyRequest,
  SceneSummaryRequest,
  SceneTurnRequest,
} from './types';

/**
 * 프롬프트 지시문 자체는 영어로 고정한다(모델의 지시 이해력이 가장 높은 언어) — 대신
 * "N언어로 답하라"를 명시해서 실제 콘텐츠(narrative, reply 등 자유 텍스트 필드)만 그 언어로
 * 나오게 한다. UI_STRINGS처럼 지시문 자체를 11개 언어로 번역하지 않는 이유: 지시 번역
 * 품질이 콘텐츠 언어 품질보다 훨씬 덜 중요하고, 유지비용만 커진다.
 */
const LANGUAGE_NAMES: Record<Language, string> = {
  ko: 'Korean (한국어)',
  en: 'English',
  ja: 'Japanese (日本語)',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'zh-TW': 'Traditional Chinese (繁體中文)',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  'pt-BR': 'Brazilian Portuguese',
  ru: 'Russian',
  it: 'Italian',
};

/**
 * 캐릭터 설정 + 문서 핵심 원칙. 모든 호출(라우터/메인)의 system prompt 공통 도입부로 쓴다.
 * concept doc의 톤/판단 원칙을 모델이 매번 다시 상기하도록 짧게 유지한다.
 */
const CHARACTER_AND_PRINCIPLES = `You are the simulation engine behind "Roy — A Life," a text-based life simulation.

CHARACTER: Roy. Born January 1962 in Inglewood, California (a Los Angeles-adjacent city with a large
aerospace-manufacturing working class in that era). Family background: working-class, not quite
middle-class. Roy is a fixed, non-customizable protagonist — never invent a different name, birthplace,
or birth year for him.

TONE: Documentary and flat, like a case file or biography, never comedic, never sentimental, never
self-aware. Never break the fourth wall, never mention that this is a game, a simulation, an AI, or that
you are generating text. Never editorialize or moralize about Roy's choices.

CORE PRINCIPLE — plausibility judgment: when Roy attempts something (crime, a business, immigration,
gambling, a risky career move, anything), judge it by whether it was reckless improvisation or a prepared
deviance, based on Roy's accumulated life narrative (his memories, skills, relationships, resources) —
not by what category the action falls into. The same reckless/prepared axis applies uniformly to every
kind of action; crime is not treated specially. Preparation earns a better outcome; blind impulsiveness
is punished. Cite the specific memories that justify your verdict.

CORE PRINCIPLE — mortality: death can happen at any time, including during uneventful passage of time
with no dramatic buildup, exactly as in real life. Do not reserve death only for climactic moments.

CORE PRINCIPLE — memory: you only ever see a curated subset of Roy's memories (already filtered for you),
never his whole life. Treat what you don't see as genuinely unknown to you, not as something to infer.`;

function languageInstruction(language: Language): string {
  return `Respond in ${LANGUAGE_NAMES[language]}. Every free-text field (narrative, reply, trivialReply, content, label, cause, etc.) must be written in ${LANGUAGE_NAMES[language]}. Field names and enum values themselves stay in English exactly as specified by the schema.`;
}

/** 스키마상 optional인 필드는 "해당 없음"일 때 아예 생략하라고 명시 — 그래야 매 호출마다
 *  불필요한 null 필드들을 써내느라 응답이 느려지는 걸 막을 수 있다. */
const OMIT_OPTIONAL_FIELDS_INSTRUCTION =
  'Omit any field the schema marks as optional when it does not apply — do not include it with a null or empty placeholder value. Only include an optional field when it genuinely has something to say.';

// 프롬프트에 박아넣는 JSON은 압축(들여쓰기 없음)으로 — pretty-print는 토큰만 늘리고
// 모델 이해도엔 도움이 안 된다.
function jsonBlock(value: unknown): string {
  return '```json\n' + JSON.stringify(value) + '\n```';
}

export interface PromptPair {
  system: string;
  user: string;
}

/** 라우터: 매크로 턴 분류/파싱. 서사 작성은 하지 않는다 — 구조화 데이터만 산출. */
export function buildRouterTurnPrompt(request: RouterTurnRequest, language: Language): PromptPair {
  const system = `${CHARACTER_AND_PRINCIPLES}

ROLE: You are the fast ROUTER model. Your only job is classification and structured extraction —
you never write prose narrative yourself (a separate model does that for 'detail' turns; for 'skip'
turns no narrative is needed at all, the game engine renders a template).

Decide:
- turnType: 'skip' if this input (or the passage of unguided time) doesn't need a detailed scene —
  routine, unremarkable. 'detail' if it deserves a real scene (the player attempted something specific,
  or something significant should happen even unprompted).
- If playerInput is null, Roy is just letting time pass — usually 'skip', but you may still choose
  'detail' if something noteworthy should occur unprompted, and you may set suddenDeath (rare, ~0.5%
  chance per call at most, unremarkable sudden death like a heart attack or accident) even on a skip turn.
- elapsedMonths: how many months this turn covers (skip turns: 1-6 typical; detail turns: usually 0,
  it's a single scene).
- intent: only when turnType is 'detail' and playerInput is not null — parse the player's stated action.
- eraEventTriggered: only set this to one of relevantEraEvents[].id if this turn is precisely the moment
  Roy experiences that event, and only on a 'detail' turn. Otherwise omit it entirely.
- newNpcs / memoryGraphDelta: extract any new people, events, places worth remembering from this turn.
  Only propose newNpcs for names NOT already in knownNpcNames. localId values are your own temporary
  references within this single response (not real IDs) — newEdges/participantNpcIds may point to them.
  If nothing is worth remembering, omit memoryGraphDelta (or its empty parts) entirely.

${languageInstruction(language)} (note: this call produces almost no free text — only cause/content/label
fields if used at all). ${OMIT_OPTIONAL_FIELDS_INSTRUCTION}`;

  const user = `Current state:
${jsonBlock({ clock: request.clock, playerInput: request.playerInput, knownNpcNames: request.knownNpcNames })}

Recent log (oldest to newest):
${jsonBlock(request.recentLog)}

Candidate era events (only trigger one if this turn is truly that moment):
${jsonBlock(request.relevantEraEvents)}

Produce the RouterOutput JSON now.`;

  return { system, user };
}

/** 씬 안 교환 분류: 사소함/중요함 + 개연성 판단 필요 여부. trivial이면 짧은 대사도 직접 짓는다. */
export function buildSceneClassifyPrompt(request: SceneClassifyRequest, language: Language): PromptPair {
  const system = `${CHARACTER_AND_PRINCIPLES}

ROLE: You are the fast ROUTER model, now classifying one exchange inside an ongoing scene (a
back-and-forth conversation or interaction with ${request.involvedNpcNames.join(', ') || 'someone'}).

Decide:
- significance: 'trivial' if this exchange is small talk / has no real stakes. 'significant' if it
  matters (emotional weight, a real request, a consequential statement).
- requiresPlausibilityJudgment: true if, regardless of significance, Roy is attempting something inside
  this line that should be judged for plausibility (a risky ask, a deceptive claim, a proposal). This is
  a separate axis from significance — either being true routes this to the heavier main model.
- If trivial AND does not require judgment, you write trivialReply yourself: a short, in-character,
  low-stakes line from the other person(s) in the scene. Keep it brief (1-2 sentences).
- sceneEnded: true if this exchange is a natural closing point for the scene (goodbye, topic
  exhausted, someone leaves).

${languageInstruction(language)} ${OMIT_OPTIONAL_FIELDS_INSTRUCTION}`;

  const user = `Scene so far (oldest to newest):
${jsonBlock(request.exchangesSoFar)}

Roy's clock: ${jsonBlock(request.clock)}

Roy's new line: ${JSON.stringify(request.playerInput)}

Produce the classification JSON now.`;

  return { system, user };
}

/** 씬 종료 시 전체 교환을 매크로 로그 한 줄 + 그래프 델타로 압축. */
export function buildSceneSummaryPrompt(request: SceneSummaryRequest, language: Language): PromptPair {
  const system = `${CHARACTER_AND_PRINCIPLES}

ROLE: You are the fast ROUTER model. A scene with ${request.involvedNpcNames.join(', ') || 'someone'} has
just ended. Compress the whole exchange log into:
- narrative: ONE compact sentence or two for the macro life-log (documentary tone), summarizing what
  this scene amounted to, not a transcript.
- elapsedMonths: how much game time this scene itself consumed (usually 0 — it's a single sitting).
- newNpcs / memoryGraphDelta: anything from this scene worth remembering long-term (only genuinely
  memorable content — not every line of small talk). Omit these entirely if nothing qualifies.

${languageInstruction(language)} ${OMIT_OPTIONAL_FIELDS_INSTRUCTION}`;

  const user = `Full scene exchange log:
${jsonBlock(request.exchanges)}

Roy's clock: ${jsonBlock(request.clock)}

Produce the SceneSummary JSON now.`;

  return { system, user };
}

/** 메인: 매크로 detail 턴 — 실제 서사 + 개연성 판단 + statImpact. */
export function buildMainTurnPrompt(request: MainTurnRequest, language: Language): PromptPair {
  const system = `${CHARACTER_AND_PRINCIPLES}

ROLE: You are the MAIN model, writing the actual scene for a 'detail' turn.

Decide:
- narrative: the scene itself, documentary tone, third person, present-to-past as appropriate. Long
  enough to feel like a real moment (a few sentences to a short paragraph), never padded.
- plausibilityJudgment: verdict ('reckless' | 'prepared' | 'neutral' — 'neutral' when nothing risky was
  attempted), citing specific recalledMemories ids that justify it, and successBias for how favorably
  this should resolve.
- statImpact: the concrete numeric consequence of this scene, if any (every field is optional — omit
  whatever isn't affected; an empty statImpact is normal and expected for most scenes). Deltas should be
  small and proportionate to a single scene, not life-changing swings, unless the scene truly is
  life-changing (e.g. losing a job, a major windfall).
- death: only if Roy's life plausibly ends in this exact scene. Otherwise omit it.
- entersScene: set this if the natural next step is a back-and-forth conversation/interaction that
  should be played out exchange-by-exchange (list the NPC ids present). Otherwise omit it.

You only see recalledMemories (a filtered subset of Roy's memory graph, by activation strength) — not his
whole life. Treat anything not listed there as something you don't currently recall, even if it might
exist elsewhere in his history.

${languageInstruction(language)} ${OMIT_OPTIONAL_FIELDS_INSTRUCTION}`;

  const user = `Roy's clock: ${jsonBlock(request.clock)}

Observable stats (what would be visible to an outside observer / Roy himself right now):
${jsonBlock(request.observable)}

Parsed intent for this turn:
${jsonBlock(request.intent)}

Recent log (oldest to newest):
${jsonBlock(request.recentLog)}

Recalled memories (activation-filtered, not the full graph):
${jsonBlock(request.recalledMemories)}

Produce the MainTurnResponse JSON now.`;

  return { system, user };
}

/** 메인: 씬 안에서 significant/판단 필요로 분류된 교환의 실제 응답. */
export function buildSceneTurnPrompt(request: SceneTurnRequest, language: Language): PromptPair {
  const system = `${CHARACTER_AND_PRINCIPLES}

ROLE: You are the MAIN model, writing one reply inside an ongoing scene with
${request.involvedNpcNames.join(', ') || 'someone'}. This exchange was flagged as significant and/or
needing a plausibility judgment, so you (not the router) write it.

Decide:
- reply: what the other person/people say or do in response, in character, documentary tone.
- plausibilityJudgment, statImpact, death: same rules as a detail turn — judge any risky/consequential
  attempt Roy just made in his line, citing recalledMemories, and reflect real numeric consequences.
- sceneEnded: true if this reply naturally closes the scene.

${languageInstruction(language)} ${OMIT_OPTIONAL_FIELDS_INSTRUCTION}`;

  const user = `Scene so far (oldest to newest):
${jsonBlock(request.exchangesSoFar)}

Roy's new line: ${JSON.stringify(request.playerInput)}

Recalled memories (activation-filtered, participant-perspective where applicable):
${jsonBlock(request.recalledMemories)}

Produce the SceneTurnResponse JSON now.`;

  return { system, user };
}
