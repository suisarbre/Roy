/**
 * 연도별 시계열 공통 조회기. 세계 데이터(CPI, 임금, 금리 등)는 전부 "연도 → 값" 표이고,
 * 게임은 그 표가 끝난 뒤(Roy는 2060년대까지 살 수 있다)에도 값을 물어본다. 그래서 조회는
 * 항상 세 경우로 나뉜다:
 *   - 표 안의 연도: 그대로 반환
 *   - 표 안이지만 빠진 연도(예: 10년 간격 센서스): 인접 두 점 사이를 보간
 *   - 표 밖: 가장 가까운 끝값에서 정해진 규칙으로 외삽(성장률 복리 또는 고정)
 */

export type AnnualTable = Readonly<Record<number, number>>;

export type Extrapolation =
  /** 끝값에 연 성장률을 복리로 적용(물가·임금처럼 계속 오르는 것). */
  | { kind: 'growth'; annualRate: number }
  /** 끝값을 그대로 유지(금리처럼 방향을 예측할 근거가 없는 것). */
  | { kind: 'hold' }
  /** 끝값에서 장기 평균으로 지수적으로 수렴(실업률처럼 평균 회귀하는 것). */
  | { kind: 'meanRevert'; longRunMean: number; halfLifeYears: number };

export interface AnnualSeries {
  table: AnnualTable;
  /** 첫 연도보다 이전을 물었을 때의 규칙. 성장형이면 역방향으로 할인한다. */
  before: Extrapolation;
  /** 마지막 연도보다 이후를 물었을 때의 규칙. */
  after: Extrapolation;
  /** 표 안의 빈 연도를 채우는 방식. 가격류는 기하(로그) 보간이 자연스럽다. */
  interpolation: 'linear' | 'geometric';
}

function sortedYears(table: AnnualTable): number[] {
  return Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
}

function extrapolate(anchorValue: number, yearsAway: number, rule: Extrapolation, direction: 1 | -1): number {
  switch (rule.kind) {
    case 'hold':
      return anchorValue;
    case 'growth':
      return anchorValue * Math.pow(1 + rule.annualRate, direction * yearsAway);
    case 'meanRevert': {
      const decay = Math.pow(0.5, yearsAway / rule.halfLifeYears);
      return rule.longRunMean + (anchorValue - rule.longRunMean) * decay;
    }
  }
}

/** 연도(소수 허용 — 1985.5 = 1985년 중반)에 대한 값. */
export function valueAt(series: AnnualSeries, year: number): number {
  const years = sortedYears(series.table);
  const first = years[0];
  const last = years[years.length - 1];

  if (year <= first) return extrapolate(series.table[first], first - year, series.before, -1);
  if (year >= last) return extrapolate(series.table[last], year - last, series.after, 1);

  const exact = series.table[year];
  if (exact !== undefined) return exact;

  let lo = first;
  let hi = last;
  for (const y of years) {
    if (y <= year) lo = y;
    if (y >= year) {
      hi = y;
      break;
    }
  }
  if (lo === hi) return series.table[lo];

  const t = (year - lo) / (hi - lo);
  const a = series.table[lo];
  const b = series.table[hi];
  return series.interpolation === 'geometric' ? a * Math.pow(b / a, t) : a + (b - a) * t;
}

/** 표가 실제로 덮는 연도 범위 — 외삽 구간인지 확인할 때 쓴다. */
export function coveredRange(series: AnnualSeries): { first: number; last: number } {
  const years = sortedYears(series.table);
  return { first: years[0], last: years[years.length - 1] };
}
