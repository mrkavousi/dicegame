import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App.jsx';
import { SoundProvider } from '../../src/shared/hooks/useSound.jsx';
import { SAVE_KEY, TIMINGS } from '../../src/games/mancala/useMancala.js';
import { createGame } from '../../src/games/mancala/engine.js';

const advance = (ms) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

function mount(hash = '#/mancala') {
  window.location.hash = hash;
  return render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
}

async function openTable() {
  mount();
  await waitFor(() => expect(document.querySelector('.mnc, .mnc-setup')).not.toBeNull());
}

/** A pit by owner name and 1-based number, e.g. pit('Player 1', 3). */
const pit = (name, n) => screen.getByRole('button', { name: new RegExp(`^${name}, pit ${n}:`) });
const count = (index) => Number(document.querySelector(`[data-pit="${index}"] .mnc-pit__count`).textContent);
const store = (owner) => Number(document.querySelector(`.mnc-store--p${owner + 1} .mnc-store__count`).textContent);
const startButton = () => screen.getByRole('button', { name: 'Start game' });
const turnText = () => document.querySelector('.mnc-turn').textContent;
const enabledPits = () => [...document.querySelectorAll('.mnc-pit')].filter((button) => !button.disabled).length;

/** How long the board stays locked while `stones` stones are sown. */
const sowTime = (stones) => stones * TIMINGS.perStone + TIMINGS.settle + 20;

async function startGame(setup) {
  await openTable();
  setup?.();
  fireEvent.click(startButton());
  vi.useFakeTimers();
}

/** Put a saved game on disk: a 36-stone (3 per pit) board with the given layout. */
function save(pits, extra = {}) {
  const base = createGame({ playerNames: ['Alex', 'Sam'], config: { stones: 3 } });
  window.localStorage.setItem(SAVE_KEY, JSON.stringify({ ...base, pits, ...extra }));
}

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('Mancala — setup', () => {
  it('opens from the lobby and offers stones and seats', async () => {
    window.location.hash = '#/';
    render(
      <SoundProvider>
        <App />
      </SoundProvider>,
    );
    fireEvent.click(screen.getByRole('link', { name: /^Mancala/ }));
    expect(await screen.findByRole('heading', { name: 'Mancala', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Your last stone lands in your store? Play again!')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '4 · Classic' })).toBeChecked();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Player 2')).toBeInTheDocument();
  });

  it('deals the chosen number of stones', async () => {
    await startGame(() => fireEvent.click(screen.getByRole('radio', { name: '3 · Quick' })));
    expect(count(0)).toBe(3);
    expect(count(12)).toBe(3);
  });

  it('starts with names or defaults', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } }));
    expect(turnText()).toBe("Alex's turn");
    expect(screen.getByText('Player 2', { selector: '.mnc-store__name' })).toBeInTheDocument();
  });
});

describe('Mancala — playing', () => {
  it("starts with 4 stones in every pit and only the current player's pits enabled", async () => {
    await startGame();
    for (const index of [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]) expect(count(index)).toBe(4);
    expect(store(0)).toBe(0);
    expect(store(1)).toBe(0);
    expect(enabledPits()).toBe(6);
    expect(pit('Player 1', 1)).not.toBeDisabled();
    expect(pit('Player 2', 1)).toBeDisabled();
  });

  it('sows the stones, locks the board while they move, then passes the turn', async () => {
    await startGame();
    fireEvent.click(pit('Player 1', 1)); // 4 stones → pits 2–5
    expect([count(0), count(1), count(2), count(3), count(4)]).toEqual([0, 5, 5, 5, 5]);
    expect(screen.getByText('Player 1 sowed 4 stones.')).toBeInTheDocument();
    expect(turnText()).toBe("Player 2's turn");
    expect(enabledPits()).toBe(0); // locked while sowing
    fireEvent.click(pit('Player 2', 1));
    expect(count(7)).toBe(4);
    advance(sowTime(4));
    expect(enabledPits()).toBe(6);
    expect(pit('Player 2', 1)).not.toBeDisabled();
    expect(pit('Player 1', 1)).toBeDisabled();
  });

  it('an empty pit cannot be played', async () => {
    await startGame();
    fireEvent.click(pit('Player 1', 1)); // pit 1 is now empty
    advance(sowTime(4));
    fireEvent.click(pit('Player 2', 1)); // 4 stones: ends in a pit that already had stones → the turn comes back
    advance(sowTime(4));
    expect(turnText()).toBe("Player 1's turn");
    expect(pit('Player 1', 1)).toBeDisabled();
    expect(pit('Player 1', 2)).not.toBeDisabled();
  });

  it('a last stone in your store gives another turn', async () => {
    await startGame();
    fireEvent.click(pit('Player 1', 3)); // 4 stones from pit 3 end in the store
    expect(store(0)).toBe(1);
    expect(screen.getByText('Player 1’s last stone landed in the store — play again!')).toBeInTheDocument();
    expect(turnText()).toBe("Player 1's turn");
    advance(sowTime(4));
    expect(pit('Player 1', 1)).not.toBeDisabled();
  });

  it('captures the opposite pit', async () => {
    // Player 1's pit 1 holds 1 stone and drops it into the empty pit 2, facing pit 11 (index 11) with 5.
    save([1, 0, 3, 3, 3, 3, 0, 3, 3, 3, 3, 5, 3, 3]);
    await openTable();
    vi.useFakeTimers();
    fireEvent.click(pit('Alex', 1));
    expect(screen.getByText('Alex captured 6 stones!')).toBeInTheDocument();
    expect(store(0)).toBe(6);
    expect(count(1)).toBe(0);
    expect(count(11)).toBe(0);
  });

  it("keys 1–6 play the current player's pits", async () => {
    await startGame();
    fireEvent.keyDown(window, { key: '3', code: 'Digit3' });
    expect(store(0)).toBe(1); // pit 3 → extra turn
    advance(sowTime(4));
    fireEvent.keyDown(window, { key: '1', code: 'Digit1' });
    expect(count(0)).toBe(0);
    advance(sowTime(4));
    fireEvent.keyDown(window, { key: '٢', code: 'Digit2' }); // a Persian-layout digit, same physical key
    expect(count(8)).toBe(0); // Player 2's pit 2 is board index 8
  });

  it('does not react to keys while typing a name', async () => {
    await openTable();
    fireEvent.keyDown(screen.getByLabelText('Player 1'), { key: '3', code: 'Digit3' });
    expect(document.querySelector('.mnc-setup')).not.toBeNull();
  });

  it('labels pits and stores for screen readers', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 1'), { target: { value: 'Alex' } }));
    expect(screen.getByRole('button', { name: 'Alex, pit 1: 4 stones' })).toBeInTheDocument();
    fireEvent.click(pit('Alex', 1));
    expect(screen.getByRole('button', { name: 'Alex, pit 1: empty' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Alex’s store: 0 stones' })).toBeInTheDocument();
  });
});

describe('Mancala — finishing', () => {
  it('ends when a side is empty, sweeps the rest, names the winner and offers a rematch', async () => {
    // Alex has one stone left in pit 6; playing it empties Alex's side.
    save([0, 0, 0, 0, 0, 1, 20, 3, 0, 2, 0, 0, 0, 10]);
    await openTable();
    vi.useFakeTimers();
    fireEvent.click(pit('Alex', 6));
    expect(store(0)).toBe(21);
    expect(store(1)).toBe(15); // Sam keeps the 5 stones left on his side
    expect(screen.getByText('Alex wins 21 to 15!')).toBeInTheDocument();
    expect(screen.getByLabelText('3 stars')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.mancala).toEqual({ played: 1, won: 1 });
    expect(enabledPits()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(turnText()).toBe("Sam's turn"); // the other player starts
    expect(count(0)).toBe(3); // a fresh board with the same stones per pit
  });

  it('a tie is announced and counts as a draw', async () => {
    // One stone is still on Sam's side, so the saved game is live (a board with an empty side is already over).
    save([0, 0, 0, 0, 0, 1, 17, 0, 0, 0, 0, 0, 1, 17]);
    await openTable();
    vi.useFakeTimers();
    fireEvent.click(pit('Alex', 6)); // 18 vs 18
    expect(screen.getByText('It’s a tie!')).toBeInTheDocument();
    expect(screen.getByText('Both players have 18 stones.')).toBeInTheDocument();
    expect(screen.getByLabelText('1 stars')).toBeInTheDocument();
  });

  it('"Change players" returns to setup with names and stones kept', async () => {
    save([0, 0, 0, 0, 0, 1, 20, 3, 0, 2, 0, 0, 0, 10]);
    await openTable();
    vi.useFakeTimers();
    fireEvent.click(pit('Alex', 6));
    fireEvent.click(screen.getByRole('button', { name: 'Change players' }));
    expect(screen.getByLabelText('Player 1')).toHaveValue('Alex');
    expect(screen.getByRole('radio', { name: '3 · Quick' })).toBeChecked();
  });
});

describe('Mancala — computer opponent', () => {
  it('plays on its own after a pause, and cannot be played for', async () => {
    await startGame(() => fireEvent.change(screen.getByLabelText('Player 2 type'), { target: { value: 'normal' } }));
    fireEvent.click(pit('Player 1', 1));
    advance(sowTime(4)); // the hand-over
    expect(turnText()).toBe('Bot · Normal is thinking…');
    expect(enabledPits()).toBe(0); // the human cannot move for it
    fireEvent.keyDown(window, { key: '1', code: 'Digit1' });
    expect(count(0)).toBe(0);

    const before = [7, 8, 9, 10, 11, 12].reduce((sum, i) => sum + count(i), 0) + store(1);
    advance(TIMINGS.botThink + 20);
    const after = [7, 8, 9, 10, 11, 12].reduce((sum, i) => sum + count(i), 0) + store(1);
    expect(after).toBeLessThanOrEqual(before); // it sowed one of its own pits
    expect(document.querySelectorAll('.mnc-pit.is-sown').length).toBeGreaterThan(0);
  });

  it('a computer winning gives a consolation star, not a win', async () => {
    // Alex has one stone in pit 5 (it lands in the empty pit 6, nothing opposite).
    // Sam's only stone is in pit 6 and goes straight into his store, ending the game 31–5 for the computer.
    save([0, 0, 0, 0, 1, 0, 4, 0, 0, 0, 0, 0, 1, 30], {
      players: [
        { index: 0, name: 'Alex', bot: null },
        { index: 1, name: 'Bot', bot: 'hard' },
      ],
      config: { stones: 3, bots: [null, 'hard'] },
    });
    await openTable();
    vi.useFakeTimers();
    fireEvent.click(pit('Alex', 5));
    advance(sowTime(1)); // hand-over
    advance(TIMINGS.botThink + 20); // the computer plays its last stone
    expect(screen.getByText('Bot wins 31 to 5!')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('casino.stats.v1')).games.mancala).toEqual({ played: 1, won: 0 });
    expect(screen.getByLabelText('1 stars')).toBeInTheDocument();
  });
});

describe('Mancala — saving', () => {
  it('resumes a game in progress after a reload', async () => {
    await startGame();
    fireEvent.click(pit('Player 1', 3));
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)).pits[6]).toBe(1);
    document.body.innerHTML = '';
    vi.useRealTimers();
    await openTable();
    expect(store(0)).toBe(1);
    expect(count(2)).toBe(0);
  });

  it('ignores a corrupted save', async () => {
    window.localStorage.setItem(SAVE_KEY, '{"pits": [');
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });

  it('ignores a tampered save (stones that appeared from nowhere)', async () => {
    const base = createGame({ playerNames: ['A', 'B'] });
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ ...base, pits: base.pits.map((n, i) => (i === 0 ? n + 9 : n)) }),
    );
    await openTable();
    expect(screen.getByLabelText('Player 1')).toBeInTheDocument();
  });
});

describe('Mancala — Persian', () => {
  it('shows Persian text and digits, and the board is never mirrored', async () => {
    window.localStorage.setItem('pig.lang.v1', 'fa');
    mount();
    await screen.findByRole('heading', { name: 'منقله', level: 1 });
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getByRole('button', { name: 'شروع بازی' }));
    expect(document.querySelector('.mnc-turn').textContent).toBe('نوبت بازیکن ۱');
    expect(document.querySelector('.mnc-board').getAttribute('dir')).toBe('ltr');
    expect(screen.getByRole('button', { name: 'بازیکن ۱، خانهٔ ۱: ۴ سنگ' })).toBeInTheDocument();
    expect(document.querySelector('.mnc-store--p1 .mnc-store__count').textContent).toBe('۰');
  });
});
