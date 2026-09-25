export type Language = 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW' | 'fr' | 'de' | 'es' | 'pt-BR' | 'ru' | 'it';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'pt-BR', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'it', label: 'Italiano' },
];

interface UiStrings {
  continueButton: string;
  restartButton: string;
  inputPlaceholderAction: string;
  inputPlaceholderScene: string;
  modelLoadingTitle: string;
  modelLoadingHint: string;
  modelErrorWebgpu: string;
  modelErrorGeneric: string;
  modelRetryButton: string;
}

export const UI_STRINGS: Record<Language, UiStrings> = {
  ko: {
    continueButton: '계속하기',
    restartButton: '다시 시작',
    inputPlaceholderAction: '무엇을 할지',
    inputPlaceholderScene: '무슨 말을 할지',
    modelLoadingTitle: '모델을 불러오는 중…',
    modelLoadingHint: '처음 실행 시 수 기가바이트를 내려받습니다. WebGPU를 지원하는 최신 브라우저(Chrome, Edge 등)가 필요합니다.',
    modelErrorWebgpu: '이 브라우저/환경은 WebGPU를 지원하지 않습니다. 최신 데스크톱 Chrome 또는 Edge에서 열어 주세요.',
    modelErrorGeneric: '모델을 불러오는 데 실패했습니다.',
    modelRetryButton: '다시 시도',
  },
  en: {
    continueButton: 'Continue',
    restartButton: 'Restart',
    inputPlaceholderAction: 'What will you do',
    inputPlaceholderScene: 'What will you say',
    modelLoadingTitle: 'Loading the model…',
    modelLoadingHint: 'The first run downloads several gigabytes. Requires a browser with WebGPU support (recent Chrome or Edge).',
    modelErrorWebgpu: "This browser/environment doesn't support WebGPU. Please open this in a recent desktop Chrome or Edge.",
    modelErrorGeneric: 'Failed to load the model.',
    modelRetryButton: 'Retry',
  },
  ja: {
    continueButton: '続ける',
    restartButton: '最初から',
    inputPlaceholderAction: '何をするか',
    inputPlaceholderScene: '何を言うか',
    modelLoadingTitle: 'モデルを読み込み中…',
    modelLoadingHint: '初回起動時は数ギガバイトをダウンロードします。WebGPU対応の最新ブラウザ(Chrome、Edgeなど)が必要です。',
    modelErrorWebgpu: 'このブラウザ/環境はWebGPUに対応していません。最新のデスクトップ版Chrome/Edgeで開いてください。',
    modelErrorGeneric: 'モデルの読み込みに失敗しました。',
    modelRetryButton: '再試行',
  },
  'zh-CN': {
    continueButton: '继续',
    restartButton: '重新开始',
    inputPlaceholderAction: '你要做什么',
    inputPlaceholderScene: '你要说什么',
    modelLoadingTitle: '正在加载模型…',
    modelLoadingHint: '首次运行需要下载数 GB 数据。需要支持 WebGPU 的最新浏览器(如 Chrome、Edge)。',
    modelErrorWebgpu: '此浏览器/环境不支持 WebGPU。请使用最新版桌面 Chrome 或 Edge 打开。',
    modelErrorGeneric: '模型加载失败。',
    modelRetryButton: '重试',
  },
  'zh-TW': {
    continueButton: '繼續',
    restartButton: '重新開始',
    inputPlaceholderAction: '你要做什麼',
    inputPlaceholderScene: '你要說什麼',
    modelLoadingTitle: '正在載入模型…',
    modelLoadingHint: '首次執行需下載數 GB 資料。需要支援 WebGPU 的最新瀏覽器(如 Chrome、Edge)。',
    modelErrorWebgpu: '此瀏覽器/環境不支援 WebGPU。請使用最新版桌面 Chrome 或 Edge 開啟。',
    modelErrorGeneric: '模型載入失敗。',
    modelRetryButton: '重試',
  },
  fr: {
    continueButton: 'Continuer',
    restartButton: 'Recommencer',
    inputPlaceholderAction: 'Que faire',
    inputPlaceholderScene: 'Que dire',
    modelLoadingTitle: 'Chargement du modèle…',
    modelLoadingHint:
      'Le premier lancement télécharge plusieurs gigaoctets. Nécessite un navigateur compatible WebGPU (Chrome ou Edge récent).',
    modelErrorWebgpu:
      "Ce navigateur/environnement ne prend pas en charge WebGPU. Veuillez l'ouvrir avec une version récente de Chrome ou Edge sur ordinateur.",
    modelErrorGeneric: 'Échec du chargement du modèle.',
    modelRetryButton: 'Réessayer',
  },
  de: {
    continueButton: 'Weiter',
    restartButton: 'Neu starten',
    inputPlaceholderAction: 'Was tun',
    inputPlaceholderScene: 'Was sagen',
    modelLoadingTitle: 'Modell wird geladen…',
    modelLoadingHint:
      'Beim ersten Start werden mehrere Gigabyte heruntergeladen. Erfordert einen Browser mit WebGPU-Unterstützung (aktuelles Chrome oder Edge).',
    modelErrorWebgpu: 'Dieser Browser/diese Umgebung unterstützt WebGPU nicht. Bitte mit einer aktuellen Desktop-Version von Chrome oder Edge öffnen.',
    modelErrorGeneric: 'Laden des Modells fehlgeschlagen.',
    modelRetryButton: 'Erneut versuchen',
  },
  es: {
    continueButton: 'Continuar',
    restartButton: 'Reiniciar',
    inputPlaceholderAction: 'Qué hacer',
    inputPlaceholderScene: 'Qué decir',
    modelLoadingTitle: 'Cargando el modelo…',
    modelLoadingHint:
      'La primera ejecución descarga varios gigabytes. Requiere un navegador compatible con WebGPU (Chrome o Edge recientes).',
    modelErrorWebgpu: 'Este navegador/entorno no admite WebGPU. Ábrelo en una versión reciente de escritorio de Chrome o Edge.',
    modelErrorGeneric: 'No se pudo cargar el modelo.',
    modelRetryButton: 'Reintentar',
  },
  'pt-BR': {
    continueButton: 'Continuar',
    restartButton: 'Reiniciar',
    inputPlaceholderAction: 'O que fazer',
    inputPlaceholderScene: 'O que dizer',
    modelLoadingTitle: 'Carregando o modelo…',
    modelLoadingHint:
      'A primeira execução baixa vários gigabytes. Requer um navegador compatível com WebGPU (Chrome ou Edge recentes).',
    modelErrorWebgpu: 'Este navegador/ambiente não é compatível com WebGPU. Abra em uma versão recente do Chrome ou Edge para desktop.',
    modelErrorGeneric: 'Falha ao carregar o modelo.',
    modelRetryButton: 'Tentar novamente',
  },
  ru: {
    continueButton: 'Продолжить',
    restartButton: 'Начать заново',
    inputPlaceholderAction: 'Что делать',
    inputPlaceholderScene: 'Что сказать',
    modelLoadingTitle: 'Загрузка модели…',
    modelLoadingHint:
      'При первом запуске загружается несколько гигабайт. Требуется браузер с поддержкой WebGPU (последние версии Chrome или Edge).',
    modelErrorWebgpu: 'Этот браузер/среда не поддерживает WebGPU. Откройте в последней версии Chrome или Edge для компьютера.',
    modelErrorGeneric: 'Не удалось загрузить модель.',
    modelRetryButton: 'Повторить',
  },
  it: {
    continueButton: 'Continua',
    restartButton: 'Ricomincia',
    inputPlaceholderAction: 'Cosa fare',
    inputPlaceholderScene: 'Cosa dire',
    modelLoadingTitle: 'Caricamento del modello…',
    modelLoadingHint:
      'Al primo avvio vengono scaricati diversi gigabyte. Richiede un browser con supporto WebGPU (Chrome o Edge recenti).',
    modelErrorWebgpu: 'Questo browser/ambiente non supporta WebGPU. Aprilo con una versione desktop recente di Chrome o Edge.',
    modelErrorGeneric: 'Impossibile caricare il modello.',
    modelRetryButton: 'Riprova',
  },
};

/** 러시아어는 숫자에 따라 명사 어미가 바뀐다(1/2-4/5+) — 개월 수, 나이 표시 둘 다에 쓴다. */
function ruPlural(n: number, forms: [one: string, few: string, many: string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

interface SkipNarrativeStrings {
  none: string;
  one: string;
  many: (months: number) => string;
}

/**
 * TODO: 여기 있는 문구들은 gameLoop.ts에 있던 스킵 서사 템플릿을 언어별로 옮긴 것뿐이다 —
 * "지금은 템플릿 문구, 나중에 라우터가 맥락 반영해서 직접 생성" TODO는 여전히 유효하다.
 */
const SKIP_NARRATIVE: Record<Language, SkipNarrativeStrings> = {
  ko: { none: '별다른 사건 없이 시간이 흘렀다.', one: '그렇게 한 달이 별일 없이 흘렀다.', many: (n) => `그렇게 ${n}개월이 별일 없이 흘렀다.` },
  en: { none: 'Nothing much happened.', one: 'A month passed, uneventfully.', many: (n) => `${n} months passed, uneventfully.` },
  ja: { none: '特に何も起きなかった。', one: '特に何もないまま、ひと月が過ぎた。', many: (n) => `特に何もないまま、${n}か月が過ぎた。` },
  'zh-CN': { none: '什么都没发生。', one: '平静地过了一个月。', many: (n) => `平静地过了${n}个月。` },
  'zh-TW': { none: '什麼都沒發生。', one: '平靜地過了一個月。', many: (n) => `平靜地過了${n}個月。` },
  fr: { none: "Rien de particulier ne s'est passé.", one: "Un mois s'est écoulé sans incident.", many: (n) => `${n} mois se sont écoulés sans incident.` },
  de: { none: 'Es ist nichts Besonderes passiert.', one: 'Ein Monat verging ereignislos.', many: (n) => `${n} Monate vergingen ereignislos.` },
  es: { none: 'No pasó nada en particular.', one: 'Pasó un mes sin incidentes.', many: (n) => `Pasaron ${n} meses sin incidentes.` },
  'pt-BR': { none: 'Nada de especial aconteceu.', one: 'Um mês se passou sem incidentes.', many: (n) => `${n} meses se passaram sem incidentes.` },
  ru: {
    none: 'Ничего особенного не произошло.',
    one: 'Прошёл месяц, ничем не примечательный.',
    many: (n) => `Прошло ${n} ${ruPlural(n, ['месяц', 'месяца', 'месяцев'])}, ничем не примечательных.`,
  },
  it: { none: 'Non è successo nulla di particolare.', one: 'È passato un mese senza eventi.', many: (n) => `Sono passati ${n} mesi senza eventi.` },
};

export function getSkipNarrative(elapsedMonths: number, language: Language): string {
  const strings = SKIP_NARRATIVE[language];
  if (elapsedMonths <= 0) return strings.none;
  if (elapsedMonths === 1) return strings.one;
  return strings.many(elapsedMonths);
}

const DEATH_TEXT: Record<Language, (cause: string, age: number) => string> = {
  ko: (cause, age) => `${cause}로 사망, 향년 ${age}세.`,
  en: (cause, age) => `${cause}. Died at age ${age}.`,
  ja: (cause, age) => `${cause}。享年${age}歳。`,
  'zh-CN': (cause, age) => `${cause}。享年${age}岁。`,
  'zh-TW': (cause, age) => `${cause}。享年${age}歲。`,
  fr: (cause, age) => `${cause}. Mort à l'âge de ${age} ans.`,
  de: (cause, age) => `${cause}. Gestorben im Alter von ${age} Jahren.`,
  es: (cause, age) => `${cause}. Murió a los ${age} años.`,
  'pt-BR': (cause, age) => `${cause}. Morreu aos ${age} anos.`,
  ru: (cause, age) => `${cause}. Умер в возрасте ${age} ${ruPlural(age, ['года', 'лет', 'лет'])}.`,
  it: (cause, age) => `${cause}. Morto all'età di ${age} anni.`,
};

export function getDeathText(cause: string, ageAtDeath: number, language: Language): string {
  return DEATH_TEXT[language](cause, ageAtDeath);
}

const STATUS_FORMAT: Record<Language, (year: number, month: string, age: number) => string> = {
  ko: (year, month, age) => `${year}.${month} · ${age}세`,
  en: (year, month, age) => `${year}.${month} · age ${age}`,
  ja: (year, month, age) => `${year}.${month} · ${age}歳`,
  'zh-CN': (year, month, age) => `${year}.${month} · ${age}岁`,
  'zh-TW': (year, month, age) => `${year}.${month} · ${age}歲`,
  fr: (year, month, age) => `${year}.${month} · ${age} ans`,
  de: (year, month, age) => `${year}.${month} · ${age} Jahre`,
  es: (year, month, age) => `${year}.${month} · ${age} años`,
  'pt-BR': (year, month, age) => `${year}.${month} · ${age} anos`,
  ru: (year, month, age) => `${year}.${month} · ${age} ${ruPlural(age, ['год', 'года', 'лет'])}`,
  it: (year, month, age) => `${year}.${month} · ${age} anni`,
};

export function formatStatus(year: number, month: number, ageYears: number, language: Language): string {
  return STATUS_FORMAT[language](year, String(month).padStart(2, '0'), ageYears);
}
