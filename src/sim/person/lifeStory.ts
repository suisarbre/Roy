import type { GameDate } from '../../game/types';
import { createCareerStepper, type CareerStepResult } from '../career/model';
import type { HouseholdContext } from '../career/types';
import { totalMonthsToDate } from '../gameDate';
import { CALIBRATED_PARAMS, CALIBRATED_WOMEN_PARAMS } from '../marriage/calibratedParams';
import { INITIAL_PARAMS, INITIAL_WOMEN_PARAMS } from '../marriage/params';
import { createRng } from '../rng';
import { CALIBRATED_WORLD_MARRIAGE, CALIBRATED_WORLD_PARAMS } from '../world/calibratedParams';
import { World } from '../world/engine';
import { INITIAL_WORLD_PARAMS } from '../world/params';
import { DEFAULT_CAREER_PARAMS, toWorker, type PersonProfile } from './profile';

/**
 * NPC 한 사람의 인생 이야기 — 공유 세계 엔진(src/sim/world)에 이 사람을 주인공으로 넣고 85세까지 굴려 만든다.
 * 만남·연애·동거·결혼·이혼·재혼·혼외 출산·외도가 전부 세계의 규칙대로 나오고, 상대들은 만날 때 실체화된
 * 사람들이다. 프로필의 lifeSeed로 완전히 정해지므로 저장하지 않고 캐시한다(수 ms).
 *
 * - 사망: 이 사람의 사망은 npc/lifecycle.ts가 굴린다 — 이야기 안의 사망은 쓰지 않고(세계는 주인공을 죽일 수
 *   있지만 그 뒤 사건이 없을 뿐), 게임이 정한 사망이 우선한다.
 * - Roy의 배우자: 그 결혼은 플레이어의 것이라 세계에 넣지 않는다. 경력만 — 여성이면 "결혼 중, 자녀 정보 없음,
 *   배우자 소득 평균"이라는 가구 상황으로.
 * - Roy의 부모: 반드시 짝을 찾도록 "짝 찾는 힘"을 크게 올린다(Roy가 있으니까).
 *
 * 한계: NPC마다 따로 세계를 돌린다 — 두 NPC가 서로 만나 결혼하는 공유는 아직 게임 쪽 세계 객체가 필요하다.
 */

export type FamilyEventKind = 'married' | 'cohabited' | 'divorced' | 'separated' | 'widowed' | 'childBorn' | 'affairCameOut' | 'spouseAffairCameOut';

export interface FamilyEvent {
  date: GameDate;
  kind: FamilyEventKind;
  /** 결혼이면 몇 번째인지(1 = 첫 결혼). */
  nth?: number;
  /** 출생이면 결혼 밖이었나. */
  nonmarital?: boolean;
}

export interface LifeStory {
  profile: PersonProfile;
  /** 이 사람의 경력, 16세부터 한 달씩. */
  months: CareerStepResult[];
  partner?: PersonProfile;
  familyEvents: FamilyEvent[];
}

export interface LifeStoryOptions {
  /** Roy의 배우자(그 결혼은 플레이어가 산다). */
  marriedToRoy?: boolean;
  /** 반드시 짝을 찾는 사람(Roy의 부모). */
  forceMarried?: boolean;
}

const UNTIL_AGE = 85;
const WORLD_CONFIG = {
  world: { ...INITIAL_WORLD_PARAMS, ...CALIBRATED_WORLD_PARAMS },
  marriage: { ...INITIAL_PARAMS, ...CALIBRATED_PARAMS, ...CALIBRATED_WORLD_MARRIAGE },
  women: { ...INITIAL_WOMEN_PARAMS, ...CALIBRATED_WOMEN_PARAMS },
};
const cache = new Map<string, LifeStory>();
const CACHE_LIMIT = 1000;

function soloCareer(profile: PersonProfile, ctx: HouseholdContext): CareerStepResult[] {
  const female = profile.sex === 'female';
  const stepper = createCareerStepper(
    { ...toWorker(profile), sex: profile.sex, traditionalism: profile.traits.traditionalism },
    DEFAULT_CAREER_PARAMS,
    createRng(profile.lifeSeed),
    { untilAge: UNTIL_AGE, women: female ? WORLD_CONFIG.women : undefined },
  );
  const months: CareerStepResult[] = [];
  for (let r = stepper.step(ctx); r; r = stepper.step(ctx)) months.push(r);
  return months;
}

export function buildLifeStory(profile: PersonProfile, options: LifeStoryOptions = {}): LifeStory {
  const key = `${profile.lifeSeed}:${profile.birthYear}:${profile.sex}:${options.marriedToRoy ? 'roy' : options.forceMarried ? 'wed' : 'own'}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const story = computeStory(profile, options);
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, story);
  return story;
}

function computeStory(profile: PersonProfile, options: LifeStoryOptions): LifeStory {
  if (options.marriedToRoy) {
    return { profile, months: soloCareer(profile, { married: true, birthThisMonth: false, spouseAnnualEarnings: 1 }), familyEvents: [] };
  }
  const start = profile.birthYear * 12 + profile.birthMonth + 16 * 12;
  const world = new World(WORLD_CONFIG, start);
  world.recordMonths = true;
  const me = world.addPerson(profile, true, options.forceMarried ? 3 : 0);
  world.runUntil(profile.birthYear * 12 + profile.birthMonth + UNTIL_AGE * 12);

  const raw: { t: number; e: Omit<FamilyEvent, 'date'> }[] = [];
  let nth = 0;
  let partner: PersonProfile | undefined;
  const unions = me.unionIds.map((id) => world.unions.get(id)!).sort((a, b) => a.startedAt - b.startedAt);
  for (const u of unions) {
    const other = world.persons.get(u.manId === me.id ? u.womanId : u.manId)!;
    const iCheat = u.cheaterId === me.id;
    if (u.cohabitedAt !== undefined && u.cohabitedAt !== u.marriedAt && !u.secret) raw.push({ t: u.cohabitedAt, e: { kind: 'cohabited' } });
    if (u.marriedAt !== undefined) {
      nth += 1;
      partner ??= other.profile;
      raw.push({ t: u.marriedAt, e: { kind: 'married', nth } });
    }
    // 내 외도가 들킨 것만 여기서(외도 상대 입장의 발각은 사건으로 치지 않는다). 배우자의 외도는 아래.
    if (u.discoveredAt !== undefined && iCheat) raw.push({ t: u.discoveredAt, e: { kind: 'affairCameOut' } });
    if (u.endedAt !== undefined && u.cheaterId === undefined) {
      if (u.endReason === 'divorce') raw.push({ t: u.endedAt, e: { kind: 'divorced' } });
      else if (u.endReason === 'widowed' && other.diedAt !== undefined && other.diedAt <= u.endedAt) raw.push({ t: u.endedAt, e: { kind: 'widowed' } });
      else if (u.endReason === 'breakup' && u.cohabitedAt !== undefined) raw.push({ t: u.endedAt, e: { kind: 'separated' } });
    }
  }
  // 이 사람의 외도 상대에게 들킨 외도(상대 쪽에서 본 사건)는 위에서, 배우자의 외도는 배우자의 비밀 선에서.
  for (const u of world.unions.values()) {
    if (u.discoveredAt === undefined || u.mainUnionId === undefined) continue;
    const main = world.unions.get(u.mainUnionId);
    if (main && (main.manId === me.id || main.womanId === me.id) && u.cheaterId !== me.id) raw.push({ t: u.discoveredAt, e: { kind: 'spouseAffairCameOut' } });
  }
  for (const c of me.children) raw.push({ t: c.bornAt, e: { kind: 'childBorn', nonmarital: !c.marital } });
  raw.sort((a, b) => a.t - b.t);
  return { profile, months: me.months ?? [], partner, familyEvents: raw.map((r) => ({ date: totalMonthsToDate(r.t), ...r.e })) };
}
