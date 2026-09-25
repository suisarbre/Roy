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
  /**
   * 메인 모델이 스트리밍으로 narrative/reply를 채우는 동안의 실시간 텍스트. 턴이 확정되면
   * (로그에 커밋되면) null로 돌아간다 — 그 순간부터는 state.log/activeScene.exchanges가
   * 진짜 소스이므로 중복 표시를 막기 위함.
   */
  streamingNarrative: string | null;
  setStreamingNarrative: (text: string | null) => void;
  submitTurn: (playerInput: string | null, deps: GameLoopDeps) => Promise<void>;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: createInitialGameState(),
  isProcessingTurn: false,
  lastChainedTurns: [],
  streamingNarrative: null,
  setStreamingNarrative: (text) => set({ streamingNarrative: text }),

  submitTurn: async (playerInput, deps) => {
    if (get().isProcessingTurn) return;
    set({ isProcessingTurn: true, streamingNarrative: null });
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
      set({ isProcessingTurn: false, streamingNarrative: null });
    }
  },

  resetGame: () =>
    set({ state: createInitialGameState(), isProcessingTurn: false, lastChainedTurns: [], streamingNarrative: null }),
}));
