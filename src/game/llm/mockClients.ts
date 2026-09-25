import type { Language } from '../../i18n';
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
 *
 * 팩토리 함수인 이유: 서사 문구가 언어 설정을 따라야 해서 language를 클로저로 받는다.
 */

const SUDDEN_DEATH_CHANCE_PER_SKIP = 1 / 200;
const SUDDEN_DEATH_CAUSES: Record<Language, string[]> = {
  ko: ['수면 중 심장마비', '교통사고', '뇌졸중'],
  en: ['A heart attack in his sleep', 'A car accident', 'A stroke'],
  ja: ['睡眠中の心臓発作', '交通事故', '脳卒中'],
  'zh-CN': ['睡梦中突发心脏病', '交通事故', '中风'],
  'zh-TW': ['睡夢中突發心臟病', '交通事故', '中風'],
  fr: ['Une crise cardiaque dans son sommeil', 'Un accident de voiture', 'Un AVC'],
  de: ['Ein Herzinfarkt im Schlaf', 'Ein Autounfall', 'Ein Schlaganfall'],
  es: ['Un infarto mientras dormía', 'Un accidente de coche', 'Un derrame cerebral'],
  'pt-BR': ['Um infarto durante o sono', 'Um acidente de carro', 'Um derrame'],
  ru: ['Сердечный приступ во сне', 'Автомобильная авария', 'Инсульт'],
  it: ["Un infarto nel sonno", "Un incidente d'auto", 'Un ictus'],
};
/** 실제 라우터라면 서사 판단으로 알아서 detail을 낼 텐데, 목업은 그럴 능력이 없으니
 *  대충 이 확률로 흉내만 낸다 — 안 그러면 "계속하기"가 매번 MAX_CHAINED_SKIPS까지
 *  꽉 채우고서야 멈춰서 데모가 부자연스럽다. */
const RANDOM_DETAIL_CHANCE_ON_SKIP = 0.15;
const AUTO_EVENT_TAG: Record<Language, string> = {
  ko: '(자동 진행 중 발생한 사건)',
  en: '(something that happened while time passed)',
  ja: '(時間が流れる中で起きた出来事)',
  'zh-CN': '(时间流逝中发生的事)',
  'zh-TW': '(時間流逝中發生的事)',
  fr: "(quelque chose qui s'est passé avec le temps)",
  de: '(etwas, das mit der Zeit geschah)',
  es: '(algo que ocurrió con el paso del tiempo)',
  'pt-BR': '(algo que aconteceu com o passar do tempo)',
  ru: '(что-то, что произошло за это время)',
  it: '(qualcosa accaduto col passare del tempo)',
};
const PLACEHOLDER_ACTION: Record<Language, string> = {
  ko: '그 일',
  en: 'that',
  ja: 'それ',
  'zh-CN': '那件事',
  'zh-TW': '那件事',
  fr: 'cela',
  de: 'das',
  es: 'eso',
  'pt-BR': 'isso',
  ru: 'это',
  it: 'quello',
};
const PLACEHOLDER_RESULT_SUFFIX: Record<Language, (action: string) => string> = {
  ko: (action) => `"${action}" — (아직 실제 모델이 연결되지 않아 결과를 알 수 없다.)`,
  en: (action) => `"${action}" — (no real model is connected yet, so the outcome is unknown.)`,
  ja: (action) => `「${action}」 — （まだ実際のモデルが接続されていないため、結果は分からない。）`,
  'zh-CN': (action) => `"${action}" — （尚未连接真实模型，结果未知。）`,
  'zh-TW': (action) => `"${action}" — （尚未連接真實模型，結果未知。）`,
  fr: (action) => `« ${action} » — (aucun modèle réel n'est encore connecté, le résultat est inconnu.)`,
  de: (action) => `„${action}“ — (noch ist kein echtes Modell verbunden, das Ergebnis ist unbekannt.)`,
  es: (action) => `"${action}" — (aún no hay un modelo real conectado, el resultado es desconocido.)`,
  'pt-BR': (action) => `"${action}" — (ainda não há um modelo real conectado, o resultado é desconhecido.)`,
  ru: (action) => `«${action}» — (реальная модель ещё не подключена, результат неизвестен.)`,
  it: (action) => `"${action}" — (nessun modello reale è ancora connesso, l'esito è sconosciuto.)`,
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createMockRouterModel(language: Language): RouterModelClient {
  return {
    async runRouterTurn({ playerInput }) {
      if (playerInput === null) {
        const causes = SUDDEN_DEATH_CAUSES[language];
        const suddenDeath =
          Math.random() < SUDDEN_DEATH_CHANCE_PER_SKIP ? { cause: causes[randomInt(0, causes.length - 1)] } : null;

        if (!suddenDeath && Math.random() < RANDOM_DETAIL_CHANCE_ON_SKIP) {
          return {
            turnType: 'detail',
            intent: { actionType: 'routine', target: undefined, contextTags: [AUTO_EVENT_TAG[language]] },
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
}

export function createMockMainModel(language: Language): MainModelClient {
  return {
    async runDetailTurn({ intent }) {
      const actionText = intent.contextTags[0] ?? PLACEHOLDER_ACTION[language];
      return {
        narrative: PLACEHOLDER_RESULT_SUFFIX[language](actionText),
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
}
