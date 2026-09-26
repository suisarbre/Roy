import type { Rng } from './rng';
import type { Thread } from './threads/types';

/**
 * 현저성(salience) — 설계 문서의 공식: 긴급도 × 판돈 × 인지 필터 × (1+관심 EMA) × 피로 감쇠
 * + 병치 보너스. "이 순간을 장면화할 만큼 눈에 띄는가"를 하나의 숫자로 압축한다. storyteller.ts의
 * selectScene이 이 숫자를 문턱과 비교해서 장면화 여부를 정한다.
 */
export interface SalienceInput {
  thread: Thread;
  /** 이번 tick의 salienceDelta(threads/dynamics.ts) — "무슨 일이 생겼는가"의 크기. */
  urgency: number;
  /** Roy가 이 일을 얼마나 아는가(0~1). 기본 1 — Roy 자신의 실타래는 항상 안다는 단순화
   *  (hidden/observable 분리는 8단계에서 game/의 HiddenStats를 흡수할 때 다시 볼 것).
   *  NPC 쪽 사건은 npc/collision.ts를 거쳐 여기 들어올 때 낮게 줄 수 있다 — 미확정: 정확한
   *  값은 NPC와의 관계/LOD에 따라 5~7단계에서 정할 것. */
  cognitiveFilter?: number;
}

export function computeSalience(input: SalienceInput): number {
  const cognitiveFilter = input.cognitiveFilter ?? 1;
  const fatigueDecay = Math.max(0, 1 - input.thread.fatigue);
  return input.urgency * input.thread.stakes * cognitiveFilter * (1 + input.thread.interestEma) * fatigueDecay;
}

/**
 * 병치 보너스 — 미확정. "방치된 반대 감정 실타래"(설계 문서)를 판정하려면 실타래에 감정가
 * (valence) 태그가 있어야 하는데 지금 타입(threads/types.ts)엔 도메인/모양만 있고 감정가가
 * 없다. 진짜 "반대 감정 병치"(예: 기쁜 추구와 침울한 부식이 동시에 방치됨)를 판정하려면
 * 콘텐츠가 붙는 7~8단계에서 실타래에 valence 필드가 생겨야 한다 — 그때 재검토.
 *
 * 지금은 약한 근사를 쓴다: "이번 달 여러 실타래가 동시에 들썩였다"(urgency가 바닥값 이상인
 * 후보가 2개 이상) — 겹치는 위기 자체가 이미 드라마이므로 완전히 근거 없는 대체는 아니다.
 * 확률적이고 쿨다운이 있어 매달 뜨진 않는다(설계 문서의 "확률적·쿨다운" 그대로).
 */
const JUXTAPOSITION_URGENCY_FLOOR = 0.4;
const JUXTAPOSITION_BONUS = 0.3;
const JUXTAPOSITION_CHANCE = 0.5;
export const JUXTAPOSITION_COOLDOWN_MONTHS = 6;

export interface JuxtapositionState {
  lastTriggeredAtMonth?: number;
}

export function rollJuxtapositionBonus(
  candidateUrgencies: readonly number[],
  currentMonth: number,
  state: JuxtapositionState,
  rng: Rng,
): { bonus: number; state: JuxtapositionState } {
  const busyCount = candidateUrgencies.filter((u) => u >= JUXTAPOSITION_URGENCY_FLOOR).length;
  const onCooldown = state.lastTriggeredAtMonth !== undefined && currentMonth - state.lastTriggeredAtMonth < JUXTAPOSITION_COOLDOWN_MONTHS;

  if (busyCount < 2 || onCooldown || rng() >= JUXTAPOSITION_CHANCE) return { bonus: 0, state };
  return { bonus: JUXTAPOSITION_BONUS, state: { lastTriggeredAtMonth: currentMonth } };
}
