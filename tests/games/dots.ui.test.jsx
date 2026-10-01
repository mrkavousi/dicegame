import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.jsx';
import { SoundProvider } from '../../src/shared/hooks/useSound.jsx';
import { SAVE_KEY, TIMINGS } from '../../src/games/dots/useDots.js';
import { createGame, edgeCount } from '../../src/games/dots/engine.js';

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function mount(hash = '#/dots') {
  window.location.hash = hash;
  return render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
}

async function openTable() {
  mount();
  await waitFor(() => expect(document.querySelector('.dab, .dab-setup')).not.toBeNull());
}

/** A line by kind and 1-based row/column, e.g. line('Horizontal', 1, 1). */
const line = (kind, row, col) =>
  screen.getByRole('button', { name: new RegExp(`^${kind} line, row ${row}, column ${col}\\b`) });
const startButton = () => screen.getByRole('button', { name: 'Start game' });
const turnText = () => document.querySelector('.dab-turn').textContent;
const score = (seat) => document.querySelector(`.dab-player--p${seat} .dab-player__score`).textContent;
const drawnCount = () => document.querySelectorAll('.dab-edge.is-drawn').length;
const choose = (name) => fireEvent.click(screen.getByRole('radio', { name }));

async function startGame(setup) {
  await openTable();
  choose('Small'); // 3×3 keeps the tests short
  setup?.();
  fireEvent.click(startButton());
  vi.useFakeTimers();
}

/** Box (0,0) on a 3×3 board: top, bottom, left, right. */
const BOX0 = [
  ['Horizontal', 1, 1],
  ['Horizontal', 2, 1],
  ['Vertical', 1, 1],
  ['Vertical', 1, 2],
];

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('Dots & Boxes — setup', () => {
  it('opens from the lobby and offers players, sizes and seats', async () => {
    window.location.hash = '#/';
    render(
      <SoundProvider>
        <App />
      </SoundProvider>,
    );
    fireEvent.click(screen.getByRole('link', { name: /^Dots & Boxes/ }));
    expect(await screen.findByRole('heading', { name: 'Dots & Boxes', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Draw the 4th side of a box to win it — and go again!')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });

  it('deals the chosen board size and seats', async () => {
    await openTable();
    choose('3');
    choose('Large');
    expect(screen.getByLabelText('Player 3')).toBeInTheDocument();
    fireEvent.click(startButton());
    expect(document.querySelectorAll('.dab-edge')).toHaveLength(edgeCount(5));
    expect(document.querySelectorAll('.dab-box')).toHaveLength(25);
    expect(document.querySelectorAll('.dab-player')).toHaveLength(3);
  });

  it('starts with names or defaults', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } }));
    expect(turnText()).toBe("Alex's turn");
    expect(screen.getByText('Player 2', { selector: '.dab-player__name' })).toBeInTheDocument();
  });
});

describe('Dots & Boxes — playing', () => {
  it('a line passes the turn, is labelled with who drew it, and cannot be drawn twice', async () => {
    await startGame();
    fireEvent.click(line('Horizontal', 1, 1));
    expect(turnText()).toBe("Player 2's turn");
    expect(line('Horizontal', 1, 1)).toBeDisabled();
    expect(line('Horizontal', 1, 1)).toHaveAttribute(
      'aria-label',
      'Horizontal line, row 1, column 1, drawn by Player 1',
    );
    expect(screen.getByText('Player 1 drew a line.')).toBeInTheDocument();
    expect(drawnCount()).toBe(1);
  });

  it('closing a box scores it, shows the owner, and the same player goes again', async () => {
    await startGame();
    BOX0.slice(0, 3).forEach(([kind, row, col]) => fireEvent.click(line(kind, row, col)));
    expect(turnText()).toBe("Player 2's turn");
    fireEvent.click(line('Vertical', 1, 2)); // Player 2 draws the 4th side
    expect(score(2)).toBe('1');
    expect(score(1)).toBe('0');
    expect(turnText()).toBe("Player 2's turn"); // goes again
    expect(screen.getByText('Player 2 completed a box! Go again!')).toBeInTheDocument();
    const owned = document.querySelector('.dab-box.is-owned');
    expect(owned.textContent).toBe('P');
    expect(owned.getAttribute('data-owner')).toBe('1');
  });

  it('can be played all the way to the end', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } }));
    for (const button of document.querySelectorAll('.dab-edge')) {
      if (!button.disabled) fireEvent.click(button);
    }
    expect(document.querySelector('.result')).not.toBeNull();
    expect(document.querySelectorAll('.dab-edge:not(:disabled)')).toHaveLength(0);
    const total = Number(score(1)) + Number(score(2));
    expect(total).toBe(9);
    expect(screen.getByLabelText(/^[1-3] stars$/)).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.dots.played).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(drawnCount()).toBe(0);
    expect(turnText()).toBe("Player 2's turn"); // the other player starts the next game
  });

  it('"Change players" returns to setup with names and size kept', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } }));
    for (const button of document.querySelectorAll('.dab-edge')) {
      if (!button.disabled) fireEvent.click(button);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Change players' }));
    expect(screen.getByLabelText('Player 1')).toHaveValue('Alex');
    expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked();
  });

  it('arrow keys hop between lines of the same kind without leaving the board', async () => {
    await startGame();
    line('Horizontal', 1, 1).focus();
    fireEvent.keyDown(line('Horizontal', 1, 1), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(line('Horizontal', 1, 2));
    fireEvent.keyDown(line('Horizontal', 1, 2), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(line('Horizontal', 2, 2));
    fireEvent.keyDown(line('Horizontal', 2, 2), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(line('Horizontal', 2, 1));
    fireEvent.keyDown(line('Horizontal', 2, 1), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(line('Horizontal', 1, 1));
    fireEvent.keyDown(line('Horizontal', 1, 1), { key: 'ArrowUp' }); // top edge of the board: stays
    expect(document.activeElement).toBe(line('Horizontal', 1, 1));

    line('Vertical', 1, 1).focus();
    fireEvent.keyDown(line('Vertical', 1, 1), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(line('Vertical', 2, 1));
    fireEvent.keyDown(line('Vertical', 2, 1), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(line('Vertical', 2, 2));
    fireEvent.keyDown(line('Vertical', 2, 2), { key: 'ArrowLeft' });
    fireEvent.keyDown(line('Vertical', 2, 1), { key: 'ArrowLeft' }); // left edge of the board: stays
    expect(document.activeElement).toBe(line('Vertical', 2, 1));
  });
});

describe('Dots & Boxes — computer opponent', () => {
  it('draws on its own after a pause, and cannot be played for', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 2 type'), { target: { value: 'normal' } }));
    fireEvent.click(line('Horizontal', 1, 1));
    expect(turnText()).toBe('Bot · Normal is thinking…');
    expect(document.querySelectorAll('.dab-edge:not(:disabled)')).toHaveLength(0); // the human cannot move for it
    advance(TIMINGS.botThink + 20);
    expect(drawnCount()).toBe(2);
    expect(turnText()).toBe("Player 1's turn");
    expect(document.querySelectorAll('.dab-edge:not(:disabled)').length).toBeGreaterThan(0);
  });

  it('a computer winning gives a consolation star, not a win', async () => {
    // 3×3. The computer already owns boxes 0–5, Alex owns 6–7, and box 8 needs two more lines:
    // Alex draws one (a third side), the computer takes the box and wins 7–2.
    const base = createGame({ playerNames: ['Alex', 'Bot'], config: { size: 3, bots: [null, 'hard'] } });
    const undrawnLines = new Set([11, 23]); // bottom and right of box 8
    const edges = base.edges.map((_, edge) => (undrawnLines.has(edge) ? null : edge < 6 ? 1 : 0));
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...base, edges, currentPlayer: 0 }));
    await openTable();
    vi.useFakeTimers();

    fireEvent.click(line('Horizontal', 4, 3)); // index 11: Alex gives the third side
    advance(TIMINGS.botThink + 20); // the computer closes the box
    expect(screen.getByText('Bot wins with 7 boxes!')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.dots).toEqual({ played: 1, won: 0 });
    expect(screen.getByLabelText('1 stars')).toBeInTheDocument();
  });
});

describe('Dots & Boxes — saving', () => {
  it('resumes a game in progress after a reload', async () => {
    await startGame();
    fireEvent.click(line('Horizontal', 1, 1));
    fireEvent.click(line('Vertical', 1, 1));
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)).moves).toBe(2);
    document.body.innerHTML = '';
    vi.useRealTimers();
    await openTable();
    expect(drawnCount()).toBe(2);
    expect(line('Horizontal', 1, 1)).toBeDisabled();
  });

  it('ignores a corrupted save', async () => {
    window.localStorage.setItem(SAVE_KEY, '{"edges": [');
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });

  it('ignores a tampered save', async () => {
    const game = createGame({ playerNames: ['A', 'B'], config: { size: 3 } });
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...game, edges: game.edges.slice(3) }));
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });
});

describe('Dots & Boxes — Persian', () => {
  it('shows Persian text, digits and mirrored arrow keys', async () => {
    window.localStorage.setItem('pig.lang.v1', 'fa');
    mount();
    await screen.findByRole('heading', { name: 'نقطه و جعبه', level: 1 });
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getByRole('radio', { name: 'کوچک' }));
    fireEvent.click(screen.getByRole('button', { name: 'شروع بازی' }));
    expect(document.querySelector('.dab-turn').textContent).toBe('نوبت بازیکن ۱');
    const first = screen.getByRole('button', { name: 'خط افقی، ردیف ۱، ستون ۱' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' }); // in RTL, "left" is the next line
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'خط افقی، ردیف ۱، ستون ۲' }));
  });
});
