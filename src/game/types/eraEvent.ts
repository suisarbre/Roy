import type { GameDate } from './time';

/**
 * 시대가 강제하는 이벤트 (예: 베트남전 징병). 구체적인 풀 내용은 별도 설계 대상이며,
 * 여기서는 트리거/기록 구조만 정의한다.
 */
export interface EraEventDefinition {
  id: string;
  label: string;
  /** 발생 가능 연도 범위 */
  yearRange: [number, number];
  /** 발생 조건 (예: 남성, 18-25세 등) — 자유 형식 서술, 판단은 LLM에 위임 */
  eligibilityDescription: string;
}

export interface EraEventOccurrence {
  definitionId: string;
  occurredAt: GameDate;
  turnIndex: number;
}
