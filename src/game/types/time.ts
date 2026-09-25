/** 게임 내 날짜. 일 단위 정밀도는 불필요하므로 연/월만 추적한다. */
export interface GameDate {
  year: number;
  month: number; // 1-12
}

export type LifeStage =
  | 'infancy' // 0-2
  | 'childhood' // 3-12
  | 'adolescence' // 13-18
  | 'youngAdult' // 19-29
  | 'adult' // 30-44
  | 'middleAge' // 45-64
  | 'oldAge'; // 65+

export interface GameClock {
  /** 출생 연도. ageYears/lifeStage를 date에서 파생시키기 위한 기준점. */
  birthYear: number;
  date: GameDate;
  ageYears: number;
  /** 스킵/디테일 턴 모두 포함한 단조 증가 카운터. 그래프 활성화 감쇠의 시간축으로 쓰인다. */
  turnIndex: number;
  lifeStage: LifeStage;
}
