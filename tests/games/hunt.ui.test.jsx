import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.jsx';
import { SoundProvider } from '../../src/shared/hooks/useSound.jsx';
import { SAVE_KEY, TIMINGS } from '../../src/games/hunt/useHunt.js';
import { KIND, composition, createGame } from '../../src/games/hunt/engine.js';

// An identity shuffle makes the field predictable. With the default ("some" = 5 trapdoors):
// tiles 1–5 are trapdoors, 6–16 gems worth 1, 17–22 gems worth 2, 23–25 gems worth 3 (1-based).
vi.mock('../../src/shared/utils/random.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shuffle: (list) => list.slice() };
});

const TRAP = 1;
const ONE = 6;
const TWO = 17;
const THREE = 23;

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function mount(hash = '#/hunt') {
  window.location.hash = hash;
  return render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
}

async function openTable() {
  mount();
  await waitFor(() => expect(document.querySelector('.hunt, .hunt-setup')).not.toBeNull());
}

const tile = (n) => screen.getByRole('button', { name: new RegExp(`^Tile ${n}\\b`) });
const startButton = () => screen.getByRole('button', { name: 'Start game' });
const turnText = () => document.querySelector('.hunt-turn').textContent;
const score = (seat) => document.querySelector(`.hunt-player--p${seat} .hunt-player__score`).textContent;
const pot = () => document.querySelector('.hunt-pot__value').textContent;
const openCount = () => document.querySelectorAll('.hunt-tile.is-open').length;
const bankButton = () => screen.getByRole('button', { name: /^Bank points/ });
const choose = (name) => fireEvent.click(screen.getByRole('radio', { name }));

async function startGame(setup) {
  await openTable();
  setup?.();
  fireEvent.click(startButton());
  vi.useFakeTimers();
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('Treasure Hunt — setup', () => {
  it('opens from the lobby and shows rules, options and seats', async () => {
    window.location.hash = '#/';
    render(
      <SoundProvider>
        <App />
      </SoundProvider>,
    );
    fireEvent.click(screen.getByRole('link', { name: /^Treasure Hunt/ }));
    expect(await screen.findByRole('heading', { name: 'Treasure Hunt', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Open a trapdoor and you lose your pot — and your turn!')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Some' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 2')).toBeInTheDocument();
  });

  it('adds seats for more players and starts with names or defaults', async () => {
    await openTable();
    choose('3');
    expect(screen.getByLabelText('Player 3')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
    fireEvent.click(startButton());
    expect(turnText()).toBe("Alex's turn");
    expect(document.querySelectorAll('.hunt-player')).toHaveLength(3);
    expect(screen.getByText('Player 3', { selector: '.hunt-player__name' })).toBeInTheDocument();
  });

  it('the trapdoor setting changes the odds shown', async () => {
    await startGame(() => choose('Many'));
    expect(screen.getByText(/7 trapdoors are hiding among 25 tiles/)).toBeInTheDocument();
  });
});

describe('Treasure Hunt — playing', () => {
  it('gems add to the pot and the odds update', async () => {
    await startGame();
    expect(pot()).toBe('0');
    expect(bankButton()).toBeDisabled();
    expect(screen.getByText(/5 trapdoors are hiding among 25 tiles/)).toBeInTheDocument();

    fireEvent.click(tile(ONE));
    expect(pot()).toBe('+1');
    fireEvent.click(tile(THREE));
    expect(pot()).toBe('+4');
    expect(screen.getByText('Player 1 found a gem worth 3!')).toBeInTheDocument();
    expect(screen.getByText(/5 trapdoors are hiding among 23 tiles/)).toBeInTheDocument();
    expect(screen.getByText(/Gems left: 18/)).toBeInTheDocument();
    expect(tile(ONE)).toBeDisabled(); // an open tile cannot be opened again
    expect(turnText()).toBe("Player 1's turn");
  });

  it('banking keeps the pot, passes the turn and locks the field during the hand-over', async () => {
    await startGame();
    fireEvent.click(tile(THREE));
    fireEvent.click(tile(TWO));
    fireEvent.click(bankButton());
    expect(score(1)).toBe('5');
    expect(pot()).toBe('0');
    expect(turnText()).toBe("Player 2's turn");
    expect(screen.getByText('Player 1 banked 5 points.')).toBeInTheDocument();

    fireEvent.click(tile(ONE)); // locked while the hand-over beat plays
    expect(openCount()).toBe(2);
    advance(TIMINGS.bank + 20);
    fireEvent.click(tile(ONE));
    expect(openCount()).toBe(3);
    expect(pot()).toBe('+1'); // Player 2's pot
  });

  it('a trapdoor loses the pot and the turn', async () => {
    await startGame();
    fireEvent.click(tile(THREE));
    fireEvent.click(tile(TRAP));
    expect(pot()).toBe('0');
    expect(score(1)).toBe('0');
    expect(screen.getByText('Oops! Player 1 opened a trapdoor and lost 3 points.')).toBeInTheDocument();
    expect(document.querySelectorAll('.hunt-tile.is-trap')).toHaveLength(1);
    expect(turnText()).toBe("Player 2's turn");
    fireEvent.click(tile(ONE));
    expect(openCount()).toBe(2); // still locked
    advance(TIMINGS.trap + 20);
    fireEvent.click(tile(ONE));
    expect(openCount()).toBe(3);
    expect(screen.getByText(/4 trapdoors are hiding among 22 tiles/)).toBeInTheDocument();
  });

  it('the B key banks, and does nothing with an empty pot', async () => {
    await startGame();
    fireEvent.keyDown(window, { key: 'b', code: 'KeyB' });
    expect(turnText()).toBe("Player 1's turn");
    fireEvent.click(tile(TWO));
    fireEvent.keyDown(window, { key: 'ب', code: 'KeyB' }); // a Persian-layout key, same physical key
    expect(score(1)).toBe('2');
  });

  it('does not react to B while typing a name', async () => {
    await openTable();
    fireEvent.keyDown(screen.getByLabelText('Player 1'), { key: 'b', code: 'KeyB' });
    expect(document.querySelector('.hunt-setup')).not.toBeNull();
  });

  it('labels hidden tiles, gems and trapdoors for screen readers', async () => {
    await startGame();
    expect(tile(ONE)).toHaveAttribute('aria-label', 'Tile 6, hidden');
    fireEvent.click(tile(THREE));
    expect(tile(THREE)).toHaveAttribute('aria-label', 'Tile 23: a gem worth 3');
    fireEvent.click(tile(TRAP));
    expect(tile(TRAP)).toHaveAttribute('aria-label', 'Tile 1: a trapdoor');
  });

  it('never shows what is under a hidden tile', async () => {
    await startGame();
    expect(document.querySelectorAll('.hunt-gem, .hunt-hole')).toHaveLength(0);
    expect(tile(TRAP).textContent).toBe('');
  });

  it('arrow keys move around the field without wrapping across rows', async () => {
    await startGame();
    tile(13).focus();
    fireEvent.keyDown(tile(13), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tile(14));
    fireEvent.keyDown(tile(14), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(tile(19));
    fireEvent.keyDown(tile(19), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tile(18));
    fireEvent.keyDown(tile(18), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tile(13));
    tile(5).focus();
    fireEvent.keyDown(tile(5), { key: 'ArrowRight' }); // end of row 1: stays put
    expect(document.activeElement).toBe(tile(5));
    tile(1).focus();
    fireEvent.keyDown(tile(1), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(tile(1));
  });
});

describe('Treasure Hunt — finishing', () => {
  it('finding the last gem banks it, ends the game and names the winner', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } }));
    // Alex opens every gem (tiles 6–25) without hitting a trapdoor.
    for (let n = ONE; n <= 25; n += 1) fireEvent.click(tile(n));
    expect(screen.getByText('Alex wins with 32 points!')).toBeInTheDocument();
    expect(score(1)).toBe('32');
    expect(screen.getByText('Alex found the last gem and banked 32 points!')).toBeInTheDocument();
    expect(screen.getByLabelText('3 stars')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.hunt).toEqual({ played: 1, won: 1 });
    expect(screen.queryByRole('button', { name: /^Bank points/ })).toBeNull();
    expect(document.querySelectorAll('.hunt-tile:not(:disabled)')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(turnText()).toBe("Player 2's turn"); // the other player starts the next game
    expect(score(1)).toBe('0');
    expect(openCount()).toBe(0);
  });

  it('"Change players" returns to setup with names and options kept', async () => {
    await startGame(() => {
      choose('Many');
      fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
    });
    for (let n = 8; n <= 25; n += 1) fireEvent.click(tile(n)); // Many: tiles 8–25 are gems
    fireEvent.click(screen.getByRole('button', { name: 'Change players' }));
    expect(screen.getByLabelText('Player 1')).toHaveValue('Alex');
    expect(screen.getByRole('radio', { name: 'Many' })).toBeChecked();
  });
});

describe('Treasure Hunt — computer opponent', () => {
  it('takes its turn on its own, one move at a time, and the human cannot interfere', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 2 type'), { target: { value: 'normal' } }));
    fireEvent.click(tile(TRAP)); // a trapdoor hands the turn to the computer
    advance(TIMINGS.trap + 20);
    expect(turnText()).toBe('Bot · Normal is thinking…');
    expect(bankButton()).toBeDisabled();
    expect(tile(ONE)).toBeDisabled();
    fireEvent.keyDown(window, { key: 'b', code: 'KeyB' });
    expect(score(2)).toBe('0');

    const before = openCount();
    advance(TIMINGS.botThink + 20);
    expect(openCount()).toBe(before + 1);
  });

  it('a computer winning gives a consolation star, not a win', async () => {
    // Everything is found except the last two gems (tiles 24 and 25). The computer is far ahead.
    const config = { playerCount: 2, bots: [null, 'hard'] };
    const base = createGame({ playerNames: ['Alex', 'Bot'], config });
    const { traps, gems } = composition(base.config);
    const tiles = [
      ...Array(traps).fill({ kind: KIND.TRAP, value: 0 }),
      ...Array(gems[1]).fill({ kind: KIND.GEM, value: 1 }),
      ...Array(gems[2]).fill({ kind: KIND.GEM, value: 2 }),
      ...Array(gems[3]).fill({ kind: KIND.GEM, value: 3 }),
    ];
    const saved = {
      ...base,
      tiles,
      revealed: tiles.map((_, i) => i < 23),
      players: base.players.map((p, i) => ({ ...p, score: i === 0 ? 5 : 20 })),
      currentPlayer: 0,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    await openTable();
    vi.useFakeTimers();

    fireEvent.click(tile(24)); // Alex finds a 3-point gem…
    fireEvent.click(bankButton()); // …and banks it (Alex: 8)
    advance(TIMINGS.bank + 20);
    advance(TIMINGS.botThink + 20); // the computer opens the last gem and wins 23–8
    expect(screen.getByText('Bot wins with 23 points!')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.hunt).toEqual({ played: 1, won: 0 });
    expect(screen.getByLabelText('1 stars')).toBeInTheDocument();
  });
});

describe('Treasure Hunt — saving', () => {
  it('resumes a game in progress after a reload', async () => {
    await startGame();
    fireEvent.click(tile(THREE));
    fireEvent.click(tile(TWO));
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)).pot).toBe(5);
    document.body.innerHTML = '';
    vi.useRealTimers();
    await openTable();
    expect(pot()).toBe('+5');
    expect(openCount()).toBe(2);
  });

  it('ignores a corrupted save', async () => {
    window.localStorage.setItem(SAVE_KEY, '{"tiles": [');
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });

  it('ignores a tampered save (wrong contents)', async () => {
    const game = createGame({ playerNames: ['A', 'B'] });
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...game, tiles: game.tiles.map(() => ({ kind: 'gem', value: 3 })) }),
    );
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });
});

describe('Treasure Hunt — Persian', () => {
  it('shows Persian text, digits and mirrored arrow keys', async () => {
    window.localStorage.setItem('pig.lang.v1', 'fa');
    mount();
    await screen.findByRole('heading', { name: 'شکار گنج', level: 1 });
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getByRole('button', { name: 'شروع بازی' }));
    expect(document.querySelector('.hunt-turn').textContent).toBe('نوبت بازیکن ۱');
    expect(screen.getByText(/۵ دریچهٔ تله بین ۲۵ کاشی پنهان است/)).toBeInTheDocument();
    const first = screen.getByRole('button', { name: 'کاشی ۱، پنهان' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' }); // in RTL, "left" is the next tile
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'کاشی ۲، پنهان' }));
  });
});
