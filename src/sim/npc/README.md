# src/sim/npc — NPC LOD + 지연 평가 + 실타래 충돌 감지 (4단계)

Roy 말고도 사람들이 각자 살아가고, 그 삶이 Roy의 세계와 부딪히는 곳에서 드라마가 나오게
하는 인프라. LLM/브라우저 없이 순수 함수로 동작하고, `sim/threads`(실타래 엔진)와
`sim/lifeCourse.ts`(생애사건 해저드)를 그대로 재사용한다.

## 파일

| 파일 | 역할 |
|---|---|
| `types.ts` | `NpcLod`(foreground/close/acquaintance/background) + `NpcSimRecord` + `NpcTemperament` 타입. LOD 각 단계의 의미와 근거는 파일 머리 주석 참고. |
| `lod.ts` | `createNpcSimRecord` + 승격(`registerNpcInteraction`)/강등(`decayNpcImportance`) — `importanceScore` 하나로 4단계 LOD를 결정한다(`lodForImportance`, types.ts). |
| `lifecycle.ts` | `catchUpNpc` — 지연 평가. NPC의 `lastSimulatedAt`부터 지금까지 밀린 시간을 한 번에 진행시킨다(close/foreground는 실타래 보드까지, acquaintance는 `lifeCourse.ts` 카운터만, background는 계산 없음). |
| `collision.ts` | `detectNpcCollisions` — NPC 보드에서 난 현저한(`salience >= 0.5`) 이벤트를 골라낸다. "감지"까지만 여기 범위이고, 실제로 장면화할지는 5~7단계(현저성/스토리텔러) 몫. |
| `demo.ts` | `npm run sim:npc` 진입점 — 통계 검증이 아니라(비교할 실측 타깃이 없음) "메커니즘이 재현 가능하고 의도대로 동작하는가"만 확인하는 데모. |

## 실행

```bash
npm run sim:npc            # 기본 시드
npm run sim:npc -- 42      # 시드 지정 — 같은 시드는 항상 같은 로그를 낸다(재현성 확인용)
```

확인하는 것 4가지 (`demo.ts`의 각 절):

1. **LOD 승격/강등**: 매달 상호작용하는 NPC는 close→foreground로 오르고, 방치되는 NPC는
   background에 머문다(가족 예외 없음 — `lod.ts` 참고).
2. **지연 평가**: 5년간 한 번도 `catchUpNpc`를 안 부르다가 한 번에 진행시켜도 죽지 않고,
   close 등급은 실타래 보드가 생기고, background/acquaintance는 안 생긴다.
3. **충돌 감지(단위)**: 현저한 이벤트만 통과하고 조용한 이벤트는 걸러지는지 손으로 만든
   이벤트로 확인.
4. **충돌 감지(실사용)**: Roy 보드 + 배우자 보드를 20년 동안 매달 나란히 굴리면서, 실제
   동역학에서 충돌이 자연스럽게(드물게) 발생하는지 확인. 실타래를 예산보다 많이(3개, 예산
   2) 둬야 방치가 실제로 생긴다 — 하나뿐이면 유일한 실타래가 항상 예산을 독점한다(3단계
   리뷰에서 확인한 현상, `threads/attention.ts` 참고).

전부 통과하면 마지막 줄에 "결정론적 재현 확인... YES"가 뜬다 — 같은 시드를 두 번 돌려
바이트 단위로 같은 로그가 나오는지 비교한 것. 시드 안 타는 무작위성(예: `Math.random()`
직접 호출)이 섞여 있으면 NO가 뜨고 exit code 1로 끝난다.

## 미확정 (다음 단계에서 다룰 것)

- **LOD 임계값(15/50/80)과 승격/강등 속도(월 0.5)는 튜닝 대상이 아니라 자리 표시.** 실제
  빈도는 5단계 현저성 작업과 함께 정한다.
- **catchUpNpc는 밀린 구간 전체를 "현재" lod 해상도로 소급 시뮬레이션한다** — 진짜는
  "그때그때의 lod로" 진행시켜야 더 정확하겠지만 lod 이력을 안 남기므로 불가능하다.
  단순화 — lifecycle.ts 머리 주석 참고.
- **NpcTemperament.patience는 아직 아무 dynamics도 안 읽는다** — game/npcImportance.ts의
  resentment 성장률에 연결하는 건 6단계 이후(입력 해석기가 붙어야 "방치"라는 개념 자체가
  더 정교해짐).
- **detectNpcCollisions는 "감지"만 한다** — 감지된 후보를 실제로 장면에 엮는 로직은 없다
  (5~7단계 storyteller 몫).
- **game/npcImportance.ts(2단계 minor/major, LLM 시대)와 이 모듈(4단계 LOD, 4단계)이
  당분간 공존한다** — 8단계(엔진 교체)에서 game/ 쪽을 이 모듈로 흡수한다.
