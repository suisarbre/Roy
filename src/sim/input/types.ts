import type { ThreadDomain, ThreadShape } from '../threads/types';

/**
 * 입력 = 실타래 연산 IR — 설계 문서의 "6단계" 항목. 플레이어의 자유 텍스트를 이 5개 연산
 * 중 하나로 해석한다. LLM이 자유 서술을 받는 게 아니라, 코드가 먼저 "무엇을 하려는 건가"를
 * 확정한 뒤에야 장면화(7단계)로 넘어간다 — 그래야 실타래 상태 변화가 결정적으로 남는다.
 *
 * - attend: 이미 있는 실타래에 신경을 쓴다(생각/걱정/지켜봄) — 능동적 한 방이 아니라
 *   지속적 관심. threads/attention.ts의 attendedIds가 바로 이것.
 * - open: 지금 없는 새 실타래를 시작한다.
 * - advance: 있는 실타래를 결정적 행동으로 밀어붙인다(예: "빚을 갚는다", "고백한다") —
 *   attend보다 강한 한 방. threads/dynamics.ts의 'abandoned' 주석 참고: close와 구분되는
 *   "포기가 아니라 전진".
 * - close: 있는 실타래를 플레이어가 스스로 접는다(threads/dynamics.ts 주석: 'abandoned'는
 *   원칙적으로 여기서만 나온다 — pursuit의 모멘텀-바닥 자동 포기가 유일한 예외).
 * - act: 위 넷 중 어디에도 깔끔히 안 들어맞는 일반 행동(장면 안 flavor, 실타래 상태를
 *   직접 바꾸지 않는 것) — 판단을 못 내렸을 때의 보수적 fallback도 여기로 온다.
 */
export type ThreadOperation =
  | { kind: 'attend'; threadId: string }
  | { kind: 'open'; domain: ThreadDomain; shape: ThreadShape; label: string }
  | { kind: 'advance'; threadId: string }
  | { kind: 'close'; threadId: string }
  | { kind: 'act'; description: string };

/** interpret.ts가 실타래를 찾아 매칭할 때 필요한 최소 정보 — Thread 전체를 몰라도 된다. */
export interface ThreadRef {
  id: string;
  label: string;
  domain: ThreadDomain;
}

export interface InterpretContext {
  /** 지금 보드에 있는 실타래들 — regex/유사도 매칭 대상. */
  threads: readonly ThreadRef[];
  /** 지금 장면이 특정 실타래를 중심으로 열려 있으면(storyteller.selectScene이 고른 것)
   *  그 id — "계속"처럼 대상이 생략된 입력의 맥락 기본값 판단에 쓴다. */
  focusedThreadId?: string;
}
