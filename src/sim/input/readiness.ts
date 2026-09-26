import { trigramSimilarity } from './similarity';

/**
 * 준비도 — 별도 스탯으로 저장하지 않고 판정 시점에 기억과의 유사도로 즉석 계산한다(설계
 * 문서, threads/types.ts의 TransitionState 주석: "장면화 시점에 기억 그래프 임베딩
 * 유사도로 즉석 계산한다"). similarity.ts의 trigramSimilarity가 진짜 임베딩의 자리
 * 표시라, memorySnippets를 "이 전환과 관련된 기억을 한 줄씩 요약한 문장들"이라고
 * 가정한다 — 실제 MemoryGraph 노드 텍스트를 여기 넣는 건 game/의 memoryGraph를 sim/이
 * 흡수하는 8단계 몫. 지금은 함수 자체가 옳게 동작하는지만 확인한다.
 */
export function computeReadiness(readinessQuery: string, memorySnippets: readonly string[]): number {
  if (memorySnippets.length === 0) return 0;
  const best = Math.max(...memorySnippets.map((snippet) => trigramSimilarity(readinessQuery, snippet)));
  return Math.min(1, best);
}
