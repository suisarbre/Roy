import type { PolicyBot } from '../attend';
import { sigmoid } from '../marriage/population';
import type { NpcTemperament } from '../npc/types';
import type { ThreadDomain } from '../threads/types';
import type { PersonTraits } from './profile';

/**
 * 성격 → 실타래 관심 배분(NpcTemperament). 전에는 NPC마다 손으로 "관계 우선" 같은 정책을 붙였다 —
 * 이제 같은 성격이 경력(승진·해고·창업), 결혼(대립·지지), 관심 배분을 한꺼번에 움직인다.
 *
 * 가중치는 **설계 가정**이다(보정할 통계가 없다): 신경성·금전 불안은 생계 걱정으로, 친화성·외향성은
 * 관계로, 성실성은 일·몸·의무로, 개방성은 꿈으로 관심을 끈다. 성실성이 낮을수록 관심이 들쭉날쭉하다
 * (그 달의 기분). 실타래의 판돈(stakes)은 누구에게나 조금씩 먹힌다.
 */

type Weights = Partial<Record<keyof PersonTraits, number>>;

export const DOMAIN_TRAIT_WEIGHTS: Readonly<Record<ThreadDomain, Weights>> = {
  livelihood: { financialAnxiety: 0.6, conscientiousness: 0.4, neuroticism: 0.3 },
  work: { conscientiousness: 0.6, extraversion: 0.3, agreeableness: -0.2 },
  body: { conscientiousness: 0.4, neuroticism: 0.2 },
  mind: { neuroticism: 0.5, openness: 0.3 },
  relationships: { agreeableness: 0.6, extraversion: 0.5 },
  familyDuty: { agreeableness: 0.5, traditionalism: 0.5, conscientiousness: 0.3 },
  dwelling: { conscientiousness: 0.3, traditionalism: 0.3 },
  dreams: { openness: 0.6, riskTolerance: 0.3, conscientiousness: -0.2 },
};

export function domainAffinity(traits: PersonTraits, domain: ThreadDomain): number {
  let score = 0;
  for (const [trait, w] of Object.entries(DOMAIN_TRAIT_WEIGHTS[domain]) as [keyof PersonTraits, number][]) score += w * traits[trait];
  return score;
}

/** 이 성격이 매달 어떤 실타래에 관심을 줄지. */
export function personalityPolicy(traits: PersonTraits): PolicyBot {
  const noise = 0.3 + 1.2 * sigmoid(-traits.conscientiousness);
  const affinity = new Map<ThreadDomain, number>();
  return (threads, resources, rng) => {
    if (threads.length === 0) return new Set();
    const scored = threads.map((t) => {
      let a = affinity.get(t.domain);
      if (a === undefined) {
        a = domainAffinity(traits, t.domain);
        affinity.set(t.domain, a);
      }
      return { id: t.id, score: a + 0.8 * t.stakes + noise * (rng() - 0.5) * 2 };
    });
    const count = Math.max(1, Math.round(resources.attentionBudget));
    return new Set(
      scored
        .sort((x, y) => y.score - x.score)
        .slice(0, count)
        .map((s) => s.id),
    );
  };
}

/** 방치돼도 서운함이 덜 쌓이는 정도(0~1): 친화적이고 정서가 안정되고 성실할수록 높다. 가정. */
export function patienceFromTraits(traits: PersonTraits): number {
  return sigmoid(0.9 * traits.agreeableness - 0.7 * traits.neuroticism + 0.3 * traits.conscientiousness);
}

export function temperamentFromTraits(traits: PersonTraits): NpcTemperament {
  return { attend: personalityPolicy(traits), patience: patienceFromTraits(traits) };
}

/** LLM에게 넘길 성격 묘사(영어 형용사 2~4개) — |z| ≥ 0.8인 특성만, 강한 순서로. */
export function describeTraits(traits: PersonTraits): string[] {
  const adjectives: [number, string, string][] = [
    [traits.conscientiousness, 'disciplined, reliable', 'disorganized, impulsive'],
    [traits.neuroticism, 'anxious, easily upset', 'calm, even-tempered'],
    [traits.agreeableness, 'warm, accommodating', 'blunt, combative'],
    [traits.openness, 'curious, restless for new things', 'conventional, set in their ways'],
    [traits.extraversion, 'outgoing, talkative', 'quiet, reserved'],
    [traits.riskTolerance, 'a risk-taker', 'cautious'],
    [traits.financialAnxiety, 'worries a lot about money', 'relaxed about money'],
    [traits.traditionalism, 'traditional about family roles', 'unconventional about family roles'],
  ];
  return adjectives
    .filter(([z]) => Math.abs(z) >= 0.8)
    .sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]))
    .slice(0, 4)
    .map(([z, hi, lo]) => (z > 0 ? hi : lo));
}
