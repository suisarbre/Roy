import type { GameDate } from '../game/types';

/** GameDate 산술 — sim/ 전역에서 쓰는 순수 함수. dynamics.ts의 private 버전과 monteCarlo.ts의
 *  인라인 계산이 같은 공식을 따로 들고 있던 걸 여기 하나로 모았다. */

export function dateToTotalMonths(date: GameDate): number {
  return date.year * 12 + (date.month - 1);
}

export function totalMonthsToDate(totalMonths: number): GameDate {
  return { year: Math.floor(totalMonths / 12), month: (totalMonths % 12) + 1 };
}

export function addMonths(date: GameDate, months: number): GameDate {
  return totalMonthsToDate(dateToTotalMonths(date) + months);
}

export function monthsBetween(from: GameDate, to: GameDate): number {
  return dateToTotalMonths(to) - dateToTotalMonths(from);
}

/** 소수점 있는 나이(예: 27.5세) — 생애사건 해저드가 "그 나이대 몇 %"를 월 단위로 쪼개 쓰므로
 *  정수 나이보다 이게 필요하다. */
export function ageInYearsAt(birthYear: number, date: GameDate): number {
  return (dateToTotalMonths(date) - birthYear * 12) / 12;
}
