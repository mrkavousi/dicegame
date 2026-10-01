import { describe, expect, it } from 'vitest';
import {
  BOARD,
  EVENT,
  STATUS,
  STORE,
  createGame,
  getBotLevel,
  isOwnPit,
  legalMoves,
  normalizeConfig,
  normalizeName,
  oppositeOf,
  ownerOf,
  pitIndex,
  pitsOf,
  play,
  rematch,
  restoreGame,
  scores,
  settle,
  sow,
  toSetup,
} from '../../src/games/mancala/engine.js';

/** A board from a 14-number layout, as a live game (player 0 to move unless told otherwise). */
function board(pits, extra = {}) {
  return { ...createGame({ playerNames: ['A', 'B'], config: { stones: 4 } }), pits, ...extra };
}

const total = (pits) => pits.reduce((a, b) => a + b, 0);
const settled = (state) => settle(state);

describe('layout', () => {
  it('has six pits per side and two stores', () => {
    expect(BOARD).toBe(14);
    expect(STORE).toEqual([6, 13]);
    expect(pitsOf(0)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(pitsOf(1)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(pitIndex(0, 1)).toBe(0);
    expect(pitIndex(0, 6)).toBe(5);
    expect(pitIndex(1, 1)).toBe(7);
    expect(pitIndex(1, 6)).toBe(12);
  });

  it('knows who owns what', () => {
    expect([0, 3, 5, 6].map(ownerOf)).toEqual([0, 0, 0, 0]);
    expect([7, 12, 13].map(ownerOf)).toEqual([1, 1, 1]);
    expect(isOwnPit(0, 5)).toBe(true);
    expect(isOwnPit(0, 6)).toBe(false); // a store is not a pit
    expect(isOwnPit(1, 7)).toBe(true);
    expect(isOwnPit(1, 13)).toBe(false);
    expect(isOwnPit(0, 7)).toBe(false);
  });

  it('opposite pits mirror across the board', () => {
    expect(oppositeOf(0)).toBe(12);
    expect(oppositeOf(5)).toBe(7);
    expect(oppositeOf(oppositeOf(2))).toBe(2);
  });
});

describe('a new game', () => {
  it('puts 4 stones in every pit by default and empties the stores', () => {
    const game = createGame();
    expect(game.pits.slice(0, 6)).toEqual([4, 4, 4, 4, 4, 4]);
    expect(game.pits.slice(7, 13)).toEqual([4, 4, 4, 4, 4, 4]);
    expect(game.pits[6]).toBe(0);
    expect(game.pits[13]).toBe(0);
    expect(total(game.pits)).toBe(48);
    expect(game.currentPlayer).toBe(0);
  });

  it('supports 3 and 5 stones, and normalizes bad config', () => {
    expect(total(createGame({ config: { stones: 3 } }).pits)).toBe(36);
    expect(total(createGame({ config: { stones: 5 } }).pits)).toBe(60);
    expect(normalizeConfig({ stones: 9, bots: ['hard', 'x'] })).toEqual({ stones: 4, bots: ['hard', null] });
    expect(normalizeConfig()).toEqual({ stones: 4, bots: [null, null] });
  });
});

describe('sowing', () => {
  it('moves the stones one by one to the next pits', () => {
    const next = play(createGame(), 2); // pit 3 of player 0 (4 stones)
    expect(next.pits.slice(0, 7)).toEqual([4, 4, 0, 5, 5, 5, 1]);
    expect(next.lastEvent.path).toEqual([3, 4, 5, 6]);
  });

  it('keeps the total number of stones', () => {
    let state = createGame();
    for (const pit of [2, 8, 0, 11, 4])
      state = settled(
        play(
          settled(state),
          legalMoves(state.pits, state.currentPlayer).includes(pit)
            ? pit
            : legalMoves(state.pits, state.currentPlayer)[0],
        ),
      );
    expect(total(state.pits)).toBe(48);
  });

  it('skips the opponent store: player 0 never feeds store 13', () => {
    // 10 stones from pit 5: 6(store) 7 8 9 10 11 12 [skip 13] 0 1 2.
    const state = board([0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0].map((n, i) => (i === 12 ? 1 : n)));
    const result = sow(state.pits, 0, 5);
    expect(result.pits[13]).toBe(0);
    expect(result.path).toEqual([6, 7, 8, 9, 10, 11, 12, 0, 1, 2]);
  });

  it('skips the opponent store: player 1 never feeds store 6', () => {
    const pits = Array(14).fill(0);
    pits[12] = 9;
    pits[0] = 1;
    const result = sow(pits, 1, 12);
    expect(result.pits[6]).toBe(0);
    expect(result.path).toEqual([13, 0, 1, 2, 3, 4, 5, 7, 8]);
  });

  it('handles a full lap (13+ stones) back into the starting pit', () => {
    const pits = Array(14).fill(0);
    pits[0] = 13;
    pits[7] = 1;
    const result = sow(pits, 0, 0);
    expect(result.pits[13]).toBe(0);
    expect(total(result.pits)).toBe(14);
    expect(result.path).toHaveLength(13);
  });
});

describe('extra turns and captures', () => {
  it('a last stone in your own store gives another turn', () => {
    // Pit 3 of player 0 with 3 stones lands exactly in store 6.
    const state = board([4, 4, 4, 3, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0].map((n, i) => (i === 3 ? 3 : n)));
    const next = play(state, 3);
    expect(next.lastEvent.type).toBe(EVENT.EXTRA);
    expect(next.currentPlayer).toBe(0);
    expect(next.pits[6]).toBe(1);
  });

  it('from the standard start, the 3rd pit (4 stones) ends in the store; the others do not', () => {
    expect(play(createGame(), 2).lastEvent.type).toBe(EVENT.EXTRA);
    expect(play(createGame(), 2).currentPlayer).toBe(0);
    for (const pit of [0, 1, 3, 4, 5]) expect(play(createGame(), pit).currentPlayer, `pit ${pit}`).toBe(1);
    // With 3 stones per pit it is the 4th pit instead.
    const fresh = createGame({ config: { stones: 3 } });
    expect(play(fresh, 3).lastEvent.type).toBe(EVENT.EXTRA);
  });

  it('a last stone in an empty own pit captures the opposite pit', () => {
    // Pit 0 has 1 stone, pit 1 is empty, and the opposite pit (11) holds 5.
    const pits = [1, 0, 3, 3, 3, 3, 0, 3, 3, 3, 3, 5, 3, 0];
    const state = board(pits);
    const next = play(state, 0);
    expect(next.lastEvent.type).toBe(EVENT.CAPTURE);
    expect(next.lastEvent.captured).toBe(6); // 5 + the capturing stone
    expect(next.pits[6]).toBe(6);
    expect(next.pits[1]).toBe(0);
    expect(next.pits[11]).toBe(0);
    expect(next.currentPlayer).toBe(1);
  });

  it('does not capture when the opposite pit is empty', () => {
    const pits = [1, 0, 3, 3, 3, 3, 0, 3, 3, 3, 3, 0, 3, 0];
    const next = play(board(pits), 0);
    expect(next.lastEvent.type).toBe(EVENT.MOVE);
    expect(next.pits[1]).toBe(1);
    expect(next.pits[6]).toBe(0);
  });

  it('does not capture on the opponent side', () => {
    // Player 0 ends in an empty pit of player 1: nothing is captured.
    const pits = [0, 0, 0, 0, 0, 3, 0, 0, 1, 1, 1, 1, 1, 0];
    const next = play(board(pits), 5);
    expect(next.lastEvent.type).toBe(EVENT.MOVE);
    expect(next.pits[6]).toBe(1);
  });

  it('player 1 captures too, into store 13', () => {
    const pits = [3, 3, 3, 3, 5, 3, 0, 1, 0, 3, 3, 3, 3, 0];
    const state = board(pits, { currentPlayer: 1 });
    const next = play(state, 7);
    expect(next.lastEvent.type).toBe(EVENT.CAPTURE);
    expect(next.pits[13]).toBe(next.lastEvent.captured);
    expect(next.pits[oppositeOf(8)]).toBe(0);
  });
});

describe('turn order and the input lock', () => {
  it('the next player is up after a normal move, and play is locked while sowing', () => {
    const first = play(createGame(), 0); // pit 1: 4 stones → ends in pit 5, no capture
    expect(first.status).toBe(STATUS.SOWING);
    expect(first.currentPlayer).toBe(1);
    expect(play(first, 8)).toBe(first);
    expect(settle(first).status).toBe(STATUS.PLAYING);
    expect(settle(createGame())).toEqual(createGame());
  });

  it("rejects empty pits, the opponent's pits, stores and bad indexes", () => {
    const state = board([0, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(play(state, 0)).toBe(state); // empty
    expect(play(state, 8)).toBe(state); // the opponent's pit
    expect(play(state, 6)).toBe(state); // a store
    for (const bad of [-1, 14, 1.5, NaN, undefined, '2']) expect(play(state, bad)).toBe(state);
  });

  it('never mutates the previous state', () => {
    const state = createGame();
    const snapshot = JSON.stringify(state);
    play(state, 2);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('finishing', () => {
  it('ends when a side is empty and the other player keeps their stones', () => {
    // Player 0 has a single stone left in pit 5; playing it empties their side.
    const pits = [0, 0, 0, 0, 0, 1, 10, 3, 0, 2, 0, 0, 0, 9];
    const next = play(board(pits), 5);
    expect(next.status).toBe(STATUS.WON);
    expect(next.pits.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(next.pits.slice(7, 13)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(scores(next)).toEqual([11, 14]); // 10 + the stone just banked; 9 + the 5 still on their side
    expect(next.winners).toEqual([1]);
    expect(total(next.pits)).toBe(total(pits));
  });

  it('a tie is shared; one stone more wins', () => {
    const tied = play(board([0, 0, 0, 0, 0, 1, 10, 0, 0, 0, 0, 0, 0, 11]), 5);
    expect(scores(tied)).toEqual([11, 11]);
    expect(tied.winners).toEqual([0, 1]);
    const won = play(board([0, 0, 0, 0, 0, 1, 11, 0, 0, 0, 0, 0, 0, 10]), 5);
    expect(scores(won)).toEqual([12, 10]);
    expect(won.winners).toEqual([0]);
  });

  it('nothing moves after the end', () => {
    const done = play(board([0, 0, 0, 0, 0, 1, 10, 3, 0, 2, 0, 0, 0, 9]), 5);
    expect(play(done, 0)).toBe(done);
    expect(settle(done)).toBe(done);
  });

  it('a whole game played by always choosing the first legal pit ends with every stone in a store', () => {
    let state = createGame();
    let guard = 0;
    while (state.status !== STATUS.WON && guard < 500) {
      guard += 1;
      state = settle(state);
      state = play(state, legalMoves(state.pits, state.currentPlayer)[0]);
    }
    expect(state.status).toBe(STATUS.WON);
    expect(scores(state)[0] + scores(state)[1]).toBe(48);
    expect(state.winners.length).toBeGreaterThan(0);
  });
});

describe('rematch / setup / seats', () => {
  it('rematch resets the board and the other player starts', () => {
    const next = rematch(play(createGame(), 2));
    expect(next.gameNumber).toBe(2);
    expect(next.currentPlayer).toBe(1);
    expect(next.pits[6]).toBe(0);
    expect(next.players.map((p) => p.name)).toEqual(['Player 1', 'Player 2']);
  });

  it('toSetup keeps names, seats and stones', () => {
    const setup = toSetup(createGame({ playerNames: ['Kai', ''], config: { stones: 5, bots: [null, 'hard'] } }));
    expect(setup.status).toBe(STATUS.SETUP);
    expect(setup.players.map((p) => p.name)).toEqual(['Kai', 'Player 2']);
    expect(setup.players[1].bot).toBe('hard');
    expect(setup.config.stones).toBe(5);
  });

  it('reports the bot level of the player to move', () => {
    const state = createGame({ config: { bots: [null, 'normal'] } });
    expect(getBotLevel(state)).toBeNull();
    expect(getBotLevel({ ...state, currentPlayer: 1 })).toBe('normal');
  });

  it('normalizes names', () => {
    expect(normalizeName('  Mo   Z ', 0)).toBe('Mo Z');
    expect(normalizeName('', 1)).toBe('Player 2');
    expect(normalizeName('x'.repeat(30), 0)).toHaveLength(14);
  });
});

describe('restoreGame', () => {
  const roundTrip = (state) => restoreGame(JSON.parse(JSON.stringify(state)));

  it('round-trips a game in progress, settling the sowing window', () => {
    const state = play(createGame(), 2);
    expect(state.status).toBe(STATUS.SOWING);
    const restored = roundTrip(state);
    expect(restored.status).toBe(STATUS.PLAYING);
    expect(restored.pits).toEqual(state.pits);
    expect(restored.currentPlayer).toBe(state.currentPlayer);
  });

  it('rejects boards where stones appeared or vanished', () => {
    const state = JSON.parse(JSON.stringify(createGame()));
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('nope')).toBeNull();
    expect(restoreGame({ ...state, pits: state.pits.map((n, i) => (i === 0 ? n + 1 : n)) })).toBeNull();
    expect(restoreGame({ ...state, pits: state.pits.slice(1) })).toBeNull();
    expect(restoreGame({ ...state, pits: state.pits.map((n, i) => (i === 0 ? -1 : i === 1 ? n + 5 : n)) })).toBeNull();
    expect(restoreGame({ ...state, pits: state.pits.map((n, i) => (i === 0 ? 4.5 : n)) })).toBeNull();
    expect(restoreGame({ ...state, players: [state.players[0]] })).toBeNull();
  });

  it('a stored board with an empty side is a finished game', () => {
    const state = JSON.parse(JSON.stringify(createGame()));
    state.pits = [0, 0, 0, 0, 0, 0, 20, 4, 4, 4, 4, 4, 4, 4];
    const restored = restoreGame(state);
    expect(restored.status).toBe(STATUS.WON);
    expect(scores(restored)).toEqual([20, 28]);
    expect(restored.winners).toEqual([1]);
  });
});
