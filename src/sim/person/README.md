# src/sim/person — 한 사람(기질·배경)과 도메인 모델 사이의 연결

Roy든 NPC든 같은 `PersonProfile` 하나를 갖는다: 능력, 성격(성실성·신경성·친화성·개방성·외향성·위험 감수),
금전 불안, 전통성, 부모 소득 순위, 부모 이혼, 학력(석사·박사·전문 학위까지), LA 거주, 그리고 모든 운을
재현하는 `lifeSeed`. 도메인 모델은 전부 이 프로필 하나를 읽는다.

| 파일 | 역할 |
|---|---|
| `profile.ts` | `sampleProfile(seed, {sex, birthYear, traits?})` — 경력 모델의 교육 잠재변수로 학력까지 뽑는다. `toWorker`(경력 모델 입력), `toSpouse`(결혼 모델 입력) |
| `careerTrack.ts` | `careerLifeOf` — lifeSeed로 경력 궤적을 계산·캐시(저장 불필요). `careerStatusAt`(그 달의 직업·연봉·순자산), `careerEventsBetween`(구간 사건), 사건별 현저성·도메인, 영어 사실 문장 |
| `temperament.ts` | 성격 → 실타래 관심 배분(`personalityPolicy`)과 인내심, LLM용 성격 형용사(`describeTraits`) |

## 연결된 곳

- `sim/npc`: `NpcSimRecord.profile`. `createNpcSimRecord`에 프로필만 주면 기질(temperament)이 성격에서
  만들어진다. `catchUpNpc`는 프로필이 있으면 취업 상태를 경력 모델에서 가져오고(`lifeCourse.ts`의 취업
  해저드를 덮어씀), 경력 사건을 실타래 이벤트로 내보내 `collision.ts`가 해고·공장 폐쇄 같은 현저한 것을
  고르게 한다
- `game`: NPC가 생성될 때(`npcImportance.createNpc`) 프로필을 받는다. 체크인(`npcCheckIn.ts`)은 경력 사건을
  "공장이 문을 닫아 일자리를 잃었다" 같은 구체적 사실로 기억 그래프에 넣는다. 장면 프롬프트에는
  `npcSketch.ts`의 인물 한 줄(성격·학력·지금 하는 일과 연봉)이 들어간다 — LLM은 시뮬레이션이 정한 사람을
  연기만 한다

## 설계 가정(보정 안 된 값)

- 성격 → 실타래 도메인 가중치(`DOMAIN_TRAIT_WEIGHTS`)와 인내심 공식: 비교할 통계가 없어 설계로 정했다
- 학력 분포는 1960–64년생 기준 — 1930년대생 부모 NPC는 실제보다 학력이 높게 나온다
- 여성의 경력은 결혼 모델 안에서 보정됐다(`src/sim/marriage`: 출산 후 이탈·복귀, 결혼한 실업 여성의 가사 이동,
  여성 임금 할인·직업 분포). 다만 여성 경력은 매달 가구 상황(결혼·자녀·배우자 소득)을 받아야 해서, 게임 NPC의
  결혼이 아직 `lifeCourse.ts`의 기저 해저드인 동안엔 여성 NPC의 취업도 예전 방식이다(`careerLifeOf`는 여성에게
  undefined)
- 다음 단계: NPC의 결혼·출산을 결혼 행위자 모델로 옮기면(배우자 NPC 쌍을 `simulateCouple`로) 여성 NPC의
  경력과 부부의 이혼·출산이 한꺼번에 들어온다
