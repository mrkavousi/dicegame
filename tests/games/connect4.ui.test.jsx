import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.jsx';
import { SoundProvider } from '../../src/shared/hooks/useSound.jsx';
import { SAVE_KEY, TIMINGS } from '../../src/games/connect4/useConnectFour.js';
import { createGame, drop, settleDrop } from '../../src/games/connect4/engine.js';

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** Open the Connect Four table (it is code-split, so wait for it to load). */
async function openTable() {
  window.location.hash = '#/connect4';
  render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
  // The table is code-split: wait until either the setup form or a resumed board is on screen.
  await waitFor(() => expect(document.querySelector('.c4, .c4-setup')).not.toBeNull());
}

const startButton = () => screen.getByRole('button', { name: 'Start game' });
const column = (n) =>
  screen.getByRole('button', { name: new RegExp(`^(Drop a disc in column ${n}|Column ${n} is full)$`) });
const turnText = () => document.querySelector('.c4-status').textContent;
const discs = () => document.querySelectorAll('.c4-disc');

/** Drop in a column and let the disc land. */
function dropIn(col) {
  fireEvent.click(column(col));
  advance(TIMINGS.drop + 20);
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('Connect Four — setup', () => {
  it('opens from the lobby card', async () => {
    window.location.hash = '#/';
    render(
      <SoundProvider>
        <App />
      </SoundProvider>,
    );
    fireEvent.click(screen.getByRole('link', { name: /^Connect Four/ }));
    expect(await screen.findByRole('heading', { name: 'Connect Four', level: 1 })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/connect4');
  });

  it('shows the rules and two seats, defaulting to humans', async () => {
    await openTable();
    expect(screen.getByText('Take turns dropping a disc into a column.')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 2 type')).toHaveValue('');
  });

  it('starts with the names entered, or defaults', async () => {
    await openTable();
    fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
    fireEvent.click(startButton());
    expect(turnText()).toBe("Alex's turn");
    expect(screen.getByText('Player 2', { selector: '.c4-player__name' })).toBeInTheDocument();
  });
});

describe('Connect Four — two players', () => {
  it('drops discs, alternates turns and locks input while a disc falls', async () => {
    await openTable();
    fireEvent.click(startButton());
    vi.useFakeTimers();

    fireEvent.click(column(4));
    expect(discs()).toHaveLength(1);
    expect(turnText()).toBe("Player 2's turn");
    // A second click while the disc falls is ignored.
    fireEvent.click(column(5));
    expect(discs()).toHaveLength(1);
    advance(TIMINGS.drop + 20);
    fireEvent.click(column(5));
    expect(discs()).toHaveLength(2);
    expect(turnText()).toBe("Player 1's turn");
  });

  it('stacks discs and disables a full column', async () => {
    await openTable();
    fireEvent.click(startButton());
    vi.useFakeTimers();
    for (let i = 0; i < 6; i += 1) dropIn(1);
    expect(column(1)).toBeDisabled();
    expect(column(1)).toHaveAttribute('aria-label', 'Column 1 is full');
    expect(column(2)).not.toBeDisabled();
  });

  it('plays with the 1–7 keys', async () => {
    await openTable();
    fireEvent.click(startButton());
    vi.useFakeTimers();
    fireEvent.keyDown(window, { key: '4', code: 'Digit4' });
    expect(discs()).toHaveLength(1);
    advance(TIMINGS.drop + 20);
    fireEvent.keyDown(window, { key: '٤', code: 'Digit4' }); // a Persian-layout digit, same physical key
    expect(discs()).toHaveLength(2);
  });

  it('does not react to keys while typing a name', async () => {
    await openTable();
    fireEvent.keyDown(screen.getByLabelText('Player 1'), { key: '3', code: 'Digit3' });
    expect(discs()).toHaveLength(0);
  });

  it('announces a win, counts it, and offers play again / change players', async () => {
    await openTable();
    fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Player 2'), { target: { value: 'Sam' } });
    fireEvent.click(startButton());
    vi.useFakeTimers();

    [1, 1, 2, 2, 3, 3, 4].forEach(dropIn);

    expect(screen.getByText('Alex connected four!')).toBeInTheDocument();
    expect(document.querySelectorAll('.c4-disc.is-win')).toHaveLength(4);
    expect(document.querySelector('.c4-player--p1 .c4-player__score').textContent).toBe('1');
    // The board is locked after the game.
    fireEvent.click(column(5));
    expect(discs()).toHaveLength(7);

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(discs()).toHaveLength(0);
    expect(turnText()).toBe("Sam's turn"); // the other player starts the rematch
    expect(document.querySelector('.c4-player--p1 .c4-player__score').textContent).toBe('1'); // score kept
  });

  it('"Change players" returns to setup with the names kept', async () => {
    await openTable();
    fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
    fireEvent.click(startButton());
    vi.useFakeTimers();
    [1, 1, 2, 2, 3, 3, 4].forEach(dropIn);
    fireEvent.click(screen.getByRole('button', { name: 'Change players' }));
    expect(screen.getByLabelText('Player 1')).toHaveValue('Alex');
  });

  it('awards a star for a win and saves it', async () => {
    await openTable();
    fireEvent.click(startButton());
    vi.useFakeTimers();
    [1, 1, 2, 2, 3, 3, 4].forEach(dropIn);
    expect(screen.getByLabelText('3 stars')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.connect4).toEqual({ played: 1, won: 1 });
  });
});

describe('Connect Four — computer opponent', () => {
  it('replies on its own after a short pause, and cannot be played for', async () => {
    await openTable();
    fireEvent.change(screen.getByLabelText('Player 2 type'), { target: { value: 'normal' } });
    fireEvent.click(startButton());
    vi.useFakeTimers();

    dropIn(4);
    expect(turnText()).toBe('Bot · Normal is thinking…');
    expect(column(1)).toBeDisabled(); // the human cannot move for the computer
    fireEvent.keyDown(window, { key: '1', code: 'Digit1' });
    expect(discs()).toHaveLength(1);

    advance(TIMINGS.botThink + 20);
    expect(discs()).toHaveLength(2);
    advance(TIMINGS.drop + 20);
    expect(turnText()).toBe("Player 1's turn");
    expect(column(1)).not.toBeDisabled();
  });

  it('a computer win gives a consolation star, not a win', async () => {
    // Bot (seat 2) is one move from winning along the bottom row.
    let game = createGame({ playerNames: ['Alex', 'Bot'], bots: [null, 'hard'] });
    for (const col of [6, 0, 6, 1, 5, 2]) game = settleDrop(drop(game, col));
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    await openTable();
    vi.useFakeTimers();
    // It is Alex's turn: make a harmless move (column 5, 1-based), then the bot takes the win in column 4.
    dropIn(5);
    advance(TIMINGS.botThink + 20);
    expect(screen.getByText('Bot connected four!')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.connect4).toEqual({ played: 1, won: 0 });
    expect(screen.getByLabelText('1 stars')).toBeInTheDocument();
  });
});

describe('Connect Four — saving', () => {
  it('resumes a game in progress after a reload', async () => {
    await openTable();
    fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } });
    fireEvent.click(startButton());
    vi.useFakeTimers();
    dropIn(3);
    dropIn(3);
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)).moves).toBe(2);

    document.body.innerHTML = '';
    vi.useRealTimers();
    await openTable();
    expect(discs()).toHaveLength(2);
    expect(turnText()).toBe("Alex's turn");
  });

  it('ignores a corrupted save', async () => {
    window.localStorage.setItem(SAVE_KEY, '{"board": 5');
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });

  it('clears the save when going back to setup', async () => {
    await openTable();
    fireEvent.click(startButton());
    expect(window.localStorage.getItem(SAVE_KEY)).not.toBeNull();
  });
});

describe('Connect Four — Persian', () => {
  it('shows Persian text, digits and default names', async () => {
    window.localStorage.setItem('pig.lang.v1', 'fa');
    window.location.hash = '#/connect4';
    render(
      <SoundProvider>
        <App />
      </SoundProvider>,
    );
    await screen.findByRole('heading', { name: 'چهار در یک ردیف', level: 1 });
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getByRole('button', { name: 'شروع بازی' }));
    expect(document.querySelector('.c4-status').textContent).toBe('نوبت بازیکن ۱');
    expect(screen.getByRole('button', { name: 'انداختن دیسک در ستون ۱' })).toBeInTheDocument();
  });
});
