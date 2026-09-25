import type { HiddenStats, LifeStage, NpcId, ObservableStats } from './types';

// 아래 상수는 전부 임시값이다 — 실제 밸런스는 플레이테스트 후 조정이 필요하다.
// 핵심은 수치 자체가 아니라 메커니즘(시간이 지나면 hidden 값이 저절로 움직인다)이며,
// 숫자는 언제든 바꿀 수 있다.
const MONTHLY_NET_WORTH_DRIFT = -20;
const MONTHLY_DISEASE_PROGRESS = 0.15;
const MONTHLY_CHRONIC_SEED_SEVERITY = 0.1;
const MONTHLY_STRESS_ACCUMULATION = 0.8;
/** 이 정도로 스트레스가 쌓여야 번아웃도 같이 쌓이기 시작 — 이벤트를 강제 발생시키는 임계값이
 *  아니라, 순수하게 burnoutLevel이라는 숫자 하나가 움직이는 속도를 조절할 뿐이다. */
const STRESS_BURNOUT_ONSET = 60;
const MONTHLY_BURNOUT_ACCUMULATION = 0.4;
const MONTHLY_RESENTMENT_GROWTH = 0.5;
const MONTHLY_RELATIONSHIP_COOLING = 0.3;

const NEUTRAL_RELATIONSHIP_VALUE = 50;

/** 이 생애주기 동안은 경제주체가 본인이 아니므로 재정 드리프트를 적용하지 않는다. */
const LIFE_STAGES_WITHOUT_FINANCE_DRIFT: readonly LifeStage[] = ['infancy', 'childhood'];

function easeTowardNeutral(value: number, amount: number): number {
  if (value > NEUTRAL_RELATIONSHIP_VALUE) return Math.max(value - amount, NEUTRAL_RELATIONSHIP_VALUE);
  if (value < NEUTRAL_RELATIONSHIP_VALUE) return Math.min(value + amount, NEUTRAL_RELATIONSHIP_VALUE);
  return value;
}

/**
 * 시간 경과에 따른 hidden 값의 수동적(passive) 이동 — 재정/건강/정신건강.
 * 사건에 따른 큰 변화는 여기서 다루지 않는다 — 그건 메인 모델/씬 요약이 서사로 만들어내는
 * 몫이고, 여기는 "아무 일 없어도 삶은 계속 소모된다"는 배경 물리 법칙만 담당한다.
 */
export function applyHiddenStatDrift(hidden: HiddenStats, elapsedMonths: number, lifeStage: LifeStage): HiddenStats {
  if (elapsedMonths <= 0) return hidden;

  const financeDriftApplies = !LIFE_STAGES_WITHOUT_FINANCE_DRIFT.includes(lifeStage);

  const diseaseProgress = Object.fromEntries(
    Object.entries(hidden.health.diseaseProgress).map(([id, progress]) => [
      id,
      Math.min(progress + MONTHLY_DISEASE_PROGRESS * elapsedMonths, 100),
    ]),
  );

  const chronicSeeds = hidden.health.chronicSeeds.map((seed) =>
    seed.diagnosed
      ? seed
      : { ...seed, severity: Math.min(seed.severity + MONTHLY_CHRONIC_SEED_SEVERITY * elapsedMonths, 100) },
  );

  const stressAccumulation = Math.min(
    hidden.mentalHealth.stressAccumulation + MONTHLY_STRESS_ACCUMULATION * elapsedMonths,
    100,
  );
  const burnoutLevel =
    stressAccumulation >= STRESS_BURNOUT_ONSET
      ? Math.min(hidden.mentalHealth.burnoutLevel + MONTHLY_BURNOUT_ACCUMULATION * elapsedMonths, 100)
      : hidden.mentalHealth.burnoutLevel;

  return {
    ...hidden,
    finance: financeDriftApplies
      ? { ...hidden.finance, netWorth: hidden.finance.netWorth + MONTHLY_NET_WORTH_DRIFT * elapsedMonths }
      : hidden.finance,
    health: { ...hidden.health, diseaseProgress, chronicSeeds },
    mentalHealth: { ...hidden.mentalHealth, stressAccumulation, burnoutLevel },
  };
}

/**
 * 이번 턴에 등장하지 않은 관계는 서운함이 쌓이고 trust/affection이 중립(50)으로 식는다 —
 * npcImportance.ts의 중요도 강등과 같은 원리를 관계 감정 수치에도 적용한 것.
 * 등장했다고 자동으로 좋아지진 않는다 — 긍정적 변화는 서사(메인 모델/씬 요약)의 몫이다.
 */
export function applyRelationshipDrift(
  relationships: HiddenStats['relationships'],
  participantNpcIds: ReadonlySet<NpcId>,
  elapsedMonths: number,
): HiddenStats['relationships'] {
  if (elapsedMonths <= 0) return relationships;

  const next: HiddenStats['relationships'] = {};
  for (const [npcId, rel] of Object.entries(relationships)) {
    if (participantNpcIds.has(npcId)) {
      next[npcId] = rel;
      continue;
    }
    next[npcId] = {
      accumulatedResentment: rel.accumulatedResentment + MONTHLY_RESENTMENT_GROWTH * elapsedMonths,
      trust: easeTowardNeutral(rel.trust, MONTHLY_RELATIONSHIP_COOLING * elapsedMonths),
      affection: easeTowardNeutral(rel.affection, MONTHLY_RELATIONSHIP_COOLING * elapsedMonths),
    };
  }
  return next;
}

/** 아직 관계 기록이 없는 NPC(주로 방금 생성된 인물)에게 중립값 기본 레코드를 채워준다. */
export function ensureRelationshipRecords(
  hidden: HiddenStats,
  observable: ObservableStats,
  npcIds: NpcId[],
): { hidden: HiddenStats; observable: ObservableStats } {
  const missing = npcIds.filter((id) => !(id in hidden.relationships));
  if (missing.length === 0) return { hidden, observable };

  const hiddenRelationships = { ...hidden.relationships };
  const observableRelationships = { ...observable.relationships };
  for (const id of missing) {
    hiddenRelationships[id] = {
      accumulatedResentment: 0,
      trust: NEUTRAL_RELATIONSHIP_VALUE,
      affection: NEUTRAL_RELATIONSHIP_VALUE,
    };
    observableRelationships[id] = { contactFrequency: 'none', lastContactDate: null };
  }

  return {
    hidden: { ...hidden, relationships: hiddenRelationships },
    observable: { ...observable, relationships: observableRelationships },
  };
}
