import type { Thread } from './types';

/**
 * 이번 달 attentionBudget을 실타래들에 나눈다 — 1) 플레이어가 명시적으로 attend한 실타래에
 * 우선 배분(최대 1.0씩), 2) 남는 예산을 나머지 실타래에 interestEma 비례로 배분. 이 알고리즘
 * 자체가 밸런스 대상이라, 정확한 비율/우선순위는 3단계 몬테카를로 하네스로 튜닝한다.
 */
export function allocateAttention(threads: readonly Thread[], attendedIds: ReadonlySet<string>, budget: number): Map<string, number> {
  const allocation = new Map<string, number>();
  const threadIds = new Set(threads.map((thread) => thread.id));
  let remaining = budget;

  // attendedIds의 반복 순서(호출자가 우선순위대로 넣은 순서 — 예: bots.ts의 domainPriorityPolicy가
  // 점수순으로 정렬한 뒤 Set을 만들면 그 삽입 순서가 그대로 우선순위다)를 존중한다. threads
  // 배열 순서로 배분하면 attend된 개수가 예산을 넘을 때 봇이 고른 우선순위가 무시되고 배열
  // 위치가 대신 승자를 정하게 된다.
  for (const id of attendedIds) {
    if (!threadIds.has(id) || remaining <= 0) continue;
    const given = Math.min(1, remaining);
    allocation.set(id, given);
    remaining -= given;
  }

  const rest = threads.filter((thread) => !allocation.has(thread.id));
  const totalInterest = rest.reduce((sum, thread) => sum + thread.interestEma, 0);
  if (remaining > 0 && totalInterest > 0) {
    for (const thread of rest) {
      const share = Math.min(1, (thread.interestEma / totalInterest) * remaining);
      allocation.set(thread.id, share);
    }
  }

  for (const thread of threads) {
    if (!allocation.has(thread.id)) allocation.set(thread.id, 0);
  }

  return allocation;
}
