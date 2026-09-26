import type { GameDate, NpcId, NpcRelationType } from '../../game/types';
import type { PolicyBot } from '../attend';
import type { Sex } from '../data';
import type { LifeCourseState } from '../lifeCourse';
import type { SharedResources, Thread } from '../threads/types';

/**
 * NPC LOD(level of detail) — 설계 문서의 "NPC LOD" 항목. 4단계.
 *
 * 이건 감정적 유대(game/npcImportance.ts의 minor/major, LLM 시대 개념)가 아니라 **시뮬레이션
 * 해상도**다 — Roy가 이 사람을 얼마나 신경 쓰는지가 코드가 이 사람 삶에 얼마나 계산을 쓸지를
 * 정한다. 그래서 npcImportance.ts와 달리 강등이 자연스럽다: 10년 안 만난 친구를 계속 매달
 * 틱 돌릴 이유가 없다(가족 예외도 없다 — lod.ts 참고). 8단계(엔진 교체)에서 이 모듈이
 * game/npcImportance.ts를 대체한다.
 *
 * - foreground: LLM이 실제로 목소리를 낸다(장면 안에서 직접 등장). sim/ 레이어 관점에서는
 *   "close와 계산 방식은 같고, 7단계 storyteller가 이 사람을 장면 렌더링 대상으로 고를 수
 *   있다"는 차이뿐이라, 4단계 지금은 close와 완전히 동일하게 다룬다(월 틱 + 실타래 보드).
 *   구분 자체는 5~7단계(현저성/스토리텔러)에서 의미가 생긴다.
 * - close: 월 틱 + 자기 실타래 보드 + 기질(temperament). 배우자·동거 가족·친한 친구 등.
 * - acquaintance: 연 단위 기저율만(실타래 보드 없음) — lifeCourse.ts의 해저드로 "그동안
 *   결혼/이혼/이사했나" 정도만 추적한다. 구현은 매달 굴리지만(해저드가 이미 월간 확률이라
 *   "연 1회 vs 매달 굴려서 합산"은 통계적으로 같은 분포 — lifecycle.ts 참고), 실타래 보드가
 *   없다는 게 이 티어의 본질이다.
 * - background: 계산 자체가 없다. birthYear/relationType 등 최소 사실만 존재 — 승격되기
 *   전까지는 "존재하되 세계가 기다리게 한" 상태.
 */
export type NpcLod = 'foreground' | 'close' | 'acquaintance' | 'background';

/**
 * LOD 승격/강등 임계값. game/npcImportance.ts의 IMPORTANCE_PROMOTION_THRESHOLD(50)와 같은
 * "상호작용 누적" 신호를 쓰지만 여기선 4구간이다. 정확한 값은 미확정 — 4단계 목표는
 * "승격/강등 메커니즘 자체가 동작하는가"이고, 실제 빈도 튜닝은 5단계 현저성 작업과 함께
 * 한다(체감상 close 이상은 흔치 않아야 하므로 acquaintance-close 간격을 넓게 잡아뒀다).
 */
export const NPC_LOD_THRESHOLDS = {
  acquaintance: 15,
  close: 50,
  foreground: 80,
} as const;

export function lodForImportance(importanceScore: number): NpcLod {
  if (importanceScore >= NPC_LOD_THRESHOLDS.foreground) return 'foreground';
  if (importanceScore >= NPC_LOD_THRESHOLDS.close) return 'close';
  if (importanceScore >= NPC_LOD_THRESHOLDS.acquaintance) return 'acquaintance';
  return 'background';
}

/** close 이상만 갖는 실타래 보드 — threads/board.ts의 tickMonth가 그대로 소비하는 모양. */
export interface NpcBoard {
  threads: readonly Thread[];
  resources: SharedResources;
}

/**
 * 이 NPC가 자기 실타래에 관심을 어떻게 배분하는지(harness의 정책 봇과 같은 PolicyBot 타입) +
 * Roy에게 얼마나 관대한지. close/foreground로 처음 승격될 때 한 번 정해지면 안 바뀐다
 * (미확정: 성격이 사건으로 바뀔 수 있는가는 6~7단계 이후 질문 — 지금은 고정 기질로 단순화).
 */
export interface NpcTemperament {
  attend: PolicyBot;
  /** 0~1 — 방치돼도 서운함이 덜 쌓이는 정도. 아직 아무 dynamics도 이 값을 안 읽는다
   *  (미확정: game/npcImportance.ts의 resentment 증가율에 곱할 배수로 6단계 이후 연결). */
  patience: number;
}

export interface NpcSimRecord {
  id: NpcId;
  relationType: NpcRelationType;
  birthYear: number;
  sex: Sex;
  alive: boolean;
  lod: NpcLod;
  /** Roy와의 상호작용으로 쌓이는 값 — LOD를 결정하는 유일한 입력(lodForImportance, lod.ts). */
  importanceScore: number;
  /** 마지막으로 catchUpNpc(lifecycle.ts)를 돌린 게임 날짜 — 이전엔 세계가 이 NPC를 기다리게
   *  했을 뿐 아무 것도 계산하지 않았다. "지연 평가"의 기준점. */
  lastSimulatedAt: GameDate;
  /** 첫 catchUpNpc 전까지 undefined — background는 계산할 상태 자체가 없다. */
  life?: LifeCourseState;
  /** close/foreground로 한 번이라도 승격된 적 있으면 생긴다. 강등돼도 지우지 않는다(판
   *  자체가 사라지는 게 아니라 tick이 멈출 뿐 — 재승격 시 이어서 진행). */
  board?: NpcBoard;
  temperament: NpcTemperament;
}
