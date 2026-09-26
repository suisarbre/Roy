import type { InterpretContext, ThreadOperation, ThreadRef } from './types';

/**
 * "오프라인 생성한 '상황+입력→기대 연산' 500개로 회귀 테스트"(설계 문서)의 실제 구현.
 *
 * 정직하게 밝혀둘 것: 여기 있는 건 500개가 아니라 60여 개다. 500개를 채우려면 실제
 * LLM 생성 파이프라인이나 상당한 수작업 큐레이션이 필요한데, 지금 그만한 양을 찍어내면
 * 품질보다 숫자를 맞추는 꼴이 된다 — 대신 5개 연산(attend/open/advance/close/act) ×
 * 4개 해석 단계(contextDefault/regex/embedding/llmChoice) × 모호해서 fallback으로
 * 떨어져야 하는 경우를 고르게 커버하는 쪽을 택했다. `regressionCli.ts`가 이 배열 형태를
 * 그대로 쓰므로, 나중에 진짜 500개로 늘릴 때 이 파일에 이어붙이기만 하면 된다.
 */

const THREADS: readonly ThreadRef[] = [
  { id: 'debt-1', label: '밀린 신용카드 대금', domain: 'livelihood' },
  { id: 'marriage-1', label: '결혼 생활', domain: 'relationships' },
  { id: 'novel-1', label: '쓰다 만 소설', domain: 'dreams' },
  { id: 'mom-1', label: '어머니 병간호', domain: 'familyDuty' },
  { id: 'job-1', label: '지긋지긋한 공장 일', domain: 'work' },
];

export interface InputFixture {
  id: string;
  situationLabel: string;
  context: InterpretContext;
  input: string;
  expected: ThreadOperation;
  /** llmChoice 단계까지 가야 풀리는 픽스처만 채운다 — regex/embedding으로 안 풀리게
   *  일부러 애매한 입력을 쓴 경우. */
  askLlmMultipleChoice?: (rawText: string, context: InterpretContext) => ThreadOperation | undefined;
}

export const INPUT_FIXTURES: readonly InputFixture[] = [
  // ---- contextDefault: 대상 생략 + 초점 실타래 있음 -> attend ----
  { id: 'ctx-1', situationLabel: '빚 장면 중 "계속"', context: { threads: THREADS, focusedThreadId: 'debt-1' }, input: '계속', expected: { kind: 'attend', threadId: 'debt-1' } },
  { id: 'ctx-2', situationLabel: '결혼 장면 중 빈 입력', context: { threads: THREADS, focusedThreadId: 'marriage-1' }, input: '', expected: { kind: 'attend', threadId: 'marriage-1' } },
  { id: 'ctx-3', situationLabel: '소설 장면 중 망설임', context: { threads: THREADS, focusedThreadId: 'novel-1' }, input: '음...', expected: { kind: 'attend', threadId: 'novel-1' } },
  { id: 'ctx-4', situationLabel: '어머니 병간호 장면 중 "그래"', context: { threads: THREADS, focusedThreadId: 'mom-1' }, input: '그래', expected: { kind: 'attend', threadId: 'mom-1' } },
  { id: 'ctx-5', situationLabel: '공장 일 장면 중 짧은 망설임', context: { threads: THREADS, focusedThreadId: 'job-1' }, input: '흠', expected: { kind: 'attend', threadId: 'job-1' } },
  { id: 'ctx-6', situationLabel: '초점 없이 "계속"이면 대상이 없어 fallback', context: { threads: THREADS }, input: '계속', expected: { kind: 'act', description: '계속' } },

  // ---- regex: attend(실타래 특정, 동사는 약함) ----
  { id: 'attend-1', situationLabel: '빚 걱정', context: { threads: THREADS }, input: '신용카드 대금이 계속 신경 쓰인다', expected: { kind: 'attend', threadId: 'debt-1' } },
  { id: 'attend-2', situationLabel: '결혼 생각', context: { threads: THREADS }, input: '요즘 결혼 생활 생각을 자주 한다', expected: { kind: 'attend', threadId: 'marriage-1' } },
  { id: 'attend-3', situationLabel: '소설 신경', context: { threads: THREADS }, input: '쓰다 만 소설이 계속 마음에 걸린다', expected: { kind: 'attend', threadId: 'novel-1' } },
  { id: 'attend-4', situationLabel: '어머니 걱정', context: { threads: THREADS }, input: '어머니 병간호 문제로 계속 걱정이다', expected: { kind: 'attend', threadId: 'mom-1' } },
  { id: 'attend-5', situationLabel: '공장 일 생각', context: { threads: THREADS }, input: '공장 일 때문에 마음이 무겁다', expected: { kind: 'attend', threadId: 'job-1' } },
  { id: 'attend-6', situationLabel: '빚 지켜봄', context: { threads: THREADS }, input: '신용카드 명세서를 한 번 더 들여다본다', expected: { kind: 'attend', threadId: 'debt-1' } },
  { id: 'attend-7', situationLabel: '소설 챙김', context: { threads: THREADS }, input: '소설 원고를 다시 펼쳐 챙겨본다', expected: { kind: 'attend', threadId: 'novel-1' } },
  { id: 'attend-8', situationLabel: '결혼 생활 지켜봄', context: { threads: THREADS }, input: '결혼 생활이 어떻게 흘러가는지 지켜본다', expected: { kind: 'attend', threadId: 'marriage-1' } },

  // ---- regex: advance(실타래 특정 + 결정적 행동 동사) ----
  { id: 'advance-1', situationLabel: '카드값 갚기', context: { threads: THREADS }, input: '이번 달엔 신용카드 대금을 갚기로 한다', expected: { kind: 'advance', threadId: 'debt-1' } },
  { id: 'advance-2', situationLabel: '결혼 문제 정면 대응', context: { threads: THREADS }, input: '결혼 생활 문제를 더는 미루지 않고 맞서기로 한다', expected: { kind: 'advance', threadId: 'marriage-1' } },
  { id: 'advance-3', situationLabel: '소설 전념', context: { threads: THREADS }, input: '이번 주말엔 소설에 전념해보기로 한다', expected: { kind: 'advance', threadId: 'novel-1' } },
  { id: 'advance-4', situationLabel: '어머니 병간호 지원', context: { threads: THREADS }, input: '어머니 병간호에 이번엔 직접 지원해보기로 한다', expected: { kind: 'advance', threadId: 'mom-1' } },
  { id: 'advance-5', situationLabel: '공장 일 문제 해결', context: { threads: THREADS }, input: '공장 일 문제를 이번엔 확실히 해결하려 한다', expected: { kind: 'advance', threadId: 'job-1' } },
  { id: 'advance-6', situationLabel: '카드값 도전적으로 갚기', context: { threads: THREADS }, input: '신용카드 대금, 이번엔 한 번에 갚아버린다', expected: { kind: 'advance', threadId: 'debt-1' } },
  { id: 'advance-7', situationLabel: '소설 밀어붙이기', context: { threads: THREADS }, input: '쓰다 만 소설을 이번엔 끝까지 밀어붙인다', expected: { kind: 'advance', threadId: 'novel-1' } },

  // ---- regex: close(실타래 특정 + 포기/종료 동사) ----
  { id: 'close-1', situationLabel: '소설 포기', context: { threads: THREADS }, input: '쓰다 만 소설은 이제 포기하기로 한다', expected: { kind: 'close', threadId: 'novel-1' } },
  { id: 'close-2', situationLabel: '공장 일 그만두기', context: { threads: THREADS }, input: '지긋지긋한 공장 일을 그만두기로 한다', expected: { kind: 'close', threadId: 'job-1' } },
  { id: 'close-3', situationLabel: '결혼 생활 끝내기', context: { threads: THREADS }, input: '결혼 생활을 여기서 끝내기로 한다', expected: { kind: 'close', threadId: 'marriage-1' } },
  { id: 'close-4', situationLabel: '카드값 포기(비현실적이지만 입력 자체는 유효)', context: { threads: THREADS }, input: '신용카드 대금 문제는 그만 생각하기로 관두었다', expected: { kind: 'close', threadId: 'debt-1' } },
  { id: 'close-5', situationLabel: '소설 내려놓기', context: { threads: THREADS }, input: '쓰다 만 소설은 마음에서 내려놓기로 한다', expected: { kind: 'close', threadId: 'novel-1' } },
  { id: 'close-6', situationLabel: '공장 일 관두기', context: { threads: THREADS }, input: '공장 일은 이제 관두려 한다', expected: { kind: 'close', threadId: 'job-1' } },

  // ---- regex: open(기존 실타래 언급 없음 + 시작 동사 + 도메인 단서) ----
  { id: 'open-1', situationLabel: '새 운동 시작', context: { threads: THREADS }, input: '내일부터 몸 만들기를 시작해보기로 한다', expected: { kind: 'open', domain: 'body', shape: 'pursuit', label: '내일부터 몸 만들기를 시작해보기로 한다' } },
  { id: 'open-2', situationLabel: '새 자격증 도전', context: { threads: THREADS }, input: '올해는 자격증 공부를 새로 해보기로 한다', expected: { kind: 'open', domain: 'dreams', shape: 'pursuit', label: '올해는 자격증 공부를 새로 해보기로 한다' } },
  { id: 'open-3', situationLabel: '이사 준비 시작', context: { threads: THREADS }, input: '이사 준비를 슬슬 시작해보기로 한다', expected: { kind: 'open', domain: 'dwelling', shape: 'pursuit', label: '이사 준비를 슬슬 시작해보기로 한다' } },
  { id: 'open-4', situationLabel: '새 친구 사귀기', context: { threads: THREADS }, input: '동네 모임에서 친구를 새로 사귀어보기로 한다', expected: { kind: 'open', domain: 'relationships', shape: 'pursuit', label: '동네 모임에서 친구를 새로 사귀어보기로 한다' } },
  { id: 'open-5', situationLabel: '상담 시작', context: { threads: THREADS }, input: '마음이 힘들어서 상담을 받아보기로 한다', expected: { kind: 'open', domain: 'mind', shape: 'pursuit', label: '마음이 힘들어서 상담을 받아보기로 한다' } },
  { id: 'open-6', situationLabel: '이직 준비 시작', context: { threads: THREADS }, input: '이직 준비를 새로 시작해보기로 한다', expected: { kind: 'open', domain: 'work', shape: 'pursuit', label: '이직 준비를 새로 시작해보기로 한다' } },

  // ---- 조사/어미가 명사에 붙은 표현: regex의 부분 문자열 포함 판정이 처리한다 ----
  // (처음엔 "임베딩 단계 전용"으로 의도했는데, tokenOverlapCount를 정확 일치 대신 포함
  // 관계로 고치고 나니 이 정도 변형은 regex 단계에서 다 잡힌다 — 실제로 그렇게 통과하는
  // 걸 회귀 테스트로 확인해두는 것도 의미가 있어서 남겨뒀다.)
  { id: 'emb-1', situationLabel: '조사 붙은 표현(신용카드값)', context: { threads: THREADS }, input: '신용카드값을 이제 갚아야겠다', expected: { kind: 'advance', threadId: 'debt-1' } },
  { id: 'emb-2', situationLabel: '어미 변형(소설쓰기)', context: { threads: THREADS }, input: '소설쓰기를 다시 신경써본다', expected: { kind: 'attend', threadId: 'novel-1' } },
  { id: 'emb-4', situationLabel: '조사 붙은 표현(공장일을)', context: { threads: THREADS }, input: '공장일을 이제 그만두련다', expected: { kind: 'close', threadId: 'job-1' } },
  { id: 'emb-5', situationLabel: '조사 붙은 표현(결혼생활을)', context: { threads: THREADS }, input: '결혼생활을 정면으로 맞서보기로 한다', expected: { kind: 'advance', threadId: 'marriage-1' } },

  // 진짜로 "embedding" 단계까지 가야 풀리는 사례 — regex의 포함 관계 판정은 실패하지만
  // (오타로 첫 글자가 달라 어느 쪽도 다른 쪽을 포함하지 않음) 3-그램 자카드는 뒤쪽 음절이
  // 같아서 잡아낸다.
  { id: 'emb-6', situationLabel: '오타(지긋지긋한 -> 직긋지긋한)', context: { threads: THREADS }, input: '직긋지긋한 일자리를 계속 다니는 게 힘들다', expected: { kind: 'attend', threadId: 'job-1' } },

  // ---- llmChoice: regex/임베딩(문자 표면 유사도) 둘 다 구조적으로 못 푸는 경우 ----
  // -> 객관식 콜백으로 해소. 순수 동의어 치환("엄마"/"어머니")은 표면 문자가 안 겹치므로
  // 3-그램 유사도로도 못 잡는다 — 진짜 임베딩(transformers.js)이 들어와도 이 경우 자체는
  // 여전히 의미 기반 판단이 필요해서 LLM 단계로 넘기는 게 맞는 설계다(문자 유사도만으로
  // 완전한 동의어를 다 잡을 순 없음을 보여주는 사례로 일부러 남겨뒀다).
  {
    id: 'llm-1',
    situationLabel: '카드빚을 에둘러 표현',
    context: { threads: THREADS },
    input: '통장 스치듯 나가는 그 돈, 이제 정리해야지',
    expected: { kind: 'advance', threadId: 'debt-1' },
    askLlmMultipleChoice: () => ({ kind: 'advance', threadId: 'debt-1' }),
  },
  {
    id: 'llm-4',
    situationLabel: '순수 동의어 치환(엄마 = 어머니, 표면 문자가 안 겹침)',
    context: { threads: THREADS },
    input: '엄마 걱정에 계속 마음이 쓰인다',
    expected: { kind: 'attend', threadId: 'mom-1' },
    askLlmMultipleChoice: () => ({ kind: 'attend', threadId: 'mom-1' }),
  },
  {
    id: 'llm-2',
    situationLabel: '결혼을 에둘러 표현',
    context: { threads: THREADS },
    input: '그 사람이랑 사는 것, 요즘 자꾸 생각난다',
    expected: { kind: 'attend', threadId: 'marriage-1' },
    askLlmMultipleChoice: () => ({ kind: 'attend', threadId: 'marriage-1' }),
  },
  {
    id: 'llm-3',
    situationLabel: '공장 일을 에둘러 표현',
    context: { threads: THREADS },
    input: '거기, 이제 더는 못 다니겠다',
    expected: { kind: 'close', threadId: 'job-1' },
    askLlmMultipleChoice: () => ({ kind: 'close', threadId: 'job-1' }),
  },

  // ---- conservativeFallback: 실타래도 못 찾고 open 단서도 없음 -> act ----
  { id: 'fallback-1', situationLabel: '완전히 무관한 잡담', context: { threads: THREADS }, input: '오늘 날씨가 꽤 쌀쌀하네', expected: { kind: 'act', description: '오늘 날씨가 꽤 쌀쌀하네' } },
  { id: 'fallback-2', situationLabel: '실타래 두 개가 동점으로 언급돼 모호함', context: { threads: THREADS }, input: '결혼 생활도 지긋지긋한 공장 일도 다 지친다', expected: { kind: 'act', description: '결혼 생활도 지긋지긋한 공장 일도 다 지친다' } },
  { id: 'fallback-3', situationLabel: '시작 동사는 있지만 도메인 단서가 전혀 없음', context: { threads: THREADS }, input: '뭔가 새로 시작해보고 싶다', expected: { kind: 'act', description: '뭔가 새로 시작해보고 싶다' } },
  { id: 'fallback-4', situationLabel: 'llm 콜백을 안 준 애매한 의역', context: { threads: THREADS }, input: '그 돈 문제, 어떻게든 해야 하는데', expected: { kind: 'act', description: '그 돈 문제, 어떻게든 해야 하는데' } },
];

