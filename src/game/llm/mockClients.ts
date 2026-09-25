import type {
  MainModelClient,
  RouterModelClient,
  SceneClassifyResponse,
  SceneSummary,
  SceneTurnResponse,
} from './types';

/**
 * WebLLM 연동 전, UI/게임 루프 배선이 실제로 동작하는지 확인하기 위한 임시 규칙 기반 목업.
 * 실제 판단(개연성, 서사 품질, NPC 추출 등)은 전혀 하지 않는다 — 나중에 WebLLM 기반
 * 구현체로 통째로 교체될 자리표시자. 씬 진입도 절대 트리거하지 않는다(제대로 된 판단
 * 없이 대화를 시작하면 오히려 혼란스러우므로).
 */

const SUDDEN_DEATH_CHANCE_PER_SKIP = 1 / 200;
const SUDDEN_DEATH_CAUSES = ['수면 중 심장마비', '교통사고', '뇌졸중'];
/** 실제 라우터라면 서사 판단으로 알아서 detail을 낼 텐데, 목업은 그럴 능력이 없으니
 *  대충 이 확률로 흉내만 낸다 — 안 그러면 "계속하기"가 매번 MAX_CHAINED_SKIPS까지
 *  꽉 채우고서야 멈춰서 데모가 부자연스럽다. */
const RANDOM_DETAIL_CHANCE_ON_SKIP = 0.15;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const mockRouterModel: RouterModelClient = {
  async runRouterTurn({ playerInput }) {
    if (playerInput === null) {
      const suddenDeath =
        Math.random() < SUDDEN_DEATH_CHANCE_PER_SKIP
          ? { cause: SUDDEN_DEATH_CAUSES[randomInt(0, SUDDEN_DEATH_CAUSES.length - 1)] }
          : null;

      if (!suddenDeath && Math.random() < RANDOM_DETAIL_CHANCE_ON_SKIP) {
        return {
          turnType: 'detail',
          intent: { actionType: 'routine', target: undefined, contextTags: ['(자동 진행 중 발생한 사건)'] },
          elapsedMonths: 0,
          newNpcs: [],
          memoryGraphDelta: { newNodes: [], newEdges: [], accessedNodeIds: [] },
        };
      }

      return {
        turnType: 'skip',
        intent: null,
        elapsedMonths: randomInt(1, 6),
        suddenDeath,
        newNpcs: [],
        memoryGraphDelta: { newNodes: [], newEdges: [], accessedNodeIds: [] },
      };
    }

    return {
      turnType: 'detail',
      // 실제 의도 파싱이 없으니, 입력 원문을 contextTags에 그대로 실어서 메인 모델
      // 목업이 무슨 시도였는지 흉내라도 낼 수 있게 한다.
      intent: { actionType: 'routine', target: undefined, contextTags: [playerInput] },
      elapsedMonths: 0,
      newNpcs: [],
      memoryGraphDelta: { newNodes: [], newEdges: [], accessedNodeIds: [] },
    };
  },

  async classifySceneExchange(): Promise<SceneClassifyResponse> {
    return { significance: 'trivial', requiresPlausibilityJudgment: false, trivialReply: '...', sceneEnded: true };
  },

  async summarizeScene(): Promise<SceneSummary> {
    return { narrative: '', elapsedMonths: 0, newNpcs: [], memoryGraphDelta: { newNodes: [], newEdges: [], accessedNodeIds: [] } };
  },
};

export const mockMainModel: MainModelClient = {
  async runDetailTurn({ intent }) {
    const actionText = intent.contextTags[0] ?? '그 일';
    return {
      narrative: `"${actionText}" — (아직 실제 모델이 연결되지 않아 결과를 알 수 없다.)`,
      plausibilityJudgment: { verdict: 'neutral', citedMemoryNodeIds: [], successBias: 'medium' },
      death: null,
    };
  },

  async runSceneTurn(): Promise<SceneTurnResponse> {
    return {
      reply: '...',
      plausibilityJudgment: { verdict: 'neutral', citedMemoryNodeIds: [], successBias: 'medium' },
      sceneEnded: true,
    };
  },
};
