import type { GameClock, LifeStage } from './types';

export function deriveLifeStage(ageYears: number): LifeStage {
  if (ageYears <= 2) return 'infancy';
  if (ageYears <= 12) return 'childhood';
  if (ageYears <= 18) return 'adolescence';
  if (ageYears <= 29) return 'youngAdult';
  if (ageYears <= 44) return 'adult';
  if (ageYears <= 64) return 'middleAge';
  return 'oldAge';
}

export function advanceClock(clock: GameClock, turnIndex: number, elapsedMonths: number): GameClock {
  const totalMonths = clock.date.year * 12 + (clock.date.month - 1) + Math.max(elapsedMonths, 0);
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  const ageYears = year - clock.birthYear;

  return {
    birthYear: clock.birthYear,
    date: { year, month },
    ageYears,
    turnIndex,
    lifeStage: deriveLifeStage(ageYears),
  };
}
