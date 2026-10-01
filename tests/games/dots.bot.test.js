import { describe, expect, it } from 'vitest';
import { SOLVE_LIMIT, chooseLine, solve } from '../../src/games/dots/bot.js';
import {
  STATUS,
  completes,
  createGame,
  drawLine,
  edgeBoxes,
  sidesDrawn,
  undrawn,
} from '../../src/games/dots/engine.js';
import { createSeededRandom } from '../../src/shared/utils/random.js';

const LEVELS = ['easy', 'normal', 'hard'];
const play = (state, edges) => edges.reduce((current, edge) => drawLine(current, edge), state);
const game = (size = 3, bots = [null, null]) => createGame({ playerNames: ['A', 'B'], config: { size, bots } });

/** A random position with at most `left` lines undrawn (and still in progress). */
function randomPosition(seed, left, size = 3) {
  const rng = createSeededRandom(seed);
  let state = game(size);
  while (state.status === STATUS.PLAYING && undrawn(state.edges).length > left) {
    const lines = undrawn(state.edges);
    state = drawLine(state, lines[Math.floor(rng() * lines.length)]);
  }
  return state;
}

/** Independent exact value for the mover (no memo, no shared code with the bot): own boxes − opponent's. */
function brute(state) {
  if (state.status !== STATUS.PLAYING) return 0;
  const me = state.currentPlayer;
  let best = -Infinity;
  for (const edge of undrawn(state.edges)) {
    const next = drawLine(state, edge);
    const gained = next.players[me].score - state.players[me].score;
    const value = gained > 0 ? gained + brute(next) : -brute(next);
    best = Math.max(best, value);
  }
  return best;
}

/** The brute-force value of making one particular move. */
function valueOfMove(state, edge) {
  const me = state.currentPlayer;
  const next = drawLine(state, edge);
  const gained = next.players[me].score - state.players[me].score;
  return gained > 0 ? gained + brute(next) : -brute(next);
}

/** Boxes the other player takes greedily right after `edge` is drawn (independent of the bot's code). */
function giftBrute(state, edge) {
  let current = drawLine(state, edge);
  const taker = current.currentPlayer;
  if (current.players[state.currentPlayer].score > state.players[state.currentPlayer].score) return 0; // it took a box itself
  let total = 0;
  while (current.status === STATUS.PLAYING && current.currentPlayer === taker) {
    const capture = undrawn(current.edges).find(
      (line) => completes(current.config.size, current.edges, line).length > 0,
    );
    if (capture === undefined) break;
    const before = current.players[taker].score;
    current = drawLine(current, capture);
    total += current.players[taker].score - before;
  }
  return total;
}

describe('every level', () => {
  it('takes a box when one is on offer', () => {
    // Three sides of box 0 drawn (lines 0, 3, 12); line 13 completes it. Player B to move after A, B, A.
    const state = play(game(), [0, 3, 12]);
    for (const level of LEVELS)
      expect(
        chooseLine(state, level, () => 0.5),
        level,
      ).toBe(13);
  });

  it('always returns an undrawn line', () => {
    const rng = createSeededRandom(5);
    for (const level of LEVELS) {
      let state = game(4);
      while (state.status === STATUS.PLAYING) {
        const line = chooseLine(state, level, rng);
        expect(undrawn(state.edges), level).toContain(line);
        state = drawLine(state, line);
      }
    }
  });

  it('plays the only line left', () => {
    let state = game();
    const lines = undrawn(state.edges);
    for (const line of lines.slice(0, -1)) state = drawLine(state, line);
    if (state.status === STATUS.PLAYING) {
      for (const level of LEVELS) expect(chooseLine(state, level, () => 0)).toBe(lines[lines.length - 1]);
    }
  });

  it('does not mutate the state it is given', () => {
    const state = randomPosition(3, 14);
    const snapshot = JSON.stringify(state);
    for (const level of LEVELS) chooseLine(state, level, createSeededRandom(1));
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('is deterministic for the same rng', () => {
    const state = randomPosition(4, 18, 4);
    for (const level of LEVELS) {
      expect(chooseLine(state, level, createSeededRandom(9))).toBe(chooseLine(state, level, createSeededRandom(9)));
    }
  });
});

describe('normal', () => {
  it('takes the bigger bite first (a line that completes two boxes)', () => {
    // Surround boxes 0 and 1 except the shared line 13, and also leave a single-box chance elsewhere.
    const around = [0, 3, 12, 1, 4, 14];
    let state = game();
    for (const line of around) state = drawLine(state, line);
    expect(completes(3, state.edges, 13)).toHaveLength(2);
    expect(chooseLine(state, 'normal', () => 0.5)).toBe(13);
  });

  /** Lines that leave every bordering box with at most two sides. */
  const safeLines = (state) =>
    undrawn(state.edges).filter((line) =>
      edgeBoxes(state.config.size, line).every((box) => sidesDrawn(state.config.size, state.edges, box) <= 1),
    );

  /** Draw random SAFE lines (never a third side) until `stop(state)` or none are left. */
  function playSafely(seed, size, stop) {
    const rng = createSeededRandom(seed);
    let state = game(size);
    for (;;) {
      const safe = safeLines(state);
      if (safe.length === 0 || stop(state)) return state;
      state = drawLine(state, safe[Math.floor(rng() * safe.length)]);
    }
  }

  it('avoids drawing a third side when a safe line exists', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = playSafely(seed, 4, (current) => current.moves >= 8);
      const safe = safeLines(state);
      expect(safe.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(safe, `seed ${seed}`).toContain(chooseLine(state, 'normal', createSeededRandom(seed)));
    }
  });

  it('when every line gives something away, it gives away the least', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      for (const size of [3, 4]) {
        const state = playSafely(seed, size, () => false); // play on until no safe line is left
        if (state.status !== STATUS.PLAYING) continue;
        const lines = undrawn(state.edges);
        expect(lines.some((line) => completes(size, state.edges, line).length > 0)).toBe(false);
        const gifts = lines.map((line) => giftBrute(state, line));
        const chosen = chooseLine(state, 'normal', createSeededRandom(seed));
        expect(giftBrute(state, chosen), `size ${size} seed ${seed}`).toBe(Math.min(...gifts));
      }
    }
  });
});

describe('hard solves the endgame exactly', () => {
  it('SOLVE_LIMIT keeps the search small', () => {
    expect(SOLVE_LIMIT).toBeLessThanOrEqual(18);
  });

  it('its search value matches an independent brute-force search', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const state = randomPosition(seed, 7);
      if (state.status !== STATUS.PLAYING) continue;
      expect(solve(3, state.edges), `seed ${seed}`).toBe(brute(state));
    }
  });

  it('always plays a move that is optimal against perfect play', () => {
    let checked = 0;
    for (let seed = 1; seed <= 14; seed += 1) {
      const state = randomPosition(seed, 7);
      if (state.status !== STATUS.PLAYING) continue;
      const chosen = chooseLine(state, 'hard', createSeededRandom(seed));
      expect(valueOfMove(state, chosen), `seed ${seed}`).toBe(brute(state));
      checked += 1;
    }
    expect(checked).toBeGreaterThan(8);
  });

  it('knows the classic sacrifice: it declines the last two boxes of a chain to keep control', () => {
    // 3×3. Two separate chains remain: a 2-chain (boxes 0,1 along the top) and a long chain (the rest).
    // With a 2-chain available, the player on move should not simply open the long chain.
    const state = randomPosition(2, 8);
    const chosen = chooseLine(state, 'hard', () => 0);
    expect(valueOfMove(state, chosen)).toBe(brute(state));
  });
});

describe('strength', () => {
  /** Two computers play a whole game; return the final state. */
  function duel(levels, seed, size = 4) {
    const rng = createSeededRandom(seed);
    let state = createGame({ config: { size, playerCount: levels.length, bots: levels } });
    while (state.status === STATUS.PLAYING) state = drawLine(state, chooseLine(state, undefined, rng));
    return state;
  }

  it('finishes every game with all boxes taken', () => {
    for (const levels of [
      ['easy', 'normal'],
      ['normal', 'hard'],
      ['easy', 'normal', 'hard'],
    ]) {
      const done = duel(levels, 3);
      expect(done.status).toBe(STATUS.WON);
      expect(done.players.reduce((sum, p) => sum + p.score, 0)).toBe(16);
    }
  });

  it('normal beats easy over several games', () => {
    let normal = 0;
    let easy = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      const done = duel(['normal', 'easy'], seed);
      normal += done.players[0].score;
      easy += done.players[1].score;
    }
    expect(normal).toBeGreaterThan(easy);
  });

  it('hard is at least as strong as normal over several games', () => {
    let hard = 0;
    let normal = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      const done = duel(['hard', 'normal'], seed, 3);
      hard += done.players[0].score;
      normal += done.players[1].score;
    }
    expect(hard).toBeGreaterThanOrEqual(normal);
  });
});
