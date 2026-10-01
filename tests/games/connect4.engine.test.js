import { describe, expect, it } from 'vitest';
import {
  CELLS,
  COLS,
  STATUS,
  cellIndex,
  createGame,
  drop,
  dropRow,
  findWin,
  getBotLevel,
  legalMoves,
  normalizeName,
  rematch,
  restoreGame,
  settleDrop,
  toSetup,
  winningLineThrough,
} from '../../src/games/connect4/engine.js';

/** Play a list of columns, settling the falling-disc window between moves. */
function play(columns, state = createGame({ playerNames: ['A', 'B'] })) {
  return columns.reduce((current, col) => settleDrop(drop(current, col)), state);
}

describe('dropping', () => {
  it('discs fall to the lowest free spot', () => {
    let game = createGame();
    game = play([3, 3, 3], game);
    expect(game.board[cellIndex(5, 3)]).toBe(0);
    expect(game.board[cellIndex(4, 3)]).toBe(1);
    expect(game.board[cellIndex(3, 3)]).toBe(0);
    expect(dropRow(game.board, 3)).toBe(2);
  });

  it('players alternate, and the first player is up at the start', () => {
    const game = createGame();
    expect(game.currentPlayer).toBe(0);
    const next = drop(game, 0);
    expect(next.currentPlayer).toBe(1);
    expect(next.status).toBe(STATUS.DROPPING);
    expect(next.lastMove).toMatchObject({ row: 5, col: 0, player: 0 });
  });

  it('is ignored while the disc is falling (input lock)', () => {
    const dropping = drop(createGame(), 0);
    expect(drop(dropping, 1)).toBe(dropping);
    expect(settleDrop(dropping).status).toBe(STATUS.PLAYING);
    expect(settleDrop(createGame())).toEqual(createGame());
  });

  it('rejects bad columns and full columns', () => {
    const game = createGame();
    for (const bad of [-1, COLS, 2.5, NaN, undefined, '3']) expect(drop(game, bad)).toBe(game);
    const full = play([0, 0, 0, 0, 0, 0], game);
    expect(dropRow(full.board, 0)).toBe(-1);
    expect(drop(full, 0)).toBe(full);
    expect(legalMoves(full.board)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('never mutates the previous state', () => {
    const game = createGame();
    const snapshot = JSON.stringify(game);
    drop(game, 3);
    expect(JSON.stringify(game)).toBe(snapshot);
  });
});

describe('winning', () => {
  it('detects four across', () => {
    const game = play([0, 0, 1, 1, 2, 2, 3]);
    expect(game.status).toBe(STATUS.WON);
    expect(game.winner).toBe(0);
    expect(game.winningCells).toEqual([35, 36, 37, 38]);
    expect(game.scores).toEqual([1, 0]);
  });

  it('detects four up and down', () => {
    const game = play([0, 1, 0, 1, 0, 1, 0]);
    expect(game.winner).toBe(0);
    expect(game.winningCells).toHaveLength(4);
  });

  it('detects both diagonals', () => {
    // ↗ diagonal for player 0: (5,0)(4,1)(3,2)(2,3)
    const up = play([0, 1, 1, 2, 3, 2, 2, 3, 3, 6, 3]);
    expect(up.winner).toBe(0);
    // ↖ diagonal for player 0 on the mirrored columns
    const mirrored = play([6, 5, 5, 4, 3, 4, 4, 3, 3, 0, 3]);
    expect(mirrored.winner).toBe(0);
  });

  it('player 2 can win too', () => {
    const game = play([6, 0, 6, 1, 5, 2, 5, 3]);
    expect(game.winner).toBe(1);
    expect(game.scores).toEqual([0, 1]);
  });

  it('three in a row is not a win', () => {
    const game = play([0, 0, 1, 1, 2, 2]);
    expect(game.status).toBe(STATUS.PLAYING);
    expect(game.winner).toBeNull();
  });

  it('nothing moves after the game is won', () => {
    const won = play([0, 0, 1, 1, 2, 2, 3]);
    expect(drop(won, 4)).toBe(won);
  });

  it('winningLineThrough returns every cell of a longer run', () => {
    const board = Array(CELLS).fill(null);
    for (let col = 0; col < 5; col += 1) board[cellIndex(5, col)] = 0;
    expect(winningLineThrough(board, 5, 2)).toHaveLength(5);
    expect(winningLineThrough(board, 4, 2)).toEqual([]);
    expect(findWin(board)).toMatchObject({ player: 0 });
  });
});

describe('draw', () => {
  // A real 42-move game (found by seeded random play) that ends with no four in a row.
  const DRAWN_GAME = [
    5, 1, 0, 4, 3, 4, 1, 3, 3, 3, 3, 4, 2, 1, 5, 5, 2, 1, 4, 6, 6, 5, 3, 0, 2, 5, 1, 4, 1, 0, 4, 6, 0, 0, 5, 2, 0, 6, 2,
    2, 6, 6,
  ];

  it('a full board with no four-in-a-row is a draw', () => {
    const game = play(DRAWN_GAME);
    expect(game.status).toBe(STATUS.DRAW);
    expect(game.moves).toBe(CELLS);
    expect(game.winner).toBeNull();
    expect(game.scores).toEqual([0, 0]);
    expect(findWin(game.board)).toBeNull();
    expect(legalMoves(game.board)).toEqual([]);
  });

  it('is not a draw one move early, and nothing moves afterwards', () => {
    const almost = play(DRAWN_GAME.slice(0, -1));
    expect(almost.status).toBe(STATUS.PLAYING);
    expect(legalMoves(almost.board)).toEqual([6]);
    const draw = drop(almost, 6);
    expect(drop(draw, 6)).toBe(draw);
  });

  it('survives save and restore', () => {
    const draw = play(DRAWN_GAME);
    expect(restoreGame(JSON.parse(JSON.stringify(draw))).status).toBe(STATUS.DRAW);
  });
});

describe('rematch / setup', () => {
  it('the other player starts and scores carry over', () => {
    const won = play([0, 0, 1, 1, 2, 2, 3]);
    const next = rematch(won);
    expect(next.status).toBe(STATUS.PLAYING);
    expect(next.startingPlayer).toBe(1);
    expect(next.currentPlayer).toBe(1);
    expect(next.scores).toEqual([1, 0]);
    expect(next.gameNumber).toBe(2);
    expect(next.board.every((cell) => cell === null)).toBe(true);
    expect(next.players.map((p) => p.name)).toEqual(['A', 'B']);
  });

  it('toSetup keeps names and seats but drops the board', () => {
    const game = createGame({ playerNames: ['Kai', ''], bots: [null, 'hard'] });
    const setup = toSetup(drop(game, 2));
    expect(setup.status).toBe(STATUS.SETUP);
    expect(setup.players.map((p) => p.name)).toEqual(['Kai', 'Player 2']);
    expect(setup.players[1].bot).toBe('hard');
    expect(setup.board.every((cell) => cell === null)).toBe(true);
  });

  it('exposes the bot level of the player to move', () => {
    const game = createGame({ bots: [null, 'normal'] });
    expect(getBotLevel(game)).toBeNull();
    expect(getBotLevel(settleDrop(drop(game, 0)))).toBe('normal');
  });

  it('normalises names and ignores bad bot levels', () => {
    expect(normalizeName('  Alex   B  ', 0)).toBe('Alex B');
    expect(normalizeName('', 1)).toBe('Player 2');
    expect(normalizeName('x'.repeat(40), 0)).toHaveLength(14);
    expect(createGame({ bots: ['impossible', 'easy'] }).players.map((p) => p.bot)).toEqual([null, 'easy']);
  });
});

describe('restoreGame', () => {
  const roundTrip = (state) => restoreGame(JSON.parse(JSON.stringify(state)));

  it('round-trips a game in progress, settling a falling disc', () => {
    const game = drop(play([3, 3, 4]), 2);
    expect(game.status).toBe(STATUS.DROPPING);
    const restored = roundTrip(game);
    expect(restored.status).toBe(STATUS.PLAYING);
    expect(restored.board).toEqual(game.board);
    expect(restored.currentPlayer).toBe(game.currentPlayer);
    expect(restored.moves).toBe(4);
  });

  it('recomputes a win from the board instead of trusting the payload', () => {
    const won = play([0, 0, 1, 1, 2, 2, 3]);
    const tampered = JSON.parse(JSON.stringify({ ...won, status: 'playing', winner: null, winningCells: [] }));
    const restored = restoreGame(tampered);
    expect(restored.status).toBe(STATUS.WON);
    expect(restored.winner).toBe(0);
  });

  it('rejects impossible boards', () => {
    const game = play([3, 3]);
    const floating = JSON.parse(JSON.stringify(game));
    floating.board[cellIndex(0, 0)] = 1; // a disc floating at the top
    expect(restoreGame(floating)).toBeNull();

    const lopsided = JSON.parse(JSON.stringify(createGame()));
    [35, 36, 37].forEach((i) => (lopsided.board[i] = 0));
    expect(restoreGame(lopsided)).toBeNull();

    expect(restoreGame({ ...game, board: game.board.slice(1) })).toBeNull();
    expect(restoreGame({ ...game, players: [game.players[0]] })).toBeNull();
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('nope')).toBeNull();
    const badCell = JSON.parse(JSON.stringify(game));
    badCell.board[41] = 7;
    expect(restoreGame(badCell)).toBeNull();
  });

  it('keeps scores, game number, names and seats', () => {
    const base = rematch(play([0, 0, 1, 1, 2, 2, 3]));
    const restored = roundTrip(drop(base, 3));
    expect(restored.scores).toEqual([1, 0]);
    expect(restored.gameNumber).toBe(2);
    expect(restored.startingPlayer).toBe(1);
    expect(restored.currentPlayer).toBe(0);
  });
});
