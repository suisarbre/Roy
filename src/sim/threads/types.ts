import type { GameDate, NpcId } from '../../game/types';
import type { Rng } from '../rng';

/**
 * 실타래(Thread) 시스템 — 설계 문서 겸 타입 정의.
 *
 * gameLoop.ts의 decideSkipStretch(고정 확률 주사위)를 대체한다: 상태는 실타래 단위로
 * 나뉘고, 매달 코드가 결정적으로(LLM 없이) 그 상태를 진행시키며, "지금 장면화할 만큼
 * 눈에 띄는가"(현저성, salience.ts — 5단계에서 구현)를 넘을 때만 LLM이 불려와 그 순간을
 * 서술한다. LLM은 판사가 아니라 렌더러다 — 판정/상태 변화는 전부 여기 정의된 순수 함수가
 * 담당해서, LLM 없이 수천 개의 인생을 돌려 실제 통계와 비교 튜닝할 수 있게 한다(3단계).
 *
 * 이 파일은 "타입만" 정리한다 — 실제 tick 로직(부채 복리 계산, 부식 감쇠 곡선 등)은
 * 2단계의 다음 서브스텝에서 작성한다. 아직 결정 안 된 부분은 파일 안에 **미확정** 표시로
 * 남겨뒀다.
 */

// ---- 도메인: 내용 + 스탯 축 ----

/**
 * 8개 도메인. 한 도메인 안에 실타래가 동시에 여러 개 존재할 수 있다(사용자 결정) — 예를 들어
 * '생계' 도메인에 부채 실타래와 횡재 추구 실타래가 동시에 있을 수 있다. 그래서 도메인은
 * "슬롯"이 아니라 태그에 가깝다. 다만 실타래 전체 상한(5~7개, ThreadBoard 쪽에서 관리)은
 * 도메인과 무관하게 전역으로 걸린다.
 */
export type ThreadDomain =
  | 'livelihood' // 생계 — 당장 먹고사는 문제(현금 흐름, 부채)
  | 'work' // 일 — 커리어/직업적 정체성(생계와 분리: 돈은 되는데 싫은 일도 있다)
  | 'body' // 몸 — 신체 건강
  | 'mind' // 마음 — 정신 건강
  | 'relationships' // 관계 — 가족 의무 바깥의 우정/연애/사회적 유대
  | 'familyDuty' // 가족 의무 — 부모 부양, 형제 책임 등 "선택 아닌" 관계
  | 'dwelling' // 거처 — 주거 상황
  | 'dreams'; // 꿈 — "원래 되고 싶었던 것", 정체성 걸린 추구

// ---- 모양: 역학 ----

export type ThreadShape = 'debt' | 'decay' | 'pursuit' | 'dormant' | 'pressure' | 'transition';

export type ThreadEndReason = 'resolved' | 'abandoned' | 'fizzled' | 'transformed';

/**
 * 부채(debt) — 복리 + 이산 에스컬레이션 단계.
 * 예: 신용카드 연체, 사채, 밀린 양육비. 방치하면 이자가 복리로 불어나고, 일정 기간 이상
 * 방치되면 단계가 한 칸씩(정상→연체→추심→법적조치) 악화된다 — 연속적 증가가 아니라
 * 계단식이라, 매달 조금씩 나빠지는 게 아니라 "어느 순간 갑자기 심각해진" 느낌을 낸다.
 */
export interface DebtState {
  /** 원금+누적 이자를 합친 현재 부담액. 0 이하로 떨어지면 즉시 resolved. */
  amount: number;
  /** 월 복리 이자율(0~1). 단계가 오를수록 코드가 이 값을 같이 올린다. */
  monthlyInterestRate: number;
  /** 이산 단계. 각 단계마다 이자율/최소 상환액/현저성 하한이 달라진다(정확한 표는 tick 함수
   *  작성 시 확정 — **미확정**: 단계별 정확한 이자율·유예 개월 수). */
  stage: 'current' | 'late' | 'collections' | 'legal';
  /** 이번 단계에서 관심 0으로 방치된 연속 개월 수 — 임계치를 넘으면 다음 단계로 악화. */
  monthsUnaddressedInStage: number;
  /** 연속으로 상환에 관심을 쏟은 개월 수 — 임계치를 넘으면 단계가 한 칸 완화될 수 있다. */
  consecutiveGoodMonths: number;
}

/**
 * 부식(decay) — 지수 감쇠 + 임계 아래 회복 비용 증가.
 * 예: 방치된 우정, 안 쓰는 기술/자격, 관리 안 한 건강. 관심을 안 쏟으면 지수적으로 깎이고,
 * 일정 수준(criticalThreshold) 아래로 떨어지면 같은 관심을 쏟아도 회복되는 양이 줄어든다 —
 * "손 놓은 지 오래될수록 다시 시작하기 힘들다"는 실감을 수식으로 표현.
 */
export interface DecayState {
  /** 0~100. */
  value: number;
  /** 방치 시 월 감쇠율(지수). */
  decayRatePerMonth: number;
  /** 이 아래로 떨어지면 회복이 훨씬 비싸진다. */
  criticalThreshold: number;
  /** criticalThreshold 위로 회복된 뒤 그 상태를 유지한 연속 개월 수 — 일정 기간 유지되면
   *  resolved로 종료될 수 있다. */
  monthsHealthyStreak: number;
}

/**
 * 추구(pursuit) — 진전(progress)과 모멘텀(momentum)을 분리한다.
 * 예: 창업, 소설 집필, 자격증 준비. progress는 "얼마나 왔는가"(대체로 단조 증가, 100이면
 * 목표 달성=resolved), momentum은 "지금 얼마나 동력이 있는가"(변동성 큼, 방치되면 깎이고
 * 성공적인 장면으로 오른다). 분리한 이유: 꽤 왔는데 의욕이 바닥난(번아웃 직전) 상태를
 * "진전은 있지만 곧 멈출 수 있음"으로 표현하기 위함. momentum이 바닥에 오래 머물면 매달
 * 포기 확률을 굴린다.
 */
export interface PursuitState {
  /** 0~100. 100이면 resolved. */
  progress: number;
  /** 변동성 큰 "지금 추진력". 음수까지는 안 가고 0~100로 두되, 낮을수록 위험. */
  momentum: number;
  /** momentum이 포기 임계치 이하로 머문 연속 개월 수 — 길어질수록 포기 확률이 오른다
   *  (**미확정**: 정확한 확률 곡선). */
  monthsAtLowMomentum: number;
}

/**
 * 잠복(dormant) — 숨은 진행도(로지스틱) + 새는 신호(거짓 신호 포함).
 * 예: 조용히 진행 중인 질병, 배우자의 외도, 누군가 꾸미는 일, 자각 못한 중독. hiddenProgress는
 * observable에 절대 노출되지 않는다(hidden 원칙 그대로) — 대신 매달 낮은 확률로 "신호"가
 * 새어나오고, 그 신호조차 일정 확률로 거짓(false positive)일 수 있다 — "확인해도 완전히
 * 믿을 수 없다"는 무지=리스크 원칙을 신호 자체에도 적용한 것. hiddenProgress가
 * forcedSurfaceThreshold를 넘으면 신호 없이도 강제로 장면화되거나 pressure로 전환된다
 * (예: 만성질환이 hidden.health.chronicSeeds로 진행되다 증상이 관측 가능해지는 것과 같은
 * 패턴 — statImpact.ts의 newVisibleSymptom 메커니즘과 자연스럽게 맞닿아 있다).
 */
export interface DormantState {
  /** 0~100, 로지스틱 곡선(dP/dt = r·P·(1-P/100))으로 증가. */
  hiddenProgress: number;
  /** 로지스틱 성장률(r) — 클수록 빨리 무르익는다. */
  growthRate: number;
  /** 이 값을 넘으면 신호 없이도 강제로 장면화/전환된다. */
  forcedSurfaceThreshold: number;
  /** 매달 신호가 발생할 확률. */
  monthlySignalLeakChance: number;
  /** 신호가 발생했을 때 그게 거짓 신호일 확률. */
  falseSignalChance: number;
}

/**
 * 압력(pressure) — 단계별 상태 기계. 응답에 따라 다른 모양으로 전환된다.
 * 예: 소송, 해고 통보, 건강 위기, 가족과의 정면 대립. 가장 "사건적인" 모양 — 단계 목록은
 * 인스턴스마다 자유롭게 정의한다(모든 압력이 같은 4단계를 공유하지 않음: 소송이면
 * '접수'→'답변기한'→'심리'→'판결', 건강 위기면 '증상'→'검사'→'진단'→'치료 결정' 등).
 * 응답 없이 deadlineMonthsInStage를 넘기면 코드가 자동으로(보통 더 나쁜) 다음 단계를 고른다.
 * 최종 단계는 실타래를 resolved로 끝내거나, 결과에 따라 다른 샤드로 transformed된다
 * (예: 소송 패소 → debt 실타래로 전환, 만성질환 진단 확정 → 지속적 decay 실타래로 전환).
 */
export interface PressureState {
  /** 지금 단계. 인스턴스별 자유 문자열(위 설명 참고). */
  stage: string;
  /** 이 단계를 맞이한 지 몇 개월째인지. */
  monthsInStage: number;
  /** 이 단계에서 응답 없이 버틸 수 있는 최대 개월. null이면 마감 없음(관심이 쌓일 때까지
   *  무기한 대기 — 드묾, 대부분의 압력은 마감이 있어야 "압력"답다). */
  deadlineMonthsInStage: number | null;
  /** Roy가 각 단계에서 어떻게 응답했는지 로그 — 다음 단계 선택 + 장면화 시 LLM에게 줄 서사적
   *  연속성을 위해 보존. */
  responseHistory: string[];
}

/**
 * 이행(transition) — 고정 마감 + 준비도.
 * 예: 결혼식, 재판 날짜, 예정된 수술, 은퇴, 시험일. pressure와 다른 점: 마감이 관심과
 * 무관하게 고정이다(방치한다고 날짜가 안 당겨지거나 늦춰지지 않음) — 변하는 건 그날까지
 * Roy가 얼마나 준비됐는가뿐이다. 준비도는 상태로 저장하지 않는다 — 장면화 시점에 기억
 * 그래프 임베딩 유사도로 즉석 계산한다(6단계, 입력 해석기와 같은 임베딩 인프라 재사용).
 * 캐시하지 않는 이유: 그 사이 새로 쌓인 기억을 항상 반영해야 하므로.
 */
export interface TransitionState {
  /** 방치해도 안 변하는 고정 마감일. */
  deadline: GameDate;
  /** 이 전환에 딸린 판돈(salience의 stakes와 연결). */
  stakes: number;
}

/** 샤드별 상태를 태그 유니온으로 묶는다 — shape 필드로 정확한 state 타입이 좁혀진다. */
export type ThreadShapeState =
  | { shape: 'debt'; state: DebtState }
  | { shape: 'decay'; state: DecayState }
  | { shape: 'pursuit'; state: PursuitState }
  | { shape: 'dormant'; state: DormantState }
  | { shape: 'pressure'; state: PressureState }
  | { shape: 'transition'; state: TransitionState };

/** 모든 실타래가 샤드와 무관하게 공유하는 필드 — 주로 현저성(salience.ts, 5단계) 계산 입력. */
export interface ThreadBase {
  id: string;
  domain: ThreadDomain;
  /** 사람이 읽는 이름 — 로그/디버깅 + 장면화 시 LLM에게 주는 맥락(예: "밀린 신용카드 대금"). */
  label: string;
  /** 이 실타래가 어떻게 시작됐는지 한 줄 — 장면화 시 서사적 연속성을 위해 LLM에게 넘긴다. */
  origin: string;
  createdAtTurn: number;
  /** 이 실타래에 얽힌 NPC들(있다면) — 예: 특정 친구와의 관계 decay 실타래. */
  involvedNpcIds?: NpcId[];

  // --- 현저성(salience) 입력 ---
  /** 0~1, 이 실타래에 얼마나 판돈이 걸려 있는가(고정에 가까움, 생성 시 결정). */
  stakes: number;
  /** 0~1, 플레이어가 attend/act로 보여온 관심의 지수이동평균 — salience의 "(1+관심 EMA)"
   *  항에 쓰인다. */
  interestEma: number;
  /** 0~1, 이 실타래가 장면화됐는데 해소되지 않은 채 반복되면 올라가는 피로도 — salience의
   *  "피로 감쇠" 항에 쓰인다. 같은 실타래가 매번 장면을 독점하는 걸 막기 위함. */
  fatigue: number;
  lastSceneAtTurn?: number;
}

export type Thread = ThreadBase & ThreadShapeState;

// ---- 공유 자원 ----

/**
 * 실타래끼리 직접 결합하지 않는다 — 오직 이 공유 자원 허브를 통해서만 서로 영향을 준다
 * (예: 부채 실타래가 늘어나면 money가 줄고, money가 부족하면 다른 실타래에 쓸 attention이
 * 줄어드는 식의 간접 경쟁).
 */
export interface SharedResources {
  /** HiddenStats.finance와 어떻게 정확히 동기화될지는 8단계(기존 엔진 흡수)에서 확정 —
   *  지금은 실타래 레벨에서 "이번 달 투입 가능한 가용 현금"에 가깝다고 가정. */
  money: number;
  /** HiddenStats.mentalHealth와 연결 — 실타래들이 관심을 쏟을 때/방치될 때 이 풀을 갉아먹거나
   *  회복시킨다. */
  stress: number;
  /**
   * **미확정 — 역학 함수를 쓰기 전에 반드시 결정**: 이번 달 Roy가 실타래들에 배분할 수 있는
   * 총 관심 예산. 각 실타래의 tick에 들어가는 attention(0~1)의 합이 이 값을 넘을 수 없어야
   * "인생은 트레이드오프"라는 전제가 성립한다(예산이 무제한이면 실타래들이 서로 경쟁하지
   * 않는다). 두 가지 미결정 사항: (1) 예산 자체를 얼마로 잡을지(실타래 상한 5~7개에 비례해
   * 2~3 정도가 후보), (2) 예산을 실타래 사이에 나누는 알고리즘 — 매달 플레이어가 명시적으로
   * attend한 실타래에 우선 배분 + 나머지는 interestEma 비례 배분, 정도가 초안.
   */
  attentionBudget: number;
}

// ---- tick 함수 시그니처 (구현은 다음 서브스텝) ----

export interface ThreadTickInput {
  elapsedMonths: number;
  /** 0~1 — attentionBudget에서 이 실타래에 배분된 몫. */
  attention: number;
  resources: SharedResources;
  rng: Rng;
}

export interface ThreadTickResult<TState> {
  nextState: TState;
  /** 이번 tick으로 생긴 현저성 변화(단계 전환, 신호, 임계 통과 등) — salience.ts가 소비. */
  salienceDelta: number;
  endedWith?: ThreadEndReason;
  /** 종료 사유가 'transformed'일 때만 — 새로 생겨날 실타래의 시드(도메인/샤드, 초기 state는
   *  전환 로직이 채운다). */
  transformsInto?: { domain: ThreadDomain; shape: ThreadShape };
}

export type DebtTickFn = (state: DebtState, input: ThreadTickInput) => ThreadTickResult<DebtState>;
export type DecayTickFn = (state: DecayState, input: ThreadTickInput) => ThreadTickResult<DecayState>;
export type PursuitTickFn = (state: PursuitState, input: ThreadTickInput) => ThreadTickResult<PursuitState>;
export type DormantTickFn = (state: DormantState, input: ThreadTickInput) => ThreadTickResult<DormantState>;
export type PressureTickFn = (state: PressureState, input: ThreadTickInput) => ThreadTickResult<PressureState>;
export type TransitionTickFn = (state: TransitionState, input: ThreadTickInput) => ThreadTickResult<TransitionState>;
