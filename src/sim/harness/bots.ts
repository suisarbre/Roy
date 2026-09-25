import type { Rng } from '../rng';
import type { SharedResources, Thread, ThreadDomain } from '../threads/types';

/**
 * 정책 봇 — 매달 어떤 실타래를 attend할지 결정한다. "플레이어"의 자리에 LLM 대신 넣는
 * 단순 규칙. 무작위/일중독/가정적 세 가지로 서로 다른 삶의 궤적이 나오는지도 하네스가
 * 같이 확인한다(예: 일중독 봇은 이혼율이 더 높게 나와야 그럴듯하다).
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

function domainPriorityPolicy(priority: readonly ThreadDomain[]): PolicyBot {
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

export const workaholicPolicy: PolicyBot = domainPriorityPolicy(['work', 'livelihood', 'dreams']);

export const familyOrientedPolicy: PolicyBot = domainPriorityPolicy(['relationships', 'familyDuty', 'dwelling']);

export const POLICY_BOTS: Readonly<Record<string, PolicyBot>> = {
  random: randomPolicy,
  workaholic: workaholicPolicy,
  familyOriented: familyOrientedPolicy,
};
