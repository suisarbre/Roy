import type { MentalSymptomTag } from './stats';

/**
 * 개연성 판단이 실제로 상태를 바꾸는 유일한 채널. 메인 모델이 detail 턴/씬의 significant
 * 교환에서 narrative와 함께 산출한다 — "무모한 즉흥은 벌 받고, 준비된 일탈은 보상받는다"는
 * 문서 원칙이 서사 텍스트에서 끝나지 않고 실제 hidden/observable 값을 움직이게 하는 부분.
 *
 * 모델이 절대 수치를 직접 제안한다(사용자 결정) — 작은 모델이 숫자를 과하게 낼 위험은
 * 코드 쪽 클램핑(statImpact.ts의 적용 함수)으로 방어한다.
 */
export interface StatImpact {
  netWorthDelta?: number;
  hiddenDebtDelta?: number;
  /** 0-100 스케일 델타 */
  creditStandingDelta?: number;
  /** 0-100 스케일 델타 */
  stressDelta?: number;
  /** 0-100 스케일 델타 */
  burnoutDelta?: number;
  /** 이 사건이 특정 NPC와의 관계에 준 영향. target이 없으면(범용 사건) 무시. */
  relationshipDelta?: {
    npcId: string;
    trustDelta?: number;
    affectionDelta?: number;
    resentmentDelta?: number;
  };
  /** 이번 사건으로 새로 생긴 잠복 만성질환 (아직 미진단) */
  newChronicSeed?: { label: string; severity: number };
  /** 기존 질병 진행에 준 충격 — 질병 id -> 델타(음수면 치료/호전) */
  diseaseProgressDelta?: Record<string, number>;
  /** 이번 사건으로 겉으로 드러난 정신건강 증상 — observable에 바로 반영된다. 병원 방문 같은
   *  "확인" 행동이 필요 없다: 증상은 서사를 통해 저절로 드러난다는 문서 설계 그대로. */
  newVisibleSymptom?: MentalSymptomTag;
}
