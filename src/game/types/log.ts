import type { GameDate } from './time';
import type { PlausibilityJudgment, RouterOutput, TurnKind } from './router';

export interface TurnLogEntry {
  turnIndex: number;
  date: GameDate;
  kind: TurnKind;
  /** detail 턴에서 플레이어가 입력한 자유 텍스트 */
  playerInput?: string;
  /** 플레이어에게 표시된 서사 텍스트 */
  narrative: string;
  routerOutput: RouterOutput;
  plausibilityJudgment?: PlausibilityJudgment;
}
