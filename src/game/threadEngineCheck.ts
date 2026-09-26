import { createRng } from '../sim/rng';
import { advanceUntilInputNeeded, runSceneExchange, type GameLoopDeps } from './gameLoop';
import { createInitialGameState } from './initialState';
import type { GameModelClient, SceneSummary, SceneTurnResponse, TurnResponse } from './llm/types';

/**
 * `npm run check:thread-engine` — 8단계(1차)에서 gameLoop.ts가 실타래 엔진에 실제로
 * 걸려 있는지 확인하는 헤드리스 스모크 테스트. WebGPU/실제 WebLLM은 이 환경에서 못 띄우므로
 * GameModelClient를 고정 응답 스텁으로 대체하고, 그 대신 어떤 trigger.kind로 호출됐는지를
 * 기록해서 'threadScene'이 실제로 등장하는지 확인한다. Math.random은 이 스크립트 안에서만
 * sim/rng.ts의 시드 RNG로 바꿔치기해 재현 가능하게 한다(실제 플레이 코드는 그대로 둠).
 */

const NEUTRAL_JUDGMENT = { verdict: 'neutral' as const, citedMemoryNodeIds: [], successBias: 'medium' as const };

function makeStubModel(triggerKinds: string[]): GameModelClient {
  return {
    async runTurn(request): Promise<TurnResponse> {
      triggerKinds.push(request.trigger.kind);
      return { narrative: 'Nothing remarkable happened.', plausibilityJudgment: NEUTRAL_JUDGMENT };
    },
    async runSceneTurn(): Promise<SceneTurnResponse> {
      return { reply: 'Okay.', plausibilityJudgment: NEUTRAL_JUDGMENT, sceneEnded: true };
    },
    async summarizeScene(): Promise<SceneSummary> {
      return { narrative: 'A brief exchange.', elapsedMonths: 0 };
    },
  };
}

const MAX_CYCLES = 800;

async function main(): Promise<void> {
  const originalRandom = Math.random;
  Math.random = createRng(42);

  const failures: string[] = [];
  const triggerKinds: string[] = [];
  const deps: GameLoopDeps = { model: makeStubModel(triggerKinds), language: 'en' };

  let state = createInitialGameState();
  let sawThreadsAfterAge13 = false;
  let cycles = 0;

  try {
    while (state.status === 'alive' && cycles < MAX_CYCLES) {
      cycles++;

      if (state.activeScene) {
        const sceneResult = await runSceneExchange(state, 'Okay.', deps);
        state = sceneResult.state;
      } else {
        const advanced = await advanceUntilInputNeeded(state, deps, null);
        state = advanced.state;
      }

      if (!Number.isFinite(state.hidden.finance.netWorth)) {
        failures.push(`hidden.finance.netWorth이 유한하지 않음: ${state.hidden.finance.netWorth} (cycle ${cycles})`);
        break;
      }
      if (!Number.isFinite(state.hidden.mentalHealth.stressAccumulation)) {
        failures.push(`hidden.mentalHealth.stressAccumulation이 유한하지 않음: ${state.hidden.mentalHealth.stressAccumulation} (cycle ${cycles})`);
        break;
      }
      if (state.clock.ageYears >= 13 && state.threads.length > 0) sawThreadsAfterAge13 = true;
    }
  } catch (error) {
    failures.push(`실행 중 예외 발생 (cycle ${cycles}): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  } finally {
    Math.random = originalRandom;
  }

  if (!sawThreadsAfterAge13) failures.push('13세 이후에도 threads가 한 번도 채워지지 않음 (ensureBaselineThreads 확인 필요)');
  if (!triggerKinds.includes('threadScene')) failures.push(`runTurn이 threadScene 트리거로 호출된 적 없음 (관측된 trigger.kind: ${[...new Set(triggerKinds)].join(', ') || '없음'})`);

  console.log(`실타래 엔진 연결 스모크 테스트 — ${cycles}사이클, 최종 나이 ${state.clock.ageYears.toFixed(1)}세, 상태 ${state.status}`);
  console.log(`trigger.kind 호출 횟수: ${JSON.stringify(
    triggerKinds.reduce<Record<string, number>>((acc, kind) => ({ ...acc, [kind]: (acc[kind] ?? 0) + 1 }), {}),
  )}`);
  console.log(`\n${failures.length === 0 ? 'PASS' : `FAIL (${failures.length}건)`}`);
  if (failures.length > 0) console.log(failures.map((f) => `  - ${f}`).join('\n'));

  process.exit(failures.length === 0 ? 0 : 1);
}

main();
