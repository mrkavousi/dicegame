import { describe, expect, it } from 'vitest';
import {
  SIZES,
  STATUS,
  SYMBOL_COUNT,
  buildDeck,
  cellCount,
  createGame,
  flip,
  flippable,
  getBotLevel,
  isFinished,
  normalizeConfig,
  normalizeName,
  rematch,
  resolve,
  restoreGame,
  toSetup,
} from '../../src/games/memory/engine.js';
import { createSeededRandom, shuffle } from '../../src/shared/utils/random.js';

const seeded = (seed = 1) => createSeededRandom(seed);

/** A small game with a known, easy-to-reason-about layout: pairs sit side by side (0,1)(2,3)… */
function fixedGame(options = {}) {
  const game = createGame({ rng: seeded(), ...options });
  const deck = Array.from({ length: game.deck.length }, (_, i) => Math.floor(i / 2));
  return { ...game, deck };
}

const flipBoth = (state, a, b) => resolve(flip(flip(state, a), b));

describe('config', () => {
  it('defaults to 4×4 with two players', () => {
    expect(normalizeConfig()).toEqual({ size: '4x4', playerCount: 2, bots: [null, null] });
  });

  it('normalizes bad input', () => {
    expect(normalizeConfig({ size: '9x9', playerCount: 99, bots: ['hard', 'nope'] })).toEqual({
      size: '4x4',
      playerCount: 4,
      bots: ['hard', null, null, null],
    });
    expect(normalizeConfig({ playerCount: 0 }).playerCount).toBe(1);
    expect(normalizeConfig({ playerCount: 'x' }).playerCount).toBe(2);
  });

  it('every size has an even number of cards and enough symbols', () => {
    for (const [name, { rows, cols }] of Object.entries(SIZES)) {
      expect((rows * cols) % 2, name).toBe(0);
      expect((rows * cols) / 2, name).toBeLessThanOrEqual(SYMBOL_COUNT);
    }
  });
});

describe('deck', () => {
  it('has exactly two of each symbol and is shuffled by the injected rng', () => {
    for (const size of Object.keys(SIZES)) {
      const game = createGame({ config: { size }, rng: seeded(3) });
      expect(game.deck).toHaveLength(cellCount(game.config));
      const counts = {};
      game.deck.forEach((symbol) => (counts[symbol] = (counts[symbol] ?? 0) + 1));
      expect(
        Object.values(counts).every((count) => count === 2),
        size,
      ).toBe(true);
    }
    expect(createGame({ rng: seeded(5) }).deck).toEqual(createGame({ rng: seeded(5) }).deck);
    expect(createGame({ rng: seeded(5) }).deck).not.toEqual(createGame({ rng: seeded(6) }).deck);
  });

  it('shuffle returns a new array and keeps every element', () => {
    const list = [1, 2, 3, 4, 5, 6];
    const mixed = shuffle(list, seeded(2));
    expect(mixed).not.toBe(list);
    expect([...mixed].sort()).toEqual(list);
    expect(list).toEqual([1, 2, 3, 4, 5, 6]);
    expect(buildDeck(4, seeded())).toHaveLength(4);
  });
});

describe('flipping', () => {
  it('flips one card, then a second which locks input for checking', () => {
    const one = flip(fixedGame(), 0);
    expect(one.flipped).toEqual([0]);
    expect(one.status).toBe(STATUS.PLAYING);
    expect(one.seen[0]).toBe(true);
    const two = flip(one, 5);
    expect(two.flipped).toEqual([0, 5]);
    expect(two.status).toBe(STATUS.CHECKING);
    expect(flip(two, 7)).toBe(two); // no third flip
  });

  it('ignores the same card twice, bad positions and found cards', () => {
    const game = flip(fixedGame(), 0);
    expect(flip(game, 0)).toBe(game);
    for (const bad of [-1, 99, 1.5, NaN, undefined, '2']) expect(flip(game, bad)).toBe(game);
    const found = flipBoth(fixedGame(), 0, 1);
    expect(flip(found, 0)).toBe(found);
  });

  it('never mutates the previous state', () => {
    const game = fixedGame();
    const snapshot = JSON.stringify(game);
    flip(game, 3);
    expect(JSON.stringify(game)).toBe(snapshot);
  });

  it('lists what can still be flipped', () => {
    const game = flip(fixedGame(), 2);
    expect(flippable(game)).not.toContain(2);
    expect(flippable(game)).toHaveLength(15);
  });
});

describe('resolving', () => {
  it('a match scores a point and the same player goes again', () => {
    const after = flipBoth(fixedGame(), 0, 1);
    expect(after.matched[0]).toBe(0);
    expect(after.matched[1]).toBe(0);
    expect(after.players[0].score).toBe(1);
    expect(after.currentPlayer).toBe(0);
    expect(after.flipped).toEqual([]);
    expect(after.status).toBe(STATUS.PLAYING);
    expect(after.lastEvent).toMatchObject({ type: 'match', cells: [0, 1], player: 0 });
    expect(after.moves).toBe(1);
  });

  it('a miss turns the cards back and passes the turn', () => {
    const after = flipBoth(fixedGame(), 0, 2);
    expect(after.matched.every((owner) => owner === null)).toBe(true);
    expect(after.currentPlayer).toBe(1);
    expect(after.flipped).toEqual([]);
    expect(after.lastEvent).toMatchObject({ type: 'miss', player: 0 });
    // …but the cards were seen, which is what a bot may remember.
    expect(after.seen[0] && after.seen[2]).toBe(true);
  });

  it('the turn wraps around all players', () => {
    let game = fixedGame({ config: { playerCount: 3 } });
    const order = [];
    for (let i = 0; i < 4; i += 1) {
      order.push(game.currentPlayer);
      game = flipBoth(game, 0, 2);
    }
    expect(order).toEqual([0, 1, 2, 0]);
  });

  it('is idempotent outside the checking state', () => {
    const game = fixedGame();
    expect(resolve(game)).toBe(game);
    const one = flip(game, 0);
    expect(resolve(one)).toBe(one);
  });

  it('a solo player keeps the turn after a miss', () => {
    const after = flipBoth(fixedGame({ config: { playerCount: 1 } }), 0, 2);
    expect(after.currentPlayer).toBe(0);
  });
});

describe('finishing', () => {
  /** Find every pair in order: (0,1)(2,3)… credited to whoever is up (a match keeps the turn). */
  function playAllPairs(state) {
    let game = state;
    for (let i = 0; i < game.deck.length; i += 2) game = flipBoth(game, i, i + 1);
    return game;
  }

  it('finds every pair, then the top scorer wins', () => {
    const won = playAllPairs(fixedGame({ config: { size: '3x4' } }));
    expect(won.status).toBe(STATUS.WON);
    expect(isFinished(won)).toBe(true);
    expect(won.winners).toEqual([0]);
    expect(won.players[0].score).toBe(6);
    expect(flip(won, 0)).toBe(won); // nothing moves after the end
  });

  it('shares the win on a tie', () => {
    let game = fixedGame({ config: { size: '3x4' } });
    // Player 0 finds 3 pairs, misses, player 1 finds the other 3.
    for (const i of [0, 2, 4]) game = flipBoth(game, i, i + 1);
    game = flipBoth(game, 6, 8); // miss → player 1
    for (const i of [6, 8, 10]) game = flipBoth(game, i, i + 1);
    expect(game.status).toBe(STATUS.WON);
    expect(game.players.map((p) => p.score)).toEqual([3, 3]);
    expect(game.winners).toEqual([0, 1]);
  });

  it('a solo game ends when everything is found', () => {
    const won = playAllPairs(fixedGame({ config: { playerCount: 1, size: '3x4' } }));
    expect(won.winners).toEqual([0]);
    expect(won.moves).toBe(6);
  });
});

describe('rematch / setup / seats', () => {
  it('rematch reshuffles, resets scores and rotates the first player', () => {
    const won = flipBoth(fixedGame(), 0, 1);
    const next = rematch(won, seeded(9));
    expect(next.gameNumber).toBe(2);
    expect(next.currentPlayer).toBe(1);
    expect(next.players.every((p) => p.score === 0)).toBe(true);
    expect(next.matched.every((owner) => owner === null)).toBe(true);
    expect(next.deck).not.toEqual(won.deck);
  });

  it('toSetup keeps names and seats', () => {
    const game = createGame({ playerNames: ['Kai', ''], config: { bots: [null, 'hard'] } });
    const setup = toSetup(game);
    expect(setup.status).toBe(STATUS.SETUP);
    expect(setup.players.map((p) => p.name)).toEqual(['Kai', 'Player 2']);
    expect(setup.players[1].bot).toBe('hard');
  });

  it('reports the bot level of the player to move', () => {
    const game = createGame({ config: { bots: [null, 'normal'] } });
    expect(getBotLevel(game)).toBeNull();
    expect(getBotLevel({ ...game, currentPlayer: 1 })).toBe('normal');
  });

  it('normalizes names', () => {
    expect(normalizeName('  Mo   Z ', 0)).toBe('Mo Z');
    expect(normalizeName('', 2)).toBe('Player 3');
    expect(normalizeName('x'.repeat(30), 0)).toHaveLength(14);
  });
});

describe('restoreGame', () => {
  const roundTrip = (state) => restoreGame(JSON.parse(JSON.stringify(state)));

  it('round-trips a game in progress', () => {
    const game = flip(flipBoth(fixedGame(), 0, 1), 4);
    const restored = roundTrip(game);
    expect(restored.deck).toEqual(game.deck);
    expect(restored.matched).toEqual(game.matched);
    expect(restored.flipped).toEqual([4]);
    expect(restored.players[0].score).toBe(1);
    expect(restored.status).toBe(STATUS.PLAYING);
  });

  it('judges two face-up cards when restoring mid-check', () => {
    const checking = flip(flip(fixedGame(), 0), 2);
    expect(checking.status).toBe(STATUS.CHECKING);
    const restored = roundTrip(checking);
    expect(restored.status).toBe(STATUS.PLAYING);
    expect(restored.flipped).toEqual([]);
    expect(restored.currentPlayer).toBe(1); // it was a miss
  });

  it('recomputes scores from the board instead of trusting the payload', () => {
    const game = flipBoth(fixedGame(), 0, 1);
    const tampered = JSON.parse(JSON.stringify(game));
    tampered.players[0].score = 99;
    expect(restoreGame(tampered).players[0].score).toBe(1);
  });

  it('restores a finished game as won', () => {
    let game = fixedGame({ config: { size: '3x4' } });
    for (let i = 0; i < 12; i += 2) game = flipBoth(game, i, i + 1);
    const restored = roundTrip(game);
    expect(restored.status).toBe(STATUS.WON);
    expect(restored.winners).toEqual([0]);
  });

  it('rejects tampered decks and boards', () => {
    const game = JSON.parse(JSON.stringify(fixedGame()));
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('nope')).toBeNull();
    expect(restoreGame({ ...game, deck: game.deck.slice(1) })).toBeNull();
    const dupes = { ...game, deck: game.deck.map(() => 3) };
    expect(restoreGame(dupes)).toBeNull();
    const badSymbol = { ...game, deck: game.deck.map((s, i) => (i === 0 ? 77 : s)) };
    expect(restoreGame(badSymbol)).toBeNull();
    const half = { ...game, matched: game.matched.map((m, i) => (i === 0 ? 0 : m)) }; // one card of a pair "found"
    expect(restoreGame(half)).toBeNull();
    const badOwner = { ...game, matched: game.matched.map((m, i) => (i < 2 ? 9 : m)) };
    expect(restoreGame(badOwner)).toBeNull();
    expect(restoreGame({ ...game, players: [game.players[0]] })).toBeNull();
  });
});
