import type { GameDate } from '../../game/types';
import { addMonths } from '../gameDate';
import { createRng } from '../rng';
import type { JuxtapositionState } from '../salience';
import { simulateUntilScene } from '../storyteller';
import type { DebtState, DecayState, PursuitState, SharedResources, Thread, ThreadDomain } from '../threads/types';
import { POLICY_BOTS } from './bots';

/**
 * 5단계 검증 방법(설계 문서): "봇으로 장면 빈도·영역 비율 측정". 3단계처럼 비교할 실측
 * 타깃은 없다(장면이 몇 달에 한 번 나야 적당한지는 통계가 아니라 플레이 감각의 문제) —
 * 대신 정책 봇마다 장면 빈도와 영역(도메인) 분포가 그럴듯하게 달라지는지 확인한다. 예:
 * workaholic은 work/livelihood 장면이 더 많이 나야 그럴듯하다.
 *
 * 8개 도메인에 실타래를 하나씩 깔아두고(해소되면 같은 도메인으로 다시 채움 — 리얼리즘이
 * 아니라 "수십 년 동안 보드가 텅 비지 않게"가 목적인 합성 시나리오), simulateUntilScene을
 * 반복 호출해 장면이 나올 때마다 빈도/도메인을 집계한다.
 */

const ALL_DOMAINS: readonly ThreadDomain[] = ['livelihood', 'work', 'body', 'mind', 'relationships', 'familyDuty', 'dwelling', 'dreams'];

function freshThreadForDomain(domain: ThreadDomain, idSuffix: number): Thread {
  const id = `${domain}-${idSuffix}`;
  const base = { id, domain, label: id, origin: 'sceneFrequency demo', createdAtTurn: 0, stakes: 0.55, interestEma: 0.3, fatigue: 0 };

  if (domain === 'livelihood') {
    const state: DebtState = { amount: 2000, monthlyInterestRate: 0.02, stage: 'current', monthsUnaddressedInStage: 0, consecutiveGoodMonths: 0 };
    return { ...base, shape: 'debt', state };
  }
  if (domain === 'dreams') {
    const state: PursuitState = { progress: 0, momentum: 50, monthsAtLowMomentum: 0 };
    return { ...base, shape: 'pursuit', state };
  }
  // 나머지 6개 도메인(work/body/mind/relationships/familyDuty/dwelling)은 decay로 채운다 —
  // criticalThreshold 바로 위(45)에서 시작해야 방치 시 곧장 crossedCritical이 날 만큼
  // 민감하다(4단계 데모에서 확인한 것과 같은 이유 — 60처럼 높게 시작하면 금방 resolved로
  // 빠져서 심심해진다).
  const state: DecayState = { value: 45, decayRatePerMonth: 0.06, criticalThreshold: 40, monthsHealthyStreak: 0 };
  return { ...base, shape: 'decay', state };
}

export interface SceneFrequencyReport {
  botName: string;
  totalScenes: number;
  totalMonths: number;
  meanMonthsBetweenScenes: number;
  domainCounts: Record<ThreadDomain, number>;
}

export function measureSceneFrequency(botName: keyof typeof POLICY_BOTS, seed: number, threshold: number, horizonMonths: number): SceneFrequencyReport {
  const rng = createRng(seed);
  const attend = POLICY_BOTS[botName];

  let threads: Thread[] = ALL_DOMAINS.map((domain, i) => freshThreadForDomain(domain, i));
  let resources: SharedResources = { money: 500, stress: 0, attentionBudget: 3 };
  let date: GameDate = { year: 1990, month: 1 };
  let juxtapositionState: JuxtapositionState = {};
  let monthsUsed = 0;
  let totalScenes = 0;
  let idCounter = ALL_DOMAINS.length;
  const domainCounts = Object.fromEntries(ALL_DOMAINS.map((domain) => [domain, 0])) as Record<ThreadDomain, number>;

  while (monthsUsed < horizonMonths) {
    const window = Math.min(24, horizonMonths - monthsUsed);
    const result = simulateUntilScene(threads, resources, date, attend, threshold, juxtapositionState, rng, window);

    monthsUsed += result.monthsElapsed;
    date = addMonths(date, result.monthsElapsed);
    threads = result.threads;
    resources = result.resources;
    juxtapositionState = result.juxtapositionState;

    if (result.scene) {
      totalScenes += 1;
      domainCounts[result.scene.thread.domain] += 1;
    }

    // 실타래가 해소/포기/전환 등으로 줄어든 도메인은 같은 도메인으로 다시 채운다 — 안 그러면
    // 수십 년 뒤엔 보드가 비어서 측정할 게 없어진다.
    const presentDomains = new Set(threads.map((thread) => thread.domain));
    for (const domain of ALL_DOMAINS) {
      if (!presentDomains.has(domain)) threads = [...threads, freshThreadForDomain(domain, idCounter++)];
    }
  }

  return {
    botName,
    totalScenes,
    totalMonths: monthsUsed,
    meanMonthsBetweenScenes: totalScenes > 0 ? monthsUsed / totalScenes : NaN,
    domainCounts,
  };
}

function main(): void {
  const threshold = Number(process.argv[2] ?? 0.5);
  const horizonYears = Number(process.argv[3] ?? 40);
  const horizonMonths = horizonYears * 12;

  console.log(`장면 빈도/영역 비율 측정 — threshold=${threshold}, horizon=${horizonYears}년\n`);

  for (const botName of Object.keys(POLICY_BOTS) as (keyof typeof POLICY_BOTS)[]) {
    const report = measureSceneFrequency(botName, 1, threshold, horizonMonths);
    const domainSummary = ALL_DOMAINS.map((domain) => `${domain}=${report.domainCounts[domain]}`).join(' ');
    console.log(`[${botName}] 장면 ${report.totalScenes}회 / ${horizonYears}년 (평균 ${report.meanMonthsBetweenScenes.toFixed(1)}개월에 1번)`);
    console.log(`  도메인별: ${domainSummary}`);
  }
}

main();
