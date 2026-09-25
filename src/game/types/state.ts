import type { EraEventOccurrence } from './eraEvent';
import type { TurnLogEntry } from './log';
import type { MemoryGraph } from './memory';
import type { NpcId, Npc } from './npc';
import type { SceneState } from './scene';
import type { HiddenStats, ObservableStats } from './stats';
import type { GameClock } from './time';

export type GameStatus = 'alive' | 'dead';

export interface DeathInfo {
  cause: string;
  ageAtDeath: number;
  /** LLM이 인생 로그를 훑어보고 즉석 산출하는 점수. 일관성/정확성 보장 없음. */
  finalScore?: number;
}

export interface GameState {
  status: GameStatus;
  clock: GameClock;
  observable: ObservableStats;
  hidden: HiddenStats;
  npcs: Record<NpcId, Npc>;
  memoryGraph: MemoryGraph;
  log: TurnLogEntry[];
  eraEventOccurrences: EraEventOccurrence[];
  deathInfo?: DeathInfo;
  /** 있으면 지금 씬(대화 등) 진행 중 — 매크로 턴 대신 runSceneExchange로 처리해야 함 */
  activeScene?: SceneState;
}
