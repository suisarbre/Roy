import type { EraEventOccurrence } from './eraEvent';
import type { TurnLogEntry } from './log';
import type { MemoryGraph } from './memory';
import type { NpcId, Npc } from './npc';
import type { SceneState } from './scene';
import type { HiddenStats, ObservableStats } from './stats';
import type { GameClock } from './time';
import type { JuxtapositionState } from '../../sim/salience';
import type { SharedResources, Thread } from '../../sim/threads/types';

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

  /**
   * 8단계(1차) — src/sim/ 실타래 엔진의 살아있는 상태. "계속하기"마다
   * gameLoop.ts가 이걸 진행시켜 문턱을 넘는 순간을 장면화한다(decideSkipStretch 참고).
   * sharedResources는 사이클 동안만 쓰는 작업용 스냅샷이지 별도 진실 소스가 아니다 —
   * 매 사이클 시작 시 hidden.finance.netWorth/hidden.mentalHealth.stressAccumulation에서
   * 재시딩되고, tick 후 변화량만 그쪽에 다시 써넣는다(gameLoop.ts의 syncResourcesIntoHidden).
   */
  threads: Thread[];
  sharedResources: SharedResources;
  juxtapositionState: JuxtapositionState;
}
