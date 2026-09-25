import { create } from 'zustand';
import { runTurn, type GameLoopDeps } from './gameLoop';
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
      const { state: nextState } = await runTurn(state, playerInput, deps);
      set({ state: nextState });
    } finally {
      set({ isProcessingTurn: false });
    }
  },

  resetGame: () => set({ state: createInitialGameState(), isProcessingTurn: false }),
}));
