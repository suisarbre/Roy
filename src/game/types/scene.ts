import type { NpcId } from './npc';

export interface SceneExchange {
  index: number;
  playerInput: string;
  reply: string;
  /** 라우터가 사소하다고 분류해 자기가 직접 대사를 생성했으면 false */
  wasSignificant: boolean;
}

/**
 * 대화 같은 왕복 상황 진행 중 상태. 매크로 턴 파이프라인(스킵/디테일 판단, elapsedMonths)을
 * 우회하고, 교환마다 라우터가 사소함/중요함만 판단한다. 씬이 끝나야 그 전체가 요약되어
 * 매크로 로그/그래프에 한 번만 커밋된다 — 대사 한 줄 한 줄이 그래프를 오염시키지 않게.
 */
export interface SceneState {
  id: string;
  involvedNpcIds: NpcId[];
  startedAtTurn: number;
  exchanges: SceneExchange[];
}
