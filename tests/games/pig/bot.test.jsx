import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../src/App.jsx';
import { SoundProvider } from '../../../src/shared/hooks/useSound.jsx';
import { TIMINGS } from '../../../src/games/pig/hooks/useGame.js';

const dice = vi.hoisted(() => ({ queue: [] }));

vi.mock('../../../src/shared/utils/random.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rollDie: () => (dice.queue.length > 0 ? dice.queue.shift() : 6) };
});

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const turnName = () => document.querySelector('.board__turn-name').textContent;
const rollButton = () => screen.getByRole('button', { name: /^roll dice/i });

/** Start a game where Player 2 is a computer of the given level. */
function startWithBot(level = 'normal') {
  render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
  fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
  fireEvent.change(screen.getByLabelText('Player 2 type'), { target: { value: level } });
  fireEvent.click(screen.getByRole('button', { name: /start game/i }));
}

/** Human busts, which hands the turn to the computer. */
function humanBusts() {
  dice.queue.push(1);
  fireEvent.click(rollButton());
  advance(TIMINGS.roll + TIMINGS.bust + 40);
}

beforeEach(() => {
  dice.queue = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('computer opponent', () => {
  it('shows the bot seat and its default name', () => {
    startWithBot('hard');
    expect(screen.getByLabelText('Bot · Hard, 0 points')).toBeInTheDocument();
    expect(screen.getByText(/Player 2 · Computer/)).toBeInTheDocument();
  });

  it('plays a full turn on its own: rolls until the threshold, then banks', () => {
    startWithBot('normal');
    humanBusts();
    expect(turnName()).toBe("Bot · Normal's turn");
    expect(rollButton()).toBeDisabled();

    // 6, 6, 6, 6 → pot 24 ≥ 20 → bank.
    dice.queue.push(6, 6, 6, 6);
    for (let i = 0; i < 4; i += 1) advance(TIMINGS.botThink + TIMINGS.roll + 40);
    advance(TIMINGS.botThink + 40); // decides to bank
    expect(screen.getByLabelText('Bot · Normal, 24 points')).toBeInTheDocument();
    advance(TIMINGS.bankPause + 40);
    expect(turnName()).toBe("Alex's turn");
    expect(rollButton()).toBeEnabled();
  });

  it('a bot bust passes the turn back to the human', () => {
    startWithBot('easy');
    humanBusts();
    dice.queue.push(1);
    advance(TIMINGS.botThink + TIMINGS.roll + TIMINGS.bust + 40);
    expect(turnName()).toBe("Alex's turn");
  });

  it('ignores the keyboard on the computer’s turn', () => {
    startWithBot('normal');
    humanBusts();
    dice.queue.push(2);
    fireEvent.keyDown(window, { key: 'r' });
    advance(TIMINGS.roll + 40);
    // No human-triggered roll happened: the pot is still empty and no die was consumed yet.
    expect(dice.queue).toEqual([2]);
  });
});
