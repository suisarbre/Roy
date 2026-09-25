export type Language = 'ko' | 'en';

export const LANGUAGES: { code: Language; label: string }[] = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
];

interface UiStrings {
  continueButton: string;
  restartButton: string;
  inputPlaceholderAction: string;
  inputPlaceholderScene: string;
}

export const UI_STRINGS: Record<Language, UiStrings> = {
  ko: {
    continueButton: '계속하기',
    restartButton: '다시 시작',
    inputPlaceholderAction: '무엇을 할지',
    inputPlaceholderScene: '무슨 말을 할지',
  },
  en: {
    continueButton: 'Continue',
    restartButton: 'Restart',
    inputPlaceholderAction: 'What will you do',
    inputPlaceholderScene: 'What will you say',
  },
};

/**
 * TODO: 이 함수는 gameLoop.ts에 있던 스킵 서사 템플릿을 언어별로 옮긴 것뿐이다 — 여전히
 * "지금은 템플릿 문구, 나중에 라우터가 맥락 반영해서 직접 생성" TODO는 유효하다.
 */
export function getSkipNarrative(elapsedMonths: number, language: Language): string {
  if (language === 'en') {
    if (elapsedMonths <= 0) return 'Nothing much happened.';
    if (elapsedMonths === 1) return 'A month passed, uneventfully.';
    return `${elapsedMonths} months passed, uneventfully.`;
  }
  if (elapsedMonths <= 0) return '별다른 사건 없이 시간이 흘렀다.';
  if (elapsedMonths === 1) return '그렇게 한 달이 별일 없이 흘렀다.';
  return `그렇게 ${elapsedMonths}개월이 별일 없이 흘렀다.`;
}

export function getDeathText(cause: string, ageAtDeath: number, language: Language): string {
  if (language === 'en') return `${cause}. Died at age ${ageAtDeath}.`;
  return `${cause}로 사망, 향년 ${ageAtDeath}세.`;
}

export function formatStatus(year: number, month: number, ageYears: number, language: Language): string {
  const paddedMonth = String(month).padStart(2, '0');
  if (language === 'en') return `${year}.${paddedMonth} · age ${ageYears}`;
  return `${year}.${paddedMonth} · ${ageYears}세`;
}
