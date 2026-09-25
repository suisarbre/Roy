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
}

export const UI_STRINGS: Record<Language, UiStrings> = {
  ko: { continueButton: '계속하기', restartButton: '다시 시작', inputPlaceholderAction: '무엇을 할지', inputPlaceholderScene: '무슨 말을 할지' },
  en: { continueButton: 'Continue', restartButton: 'Restart', inputPlaceholderAction: 'What will you do', inputPlaceholderScene: 'What will you say' },
  ja: { continueButton: '続ける', restartButton: '最初から', inputPlaceholderAction: '何をするか', inputPlaceholderScene: '何を言うか' },
  'zh-CN': { continueButton: '继续', restartButton: '重新开始', inputPlaceholderAction: '你要做什么', inputPlaceholderScene: '你要说什么' },
  'zh-TW': { continueButton: '繼續', restartButton: '重新開始', inputPlaceholderAction: '你要做什麼', inputPlaceholderScene: '你要說什麼' },
  fr: { continueButton: 'Continuer', restartButton: 'Recommencer', inputPlaceholderAction: 'Que faire', inputPlaceholderScene: 'Que dire' },
  de: { continueButton: 'Weiter', restartButton: 'Neu starten', inputPlaceholderAction: 'Was tun', inputPlaceholderScene: 'Was sagen' },
  es: { continueButton: 'Continuar', restartButton: 'Reiniciar', inputPlaceholderAction: 'Qué hacer', inputPlaceholderScene: 'Qué decir' },
  'pt-BR': { continueButton: 'Continuar', restartButton: 'Reiniciar', inputPlaceholderAction: 'O que fazer', inputPlaceholderScene: 'O que dizer' },
  ru: { continueButton: 'Продолжить', restartButton: 'Начать заново', inputPlaceholderAction: 'Что делать', inputPlaceholderScene: 'Что сказать' },
  it: { continueButton: 'Continua', restartButton: 'Ricomincia', inputPlaceholderAction: 'Cosa fare', inputPlaceholderScene: 'Cosa dire' },
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
