import { createRng } from '../sim/rng';
import { decayAndCheckInNpcs } from './npcCheckIn';
import { weatherContent, weatherMemoryGraph } from './memoryWeathering';
import { createNpc } from './npcImportance';
import type { GameDate, MemoryGraph, MemoryNode, NpcId } from './types';

/**
 * `npm run check:npc-checkin` — 9단계(1차) 스모크 테스트. NPC 체크인(sim/npc/lifecycle.ts의
 * catchUpNpc 재사용)과 기억 풍화(memoryWeathering.ts, 이번에 새로 설계한 것)를 확인한다.
 * Math.random은 이 스크립트 안에서만 시드 RNG로 바꿔치기해 재현 가능하게 한다(threadEngineCheck.ts와
 * 같은 패턴).
 */

function check(label: string, condition: boolean, failures: string[]): void {
  if (!condition) failures.push(label);
}

function addMonths(date: GameDate, months: number): GameDate {
  const total = date.year * 12 + (date.month - 1) + months;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function checkNpcCheckIn(failures: string[]): void {
  const originalRandom = Math.random;
  Math.random = createRng(7);

  try {
    let date: GameDate = { year: 1992, month: 1 };
    let npcs: Record<NpcId, ReturnType<typeof createNpc>> = {
      spouse: createNpc({
        id: 'spouse',
        name: 'Carol',
        relationType: 'spouse', // 초기 importanceScore 60 >= 임계값 50 -> 즉시 major
        firstAppearedTurn: 0,
        memoryNodeId: 'node-spouse',
        royAgeYears: 30,
        currentDate: date,
      }),
    };

    check('spouse는 생성 즉시 major 등급이다', npcs.spouse.importanceTier === 'major', failures);
    check('parent보다 젊은 spouse의 birthYear가 그럴듯한 범위에 있다', Math.abs(1992 - npcs.spouse.birthYear - 30) <= 12, failures);

    const allFacts: string[] = [];
    for (let year = 0; year < 45 && npcs.spouse.alive; year++) {
      const result = decayAndCheckInNpcs(npcs, 12, addMonths(date, 12));
      date = addMonths(date, 12);
      npcs = result.npcs as typeof npcs;
      for (const node of result.delta.newNodes) allFacts.push(node.content);
    }

    check(
      `45년치 체크인에서 최소 하나의 사실이 생성됨 (실제: ${allFacts.length}건)`,
      allFacts.length > 0,
      failures,
    );
    if (!npcs.spouse.alive) {
      check('사망한 NPC는 "died" 사실을 남긴다', allFacts.some((f) => f.includes('died')), failures);
    }
  } finally {
    Math.random = originalRandom;
  }
}

function checkBirthYearHeuristics(failures: string[]): void {
  const currentDate: GameDate = { year: 2002, month: 1 };
  const royAgeYears = 40;

  for (let i = 0; i < 20; i++) {
    const parent = createNpc({ id: `p${i}`, name: 'P', relationType: 'parent', firstAppearedTurn: 0, memoryNodeId: `n${i}`, royAgeYears, currentDate });
    const parentAge = currentDate.year - parent.birthYear;
    check(`parent(#${i})는 Roy보다 나이가 많다 (parentAge=${parentAge}, royAge=${royAgeYears})`, parentAge > royAgeYears, failures);

    const child = createNpc({ id: `c${i}`, name: 'C', relationType: 'child', firstAppearedTurn: 0, memoryNodeId: `n${i}`, royAgeYears, currentDate });
    const childAge = currentDate.year - child.birthYear;
    check(`child(#${i})는 0세 이상, Roy보다 어림 (childAge=${childAge})`, childAge >= 0 && childAge < royAgeYears, failures);
  }
}

function makeNode(id: string, content: string, createdAtTurn: number, accessTurns: number[]): MemoryNode {
  return { id, type: 'event', content, createdAtTurn, accessTurns };
}

function checkWeathering(failures: string[]): void {
  const longContent = 'Roy and Carol argued about money late into the night. Neither of them slept well.';
  const graph: MemoryGraph = {
    nodes: {
      old: makeNode('old', longContent, 0, [0]),
      young: makeNode('young', longContent, 490, [490]),
    },
    edges: {},
    adjacency: {},
  };

  const afterFirstPass = weatherMemoryGraph(graph, 500);
  check('오래되고 활성화 낮은 노드는 풍화된다', afterFirstPass.nodes.old.weathered === true, failures);
  check('풍화된 content는 원문보다 짧다', afterFirstPass.nodes.old.content.length < longContent.length, failures);
  check('나이가 어린 노드는 풍화되지 않는다', afterFirstPass.nodes.young.weathered !== true, failures);

  const afterSecondPass = weatherMemoryGraph(afterFirstPass, 600);
  check('이미 풍화된 노드는 다시 줄어들지 않는다(1회성)', afterSecondPass.nodes.old.content === afterFirstPass.nodes.old.content, failures);

  check('첫 문장 추출: 마침표 있는 문장은 그 앞까지만 남는다', weatherContent('First sentence. Second sentence.') === 'First sentence.', failures);
  check('문장 부호 없는 긴 텍스트는 길이 상한으로 잘린다', weatherContent('a'.repeat(80)).endsWith('…'), failures);
}

function main(): void {
  const failures: string[] = [];

  checkNpcCheckIn(failures);
  checkBirthYearHeuristics(failures);
  checkWeathering(failures);

  console.log(`NPC 체크인 + 기억 풍화 스모크 테스트 — ${failures.length === 0 ? 'PASS' : `FAIL (${failures.length}건)`}`);
  if (failures.length > 0) console.log(failures.map((f) => `  - ${f}`).join('\n'));

  process.exit(failures.length === 0 ? 0 : 1);
}

main();
