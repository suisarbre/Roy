import type { GameDate } from '../../game/types';
import type { Rng } from '../rng';
import { allocateAttention } from './attention';
import { debtTick, decayTick, dormantTick, pressureTick, pursuitTick, transitionTick } from './dynamics';
import type {
  DebtState,
  DecayState,
  DormantState,
  PressureState,
  PursuitState,
  SharedResources,
  Thread,
  ThreadDomain,
  ThreadEndReason,
  ThreadEventTag,
  ThreadShape,
  ThreadShapeState,
  ThreadTickInput,
  TransitionState,
} from './types';

/**
 * 한 달치 전체 실타래 보드를 진행시키는 오케스트레이터. 6개 역학 함수 자체는 샤드 하나만
 * 알지만, 실제 게임에는 여러 실타래가 공유 자원을 두고 경쟁하며 동시에 존재한다 — 그 조율을
 * 여기서 한다: 관심 배분 -> 샤드별 tick 디스패치 -> 자원 변화 합산 -> 종료/전환 처리.
 */

/** 5단계 현저성 공식의 "(1+관심 EMA)" 항이 실제로 움직이게 하는 갱신값 — 얼마나 빨리 최근
 *  관심을 반영할지. 미확정, 튜닝 대상. */
const INTEREST_EMA_ALPHA = 0.2;

/** elapsedMonths 동안 매달 같은 attention 표본이 반복됐다고 보고 EMA를 한 번에 갱신한다
 *  (매달 값이 바뀌지 않으므로 반복 적용의 닫힌 형태를 쓴다 — 루프 불필요). */
function decayedEma(previous: number, sample: number, alpha: number, steps: number): number {
  return sample + Math.pow(1 - alpha, steps) * (previous - sample);
}

/** dispatchTick의 반환값에서 nextState를 뺀 나머지 — 샤드마다 nextState 타입이 달라서
 *  공통 부분만 이 타입으로 다룬다(shapeState가 이미 nextState를 담고 있으므로 중복 불필요). */
interface TickOutcome {
  salienceDelta: number;
  resourceDelta?: Partial<Record<keyof SharedResources, number>>;
  event?: ThreadEventTag;
  endedWith?: ThreadEndReason;
  transformsInto?: { domain: ThreadDomain; shape: ThreadShape };
}

function dispatchTick(thread: Thread, input: ThreadTickInput): { shapeState: ThreadShapeState; outcome: TickOutcome } {
  switch (thread.shape) {
    case 'debt': {
      const result = debtTick(thread.state, input);
      return { shapeState: { shape: 'debt', state: result.nextState }, outcome: result };
    }
    case 'decay': {
      const result = decayTick(thread.state, input);
      return { shapeState: { shape: 'decay', state: result.nextState }, outcome: result };
    }
    case 'pursuit': {
      const result = pursuitTick(thread.state, input);
      return { shapeState: { shape: 'pursuit', state: result.nextState }, outcome: result };
    }
    case 'dormant': {
      const result = dormantTick(thread.state, input);
      return { shapeState: { shape: 'dormant', state: result.nextState }, outcome: result };
    }
    case 'pressure': {
      const result = pressureTick(thread.state, input);
      return { shapeState: { shape: 'pressure', state: result.nextState }, outcome: result };
    }
    case 'transition': {
      const result = transitionTick(thread.state, input);
      return { shapeState: { shape: 'transition', state: result.nextState }, outcome: result };
    }
  }
}

/**
 * 전환(transformed) 시 새로 생길 실타래의 초기 상태 — 합리적인 기본값일 뿐, 실제 전환
 * 시나리오별 세부 파라미터(예: "이 압력 인스턴스의 정확한 단계 그래프")는 7~8단계에서
 * 콘텐츠를 붙일 때 다시 손볼 대상이다. 지금은 엔진이 전환 이후에도 계속 굴러가는지
 * 검증하는 용도.
 */
function createDefaultShapeState(shape: ThreadShape): ThreadShapeState {
  switch (shape) {
    case 'debt': {
      const state: DebtState = { amount: 1000, monthlyInterestRate: 0.02, stage: 'current', monthsUnaddressedInStage: 0, consecutiveGoodMonths: 0 };
      return { shape: 'debt', state };
    }
    case 'decay': {
      const state: DecayState = { value: 50, decayRatePerMonth: 0.05, criticalThreshold: 30, monthsHealthyStreak: 0 };
      return { shape: 'decay', state };
    }
    case 'pursuit': {
      const state: PursuitState = { progress: 0, momentum: 50, monthsAtLowMomentum: 0 };
      return { shape: 'pursuit', state };
    }
    case 'dormant': {
      const state: DormantState = { hiddenProgress: 5, growthRate: 0.1, forcedSurfaceThreshold: 80, monthlySignalLeakChance: 0.05, falseSignalChance: 0.2 };
      return { shape: 'dormant', state };
    }
    case 'pressure': {
      const state: PressureState = {
        stages: { acute: { onIgnored: null, deadlineMonths: 3, isResolution: false } },
        stage: 'acute',
        monthsInStage: 0,
        responseHistory: [],
      };
      return { shape: 'pressure', state };
    }
    case 'transition': {
      const state: TransitionState = { deadline: { year: 2000, month: 1 }, stakes: 0.5 };
      return { shape: 'transition', state };
    }
  }
}

export interface ThreadEvent {
  threadId: string;
  domain: ThreadDomain;
  label: string;
  salience: number;
  event?: ThreadEventTag;
  endedWith?: ThreadEndReason;
}

export interface TickMonthResult {
  threads: Thread[];
  resources: SharedResources;
  events: ThreadEvent[];
}

/**
 * elapsedMonths만큼 보드 전체를 진행시킨다. 종료(resolved/abandoned/fizzled)된 실타래는
 * 목록에서 빠지고, 전환(transformed)된 실타래는 같은 자리에 새 샤드로 다시 태어난다
 * (id는 새로 발급 — 다른 모양이 된 별개의 실타래로 취급).
 */
export function tickMonth(
  threads: readonly Thread[],
  resources: SharedResources,
  currentDate: GameDate,
  attendedIds: ReadonlySet<string>,
  elapsedMonths: number,
  rng: Rng,
): TickMonthResult {
  const attention = allocateAttention(threads, attendedIds, resources.attentionBudget);
  const nextThreads: Thread[] = [];
  const events: ThreadEvent[] = [];
  // 모든 실타래가 이번 달 시작 시점의 같은 resources 스냅샷을 본다(먼저 처리된 실타래가
  // money를 미리 써버려서 뒤 실타래가 고갈된 상태를 보는 순서 의존성을 막기 위함 — delta는
  // 아래에서 따로 모았다가 루프가 끝난 뒤 한 번에 합산 적용한다, ThreadTickResult.resourceDelta
  // 주석 참고).
  const resourceDeltaSum: Partial<Record<keyof SharedResources, number>> = {};

  for (const thread of threads) {
    const attentionThisTick = attention.get(thread.id) ?? 0;
    const input: ThreadTickInput = {
      elapsedMonths,
      currentDate,
      attention: attentionThisTick,
      resources,
      rng,
    };
    const { shapeState, outcome } = dispatchTick(thread, input);
    const nextInterestEma = decayedEma(thread.interestEma, attentionThisTick, INTEREST_EMA_ALPHA, elapsedMonths);

    if (outcome.resourceDelta) {
      for (const [key, delta] of Object.entries(outcome.resourceDelta)) {
        if (delta === undefined) continue;
        const resourceKey = key as keyof SharedResources;
        resourceDeltaSum[resourceKey] = (resourceDeltaSum[resourceKey] ?? 0) + delta;
      }
    }

    if (outcome.salienceDelta || outcome.event || outcome.endedWith) {
      events.push({
        threadId: thread.id,
        domain: thread.domain,
        label: thread.label,
        salience: outcome.salienceDelta,
        event: outcome.event,
        endedWith: outcome.endedWith,
      });
    }

    if (!outcome.endedWith) {
      nextThreads.push({ ...thread, ...shapeState, interestEma: nextInterestEma } as Thread);
      continue;
    }

    if (outcome.endedWith === 'transformed' && outcome.transformsInto) {
      const seed = createDefaultShapeState(outcome.transformsInto.shape);
      nextThreads.push({
        ...thread,
        ...seed,
        id: crypto.randomUUID(),
        domain: outcome.transformsInto.domain,
        label: `${thread.label} (전환됨)`,
        origin: `${thread.shape} 실타래 "${thread.label}"에서 전환`,
        createdAtTurn: thread.createdAtTurn,
        interestEma: nextInterestEma,
        fatigue: 0,
        lastSceneAtTurn: undefined,
      } as Thread);
    }
    // resolved/abandoned/fizzled는 그냥 목록에서 빠진다.
  }

  let nextResources = resources;
  for (const [key, delta] of Object.entries(resourceDeltaSum)) {
    if (delta === undefined) continue;
    const resourceKey = key as keyof SharedResources;
    nextResources = { ...nextResources, [resourceKey]: nextResources[resourceKey] + delta };
  }

  return { threads: nextThreads, resources: nextResources, events };
}
