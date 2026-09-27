import type { WomenLaborParams } from '../career/types';
import { sampleProfile, toSpouse, type PersonTraits } from '../person/profile';
import { CALIBRATED_PARAMS, CALIBRATED_WOMEN_PARAMS } from './calibratedParams';
import { simulateCouple } from './model';
import { buildTargets, loss, measure } from './moments';
import { INITIAL_WOMEN_PARAMS, type MarriageParams } from './params';
import { buildHusbandTrack } from './population';
import type { Couple, HusbandTrack, JobShockKind } from './types';

const WOMEN: WomenLaborParams = { ...INITIAL_WOMEN_PARAMS, ...CALIBRATED_WOMEN_PARAMS };

/**
 * `npm run sim:marriage` — 보정된 결혼 행위자 모델의 표본 외 검증 + 매개 검증 + Linda 시나리오.
 *
 * 보정(calibrate.ts)은 seed=1 부부 1만 쌍을 썼으므로, 여기서는 다른 seed의 4만 쌍으로 잰다.
 * exit code: 허용오차 2배를 넘는 표본 외 적률이 없으면 0(1~2배는 WARN으로 표시만).
 */

function arg(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
}

const fmt = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : '  NaN');

function validate(params: MarriageParams, n: number, seed: number): boolean {
  const targets = buildTargets();
  const result = measure(params, WOMEN, { n, seed });
  console.log(`=== 표본 외 검증 (부부 ${n}쌍, seed=${seed}, 보정은 seed=1) — loss=${loss(result, targets).toFixed(2)} ===`);
  // 판정: 허용오차 1배 안 PASS, 1~2배 WARN, 2배 초과 FAIL(단 knownGap이 적힌 적률은 KNOWN). 허용오차 자체가 원 연구의 불확실성
  // (표준오차, 연구 간 범위)이라 1~2배는 "원 추정치의 신뢰구간 근처"로 본다. FAIL이 없으면 통과.
  let pass = true;
  for (const t of targets) {
    const v = result.values[t.key];
    const z = Math.abs(v - t.target) / t.tolerance;
    const raw = !Number.isFinite(z) || z > 2 ? 'FAIL' : z > 1 ? 'WARN' : 'PASS';
    const verdict = raw === 'FAIL' && t.knownGap ? 'KNOWN' : raw;
    if (verdict === 'FAIL') pass = false;
    console.log(`  [${verdict.padEnd(5)}] ${t.label.padEnd(30)} 목표 ${fmt(t.target)}  측정 ${fmt(v)}  (허용 ±${t.tolerance}, ${z.toFixed(1)}배)`);
    if (verdict === 'KNOWN') console.log(`           ↳ 알려진 격차: ${t.knownGap}`);
  }
  console.log(
    `  참고: 남편 비풀타임 개월 비율 ${(result.extras.shareMonthsHusbandNotFullTime * 100).toFixed(1)}%, 금전 갈등이 있던 개월 ${(result.extras.shareMonthsWithFinancialConflict * 100).toFixed(1)}%`,
  );
  // 방향 검증(Lillard & Waite 1993): 어린 자녀는 이혼을 막고, 큰 자녀보다 더 막아야 한다.
  const young = result.extras.rr_youngChild;
  const older = result.extras.rr_olderChild;
  const childOk = young < 1 && young < older;
  if (!childOk) pass = false;
  console.log(
    `  [${childOk ? 'PASS' : 'FAIL'}] 자녀와 이혼(방향): 막내 3세 미만 위험비 ${fmt(young)} < 1, 막내 6세 이상 ${fmt(older)}보다 낮아야 함`,
  );
  return pass;
}

/** Dew et al.(2012): 금전 갈등 경로를 끄면 경제 요인의 효과가 사라져야 한다. */
function mediation(params: MarriageParams, n: number, seed: number): void {
  const on = measure(params, WOMEN, { n, seed });
  const off = measure(params, WOMEN, { n, seed, disableFinancialConflict: true });
  console.log(`\n=== 매개 검증: 금전 스트레스 → 대립 경로를 끊으면 (부부 ${n}쌍) ===`);
  const rows: [string, string][] = [
    ['rr_notFullTime', '남편 실업 중 위험비'],
    ['rr_layoff', '해고 후 3년 위험비'],
    ['by55_lessThanHighSchool', '55세까지 이혼 — 고졸 미만'],
    ['by55_bachelorsOrMore', '55세까지 이혼 — 대졸 이상'],
  ];
  for (const [key, label] of rows) console.log(`  ${label.padEnd(24)} 경로 있음 ${fmt(on.values[key])}  → 끊음 ${fmt(off.values[key])}`);
  const gapOn = on.values.by55_lessThanHighSchool - on.values.by55_bachelorsOrMore;
  const gapOff = off.values.by55_lessThanHighSchool - off.values.by55_bachelorsOrMore;
  console.log(`  학력 격차(고졸 미만 − 대졸): ${fmt(gapOn)} → ${fmt(gapOff)}  (위험비는 1로, 격차는 0 근처로 가야 성공)`);
}

// ---- Linda 시나리오 ----

const AVERAGE: Partial<PersonTraits> = { neuroticism: 0, conscientiousness: 0, agreeableness: 0, openness: 0, financialAnxiety: 0, traditionalism: 0 };

function coupleFor(lindaTraits: Partial<PersonTraits>, luck = 0): { couple: Couple; track: HusbandTrack } {
  const royProfile = { ...sampleProfile(1962 + luck * 7919, { sex: 'male', birthYear: 1962, losAngeles: true, traits: AVERAGE, forceEducation: 'highSchool' }), parentsDivorced: false };
  const lindaProfile = { ...sampleProfile(1964 + luck * 7919, { sex: 'female', birthYear: 1964, losAngeles: true, traits: { ...AVERAGE, ...lindaTraits }, forceEducation: 'highSchool' }), parentsDivorced: false };
  // 1986년 1월 결혼(Roy 24세). 5년 뒤인 1991년 초 — 실제 1990–91 침체기에 충격이 온다.
  const couple: Couple = {
    husband: toSpouse(royProfile),
    wife: toSpouse(lindaProfile),
    husbandProfile: royProfile,
    wifeProfile: lindaProfile,
    marriedAtMonth: 1986 * 12,
    husbandAgeAtMarriage: 24,
    wifeAgeAtMarriage: 22,
    desiredChildren: 0,
  };
  return { couple, track: buildHusbandTrack(royProfile) };
}

interface ScenarioStats {
  divorceWithin3yAfterShock: number;
  childrenAtShock: number;
  lindaConfrontShareFirstYear: number;
  lindaSupportShareFirstYear: number;
}

function runScenario(params: MarriageParams, household: { couple: Couple; track: HusbandTrack }, homemaker: boolean, shock: JobShockKind | 'none', reps: number): ScenarioStats {
  const { couple, track } = household;
  const shockAt = 60;
  let divorced = 0;
  let alive = 0;
  let confront = 0;
  let support = 0;
  let months = 0;
  let kidsAtShock = 0;
  for (let i = 0; i < reps; i++) {
    const outcome = simulateCouple(couple, params, { husbandTrack: track, women: WOMEN, seed: 424242 + i }, {
      censorAtHusbandAge: 55,
      forcedShock: shock === 'none' ? { atDuration: -1, kind: 'layoff' } : { atDuration: shockAt, kind: shock },
      forceWifeAtHome: homemaker,
    });
    if (outcome.durationMonths <= shockAt) continue; // 충격 전에 끝난 결혼은 제외
    alive += 1;
    kidsAtShock += outcome.birthDurations.filter((b) => b < shockAt).length;
    if (outcome.endReason === 'divorce' && outcome.durationMonths <= shockAt + 36) divorced += 1;
    for (const r of outcome.months) {
      if (r.duration >= shockAt && r.duration < shockAt + 12) {
        months += 1;
        if (r.wifeBehavior === 'confront') confront += 1;
        if (r.wifeBehavior === 'support') support += 1;
      }
    }
  }
  return {
    divorceWithin3yAfterShock: divorced / alive,
    childrenAtShock: kidsAtShock / alive,
    lindaConfrontShareFirstYear: confront / months,
    lindaSupportShareFirstYear: support / months,
  };
}

function lindaDemo(params: MarriageParams, reps: number): void {
  const anxiousLinda: Partial<PersonTraits> = { neuroticism: 1, financialAnxiety: 1.5, traditionalism: 1 };
  const calmLinda: Partial<PersonTraits> = { neuroticism: -1, financialAnxiety: -1, agreeableness: 1 };

  console.log(`\n=== Linda 시나리오 — 1986년 결혼, 1991년 초 Roy에게 충격 (각 ${reps}회 반복) ===`);
  console.log('  Linda 유형 / 전업주부 / 충격          │ 충격 후 3년 내 이혼 │ 첫 해 Linda 대립 │ 첫 해 Linda 지지 │ 충격 시 자녀');
  const cases: [string, Partial<PersonTraits>, boolean, JobShockKind | 'none'][] = [
    ['불안한 Linda / 전업 / 충격 없음', anxiousLinda, true, 'none'],
    ['불안한 Linda / 전업 / 해고', anxiousLinda, true, 'layoff'],
    ['불안한 Linda / 전업 / 공장 폐쇄', anxiousLinda, true, 'plantClosing'],
    ['불안한 Linda / 전업 / 장애', anxiousLinda, true, 'disability'],
    ['불안한 Linda / 맞벌이 / 해고', anxiousLinda, false, 'layoff'],
    ['차분한 Linda / 전업 / 충격 없음', calmLinda, true, 'none'],
    ['차분한 Linda / 전업 / 해고', calmLinda, true, 'layoff'],
  ];
  for (const [label, traits, homemaker, shock] of cases) {
    const s = runScenario(params, coupleFor(traits), homemaker, shock, reps);
    console.log(
      `  ${label.padEnd(26)}│ ${(s.divorceWithin3yAfterShock * 100).toFixed(1).padStart(6)}%            │ ${(s.lindaConfrontShareFirstYear * 100).toFixed(1).padStart(5)}%          │ ${(s.lindaSupportShareFirstYear * 100).toFixed(1).padStart(5)}%          │ ${s.childrenAtShock.toFixed(2)}명`,
    );
  }
}

const EVENT_KO: Record<string, string> = {
  hired: '취업',
  laidOff: '해고',
  plantClosing: '공장 폐쇄',
  quit: '그만둠',
  leftLaborForce: '구직 단념',
  leftForFamily: '출산 후 전업',
  returnedToWork: '복귀',
  promotedToManager: '관리자 승진',
  businessStarted: '창업',
  businessClosed: '폐업',
  disabled: '장애',
  retired: '은퇴',
};

/** 통합 모델 그대로(강제 없음): Roy와 Linda가 각자의 경력을 살며 결혼 생활을 한다. 운만 바꿔 몇 번. */
function integratedStory(params: MarriageParams): void {
  console.log('\n=== 통합 이야기 — Roy(1962, 고졸)와 Linda(1964, 고졸, 돈 걱정 많음), 1986년 결혼, 강제 없음, 운만 바꿔서 ===');
  for (let k = 0; k < 4; k++) {
    const { couple, track } = coupleFor({ neuroticism: 0.5, financialAnxiety: 1.2, traditionalism: 0.3 }, k + 1);
    const lindaEvents: string[] = [];
    const outcome = simulateCouple(
      couple,
      params,
      { husbandTrack: track, women: WOMEN, seed: 9000 + k },
      {
        censorAtHusbandAge: 55,
        wifeUntilAge: 55,
        onWifeMonth: (r) => {
          if (r.eventKind && r.eventKind !== 'jobToJob' && r.eventKind !== 'promoted' && r.year >= 1984) lindaEvents.push(`${r.year} ${EVENT_KO[r.eventKind] ?? r.eventKind}`);
        },
      },
    );
    const royShocks = outcome.months.filter((m) => m.monthsSinceShock === 0).map((m) => `${1986 + Math.floor(m.duration / 12)} ${m.lastShock === 'layoff' ? '해고' : m.lastShock === 'plantClosing' ? '공장 폐쇄' : '장애'}`);
    const end = outcome.endReason === 'divorce' ? `${1986 + Math.floor(outcome.durationMonths / 12)}년 이혼` : outcome.endReason === 'widowed' ? '사별' : '55세까지 유지';
    const homeShare = outcome.months.filter((m) => m.wifeAtHome).length / Math.max(1, outcome.months.length);
    console.log(`  운 #${k + 1}: 자녀 ${outcome.birthDurations.length}명, ${end}, Linda 전업 기간 ${(homeShare * 100).toFixed(0)}%`);
    console.log(`         Roy 충격: ${royShocks.join(', ') || '없음'}`);
    console.log(`         Linda 경력: ${lindaEvents.slice(0, 10).join(', ') || '없음'}`);
  }
}

function main(): void {
  const n = arg('n', 40000);
  const seed = arg('seed', 2);
  const params = CALIBRATED_PARAMS;
  const pass = validate(params, n, seed);
  mediation(params, Math.min(n, 20000), seed + 1);
  lindaDemo(params, arg('reps', 3000));
  integratedStory(params);
  console.log(`\n${pass ? '✅ 표본 외 검증 통과 (허용오차 2배를 넘는 적률 없음)' : '❌ 허용오차 2배를 넘는 적률 있음'}`);
  process.exit(pass ? 0 : 1);
}

main();
