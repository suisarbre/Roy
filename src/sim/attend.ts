import type { Rng } from './rng';
import type { SharedResources, Thread, ThreadDomain } from './threads/types';

/**
 * 매달 어떤 실타래를 attend할지 결정하는 함수 — "누가 결정하느냐"를 추상화한 것.
 * harness/bots.ts의 헤드리스 정책 봇도, NPC의 고정된 기질(npc/types.ts의 NpcTemperament)도
 * 전부 이 타입 하나로 표현된다(실제 플레이어 입력은 6단계 IR의 attend 연산으로 대체될 것 —
 * 그때도 이 타입을 만족하는 어댑터를 씌우면 된다).
 */
export type PolicyBot = (threads: readonly Thread[], resources: SharedResources, rng: Rng) => ReadonlySet<string>;

function pickTopByBudget(scored: { id: string; score: number }[], budget: number): ReadonlySet<string> {
  const count = Math.max(1, Math.round(budget));
  return new Set(
    scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((s) => s.id),
  );
}

export const randomPolicy: PolicyBot = (threads, resources, rng) => {
  if (threads.length === 0) return new Set();
  const scored = threads.map((t) => ({ id: t.id, score: rng() }));
  return pickTopByBudget(scored, resources.attentionBudget);
};

/** 도메인 우선순위 목록 하나로 정책 봇을 하나 만든다 — harness/bots.ts의 workaholic/
 *  familyOriented, npc/temperament.ts의 NPC 기질이 전부 이걸로 만들어진다. */
export function domainPriorityPolicy(priority: readonly ThreadDomain[]): PolicyBot {
  return (threads, resources, rng) => {
    if (threads.length === 0) return new Set();
    const scored = threads.map((t) => {
      const rank = priority.indexOf(t.domain);
      const domainScore = rank === -1 ? 0 : priority.length - rank;
      return { id: t.id, score: domainScore * 10 + rng() };
    });
    return pickTopByBudget(scored, resources.attentionBudget);
  };
}
