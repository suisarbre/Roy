import type { Language } from '../i18n';
import { GENERIC_CHRONIC_LABEL } from './textTemplates';
import type { HiddenStats, MentalSymptomTag, Npc, NpcId, ObservableStats, OutcomeImpact } from './types';

/**
 * 등급(minor/moderate/major)을 실제 숫자로 바꾸는 테이블. 모델이 숫자를 직접 안 내므로
 * 클램핑이 아니라 이 표 자체가 "사건 하나가 낼 수 있는 변화폭"의 정의다 — 밸런스 조정이
 * 필요하면 여기 값만 만지면 된다.
 */
const FINANCE_NET_WORTH_BY_MAGNITUDE = { minor: 300, moderate: 1000, major: 3000 };
const FINANCE_CREDIT_BY_MAGNITUDE = { minor: 5, moderate: 15, major: 30 };
const MENTAL_STRESS_BY_MAGNITUDE = { minor: 5, moderate: 15, major: 30 };
const RELATIONSHIP_BY_MAGNITUDE = { minor: 5, moderate: 15, major: 30 };
const HEALTH_SEVERITY_BY_MAGNITUDE = { minor: 10, moderate: 25, major: 45 };

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface StatImpactResult {
  hidden: HiddenStats;
  observable: ObservableStats;
  npcs: Record<NpcId, Npc>;
}

/**
 * PlausibilityJudgment를 실제 상태 변화로 옮기는 유일한 채널. statDrift.ts의 수동적 배경
 * 드리프트와는 별개로, "이 사건이 실제로 결과를 냈다"를 구조적으로 기록하는 부분.
 *
 * 예전엔 모델이 9개 숫자 필드를 직접 냈지만(라우터 제거 + 모델 축소와 함께 바꿈, 사용자
 * 결정), 작은 모델이 여러 숫자를 동시에 잘 보정하긴 어려워서 axis/direction/magnitude
 * 정성적 등급 하나만 받고, 실제 숫자는 위 테이블로 이 함수가 결정한다.
 */
export function applyOutcomeImpact(
  hidden: HiddenStats,
  observable: ObservableStats,
  npcs: Record<NpcId, Npc>,
  impact: OutcomeImpact | undefined,
  newVisibleSymptom: MentalSymptomTag | undefined,
  language: Language,
): StatImpactResult {
  let nextHidden = hidden;
  let nextObservable = observable;
  let nextNpcs = npcs;

  if (impact) {
    const sign = impact.direction === 'positive' ? 1 : -1;

    switch (impact.axis) {
      case 'finance': {
        nextHidden = {
          ...nextHidden,
          finance: {
            ...nextHidden.finance,
            netWorth: nextHidden.finance.netWorth + sign * FINANCE_NET_WORTH_BY_MAGNITUDE[impact.magnitude],
            creditStanding: clampRange(
              nextHidden.finance.creditStanding + sign * FINANCE_CREDIT_BY_MAGNITUDE[impact.magnitude],
              0,
              100,
            ),
          },
        };
        break;
      }

      case 'mentalHealth': {
        // 부호가 finance/relationship과 반대다: direction:'positive'(좋은 결과)는 스트레스를
        // '내려야' 한다 — "더 많은 스트레스"가 아니라 "더 적은 스트레스"가 긍정적 결과다.
        const delta = -sign * MENTAL_STRESS_BY_MAGNITUDE[impact.magnitude];
        nextHidden = {
          ...nextHidden,
          mentalHealth: {
            stressAccumulation: clampRange(nextHidden.mentalHealth.stressAccumulation + delta, 0, 100),
            burnoutLevel: clampRange(nextHidden.mentalHealth.burnoutLevel + delta * 0.6, 0, 100),
          },
        };
        break;
      }

      case 'health': {
        if (impact.direction === 'negative') {
          const label = impact.note?.trim() || GENERIC_CHRONIC_LABEL[language];
          nextHidden = {
            ...nextHidden,
            health: {
              ...nextHidden.health,
              chronicSeeds: [
                ...nextHidden.health.chronicSeeds,
                {
                  id: crypto.randomUUID(),
                  label,
                  severity: HEALTH_SEVERITY_BY_MAGNITUDE[impact.magnitude],
                  diagnosed: false,
                },
              ],
            },
          };
        } else if (nextHidden.health.chronicSeeds.length > 0) {
          // 긍정적 건강 변화 — 가장 심각한 기존 시드를 완화(호전)시킨다. 새로 만들 시드가
          // 없으니 direction:'positive'에는 note가 필요 없다.
          const seeds = nextHidden.health.chronicSeeds;
          const worstIndex = seeds.reduce((worst, seed, i) => (seed.severity > seeds[worst].severity ? i : worst), 0);
          const relief = HEALTH_SEVERITY_BY_MAGNITUDE[impact.magnitude];
          const updatedSeeds = [...seeds];
          updatedSeeds[worstIndex] = {
            ...updatedSeeds[worstIndex],
            severity: clampRange(updatedSeeds[worstIndex].severity - relief, 0, 100),
          };
          nextHidden = { ...nextHidden, health: { ...nextHidden.health, chronicSeeds: updatedSeeds } };
        }
        break;
      }

      case 'relationship': {
        const npc = impact.relationshipNpcId ? nextNpcs[impact.relationshipNpcId] : undefined;
        if (npc && impact.relationshipNpcId) {
          const delta = sign * RELATIONSHIP_BY_MAGNITUDE[impact.magnitude];
          nextNpcs = {
            ...nextNpcs,
            [impact.relationshipNpcId]: {
              ...npc,
              hiddenRelationship: {
                trust: clampRange(npc.hiddenRelationship.trust + delta, 0, 100),
                affection: clampRange(npc.hiddenRelationship.affection + delta, 0, 100),
                accumulatedResentment: Math.max(0, npc.hiddenRelationship.accumulatedResentment - delta),
              },
            },
          };
        }
        // relationshipNpcId가 없거나 존재하지 않는 NPC면(환각/오타) 조용히 무시.
        break;
      }
    }
  }

  if (newVisibleSymptom && !nextObservable.mentalHealth.visibleSymptoms.includes(newVisibleSymptom)) {
    nextObservable = {
      ...nextObservable,
      mentalHealth: { visibleSymptoms: [...nextObservable.mentalHealth.visibleSymptoms, newVisibleSymptom] },
    };
  }

  return { hidden: nextHidden, observable: nextObservable, npcs: nextNpcs };
}
