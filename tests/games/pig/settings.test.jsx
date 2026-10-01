import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../../src/games/pig/PigGame.jsx';
import { SoundProvider } from '../../../src/shared/hooks/useSound.jsx';
import { TIMINGS } from '../../../src/games/pig/hooks/useGame.js';

const dice = vi.hoisted(() => ({ queue: [] }));

vi.mock('../../../src/shared/utils/random.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rollDie: () => (dice.queue.length > 0 ? dice.queue.shift() : 6) };
});

const mountApp = () =>
  render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );

const advance = (ms) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  dice.queue = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('game settings UI', () => {
  it('shows more name fields for more players and starts a 3-player game', () => {
    mountApp();
    expect(screen.queryByLabelText('Player 3')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '3' }));
    expect(screen.getByLabelText('Player 3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Player 3'), { target: { value: 'Kai' } });
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));
    expect(screen.getByLabelText('Kai, 0 points')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 2, 0 points')).toBeInTheDocument();
  });

  it('plays to the chosen target score', () => {
    mountApp();
    fireEvent.click(screen.getByRole('radio', { name: '50' }));
    expect(screen.getByText(/First to 50 wins/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));
    expect(screen.getAllByRole('progressbar', { name: /50 points to win/ })).toHaveLength(2);
  });

  it('plays two dice and adds both faces', () => {
    mountApp();
    fireEvent.click(screen.getByRole('radio', { name: 'Two dice' }));
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));
    dice.queue.push(3, 4);
    fireEvent.click(screen.getByRole('button', { name: /^roll dice/i }));
    advance(TIMINGS.roll + 40);
    expect(screen.getByLabelText('Turn score 7')).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /Dice showing/ })).toHaveLength(2);
  });

  it('remembers the last settings', () => {
    mountApp();
    fireEvent.click(screen.getByRole('radio', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: /start game/i }));
    expect(JSON.parse(window.localStorage.getItem('pig.config.v1')).playerCount).toBe(4);
  });
});
