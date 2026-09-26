# src/sim — Roy 설계 개편의 새 엔진

LLM/브라우저 없이 순수 함수 + 시드 RNG로 동작하는 새 시뮬레이션 엔진. 1~7단계는
`gameLoop.ts`(기존 루프)를 건드리지 않고 여기서 따로 만들어 봇으로 검증했지만, 8단계
1차부터는 `gameLoop.ts`가 이 엔진(`storyteller.ts`의 `simulateUntilScene`)을 실제로
호출한다 — 더 이상 완전히 분리된 상태가 아니다. 하위 폴더는 각자 README가 있다 — 이
파일은 전체 지도 역할만 한다.

## 폴더

| 폴더 | 단계 | 역할 |
|---|---|---|
| `threads/` | 2단계 | 실타래 코어 — 타입, 6개 모양(부채/부식/추구/잠복/압력/이행)의 tick 순수 함수, 관심 배분, 보드 오케스트레이터. |
| `data/` | 3단계 | 세계 데이터 — CPI, 임금, 실업률, 주택, 생명표, 검증 타깃. |
| `harness/` | 3, 5단계 | 헤드리스 몬테카를로(`npm run sim`) + 장면 빈도/영역 비율 측정(`npm run sim:scenes`). LLM 없이 봇으로 정책을 검증하는 곳 전부 여기. |
| `npc/` | 4단계 | NPC LOD(시뮬레이션 해상도) + 지연 평가 + 실타래 충돌 감지(`npm run sim:npc`). |
| `input/` | 6단계 | 입력 해석기 + IR(attend/open/advance/close/act) — `npm run sim:input`. |

## 최상위 파일

| 파일 | 역할 |
|---|---|
| `rng.ts` | mulberry32 시드 RNG — sim/ 전체가 `Math.random()` 대신 이걸 쓴다(재현성). |
| `gameDate.ts` | `GameDate` 산술(월수 변환, 나이 계산) — 여러 곳에 흩어져 있던 걸 4단계에서 여기로 모았다. |
| `attend.ts` | `PolicyBot` 타입 + `randomPolicy`/`domainPriorityPolicy` — "누가 매달 무엇에 관심을 배분하는가"의 공용 추상화. harness의 정책 봇도 npc의 기질(temperament)도 이 타입 하나. |
| `hazards.ts`, `lifeCourse.ts` | 인구 통계 수준 생애사건 해저드 — 원래 harness 전용이었는데 4단계에서 npc의 지연 평가도 재사용하도록 공용으로 승격. |
| `salience.ts` | 5단계 — 현저성 공식(긴급도 × 판돈 × 인지 필터 × (1+관심 EMA) × 피로 감쇠 + 병치 보너스). |
| `storyteller.ts` | 5단계 — 문턱 편집 + 소프트맥스 샘플링(`selectScene`) + 피로 갱신(`applyStorytellerFatigue`) + "의미 있는 일이 생길 때까지 조용히 흘려보내는" 오케스트레이터(`simulateUntilScene`) — `gameLoop.ts`의 고정 범위 스킵을 대체할 원형. |

## 진행 상태 (2026-09-26 기준)

1~7단계 완료. 8, 9단계는 각각 1차(핵심 부분) 완료 — 나머지는 후속 작업으로 남김.

7단계(LLM 축소)는 이 폴더가 아니라 `src/game/`(기존 루프) 쪽에서 진행됐다 — 그 안에서
모델이 내던 memoryGraphDelta/newNpcs를 `src/game/memoryExtraction.ts`(경량 NER +
`sim/input/similarity.ts`와 같은 표면 유사도 근사)로 대체했다. 모델 스키마
(`src/game/llm/schemas.ts`)는 이제 narrative + 판정/영향/사망/씬진입만 낸다. 검증:
`npm run check:memory-extraction`.

**8단계 1차** — `gameLoop.ts`의 `decideSkipStretch`(6~18개월 무작위 스킵 + 12% 확률
돌발 사건)를 이 엔진의 `simulateUntilScene`으로 교체했다: "계속하기"마다 실타래 보드가
매달 결정적으로 진행되다 현저성 문턱을 넘기면 그 순간이 장면화된다(`TurnTrigger`의
`threadScene` — 낡은 `unpromptedEvent`를 대체). 시대 이벤트/급사는 그대로 코드 결정적으로
유지(우선순위: 시대 이벤트 > 급사 > 실타래 장면/조용한 스킵). `SharedResources.money`/
`stress`는 `HiddenStats.finance.netWorth`/`mentalHealth.stressAccumulation`에서 매
사이클 재시딩되고 tick 후 델타만 되돌려 써넣는 방식으로 동기화(`threads/types.ts`의
`SharedResources` 주석 참고). 최소 시드 콘텐츠(`src/game/threadContent.ts`)로 13세부터
`work`/`body` 실타래를 하나씩 연다. 기존 대화형 씬 시스템(`SceneState`/
`runSceneExchange`)은 코드 변경 없이 그대로 재사용 — 트리거만 실타래 쪽에서 온다.
검증: `npm run check:thread-engine`(가짜 LLM 클라이언트로 800사이클까지 구동, trigger
종류/유한성 확인).

**8단계에서 범위 밖으로 남긴 것** (일부는 9단계가 이행함, 나머지는 여전히 후속 작업):
- 플레이어의 자유 텍스트 입력이 `input/`의 IR 캐스케이드를 거쳐 실제 보드를 조작하는 것 —
  지금도 플레이어 입력은 그대로 LLM에 날것으로 감(`gameLoop.ts`의 `runPlayerAction`).
  여전히 후속 작업.
- 실타래 콘텐츠를 폭넓게 채우는 것(가족 의무/거처/꿈 등) — 지금은 보드가 비지 않을 만큼의
  최소 시드만 있다. 여전히 후속 작업.

**9단계 1차** — `npc/`(LOD/지연 평가 `catchUpNpc`/생애사건 해저드)와
`src/game/npcImportance.ts`(minor/major, 기억 그래프)를 흡수했다. 전체 4단계 LOD를
들여오지 않고 "major=close, minor=background" 2→2 매핑 하나로 좁혔다(임계값이 정확히
50으로 일치하는 걸 활용 — `npc/README.md` 참고). major 등급 NPC는 조용히 시간이 흐를
때마다(`gameLoop.ts`가 `decayAllNpcs`를 부르던 지점들, 이제 `decayAndCheckInNpcs`)
`sim/npc/lifecycle.ts`의 `catchUpNpc`를 **재구현 없이 그대로** 호출해 결혼/이혼/재혼/
취업/자가보유/사망까지 진행시키고, 그 전후 `LifeCourseState` 차이를 코드로 짧은 영어
사실 문장(예: "Carol got married.")으로 뽑아 낮은 활성화의 새 기억 노드로 조용히
남긴다(LLM 호출 없음). 이와 별개로 **기억 풍화**(`src/game/memoryWeathering.ts`, 신규
설계 — 리포에 선례가 전혀 없었다)를 추가해, 오래되고 활성화 낮은 `MemoryNode.content`를
1회성으로 짧게 줄인다(첫 문장만 남기거나 길이 상한 — 진짜 임베딩/LLM 요약 아님, 값싼
자리 표시). 검증: `npm run check:npc-checkin`.

**9단계에서 범위 밖으로 남긴 것** (후속 작업):
- 체크인 사실을 실제 씬으로 능동적으로 엮어내는 것 — `npc/collision.ts`(현저한 이벤트
  감지)는 있지만 장면화는 여전히 미구현.
- minor 등급 NPC의 생애사건 시뮬레이션 — 완전히 비활성(기존처럼 중요도 감쇠/관계 냉각만).
- 체크인 중 발생한 실타래 이벤트(NPC 자기 board의 `ThreadEvent[]`)를 사실 문장으로
  변환하는 것 — 지금은 `LifeCourseState` 카운터 diff만 사용.

각 단계가 실제로 검증된 방식은 위 표의 npm 스크립트를 실행해서 확인할 것 — 이 README는
지도일 뿐 결과를 복사해두지 않는다(코드가 바뀌면 이 문서가 아니라 스크립트를 다시 돌려서
확인).
