import type { HiddenStats, LifeStage } from './types';

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

/** 이 생애주기 동안은 경제주체가 본인이 아니므로 재정 드리프트를 적용하지 않는다. */
const LIFE_STAGES_WITHOUT_FINANCE_DRIFT: readonly LifeStage[] = ['infancy', 'childhood'];

/**
 * 시간 경과에 따른 hidden 값의 수동적(passive) 이동 — 재정/건강/정신건강.
 * 사건에 따른 큰 변화는 여기서 다루지 않는다 — 그건 메인 모델/씬 요약이 서사로 만들어내는
 * 몫이고(statImpact 채널), 여기는 "아무 일 없어도 삶은 계속 소모된다"는 배경 물리 법칙만
 * 담당한다. 관계 관련 드리프트는 npcImportance.ts의 driftNpcRelationship이 담당한다 —
 * 관계 데이터가 Npc 레코드로 옮겨졌으므로 NPC 순회 루프 안에서 같이 처리하는 게 자연스럽다.
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
