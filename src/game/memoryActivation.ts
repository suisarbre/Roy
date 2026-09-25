import type { MemoryNode } from './types';

/** 감쇠율. 값이 클수록 안 쓰는 기억이 더 빨리 흐려진다. */
const DECAY_RATE = 0.5;

/**
 * ACT-R base-level activation을 단순화한 공식.
 * 최근에, 자주 접근된 노드일수록 값이 높다. 완전히 0으로 떨어지지 않고
 * 점근적으로만 낮아지므로 "흐려지지만 사라지지 않는다"는 요구사항을 만족한다.
 */
export function computeActivation(node: MemoryNode, currentTurn: number): number {
  if (node.accessTurns.length === 0) return -Infinity;

  const sum = node.accessTurns.reduce((acc, t) => {
    const elapsed = Math.max(currentTurn - t, 1);
    return acc + Math.pow(elapsed, -DECAY_RATE);
  }, 0);

  return Math.log(sum);
}

/** 일반적인 컨텍스트 구성 시 사용하는 임계값. 이 아래는 프롬프트에서 제외된다. */
export const AMBIENT_RECALL_THRESHOLD = -0.5;

/**
 * 플레이어가 "기억을 떠올려본다"처럼 의도적으로 회상을 시도할 때 쓰는 완화된 임계값.
 * 활성화가 낮아도 접근 자체는 가능하게 해서 "약화되지만 접근 가능"을 구현한다.
 */
export const EFFORTFUL_RECALL_THRESHOLD = -5;

export function isRecallableAmbiently(node: MemoryNode, currentTurn: number): boolean {
  return computeActivation(node, currentTurn) >= AMBIENT_RECALL_THRESHOLD;
}

export function isRecallableWithEffort(node: MemoryNode, currentTurn: number): boolean {
  return computeActivation(node, currentTurn) >= EFFORTFUL_RECALL_THRESHOLD;
}
