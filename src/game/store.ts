import { create } from 'zustand';
import { advanceUntilInputNeeded, runSceneExchange, type GameLoopDeps, type TurnResult } from './gameLoop';
import { createInitialGameState } from './initialState';
import type { GameState } from './types';

interface GameStore {
  state: GameState;
  /** 턴 진행 중에는 true — UI에서 입력을 막거나 로딩 표시하는 데 쓴다. */
  isProcessingTurn: boolean;
  /**
   * 가장 최근 submitTurn 호출에서 체이닝된 매크로 턴들 (스킵 여러 개 + 마지막 detail).
   * UI가 이걸 순서대로 하나씩 보여주면 "시간이 흘러가는" 느낌을 낼 수 있다. 씬 교환일 때는
   * 체이닝이 없으므로 빈 배열.
   */
  lastChainedTurns: TurnResult[];
  submitTurn: (playerInput: string | null, deps: GameLoopDeps) => Promise<void>;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialGameState(),
  isProcessingTurn: false,
  lastChainedTurns: [],

  submitTurn: async (playerInput, deps) => {
    if (get().isProcessingTurn) return;
    set({ isProcessingTurn: true });
    try {
      const { state } = get();

      if (state.activeScene) {
        if (playerInput === null) {
          throw new Error('씬 진행 중에는 빈 입력으로 넘어갈 수 없습니다 — 대사를 입력해야 합니다.');
        }
        const { state: nextState } = await runSceneExchange(state, playerInput, deps);
        set({ state: nextState, lastChainedTurns: [] });
        return;
      }

      const { state: nextState, turns } = await advanceUntilInputNeeded(state, deps, playerInput);
      set({ state: nextState, lastChainedTurns: turns });
    } finally {
      set({ isProcessingTurn: false });
    }
  },

  resetGame: () => set({ state: createInitialGameState(), isProcessingTurn: false, lastChainedTurns: [] }),
}));
