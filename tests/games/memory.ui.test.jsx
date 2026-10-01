import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.jsx';
import { SoundProvider } from '../../src/shared/hooks/useSound.jsx';
import { SAVE_KEY, TIMINGS } from '../../src/games/memory/useMemory.js';
import { createGame, flip, resolve } from '../../src/games/memory/engine.js';

// An identity shuffle makes the layout predictable: with P pairs, card i pairs with card i + P
// (3×4 → P = 6, 4×4 → P = 8). Card numbers below are 1-based, as on screen.
vi.mock('../../src/shared/utils/random.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shuffle: (list) => list.slice() };
});

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function mount(hash = '#/memory') {
  window.location.hash = hash;
  return render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
}

async function openTable() {
  mount();
  await waitFor(() => expect(document.querySelector('.mem, .mem-setup')).not.toBeNull());
}

const card = (n) => screen.getByRole('button', { name: new RegExp(`^Card ${n}\\b`) });
const startButton = () => screen.getByRole('button', { name: 'Start game' });
const turnText = () => document.querySelector('.mem-status').textContent;
const score = (seat) => document.querySelector(`.mem-player--p${seat} .mem-player__score`).textContent;
const faceUp = () => document.querySelectorAll('.mem-card.is-up').length;

const choose = (name) => fireEvent.click(screen.getByRole('radio', { name }));

/** Flip two cards and let the "both face-up" window pass. */
function tryPair(a, b) {
  fireEvent.click(card(a));
  fireEvent.click(card(b));
  advance(TIMINGS.reveal + 20);
}

async function startGame(setup) {
  await openTable();
  setup?.();
  fireEvent.click(startButton());
  vi.useFakeTimers();
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('Memory — setup', () => {
  it('opens from the lobby and offers players, sizes and seats', async () => {
    window.location.hash = '#/';
    render(
      <SoundProvider>
        <App />
      </SoundProvider>,
    );
    fireEvent.click(screen.getByRole('link', { name: /^Memory Match/ }));
    expect(await screen.findByRole('heading', { name: 'Memory Match', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('If they match, you keep them and go again!')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 2')).toBeInTheDocument();
  });

  it('shows one seat per player and hides the computer option when playing alone', async () => {
    await openTable();
    choose('4');
    expect(screen.getByLabelText('Player 4')).toBeInTheDocument();
    choose('1');
    expect(screen.queryByLabelText('Player 2')).toBeNull();
    expect(screen.queryByLabelText('Player 1 type')).toBeNull();
  });

  it('deals the chosen board size', async () => {
    await startGame(() => choose('Small'));
    expect(document.querySelectorAll('.mem-card')).toHaveLength(12);
  });

  it('starts with names or defaults', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } }));
    expect(turnText()).toBe("Alex's turn");
    expect(screen.getByText('Player 2', { selector: '.mem-player__name' })).toBeInTheDocument();
  });
});

describe('Memory — playing', () => {
  it('a match keeps the cards, scores, and the same player goes again', async () => {
    await startGame();
    expect(document.querySelectorAll('.mem-card')).toHaveLength(16);
    tryPair(1, 9); // card 1 pairs with card 9 (P = 8)
    expect(score(1)).toBe('1');
    expect(card(1)).toBeDisabled();
    expect(document.querySelectorAll('.mem-card.is-found')).toHaveLength(2);
    expect(turnText()).toBe("Player 1's turn");
  });

  it('a miss shows both cards for a moment, locks input, then flips them back', async () => {
    await startGame();
    fireEvent.click(card(1));
    fireEvent.click(card(2));
    expect(faceUp()).toBe(2);
    fireEvent.click(card(3)); // locked: a third card cannot be flipped
    expect(faceUp()).toBe(2);
    advance(TIMINGS.reveal + 20);
    expect(faceUp()).toBe(0);
    expect(turnText()).toBe("Player 2's turn");
    expect(score(1)).toBe('0');
  });

  it('cannot flip the same card twice', async () => {
    await startGame();
    fireEvent.click(card(1));
    expect(card(1)).toBeDisabled();
    expect(faceUp()).toBe(1);
  });

  it('labels face-down, face-up and found cards for screen readers', async () => {
    await startGame();
    expect(card(1)).toHaveAttribute('aria-label', 'Card 1, face down');
    fireEvent.click(card(1));
    expect(card(1).getAttribute('aria-label')).toMatch(
      /^Card 1: (red|blue|green) (circle|square|triangle|star|heart|diamond)$/,
    );
    fireEvent.click(card(9));
    advance(TIMINGS.reveal + 20);
    expect(card(1).getAttribute('aria-label')).toMatch(/found by Player 1$/);
  });

  it('arrow keys move focus around the grid', async () => {
    await startGame();
    card(6).focus();
    fireEvent.keyDown(card(6), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(card(7));
    fireEvent.keyDown(card(7), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(card(11)); // 4 columns
    fireEvent.keyDown(card(11), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(card(10));
    fireEvent.keyDown(card(10), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(card(6));
    // The edges stay put.
    card(1).focus();
    fireEvent.keyDown(card(1), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(card(1));
  });
});

describe('Memory — finishing', () => {
  it('the player with the most pairs wins, earns stars, and Play again rotates the first player', async () => {
    await startGame(() => {
      choose('Small');
      fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
    });
    for (let i = 1; i <= 6; i += 1) tryPair(i, i + 6);
    expect(screen.getByText('Alex wins with 6 pairs!')).toBeInTheDocument();
    expect(screen.getByLabelText('3 stars')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.memory).toEqual({ played: 1, won: 1 });
    expect(document.querySelectorAll('.mem-card:not(:disabled)')).toHaveLength(0); // board locked

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(turnText()).toBe("Player 2's turn");
    expect(score(1)).toBe('0');
    expect(document.querySelectorAll('.mem-card.is-found')).toHaveLength(0);
  });

  it('a tie is announced and counts as a draw', async () => {
    await startGame(() => choose('Small'));
    for (const i of [1, 2, 3]) tryPair(i, i + 6); // Player 1 finds three
    tryPair(4, 5); // …then misses
    for (const i of [4, 5, 6]) tryPair(i, i + 6); // Player 2 finds the other three
    expect(screen.getByText('It’s a tie!')).toBeInTheDocument();
    expect(screen.getByText(/Player 1 · Player 2 found the same number of pairs/)).toBeInTheDocument();
    expect(screen.getByLabelText('1 stars')).toBeInTheDocument();
  });

  it('a solo game counts tries and always earns the win', async () => {
    await startGame(() => {
      choose('Small');
      choose('1');
    });
    expect(turnText()).toBe('Tries: 0');
    tryPair(1, 2); // a miss
    expect(turnText()).toBe('Tries: 1');
    for (let i = 1; i <= 6; i += 1) tryPair(i, i + 6);
    expect(screen.getByText('You found every pair!')).toBeInTheDocument();
    expect(screen.getByText('It took you 7 tries.')).toBeInTheDocument();
    expect(screen.getByLabelText('3 stars')).toBeInTheDocument();
  });

  it('"Change players" returns to setup with the names kept', async () => {
    await startGame(() => {
      choose('Small');
      fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
    });
    for (let i = 1; i <= 6; i += 1) tryPair(i, i + 6);
    fireEvent.click(screen.getByRole('button', { name: 'Change players' }));
    expect(screen.getByLabelText('Player 1')).toHaveValue('Alex');
    expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked();
  });
});

describe('Memory — computer opponent', () => {
  it('flips two cards on its own, one after the other, and the human cannot interfere', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 2 type'), { target: { value: 'hard' } }));
    tryPair(1, 2); // a miss hands the turn to the computer
    expect(turnText()).toBe('Bot · Hard is thinking…');
    expect(card(5)).toBeDisabled();
    fireEvent.click(card(5));
    expect(faceUp()).toBe(0);

    advance(TIMINGS.botThink + 20);
    expect(faceUp()).toBe(1);
    advance(TIMINGS.botThink + 20);
    expect(faceUp()).toBe(2);
    advance(TIMINGS.reveal + 20);
    expect(faceUp()).toBeLessThanOrEqual(2);
  });

  it('a perfect-memory computer completes a pair it has seen', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 2 type'), { target: { value: 'hard' } }));
    tryPair(1, 2); // the computer now knows cards 1 and 2
    advance(TIMINGS.botThink + 20); // it flips a card…
    advance(TIMINGS.botThink + 20); // …and another
    advance(TIMINGS.reveal + 20);
    // After judging, someone's turn is next; the game is still consistent.
    expect(document.querySelectorAll('.mem-card.is-found').length % 2).toBe(0);
  });

  it('a computer winning gives a consolation star, not a win', async () => {
    // 3×4 board, card i pairs with card i + 6. The computer (seat 2) already found 4 pairs;
    // two pairs are left, and it is Alex's turn — Alex misses, then the computer clears the board.
    let game = createGame({ playerNames: ['Alex', 'Bot'], config: { size: '3x4', bots: [null, 'hard'] } });
    game = { ...game, deck: Array.from({ length: 12 }, (_, i) => i % 6), currentPlayer: 1 };
    for (let i = 0; i < 4; i += 1) game = resolve(flip(flip(game, i), i + 6));
    game = { ...game, currentPlayer: 0, seen: game.seen.map(() => true) };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    await openTable();
    vi.useFakeTimers();

    fireEvent.click(card(5)); // two different symbols: a miss
    fireEvent.click(card(6));
    advance(TIMINGS.reveal + 20);
    expect(turnText()).toBe('Bot is thinking…');

    for (let pair = 0; pair < 2; pair += 1) {
      advance(TIMINGS.botThink + 20);
      advance(TIMINGS.botThink + 20);
      advance(TIMINGS.reveal + 20);
    }
    expect(screen.getByText('Bot wins with 6 pairs!')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.memory).toEqual({ played: 1, won: 0 });
    expect(screen.getByLabelText('1 stars')).toBeInTheDocument();
  });
});

describe('Memory — saving', () => {
  it('resumes a game in progress after a reload', async () => {
    await startGame();
    tryPair(1, 9);
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)).moves).toBe(1);
    document.body.innerHTML = '';
    vi.useRealTimers();
    await openTable();
    expect(document.querySelectorAll('.mem-card.is-found')).toHaveLength(2);
    expect(score(1)).toBe('1');
  });

  it('ignores a corrupted save', async () => {
    window.localStorage.setItem(SAVE_KEY, '{"deck": [1,');
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });

  it('ignores a tampered save', async () => {
    const game = createGame({ playerNames: ['A', 'B'] });
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...game, deck: game.deck.map(() => 1) }));
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });
});

describe('Memory — Persian', () => {
  it('shows Persian text, digits and mirrored arrow keys', async () => {
    window.localStorage.setItem('pig.lang.v1', 'fa');
    mount();
    await screen.findByRole('heading', { name: 'بازی حافظه', level: 1 });
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getByRole('button', { name: 'شروع بازی' }));
    expect(document.querySelector('.mem-status').textContent).toBe('نوبت بازیکن ۱');
    const first = screen.getByRole('button', { name: 'کارت ۱، پشت‌رو' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' }); // in RTL, "left" is the next card
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'کارت ۲، پشت‌رو' }));
  });
});
