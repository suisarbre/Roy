import type { GameDate } from './time';

/**
 * 시대가 강제하는 이벤트 (예: 베트남전 징병).
 *
 * "지금 이 시점에 이걸 겪는가"는 전부 코드(eraEvents.ts)가 결정한다 — yearRange/ageRange로
 * 자격 구간을 판정하고, 구간이 열려 있으면 닫혀갈수록 확률이 오르는 방식으로 정확한 시점을
 * 굴린다. 모델은 "지금이 그 순간"이라고 코드가 이미 정한 뒤에야 한 번 불려서, 그 사건을
 * eligibilityDescription을 참고해 Roy의 상황에 맞게 서술만 한다 — 겪는지 여부 자체는
 * 판단하지 않는다.
 */
export interface EraEventDefinition {
  id: string;
  label: string;
  /** 발생 가능 연도 범위 (해당 연도 전체 포함) */
  yearRange: [number, number];
  /** 발생 가능 나이 범위 — 없으면 나이 제한 없음 (예: 9/11, 팬데믹처럼 전 세대에 해당) */
  ageRange?: [number, number];
  /** 발생 조건 서술 (예: "남성만 징병 대상이었음") — 모델이 서술 시 참고하는 자유 형식 맥락 */
  eligibilityDescription: string;
}

export interface EraEventOccurrence {
  definitionId: string;
  occurredAt: GameDate;
  turnIndex: number;
}
