import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createMockMainModel, createMockRouterModel } from './game/llm/mockClients';
import { useGameStore } from './game/store';
import type { GameLoopDeps } from './game/gameLoop';
import { formatStatus, getDeathText, LANGUAGES, UI_STRINGS } from './i18n';
import { useSettingsStore } from './settingsStore';

function App() {
  const { state, isProcessingTurn, submitTurn, resetGame } = useGameStore();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const [input, setInput] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  // 목업 클라이언트는 언어 설정을 클로저로 받으므로, 언어가 바뀌면 다시 만들어야 한다.
  // 실제 WebLLM으로 교체될 때도 이 자리(deps 구성)만 바뀌면 된다.
  const deps: GameLoopDeps = useMemo(
    () => ({ routerModel: createMockRouterModel(language), mainModel: createMockMainModel(language), language }),
    [language],
  );

  const strings = UI_STRINGS[language];
  const exchangeCount = state.activeScene?.exchanges.length ?? 0;
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [state.log.length, exchangeCount, state.status]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isProcessingTurn) return;
    setInput('');
    void submitTurn(trimmed, deps);
  };

  const handleContinue = () => {
    if (isProcessingTurn) return;
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
        {isProcessingTurn && <div className="pending">…</div>}
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
