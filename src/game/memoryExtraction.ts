import { bestTokenSimilarity } from '../sim/input/similarity';
import type { MemoryGraphDelta, Npc, NpcId, ProposedMemoryEdge, ProposedMemoryNode, ProposedNpc, RecalledMemory } from './types';

/**
 * 7단계(LLM 축소): memoryGraphDelta/newNpcs를 더 이상 모델이 뽑지 않는다 — 그래프 추출은
 * 작은 모델이 가장 못하는 일이고(narrative 한 단락 쓰는 것보다, 환각 없이 구조화된
 * 그래프를 뽑는 쪽이 훨씬 어렵다), 검증도 불가능했다. 대신 이미 나온 narrative 텍스트에서
 * 코드가 직접 뽑는다:
 *
 * - "로그": narrative 자체가 이번 사건의 유일한 원본 — 새 event 노드의 content로 그대로 쓴다.
 * - "임베딩": 진짜 벡터 임베딩(transformers.js) 대신, 6단계(src/sim/input)에서 이미 같은
 *   이유로 도입한 표면 유사도 근사(bestTokenSimilarity — 문자 3-그램 자카드를 어절 단위
 *   최댓값으로)를 재사용한다. 이 파일 하나만 나중에 진짜 임베딩으로 바꾸면 된다
 *   (sim/input/README.md에 적힌 것과 같은 자리 표시 패턴).
 * - "경량 NER": 정규식 기반 휴리스틱으로 "새로 등장한 사람 이름"을 후보로 뽑는다 — 별도
 *   ML 모델 없이, 한국어 호칭 접미사(씨/형/선배 등)와 라틴 문자 대문자 이름 패턴만 본다.
 */

// ---- 경량 NER: 새로 등장한 인물 이름 후보 ----

const KOREAN_NAME_SUFFIXES = [
  '씨',
  '군',
  '양',
  '형',
  '누나',
  '언니',
  '오빠',
  '선배',
  '삼촌',
  '이모',
  '사장님',
  '팀장님',
  '부장님',
  '선생님',
  '목사님',
  '신부님',
  '아저씨',
  '아주머니',
];

/** 한글 음절 2~4자 + 호칭 접미사(공백 있어도/없어도). "철수 씨", "김철수씨" 둘 다 잡는다. */
const KOREAN_NAME_RE = new RegExp(`([가-힣]{2,4})\\s?(?:${KOREAN_NAME_SUFFIXES.join('|')})`, 'g');

/** 대문자로 시작하는 라틴 문자 이름(최대 3어절 연속). 문장 시작에 흔한 일반 단어와 Roy
 *  자신은 별도 스톱리스트로 걸러낸다. */
const LATIN_NAME_RE = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}\b/g;

const LATIN_STOPWORDS = new Set([
  'Roy',
  'The',
  'A',
  'An',
  'He',
  'She',
  'It',
  'They',
  'His',
  'Her',
  'Their',
  'This',
  'That',
  'These',
  'Those',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

/** candidate가 이미 아는 이름과 겹치는지(서로 포함 관계) — 조사/축약 변형 방어. */
function matchesKnownName(candidate: string, knownNames: readonly string[]): boolean {
  return knownNames.some((known) => known.length > 0 && (candidate.includes(known) || known.includes(candidate)));
}

/**
 * narrative에서 "새로 등장한 사람 이름"을 후보로 뽑는다. knownNames(현재 NPC 이름 전부 +
 * "Roy" 자신)에 이미 있으면 제외한다. 완벽할 수 없는 휴리스틱이다 — 오탐(사람 아닌 고유
 *명사)과 미탐(호칭 없이 등장하는 이름) 둘 다 가능하다는 걸 알고 쓴다(경량 NER의 한계,
 * 6단계 input/interpret.ts의 정규식 캐스케이드와 같은 성격의 트레이드오프).
 */
export function extractCandidateNpcNames(narrative: string, knownNames: readonly string[]): string[] {
  const allKnown = ['Roy', 'roy', ...knownNames];
  const found = new Set<string>();

  for (const match of narrative.matchAll(KOREAN_NAME_RE)) {
    const name = match[1];
    if (name && !matchesKnownName(name, allKnown)) found.add(name);
  }

  for (const match of narrative.matchAll(LATIN_NAME_RE)) {
    const name = match[0];
    if (LATIN_STOPWORDS.has(name)) continue;
    if (!matchesKnownName(name, allKnown)) found.add(name);
  }

  return [...found];
}

// ---- 이번 사건을 기억 그래프 변경분으로 조립 ----

export interface MemoryExtractionInput {
  narrative: string;
  /** 참여자 태깅용 — 이름이 narrative에 직접 언급된 기존 NPC를 찾는다. */
  npcs: Record<NpcId, Npc>;
  /** 이번 턴을 위해 이미 회수된 기억(활성화 필터링된 소규모 후보군) — 여기서만 유사
   *  연결(relatedTo)을 찾는다. 전체 그래프를 매번 훑지 않기 위한 의도적 제약. */
  recalledMemories: RecalledMemory[];
  /** 이 사건이 장기 기억으로 남길 가치가 있는지 — gameLoop.ts가 판정 결과(개연성/영향/사망/
   *  씬 진입)로 이미 결정해서 넘긴다. false면 새 이름이 있어도 이벤트 노드를 만들지 않는다
   *  (경량 NER의 오탐이 평범한 턴마다 그래프를 오염시키는 걸 막기 위한 단일 게이트). */
  shouldRecordEvent: boolean;
}

export interface MemoryExtractionResult {
  delta: MemoryGraphDelta;
  proposedNpcs: ProposedNpc[];
}

const EMPTY_DELTA: MemoryGraphDelta = { newNodes: [], newEdges: [], accessedNodeIds: [] };

/** 표면 유사도가 이 이상이고, 최대 이만큼만 relatedTo로 연결한다 — 진짜 임베딩보다 잡음이
 *  많으므로 문턱을 낮게 잡고 개수를 제한해 과잉 연결을 막는다. */
const RELATED_LINK_THRESHOLD = 0.12;
const MAX_RELATED_LINKS = 3;

export function extractMemoryUpdate(input: MemoryExtractionInput): MemoryExtractionResult {
  if (!input.shouldRecordEvent) {
    return { delta: EMPTY_DELTA, proposedNpcs: [] };
  }

  const knownNames = Object.values(input.npcs).map((npc) => npc.name);
  const candidateNames = extractCandidateNpcNames(input.narrative, knownNames);

  const proposedNpcs: ProposedNpc[] = [];
  const newNodes: ProposedMemoryNode[] = [];
  const eventParticipantNpcIds: string[] = [];

  for (const npc of Object.values(input.npcs)) {
    if (npc.name && input.narrative.includes(npc.name)) eventParticipantNpcIds.push(npc.id);
  }

  candidateNames.forEach((name, index) => {
    const npcLocalId = `ner-npc-${index}`;
    const personNodeLocalId = `ner-person-${index}`;
    proposedNpcs.push({ localId: npcLocalId, name, relationType: 'other', personNodeLocalId });
    newNodes.push({ localId: personNodeLocalId, type: 'person', content: name });
    eventParticipantNpcIds.push(npcLocalId);
  });

  const eventLocalId = 'ner-event-0';
  newNodes.push({
    localId: eventLocalId,
    type: 'event',
    content: input.narrative,
    participantNpcIds: eventParticipantNpcIds.length > 0 ? eventParticipantNpcIds : undefined,
  });

  const linked = input.recalledMemories
    .map((memory) => ({ memory, score: bestTokenSimilarity(input.narrative, memory.content) }))
    .filter((entry) => entry.score >= RELATED_LINK_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RELATED_LINKS);

  const newEdges: ProposedMemoryEdge[] = linked.map((entry) => ({
    from: eventLocalId,
    to: entry.memory.id,
    relation: 'relatedTo',
    weight: entry.score,
  }));

  return {
    delta: { newNodes, newEdges, accessedNodeIds: linked.map((entry) => entry.memory.id) },
    proposedNpcs,
  };
}
