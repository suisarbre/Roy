import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language } from './i18n';

interface SettingsStore {
  language: Language;
  setLanguage: (language: Language) => void;
}

/** 게임 상태(GameState)와는 별개다 — 이건 저장 파일에 안 들어가는 순수 UI 취향 설정이라
 *  localStorage에 직접 저장한다 (Artifact 캔버스가 아니라 실제 배포되는 앱이라 일반적인
 *  localStorage 사용이 적절하다). */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      language: 'ko',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'roy-settings' },
  ),
);
