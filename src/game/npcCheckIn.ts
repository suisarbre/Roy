import { randomPolicy } from '../sim/attend';
import { catchUpNpc } from '../sim/npc/lifecycle';
import type { NpcLod, NpcSimRecord } from '../sim/npc/types';
import { createInitialLifeCourseState } from '../sim/lifeCourse';
import type { LifeCourseState } from '../sim/lifeCourse';
import { applyImportanceDecay, driftNpcRelationship } from './npcImportance';
import type { GameDate, MemoryGraphDelta, Npc, NpcId, ProposedMemoryNode } from './types';

/**
 * 9단계(1차) — NPC 체크인. "유휴 시간 백그라운드 생성"의 실체: major 등급 NPC 한정으로,
 * sim/npc/lifecycle.ts의 catchUpNpc를 그대로 재사용해 그 NPC의 독립된 삶(결혼/이혼/재혼/
 * 취업/자가보유/사망)을 진행시킨다. 재구현이 아니라 game/Npc <-> NpcSimRecord 사이의 작은
 * 어댑터만 새로 만든다.
 *
 * minor 등급은 이번에도 기존처럼 중요도 감쇠 + 관계 냉각만 적용한다(생애사건 시뮬레이션
 * 없음 — sim/npc/의 acquaintance/background 티어처럼 "계산 자체가 없다"는 원칙을
 * 그대로 따름, 다만 이번 1차는 그 중간 티어 구분 자체를 들여오지 않고 minor 전체를
 * background 취급으로 단순화했다).
 */

/** catchUpNpc가 필요로 하는 건 lod==='close'|'foreground'인지 여부뿐이다(sim/npc/types.ts
 *  주석 확인 — close/foreground는 계산 방식이 완전히 같다). major는 그 임계값(50)과
 *  정확히 일치하므로 'close' 하나로 충분하고, minor는 'background'로 매핑한다. */
function toSimRecord(npc: Npc): NpcSimRecord {
  const lod: NpcLod = npc.importanceTier === 'major' ? 'close' : 'background';
  return {
    id: npc.id,
    relationType: npc.relationType,
    birthYear: npc.birthYear,
    sex: npc.sex,
    alive: npc.alive,
    lod,
    importanceScore: npc.importanceScore,
    lastSimulatedAt: npc.lastSimulatedAt,
    life: npc.lifeCourse,
    board: npc.simBoard,
    temperament: { attend: randomPolicy, patience: 0.5 },
  };
}

function describeLifeCourseChanges(name: string, before: LifeCourseState, after: LifeCourseState): string[] {
  const facts: string[] = [];

  if (after.divorceCount > before.divorceCount) {
    facts.push(`${name} went through a divorce.`);
  } else if (after.marriageCount > before.marriageCount) {
    facts.push(after.marriageCount > 1 ? `${name} remarried.` : `${name} got married.`);
  }

  if (!before.isHomeowner && after.isHomeowner) facts.push(`${name} bought a home.`);

  if (before.employed && !after.employed) {
    facts.push(`${name} lost their job.`);
  } else if (after.employed && after.jobsHeldCount > before.jobsHeldCount) {
    facts.push(`${name} started a new job.`);
  }

  return facts;
}

export interface NpcCheckInResult {
  npc: Npc;
  facts: string[];
}

/** major 등급이 아니거나 잃을 시간이 없으면(lastSimulatedAt이 이미 currentDate 이상) 즉시
 *  통과. `tickLifeCourse`가 `life` 객체를 제자리에서 변형하므로 catchUpNpc 호출 전
 *  structuredClone으로 "이전" 스냅샷을 떠둬야 diff가 의미 있다. */
export function runNpcCheckIn(npc: Npc, currentDate: GameDate): NpcCheckInResult {
  if (npc.importanceTier !== 'major' || !npc.alive) return { npc, facts: [] };

  const beforeLife: LifeCourseState = npc.lifeCourse ? structuredClone(npc.lifeCourse) : createInitialLifeCourseState();
  const result = catchUpNpc(toSimRecord(npc), currentDate, Math.random);

  const updatedNpc: Npc = {
    ...npc,
    alive: result.npc.alive,
    lifeCourse: result.npc.life,
    simBoard: result.npc.board,
    lastSimulatedAt: result.npc.lastSimulatedAt,
  };

  if (result.diedAt) {
    return { npc: updatedNpc, facts: [`${npc.name} died.`] };
  }

  const facts = result.npc.life ? describeLifeCourseChanges(npc.name, beforeLife, result.npc.life) : [];
  return { npc: updatedNpc, facts };
}

const EMPTY_DELTA: MemoryGraphDelta = { newNodes: [], newEdges: [], accessedNodeIds: [] };

/**
 * 기존 decayAllNpcs를 감싼다 — 모든 NPC에 감쇠/냉각을 적용하되, major 등급은 체크인까지
 * 같이 돌려서 그 결과(사실 문장들)를 memoryGraph 델타로 반환한다. 호출부(gameLoop.ts)가
 * 이 델타를 applyMemoryGraphDelta로 공유 그래프에 반영한다 — 낮은 활성화로 시작하므로
 * (accessTurns=[currentTurn] 하나뿐) "방금 막 조용히 사실이 됐다, Roy는 어렴풋이만
 * 안다"는 게 자연스럽게 표현된다.
 */
export function decayAndCheckInNpcs(
  npcs: Record<NpcId, Npc>,
  elapsedMonths: number,
  currentDate: GameDate,
): { npcs: Record<NpcId, Npc>; delta: MemoryGraphDelta } {
  if (elapsedMonths <= 0) return { npcs, delta: EMPTY_DELTA };

  const nextNpcs: Record<NpcId, Npc> = {};
  const newNodes: ProposedMemoryNode[] = [];
  let nodeCounter = 0;

  for (const [id, npc] of Object.entries(npcs)) {
    const decayed = driftNpcRelationship(applyImportanceDecay(npc, elapsedMonths), elapsedMonths);

    if (decayed.importanceTier !== 'major' || !decayed.alive) {
      nextNpcs[id] = decayed;
      continue;
    }

    const { npc: checkedIn, facts } = runNpcCheckIn(decayed, currentDate);
    nextNpcs[id] = checkedIn;
    for (const fact of facts) {
      newNodes.push({ localId: `checkin-${nodeCounter++}`, type: 'event', content: fact, participantNpcIds: [id] });
    }
  }

  return { npcs: nextNpcs, delta: { newNodes, newEdges: [], accessedNodeIds: [] } };
}
