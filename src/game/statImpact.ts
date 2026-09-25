import type { HiddenStats, Npc, NpcId, ObservableStats, StatImpact } from './types';

// 모델이 절대 수치를 직접 제안하기로 했기 때문에(작은 모델이 숫자를 과하게/이상하게 낼 위험이
// 있음), 코드 쪽에서 "사건 하나가 한 턴에 낼 수 있는 최대 변화폭"을 클램핑한다. 이건 밸런스
// 조정이 아니라 안전장치다 — 값 자체는 전부 임시.
const MAX_ABS_NET_WORTH_DELTA = 3000;
const MAX_ABS_HIDDEN_DEBT_DELTA = 3000;
const MAX_ABS_CREDIT_STANDING_DELTA = 30;
const MAX_ABS_STRESS_DELTA = 30;
const MAX_ABS_BURNOUT_DELTA = 30;
const MAX_ABS_RELATIONSHIP_DELTA = 30;
const MAX_ABS_DISEASE_PROGRESS_DELTA = 20;
const MAX_CHRONIC_SEED_SEVERITY = 100;

function clamp(value: number, maxAbs: number): number {
  return Math.max(-maxAbs, Math.min(maxAbs, value));
}

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface StatImpactResult {
  hidden: HiddenStats;
  observable: ObservableStats;
  npcs: Record<NpcId, Npc>;
}

/**
 * PlausibilityJudgment를 실제 상태 변화로 옮기는 유일한 채널. 메인 모델이 detail 턴/씬의
 * significant 교환에서 산출한 StatImpact를 여기서 적용한다 — statDrift.ts의 수동적 배경
 * 드리프트와는 별개로, "이 사건이 실제로 결과를 냈다"를 구조적으로 기록하는 부분.
 */
export function applyStatImpact(
  hidden: HiddenStats,
  observable: ObservableStats,
  npcs: Record<NpcId, Npc>,
  impact: StatImpact | undefined,
): StatImpactResult {
  if (!impact) return { hidden, observable, npcs };

  let nextHidden = hidden;
  let nextObservable = observable;
  let nextNpcs = npcs;

  if (impact.netWorthDelta || impact.hiddenDebtDelta || impact.creditStandingDelta) {
    nextHidden = {
      ...nextHidden,
      finance: {
        ...nextHidden.finance,
        netWorth: nextHidden.finance.netWorth + clamp(impact.netWorthDelta ?? 0, MAX_ABS_NET_WORTH_DELTA),
        hiddenDebt: nextHidden.finance.hiddenDebt + clamp(impact.hiddenDebtDelta ?? 0, MAX_ABS_HIDDEN_DEBT_DELTA),
        creditStanding: clampRange(
          nextHidden.finance.creditStanding + clamp(impact.creditStandingDelta ?? 0, MAX_ABS_CREDIT_STANDING_DELTA),
          0,
          100,
        ),
      },
    };
  }

  if (impact.stressDelta || impact.burnoutDelta) {
    nextHidden = {
      ...nextHidden,
      mentalHealth: {
        stressAccumulation: clampRange(
          nextHidden.mentalHealth.stressAccumulation + clamp(impact.stressDelta ?? 0, MAX_ABS_STRESS_DELTA),
          0,
          100,
        ),
        burnoutLevel: clampRange(
          nextHidden.mentalHealth.burnoutLevel + clamp(impact.burnoutDelta ?? 0, MAX_ABS_BURNOUT_DELTA),
          0,
          100,
        ),
      },
    };
  }

  if (impact.newChronicSeed) {
    nextHidden = {
      ...nextHidden,
      health: {
        ...nextHidden.health,
        chronicSeeds: [
          ...nextHidden.health.chronicSeeds,
          {
            id: crypto.randomUUID(),
            label: impact.newChronicSeed.label,
            severity: clampRange(impact.newChronicSeed.severity, 0, MAX_CHRONIC_SEED_SEVERITY),
            diagnosed: false,
          },
        ],
      },
    };
  }

  if (impact.diseaseProgressDelta) {
    const diseaseProgress = { ...nextHidden.health.diseaseProgress };
    for (const [diseaseId, delta] of Object.entries(impact.diseaseProgressDelta)) {
      const current = diseaseProgress[diseaseId] ?? 0;
      diseaseProgress[diseaseId] = clampRange(current + clamp(delta, MAX_ABS_DISEASE_PROGRESS_DELTA), 0, 100);
    }
    nextHidden = { ...nextHidden, health: { ...nextHidden.health, diseaseProgress } };
  }

  if (impact.newVisibleSymptom) {
    const symptom = impact.newVisibleSymptom;
    if (!nextObservable.mentalHealth.visibleSymptoms.includes(symptom)) {
      nextObservable = {
        ...nextObservable,
        mentalHealth: {
          visibleSymptoms: [...nextObservable.mentalHealth.visibleSymptoms, symptom],
        },
      };
    }
  }

  if (impact.relationshipDelta) {
    const { npcId, trustDelta, affectionDelta, resentmentDelta } = impact.relationshipDelta;
    const npc = nextNpcs[npcId];
    if (npc) {
      nextNpcs = {
        ...nextNpcs,
        [npcId]: {
          ...npc,
          hiddenRelationship: {
            trust: clampRange(
              npc.hiddenRelationship.trust + clamp(trustDelta ?? 0, MAX_ABS_RELATIONSHIP_DELTA),
              0,
              100,
            ),
            affection: clampRange(
              npc.hiddenRelationship.affection + clamp(affectionDelta ?? 0, MAX_ABS_RELATIONSHIP_DELTA),
              0,
              100,
            ),
            accumulatedResentment: Math.max(
              0,
              npc.hiddenRelationship.accumulatedResentment + clamp(resentmentDelta ?? 0, MAX_ABS_RELATIONSHIP_DELTA),
            ),
          },
        },
      };
    }
    // npcId가 존재하지 않으면(환각/오타) 조용히 무시 — 다른 채널들과 같은 방어 패턴.
  }

  return { hidden: nextHidden, observable: nextObservable, npcs: nextNpcs };
}
