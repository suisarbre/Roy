import type { GameDate } from '../../game/types';
import { averageAnnualWageAt } from '../data';
import { dateToTotalMonths, totalMonthsToDate } from '../gameDate';
import { simulateCareer } from '../career/model';
import type { OccupationId } from '../career/occupations';
import type { CareerParams } from '../career/params';
import type { CareerEventKind, CareerOutcome, LaborState, MonthTrace } from '../career/types';
import { createRng } from '../rng';
import type { ThreadDomain } from '../threads/types';
import { DEFAULT_CAREER_PARAMS, toWorker, type PersonProfile } from './profile';

/**
 * 한 사람의 경력 궤적을 필요할 때 계산해서 보여주는 창. 경력은 프로필의 lifeSeed로 완전히 정해지므로
 * 저장하지 않고 캐시만 한다 — 배경 NPC는 한 번 계산(약 1ms)해 요약만 보고, 가까운 NPC는 월별 사건을
 * 실타래 이벤트로 받는다(npc/lifecycle.ts).
 *
 * 여성: 경력 모델은 아직 남성만 보정돼 있다(1960년대생 여성의 노동 참여는 결혼·출산과 얽혀 있어서
 * 결혼 모델과 통합하는 단계에서 넣는다). 그때까지 여성 프로필의 경력은 undefined.
 */

const cache = new Map<string, CareerOutcome>();
const CACHE_LIMIT = 2000;

export function careerLifeOf(profile: PersonProfile, params: CareerParams = DEFAULT_CAREER_PARAMS): CareerOutcome | undefined {
  if (profile.sex !== 'male') return undefined;
  const key = `${profile.lifeSeed}:${profile.birthYear}:${params === DEFAULT_CAREER_PARAMS ? 'default' : JSON.stringify(params)}`;
  let outcome = cache.get(key);
  if (!outcome) {
    outcome = simulateCareer(toWorker(profile), params, createRng(profile.lifeSeed), { keepMonths: true, untilAge: 80 });
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    cache.set(key, outcome);
  }
  return outcome;
}

function monthIndex(profile: PersonProfile, outcome: CareerOutcome, date: GameDate): number {
  const ageMonths = dateToTotalMonths(date) - (profile.birthYear * 12 + profile.birthMonth);
  return ageMonths - (outcome.months?.[0]?.ageMonths ?? 16 * 12);
}

export interface CareerStatus {
  state: LaborState | 'child';
  occupation?: OccupationId;
  /** 연봉(그 해 달러) — 임금근로자일 때. */
  annualWageDollars?: number;
  /** 순자산(그 해 달러). */
  netWorthDollars: number;
}

export function careerStatusAt(profile: PersonProfile, date: GameDate): CareerStatus | undefined {
  const outcome = careerLifeOf(profile);
  if (!outcome?.months) return undefined;
  const i = monthIndex(profile, outcome, date);
  if (i < 0) return { state: 'child', netWorthDollars: 0 };
  const m: MonthTrace = outcome.months[Math.min(i, outcome.months.length - 1)];
  const awi = averageAnnualWageAt(m.year);
  return {
    state: i >= outcome.months.length ? 'retired' : m.state,
    occupation: m.occupation,
    annualWageDollars: m.logWage !== undefined && m.state === 'employed' ? Math.round(Math.exp(m.logWage) * awi) : undefined,
    netWorthDollars: Math.round(m.netWorth * awi),
  };
}

export interface CareerEvent {
  date: GameDate;
  kind: CareerEventKind;
  occupation?: OccupationId;
  /** 모델이 붙인 한국어 사건 문자열(예: "항공우주 구조조정으로 공장 폐쇄"). */
  text: string;
}

/** [from, to) 구간의 경력 사건. */
export function careerEventsBetween(profile: PersonProfile, from: GameDate, to: GameDate): CareerEvent[] {
  const outcome = careerLifeOf(profile);
  if (!outcome?.months) return [];
  const start = Math.max(0, monthIndex(profile, outcome, from));
  const end = Math.min(outcome.months.length, monthIndex(profile, outcome, to));
  const events: CareerEvent[] = [];
  const base = profile.birthYear * 12 + profile.birthMonth;
  for (let i = start; i < end; i++) {
    const m = outcome.months[i];
    if (!m.eventKind) continue;
    events.push({ date: totalMonthsToDate(base + m.ageMonths), kind: m.eventKind, occupation: m.occupation, text: m.event ?? m.eventKind });
  }
  return events;
}

/** 실타래 이벤트로 옮길 때의 현저성과 도메인 — 설계 가정(npc/collision.ts 문턱 0.5 기준: 해고·폐쇄·
 *  장애·창업·폐업·관리자 승진·은퇴·입대는 넘고, 평범한 이직·승진·그만둠은 안 넘는다). */
export const CAREER_EVENT_SALIENCE: Readonly<Record<CareerEventKind, { salience: number; domain: ThreadDomain }>> = {
  schoolExit: { salience: 0.3, domain: 'work' },
  enlisted: { salience: 0.7, domain: 'work' },
  discharged: { salience: 0.5, domain: 'work' },
  hired: { salience: 0.45, domain: 'work' },
  jobToJob: { salience: 0.4, domain: 'work' },
  promoted: { salience: 0.45, domain: 'work' },
  promotedToManager: { salience: 0.65, domain: 'work' },
  quit: { salience: 0.45, domain: 'work' },
  laidOff: { salience: 0.8, domain: 'livelihood' },
  plantClosing: { salience: 0.85, domain: 'livelihood' },
  disabled: { salience: 0.9, domain: 'body' },
  leftLaborForce: { salience: 0.55, domain: 'livelihood' },
  businessStarted: { salience: 0.7, domain: 'dreams' },
  businessClosed: { salience: 0.75, domain: 'livelihood' },
  retired: { salience: 0.6, domain: 'work' },
};

export const OCCUPATION_LABEL_EN: Readonly<Record<OccupationId, string>> = {
  farmLabor: 'farm worker',
  laborer: 'laborer',
  foodService: 'restaurant worker',
  retailSales: 'retail clerk',
  operative: 'factory machine operator',
  aerospaceAssembler: 'aircraft assembler',
  truckDriver: 'truck driver',
  mechanic: 'mechanic',
  constructionTrades: 'construction tradesman',
  clerical: 'office clerk',
  military: 'enlisted soldier',
  salesRep: 'sales representative',
  protectiveService: 'police officer or firefighter',
  technician: 'technician',
  nurse: 'nurse',
  teacher: 'schoolteacher',
  businessProfessional: 'accountant or business professional',
  engineer: 'engineer',
  aerospaceEngineer: 'aerospace engineer',
  otherProfessional: 'professional',
  manager: 'manager',
  professor: 'professor',
  lawyer: 'lawyer',
  physician: 'doctor',
};

/** 기억 그래프에 넣을 영어 사실 문장(game/npcCheckIn.ts의 기존 문장들과 같은 톤). */
export function describeCareerEvent(name: string, event: CareerEvent): string {
  const job = event.occupation ? OCCUPATION_LABEL_EN[event.occupation] : undefined;
  switch (event.kind) {
    case 'schoolExit':
      return `${name} finished school.`;
    case 'enlisted':
      return `${name} enlisted in the army.`;
    case 'discharged':
      return `${name} got out of the service.`;
    case 'hired':
      return `${name} found work${job ? ` as a ${job}` : ''}.`;
    case 'jobToJob':
      return `${name} moved to a better job${job ? ` as a ${job}` : ''}.`;
    case 'promoted':
      return `${name} got a promotion.`;
    case 'promotedToManager':
      return `${name} was promoted to manager.`;
    case 'quit':
      return `${name} quit their job.`;
    case 'laidOff':
      return `${name} was laid off.`;
    case 'plantClosing':
      return event.text.includes('항공우주') ? `${name} lost their job when the aerospace plant shut down.` : `${name} lost their job when the plant closed.`;
    case 'disabled':
      return `${name} had to stop working because of a disability.`;
    case 'leftLaborForce':
      return `${name} gave up looking for work.`;
    case 'businessStarted':
      return `${name} started their own business.`;
    case 'businessClosed':
      return `${name}'s business went under.`;
    case 'retired':
      return `${name} retired.`;
  }
}

/** LLM 장면 프롬프트용 한 줄 — 지금 무슨 일을 하고 얼마를 버는지. */
export function describeCareerStatus(status: CareerStatus | undefined): string | undefined {
  if (!status) return undefined;
  switch (status.state) {
    case 'child':
      return undefined;
    case 'student':
      return 'in school';
    case 'employed': {
      const job = status.occupation ? OCCUPATION_LABEL_EN[status.occupation] : 'employed';
      return status.annualWageDollars ? `${job}, earns about $${Math.round(status.annualWageDollars / 1000)}k a year` : job;
    }
    case 'selfEmployed':
      return 'runs their own small business';
    case 'unemployed':
      return 'out of work, looking';
    case 'outOfLaborForce':
      return 'not working';
    case 'retired':
      return 'retired';
  }
}

