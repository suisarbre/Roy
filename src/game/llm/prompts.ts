import type { Language } from '../../i18n';
import type { SceneSummaryRequest, SceneTurnRequest, TurnRequest } from './types';

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
 * 캐릭터 설정 + 문서 핵심 원칙. 모든 호출의 system prompt 공통 도입부로 쓴다.
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
with no dramatic buildup, exactly as in real life. Do not reserve death only for climactic moments. (Note:
an unforeseeable sudden death during ordinary time passing is decided by the game engine itself, not you —
you only decide death when it's a direct, plausible consequence of the scene you're writing.)

CORE PRINCIPLE — memory: you only ever see a curated subset of Roy's memories (already filtered for you),
never his whole life. Treat what you don't see as genuinely unknown to you, not as something to infer.`;

function languageInstruction(language: Language): string {
  return `Respond in ${LANGUAGE_NAMES[language]}. Every free-text field (narrative, reply, content, label, cause, etc.) must be written in ${LANGUAGE_NAMES[language]}. Field names and enum values themselves stay in English exactly as specified by the schema.`;
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

const OUTCOME_IMPACT_INSTRUCTION = `- outcomeImpact: the concrete consequence of this moment, if any — omit entirely if nothing changed (that's
  the normal case for most turns). When something did change, give ONE axis it primarily affects
  ('finance' | 'health' | 'mentalHealth' | 'relationship'), a direction, and a magnitude
  ('minor' | 'moderate' | 'major') proportionate to this single moment — not life-changing swings, unless
  the moment truly is life-changing (losing a job, a major windfall, a death in the family). direction
  means "good or bad for Roy", not a literal increase/decrease: 'positive' = more money (finance),
  recovering/improving (health), feeling better/less stressed (mentalHealth), or a warmer relationship
  (relationship); 'negative' = the opposite of each. For axis 'relationship' you must also set
  relationshipNpcId. For axis 'health' with a negative direction, you may set note to a short label for
  what's emerging (e.g. "early-stage hypertension") — leave it out for a generic unspecified issue.
- newVisibleSymptom: only if a mental-health symptom becomes outwardly visible in this exact moment
  (insomnia, irritability, fatigue, appetiteChange, lossOfInterest, panicEpisode). Omit otherwise.`;

export interface PromptPair {
  system: string;
  user: string;
}

/**
 * 단일 모델의 메인 호출 — 트리거 종류에 따라 지시문이 달라진다: playerAction(플레이어가
 * 직접 입력), eraEvent(코드가 이미 "지금이 그 순간"이라고 정한 시대 이벤트), threadScene
 * (8단계(1차) — 실타래 엔진이 매달 결정적으로 진행시키다 현저성 문턱을 넘긴 순간. 낡은
 * unpromptedEvent(12% 확률의 순수 즉흥)와 달리 어느 실타래가, 왜 지금 눈에 띄었는지 구조화된
 * 근거가 있다). turnType/elapsedMonths/eraEventTriggered 판단은 전부 코드가 이미 끝냈으므로
 * 스키마에서 아예 빠졌다 — 모델은 "무슨 일이 있었는지"만 쓰면 된다.
 */
/**
 * 7단계(LLM 축소)에서 트리거별 지시문(TRIGGER: ...)을 system에서 user로 옮겼다 — system은
 * 이제 트리거 종류와 무관하게 항상 완전히 같은 문자열이다("고정부 앞, 가변부 뒤": 호출마다
 * 달라지는 내용은 전부 user 쪽에 몰아서, system이 매번 토씨 하나 안 바뀌는 안정적인 접두부가
 * 되게 한다 — KV 캐시/prefix 재사용의 전제조건).
 */

/** ThreadEventTag(sim/threads/types.ts) -> LLM에게 줄 짧은 영어 힌트. 플레이어에게 보이는
 *  텍스트가 아니라 프롬프트 컨텍스트일 뿐이라 여기 있는 게 맞다(narrative 자체는 여전히
 *  모델이 자유롭게 씀). 이벤트 태그가 없는 경우(잔잔한 진행)는 THREAD_EVENT_HINTS 밖에서
 *  별도 기본 문구로 처리한다. */
const THREAD_EVENT_HINTS: Record<string, string> = {
  debtResolved: 'it has finally been paid off/resolved',
  debtEscalated: 'it just escalated to a worse stage (e.g. collections, legal action)',
  debtDeescalated: 'consistent effort has eased it back a stage',
  debtCrisis: 'it has spiraled into a full-blown crisis',
  decayFizzled: "it's quietly petered out — no longer worth Roy's attention",
  decayResolved: "it's been brought back to a healthy, stable state",
  decayCrossedCritical: "it just crossed into a critical, hard-to-reverse state from neglect",
  pursuitResolved: 'Roy has actually achieved/completed it',
  pursuitAbandoned: "Roy has quietly given up on it",
  dormantForcedSurface: 'something hidden about this is forcing its way into the open right now',
  dormantSignal: 'a small, ambiguous sign of it has just leaked through',
  dormantFalseSignal: 'something LOOKED like a sign of it, but treat it as a false alarm — nothing is actually confirmed',
  pressureIgnoredToResolution: 'ignoring it has, unexpectedly, brought it to a resolution',
  pressureIgnoredToTransform: 'ignoring it has let it curdle into something worse and different',
  pressureEscalated: 'the deadline/pressure just escalated a notch',
  transitionArrived: "the fixed date it was always heading toward has arrived",
};

function turnTriggerInstruction(trigger: TurnRequest['trigger']): string {
  switch (trigger.kind) {
    case 'playerAction':
      return `Roy just did/said this: ${JSON.stringify(trigger.playerInput)}. Write the scene that plays out from this attempt.`;
    case 'eraEvent':
      return `This is precisely the moment Roy experiences a real historical event: "${trigger.definition.label}" (${trigger.definition.eligibilityDescription}). Write how it touches his life right now — this is not something Roy chose, it's happening to/around him.`;
    case 'threadScene': {
      const hint = trigger.event.event ? THREAD_EVENT_HINTS[trigger.event.event] : undefined;
      const whatHappened = hint ?? "nothing dramatic has changed, but it's been quietly present enough in the background that it's worth a moment's notice now";
      return `A long-running thread in Roy's life just became worth noticing: "${trigger.thread.label}" (domain: ${trigger.thread.domain}). How it started: ${trigger.thread.origin}. What's true right now: ${whatHappened}. Write the scene that captures this moment as a natural continuation of this thread — not a random unrelated event.`;
    }
  }
}

export function buildTurnPrompt(request: TurnRequest, language: Language): PromptPair {
  const system = `${CHARACTER_AND_PRINCIPLES}

ROLE: You write ONE scene/moment and its consequences, given a TRIGGER described in the user message.

Decide:
- narrative: the scene itself, documentary tone, third person. Keep it TIGHT: 2-4 sentences is the norm.
  Only go longer when the moment is genuinely pivotal (a death, a life-altering decision) — never pad an
  ordinary scene to sound more literary.
- plausibilityJudgment: verdict ('reckless' | 'prepared' | 'neutral' — 'neutral' when this wasn't really an
  attempt at anything, e.g. most eraEvent/threadScene moments), citing specific recalledMemories ids
  that justify it, and successBias for how favorably this should resolve.
${OUTCOME_IMPACT_INSTRUCTION}
- death: only if Roy's life plausibly ends in this exact moment. Otherwise omit it.
- entersScene: set this if the natural next step is a back-and-forth conversation/interaction that should
  be played out exchange-by-exchange (list the NPC ids present). Otherwise omit it.

You only see recalledMemories (a filtered subset of Roy's memory graph, by activation strength) — not his
whole life. Treat anything not listed there as something you don't currently recall, even if it might
exist elsewhere in his history.

${languageInstruction(language)} ${OMIT_OPTIONAL_FIELDS_INSTRUCTION}`;

  const user = `TRIGGER: ${turnTriggerInstruction(request.trigger)}

Roy's clock: ${jsonBlock(request.clock)}

Observable stats (what would be visible to an outside observer / Roy himself right now):
${jsonBlock(request.observable)}

Known NPC names: ${jsonBlock(request.knownNpcNames)}

Recent log (oldest to newest):
${jsonBlock(request.recentLog)}

Recalled memories (activation-filtered, not the full graph):
${jsonBlock(request.recalledMemories)}

Produce the TurnResponse JSON now.`;

  return { system, user };
}

/** 씬 안에서 significant/판단 필요로 분류된 교환의 실제 응답. (분류 단계는 없어졌다 — 라우터가
 *  없으므로 모든 교환이 이 호출 하나로 처리된다.) involvedNpcNames는 씬마다 달라지므로 system이
 *  아니라 user로 뺐다 — system은 어떤 씬이든 완전히 같은 문자열("고정부 앞, 가변부 뒤"). */
export function buildSceneTurnPrompt(request: SceneTurnRequest, language: Language): PromptPair {
  const system = `${CHARACTER_AND_PRINCIPLES}

ROLE: You are writing one reply inside an ongoing scene, given the people present in the user message.

Decide:
- reply: what the other person/people say or do in response, in character, documentary tone. Keep it
  TIGHT: 1-3 sentences is the norm for a single conversational beat — this is one exchange, not a monologue.
- plausibilityJudgment: judge any risky/consequential attempt Roy just made in his line, citing
  recalledMemories. Use 'neutral' for ordinary small talk with nothing to judge.
${OUTCOME_IMPACT_INSTRUCTION}
- death: only if Roy's life plausibly ends in this exact exchange. Otherwise omit it.
- sceneEnded: true if this reply naturally closes the scene.

${languageInstruction(language)} ${OMIT_OPTIONAL_FIELDS_INSTRUCTION}`;

  const user = `People present in this scene: ${request.involvedNpcNames.join(', ') || 'someone'}

Scene so far (oldest to newest):
${jsonBlock(request.exchangesSoFar)}

Roy's new line: ${JSON.stringify(request.playerInput)}

Recalled memories (activation-filtered, participant-perspective where applicable):
${jsonBlock(request.recalledMemories)}

Produce the SceneTurnResponse JSON now.`;

  return { system, user };
}

/** 씬 종료 시 전체 교환을 매크로 로그 한 줄로 압축. 그래프 델타/신규 NPC 추출은 7단계에서
 *  빠졌다 — gameLoop.ts가 이 narrative를 memoryExtraction.ts에 넘겨 코드로 직접 뽑는다. */
export function buildSceneSummaryPrompt(request: SceneSummaryRequest, language: Language): PromptPair {
  const system = `${CHARACTER_AND_PRINCIPLES}

ROLE: A scene has just ended, given the people present in the user message. Compress the whole exchange
log into:
- narrative: ONE compact sentence or two for the macro life-log (documentary tone), summarizing what
  this scene amounted to, not a transcript.
- elapsedMonths: how much game time this scene itself consumed (usually 0 — it's a single sitting).

${languageInstruction(language)} ${OMIT_OPTIONAL_FIELDS_INSTRUCTION}`;

  const user = `People present in this scene: ${request.involvedNpcNames.join(', ') || 'someone'}

Full scene exchange log:
${jsonBlock(request.exchanges)}

Roy's clock: ${jsonBlock(request.clock)}

Produce the SceneSummary JSON now.`;

  return { system, user };
}
