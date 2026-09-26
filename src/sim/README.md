# src/sim — Roy 설계 개편의 새 엔진

LLM/브라우저 없이 순수 함수 + 시드 RNG로 동작하는 새 시뮬레이션 엔진. `gameLoop.ts`(기존
루프)는 8단계까지 그대로 두고, 여기서 따로 만들어 봇으로 검증한다. 하위 폴더는 각자
README가 있다 — 이 파일은 전체 지도 역할만 한다.

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

## 진행 상태 (2026-09-25 기준)

1~6단계 완료. 7단계(LLM 축소 — 장면 뼈대만 받는 스키마)부터는 아직. 각 단계가 실제로
검증된 방식은 위 표의 npm 스크립트를 실행해서 확인할 것 — 이 README는 지도일 뿐 결과를
복사해두지 않는다(코드가 바뀌면 이 문서가 아니라 스크립트를 다시 돌려서 확인).
