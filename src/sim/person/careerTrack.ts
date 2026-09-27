import type { GameDate } from '../../game/types';
import type { CareerStepResult } from '../career/model';
import type { OccupationId } from '../career/occupations';
import type { CareerEventKind, LaborState } from '../career/types';
import { averageAnnualWageAt } from '../data';
import { dateToTotalMonths, totalMonthsToDate } from '../gameDate';
import type { ThreadDomain } from '../threads/types';
import { buildLifeStory, type FamilyEvent, type FamilyEventKind, type LifeStoryOptions } from './lifeStory';
import type { PersonProfile } from './profile';

/**
 * 한 사람의 인생 이야기(lifeStory.ts — 경력 + 결혼·출산)를 날짜로 들여다보는 창. 배경 NPC는 요약만 보고,
 * 가까운 NPC는 월별 사건을 실타래 이벤트로 받는다(npc/lifecycle.ts). 남녀 모두 — 여성의 경력은 결혼·출산과
 * 함께 굴린 결과다.
 */

function monthAt(profile: PersonProfile, months: readonly CareerStepResult[], date: GameDate): number {
  const ageMonths = dateToTotalMonths(date) - (profile.birthYear * 12 + profile.birthMonth);
  return ageMonths - (months[0]?.ageMonths ?? 16 * 12);
}

export interface CareerStatus {
  state: LaborState | 'child';
  occupation?: OccupationId;
  /** 연봉(그 해 달러) — 임금근로자일 때. */
  annualWageDollars?: number;
  /** 순자산(그 해 달러). */
  netWorthDollars: number;
}

export function careerStatusAt(profile: PersonProfile, date: GameDate, options?: LifeStoryOptions): CareerStatus | undefined {
  const { months } = buildLifeStory(profile, options);
  if (months.length === 0) return undefined;
  const i = monthAt(profile, months, date);
  if (i < 0) return { state: 'child', netWorthDollars: 0 };
  const m = months[Math.min(i, months.length - 1)];
  const awi = averageAnnualWageAt(m.year);
  return {
    state: i >= months.length ? 'retired' : m.state,
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
export function careerEventsBetween(profile: PersonProfile, from: GameDate, to: GameDate, options?: LifeStoryOptions): CareerEvent[] {
  const { months } = buildLifeStory(profile, options);
  const start = Math.max(0, monthAt(profile, months, from));
  const end = Math.min(months.length, monthAt(profile, months, to));
  const events: CareerEvent[] = [];
  const base = profile.birthYear * 12 + profile.birthMonth;
  for (let i = start; i < end; i++) {
    const m = months[i];
    if (!m.eventKind) continue;
    events.push({ date: totalMonthsToDate(base + m.ageMonths), kind: m.eventKind, occupation: m.occupation, text: m.event ?? m.eventKind });
  }
  return events;
}

/** [from, to) 구간의 가족 사건(결혼·출산·이혼·사별). */
export function familyEventsBetween(profile: PersonProfile, from: GameDate, to: GameDate, options?: LifeStoryOptions): FamilyEvent[] {
  const lo = dateToTotalMonths(from);
  const hi = dateToTotalMonths(to);
  return buildLifeStory(profile, options).familyEvents.filter((e) => {
    const t = dateToTotalMonths(e.date);
    return t >= lo && t < hi;
  });
}

/** 관계 유형 → 인생 이야기 옵션: 배우자는 Roy와 결혼했고, 부모는 반드시 결혼했다. */
export function storyOptionsFor(relationType: string): LifeStoryOptions {
  return { marriedToRoy: relationType === 'spouse', forceMarried: relationType === 'parent' };
}

export interface FamilyStatus {
  maritalStatus: 'never' | 'married' | 'divorced' | 'widowed';
  children: number;
}

export function familyStatusAt(profile: PersonProfile, date: GameDate, options?: LifeStoryOptions): FamilyStatus {
  if (options?.marriedToRoy) return { maritalStatus: 'married', children: 0 };
  const t = dateToTotalMonths(date);
  let maritalStatus: FamilyStatus['maritalStatus'] = 'never';
  let children = 0;
  for (const e of buildLifeStory(profile, options).familyEvents) {
    if (dateToTotalMonths(e.date) > t) break;
    if (e.kind === 'married') maritalStatus = 'married';
    else if (e.kind === 'childBorn') children += 1;
    else maritalStatus = e.kind;
  }
  return { maritalStatus, children };
}

export const FAMILY_EVENT_SALIENCE: Readonly<Record<FamilyEventKind, { salience: number; domain: ThreadDomain }>> = {
  married: { salience: 0.75, domain: 'relationships' },
  childBorn: { salience: 0.8, domain: 'familyDuty' },
  divorced: { salience: 0.85, domain: 'relationships' },
  widowed: { salience: 0.9, domain: 'relationships' },
};

export function describeFamilyEvent(name: string, event: FamilyEvent): string {
  switch (event.kind) {
    case 'married':
      return `${name} got married.`;
    case 'childBorn':
      return `${name} had a baby.`;
    case 'divorced':
      return `${name} went through a divorce.`;
    case 'widowed':
      return `${name}'s spouse died.`;
  }
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
  leftForFamily: { salience: 0.6, domain: 'familyDuty' },
  returnedToWork: { salience: 0.5, domain: 'work' },
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
    case 'leftForFamily':
      return `${name} stopped working to stay home with the baby.`;
    case 'returnedToWork':
      return `${name} started looking for work again.`;
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

