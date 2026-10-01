import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App.jsx';
import { SoundProvider } from '../src/hooks/useSound.jsx';
import { GAME_STATUS, createGame } from '../src/utils/gameLogic.js';
import { TIMINGS } from '../src/hooks/useGame.js';

/**
 * Deterministic dice: every roll in these tests comes from a scripted queue,
 * so the integration tests assert on rules rather than on luck.
 */
const dice = vi.hoisted(() => ({ queue: [] }));

vi.mock('../src/utils/random.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    rollDie: () => (dice.queue.length > 0 ? dice.queue.shift() : 6),
  };
});

const GAME_KEY = 'pig.game.v1';
const ROLL_MS = TIMINGS.roll;
const BUST_MS = TIMINGS.bust;
const BANK_MS = TIMINGS.bankPause;
const WIN_MS = TIMINGS.winReveal;

/* ------------------------------------------------------------------ utils --- */

function mountApp() {
  return render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
}

const rollButton = () => screen.getByRole('button', { name: /^roll dice/i });
const bankButton = () => screen.getByRole('button', { name: /^bank points/i });
const pot = (value) => screen.getByLabelText(`Turn score ${value}`);
const score = (name, points) => screen.getByLabelText(`${name}, ${points} points`);

function advance(ms) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Roll a scripted face and let the die land. */
function roll(face) {
  dice.queue.push(face);
  fireEvent.click(rollButton());
  advance(ROLL_MS + 40);
}

/** Start a match from the setup screen (empty names fall back to Player 1/2). */
function startGame(names = []) {
  mountApp();
  names.forEach((name, index) => {
    if (name) fireEvent.change(screen.getByLabelText(`Player ${index + 1}`), { target: { value: name } });
  });
  fireEvent.click(screen.getByRole('button', { name: /start game/i }));
}

/** Pre-seed a saved match, as if the page had been refreshed. */
function seedSavedGame(mutate) {
  const base = createGame({ playerNames: ['Alex', 'Sam'] });
  const state = mutate ? mutate(base) : base;
  window.localStorage.setItem(GAME_KEY, JSON.stringify(state));
}

beforeEach(() => {
  dice.queue = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/* --------------------------------------------------------------- setup --- */

describe('start screen', () => {
  it('pitches the game and asks for names', () => {
    mountApp();
    expect(screen.getByRole('heading', { name: 'Pig', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Roll. Risk. Win.')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument();
    // The restart control only makes sense inside a match.
    expect(screen.queryByRole('button', { name: /start a new game/i })).toBeNull();
  });

  it('starts a game with the entered names', () => {
    startGame(['Alex', 'Sam']);
    expect(score('Alex', 0)).toBeInTheDocument();
    expect(score('Sam', 0)).toBeInTheDocument();
    expect(screen.getByText("Alex's turn")).toBeInTheDocument();
    expect(pot(0)).toBeInTheDocument();
  });

  it('falls back to Player 1 / Player 2 when the fields are empty', () => {
    startGame();
    expect(score('Player 1', 0)).toBeInTheDocument();
    expect(score('Player 2', 0)).toBeInTheDocument();
  });

  it('disables banking until there is something to bank', () => {
    startGame();
    expect(rollButton()).toBeEnabled();
    expect(bankButton()).toBeDisabled();
  });
});

/* ---------------------------------------------------------------- rules --- */

describe('playing a turn', () => {
  it('adds each roll to the pot', () => {
    startGame();
    roll(5);
    expect(pot(5)).toBeInTheDocument();
    roll(4);
    expect(pot(9)).toBeInTheDocument();
    expect(score('Player 1', 0)).toBeInTheDocument();
  });

  it('banks the pot, updates the total and hands over the turn', () => {
    startGame(['Alex', 'Sam']);
    roll(5);
    roll(4);
    fireEvent.click(bankButton());

    expect(score('Alex', 9)).toBeInTheDocument();
    expect(pot(0)).toBeInTheDocument();
    // The hand-over is announced twice: on the board ribbon and in the toast.
    expect(screen.getAllByText("Sam's turn")).toHaveLength(2);
    expect(screen.getByText('+9 SECURED')).toBeInTheDocument();

    advance(BANK_MS + 40);
    expect(rollButton()).toBeEnabled();
    expect(bankButton()).toBeDisabled();
  });

  it('loses the pot and the turn when a 1 is rolled', () => {
    startGame(['Alex', 'Sam']);
    roll(6);
    roll(6);
    expect(pot(12)).toBeInTheDocument();

    roll(1);

    expect(pot(0)).toBeInTheDocument();
    expect(score('Alex', 0)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('OH NO!');
    expect(screen.getByRole('alert')).toHaveTextContent('12 points lost');
    expect(screen.getAllByText(/Sam's turn/i).length).toBeGreaterThan(0);
  });

  it('blocks input during the hand-over window', () => {
    startGame();
    roll(5);
    roll(1);
    expect(rollButton()).toBeDisabled();
    expect(bankButton()).toBeDisabled();

    // A bank releases the input faster than a bust.
    advance(BUST_MS + 40);
    expect(rollButton()).toBeEnabled();
  });

  it('ignores a double click on roll', () => {
    startGame();
    dice.queue.push(5, 5);
    fireEvent.click(rollButton());
    fireEvent.click(rollButton()); // same tick — must be swallowed
    advance(2 * ROLL_MS + 100);

    expect(pot(5)).toBeInTheDocument();
    expect(score('Player 1', 0)).toBeInTheDocument();
  });

  it('keeps the pot out of the total until it is banked', () => {
    startGame();
    roll(3);
    roll(3);
    roll(3);
    expect(pot(9)).toBeInTheDocument();
    expect(score('Player 1', 0)).toBeInTheDocument();
  });
});

/* --------------------------------------------------------------- winning --- */

describe('winning the game', () => {
  it('shows the winner screen as soon as a player reaches 100', () => {
    seedSavedGame((state) => ({
      ...state,
      players: state.players.map((player, index) => (index === 0 ? { ...player, score: 96 } : player)),
    }));
    mountApp();
    expect(score('Alex', 96)).toBeInTheDocument();

    roll(6);
    fireEvent.click(bankButton());
    expect(score('Alex', 102)).toBeInTheDocument();
    expect(rollButton()).toBeDisabled(); // no more rolls once the game is won

    advance(WIN_MS + 40);

    expect(screen.getByRole('heading', { name: /Alex wins!/i })).toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /main menu/i })).toBeInTheDocument();
  });

  it('starts a fresh match from "play again" with the same players', () => {
    seedSavedGame((state) => ({
      ...state,
      players: state.players.map((player, index) => (index === 1 ? { ...player, score: 99 } : player)),
      currentPlayer: 1,
    }));
    mountApp();
    roll(2);
    fireEvent.click(bankButton());
    advance(WIN_MS + 40);

    fireEvent.click(screen.getByRole('button', { name: /play again/i }));

    expect(screen.queryByRole('heading', { name: /wins!/i })).toBeNull();
    expect(score('Alex', 0)).toBeInTheDocument();
    expect(score('Sam', 0)).toBeInTheDocument();
    expect(screen.getByText("Alex's turn")).toBeInTheDocument();
  });

  it('returns to the main menu from the winner screen', () => {
    seedSavedGame((state) => ({
      ...state,
      players: state.players.map((player, index) => (index === 0 ? { ...player, score: 100 } : player)),
      winnerIndex: 0,
      status: GAME_STATUS.WON,
    }));
    mountApp();
    // A finished game resumes straight into the result.
    expect(screen.getByRole('heading', { name: /Alex wins!/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /main menu/i }));
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------- resilience --- */

describe('persistence and safety', () => {
  it('resumes a saved match and says so', () => {
    seedSavedGame((state) => ({
      ...state,
      players: state.players.map((player, index) => (index === 0 ? { ...player, score: 42 } : player)),
      turnScore: 7,
    }));
    mountApp();

    expect(score('Alex', 42)).toBeInTheDocument();
    expect(pot(7)).toBeInTheDocument();
    expect(screen.getByText('GAME RESTORED')).toBeInTheDocument();
  });

  it('writes the match to localStorage as it is played', () => {
    startGame(['Alex', 'Sam']);
    roll(5);
    fireEvent.click(bankButton());

    const saved = JSON.parse(window.localStorage.getItem(GAME_KEY));
    expect(saved.players[0].score).toBe(5);
    expect(saved.players[0].name).toBe('Alex');
  });

  it('never resumes mid-animation', () => {
    seedSavedGame((state) => ({ ...state, status: GAME_STATUS.ROLLING, turnScore: 8 }));
    mountApp();
    expect(rollButton()).toBeEnabled();
    expect(pot(8)).toBeInTheDocument();
  });

  it('asks before abandoning a match', () => {
    startGame(['Alex', 'Sam']);
    roll(4);

    fireEvent.click(screen.getByRole('button', { name: /start a new game/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /keep playing/i }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(score('Alex', 0)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /start a new game/i }));
    fireEvent.click(screen.getByRole('button', { name: /^new game$/i }));
    expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument();
  });

  it('ignores rolls after the match is over', () => {
    seedSavedGame((state) => ({
      ...state,
      players: state.players.map((player, index) => (index === 0 ? { ...player, score: 99 } : player)),
    }));
    mountApp();
    roll(3);
    fireEvent.click(bankButton());
    advance(WIN_MS + 1000 + 40);

    fireEvent.keyDown(window, { key: 'r' });
    advance(ROLL_MS + 100);
    expect(screen.getByRole('heading', { name: /Alex wins!/i })).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------- controls --- */

describe('keyboard and sound', () => {
  it('rolls with R and banks with B', () => {
    startGame();
    fireEvent.keyDown(window, { key: 'r' });
    advance(ROLL_MS + 40);
    expect(pot(6)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'b' });
    expect(score('Player 1', 6)).toBeInTheDocument();
  });

  it('does not roll while typing a name', () => {
    mountApp();
    const input = screen.getByLabelText('Player 1');
    fireEvent.keyDown(input, { key: 'r' });
    expect(input).toHaveValue('');
  });

  it('toggles the sound control', () => {
    startGame();
    fireEvent.click(screen.getByRole('button', { name: /turn sound off/i }));
    expect(screen.getByRole('button', { name: /turn sound on/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /turn sound on/i }));
    expect(screen.getByRole('button', { name: /turn sound off/i })).not.toHaveAttribute('aria-pressed');
  });

  it('logs the turn history', () => {
    startGame();
    roll(5);
    roll(1);

    expect(screen.getByText('Player 1 rolled a 1 — pot lost')).toBeInTheDocument();
    expect(screen.getByText('Player 1 rolled')).toBeInTheDocument();
  });
});
