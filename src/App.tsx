import type { MLCEngine } from '@mlc-ai/web-llm';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { EngineLoadProgress } from './game/llm/engine';
import { loadSharedEngine } from './game/llm/engine';
import { createWebLLMModel } from './game/llm/webllmClients';
import { useGameStore } from './game/store';
import type { GameLoopDeps } from './game/gameLoop';
import { formatStatus, getDeathText, LANGUAGES, UI_STRINGS } from './i18n';
import { useSettingsStore } from './settingsStore';

interface EngineState {
  status: 'loading' | 'ready' | 'error';
  engine: MLCEngine | null;
  progress: EngineLoadProgress | null;
  error: Error | null;
}

const INITIAL_ENGINE_STATE: EngineState = { status: 'loading', engine: null, progress: null, error: null };

function App() {
  const { state, isProcessingTurn, submitTurn, resetGame, streamingNarrative, setStreamingNarrative } = useGameStore();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const [input, setInput] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // 엔진(모델 가중치)은 언어와 무관하게 한 번만 로드한다 — deps 쪽(WebLLM 클라이언트)만
  // 언어가 바뀔 때 다시 만들면 된다(프롬프트 언어 지시문만 갈아끼우는 것이므로 비용이 없다).
  const [engineState, setEngineState] = useState<EngineState>(INITIAL_ENGINE_STATE);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setEngineState(INITIAL_ENGINE_STATE);
    loadSharedEngine((report) => {
      if (!cancelled) setEngineState((prev) => ({ ...prev, progress: report }));
    })
      .then((engine) => {
        if (cancelled) return;
        setEngineState({ status: 'ready', engine, progress: null, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setEngineState({
          status: 'error',
          engine: null,
          progress: null,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const deps: GameLoopDeps | null = useMemo(() => {
    if (!engineState.engine) return null;
    const engine = engineState.engine;
    return {
      model: createWebLLMModel(engine, language, setStreamingNarrative),
      language,
    };
  }, [language, engineState.engine, setStreamingNarrative]);

  const strings = UI_STRINGS[language];
  const exchangeCount = state.activeScene?.exchanges.length ?? 0;
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [state.log.length, exchangeCount, state.status]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isProcessingTurn || !deps) return;
    setInput('');
    void submitTurn(trimmed, deps);
  };

  const handleContinue = () => {
    if (isProcessingTurn || !deps) return;
    void submitTurn(null, deps);
  };

  const languageSwitcher = (
    <div className="language-switcher">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          className={code === language ? 'active' : ''}
          onClick={() => setLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  if (engineState.status !== 'ready') {
    return (
      <div className="terminal">
        {languageSwitcher}
        <div className="model-loading">
          <div className="model-loading-title">
            {engineState.status === 'error' ? strings.modelErrorGeneric : strings.modelLoadingTitle}
          </div>
          {engineState.status === 'loading' && (
            <>
              <div className="model-loading-bar">
                <div
                  className="model-loading-bar-fill"
                  style={{ width: `${Math.round((engineState.progress?.progress ?? 0) * 100)}%` }}
                />
              </div>
              <div className="model-loading-detail">{engineState.progress?.text ?? ''}</div>
              <div className="model-loading-hint">{strings.modelLoadingHint}</div>
            </>
          )}
          {engineState.status === 'error' && (
            <>
              <div className="model-loading-detail">
                {engineState.error?.message === 'WebGPU_UNAVAILABLE' ? strings.modelErrorWebgpu : engineState.error?.message}
              </div>
              <button type="button" className="restart" onClick={() => setReloadToken((n) => n + 1)}>
                {strings.modelRetryButton}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (state.status === 'dead' && state.deathInfo) {
    return (
      <div className="terminal">
        {languageSwitcher}
        <div className="log">
          {state.log.map((entry) => (
            <LogEntryView key={entry.turnIndex} narrative={entry.narrative} playerInput={entry.playerInput} />
          ))}
          <div className="death">{getDeathText(state.deathInfo.cause, state.deathInfo.ageAtDeath, language)}</div>
          <div ref={logEndRef} />
        </div>
        <button type="button" className="restart" onClick={resetGame}>
          {strings.restartButton}
        </button>
      </div>
    );
  }

  return (
    <div className="terminal">
      {languageSwitcher}
      <div className="status">{formatStatus(state.clock.date.year, state.clock.date.month, state.clock.ageYears, language)}</div>

      <div className="log">
        {state.log.map((entry) => (
          <LogEntryView key={entry.turnIndex} narrative={entry.narrative} playerInput={entry.playerInput} />
        ))}
        {state.activeScene?.exchanges.map((exchange) => (
          <LogEntryView key={`scene-${exchange.index}`} narrative={exchange.reply} playerInput={exchange.playerInput} />
        ))}
        {isProcessingTurn && (
          <div className="entry pending">
            <div className="narrative streaming">{streamingNarrative || '…'}</div>
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      <form className="input-row" onSubmit={handleSubmit}>
        <span className="prompt">&gt;</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isProcessingTurn}
          autoFocus
          placeholder={state.activeScene ? strings.inputPlaceholderScene : strings.inputPlaceholderAction}
        />
        {!state.activeScene && (
          <button type="button" onClick={handleContinue} disabled={isProcessingTurn}>
            {strings.continueButton}
          </button>
        )}
      </form>
    </div>
  );
}

function LogEntryView({ narrative, playerInput }: { narrative: string; playerInput?: string }) {
  return (
    <div className="entry">
      {playerInput && <div className="player-input">&gt; {playerInput}</div>}
      <div className="narrative">{narrative}</div>
    </div>
  );
}

export default App;
