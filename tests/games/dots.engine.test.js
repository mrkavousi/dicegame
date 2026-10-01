import { describe, expect, it } from 'vitest';
import {
  EVENT,
  SIZES,
  STATUS,
  boxCount,
  boxEdges,
  completes,
  createGame,
  drawLine,
  edgeBoxes,
  edgeCount,
  edgePosition,
  getBotLevel,
  horizontalCount,
  isHorizontal,
  normalizeConfig,
  normalizeName,
  rematch,
  restoreGame,
  sidesDrawn,
  toSetup,
  undrawn,
} from '../../src/games/dots/engine.js';

/** Draw several lines in order (each by whoever's turn it is). */
const play = (state, edges) => edges.reduce((current, edge) => drawLine(current, edge), state);

/** A 3×3 game for readable tests. */
const small = (options = {}) => createGame({ playerNames: ['A', 'B'], config: { size: 3, ...options } });

describe('geometry', () => {
  it('counts lines and boxes for every size', () => {
    expect(SIZES).toEqual([3, 4, 5, 6]);
    for (const size of SIZES) {
      expect(edgeCount(size)).toBe(2 * size * (size + 1));
      expect(boxCount(size)).toBe(size * size);
      expect(horizontalCount(size) * 2).toBe(edgeCount(size));
    }
  });

  it('every box has four distinct lines, each of which borders that box', () => {
    for (const size of SIZES) {
      for (let box = 0; box < boxCount(size); box += 1) {
        const lines = boxEdges(size, box);
        expect(new Set(lines).size).toBe(4);
        lines.forEach((line) => expect(edgeBoxes(size, line)).toContain(box));
      }
    }
  });

  it('a line borders one box on the outer edge and two inside', () => {
    const size = 3;
    for (let edge = 0; edge < edgeCount(size); edge += 1) {
      const { horizontal, row, col } = edgePosition(size, edge);
      const outer = horizontal ? row === 0 || row === size : col === 0 || col === size;
      expect(edgeBoxes(size, edge), `edge ${edge}`).toHaveLength(outer ? 1 : 2);
    }
    expect(isHorizontal(3, 0)).toBe(true);
    expect(isHorizontal(3, 12)).toBe(false);
  });

  it('every line is counted by 1 or 2 boxes, so box sides add up to 4·boxes', () => {
    const size = 4;
    const total = Array.from({ length: edgeCount(size) }, (_, edge) => edgeBoxes(size, edge).length).reduce(
      (a, b) => a + b,
      0,
    );
    expect(total).toBe(4 * boxCount(size));
  });
});

describe('config', () => {
  it('defaults to a 4×4 board and two players', () => {
    expect(normalizeConfig()).toEqual({ size: 4, playerCount: 2, bots: [null, null] });
  });

  it('normalizes bad input', () => {
    expect(normalizeConfig({ size: 9, playerCount: 99, bots: ['hard', 'x'] })).toEqual({
      size: 4,
      playerCount: 4,
      bots: ['hard', null, null, null],
    });
    expect(normalizeConfig({ size: '5', playerCount: 1 })).toMatchObject({ size: 5, playerCount: 2 });
  });
});

describe('drawing lines', () => {
  it('a line that completes nothing passes the turn', () => {
    const next = drawLine(small(), 0);
    expect(next.edges[0]).toBe(0);
    expect(next.currentPlayer).toBe(1);
    expect(next.lastEvent).toMatchObject({ type: EVENT.LINE, edge: 0, player: 0 });
    expect(next.moves).toBe(1);
  });

  it('completing a box scores it and the same player goes again', () => {
    // Box 0 is bounded by lines 0 (top), 3 (bottom), 12 (left), 13 (right) on a 3×3 board.
    expect(boxEdges(3, 0)).toEqual([0, 3, 12, 13]);
    let state = play(small(), [0, 3, 12]); // A, B, A (turns pass: no box yet)
    expect(state.currentPlayer).toBe(1);
    state = drawLine(state, 13); // B draws the 4th side
    expect(state.boxes[0]).toBe(1);
    expect(state.players[1].score).toBe(1);
    expect(state.currentPlayer).toBe(1); // B moves again
    expect(state.lastEvent).toMatchObject({ type: EVENT.BOX, boxes: [0], player: 1 });
  });

  it('one line can complete two boxes at once', () => {
    // Boxes 0 and 1 share the vertical line 13; give them every other side first.
    const around = [...boxEdges(3, 0), ...boxEdges(3, 1)].filter((e, i, all) => e !== 13 && all.indexOf(e) === i);
    let state = small();
    for (const edge of around) state = drawLine(state, edge);
    const before = state.currentPlayer;
    state = drawLine(state, 13);
    expect(state.boxes[0]).toBe(before);
    expect(state.boxes[1]).toBe(before);
    expect(state.players[before].score).toBe(2);
    expect(state.currentPlayer).toBe(before);
    expect(state.lastEvent.boxes).toEqual([0, 1]);
  });

  it('completes() previews the boxes a line would take', () => {
    let state = play(small(), [0, 3, 12]);
    expect(completes(3, state.edges, 13)).toEqual([0]);
    expect(completes(3, state.edges, 5)).toEqual([]);
    expect(sidesDrawn(3, state.edges, 0)).toBe(3);
    expect(undrawn(state.edges)).toHaveLength(edgeCount(3) - 3);
  });

  it('rejects bad lines and lines already drawn', () => {
    const state = drawLine(small(), 5);
    for (const bad of [-1, 24, 1.5, NaN, undefined, '3']) expect(drawLine(state, bad)).toBe(state);
    expect(drawLine(state, 5)).toBe(state);
  });

  it('never mutates the previous state', () => {
    const state = small();
    const snapshot = JSON.stringify(state);
    drawLine(state, 0);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('finishing', () => {
  /** Draw every remaining line in index order. */
  function finish(state) {
    let current = state;
    for (let edge = 0; edge < current.edges.length && current.status === STATUS.PLAYING; edge += 1) {
      current = drawLine(current, edge);
    }
    return current;
  }

  it('ends when every box is taken and names the top scorer', () => {
    const done = finish(small());
    expect(done.status).toBe(STATUS.WON);
    expect(done.boxes.every((owner) => owner !== null)).toBe(true);
    expect(done.players.reduce((sum, p) => sum + p.score, 0)).toBe(9);
    const top = Math.max(...done.players.map((p) => p.score));
    expect(done.winners).toEqual(done.players.filter((p) => p.score === top).map((p) => p.index));
    expect(drawLine(done, 0)).toBe(done);
  });

  it('every size can be played to the end with all boxes accounted for', () => {
    for (const size of SIZES) {
      const done = finish(createGame({ config: { size } }));
      expect(done.status, `size ${size}`).toBe(STATUS.WON);
      expect(done.players.reduce((sum, p) => sum + p.score, 0)).toBe(size * size);
    }
  });

  it('a 4×4 board (16 boxes) can end in a shared win', () => {
    // Give player 0 the first 8 boxes and player 1 the rest by hand, then finish.
    const state = createGame({ config: { size: 4 } });
    const boxes = state.boxes.map((_, i) => (i < 8 ? 0 : 1));
    const edges = state.edges.map((_, edge) => (edgeBoxes(4, edge).some((box) => boxes[box] === 0) ? 0 : 1));
    const restored = restoreGame({ ...state, edges, boxes });
    expect(restored.status).toBe(STATUS.WON);
    expect(restored.winners).toEqual([0, 1]);
  });

  it('turns wrap around all players', () => {
    let state = createGame({ config: { size: 3, playerCount: 3 } });
    const order = [];
    for (const edge of [0, 1, 2, 4]) {
      order.push(state.currentPlayer);
      state = drawLine(state, edge);
    }
    expect(order).toEqual([0, 1, 2, 0]);
  });
});

describe('rematch / setup / seats', () => {
  it('rematch clears the board and rotates the first player', () => {
    const played = drawLine(small(), 0);
    const next = rematch(played);
    expect(next.gameNumber).toBe(2);
    expect(next.currentPlayer).toBe(1);
    expect(next.edges.every((owner) => owner === null)).toBe(true);
    expect(next.players.map((p) => p.name)).toEqual(['A', 'B']);
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
    expect(getBotLevel(drawLine(state, 0))).toBe('normal');
  });

  it('normalizes names', () => {
    expect(normalizeName('  Mo   Z ', 0)).toBe('Mo Z');
    expect(normalizeName('', 3)).toBe('Player 4');
    expect(normalizeName('x'.repeat(30), 0)).toHaveLength(14);
  });
});

describe('restoreGame', () => {
  const roundTrip = (state) => restoreGame(JSON.parse(JSON.stringify(state)));

  it('round-trips a game in progress', () => {
    const state = play(small(), [0, 3, 12, 13, 5]);
    const restored = roundTrip(state);
    expect(restored.edges).toEqual(state.edges);
    expect(restored.boxes).toEqual(state.boxes);
    expect(restored.currentPlayer).toBe(state.currentPlayer);
    expect(restored.players.map((p) => p.score)).toEqual(state.players.map((p) => p.score));
  });

  it('recomputes scores from the board instead of trusting the payload', () => {
    const state = play(small(), [0, 3, 12, 13]);
    const tampered = JSON.parse(JSON.stringify(state));
    tampered.players[1].score = 99;
    expect(restoreGame(tampered).players[1].score).toBe(1);
  });

  it('does not invent boxes that are not finished', () => {
    const state = JSON.parse(JSON.stringify(small()));
    state.boxes[4] = 0; // claims a box with no lines drawn
    expect(restoreGame(state).boxes[4]).toBeNull();
  });

  it('restores a completed board as a finished game', () => {
    let state = small();
    for (let edge = 0; edge < state.edges.length && state.status === STATUS.PLAYING; edge += 1)
      state = drawLine(state, edge);
    const restored = roundTrip(state);
    expect(restored.status).toBe(STATUS.WON);
    expect(restored.winners).toEqual(state.winners);
  });

  it('rejects broken payloads', () => {
    const state = JSON.parse(JSON.stringify(small()));
    expect(restoreGame(null)).toBeNull();
    expect(restoreGame('nope')).toBeNull();
    expect(restoreGame({ ...state, edges: state.edges.slice(1) })).toBeNull();
    expect(restoreGame({ ...state, players: [state.players[0]] })).toBeNull();
    expect(restoreGame({ ...state, edges: state.edges.map((_, i) => (i === 0 ? 9 : null)) })).toBeNull();
  });
});
