import type { ThreadDomain } from '../threads/types';
import { bestTokenSimilarity, tokenOverlapCount } from './similarity';
import type { InterpretContext, ThreadOperation, ThreadRef } from './types';

/**
 * 입력 해석 캐스케이드 — 설계 문서: "맥락 기본값 → 정규식 → 임베딩 → LLM 객관식. 애매하면
 * 보수적 해석." 앞 단계가 확신을 못 가지면 다음 단계로 넘긴다(비싼 단계는 필요할 때만).
 * 전부 실패하면 실타래를 건드리지 않는 `act`로 떨어진다 — 잘못 추측해서 실타래를 닫거나
 * 여는 것보다 "일단 서술만 하고 넘어가는" 게 항상 더 안전하다.
 */

const CONTINUE_PHRASES = ['', '계속', '음', '흠', '그래', '어'];

const CLOSE_STEMS = ['포기', '그만두', '그만할', '관두', '끝내', '접기로', '그만둘', '내려놓'];
const ADVANCE_STEMS = ['갚', '고백', '지원해', '도전해', '밀어붙', '맞서', '해결하', '전념'];
/** "~아/어 보기로 하다"(시도/결심) 패턴이 한국어에서 가장 흔한 "새로 시작한다"는 신호라
 *  '보기로' 하나로 넓게 잡는다 — 사귀어보기로/받아보기로/시작해보기로 전부 여기 걸린다. */
const OPEN_STEMS = ['시작해', '시작하', '새로', '보기로', '해볼까'];

/** 1글자 스템은 넣지 않는다 — 예: work에 '일'을 넣으면 "내일"(tomorrow) 안의 '일'까지
 *  단순 부분 문자열로 걸려서 엉뚱한 도메인으로 오탐한다(open-1에서 실제로 발생 확인). */
const DOMAIN_STEMS: Record<ThreadDomain, readonly string[]> = {
  livelihood: ['생활비', '월세', '대출', '카드값', '카드빚'],
  work: ['직장', '이직', '회사', '업무', '취직'],
  body: ['몸', '건강', '병원', '운동', '다이어트'],
  mind: ['마음', '기분', '우울', '스트레스', '상담'],
  relationships: ['친구', '연애', '사람', '우정', '데이트'],
  familyDuty: ['부모', '가족', '엄마', '아빠', '형제', '부양'],
  dwelling: ['집', '이사', '거처', '전셋집'],
  dreams: ['꿈', '목표', '소설', '창업', '자격증', '오디션'],
};

function includesAny(text: string, stems: readonly string[]): boolean {
  return stems.some((stem) => text.includes(stem));
}

function inferDomain(text: string): ThreadDomain | undefined {
  for (const [domain, stems] of Object.entries(DOMAIN_STEMS) as [ThreadDomain, readonly string[]][]) {
    if (includesAny(text, stems)) return domain;
  }
  return undefined;
}

/** 정규식 단계용 — 어절이 겹치는 게 확실할 때만 쓴다(동점이면 모호하다고 보고 포기). */
function findBestMatchingThread(rawText: string, threads: readonly ThreadRef[]): ThreadRef | undefined {
  if (threads.length === 0) return undefined;
  const scored = threads.map((thread) => ({ thread, score: tokenOverlapCount(rawText, thread.label) }));
  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score === 0) return undefined;
  if (scored.length > 1 && scored[1].score === scored[0].score) return undefined;
  return scored[0].thread;
}

/** 임베딩(자리 표시) 단계용 — regex보다 느슨하게, 그래도 2등과 확실히 차이 날 때만 확정. */
function findBestMatchingThreadFuzzy(rawText: string, threads: readonly ThreadRef[], threshold: number): ThreadRef | undefined {
  if (threads.length === 0) return undefined;
  const scored = threads.map((thread) => ({ thread, score: bestTokenSimilarity(rawText, thread.label) }));
  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score < threshold) return undefined;
  if (scored.length > 1 && scored[0].score - scored[1].score < 0.05) return undefined;
  return scored[0].thread;
}

function operationForMatchedThread(rawText: string, threadId: string): ThreadOperation {
  if (includesAny(rawText, CLOSE_STEMS)) return { kind: 'close', threadId };
  if (includesAny(rawText, ADVANCE_STEMS)) return { kind: 'advance', threadId };
  return { kind: 'attend', threadId }; // 실타래는 특정됐는데 동사가 애매하면 가장 약한 해석.
}

function tryContextDefault(rawText: string, context: InterpretContext): ThreadOperation | undefined {
  if (!context.focusedThreadId) return undefined;
  // 말줄임표/감탄사 뒤에 붙는 점(...) 정도는 지우고 비교한다 — "음...", "그래.." 전부
  // "특별히 할 말 없음"이라는 같은 신호다.
  const normalized = rawText.trim().replace(/[.…~!?]+$/u, '');
  if (!CONTINUE_PHRASES.includes(normalized)) return undefined;
  return { kind: 'attend', threadId: context.focusedThreadId };
}

function tryRegex(rawText: string, context: InterpretContext): ThreadOperation | undefined {
  const matched = findBestMatchingThread(rawText, context.threads);
  if (matched) return operationForMatchedThread(rawText, matched.id);

  if (includesAny(rawText, OPEN_STEMS)) {
    const domain = inferDomain(rawText);
    if (domain) return { kind: 'open', domain, shape: 'pursuit', label: rawText.slice(0, 40) };
  }
  return undefined;
}

function tryEmbedding(rawText: string, context: InterpretContext, threshold: number): ThreadOperation | undefined {
  const matched = findBestMatchingThreadFuzzy(rawText, context.threads, threshold);
  return matched ? operationForMatchedThread(rawText, matched.id) : undefined;
}

function conservativeFallback(rawText: string): ThreadOperation {
  return { kind: 'act', description: rawText };
}

export type InterpretationStage = 'contextDefault' | 'regex' | 'embedding' | 'llmChoice' | 'conservativeFallback';

export interface InterpretResult {
  operation: ThreadOperation;
  stage: InterpretationStage;
}

export interface InterpretOptions {
  /** similarity.ts의 trigramSimilarity 문턱 — 이 이상이고 2등과 확실히 벌어져야 확정한다. */
  embeddingThreshold?: number;
  /** 앞 세 단계가 다 실패했을 때 마지막으로 물어볼 LLM 객관식. 동기 콜백으로 받는다 —
   *  헤드리스 회귀 테스트(fixtures.ts)에서는 보통 안 주거나 고정 응답만 준다. 실제 게임
   *  연결은 7단계(LLM 축소) 이후. */
  askLlmMultipleChoice?: (rawText: string, context: InterpretContext) => ThreadOperation | undefined;
}

const DEFAULT_EMBEDDING_THRESHOLD = 0.25;

export function interpretInput(rawText: string, context: InterpretContext, options: InterpretOptions = {}): InterpretResult {
  const contextDefault = tryContextDefault(rawText, context);
  if (contextDefault) return { operation: contextDefault, stage: 'contextDefault' };

  const regexResult = tryRegex(rawText, context);
  if (regexResult) return { operation: regexResult, stage: 'regex' };

  const embeddingResult = tryEmbedding(rawText, context, options.embeddingThreshold ?? DEFAULT_EMBEDDING_THRESHOLD);
  if (embeddingResult) return { operation: embeddingResult, stage: 'embedding' };

  const llmResult = options.askLlmMultipleChoice?.(rawText, context);
  if (llmResult) return { operation: llmResult, stage: 'llmChoice' };

  return { operation: conservativeFallback(rawText), stage: 'conservativeFallback' };
}
