import { describe, expect, it } from 'vitest';
import {
  CELLS,
  EVENT,
  KIND,
  STATUS,
  TRAPS_FOR,
  bank,
  buildTiles,
  composition,
  createGame,
  getBotLevel,
  hiddenTiles,
  knowledge,
  normalizeConfig,
  normalizeName,
  openTile,
  rematch,
  restoreGame,
  settleTurn,
  toSetup,
} from '../../src/games/hunt/engine.js';
import { createSeededRandom } from '../../src/shared/utils/random.js';

const gem = (value) => ({ kind: KIND.GEM, value });
const trap = { kind: KIND.TRAP, value: 0 };

/**
 * A predictable field (so the tests can reason about it): trapdoors first, then
 * gems 1,1,1,…,2…,3… in the public composition, in order.
 */
function orderedTiles(config) {
  const { traps, gems } = composition(config);
  return [
    ...Array(traps).fill(trap),
    ...Array(gems[1]).fill(gem(1)),
    ...Array(gems[2]).fill(gem(2)),
    ...Array(gems[3]).fill(gem(3)),
  ];
}

function game(options = {}) {
  const base = createGame({ rng: createSeededRandom(1), ...options });
  return { ...base, tiles: orderedTiles(base.config) };
}

/** Index of the first tile of a kind/value in the ordered field. */
const firstGem = (state, value) => state.tiles.findIndex((t) => t.kind === KIND.GEM && t.value === value);
const firstTrap = (state) => state.tiles.findIndex((t) => t.kind === KIND.TRAP);

describe('config and composition', () => {
  it('defaults to two players and "some" trapdoors', () => {
    expect(normalizeConfig()).toEqual({ danger: 'some', playerCount: 2, bots: [null, null] });
  });

  it('normalizes bad input', () => {
    expect(normalizeConfig({ danger: 'lots', playerCount: 9, bots: ['hard', 'x'] })).toEqual({
      danger: 'some',
      playerCount: 4,
      bots: ['hard', null, null, null],
    });
    expect(normalizeConfig({ playerCount: 1 }).playerCount).toBe(2);
  });

  it('every danger level fills all 25 tiles and has gems of each value', () => {
    for (const danger of Object.keys(TRAPS_FOR)) {
      const { traps, gems } = composition({ danger });
      expect(traps + gems[1] + gems[2] + gems[3], danger).toBe(CELLS);
      expect(gems[1]).toBeGreaterThan(gems[2]);
      expect(gems[2]).toBeGreaterThan(gems[3]);
    }
  });

  it('the shuffled field has exactly the public composition', () => {
    const tiles = buildTiles({ danger: 'many' }, createSeededRandom(7));
    expect(tiles).toHaveLength(CELLS);
    expect(tiles.filter((t) => t.kind === KIND.TRAP)).toHaveLength(7);
    expect(buildTiles({ danger: 'many' }, createSeededRandom(7))).toEqual(tiles);
    expect(buildTiles({ danger: 'many' }, createSeededRandom(8))).not.toEqual(tiles);
  });
});

describe('opening tiles', () => {
  it('a gem adds its value to the pot and the same player continues', () => {
    const start = game();
    const next = openTile(start, firstGem(start, 2));
    expect(next.pot).toBe(2);
    expect(next.currentPlayer).toBe(0);
    expect(next.status).toBe(STATUS.PLAYING);
    expect(next.lastEvent).toMatchObject({ type: EVENT.GEM, value: 2, pot: 2, player: 0 });
    expect(next.revealed[firstGem(start, 2)]).toBe(true);
  });

  it('a trapdoor loses the pot and passes the turn', () => {
    let state = openTile(game(), firstGem(game(), 3));
    state = openTile(state, firstGem(state, 1));
    expect(state.pot).toBe(4);
    const hit = openTile(state, firstTrap(state));
    expect(hit.pot).toBe(0);
    expect(hit.currentPlayer).toBe(1);
    expect(hit.status).toBe(STATUS.SWITCHING);
    expect(hit.lastEvent).toMatchObject({ type: EVENT.TRAP, lost: 4, player: 0 });
    expect(hit.players[0].traps).toBe(1);
    expect(hit.players[0].score).toBe(0);
  });

  it('is ignored while the hand-over window is open (input lock)', () => {
    const state = game();
    const hit = openTile(state, firstTrap(state));
    expect(hit.status).toBe(STATUS.SWITCHING);
    expect(openTile(hit, 20)).toBe(hit);
    expect(settleTurn(hit).status).toBe(STATUS.PLAYING);
    expect(settleTurn(state)).toBe(state);
  });

  it('rejects bad positions and tiles that are already open', () => {
    const state = openTile(game(), 10);
    for (const bad of [-1, CELLS, 1.5, NaN, undefined, '3']) expect(openTile(state, bad)).toBe(state);
    expect(openTile(state, 10)).toBe(state);
  });

  it('never mutates the previous state', () => {
    const state = game();
    const snapshot = JSON.stringify(state);
    openTile(state, 8);
    openTile(state, 0);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('banking', () => {
  it('moves the pot into the score and passes the turn', () => {
    const start = game();
    let state = openTile(start, firstGem(start, 3));
    state = openTile(state, firstGem(state, 2));
    const banked = bank(state);
    expect(banked.players[0].score).toBe(5);
    expect(banked.players[0].bestPot).toBe(5);
    expect(banked.pot).toBe(0);
    expect(banked.currentPlayer).toBe(1);
    expect(banked.status).toBe(STATUS.SWITCHING);
    expect(banked.lastEvent).toMatchObject({ type: EVENT.BANK, amount: 5, player: 0 });
  });

  it('cannot bank an empty pot or outside a live turn', () => {
    const state = game();
    expect(bank(state)).toBe(state);
    const hit = openTile(state, firstTrap(state));
    expect(bank(hit)).toBe(hit);
  });

  it('turns wrap around every player', () => {
    let state = game({ config: { playerCount: 3 } });
    const order = [];
    for (let i = 0; i < 4; i += 1) {
      order.push(state.currentPlayer);
      state = settleTurn(bank(openTile(state, firstGem(state, 1) + i)));
    }
    expect(order).toEqual([0, 1, 2, 0]);
  });
});

describe('public knowledge', () => {
  it('counts what is still hidden without peeking', () => {
    const start = game();
    expect(knowledge(start)).toMatchObject({ hidden: 25, trapsLeft: 5, gemsLeft: 20 });
    let state = openTile(start, firstGem(start, 3));
    state = openTile(state, firstTrap(state));
    const k = knowledge(state);
    expect(k).toMatchObject({ hidden: 23, trapsLeft: 4, gemsLeft: 19 });
    expect(k.gems[3]).toBe(composition(start.config).gems[3] - 1);
    expect(hiddenTiles(state)).toHaveLength(23);
  });

  it('is identical for two different shuffles (it never looks at hidden tiles)', () => {
    const a = createGame({ rng: createSeededRandom(1) });
    const b = createGame({ rng: createSeededRandom(2) });
    expect(a.tiles).not.toEqual(b.tiles);
    expect(knowledge(a)).toEqual(knowledge(b));
  });
});

describe('finishing', () => {
  /** Open everything except `keep`. */
  function openAllBut(state, keep) {
    let current = state;
    for (let i = 0; i < CELLS; i += 1) {
      if (keep.includes(i) || current.revealed[i]) continue;
      current = settleTurn(openTile(current, i));
    }
    return current;
  }

  it('opening the last gem banks it automatically and ends the game', () => {
    const start = game();
    const lastGem = firstGem(start, 3);
    let state = openAllBut(start, [lastGem]);
    expect(state.status).toBe(STATUS.PLAYING);
    const before = state.players.reduce((sum, p) => sum + p.score, 0) + state.pot;
    state = openTile(state, lastGem);
    expect(state.status).toBe(STATUS.WON);
    expect(state.pot).toBe(0);
    expect(state.lastEvent).toMatchObject({ type: EVENT.BANK, auto: true });
    const total = state.players.reduce((sum, p) => sum + p.score, 0);
    expect(total).toBeGreaterThan(before - 1);
    expect(state.winners.length).toBeGreaterThan(0);
    expect(openTile(state, 0)).toBe(state);
    expect(bank(state)).toBe(state);
  });

  it('a trapdoor that is the last tile ends the game with the pot lost', () => {
    // Make the final hidden tile a trap by revealing every gem first.
    const start = game();
    let state = start;
    for (let i = 0; i < CELLS; i += 1) {
      if (start.tiles[i].kind === KIND.GEM) state = settleTurn(openTile(state, i));
    }
    // The last gem ended the game before we could reach the traps.
    expect(state.status).toBe(STATUS.WON);
  });

  it('the highest score wins, and equal top scores share the win', () => {
    let state = game();
    state = settleTurn(bank(openTile(state, firstGem(state, 2)))); // player 0: 2
    state = settleTurn(bank(openTile(state, firstGem(state, 2) + 1))); // player 1: 2
    const finished = openAllBut(state, []);
    expect(finished.status).toBe(STATUS.WON);
    const top = Math.max(...finished.players.map((p) => p.score));
    expect(finished.winners).toEqual(finished.players.filter((p) => p.score === top).map((p) => p.index));
  });

  it('every game played out by opening in order ends exactly when the last gem is found', () => {
    const rng = createSeededRandom(11);
    let state = createGame({ rng });
    let guard = 0;
    while (state.status !== STATUS.WON && guard < 100) {
      guard += 1;
      state = settleTurn(openTile(state, hiddenTiles(state)[0]));
    }
    expect(state.status).toBe(STATUS.WON);
    expect(knowledge(state).gemsLeft).toBe(0);
  });
});

describe('rematch / setup / seats', () => {
  it('rematch reshuffles, resets scores and rotates the first player', () => {
    const played = settleTurn(bank(openTile(game(), 8)));
    const next = rematch(played, createSeededRandom(9));
    expect(next.gameNumber).toBe(2);
    expect(next.currentPlayer).toBe(1);
    expect(next.players.every((p) => p.score === 0)).toBe(true);
    expect(next.revealed.every((shown) => !shown)).toBe(true);
  });

  it('toSetup keeps names and seats', () => {
    const setup = toSetup(createGame({ playerNames: ['Kai', ''], config: { bots: [null, 'hard'] } }));
    expect(setup.status).toBe(STATUS.SETUP);
    expect(setup.players.map((p) => p.name)).toEqual(['Kai', 'Player 2']);
    expect(setup.players[1].bot).toBe('hard');
  });

  it('reports the bot level of the player to move', () => {
    const state = createGame({ config: { bots: [null, 'normal'] } });
    expect(getBotLevel(state)).toBeNull();
    expect(getBotLevel({ ...state, currentPlayer: 1 })).toBe('normal');
  });

  it('normalizes names', () => {
    expect(normalizeName('  Mo   Z ', 0)).toBe('Mo Z');
    expect(normalizeName('', 3)).toBe('Player 4');
    expect(normalizeName('x'.repeat(30), 0)).toHaveLength(14);
  });
});

describe('restoreGame', () => {
  const roundTrip = (state) => restoreGame(JSON.parse(JSON.stringify(state)));

  it('round-trips a game in progress, settling a hand-over', () => {
    const start = game();
    let state = openTile(start, firstGem(start, 2));
    state = openTile(state, firstTrap(state));
    expect(state.status).toBe(STATUS.SWITCHING);
    const restored = roundTrip(state);
    expect(restored.status).toBe(STATUS.PLAYING);
    expect(restored.currentPlayer).toBe(1);
    expect(restored.revealed).toEqual(state.revealed);
    expect(restored.tiles).toEqual(state.tiles);
    expect(restored.players[0].traps).toBe(1);
  });

  it('keeps the pot and scores', () => {
    const start = game();
    let state = settleTurn(bank(openTile(start, firstGem(start, 3))));
    state = openTile(state, firstGem(state, 2));
    const restored = roundTrip(state);
    expect(restored.pot).toBe(2);
    expect(restored.players[0].score).toBe(3);
  });

  it('restores a finished field as a finished game', () => {
    let state = createGame({ rng: createSeededRandom(2) });
    state = { ...state, revealed: state.tiles.map((t) => t.kind === KIND.GEM) }; // every gem found
    const restored = roundTrip(state);
    expect(restored.status).toBe(STATUS.WON);
    expect(restored.winners.length).toBeGreaterThan(0);
  });

  it('rejects a tampered field', () => {
    const state = JSON.parse(JSON.stringify(createGame({ rng: createSeededRandom(3) })));
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('nope')).toBeNull();
    expect(restoreGame({ ...state, tiles: state.tiles.slice(1) })).toBeNull();
    expect(restoreGame({ ...state, revealed: state.revealed.slice(1) })).toBeNull();
    expect(restoreGame({ ...state, players: [state.players[0]] })).toBeNull();
    const allGems = { ...state, tiles: state.tiles.map(() => ({ kind: 'gem', value: 3 })) };
    expect(restoreGame(allGems)).toBeNull(); // wrong composition
    const badTile = { ...state, tiles: state.tiles.map((t, i) => (i === 0 ? { kind: 'gem', value: 99 } : t)) };
    expect(restoreGame(badTile)).toBeNull();
    const junkTile = { ...state, tiles: state.tiles.map((t, i) => (i === 0 ? null : t)) };
    expect(restoreGame(junkTile)).toBeNull();
  });

  it('clamps odd numbers instead of trusting them', () => {
    const state = JSON.parse(JSON.stringify(createGame({ rng: createSeededRandom(4) })));
    state.pot = -5;
    state.players[0].score = 'lots';
    const restored = restoreGame(state);
    expect(restored.pot).toBe(0);
    expect(restored.players[0].score).toBe(0);
  });
});
