import type { GameDate } from './time';

/**
 * 시대가 강제하는 이벤트 (예: 베트남전 징병).
 *
 * 이 정의는 라우터가 "지금 이 시점에 이걸 겪는가"를 최종 판단할 때 참고하는 후보일 뿐이다.
 * 실제로 겪는지 여부는 항상 라우터의 즉석 판단이고, ageRange/yearRange는 그 후보군을
 * 코드가 값싸게 미리 좁혀주는 결정적(deterministic) 필터일 뿐 자격을 확정하지 않는다 —
 * 최종 뉘앙스(직업, 신체 조건, 개인 서사 등)는 eligibilityDescription을 읽은 라우터의 몫이다.
 */
export interface EraEventDefinition {
  id: string;
  label: string;
  /** 발생 가능 연도 범위 (해당 연도 전체 포함) */
  yearRange: [number, number];
  /** 발생 가능 나이 범위 — 없으면 나이 제한 없음 (예: 9/11, 팬데믹처럼 전 세대에 해당) */
  ageRange?: [number, number];
  /** 발생 조건 서술 (예: "남성만 징병 대상이었음") — 자유 형식, 최종 판단은 LLM에 위임 */
  eligibilityDescription: string;
}

export interface EraEventOccurrence {
  definitionId: string;
  occurredAt: GameDate;
  turnIndex: number;
}
