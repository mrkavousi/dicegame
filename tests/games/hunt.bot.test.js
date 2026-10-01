import { describe, expect, it } from 'vitest';
import { MOVE, breakEvenPot, decideMove } from '../../src/games/hunt/bot.js';
import {
  KIND,
  STATUS,
  bank,
  createGame,
  hiddenTiles,
  knowledge,
  openTile,
  settleTurn,
} from '../../src/games/hunt/engine.js';
import { createSeededRandom } from '../../src/shared/utils/random.js';

/** A live game where the player to move (seat 0) has `pot` in the pot and `score` banked. */
function position({ pot = 0, score = 0, rival = 0, danger = 'some', level = 'normal' } = {}) {
  const base = createGame({ rng: createSeededRandom(1), config: { danger, bots: [level, null] } });
  return {
    ...base,
    pot,
    players: base.players.map((p, i) => ({ ...p, score: i === 0 ? score : rival })),
  };
}

describe('breakEvenPot', () => {
  it('matches (1 − p) · average / p at the start', () => {
    const state = position();
    const k = knowledge(state);
    const p = k.trapsLeft / k.hidden;
    const expected = ((1 - p) * (k.gemValueLeft / k.gemsLeft)) / p;
    expect(breakEvenPot(state)).toBeCloseTo(expected, 10);
    expect(breakEvenPot(state)).toBeGreaterThan(5);
  });

  it('is lower in a more dangerous field', () => {
    expect(breakEvenPot(position({ danger: 'many' }))).toBeLessThan(breakEvenPot(position({ danger: 'few' })));
  });

  it('is infinite once every trapdoor has been found', () => {
    const state = position();
    const revealed = state.tiles.map((t) => t.kind === KIND.TRAP);
    expect(breakEvenPot({ ...state, revealed })).toBe(Infinity);
  });
});

describe('decideMove', () => {
  it('always opens a tile when the pot is empty', () => {
    for (const level of ['easy', 'normal', 'hard']) {
      expect(decideMove(position({ level }), level, () => 0.5).action, level).toBe(MOVE.OPEN);
    }
  });

  it('banks once the pot reaches the break-even size (normal) and keeps going below it', () => {
    const base = breakEvenPot(position());
    expect(decideMove(position({ pot: Math.ceil(base) }), 'normal').action).toBe(MOVE.BANK);
    expect(decideMove(position({ pot: Math.floor(base) - 1 }), 'normal').action).toBe(MOVE.OPEN);
  });

  it('easy banks earlier than normal', () => {
    const base = breakEvenPot(position());
    const pot = Math.ceil(base * 0.6);
    expect(decideMove(position({ pot }), 'easy').action).toBe(MOVE.BANK);
    expect(decideMove(position({ pot }), 'normal').action).toBe(MOVE.OPEN);
  });

  it('hard takes more risk when well behind and protects a lead when well ahead', () => {
    const base = breakEvenPot(position());
    const over = Math.ceil(base) + 1; // above break-even
    expect(decideMove(position({ pot: over, score: 0, rival: 20, level: 'hard' }), 'hard').action).toBe(MOVE.OPEN); // behind: push on
    expect(decideMove(position({ pot: over, score: 0, rival: 0, level: 'hard' }), 'hard').action).toBe(MOVE.BANK); // level: bank like normal

    const early = Math.ceil(base * 0.8); // between 80% and 100% of break-even
    expect(early).toBeLessThan(base);
    expect(decideMove(position({ pot: early, score: 20, rival: 0, level: 'hard' }), 'hard').action).toBe(MOVE.BANK); // ahead: bank early
    expect(decideMove(position({ pot: early, score: 20, rival: 0, level: 'normal' }), 'normal').action).toBe(MOVE.OPEN); // normal would not
  });

  it('opens only tiles that are still hidden, and is deterministic for the same rng', () => {
    let state = position();
    state = { ...state, revealed: state.revealed.map((_, i) => i < 20) };
    const move = decideMove(state, 'normal', createSeededRandom(3));
    expect(move.action).toBe(MOVE.OPEN);
    expect(hiddenTiles(state)).toContain(move.index);
    expect(decideMove(state, 'normal', createSeededRandom(3))).toEqual(move);
  });

  it('never looks at hidden tiles: two different fields give the same decision', () => {
    const a = { ...position({ pot: 7 }), tiles: createGame({ rng: createSeededRandom(5) }).tiles };
    const b = { ...position({ pot: 7 }), tiles: createGame({ rng: createSeededRandom(6) }).tiles };
    expect(decideMove(a, 'hard', () => 0.4)).toEqual(decideMove(b, 'hard', () => 0.4));
  });

  it('does not mutate the state', () => {
    const state = position({ pot: 6 });
    const snapshot = JSON.stringify(state);
    decideMove(state, 'hard', createSeededRandom(2));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('strength', () => {
  /** Computers play a whole game; return the final state. */
  function playOut(levels, seed) {
    const rng = createSeededRandom(seed);
    let state = createGame({ rng, config: { playerCount: levels.length, bots: levels } });
    let guard = 0;
    while (state.status !== STATUS.WON && guard < 1000) {
      guard += 1;
      state = settleTurn(state);
      const move = decideMove(state, undefined, rng);
      state = move.action === MOVE.BANK ? bank(state) : openTile(state, move.index);
    }
    return state;
  }

  it('always finishes with a legal result', () => {
    for (const seed of [1, 2, 3, 4]) {
      const state = playOut(['easy', 'normal', 'hard'], seed);
      expect(state.status).toBe(STATUS.WON);
      expect(state.winners.length).toBeGreaterThan(0);
    }
  });

  it('normal outscores easy over many games', () => {
    let normal = 0;
    let easy = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = playOut(['normal', 'easy'], seed);
      normal += state.players[0].score;
      easy += state.players[1].score;
    }
    expect(normal).toBeGreaterThan(easy);
  });
});
