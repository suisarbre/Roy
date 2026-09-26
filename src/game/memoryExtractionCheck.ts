import { createNpc } from './npcImportance';
import { extractCandidateNpcNames, extractMemoryUpdate } from './memoryExtraction';
import type { Npc, NpcId, RecalledMemory } from './types';

/**
 * `npm run check:memory-extraction` — 7단계(LLM 축소)에서 memoryGraphDelta/newNpcs 대신
 * 도입한 경량 NER + 표면 유사도 추출을 sanity check한다. sim/input의 fixtures.ts+
 * regressionCli.ts와 같은 성격(정답 픽스처는 아니지만, 회귀를 잡을 만큼의 대표 사례).
 */

function makeNpc(id: NpcId, name: string): Npc {
  return createNpc({
    id,
    name,
    relationType: 'friend',
    firstAppearedTurn: 0,
    memoryNodeId: `node-${id}`,
    royAgeYears: 30,
    currentDate: { year: 1992, month: 1 },
  });
}

function check(label: string, condition: boolean, failures: string[]): void {
  if (!condition) failures.push(label);
}

function main(): void {
  const failures: string[] = [];

  // ---- 경량 NER ----
  check(
    '한국어 호칭 접미사로 새 이름을 잡는다',
    extractCandidateNpcNames('로이는 철수 씨를 만나 이야기를 나눴다.', []).includes('철수'),
    failures,
  );
  check(
    '영어 대문자 이름을 잡되 Roy 자신은 제외한다',
    (() => {
      const found = extractCandidateNpcNames('Roy met Carol at the diner.', []);
      return found.includes('Carol') && !found.includes('Roy');
    })(),
    failures,
  );
  check(
    '이미 아는 이름은 다시 제안하지 않는다',
    extractCandidateNpcNames('로이는 민수 씨와 다시 이야기했다.', ['민수']).length === 0,
    failures,
  );

  // ---- extractMemoryUpdate ----
  const npcs: Record<NpcId, Npc> = { 'npc-1': makeNpc('npc-1', '민수') };

  const gatedOff = extractMemoryUpdate({
    narrative: '로이는 철수 씨를 만나 이야기를 나눴다.',
    npcs,
    recalledMemories: [],
    shouldRecordEvent: false,
  });
  check('shouldRecordEvent=false면 새 이름이 있어도 아무것도 만들지 않는다', gatedOff.proposedNpcs.length === 0 && gatedOff.delta.newNodes.length === 0, failures);

  const recorded = extractMemoryUpdate({
    narrative: '로이는 철수 씨를 만나 이야기를 나눴다.',
    npcs,
    recalledMemories: [],
    shouldRecordEvent: true,
  });
  check('shouldRecordEvent=true면 신규 NPC 하나를 제안한다', recorded.proposedNpcs.length === 1 && recorded.proposedNpcs[0].name === '철수', failures);
  check(
    'proposedNpc.personNodeLocalId가 실제 person 노드를 가리킨다',
    recorded.delta.newNodes.some((n) => n.localId === recorded.proposedNpcs[0].personNodeLocalId && n.type === 'person'),
    failures,
  );
  check(
    'event 노드도 narrative 전문으로 함께 생성된다',
    recorded.delta.newNodes.some((n) => n.type === 'event' && n.content === '로이는 철수 씨를 만나 이야기를 나눴다.'),
    failures,
  );
  check('회수된 기억이 없으면 relatedTo 엣지도 없다', recorded.delta.newEdges.length === 0, failures);

  const recalledMemories: RecalledMemory[] = [{ id: 'mem-1', type: 'event', content: '로이는 공장에서 철수 씨를 처음 만났다.' }];
  const withLink = extractMemoryUpdate({
    narrative: '로이는 철수 씨를 다시 만나 안부를 물었다.',
    npcs,
    recalledMemories,
    shouldRecordEvent: true,
  });
  check('narrative와 겹치는 회수된 기억이 있으면 relatedTo 엣지가 생긴다', withLink.delta.newEdges.some((e) => e.to === 'mem-1' && e.relation === 'relatedTo'), failures);
  check('연결된 기존 노드는 accessedNodeIds에도 들어간다', withLink.delta.accessedNodeIds.includes('mem-1'), failures);

  const unrelated: RecalledMemory[] = [{ id: 'mem-2', type: 'event', content: '어제 날씨가 맑았다.' }];
  const noLink = extractMemoryUpdate({
    narrative: '로이는 철수 씨를 다시 만나 안부를 물었다.',
    npcs,
    recalledMemories: unrelated,
    shouldRecordEvent: true,
  });
  check('무관한 기억과는 엣지를 만들지 않는다', noLink.delta.newEdges.length === 0, failures);

  console.log(`memoryExtraction sanity check — ${failures.length === 0 ? 'PASS' : `FAIL (${failures.length}건)`}`);
  if (failures.length > 0) console.log(failures.map((f) => `  - ${f}`).join('\n'));

  process.exit(failures.length === 0 ? 0 : 1);
}

main();
