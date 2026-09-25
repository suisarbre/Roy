import type { GameDate } from './time';
import type { PlausibilityJudgment, TurnKind } from './turn';

export interface TurnLogEntry {
  turnIndex: number;
  date: GameDate;
  kind: TurnKind;
  /** detail 턴에서 플레이어가 입력한 자유 텍스트 */
  playerInput?: string;
  /** 플레이어에게 표시된 서사 텍스트 */
  narrative: string;
  /**
   * 이번 턴(또는 씬 전체)에서 나온 개연성 판단 전부. 매크로 턴은 0~1개, 씬 종료 커밋은
   * 씬 동안의 모든 significant 교환 판단이 순서대로 들어간다 — 마지막 것만 남기지 않는다.
   */
  plausibilityJudgments: PlausibilityJudgment[];
}
