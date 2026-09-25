import type { GameDate } from '../../game/types';
import type {
  DebtState,
  DecayState,
  DormantState,
  PressureState,
  PursuitState,
  ThreadEventTag,
  ThreadTickInput,
  ThreadTickResult,
  TransitionState,
} from './types';

/**
 * 6개 모양의 tick 순수 함수. 전부 (state, input) -> result 형태의 순수 함수라 LLM 없이도
 * 몬테카를로로 수천 번 돌릴 수 있다(3단계). 여기 있는 상수는 전부 밸런스용 임시값 —
 * statImpact.ts의 등급 테이블과 같은 성격으로, 3단계 하네스가 실제 통계와 비교하며
 * 조정할 대상이다.
 *
 * tick이 스스로 만들어낼 수 있는 endedWith: resolved/fizzled/transformed. 'abandoned'는
 * 원칙적으로 플레이어의 명시적 close 조작(6단계, IR)에서 나온다 — 시간 경과만으로 "포기"를
 * 만드는 유일한 예외가 pursuit의 모멘텀-바닥 포기 확률 굴림이다(문서에 명시된 대로).
 */

function dateToTotalMonths(date: GameDate): number {
  return date.year * 12 + (date.month - 1);
}

// ---- 부채(debt) ----

interface DebtStageConfig {
  interestRateMultiplier: number;
  escalateAfterMonths: number;
  deescalateAfterMonths: number;
  nextStage: DebtState['stage'] | null;
  prevStage: DebtState['stage'] | null;
}

const DEBT_STAGES: Record<DebtState['stage'], DebtStageConfig> = {
  current: { interestRateMultiplier: 1, escalateAfterMonths: 3, deescalateAfterMonths: 0, nextStage: 'late', prevStage: null },
  late: { interestRateMultiplier: 1.5, escalateAfterMonths: 3, deescalateAfterMonths: 3, nextStage: 'collections', prevStage: 'current' },
  collections: { interestRateMultiplier: 2, escalateAfterMonths: 6, deescalateAfterMonths: 6, nextStage: 'legal', prevStage: 'late' },
  legal: { interestRateMultiplier: 2.5, escalateAfterMonths: Infinity, deescalateAfterMonths: 12, nextStage: null, prevStage: 'collections' },
};

/** legal 단계에서 이만큼(개월) 더 방치되면 압류/급여 압류 같은 실제 위기로 전환된다. */
const DEBT_LEGAL_CRISIS_MONTHS = 12;
/** attention 1.0을 legal 단계 방치 상태에 온전히 쏟았을 때 한 달에 갚는 금액. */
const DEBT_MAX_MONTHLY_PAYMENT = 400;

export function debtTick(state: DebtState, input: ThreadTickInput): ThreadTickResult<DebtState> {
  const stageConfig = DEBT_STAGES[state.stage];
  const effectiveRate = state.monthlyInterestRate * stageConfig.interestRateMultiplier;

  let amount = state.amount * Math.pow(1 + effectiveRate, input.elapsedMonths);
  let resourceDelta: ThreadTickResult<DebtState>['resourceDelta'];

  if (input.attention > 0) {
    const payment = Math.min(amount, input.attention * DEBT_MAX_MONTHLY_PAYMENT * input.elapsedMonths, Math.max(input.resources.money, 0));
    amount -= payment;
    if (payment > 0) resourceDelta = { money: -payment };
  }

  let monthsUnaddressedInStage = input.attention > 0 ? 0 : state.monthsUnaddressedInStage + input.elapsedMonths;
  let consecutiveGoodMonths = input.attention > 0 ? state.consecutiveGoodMonths + input.elapsedMonths : 0;
  let stage = state.stage;
  let event: ThreadEventTag | undefined;

  if (amount <= 0) {
    return { nextState: { ...state, amount: 0 }, salienceDelta: 0.5, resourceDelta, event: 'debtResolved', endedWith: 'resolved' };
  }

  if (monthsUnaddressedInStage >= stageConfig.escalateAfterMonths && stageConfig.nextStage) {
    stage = stageConfig.nextStage;
    monthsUnaddressedInStage = 0;
    event = 'debtEscalated';

    if (stage === 'legal') {
      // legal로 막 넘어온 시점부터 다시 방치 카운트 — 여기서 더 방치되면 아래 크라이시스 분기.
    }
  } else if (consecutiveGoodMonths >= stageConfig.deescalateAfterMonths && stageConfig.prevStage && stageConfig.deescalateAfterMonths > 0) {
    stage = stageConfig.prevStage;
    consecutiveGoodMonths = 0;
    event = 'debtDeescalated';
  }

  if (stage === 'legal' && monthsUnaddressedInStage >= DEBT_LEGAL_CRISIS_MONTHS) {
    return {
      nextState: { ...state, amount, stage, monthsUnaddressedInStage, consecutiveGoodMonths },
      salienceDelta: 1,
      resourceDelta,
      event: 'debtCrisis',
      endedWith: 'transformed',
      transformsInto: { domain: 'livelihood', shape: 'pressure' },
    };
  }

  const salienceDelta = event === 'debtEscalated' ? 0.6 : event === 'debtDeescalated' ? 0.2 : 0.05;
  return { nextState: { ...state, amount, stage, monthsUnaddressedInStage, consecutiveGoodMonths }, salienceDelta, resourceDelta, event };
}

// ---- 부식(decay) ----

const DECAY_RECOVERY_RATE_PER_ATTENTION = 8;
const DECAY_BELOW_CRITICAL_RECOVERY_PENALTY = 0.35;
const DECAY_HEALTHY_BAND_MARGIN = 15;
const DECAY_RESOLVE_STREAK_MONTHS = 6;
const DECAY_FIZZLE_EPSILON = 0.5;

export function decayTick(state: DecayState, input: ThreadTickInput): ThreadTickResult<DecayState> {
  let value = state.value * Math.exp(-state.decayRatePerMonth * input.elapsedMonths);

  if (input.attention > 0) {
    const penalty = value < state.criticalThreshold ? DECAY_BELOW_CRITICAL_RECOVERY_PENALTY : 1;
    value += input.attention * DECAY_RECOVERY_RATE_PER_ATTENTION * input.elapsedMonths * penalty;
  }
  value = Math.max(0, Math.min(100, value));

  if (value <= DECAY_FIZZLE_EPSILON) {
    return { nextState: { ...state, value: 0 }, salienceDelta: 0.3, event: 'decayFizzled', endedWith: 'fizzled' };
  }

  const healthyLevel = state.criticalThreshold + DECAY_HEALTHY_BAND_MARGIN;
  const monthsHealthyStreak = value >= healthyLevel ? state.monthsHealthyStreak + input.elapsedMonths : 0;

  if (monthsHealthyStreak >= DECAY_RESOLVE_STREAK_MONTHS) {
    return { nextState: { ...state, value, monthsHealthyStreak }, salienceDelta: 0.4, event: 'decayResolved', endedWith: 'resolved' };
  }

  const crossedCritical = state.value >= state.criticalThreshold && value < state.criticalThreshold;
  return {
    nextState: { ...state, value, monthsHealthyStreak },
    salienceDelta: crossedCritical ? 0.5 : 0.05,
    event: crossedCritical ? 'decayCrossedCritical' : undefined,
  };
}

// ---- 추구(pursuit) ----

const PURSUIT_MOMENTUM_DECAY_RATE = 0.25;
const PURSUIT_MOMENTUM_GAIN_RATE = 12;
const PURSUIT_PROGRESS_RATE = 10;
const PURSUIT_LOW_MOMENTUM_FLOOR = 15;
/** 모멘텀 바닥에 머문 개월 수에 대한 포기 확률의 해저드율 — 길어질수록 1-exp(-rate*months)로
 *  누적 포기 확률이 오른다. */
const PURSUIT_ABANDON_HAZARD_RATE = 0.15;

export function pursuitTick(state: PursuitState, input: ThreadTickInput): ThreadTickResult<PursuitState> {
  let momentum =
    input.attention > 0
      ? Math.min(100, state.momentum + input.attention * PURSUIT_MOMENTUM_GAIN_RATE * input.elapsedMonths)
      : state.momentum * Math.exp(-PURSUIT_MOMENTUM_DECAY_RATE * input.elapsedMonths);

  const progressGain = (momentum / 100) * input.attention * PURSUIT_PROGRESS_RATE * input.elapsedMonths;
  const progress = Math.min(100, state.progress + progressGain);

  if (progress >= 100) {
    return { nextState: { ...state, progress: 100, momentum }, salienceDelta: 0.8, event: 'pursuitResolved', endedWith: 'resolved' };
  }

  const monthsAtLowMomentum = momentum <= PURSUIT_LOW_MOMENTUM_FLOOR ? state.monthsAtLowMomentum + input.elapsedMonths : 0;

  if (monthsAtLowMomentum > 0) {
    const abandonChance = 1 - Math.exp(-PURSUIT_ABANDON_HAZARD_RATE * monthsAtLowMomentum);
    if (input.rng() < abandonChance) {
      return {
        nextState: { ...state, progress, momentum, monthsAtLowMomentum },
        salienceDelta: 0.5,
        event: 'pursuitAbandoned',
        endedWith: 'abandoned',
      };
    }
  }

  return {
    nextState: { ...state, progress, momentum, monthsAtLowMomentum },
    salienceDelta: monthsAtLowMomentum > 0 ? 0.2 : 0.05,
  };
}

// ---- 잠복(dormant) ----

export function dormantTick(state: DormantState, input: ThreadTickInput): ThreadTickResult<DormantState> {
  const p = state.hiddenProgress;
  const hiddenProgress = Math.max(0, Math.min(100, p + state.growthRate * p * (1 - p / 100) * input.elapsedMonths));

  if (hiddenProgress >= state.forcedSurfaceThreshold) {
    return {
      nextState: { ...state, hiddenProgress },
      salienceDelta: 1,
      event: 'dormantForcedSurface',
      endedWith: 'transformed',
      transformsInto: { domain: 'body', shape: 'pressure' },
    };
  }

  // 신호 누출 — elapsedMonths가 여러 달을 한 번에 대표할 수 있으므로 복합 확률로 굴린다.
  const leakProbability = 1 - Math.pow(1 - state.monthlySignalLeakChance, input.elapsedMonths);
  if (input.rng() < leakProbability) {
    const isFalseSignal = input.rng() < state.falseSignalChance;
    return {
      nextState: { ...state, hiddenProgress },
      salienceDelta: 0.4,
      event: isFalseSignal ? 'dormantFalseSignal' : 'dormantSignal',
    };
  }

  return { nextState: { ...state, hiddenProgress }, salienceDelta: 0.02 };
}

// ---- 압력(pressure) ----

export function pressureTick(state: PressureState, input: ThreadTickInput): ThreadTickResult<PressureState> {
  const monthsInStage = state.monthsInStage + input.elapsedMonths;
  const definition = state.stages[state.stage];

  if (definition.deadlineMonths !== null && monthsInStage >= definition.deadlineMonths && definition.onIgnored) {
    const nextStage = definition.onIgnored;
    const nextDefinition = state.stages[nextStage];
    const nextState: PressureState = {
      ...state,
      stage: nextStage,
      monthsInStage: 0,
      responseHistory: [...state.responseHistory, `ignored: ${state.stage} -> ${nextStage}`],
    };

    if (nextDefinition?.isResolution) {
      return { nextState, salienceDelta: 0.8, event: 'pressureIgnoredToResolution', endedWith: 'resolved' };
    }
    if (nextDefinition?.transformsInto) {
      return {
        nextState,
        salienceDelta: 0.8,
        event: 'pressureIgnoredToTransform',
        endedWith: 'transformed',
        transformsInto: nextDefinition.transformsInto,
      };
    }
    return { nextState, salienceDelta: 0.7, event: 'pressureEscalated' };
  }

  // 마감이 가까울수록 현저성(긴급도)이 오른다 — 시대 이벤트의 해저드 굴림과 같은 형태.
  const urgency = definition.deadlineMonths ? monthsInStage / definition.deadlineMonths : 0.1;
  return { nextState: { ...state, monthsInStage }, salienceDelta: Math.min(0.9, urgency * 0.6) };
}

// ---- 이행(transition) ----

export function transitionTick(state: TransitionState, input: ThreadTickInput): ThreadTickResult<TransitionState> {
  const monthsUntilDeadline = dateToTotalMonths(state.deadline) - dateToTotalMonths(input.currentDate);

  if (monthsUntilDeadline <= 0) {
    return { nextState: state, salienceDelta: 1, event: 'transitionArrived', endedWith: 'resolved' };
  }

  // rollEraEventTrigger(eraEvents.ts)와 같은 형태의 해저드 — 마감이 가까울수록 긴급도가 오른다.
  const urgency = 1 / (monthsUntilDeadline + 1);
  return { nextState: state, salienceDelta: Math.min(0.9, urgency * state.stakes) };
}
