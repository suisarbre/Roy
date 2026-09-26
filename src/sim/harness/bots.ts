import { domainPriorityPolicy, randomPolicy, type PolicyBot } from '../attend';

/**
 * 정책 봇 — 매달 어떤 실타래를 attend할지 결정한다. "플레이어"의 자리에 LLM 대신 넣는
 * 단순 규칙. 무작위/일중독/가정적 세 가지로 서로 다른 삶의 궤적이 나오는지도 하네스가
 * 같이 확인한다(예: 일중독 봇은 이혼율이 더 높게 나와야 그럴듯하다).
 *
 * 실제 배분 로직(PolicyBot 타입, randomPolicy, domainPriorityPolicy)은 sim/attend.ts로
 * 옮겨서 npc/와도 공유한다 — 여기 남은 건 하네스 전용 정책(구체적 도메인 우선순위) 3개뿐.
 */
export type { PolicyBot };

export const workaholicPolicy: PolicyBot = domainPriorityPolicy(['work', 'livelihood', 'dreams']);

export const familyOrientedPolicy: PolicyBot = domainPriorityPolicy(['relationships', 'familyDuty', 'dwelling']);

export const POLICY_BOTS: Readonly<Record<string, PolicyBot>> = {
  random: randomPolicy,
  workaholic: workaholicPolicy,
  familyOriented: familyOrientedPolicy,
};
