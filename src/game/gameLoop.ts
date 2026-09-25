import { advanceClock } from './clock';
import type { MainModelClient, RouterModelClient } from './llm/types';
import { applyMemoryGraphDelta, getAmbientlyRecalledNodeIds } from './memoryGraphOps';
import type { GameState, TurnLogEntry } from './types';

export interface GameLoopDeps {
  routerModel: RouterModelClient;
  mainModel: MainModelClient;
}

export interface TurnResult {
  state: GameState;
  logEntry: TurnLogEntry;
}

function buildSkipNarrative(elapsedMonths: number): string {
  // TODO: 지금은 템플릿 문구. 나중에 라우터가 맥락(예: contextTags)을 반영한 한 줄 요약을
  // 직접 생성하도록 바꿀 수 있음 — 우선은 문서 예시("그렇게 3개월이 별일 없이 흘렀다")만 구현.
  if (elapsedMonths <= 0) return '별다른 사건 없이 시간이 흘렀다.';
  if (elapsedMonths === 1) return '그렇게 한 달이 별일 없이 흘렀다.';
  return `그렇게 ${elapsedMonths}개월이 별일 없이 흘렀다.`;
}

/**
 * 한 턴을 처리한다: 라우터 호출 → 그래프 갱신 → (detail이면) 메인 모델 호출 → 상태/로그 갱신.
 *
 * 아직 구현하지 않은 것 (설계 미확정이라 의도적으로 비워둠):
 * - 시대 강제 이벤트 체크 (이벤트 풀 내용 자체가 문서상 미정)
 * - observable/hidden 스탯 드리프트 (밸런스 수치가 아직 없어서, 지금은 상태를 그대로 통과시킴)
 */
export async function runTurn(state: GameState, playerInput: string | null, deps: GameLoopDeps): Promise<TurnResult> {
  if (state.status === 'dead') {
    throw new Error('게임이 이미 종료된 상태에서는 턴을 진행할 수 없습니다.');
  }

  const nextTurnIndex = state.clock.turnIndex + 1;

  const routerOutput = await deps.routerModel.runRouterTurn({ state, playerInput });

  const memoryGraph = applyMemoryGraphDelta(state.memoryGraph, routerOutput.memoryGraphDelta, nextTurnIndex);
  const nextClock = advanceClock(state.clock, nextTurnIndex, routerOutput.elapsedMonths);

  let narrative: string;
  let plausibilityJudgment: TurnLogEntry['plausibilityJudgment'];
  let status: GameState['status'] = state.status;
  let deathInfo: GameState['deathInfo'];

  if (routerOutput.turnType === 'detail' && routerOutput.intent) {
    const recalledMemoryNodeIds = getAmbientlyRecalledNodeIds(memoryGraph, nextTurnIndex);

    const response = await deps.mainModel.runDetailTurn({
      state: { ...state, memoryGraph },
      intent: routerOutput.intent,
      recalledMemoryNodeIds,
    });

    narrative = response.narrative;
    plausibilityJudgment = response.plausibilityJudgment;

    if (response.death) {
      status = 'dead';
      deathInfo = { cause: response.death.cause, ageAtDeath: nextClock.ageYears };
    }
  } else {
    narrative = buildSkipNarrative(routerOutput.elapsedMonths);
  }

  const logEntry: TurnLogEntry = {
    turnIndex: nextTurnIndex,
    date: nextClock.date,
    kind: routerOutput.turnType,
    playerInput: playerInput ?? undefined,
    narrative,
    routerOutput,
    plausibilityJudgment,
  };

  const nextState: GameState = {
    ...state,
    status,
    clock: nextClock,
    memoryGraph,
    log: [...state.log, logEntry],
    deathInfo: deathInfo ?? state.deathInfo,
  };

  return { state: nextState, logEntry };
}
