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

const DEFAULT_LOOKAHEAD_MONTHS = 24;

function dateToTotalMonths(date: GameDate): number {
  return date.year * 12 + (date.month - 1);
}

/**
 * 지금 시점 근방(lookaheadMonths 이내)에 해당 가능한 이벤트 후보를 값싸게 추려낸다.
 * 이미 겪은 이벤트는 제외한다(정의당 최대 1회 발생을 가정 — 반복 가능한 이벤트가 필요해지면
 * 나중에 EraEventDefinition에 repeatable 플래그를 추가하면 된다). 최종적으로 "진짜 겪는지,
 * 정확히 언제"는 이 후보군을 받은 라우터가 판단한다.
 */
export function getRelevantEraEvents(
  currentDate: GameDate,
  ageYears: number,
  occurredDefinitionIds: ReadonlySet<string>,
  lookaheadMonths: number = DEFAULT_LOOKAHEAD_MONTHS,
): EraEventDefinition[] {
  const currentTotalMonths = dateToTotalMonths(currentDate);
  const windowEndTotalMonths = currentTotalMonths + lookaheadMonths;
  const maxAgeInWindow = ageYears + Math.ceil(lookaheadMonths / 12);

  return ERA_EVENT_POOL.filter((definition) => {
    if (occurredDefinitionIds.has(definition.id)) return false;

    const [startYear, endYear] = definition.yearRange;
    const defStartMonths = startYear * 12;
    const defEndMonths = (endYear + 1) * 12 - 1; // 종료 연도 12월까지 포함
    const overlapsWindow = defStartMonths <= windowEndTotalMonths && defEndMonths >= currentTotalMonths;
    if (!overlapsWindow) return false;

    if (definition.ageRange) {
      const [minAge, maxAge] = definition.ageRange;
      if (maxAgeInWindow < minAge || ageYears > maxAge) return false;
    }

    return true;
  });
}
