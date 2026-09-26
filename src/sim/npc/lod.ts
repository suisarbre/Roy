import type { GameDate, NpcId, NpcRelationType } from '../../game/types';
import type { Sex } from '../data';
import { lodForImportance } from './types';
import type { NpcSimRecord, NpcTemperament } from './types';

/**
 * 관계 타입에 따른 초기 중요도 — game/npcImportance.ts의 BASE_IMPORTANCE_BY_RELATION과
 * 같은 값을 그대로 재사용한다(이미 한 번 고민해서 정한 값이고, 우연히도 4구간 임계값과
 * 자연스럽게 맞물린다 — parent/spouse/child=60은 곧장 close, sibling=45는 close 문턱
 * 바로 아래, friend/boss=15는 정확히 acquaintance 문턱, coworker/other=5~8은 background).
 */
const BASE_IMPORTANCE_BY_RELATION: Record<NpcRelationType, number> = {
  parent: 60,
  spouse: 60,
  child: 60,
  sibling: 45,
  friend: 15,
  boss: 15,
  coworker: 8,
  acquaintance: 5,
  other: 5,
};

const IMPORTANCE_GAIN_PER_INTERACTION = 3;
/** game/npcImportance.ts의 IMPORTANCE_DECAY_PER_MONTH와 동일값 — 다른 값일 근거가 아직
 *  없어서 그대로 가져왔다. */
const IMPORTANCE_DECAY_PER_MONTH = 0.5;
const MAX_IMPORTANCE = 100;

export function createNpcSimRecord(params: {
  id: NpcId;
  relationType: NpcRelationType;
  birthYear: number;
  sex: Sex;
  createdAt: GameDate;
  temperament: NpcTemperament;
  importanceScore?: number;
}): NpcSimRecord {
  const importanceScore = params.importanceScore ?? BASE_IMPORTANCE_BY_RELATION[params.relationType];
  return {
    id: params.id,
    relationType: params.relationType,
    birthYear: params.birthYear,
    sex: params.sex,
    alive: true,
    importanceScore,
    lod: lodForImportance(importanceScore),
    lastSimulatedAt: params.createdAt,
    temperament: params.temperament,
  };
}

/** Roy가 이번 tick에 이 NPC와 상호작용했을 때(장면 등장, attend 등) 호출한다. */
export function registerNpcInteraction(npc: NpcSimRecord): NpcSimRecord {
  const importanceScore = Math.min(npc.importanceScore + IMPORTANCE_GAIN_PER_INTERACTION, MAX_IMPORTANCE);
  return { ...npc, importanceScore, lod: lodForImportance(importanceScore) };
}

/**
 * 상호작용이 없었던 달에 호출한다 — 시간이 지날수록 중요도가 깎이고, 임계값 아래로 떨어지면
 * 강등된다. game/npcImportance.ts와 달리 가족 예외가 없다: LOD는 계산 자원 배분이지 감정적
 * 유대가 아니므로, 안 만난 부모도 결국 acquaintance로 내려간다(미확정: 이게 서사적으로
 * 괜찮은지는 실제 장면이 붙는 5단계 이후 확인 — 지금은 엔진 동작만 검증).
 */
export function decayNpcImportance(npc: NpcSimRecord, elapsedMonths: number): NpcSimRecord {
  if (elapsedMonths <= 0) return npc;
  const importanceScore = Math.max(npc.importanceScore - IMPORTANCE_DECAY_PER_MONTH * elapsedMonths, 0);
  return { ...npc, importanceScore, lod: lodForImportance(importanceScore) };
}
