# src/sim/harness — 헤드리스 몬테카를로 (3단계)

`src/sim/threads`(엔진)와 `src/sim/data`(실제 통계)를 LLM/브라우저 없이 조합해서, "무작위/
일중독/가정적 봇이 사는 평범한 인생 1,000개"가 `src/sim/data/validationTargets.ts`의 실제
통계와 맞는지 검증하고 파라미터를 튜닝하는 곳.

## 파일

| 파일 | 역할 |
|---|---|
| `hazards.ts` | "몇 살까지 몇 %"(누적) 또는 "이 구간에 몇 번"(건수)으로 주어진 실측 데이터를 월간 해저드로 바꾸는 변환기 — 나이대별 가우시안 피크, 구간별 건수, 누적→조건부 해저드 세 종류. |
| `lifeCourse.ts` | 생애사건(결혼/이혼/재혼/취업/자가보유) 스포너. 결혼만 진짜 실타래(decay)로 존재하고, 취업/자가보유는 해저드+카운터로 더 단순하게 추적한다(아래 "알려진 한계" 참고). |
| `bots.ts` | 정책 봇 3종: `random`(무작위 배분), `workaholic`(work/livelihood/dreams 우선), `familyOriented`(relationships/familyDuty/dwelling 우선). |
| `monteCarlo.ts` | `runLife(seed, bot)`로 인생 하나를 결정론적으로 시뮬레이션, `runMonteCarlo(n, botName)`로 n명을 돌려 집계. |

## 실행

```bash
npm run sim                          # 기본: n=1000, 3개 봇 전부
npm run sim -- --n=5000              # n 조정(표본오차 줄이기)
npm run sim -- --bot=random          # 봇 하나만
```

`cli.ts`가 `runMonteCarlo`를 실제로 호출해서 `VALIDATION_TARGETS`/`HOMEOWNERSHIP_TARGETS`와
비교하고 PASS/FAIL을 찍는다(전에는 이 비교를 즉석 스크립트로 하고 버려서 재현이 안 됐다).
**PASS/FAIL 판정은 `random` 봇에만 적용한다** — workaholic/familyOriented는 타깃에서
벗어나는 게 의도이므로 참고용 숫자만 나란히 찍는다. exit code는 `random`의 판정을 따른다.

## 현재 튜닝 상태 (`npm run sim -- --n=1000 --bot=random`으로 재현)

17개 타깃(사망 3, 결혼·이혼 6, 일 2, 자가보유 7) 전부 허용오차 안에 들어온다. n=200처럼
표본을 줄이면 결혼 지속기간·자가보유 30~44세 구간에서 가끔 FAIL이 뜨는데 표본오차 범위
안이다 — n을 올려서(5000 등) 재확인할 것. 자가보유 25~34세 구간은 여전히 허용오차 안쪽
경계에 붙어 있어서(diff 0.04~0.05) 가장 먼저 흔들리는 지표다:

- **자가보유율 25~34세 구간**: 지속적으로 실측보다 낮게 나온다. 원인: 추적 구간(25-29,
  30-34)과 해저드 입력 구간(첫 구간이 18-29)이 안 맞는다 — 실제 자가보유는 18-29 구간
  중에서도 뒤쪽(27-29세)에 몰려 있는데 해저드는 그 구간 전체에 균등하게 깔아놔서,
  25-29세 시점엔 실측보다 덜 도달한 상태로 측정된다. 구간을 더 잘게 쪼개면 나아질 것 —
  다음 튜닝 대상으로 남겨둠.

## 알려진 한계 (다음 단계에서 다룰 것)

- **3개 봇이 통계적으로 완전히 동일한 결과를 낸다** (`npm run sim`으로 확인 가능 — random/
  workaholic/familyOriented 세 블록의 숫자가 자릿수까지 같다). 원인은 두 가지가 겹친다:
  (1) 이 하네스엔 결혼 실타래 하나만 존재해서, 봇이 무엇을 "attend"하든 유일한 실타래가
  항상 attentionBudget을 전부 받는다(경쟁 상대가 없으므로 우선순위가 결과에 영향을 줄
  여지가 없음) — 아래 항목과 동일한 원인. (2) `divorceMonthlyHazard`(lifeCourse.ts)가
  결혼 duration만 보고 판정하지, 실제 decay 실타래의 `value`(관심을 반영하는 상태)를
  전혀 읽지 않는다 — 그래서 설사 attention이 실타래마다 달라져도 이혼 확률엔 반영되지
  않는다. "일중독 봇은 이혼율이 더 높아야 그럴듯하다"는 애초 검증 목표는 아직 성립하지
  않는 상태 — 일/생계를 진짜 실타래로 만들어 attentionBudget이 실제로 경합하게 하고
  (7~8단계), divorceMonthlyHazard가 decay 값을 반영하도록 고치기 전까지는 정책 봇 간
  차이가 나올 수 없다.
- **취업/자가보유는 실타래가 아니라 카운터다.** 결혼만 진짜 decay 실타래로 만들어서 봇의
  관심 배분이 이혼 위험에 영향을 주게 할 계획이었는데, 이 하네스엔 결혼 실타래 말고
  경쟁할 다른 실타래가 없어서(취업/자가보유가 실타래가 아니므로) attentionBudget을 사실상
  독점해 거의 방치되는 일이 없었다 — 그 결과 decay의 자연 감쇠만으로는 이혼이 전혀
  안 나왔다(실측 0%). 그래서 이혼/재혼은 결혼 지속기간 기반 해저드로 따로 판정하고,
  decay 실타래 자체는 "결혼이 존재한다"는 표식으로만 남겨뒀다. 일/생계까지 진짜 실타래로
  모델링해서 attentionBudget이 실제로 경합하게 만드는 건 이후 단계(7~8단계, 콘텐츠 레이어)
  과제.
- **`debtTick`/`pursuitTick`/`dormantTick`/`pressureTick`/`transitionTick`은 이 하네스에서
  한 번도 실행되지 않는다** — lifeCourse.ts가 만드는 실타래는 결혼(decay)뿐이라, 2단계에서
  작성한 6개 역학 중 5개는 몬테카를로 검증 커버리지가 0이다. 4단계에서 NPC/실타래가
  늘어나면 자연히 exercise되겠지만, 그 전엔 회귀가 생겨도 이 하네스가 못 잡는다.
- **출산(fertility) 타깃은 검증 안 함** — validationTargets.ts 자체가 "배우자 쪽 검증용"이라
  명시(Roy가 아니라 NPC 배우자의 통계). Roy 본인의 생애 시뮬레이션엔 해당 안 돼서 이번
  패스에서 뺐다.
- **SharedResources(money/stress)는 CPI/임금 데이터와 아직 안 이어져 있다** — 결혼 실타래의
  `resources` 파라미터는 존재하지만 실제 인플레이션 조정 금액과는 무관한 임의 단위다.
