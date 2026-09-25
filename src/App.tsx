import { useEffect, useRef, useState, type FormEvent } from 'react';
import { mockMainModel, mockRouterModel } from './game/llm/mockClients';
import { useGameStore } from './game/store';
import type { GameLoopDeps } from './game/gameLoop';

const deps: GameLoopDeps = { routerModel: mockRouterModel, mainModel: mockMainModel };

function App() {
  const { state, isProcessingTurn, submitTurn, resetGame } = useGameStore();
  const [input, setInput] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

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

  if (state.status === 'dead' && state.deathInfo) {
    return (
      <div className="terminal">
        <div className="log">
          {state.log.map((entry) => (
            <LogEntryView key={entry.turnIndex} narrative={entry.narrative} playerInput={entry.playerInput} />
          ))}
          <div className="death">
            {state.deathInfo.cause}(으)로 사망. 향년 {state.deathInfo.ageAtDeath}세.
          </div>
          <div ref={logEndRef} />
        </div>
        <button type="button" className="restart" onClick={resetGame}>
          다시 시작
        </button>
      </div>
    );
  }

  return (
    <div className="terminal">
      <div className="status">
        {state.clock.date.year}.{String(state.clock.date.month).padStart(2, '0')} · {state.clock.ageYears}세
      </div>

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
          placeholder={state.activeScene ? '무슨 말을 할지' : '무엇을 할지'}
        />
        {!state.activeScene && (
          <button type="button" onClick={handleContinue} disabled={isProcessingTurn}>
            계속하기
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
