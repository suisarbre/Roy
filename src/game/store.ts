import { create } from 'zustand';
import { runSceneExchange, runTurn, type GameLoopDeps } from './gameLoop';
import { createInitialGameState } from './initialState';
import type { GameState } from './types';

interface GameStore {
  state: GameState;
  /** 턴 진행 중에는 true — UI에서 입력을 막거나 로딩 표시하는 데 쓴다. */
  isProcessingTurn: boolean;
  submitTurn: (playerInput: string | null, deps: GameLoopDeps) => Promise<void>;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialGameState(),
  isProcessingTurn: false,

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
        set({ state: nextState });
        return;
      }

      const { state: nextState } = await runTurn(state, playerInput, deps);
      set({ state: nextState });
    } finally {
      set({ isProcessingTurn: false });
    }
  },

  resetGame: () => set({ state: createInitialGameState(), isProcessingTurn: false }),
}));
