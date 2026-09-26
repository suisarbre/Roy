# src/sim/input — 입력 해석기 + IR (6단계)

플레이어의 자유 텍스트를 "실타래 연산"(attend/open/advance/close/act) 중 하나로 확정하는
곳. LLM이 자유 서술을 받기 전에, 코드가 먼저 "무엇을 하려는 건가"를 결정적으로 정한다.

## 파일

| 파일 | 역할 |
|---|---|
| `types.ts` | `ThreadOperation`(IR) — attend/open/advance/close/act. 각 연산의 뜻은 파일 머리 주석 참고. |
| `similarity.ts` | 진짜 임베딩(transformers.js)이 들어갈 자리를 대신하는 값싼 근사 — 어절 포함 관계(`tokenOverlapCount`)와 문자 3-그램 자카드(`trigramSimilarity`, `bestTokenSimilarity`). |
| `interpret.ts` | `interpretInput` — 캐스케이드: 맥락 기본값 → 정규식 → 임베딩(자리 표시) → LLM 객관식(콜백) → 보수적 fallback(`act`). |
| `readiness.ts` | `computeReadiness` — "준비도"를 별도 스탯 없이 기억과의 유사도로 즉석 계산(`threads/types.ts`의 `TransitionState` 설계 참고). |
| `fixtures.ts` + `regressionCli.ts` | `npm run sim:input` 진입점. |

## 실행

```bash
npm run sim:input
```

## 정직하게 밝혀둘 것: "500개"가 아니라 46개다

설계 문서는 "오프라인 생성한 '상황+입력→기대 연산' 500개로 회귀 테스트"라고 되어 있다.
500개를 채우려면 실제 생성 파이프라인이나 상당한 수작업이 필요한데, 지금 그만큼 찍어내면
품질보다 숫자를 맞추는 꼴이 된다 — 대신 5개 연산 × 4개 해석 단계 + 모호해서 fallback으로
떨어져야 하는 경우를 고르게 커버하는 46개를 골랐다(`fixtures.ts` 머리 주석에도 같은 말을
적어뒀다). 나중에 진짜 500개로 늘릴 땐 `fixtures.ts`의 `INPUT_FIXTURES` 배열에 이어붙이면
된다 — 형식은 이미 잡혀 있다.

## 캐스케이드가 실제로 드러낸 것

fixtures.ts를 채우면서 이런 걸 알게 됐다:

- **한국어 조사/어미 때문에 정확 일치는 거의 항상 실패한다.** "신용카드 대금" 대 "신용카드값을"처럼
  명사에 조사가 그대로 붙으므로, `tokenOverlapCount`는 정확히 같은 어절이 아니라 포함
  관계(부분 문자열)로 판정한다. 이 기준을 적용하고 나니 애초에 "임베딩 전용"으로 의도했던
  사례 대부분이 사실 regex 단계에서 잡혔다 — `harness/README.md`의 3단계 교훈과
  비슷하게, 처음 가정이 실제로 돌려보기 전까진 안 맞았던 경우.
- **3-그램 유사도는 2글자 이하 짧은 한국어 명사엔 거의 무력하다.** 3-그램 자체가 최소
  3글자를 요구하는데, 한국어 명사는 2글자가 흔하다("엄마" vs "어머니"는 표면 문자가 아예
  안 겹쳐서 유사도 0). 순수 동의어 치환은 이 근사로 원천적으로 못 잡는다 — 진짜
  transformers.js로 바꿔야 풀리는 부분이고, `llm-4` 픽스처가 이 한계를 일부러 보여준다.
- **정규식 단계가 너무 강력해서 임베딩 단계가 거의 안 쓰인다.** 46개 중 1개만 embedding
  단계까지 간다(`emb-6`, 오타 사례). 포함 관계 판정이 조사/어미 변화 대부분을 이미
  커버하기 때문 — 진짜 게임에서 임베딩 단계가 자주 쓰일지는 실제 플레이 텍스트가 쌓여야
  알 수 있다.

## 미확정 (다음 단계에서 다룰 것)

- **`similarity.ts`는 transformers.js로 교체될 자리 표시다.** `(text, text) => number(0~1)`
  시그니처만 유지하면 `interpret.ts`/`readiness.ts`는 안 바뀐다.
- **IR 연산이 실제로 보드를 어떻게 바꾸는지는 이 단계 범위 밖이다** — `open`이 어떤 초기
  파라미터로 실타래를 만드는지, `advance`가 정확히 얼마나 진전시키는지는 콘텐츠가 붙는
  7~8단계 몫. 지금은 "텍스트 → 올바른 IR"까지만 검증했다.
- **`OPEN_STEMS`/`DOMAIN_STEMS`/`CLOSE_STEMS`/`ADVANCE_STEMS`는 46개 픽스처를 통과시키려고
  고른 값이지 언어학적으로 완비된 목록이 아니다** — 특히 1글자 스템(예: '몸','집','꿈')은
  다른 단어에 우연히 포함될 위험이 있다(work의 '일'을 빼야 했던 것과 같은 문제, 아직 다른
  스템은 감사하지 않았다).
- **`interpretInput`은 동기 함수라 `askLlmMultipleChoice`도 동기 콜백이다** — 실제 LLM
  호출은 비동기이므로, 7단계에서 실제 연결할 땐 이 시그니처를 비동기로 바꿔야 한다.
