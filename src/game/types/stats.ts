import type { GameDate } from './time';

export type RelationshipId = string; // NpcId 참조

export type ContactFrequency = 'frequent' | 'occasional' | 'rare' | 'none';

export interface HealthCheckupSummary {
  /** 검진 결과 요약 텍스트. 실제 진행도(hidden)와 다를 수 있다 — 오래된 검진일수록 신뢰도 낮음. */
  summary: string;
  flaggedConcerns: string[];
}

export type MentalSymptomTag =
  | 'insomnia'
  | 'irritability'
  | 'fatigue'
  | 'appetiteChange'
  | 'lossOfInterest'
  | 'panicEpisode';

/**
 * 플레이어가 직접 보는 값. 행동(병원 방문, 가계부 확인 등)을 해야만 갱신된다.
 * 마지막 갱신 시점이 지날수록 hidden 값과의 괴리가 커질 수 있다.
 */
export interface ObservableStats {
  finance: {
    cashOnHand: number;
    lastStatementBalance: number;
    lastStatementDate: GameDate | null;
  };
  health: {
    lastCheckup: HealthCheckupSummary | null;
    lastCheckupDate: GameDate | null;
  };
  relationships: Record<
    RelationshipId,
    {
      contactFrequency: ContactFrequency;
      lastContactDate: GameDate | null;
    }
  >;
  mentalHealth: {
    /** 수치 없음 — 서사에서 암시되는 증상 태그만 노출 */
    visibleSymptoms: MentalSymptomTag[];
  };
}

export type DiseaseId = string;

export interface ChronicConditionSeed {
  id: string;
  label: string; // 내부용 설명 (예: "고혈압 전단계")
  severity: number; // 0-100, 아직 미진단
  diagnosed: boolean;
}

/**
 * 실제 숨겨진 값. 플레이어 입력과 무관하게 매 턴 계속 변화한다.
 * 절대 UI에 직접 노출하지 않는다 — observable을 통해서만 간접적으로 드러난다.
 *
 * 중요: 이 수치들은 LLM에게 넘기는 "참고 힌트"일 뿐, 게임 로직이 임계값으로
 * 직접 분기해서 이벤트를 강제 발생시키는 용도가 아니다 (예: `stress > 80`이면
 * 번아웃 이벤트를 코드가 강제 트리거하는 식의 규칙 기반 처리는 하지 않는다).
 * 실제 판단(증상 발현 여부, 개연성 등)은 항상 LLM이 로그+그래프 맥락을 보고
 * 즉석에서 내린다 — 문서 원칙 "준비도를 별도 수치 시스템으로 관리하지 않는다"를
 * 지키기 위함. 숫자는 그 즉석 판단이 매 플레이마다 크게 튀지 않도록 잡아주는
 * 느슨한 앵커 역할에 그친다.
 */
export interface HiddenStats {
  finance: {
    netWorth: number;
    hiddenDebt: number;
    creditStanding: number; // 0-100
  };
  health: {
    diseaseProgress: Record<DiseaseId, number>; // 0-100
    chronicSeeds: ChronicConditionSeed[];
  };
  relationships: Record<
    RelationshipId,
    {
      accumulatedResentment: number;
      trust: number; // 0-100
      affection: number; // 0-100
    }
  >;
  mentalHealth: {
    stressAccumulation: number; // 0-100+
    burnoutLevel: number; // 0-100
  };
}
