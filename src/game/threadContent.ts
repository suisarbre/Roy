import type { DecayState, PursuitState, Thread } from '../sim/threads/types';

/**
 * 8단계(1차) — src/sim/은 완전히 추상적인 엔진이라(도메인/샤드만 알고 Roy는 모른다),
 * 게임이 실제로 굴러가려면 보드에 최소한의 시드 콘텐츠가 있어야 한다(비어있으면
 * simulateUntilScene은 매번 조용히 maxMonths를 다 채우고 끝난다). 이 파일은 그 최소
 * 다리 역할만 한다 — 가족 의무/거처/꿈 등 나머지 도메인을 실제 Roy의 삶에 맞게 채우는
 * 건 의도적으로 범위 밖에 남겨뒀다(harness/sceneFrequency.ts처럼 8개 도메인을 전부
 * 합성으로 채우면 지금 단계에서 검증할 수 없는 콘텐츠를 미리 지어내는 꼴이 된다).
 */

/** sceneFrequency.ts 하네스가 쓰는 값과 같은 성격의 자리표시자 — 튜닝 대상이지 밸런스가 아니다. */
const BASELINE_STAKES = 0.55;
const BASELINE_INTEREST_EMA = 0.3;

const WORK_SEEKING_PURSUIT: PursuitState = { progress: 0, momentum: 50, monthsAtLowMomentum: 0 };
const BODY_UPKEEP_DECAY: DecayState = { value: 45, decayRatePerMonth: 0.06, criticalThreshold: 40, monthsHealthyStreak: 0 };

/** 첫 일자리를 구할 법한 나이 — 청소년기 진입(13세, LifeStage 경계)과 맞춤. */
const WORK_THREAD_MIN_AGE = 13;

function makeThread(id: string, turnIndex: number, base: Omit<Thread, 'id' | 'createdAtTurn' | 'stakes' | 'interestEma' | 'fatigue'>): Thread {
  return {
    ...base,
    id,
    createdAtTurn: turnIndex,
    stakes: BASELINE_STAKES,
    interestEma: BASELINE_INTEREST_EMA,
    fatigue: 0,
  } as Thread;
}

/**
 * `work`/`body` 도메인에 실타래가 하나도 없고 나이 조건을 만족하면 하나씩 새로 연다.
 * harness/sceneFrequency.ts의 "도메인이 비면 같은 도메인으로 다시 채운다" 패턴에 나이
 * 게이트만 더한 것 — 매 "계속하기" 사이클마다 호출해도 안전(이미 있으면 아무 일도 안 함).
 */
export function ensureBaselineThreads(threads: Thread[], ageYears: number, turnIndex: number): Thread[] {
  if (ageYears < WORK_THREAD_MIN_AGE) return threads;

  const hasWorkThread = threads.some((thread) => thread.domain === 'work');
  const hasBodyThread = threads.some((thread) => thread.domain === 'body');
  if (hasWorkThread && hasBodyThread) return threads;

  const additions: Thread[] = [];
  if (!hasWorkThread) {
    additions.push(
      makeThread(crypto.randomUUID(), turnIndex, {
        domain: 'work',
        label: 'Finding steady work',
        origin: 'Roy started looking for his first job.',
        shape: 'pursuit',
        state: WORK_SEEKING_PURSUIT,
      }),
    );
  }
  if (!hasBodyThread) {
    additions.push(
      makeThread(crypto.randomUUID(), turnIndex, {
        domain: 'body',
        label: 'General health',
        origin: 'The ordinary upkeep of a body that ages whether or not anyone tends to it.',
        shape: 'decay',
        state: BODY_UPKEEP_DECAY,
      }),
    );
  }

  return [...threads, ...additions];
}

/** sceneFrequency.ts CLI 기본값(threshold=0.5)과 동일 — "재미있게 느껴지는 장면 빈도"는
 *  통계가 아니라 플레이 감각의 문제라 검증 타깃이 없다(harness/README.md와 같은 태도). */
export const THREAD_SCENE_SALIENCE_THRESHOLD = 0.5;
