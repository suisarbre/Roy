import type { GameDate } from '../../game/types';

// ---- 경기 침체 ----

export interface Recession {
  /** 경기 정점(침체 시작) 월. */
  peak: GameDate;
  /** 경기 저점(침체 종료) 월. */
  trough: GameDate;
  /** 게임에서 쓸 짧은 이름. */
  label: string;
}

/**
 * NBER 경기순환 기준일 — 1962년 이후 미국 경기 침체.
 * 출처: National Bureau of Economic Research, "US Business Cycle Expansions and Contractions"
 * (https://www.nber.org/research/data/us-business-cycle-expansions-and-contractions).
 * 원문 표와 대조 완료(1960-04~1961-02 침체는 Roy 출생 전이라 제외).
 *
 * 쓰임새: 압력형 실타래(해고 바람, 사업 매출 급감)의 발생 확률 가중치. 침체 기간과 그 직후
 * 1~2년은 실업률(unemployment.ts)이 뒤늦게 정점을 찍는다는 점도 같이 고려할 것.
 */
export const US_RECESSIONS: readonly Recession[] = [
  { peak: { year: 1969, month: 12 }, trough: { year: 1970, month: 11 }, label: '1969–70 침체' },
  { peak: { year: 1973, month: 11 }, trough: { year: 1975, month: 3 }, label: '오일쇼크 침체' },
  { peak: { year: 1980, month: 1 }, trough: { year: 1980, month: 7 }, label: '1980 침체' },
  { peak: { year: 1981, month: 7 }, trough: { year: 1982, month: 11 }, label: '볼커 침체' },
  { peak: { year: 1990, month: 7 }, trough: { year: 1991, month: 3 }, label: '1990–91 침체' },
  { peak: { year: 2001, month: 3 }, trough: { year: 2001, month: 11 }, label: '닷컴 침체' },
  { peak: { year: 2007, month: 12 }, trough: { year: 2009, month: 6 }, label: '대침체' },
  { peak: { year: 2020, month: 2 }, trough: { year: 2020, month: 4 }, label: '코로나 침체' },
];

function monthIndex(date: GameDate): number {
  return date.year * 12 + (date.month - 1);
}

export function isInRecession(date: GameDate): boolean {
  const m = monthIndex(date);
  return US_RECESSIONS.some((r) => m >= monthIndex(r.peak) && m <= monthIndex(r.trough));
}

// ---- 징병 등록 (Selective Service) ----

/**
 * Roy(1962년 1월생)에게 실제로 걸리는 징병 관련 압력.
 *
 * - 베트남전 징집(induction)은 1973년에 끝났다. 1962년생은 그때 11세라 징집 대상이 된 적이 없다.
 * - 1980년 7월 카터 대통령의 Proclamation 4771로 징병 "등록"만 부활했다(징집은 없음).
 *   출생연도별 등록 기간: 1960년생 1980-07-21 주, 1961년생 1980-07-28 주,
 *   **1962년생 1981-01-05 주**, 1963년생 이후는 만 18세 생일 전후 60일 이내(단 1981-01-05 이전 불가).
 *   출처: The American Presidency Project, Proclamation 4771
 *   (https://www.presidency.ucsb.edu/documents/proclamation-4771-registration-under-the-military-selective-service-act)
 * - 미등록의 실질적 불이익: 1982년 Solomon Amendment로 연방 학자금 지원 자격이 등록 여부에
 *   연동됐다(출처: https://en.wikipedia.org/wiki/Solomon_Amendment).
 * - 처벌: 1982–1987년 사이 약 20명만 기소된 상징적 재판이 있었고 1987년 이후 기소는 사실상 중단.
 *   1980년 첫 등록 기간에 대상자 약 400만 명 중 약 100만 명이 등록하지 않았다는 추정이 있다.
 *   출처: Edward Hasbrouck(징병 반대 활동가 — 입장이 분명한 출처임에 유의)
 *   (https://hasbrouck.org/blog/archives/001513.html).
 *
 * 게임 설계 관점: 이건 "사건"이 아니라 가벼운 압력형 실타래다. 등록하면 조용히 해소, 무시하면
 * 대학 학자금 신청 시점에 다시 튀어나오는(부채형 비슷한) 불이익으로 전환되는 구조가 사실에 맞다.
 */
export const SELECTIVE_SERVICE = {
  vietnamInductionEndedYear: 1973,
  registrationReinstated: { year: 1980, month: 7 },
  registrationWindowByBirthYear: {
    1960: { year: 1980, month: 7 },
    1961: { year: 1980, month: 7 },
    1962: { year: 1981, month: 1 },
  } as Readonly<Record<number, GameDate>>,
  /** 1963년생 이후: 만 18세 생일 달. */
  laterCohortsRegisterAtAge: 18,
  registrationAgeRange: [18, 25] as const,
  studentAidLinkedFromYear: 1982,
  prosecutions: { count: 20, fromYear: 1982, toYear: 1987 },
  initialNonRegistrationShareEstimate: 0.25,
} as const;

/** 해당 출생연도 남성이 징병 등록 의무를 처음 지게 되는 달. 1959년 이전 출생은 해당 없음(null). */
export function selectiveServiceRegistrationDate(birth: GameDate): GameDate | null {
  if (birth.year < 1960) return null;
  const fixed = SELECTIVE_SERVICE.registrationWindowByBirthYear[birth.year];
  if (fixed) return fixed;
  return { year: birth.year + SELECTIVE_SERVICE.laterCohortsRegisterAtAge, month: birth.month };
}
