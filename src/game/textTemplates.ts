import type { Language } from '../i18n';

/**
 * 급사는 "예고 없이 갑자기" 일어나는 사건이라는 정의 자체가, 문서 원칙("사인+나이만,
 * 부연설명 없음")과 맞물려 LLM이 서술할 이유가 없다 — 코드가 확률을 굴리고(gameLoop.ts)
 * 원인도 여기 템플릿 풀에서 직접 뽑는다. 모델 호출 0회.
 */
export const SUDDEN_DEATH_CAUSES: Record<Language, string[]> = {
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

/** 모델이 새 만성질환 시드에 라벨(note)을 안 붙였을 때 쓰는 언어별 기본값. */
export const GENERIC_CHRONIC_LABEL: Record<Language, string> = {
  ko: '원인이 뚜렷하지 않은 만성 증상',
  en: 'A vague, unnamed chronic condition',
  ja: '原因不明の慢性的な不調',
  'zh-CN': '一种原因不明的慢性症状',
  'zh-TW': '一種原因不明的慢性症狀',
  fr: 'Un trouble chronique sans cause précise',
  de: 'Ein chronisches Leiden ohne klare Ursache',
  es: 'Una afección crónica sin causa clara',
  'pt-BR': 'Uma condição crônica sem causa clara',
  ru: 'Хроническое недомогание неясного происхождения',
  it: 'Un disturbo cronico di origine poco chiara',
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickRandomSuddenDeathCause(language: Language): string {
  const causes = SUDDEN_DEATH_CAUSES[language];
  return causes[randomInt(0, causes.length - 1)];
}
