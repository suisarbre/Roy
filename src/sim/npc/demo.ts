import { addMonths } from '../gameDate';
import { createRng } from '../rng';
import { domainPriorityPolicy, randomPolicy } from '../attend';
import { tickMonth } from '../threads/board';
import type { DebtState, DecayState, SharedResources, Thread, ThreadDomain } from '../threads/types';
import { detectNpcCollisions } from './collision';
import { catchUpNpc } from './lifecycle';
import { createNpcSimRecord, decayNpcImportance, registerNpcInteraction } from './lod';
import type { NpcSimRecord } from './types';

/**
 * 4단계(NPC LOD + 지연 평가 + 실타래 충돌 감지)가 실제로 동작하는지 보여주는 데모.
 * `npm run sim:npc`. 통계 검증(harness/cli.ts)과는 성격이 다르다 — NPC LOD엔 비교할 실측
 * 타깃이 없으므로(사람마다 다른 게 당연), 여기선 "메커니즘이 재현 가능하고 의도대로
 * 동작하는가"만 확인한다.
 */

function debtThread(id: string, amount: number): Thread {
  const state: DebtState = { amount, monthlyInterestRate: 0.02, stage: 'current', monthsUnaddressedInStage: 0, consecutiveGoodMonths: 0 };
  return { id, domain: 'livelihood', label: id, origin: 'demo', createdAtTurn: 0, stakes: 0.6, interestEma: 0.5, fatigue: 0, shape: 'debt', state };
}

/** 예산(2)보다 실타래가 많아야(3개) attention.ts가 고친 우선순위 배분이 실제로 시험된다 —
 *  하나뿐이면 무조건 다 받아가서 방치 자체가 안 생긴다(3단계 리뷰에서 확인한 사실). */
function decayThread(id: string, domain: ThreadDomain, value: number): Thread {
  const state: DecayState = { value, decayRatePerMonth: 0.08, criticalThreshold: 40, monthsHealthyStreak: 0 };
  return { id, domain, label: id, origin: 'demo', createdAtTurn: 0, stakes: 0.5, interestEma: 0.4, fatigue: 0, shape: 'decay', state };
}

interface DemoReport {
  log: string[];
  collisionMonths: number;
  totalMonths: number;
  exampleCollision?: string;
}

function runDemo(seed: number): DemoReport {
  const rng = createRng(seed);
  const log: string[] = [];
  const start = { year: 1990, month: 1 };

  // ---- 1) LOD 승격/강등 ----
  let spouse: NpcSimRecord = createNpcSimRecord({
    id: 'spouse',
    relationType: 'spouse',
    birthYear: 1963,
    sex: 'female',
    createdAt: start,
    temperament: { attend: domainPriorityPolicy(['relationships', 'livelihood']), patience: 0.6 },
  });
  let coworker: NpcSimRecord = createNpcSimRecord({
    id: 'coworker',
    relationType: 'coworker',
    birthYear: 1965,
    sex: 'male',
    createdAt: start,
    temperament: { attend: randomPolicy, patience: 0.3 },
  });
  log.push(`[lod] 초기: spouse=${spouse.lod}(${spouse.importanceScore}) coworker=${coworker.lod}(${coworker.importanceScore})`);

  // 5년 동안 Roy가 배우자와는 매달 상호작용하고 coworker는 방치한다.
  for (let i = 0; i < 60; i++) {
    spouse = registerNpcInteraction(spouse);
    coworker = decayNpcImportance(coworker, 1);
  }
  log.push(`[lod] 5년 후: spouse=${spouse.lod}(${spouse.importanceScore}) coworker=${coworker.lod}(${coworker.importanceScore})`);
  const promoted = spouse.lod === 'close' || spouse.lod === 'foreground';
  const stayedBackground = coworker.lod === 'background';
  log.push(`[lod] 승격/강등 동작함? ${promoted && stayedBackground ? 'YES' : 'NO (버그)'}`);

  // ---- 2) 지연 평가(catchUpNpc) ----
  // 이 시점까지 lastSimulatedAt은 둘 다 start 그대로 — 5년치를 한 번에 지연 평가한다.
  const now = { year: 1995, month: 1 };
  const spouseCatchUp = catchUpNpc(spouse, now, rng);
  const coworkerCatchUp = catchUpNpc(coworker, now, rng);
  spouse = spouseCatchUp.npc;
  coworker = coworkerCatchUp.npc;

  log.push(
    `[catchUp] spouse(close): alive=${spouse.alive} boardThreads=${spouse.board?.threads.length ?? 0} events=${spouseCatchUp.events.length} lastSimulatedAt=${JSON.stringify(spouse.lastSimulatedAt)}`,
  );
  log.push(
    `[catchUp] coworker(${coworker.lod}): alive=${coworker.alive} board=${coworker.board ? 'YES(버그: acquaintance/background는 보드가 없어야 함)' : '없음(정상)'} lastSimulatedAt=${JSON.stringify(coworker.lastSimulatedAt)}`,
  );

  // ---- 3) 실타래 충돌 감지: 순수 함수 단위 확인 ----
  const salientRoyEvent = { threadId: 'r1', domain: 'livelihood' as const, label: 'Roy 빚', salience: 0.9 };
  const salientNpcEvent = { threadId: 'n1', domain: 'work' as const, label: '배우자 해고', salience: 0.8 };
  const quietNpcEvent = { threadId: 'n2', domain: 'body' as const, label: '배우자 감기', salience: 0.1 };
  const unitCollisions = detectNpcCollisions('spouse', [salientNpcEvent, quietNpcEvent], [salientRoyEvent]);
  const unitOk = unitCollisions.length === 1 && unitCollisions[0].collidesWithRoyEvent?.threadId === 'r1';
  log.push(`[collision] 단위 확인(현저한 것만 통과, 조용한 건 걸러짐)? ${unitOk ? 'YES' : 'NO (버그)'}`);

  // ---- 4) 실제 시뮬레이션에서 충돌이 자연스럽게 나오는지: Roy 보드 + spouse 보드를 20년
  //         동안 매달 나란히(같은 달) tick하며 detectNpcCollisions를 매달 돌려본다. 실타래를
  //         3개(예산 2보다 많이) 둬서 방치가 실제로 생기게 한다 — 안 그러면 유일한 실타래가
  //         항상 예산을 독점해서 아무도 방치되지 않는다(3단계 리뷰에서 확인한 현상).
  // 초기값을 criticalThreshold(40) 바로 위(42)에 둔다 — 60처럼 healthyLevel(55) 위에서
  // 시작하면 몇 달 만에 resolved로 빠져서(경쟁 상대가 줄어) 나머지 기간이 심심해진다.
  let royThreads: Thread[] = [debtThread('roy-debt', 4000), decayThread('roy-health', 'body', 42), decayThread('roy-friendship', 'relationships', 42)];
  let royResources: SharedResources = { money: 150, stress: 0, attentionBudget: 2 };
  let spouseThreads: readonly Thread[] = [
    ...(spouse.board?.threads ?? []),
    decayThread('spouse-health', 'body', 42),
    decayThread('spouse-work', 'work', 42),
  ];
  let spouseResources: SharedResources = spouse.board?.resources ?? { money: 0, stress: 0, attentionBudget: 2 };

  let collisionMonths = 0;
  let exampleCollision: string | undefined;
  const totalMonths = 240;
  for (let i = 0; i < totalMonths; i++) {
    const date = addMonths(now, i);
    const royAttended = randomPolicy(royThreads, royResources, rng);
    const royResult = tickMonth(royThreads, royResources, date, royAttended, 1, rng);
    royThreads = [...royResult.threads];
    royResources = royResult.resources;

    const spouseAttended = spouse.temperament.attend(spouseThreads, spouseResources, rng);
    const spouseResult = tickMonth(spouseThreads, spouseResources, date, spouseAttended, 1, rng);
    spouseThreads = spouseResult.threads;
    spouseResources = spouseResult.resources;

    const collisions = detectNpcCollisions('spouse', spouseResult.events, royResult.events);
    if (collisions.length > 0) {
      collisionMonths += 1;
      exampleCollision ??= `${JSON.stringify(date)}: spouse "${collisions[0].npcEvent.label}"(salience ${collisions[0].npcEvent.salience.toFixed(2)})` +
        (collisions[0].collidesWithRoyEvent ? ` + Roy "${collisions[0].collidesWithRoyEvent.label}"(같은 달)` : '');
    }
  }
  log.push(`[collision] ${totalMonths}개월 나란히 시뮬레이션 중 충돌 감지된 달: ${collisionMonths}`);

  return { log, collisionMonths, totalMonths, exampleCollision };
}

function main(): void {
  const seed = Number(process.argv[2] ?? 1);
  const runA = runDemo(seed);
  const runB = runDemo(seed);
  const deterministic = JSON.stringify(runA) === JSON.stringify(runB);

  console.log(runA.log.join('\n'));
  if (runA.exampleCollision) console.log(`\n[collision] 예시: ${runA.exampleCollision}`);
  console.log(`\n결정론적 재현 확인(같은 시드 두 번 실행 결과 동일)? ${deterministic ? 'YES' : 'NO (버그 — 시드 안 타는 무작위성이 섞여 있음)'}`);
  process.exit(deterministic ? 0 : 1);
}

main();
