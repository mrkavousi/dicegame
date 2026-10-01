import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { SoundProvider } from '../src/hooks/useSound.jsx';
import { TIMINGS } from '../src/hooks/useGame.js';
import { createGame } from '../src/utils/gameLogic.js';

const dice = vi.hoisted(() => ({ queue: [] }));

vi.mock('../src/utils/random.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rollDie: () => (dice.queue.length > 0 ? dice.queue.shift() : 6) };
});

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });
const mountApp = () =>
  render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
const rollButton = () => screen.getByRole('button', { name: /^roll dice/i });
const bankButton = () => screen.getByRole('button', { name: /^(bank points|bank & win)/i });
const turnName = () => document.querySelector('.board__turn-name').textContent;

function roll(face) {
  dice.queue.push(face);
  fireEvent.click(rollButton());
  advance(TIMINGS.roll + 40);
}

/** Resume a saved game in which Alex is about to win. */
function seedNearWin(config) {
  const base = createGame({ playerNames: ['Alex', 'Sam'], config });
  const state = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, score: 95 } : p)) };
  window.localStorage.setItem('pig.game.v1', JSON.stringify(state));
}

beforeEach(() => {
  dice.queue = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('undo', () => {
  function startAndBank() {
    mountApp();
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));
    roll(6);
    fireEvent.click(bankButton());
  }

  it('takes back the last bank', () => {
    startAndBank();
    expect(screen.getByLabelText('Player 1, 6 points')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /undo last bank/i }));
    expect(screen.getByLabelText('Player 1, 0 points')).toBeInTheDocument();
    expect(screen.getByLabelText('Turn score 6')).toBeInTheDocument();
    expect(turnName()).toBe("Player 1's turn");
    // The cancelled hand-over timer must not fire later.
    advance(TIMINGS.bankPause + 500);
    expect(turnName()).toBe("Player 1's turn");
    expect(screen.queryByRole('button', { name: /undo last bank/i })).toBeNull();
  });

  it('works with the U key', () => {
    startAndBank();
    fireEvent.keyDown(window, { key: 'u' });
    expect(screen.getByLabelText('Player 1, 0 points')).toBeInTheDocument();
  });

  it('is gone once the next player rolls', () => {
    startAndBank();
    advance(TIMINGS.bankPause + 40);
    roll(3);
    expect(screen.queryByRole('button', { name: /undo last bank/i })).toBeNull();
  });

  it('is not offered when a computer is playing', () => {
    mountApp();
    fireEvent.change(screen.getByLabelText('Player 2 type'), { target: { value: 'easy' } });
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));
    roll(6);
    fireEvent.click(bankButton());
    expect(screen.queryByRole('button', { name: /undo last bank/i })).toBeNull();
  });
});

describe('best-of series', () => {
  it('shows the series score and offers the next game', () => {
    mountApp();
    fireEvent.click(screen.getByRole('radio', { name: 'Best of 3' }));
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));
    expect(screen.getByText(/Best of 3 · Game 1/)).toBeInTheDocument();
  });

  it('carries the score into game 2 and rotates the first player', () => {
    seedNearWin({ seriesLength: 3 });
    mountApp();
    roll(6);
    fireEvent.click(bankButton());
    advance(TIMINGS.winReveal + 100);

    expect(screen.getByRole('heading', { name: 'Alex wins!' })).toBeInTheDocument();
    expect(screen.getByLabelText('Series score')).toHaveTextContent('Alex 1 – Sam 0');
    fireEvent.click(screen.getByRole('button', { name: 'Next game' }));

    expect(screen.getByText(/Game 2 · Alex 1 – Sam 0/)).toBeInTheDocument();
    expect(turnName()).toBe("Sam's turn");
    expect(screen.getByLabelText('Alex, 0 points')).toBeInTheDocument();
  });

  it('a single game ends with "Play again"', () => {
    seedNearWin();
    mountApp();
    roll(6);
    fireEvent.click(bankButton());
    advance(TIMINGS.winReveal + 100);
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument();
  });
});

describe('stats modal', () => {
  it('is empty at first', () => {
    mountApp();
    fireEvent.click(screen.getByRole('button', { name: 'Show stats' }));
    expect(screen.getByText(/No finished games yet/)).toBeInTheDocument();
  });

  it('lists a finished game and can be reset', () => {
    seedNearWin();
    mountApp();
    roll(6);
    fireEvent.click(bankButton());
    advance(TIMINGS.winReveal + 100);

    fireEvent.click(screen.getByRole('button', { name: 'Show stats' }));
    const row = screen.getByRole('rowheader', { name: 'Alex' }).closest('tr');
    expect(row).toHaveTextContent(/Alex\s*1\s*1/);
    expect(JSON.parse(window.localStorage.getItem('pig.stats.v1')).games).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Reset stats' }));
    expect(screen.getByText(/No finished games yet/)).toBeInTheDocument();
  });
});
