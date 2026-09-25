import { createEmptyMemoryGraph, type GameState } from './types';

// TODO(확정 필요): 문서의 "확정되지 않은 항목"에 출생 연도/도시가 명시적으로 안 정해져 있음.
// 1960년대라는 것만 확정이라 일단 1962년으로 임시 지정 — 실제 값은 별도 논의 후 교체.
const PLACEHOLDER_BIRTH_YEAR = 1962;

export function createInitialGameState(): GameState {
  return {
    status: 'alive',
    clock: {
      birthYear: PLACEHOLDER_BIRTH_YEAR,
      date: { year: PLACEHOLDER_BIRTH_YEAR, month: 1 },
      ageYears: 0,
      turnIndex: 0,
      lifeStage: 'infancy',
    },
    observable: {
      finance: { cashOnHand: 0, lastStatementBalance: 0, lastStatementDate: null },
      health: { lastCheckup: null, lastCheckupDate: null },
      relationships: {},
      mentalHealth: { visibleSymptoms: [] },
    },
    hidden: {
      finance: { netWorth: 0, hiddenDebt: 0, creditStanding: 50 },
      health: { diseaseProgress: {}, chronicSeeds: [] },
      relationships: {},
      mentalHealth: { stressAccumulation: 0, burnoutLevel: 0 },
    },
    npcs: {},
    memoryGraph: createEmptyMemoryGraph(),
    log: [],
    eraEventOccurrences: [],
  };
}
