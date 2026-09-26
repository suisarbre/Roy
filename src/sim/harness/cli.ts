import { HOMEOWNERSHIP_TARGETS, VALIDATION_TARGETS } from '../data';
import type { AggregatedStats } from './monteCarlo';
import { runMonteCarlo } from './monteCarlo';
import { POLICY_BOTS } from './bots';

/**
 * 3단계 하네스를 실제로 돌려서 VALIDATION_TARGETS/HOMEOWNERSHIP_TARGETS와 비교하는 CLI.
 * `npm run sim` (기본 n=1000, 3개 봇) 또는 `npm run sim -- --n=5000 --bot=random`으로 실행.
 *
 * 검증 방식: bots.ts의 설계 의도대로 random 봇만 "평범한 인생"으로서 타깃과 직접 비교한다.
 * workaholic/familyOriented는 의도적으로 타깃에서 벗어나야 하는 봇이라(예: 일중독은 이혼율이
 * 더 높아야 그럴듯함) PASS/FAIL 판정 없이 참고용으로만 나란히 출력한다.
 */

interface CliArgs {
  n: number;
  bots: (keyof typeof POLICY_BOTS)[];
}

function parseArgs(argv: string[]): CliArgs {
  let n = 1000;
  let botFilter: string | undefined;
  for (const arg of argv) {
    const nMatch = arg.match(/^--n=(\d+)$/);
    if (nMatch) n = Number(nMatch[1]);
    const botMatch = arg.match(/^--bot=(\w+)$/);
    if (botMatch) botFilter = botMatch[1];
  }
  const allBots = Object.keys(POLICY_BOTS) as (keyof typeof POLICY_BOTS)[];
  if (botFilter && !allBots.includes(botFilter as keyof typeof POLICY_BOTS)) {
    throw new Error(`알 수 없는 봇: ${botFilter} (가능: ${allBots.join(', ')})`);
  }
  return { n, bots: botFilter ? [botFilter as keyof typeof POLICY_BOTS] : allBots };
}

const STAT_KEY_BY_TARGET_ID: Record<string, keyof AggregatedStats> = {
  'mortality.lifeExpectancyAtBirth': 'meanAgeAtDeath',
  'mortality.survivalTo65': 'survivalTo65',
  'mortality.survivalTo85': 'survivalTo85',
  'marriage.everMarriedBy55': 'everMarriedBy55',
  'marriage.meanAgeAtFirstMarriage': 'meanAgeAtFirstMarriage',
  'marriage.firstMarriageEndsInDivorce': 'firstMarriageEndsInDivorce',
  'marriage.firstMarriageDurationBeforeDivorce': 'firstMarriageDurationBeforeDivorce',
  'marriage.remarriedAfterDivorce': 'remarriedAfterDivorce',
  'work.jobsHeld18to58': 'meanJobsHeld18to58',
  'work.shareOfWeeksEmployed': 'shareOfWeeksEmployed',
};

interface Row {
  id: string;
  target: number;
  measured: number;
  tolerance: number;
  diff: number;
  pass: boolean;
}

function compare(stats: AggregatedStats): Row[] {
  const rows: Row[] = [];

  for (const target of VALIDATION_TARGETS) {
    const key = STAT_KEY_BY_TARGET_ID[target.id];
    if (!key) continue; // fertility.* 등 Roy 본인 시뮬레이션에 해당 없는 타깃은 건너뜀
    const measured = stats[key] as number;
    const diff = Math.abs(measured - target.value);
    rows.push({ id: target.id, target: target.value, measured, tolerance: target.tolerance, diff, pass: diff <= target.tolerance });
  }

  for (const target of HOMEOWNERSHIP_TARGETS) {
    const bandId = target.id.replace('housing.ownership.', '');
    const measured = stats.homeownershipByBand[bandId];
    if (measured === undefined || Number.isNaN(measured)) continue;
    const diff = Math.abs(measured - target.value);
    rows.push({ id: target.id, target: target.value, measured, tolerance: target.tolerance, diff, pass: diff <= target.tolerance });
  }

  return rows;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : 'NaN';
}

function printBotReport(botName: string, stats: AggregatedStats, judge: boolean): boolean {
  const rows = compare(stats);
  console.log(`\n=== ${botName} (n=${stats.n}) ===`);
  let allPass = true;
  for (const row of rows) {
    if (judge && !row.pass) allPass = false;
    const mark = judge ? (row.pass ? 'PASS' : 'FAIL') : '  -  ';
    console.log(`  [${mark}] ${row.id.padEnd(45)} target=${fmt(row.target)} measured=${fmt(row.measured)} diff=${fmt(row.diff)} (tol ${row.tolerance})`);
  }
  return allPass;
}

function main(): void {
  const { n, bots } = parseArgs(process.argv.slice(2));
  console.log(`실타래 헤드리스 몬테카를로 검증 — n=${n} per bot, bots=[${bots.join(', ')}]`);

  let overallPass = true;
  for (const botName of bots) {
    const stats = runMonteCarlo(n, botName);
    // random 봇만 "평범한 인생" 타깃과 직접 비교(PASS/FAIL 판정). workaholic/familyOriented는
    // 의도적으로 타깃에서 벗어나야 하는 정책이라 참고용 숫자만 출력한다.
    const judge = botName === 'random';
    const pass = printBotReport(botName, stats, judge);
    if (judge) overallPass = overallPass && pass;
  }

  console.log(`\n${overallPass ? '✅ random 봇이 모든 타깃 허용오차 안에 들어옴' : '❌ random 봇이 일부 타깃을 벗어남 — 위 FAIL 항목 확인'}`);
  process.exit(overallPass ? 0 : 1);
}

main();
