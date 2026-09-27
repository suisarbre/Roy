import { createCareerStepper, type CareerStepResult, type CareerStepper } from '../career/model';
import type { CareerParams } from '../career/params';
import type { HouseholdContext, WomenLaborParams } from '../career/types';
import { monthlyDeathProbability } from '../data';
import { stepUnionMonth, createUnionState, type UnionState } from '../marriage/model';
import type { MarriageParams } from '../marriage/params';
import type { Couple, EmploymentState, JobShockKind } from '../marriage/types';
import { DEFAULT_CAREER_PARAMS, sampleProfile, toSpouse, toWorker, type PersonProfile } from '../person/profile';
import { createRng, type Rng } from '../rng';
import { gaussian, mixSeed, sigmoid } from '../stats';
import { WORLD_STRUCTURE as W, type WorldParams } from './params';

/**
 * 공유 세계 — 사람들이 같은 시간 위에서 만나고, 사귀고, 같이 살고, 결혼하고, 헤어지고, 바람피우고, 아이를 낳는다.
 *
 * 설계:
 * - **관계는 사람의 상태가 아니라 두 사람 사이의 선(Union)**이다. 선에는 단계(연애 → 동거 → 결혼), 비밀 여부
 *   (외도)가 붙고, 한 사람이 동시에 여러 선을 가질 수 있다(양다리·외도).
 * - 선의 월간 역학은 결혼 모델의 `stepUnionMonth`(보정된 만족도·행동·헌신·떠남)를 그대로 쓰고, 단계마다
 *   떠남 절편·투자·출산 방식만 바꾼다. 결혼 단계의 계산은 결혼 모델과 같다.
 * - **필요할 때 실체화**: 세계에는 처음에 주인공(들)만 있다. 누군가를 만나는 순간 그 사람을 통계적 인구에서
 *   맥락(나이·학력·만난 경로)에 맞춰 뽑아 실체화하고, 한 번 실체화되면 남는다.
 * - **활성 집합**: 주인공과, 주인공과 열린 선이 있는 사람만 매달 계산한다. 선이 끝난 상대는 얼어 있다가 다시
 *   필요해지면 경력을 따라잡는다(syncCareer).
 * - 경력은 같이 사는(동거·결혼) 상대만 계산한다 — 연애 중엔 돈을 나누지 않으므로 필요 없다.
 *
 * 공통 난수: 모든 결정은 (사람 시드, 달) 또는 (선 시드, 달)로 새로 시작하는 난수열을 쓴다.
 */

export type UnionStage = 'dating' | 'cohabiting' | 'married';
export type MeetChannel = 'friends' | 'work' | 'school' | 'other';
export type UnionEndReason = 'breakup' | 'divorce' | 'widowed' | 'discovered';

export interface ChildRecord {
  bornAt: number;
  unionId: number;
  /** 태어날 때 부모가 결혼 중이었나. */
  marital: boolean;
  /** 결혼 아닌 동거 중이었나. */
  cohabiting: boolean;
}

export interface WorldPerson {
  id: number;
  profile: PersonProfile;
  /** 출생 총 개월. */
  birthTotal: number;
  alive: boolean;
  diedAt?: number;
  /** 주인공: 매달 계산하고 스스로 짝을 찾는다. */
  focal: boolean;
  career?: CareerStepper;
  careerLast?: CareerStepResult;
  earningsWindow: number[];
  earnings12: number;
  /** 이 사람의 모든 선(시간 순). */
  unionIds: number[];
  children: ChildRecord[];
  /** 실체화된 상대가 세계에 들어오기 전에 이미 낳은 아이(기록 없는 통계적 과거). 주인공은 0. */
  priorKids: number;
  /** 결혼 중 외도한 적이 있나. */
  cheatedWhileMarried: boolean;
  /** 마지막 헌신(주 관계에서) — 외도 판단에 쓴다. */
  lastCommitment?: number;
  /** 관찰 안 되는 "짝 찾는 힘"(표준정규) — 프로필 시드에서. */
  appeal: number;
  /** 결혼 밖 임신(출산 예정). */
  pregnancy?: { unionId: number; dueAt: number };
  /** 월별 경력 기록(World.recordMonths일 때 주인공만) — NPC 인생 이야기가 읽는다. */
  months?: CareerStepResult[];
  seed: number;
}

export interface WorldUnion {
  id: number;
  manId: number;
  womanId: number;
  stage: UnionStage;
  startedAt: number;
  cohabitedAt?: number;
  marriedAt?: number;
  endedAt?: number;
  endReason?: UnionEndReason;
  channel: MeetChannel;
  /** 외도가 들킨 달. */
  discoveredAt?: number;
  /** 외도(비밀 선): 바람피우는 사람과 그 사람의 주 관계. */
  secret: boolean;
  cheaterId?: number;
  mainUnionId?: number;
  couple: Couple;
  state: UnionState;
  seed: number;
}

export interface WorldConfig {
  world: WorldParams;
  marriage: MarriageParams;
  women: WomenLaborParams;
  career?: CareerParams;
}

const EDUCATION_RANK = { lessThanHighSchool: 0, highSchool: 1, someCollege: 2, bachelorsOrMore: 3 } as const;

const EMPLOYMENT_OF = (r: CareerStepResult | undefined): EmploymentState => {
  if (!r) return 'employed';
  if (r.disabled) return 'disabled';
  if (r.state === 'unemployed' || (r.state === 'outOfLaborForce' && !r.atHome)) return 'unemployed';
  return 'employed';
};

const SHOCK_OF = (r: CareerStepResult | undefined): JobShockKind | undefined =>
  r?.eventKind === 'laidOff' ? 'layoff' : r?.eventKind === 'plantClosing' ? 'plantClosing' : r?.eventKind === 'disabled' ? 'disability' : undefined;

export class World {
  readonly persons = new Map<number, WorldPerson>();
  readonly unions = new Map<number, WorldUnion>();
  /** 지금 계산 중인 달(총 개월). */
  month: number;
  private nextPersonId = 1;
  private readonly focalList: WorldPerson[] = [];
  private readonly openUnionIds = new Set<number>();
  private nextUnionId = 1;
  private readonly careerParams: CareerParams;
  private readonly stageParams: Record<UnionStage, MarriageParams>;
  /** 이번 달 출생(여성 id) — 여성 경력의 가구 상황. */
  private birthsThisMonth = new Set<number>();
  /** 결혼 밖 임신 중인 사람(관계가 끝나 활성 집합에서 빠져도 출산은 일어난다). */
  private readonly pregnant = new Set<WorldPerson>();

  private readonly config: WorldConfig;
  /** 주인공의 월별 경력을 기록할지(게임 NPC용 — 보정 때는 끈다). */
  recordMonths = false;

  constructor(config: WorldConfig, startMonth: number) {
    this.config = config;
    this.month = startMonth;
    this.careerParams = config.career ?? DEFAULT_CAREER_PARAMS;
    const m = config.marriage;
    const w = config.world;
    this.stageParams = {
      married: m,
      cohabiting: { ...m, leaveIntercept: m.leaveIntercept + w.cohabLeaveOffset, investmentPerLogYear: m.investmentPerLogYear * W.cohabInvestment, homemakerBarrier: 0 },
      dating: { ...m, leaveIntercept: m.leaveIntercept + w.datingLeaveOffset, investmentPerLogYear: m.investmentPerLogYear * W.datingInvestment, homemakerBarrier: 0 },
    };
  }

  // ---- 사람 ----

  addPerson(profile: PersonProfile, focal: boolean, appealShift = 0): WorldPerson {
    const person: WorldPerson = {
      id: this.nextPersonId++,
      profile,
      birthTotal: profile.birthYear * 12 + profile.birthMonth,
      alive: true,
      focal,
      earningsWindow: [],
      earnings12: 0,
      unionIds: [],
      children: [],
      cheatedWhileMarried: false,
      priorKids: 0,
      appeal: gaussian(createRng(mixSeed(profile.lifeSeed, 0xa99e))) + appealShift,
      seed: mixSeed(profile.lifeSeed, 0x9e1d),
    };
    this.persons.set(person.id, person);
    if (focal) {
      this.focalList.push(person);
      this.ensureCareer(person);
    }
    return person;
  }

  ageMonths(person: WorldPerson, month = this.month): number {
    return month - person.birthTotal;
  }

  private ensureCareer(person: WorldPerson): void {
    if (!person.career) {
      const female = person.profile.sex === 'female';
      person.career = createCareerStepper(
        { ...toWorker(person.profile), sex: person.profile.sex, traditionalism: person.profile.traits.traditionalism },
        this.careerParams,
        createRng(person.profile.lifeSeed),
        { untilAge: 90, women: female ? this.config.women : undefined },
      );
    }
    this.syncCareer(person, this.month - 1);
  }

  /** 경력을 through 달까지 따라잡는다(그동안은 혼자, 자녀는 기록대로). */
  private syncCareer(person: WorldPerson, through: number): void {
    if (!person.career) return;
    while (true) {
      const nextAge = (person.careerLast?.ageMonths ?? 16 * 12 - 1) + 1;
      if (person.birthTotal + nextAge > through) break;
      const r = person.career.step(this.soloContext(person, person.birthTotal + nextAge));
      if (!r) break;
      this.recordEarnings(person, r);
    }
  }

  private soloContext(person: WorldPerson, month: number): HouseholdContext {
    const youngest = this.youngestChildAge(person, month);
    return { married: false, birthThisMonth: false, spouseAnnualEarnings: 0, youngestChildAgeMonths: youngest };
  }

  private youngestChildAge(person: WorldPerson, month: number): number | undefined {
    // 자녀는 어머니와 산다고 본다(아버지 쪽 가구 상황엔 넣지 않는다 — 남성 경력은 가구 상황을 읽지 않음).
    if (person.profile.sex !== 'female' || person.children.length === 0) return undefined;
    const last = person.children[person.children.length - 1];
    return month - last.bornAt;
  }

  private recordEarnings(person: WorldPerson, r: CareerStepResult): void {
    person.careerLast = r;
    if (this.recordMonths && person.focal) (person.months ??= []).push(r);
    person.earningsWindow.push(r.earnings);
    person.earnings12 += r.earnings;
    if (person.earningsWindow.length > 12) person.earnings12 -= person.earningsWindow.shift()!;
  }

  // ---- 선 ----

  openUnions(person: WorldPerson): WorldUnion[] {
    const list: WorldUnion[] = [];
    for (const id of person.unionIds) {
      const u = this.unions.get(id)!;
      if (u.endedAt === undefined) list.push(u);
    }
    return list;
  }

  /** 주 관계: 가장 최근의 비밀 아닌 열린 선(없으면 싱글 — 외도 상대로만 얽힌 사람도 싱글). */
  mainUnion(person: WorldPerson): WorldUnion | undefined {
    for (let i = person.unionIds.length - 1; i >= 0; i--) {
      const u = this.unions.get(person.unionIds[i])!;
      if (u.endedAt === undefined && !u.secret) return u;
    }
    return undefined;
  }

  private partnerOf(u: WorldUnion, person: WorldPerson): WorldPerson {
    return this.persons.get(u.manId === person.id ? u.womanId : u.manId)!;
  }

  private createUnion(a: WorldPerson, b: WorldPerson, channel: MeetChannel, rng: Rng, secret = false, cheaterId?: number, mainUnionId?: number): WorldUnion {
    const man = a.profile.sex === 'male' ? a : b;
    const woman = a.profile.sex === 'male' ? b : a;
    const couple: Couple = {
      husband: toSpouse(man.profile),
      wife: toSpouse(woman.profile),
      husbandProfile: man.profile,
      wifeProfile: woman.profile,
      marriedAtMonth: this.month,
      husbandAgeAtMarriage: this.ageMonths(man) / 12,
      wifeAgeAtMarriage: this.ageMonths(woman) / 12,
      desiredChildren: gaussian(rng),
    };
    const seed = Math.floor(rng() * 4294967296);
    const state = createUnionState(couple, this.config.marriage, createRng(seed));
    // 희망 자녀 수를 채웠는지: 여성의 아이 + 남성의 아이(대개 따로 사니 절반 무게).
    state.priorChildren = woman.children.length + woman.priorKids + this.config.world.stepChildWeight * (man.children.length + man.priorKids);
    const union: WorldUnion = {
      id: this.nextUnionId++,
      manId: man.id,
      womanId: woman.id,
      stage: 'dating',
      startedAt: this.month,
      channel,
      secret,
      cheaterId,
      mainUnionId,
      couple,
      state,
      seed,
    };
    this.unions.set(union.id, union);
    this.openUnionIds.add(union.id);
    man.unionIds.push(union.id);
    woman.unionIds.push(union.id);
    return union;
  }

  private endUnion(u: WorldUnion, reason: UnionEndReason): void {
    if (u.endedAt !== undefined) return;
    u.endedAt = this.month;
    u.endReason = reason;
    this.openUnionIds.delete(u.id);
    // 주 관계가 끝나면 진행 중이던 외도는 공개 연애가 된다.
    for (const id of this.openUnionIds) {
      const other = this.unions.get(id)!;
      if (other.secret && other.mainUnionId === u.id) {
        other.secret = false;
        other.mainUnionId = undefined;
      }
    }
  }

  // ---- 실체화 ----

  /** 이 사람이 누군가를 만났다 — 통계적 인구에서 맥락에 맞게 한 명을 뽑아 실체화한다. */
  private materializePartner(person: WorldPerson, channel: MeetChannel, rng: Rng, anyEducation = false): WorldPerson {
    const male = person.profile.sex === 'male';
    const gap = W.ageGapMean + gaussian(rng) * W.ageGapSd;
    const ownAge = this.ageMonths(person) / 12;
    const age = Math.max(W.minDatingAge + 0.5, male ? ownAge - gap : ownAge + gap);
    const birthYear = Math.floor(this.month / 12 - age);
    const sameEducation = !anyEducation && (channel === 'school' || rng() < W.meetEducationHomogamy);
    const profile = sampleProfile(Math.floor(rng() * 4294967296), {
      sex: male ? 'female' : 'male',
      birthYear,
      losAngeles: person.profile.losAngeles,
      forceEducation: sameEducation ? person.profile.education : undefined,
    });
    const partner = this.addPerson(profile, false);
    // 통계적 과거: 나이가 들수록 이전 관계에서 낳은 아이가 있을 가능성(포아송).
    const lambda = this.config.world.partnerPriorKids * Math.max(0, Math.min(2.5, (age - 20) / 10));
    let k = 0;
    for (let prod = rng(), limit = Math.exp(-lambda); prod > limit && k < 6; prod *= rng()) k += 1;
    partner.priorKids = k;
    return partner;
  }

  // ---- 한 달 ----

  step(): void {
    const t = this.month;
    const w = this.config.world;
    this.birthsThisMonth = new Set();

    // 활성 집합: 주인공 + 열린 선의 상대.
    const active = new Set<WorldPerson>();
    for (const p of this.focalList) {
      if (!p.alive) continue;
      if (this.ageMonths(p) < W.minDatingAge * 12 - 1) continue;
      active.add(p);
      for (const u of this.openUnions(p)) active.add(this.partnerOf(u, p));
    }

    // 1. 사망.
    for (const p of active) {
      const rng = createRng(mixSeed(p.seed, t * 3 + 1));
      if (rng() < monthlyDeathProbability(p.profile.birthYear, p.profile.sex, this.ageMonths(p) / 12)) {
        p.alive = false;
        p.diedAt = t;
        for (const u of this.openUnions(p)) this.endUnion(u, 'widowed');
      }
    }

    // 2. 남성 경력(가구 상황을 읽지 않는다).
    for (const p of active) {
      if (!p.alive || p.profile.sex !== 'male') continue;
      if (!p.focal && !this.coresident(p)) continue;
      this.stepCareer(p, { married: this.coresident(p), birthThisMonth: false, spouseAnnualEarnings: 0 });
    }

    // 3. 선(그 전에 예정된 출산).
    this.deliverDue(t);
    const open = [...this.openUnionIds]
      .sort((a, b) => a - b)
      .map((id) => this.unions.get(id)!)
      .filter((u) => active.has(this.persons.get(u.manId)!) || active.has(this.persons.get(u.womanId)!));
    for (const u of open) this.stepUnion(u, t, w);

    // 4. 여성 경력(출산·동거·배우자 소득을 보고).
    for (const p of active) {
      if (!p.alive || p.profile.sex !== 'female') continue;
      const main = this.mainUnion(p);
      const coresident = main !== undefined && main.stage !== 'dating';
      if (!p.focal && !coresident) continue;
      const partner = coresident ? this.partnerOf(main, p) : undefined;
      this.stepCareer(p, {
        married: coresident,
        birthThisMonth: this.birthsThisMonth.has(p.id),
        youngestChildAgeMonths: this.youngestChildAge(p, t),
        spouseAnnualEarnings: partner?.earnings12 ?? 0,
      });
    }

    // 5. 만남(주인공만 스스로 찾는다 — 상대들은 주인공과의 관계 안에서만 산다)과 외도(같이 사는 누구나).
    for (const p of active) {
      if (!p.alive) continue;
      const rng = createRng(mixSeed(p.seed, t * 3 + 2));
      const main = this.mainUnion(p);
      if (!main) {
        if (p.focal) this.maybeMeet(p, rng, w);
      } else if (main.stage !== 'dating' && main.endedAt === undefined) {
        this.maybeAffair(p, main, rng, w);
      }
    }

    this.month += 1;
  }

  private coresident(p: WorldPerson): boolean {
    const main = this.mainUnion(p);
    return main !== undefined && main.stage !== 'dating';
  }

  private stepCareer(p: WorldPerson, ctx: HouseholdContext): void {
    if (this.ageMonths(p) < 16 * 12) return;
    this.ensureCareer(p);
    const r = p.career!.step(ctx);
    if (r) this.recordEarnings(p, r);
  }

  private stepUnion(u: WorldUnion, t: number, w: WorldParams): void {
    const man = this.persons.get(u.manId)!;
    const woman = this.persons.get(u.womanId)!;
    if (!man.alive || !woman.alive) {
      this.endUnion(u, 'widowed');
      return;
    }
    const rng = createRng(mixSeed(u.seed, t));
    const coresident = u.stage !== 'dating' && !u.secret;
    const nonMarital = u.stage !== 'married';
    const cheaterIsMan = this.cheaterIn(u, man);
    const cheaterIsWoman = this.cheaterIn(u, woman);
    const educationRank = EDUCATION_RANK[woman.profile.education];

    const { record } = stepUnionMonth(
      u.state,
      u.couple,
      this.stageParams[u.secret ? 'dating' : u.stage],
      {
        husbandAge: this.ageMonths(man) / 12,
        wifeAge: this.ageMonths(woman) / 12,
        employment: coresident ? EMPLOYMENT_OF(man.careerLast) : 'employed',
        shock: coresident ? SHOCK_OF(man.careerLast) : undefined,
        wifeLast: coresident ? woman.careerLast : undefined,
        noPlannedBirths: nonMarital,
        unplannedRatio: nonMarital ? (woman.pregnancy ? 0 : w.unplannedConception * Math.exp(-w.unplannedEducation * educationRank)) : undefined,
        extraAlternatives: cheaterIsMan || cheaterIsWoman ? { husband: cheaterIsMan ? W.affairAlternative : 0, wife: cheaterIsWoman ? W.affairAlternative : 0 } : undefined,
      },
      rng,
    );
    if (!u.secret) {
      man.lastCommitment = record.husbandCommitment;
      woman.lastCommitment = record.wifeCommitment;
    }

    if (record.birthThisMonth) {
      if (nonMarital) {
        // 결혼 밖에서는 이 사건을 "임신"으로 읽는다 — 9개월 뒤 출산, 그 사이 같이 살거나 결혼할 수 있다(급한 결혼),
        // 헤어지면 혼자 낳는다. 결혼 중 출산은 결혼 모델 그대로(가임력에 임신 기간이 이미 들어 있다).
        woman.pregnancy = { unionId: u.id, dueAt: t + 9 };
        this.pregnant.add(woman);
      } else {
        this.bear(woman, man, u, t);
      }
    }
    // 임신 중인 연애·동거: 급한 결혼, 같이 살기.
    if (woman.pregnancy?.unionId === u.id && u.stage !== 'married' && !u.secret && this.ageMonths(man) >= 17 * 12) {
      if (rng() < sigmoid(w.shotgunMarriage + 0.5 * this.avgTraditionalism(u))) this.transition(u, 'married');
      else if (u.stage === 'dating' && rng() < sigmoid(w.pregnancyCohabit)) this.transition(u, 'cohabiting');
    }

    if (record.leaver) {
      this.endUnion(u, u.stage === 'married' ? 'divorce' : 'breakup');
      return;
    }

    if (u.secret) {
      // 외도: 발각되거나 시들 수 있다.
      if (rng() < w.affairDiscovery) {
        u.discoveredAt = t;
        const main = u.mainUnionId !== undefined ? this.unions.get(u.mainUnionId) : undefined;
        if (main && main.endedAt === undefined) {
          main.state.satisfaction -= w.discoveryShock;
          main.state.scar += 0.3 * w.discoveryShock;
        }
        if (rng() < W.affairEndsOnDiscovery) this.endUnion(u, 'discovered');
        else u.secret = false;
      } else if (rng() < W.affairFade) {
        this.endUnion(u, 'breakup');
      }
      return;
    }

    // 단계 전이.
    const months = t - (u.stage === 'dating' ? u.startedAt : (u.cohabitedAt ?? u.startedAt));
    if (months < 3 || this.ageMonths(man) < 17 * 12 || this.ageMonths(woman) < 17 * 12) return;
    const sat = u.state.satisfaction;
    const trad = this.avgTraditionalism(u);
    const year = t / 12;
    // 결혼 준비: 학교를 막 마쳤으면 미루고(대졸의 늦은 결혼), 남성의 벌이가 시원찮으면 미룬다("결혼할 만한 남자").
    this.ensureCareer(man);
    const manLast = man.careerLast;
    const manEconomics = manLast && (manLast.state === 'employed' || manLast.state === 'selfEmployed') ? Math.log(Math.max(0.05, man.earnings12) / 0.8) : -1;
    const yearsOut = Math.min(this.yearsSinceSchool(man, t), this.yearsSinceSchool(woman, t));
    const readiness = w.marryEconomics * manEconomics - w.schoolMarryPenalty * Math.exp(-Math.max(-3, yearsOut) / 3);
    // 동거의 시대 변화는 "결혼 대신 먼저 같이 산다"는 규범의 이동: 동거가 늘고 연애에서 결혼 직행이 준다.
    // 같이 살기도 어느 정도 형편이 돼야 한다(결혼 준비의 일부).
    const era = (year - 1985) / 10;
    if (u.stage === 'dating') {
      if (rng() < sigmoid(w.toMarryBase - W.directMarriageTrend * w.cohabTrend * era + w.marryTraditionalism * trad + sat + readiness)) this.transition(u, 'married');
      else if (rng() < sigmoid(w.toCohabitBase + w.cohabTrend * era - w.marryTraditionalism * trad + sat + W.cohabReadiness * readiness)) this.transition(u, 'cohabiting');
    } else if (u.stage === 'cohabiting') {
      if (rng() < sigmoid(w.toMarryBase + w.cohabToMarry + w.marryTraditionalism * trad + sat + readiness)) this.transition(u, 'married');
    }
  }

  private yearsSinceSchool(p: WorldPerson, t: number): number {
    return (t - p.birthTotal) / 12 - p.profile.schoolExitAge;
  }

  /** 출산 — 아이의 혼인 상태는 태어나는 달의 부모 관계로 정한다. */
  private bear(woman: WorldPerson, man: WorldPerson, u: WorldUnion, t: number): void {
    const open = u.endedAt === undefined;
    const child: ChildRecord = { bornAt: t, unionId: u.id, marital: open && u.stage === 'married', cohabiting: open && u.stage === 'cohabiting' };
    woman.children.push(child);
    man.children.push(child);
    this.birthsThisMonth.add(woman.id);
  }

  private deliverDue(t: number): void {
    for (const p of [...this.pregnant]) {
      const preg = p.pregnancy;
      if (!preg || preg.dueAt !== t) continue;
      p.pregnancy = undefined;
      this.pregnant.delete(p);
      if (!p.alive) continue;
      const u = this.unions.get(preg.unionId)!;
      this.bear(p, this.persons.get(u.manId)!, u, t);
    }
  }

  private cheaterIn(u: WorldUnion, person: WorldPerson): boolean {
    // 이 사람이 u가 아닌 다른 비밀 선을 갖고 있고, 그 비밀 선의 주 관계가 u인가.
    for (const id of person.unionIds) {
      const other = this.unions.get(id)!;
      if (other.endedAt === undefined && other.secret && other.cheaterId === person.id && other.mainUnionId === u.id) return true;
    }
    return false;
  }

  private avgTraditionalism(u: WorldUnion): number {
    return (u.couple.husband.traits.traditionalism + u.couple.wife.traits.traditionalism) / 2;
  }

  private transition(u: WorldUnion, stage: UnionStage): void {
    if (u.stage === stage) return;
    if (stage !== 'dating' && u.cohabitedAt === undefined) u.cohabitedAt = this.month;
    if (stage === 'married') u.marriedAt = this.month;
    u.stage = stage;
    // 같이 살기 시작하면 두 사람 모두 경력이 필요하다(가계).
    this.ensureCareer(this.persons.get(u.manId)!);
    this.ensureCareer(this.persons.get(u.womanId)!);
  }

  private maybeMeet(p: WorldPerson, rng: Rng, w: WorldParams): void {
    const age = this.ageMonths(p) / 12;
    if (age < W.minDatingAge) return;
    const previouslyPartnered = p.unionIds.some((id) => this.unions.get(id)!.stage !== 'dating');
    const rate =
      w.meetBase *
      Math.exp(-w.meetAgeDecline * Math.max(0, age - 20) + w.meetExtraversion * p.profile.traits.extraversion + w.meetHeterogeneity * p.appeal) *
      (previouslyPartnered ? w.remarriageMeet : 1);
    if (rng() >= rate) return;
    const student = p.careerLast?.state === 'student' || age < p.profile.schoolExitAge;
    const employed = p.careerLast?.state === 'employed';
    const weights: [MeetChannel, number][] = [
      ['friends', 1],
      ['work', employed ? w.channelWork : 0],
      ['school', student ? W.channelSchool : 0],
      ['other', W.channelOther],
    ];
    const total = weights.reduce((a, [, x]) => a + x, 0);
    let roll = rng() * total;
    let channel: MeetChannel = 'other';
    for (const [c, x] of weights) {
      roll -= x;
      if (roll <= 0) {
        channel = c;
        break;
      }
    }
    const partner = this.materializePartner(p, channel, rng);
    this.createUnion(p, partner, channel, rng);
  }

  private maybeAffair(p: WorldPerson, main: WorldUnion, rng: Rng, w: WorldParams): void {
    if (this.openUnions(p).some((u) => u.secret && u.cheaterId === p.id)) return;
    const t = p.profile.traits;
    const opportunity =
      w.affairOpportunity * (p.careerLast?.state === 'employed' ? 1.3 : 0.8) * Math.exp(0.3 * t.extraversion + (p.profile.sex === 'female' ? w.affairWomen : 0));
    if (rng() >= opportunity) return;
    const propensity = sigmoid(
      w.affairBase - w.affairCommitment * (p.lastCommitment ?? 1) - 0.4 * t.conscientiousness - 0.3 * t.agreeableness + 0.2 * t.openness + 0.3 * t.riskTolerance,
    );
    if (rng() >= propensity) return;
    const partner = this.materializePartner(p, p.careerLast?.state === 'employed' && rng() < 0.5 ? 'work' : 'friends', rng, true);
    this.createUnion(p, partner, 'other', rng, true, p.id, main.id);
    if (main.stage === 'married') p.cheatedWhileMarried = true;
  }

  runUntil(month: number): void {
    while (this.month < month) this.step();
  }
}
