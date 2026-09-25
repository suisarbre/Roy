import type { EraEventDefinition, GameDate } from './types';

/**
 * 시작용 이벤트 풀 — 문서에서 "추후 논의"로 남겨둔 항목의 최소 구현이다. 1960년대~현재를
 * 전부 채운 것이 아니라, 메커니즘이 실제로 동작하는지 보여주는 소수의 실제 사건만 넣었다.
 * 나이 제한이 없는 이벤트(9/11, 팬데믹)와 있는 이벤트(징병, 금융위기)를 섞어서 두 경로 다
 * 검증한다. 항목 추가/조정은 언제든 가능 — 이 배열이 유일한 소스.
 *
 * 참고: 베트남전 징병은 "캐릭터가 남성"이라는 전제가 깔려 있다. GameState엔 성별 필드가
 * 따로 없다 — 문서상 Roy는 고정 캐릭터라 이런 전제는 (도시/출생연도처럼) 결국 시스템
 * 프롬프트의 캐릭터 설정에서 고정될 값이지 상태로 관리할 값이 아니라고 보고 여기 텍스트로만
 * 남겨둔다.
 */
export const ERA_EVENT_POOL: EraEventDefinition[] = [
  {
    id: 'vietnam-draft',
    label: '베트남전 징병',
    yearRange: [1964, 1973],
    ageRange: [18, 26],
    eligibilityDescription: '남성만 징병 대상이었던 시대 — 캐릭터가 남성이라는 전제 하의 이벤트.',
  },
  {
    id: '911-attacks',
    label: '9/11 테러',
    yearRange: [2001, 2001],
    ageRange: [5, 120],
    eligibilityDescription: '살아있는 모든 사람이 겪는 사회적 충격 사건. 나이에 따라 받아들이는 정도만 다르다.',
  },
  {
    id: '2008-financial-crisis',
    label: '2008 금융위기',
    yearRange: [2008, 2009],
    ageRange: [18, 65],
    eligibilityDescription: '경제활동인구는 해고/구직난/자산 하락 등으로 직접 영향. 그 외 연령은 간접적 영향만.',
  },
  {
    id: 'covid-19-pandemic',
    label: '코로나19 팬데믹',
    yearRange: [2020, 2021],
    eligibilityDescription: '살아있는 모든 사람이 겪는 봉쇄/격리/원격근무 등의 사건.',
  },
];

function dateToTotalMonths(date: GameDate): number {
  return date.year * 12 + (date.month - 1);
}

/** 지금 이 순간 이 이벤트의 자격 구간(연도+나이) 안에 있는지. */
export function isEraEventWindowOpen(currentDate: GameDate, ageYears: number, definition: EraEventDefinition): boolean {
  const [startYear, endYear] = definition.yearRange;
  if (currentDate.year < startYear || currentDate.year > endYear) return false;
  if (definition.ageRange) {
    const [minAge, maxAge] = definition.ageRange;
    if (ageYears < minAge || ageYears > maxAge) return false;
  }
  return true;
}

/**
 * 자격 구간이 닫히기까지 남은 개월 수(연도 제한과 나이 제한 중 더 빨리 닫히는 쪽 기준).
 * rollEraEventTrigger의 입력으로 쓴다 — 창이 닫혀갈수록 트리거 확률이 올라가게 하기 위함.
 */
export function monthsRemainingInEraEventWindow(currentDate: GameDate, ageYears: number, definition: EraEventDefinition): number {
  const currentTotalMonths = dateToTotalMonths(currentDate);
  const yearWindowEndMonths = (definition.yearRange[1] + 1) * 12 - 1 - currentTotalMonths;

  let ageWindowEndMonths = Infinity;
  if (definition.ageRange) {
    ageWindowEndMonths = Math.max(0, Math.round((definition.ageRange[1] - ageYears) * 12));
  }

  return Math.max(0, Math.min(yearWindowEndMonths, ageWindowEndMonths));
}

/**
 * "지금이 그 순간이다"를 코드가 직접 굴린다(예전엔 라우터가 매턴 판단했다). remainingMonths가
 * 적을수록(창이 닫혀갈수록) 확률이 올라가서, 마지막 기회(remainingMonths<=0)에는 반드시
 * 트리거된다 — 자격 구간을 통째로 놓치는 일이 없게 하기 위한 장치.
 */
export function rollEraEventTrigger(remainingMonthsInWindow: number): boolean {
  if (remainingMonthsInWindow <= 0) return true;
  const probability = 1 / (remainingMonthsInWindow + 1);
  return Math.random() < probability;
}

/** 지금 자격 구간이 열려 있고 아직 안 겪은 시대 이벤트들 — 매 스킵 사이클마다 이걸 굴린다. */
export function getOpenEraEventCandidates(
  currentDate: GameDate,
  ageYears: number,
  occurredDefinitionIds: ReadonlySet<string>,
): EraEventDefinition[] {
  return ERA_EVENT_POOL.filter(
    (definition) => !occurredDefinitionIds.has(definition.id) && isEraEventWindowOpen(currentDate, ageYears, definition),
  );
}
