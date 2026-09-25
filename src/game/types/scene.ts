import type { NpcId } from './npc';
import type { PlausibilityJudgment } from './turn';

export interface SceneExchange {
  index: number;
  playerInput: string;
  reply: string;
  /** 이 교환의 개연성 판단이 neutral이 아니었거나 outcomeImpact가 있었으면 true. */
  wasSignificant: boolean;
}

/**
 * 대화 같은 왕복 상황 진행 중 상태. 매크로 턴 파이프라인(스킵/디테일 판단, elapsedMonths)을
 * 우회하고, 교환마다 곧장 모델을 불러 대사+판단을 받는다(분류 단계 없음 — 라우터가 없으므로).
 * 씬이 끝나야 그 전체가 요약되어 매크로 로그/그래프에 한 번만 커밋된다 — 대사 한 줄 한 줄이
 * 그래프를 오염시키지 않게.
 */
export interface SceneState {
  id: string;
  involvedNpcIds: NpcId[];
  startedAtTurn: number;
  exchanges: SceneExchange[];
  /**
   * significant 교환마다 쌓인 개연성 판단 — 씬이 여러 번의 significant 교환을 거칠 수
   * 있으므로, 마지막 것만 남기지 않고 전부 보존해서 씬 종료 시 로그에 같이 커밋한다.
   */
  judgments: PlausibilityJudgment[];
}
