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
