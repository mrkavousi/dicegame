import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.jsx';
import { SoundProvider } from '../../src/shared/hooks/useSound.jsx';
import { TIMINGS } from '../../src/games/pig/hooks/useGame.js';
import { createGame } from '../../src/games/pig/utils/gameLogic.js';

const dice = vi.hoisted(() => ({ queue: [] }));

vi.mock('../../src/shared/utils/random.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rollDie: () => (dice.queue.length > 0 ? dice.queue.shift() : 6) };
});

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Resume a saved match where seat 0 is about to win. */
function seedNearWin(config) {
  const base = createGame({ playerNames: ['Alex', 'Sam'], config });
  const state = { ...base, players: base.players.map((p, i) => (i === 0 ? { ...p, score: 95 } : p)) };
  window.localStorage.setItem('pig.game.v1', JSON.stringify(state));
}

function winWithSix() {
  render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
  dice.queue.push(6);
  fireEvent.click(screen.getByRole('button', { name: /^roll dice/i }));
  advance(TIMINGS.roll + 40);
  fireEvent.click(screen.getByRole('button', { name: /^(bank points|bank & win)/i }));
  advance(TIMINGS.winReveal + 100);
}

beforeEach(() => {
  dice.queue = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('stars from Pig', () => {
  it('a won game earns 3 stars, shown in the header and saved', () => {
    seedNearWin();
    winWithSix();
    expect(screen.getByLabelText('3 stars')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1'))).toEqual({
      stars: 3,
      games: { pig: { played: 1, won: 1 } },
    });
  });

  it('a computer winning still gives a consolation star, not a win', () => {
    const base = createGame({ playerNames: ['Alex', 'Sam'], config: { bots: [null, 'normal'] } });
    const state = {
      ...base,
      currentPlayer: 1,
      players: base.players.map((p, i) => (i === 1 ? { ...p, score: 95 } : p)),
    };
    window.localStorage.setItem('pig.game.v1', JSON.stringify(state));
    render(
      <SoundProvider>
        <App />
      </SoundProvider>,
    );
    dice.queue.push(6);
    advance(TIMINGS.botThink + TIMINGS.roll + 40); // the bot rolls a 6 (pot 6 ≥ the 5 it needs)…
    advance(TIMINGS.botThink + 40); // …and banks the win
    advance(TIMINGS.winReveal + 100);
    expect(screen.getByLabelText('1 stars')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.pig).toEqual({ played: 1, won: 0 });
  });
});
