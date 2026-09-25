import { createEmptyMemoryGraph, type GameState } from './types';

// 확정: 1962년, 캘리포니아주 잉글우드(Inglewood) 출생 — LA 근교, 60년대 항공우주 제조업
// 노동자가 밀집했던 실제 도시로 "중산층에 약간 못 미치는 노동자 계층" 배경과 맞아떨어진다.
// 이 값 자체는 게임 로직에서 쓰이지 않고(도시는 상태 필드가 아니라 나중에 시스템 프롬프트의
// 캐릭터 설정에 들어갈 값), birthYear만 나이 계산용으로 실제 사용된다.
//
// 참고: 이 출생연도 기준으로는 베트남전 징병(1964-1973, 18-26세)이 나이상 절대 발동하지
// 않는다(1962년생은 징병 종료 시점에 11세) — eraEvents.ts의 연령 필터가 알아서 걸러내므로
// 버그는 아니고, 그냥 이 캐릭터의 인생에서 그 이벤트 풀 항목은 죽은 콘텐츠라는 뜻이다.
const BIRTH_YEAR = 1962;

export function createInitialGameState(): GameState {
  return {
    status: 'alive',
    clock: {
      birthYear: BIRTH_YEAR,
      date: { year: BIRTH_YEAR, month: 1 },
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
