import type { GameDate } from '../../game/types';
import { createCareerStepper, type CareerStepResult } from '../career/model';
import type { HouseholdContext } from '../career/types';
import { sampleAgeAtDeath } from '../data';
import { totalMonthsToDate } from '../gameDate';
import { CALIBRATED_PARAMS, CALIBRATED_WOMEN_PARAMS } from '../marriage/calibratedParams';
import { simulateCouple } from '../marriage/model';
import { FIXED_ASSUMPTIONS, INITIAL_PARAMS, INITIAL_WOMEN_PARAMS } from '../marriage/params';
import { buildHusbandTrack } from '../marriage/population';
import type { Couple } from '../marriage/types';
import { createRng, type Rng } from '../rng';
import { gaussian, mixSeed } from '../stats';
import { DEFAULT_CAREER_PARAMS, sampleProfile, toSpouse, toWorker, type PersonProfile } from './profile';

/**
 * NPC 한 사람의 인생 이야기 — 경력 모델과 결혼 모델을 같이 돌려 만든다. 프로필의 lifeSeed로 완전히
 * 정해지므로 저장하지 않고 필요할 때 계산해 캐시한다(몇 ms).
 *
 * - 결혼: 85%가 첫 결혼을 한다(NLSY79). 배우자는 이 사람의 나이·학력에 맞춰 뽑은 프로필(동류혼 0.6).
 *   부부를 결혼 행위자 모델로 굴려 출산·이혼이 나온다. 여성이면 그 부부 안에서 굴린 아내의 경력이 이
 *   사람의 경력이다(출산 후 이탈·복귀가 들어간다).
 * - 사망: 이 사람의 사망은 npc/lifecycle.ts가 굴린다. 배우자의 사망만 여기서 생명표로 뽑아 사별로 끝낸다.
 * - Roy의 배우자: 그 결혼은 플레이어의 것이라 여기서 만들지 않는다. 경력만 — 여성이면 "결혼 중, 자녀
 *   정보 없음, 배우자 소득 평균"이라는 가구 상황으로(자녀는 게임 상태에서 아직 안 온다).
 *
 * 한계: 재혼이 없다(결혼 모델이 첫 결혼만 다룬다). 부모 NPC의 출산은 Roy와 연결돼 있지 않다.
 */

export type FamilyEventKind = 'married' | 'divorced' | 'widowed' | 'childBorn';

export interface FamilyEvent {
  date: GameDate;
  kind: FamilyEventKind;
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
  /** 반드시 결혼한 사람(Roy의 부모 — 비혼 15%를 건너뛴다). */
  forceMarried?: boolean;
}

const UNTIL_AGE = 85;
const MARRIAGE_PARAMS = { ...INITIAL_PARAMS, ...CALIBRATED_PARAMS };
const WOMEN_PARAMS = { ...INITIAL_WOMEN_PARAMS, ...CALIBRATED_WOMEN_PARAMS };
const cache = new Map<string, LifeStory>();
const CACHE_LIMIT = 1000;

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function soloCareer(profile: PersonProfile, ctx: HouseholdContext): CareerStepResult[] {
  const female = profile.sex === 'female';
  const stepper = createCareerStepper(
    { ...toWorker(profile), sex: profile.sex, traditionalism: profile.traits.traditionalism },
    DEFAULT_CAREER_PARAMS,
    createRng(profile.lifeSeed),
    { untilAge: UNTIL_AGE, women: female ? WOMEN_PARAMS : undefined },
  );
  const months: CareerStepResult[] = [];
  for (let r = stepper.step(ctx); r; r = stepper.step(ctx)) months.push(r);
  return months;
}

function samplePartner(rng: Rng, profile: PersonProfile, partnerBirthYear: number): PersonProfile {
  const sex = profile.sex === 'male' ? 'female' : 'male';
  const wantSame = rng() < FIXED_ASSUMPTIONS.educationHomogamy;
  let chosen: PersonProfile | undefined;
  for (let k = 0; k < 8; k++) {
    const candidate = sampleProfile(Math.floor(rng() * 4294967296), { sex, birthYear: partnerBirthYear, losAngeles: profile.losAngeles });
    chosen ??= candidate;
    if (!wantSame) break;
    if (candidate.education === profile.education) return candidate;
  }
  return chosen!;
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
  const rng = createRng(mixSeed(profile.lifeSeed, 0xfa111e));
  // 비혼 15% — NLSY79의 "55세까지 결혼 경험 85%"(여성 기준 값을 남녀 모두에 쓴다).
  if (rng() < FIXED_ASSUMPTIONS.neverMarriedWomenShare && !options.forceMarried) {
    return { profile, months: soloCareer(profile, { married: false, birthThisMonth: false, spouseAnnualEarnings: 0 }), familyEvents: [] };
  }

  // 결혼 나이: 남편 학력별 평균(NLSY79) — 아내는 대략 두 살 아래.
  const male = profile.sex === 'male';
  const sd = FIXED_ASSUMPTIONS.ageAtMarriageSd;
  const ownAge = clamp(FIXED_ASSUMPTIONS.meanAgeAtMarriageByEducation[profile.education] - (male ? 0 : 2) + gaussian(rng) * sd, 17, 45);
  const partnerAge = clamp(ownAge + (male ? -2 : 2) + gaussian(rng) * 2, 17, 50);
  const marriedAtMonth = profile.birthYear * 12 + profile.birthMonth + Math.round(ownAge * 12);
  const partner = samplePartner(rng, profile, Math.floor(marriedAtMonth / 12 - partnerAge));
  const husbandProfile = male ? profile : partner;
  const wifeProfile = male ? partner : profile;
  const couple: Couple = {
    husband: toSpouse(husbandProfile),
    wife: toSpouse(wifeProfile),
    husbandProfile,
    wifeProfile,
    marriedAtMonth,
    husbandAgeAtMarriage: (marriedAtMonth - husbandProfile.birthYear * 12) / 12,
    wifeAgeAtMarriage: (marriedAtMonth - wifeProfile.birthYear * 12) / 12,
    desiredChildren: gaussian(rng),
  };

  const husbandMonths: CareerStepResult[] = [];
  const track = buildHusbandTrack(husbandProfile, DEFAULT_CAREER_PARAMS, UNTIL_AGE, husbandMonths);
  const wifeMonths: CareerStepResult[] = [];
  const outcome = simulateCouple(
    couple,
    MARRIAGE_PARAMS,
    { husbandTrack: track, women: WOMEN_PARAMS, seed: mixSeed(profile.lifeSeed, 0xc0091e) },
    {
      censorAtHusbandAge: UNTIL_AGE,
      keepMonths: false,
      ignoreMortality: true,
      wifeUntilAge: UNTIL_AGE,
      onWifeMonth: (r) => wifeMonths.push(r),
    },
  );

  // 배우자의 사망은 생명표로 — 결혼 모델 안에서는 사망을 껐다.
  const partnerDeathAge = sampleAgeAtDeath(partner.birthYear, partner.sex, Math.max(0, (marriedAtMonth - partner.birthYear * 12) / 12), rng);
  const partnerDeathDuration = partner.birthYear * 12 + Math.round(partnerDeathAge * 12) + Math.floor(rng() * 12) - marriedAtMonth;
  const divorceAt = outcome.endReason === 'divorce' ? outcome.durationMonths : Number.POSITIVE_INFINITY;
  const endDuration = Math.min(divorceAt, partnerDeathDuration);
  const endKind: FamilyEventKind = partnerDeathDuration < divorceAt ? 'widowed' : 'divorced';

  const familyEvents: FamilyEvent[] = [{ date: totalMonthsToDate(marriedAtMonth), kind: 'married' }];
  for (const d of outcome.birthDurations) {
    if (d >= endDuration) continue;
    familyEvents.push({ date: totalMonthsToDate(marriedAtMonth + d), kind: 'childBorn' });
  }
  if (Number.isFinite(endDuration)) familyEvents.push({ date: totalMonthsToDate(marriedAtMonth + endDuration), kind: endKind });

  return { profile, months: male ? husbandMonths : wifeMonths, partner, familyEvents };
}
