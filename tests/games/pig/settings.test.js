import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIG,
  EVENT_TYPE,
  GAME_STATUS,
  VARIANT,
  applyRoll,
  bankScore,
  createGame,
  evaluateRoll,
  normalizeConfig,
  resetGame,
  restoreGame,
  settleTurn,
  toSetup,
} from '../../../src/games/pig/utils/gameLogic.js';

const twoDice = (extra = {}) =>
  createGame({ playerNames: ['A', 'B'], config: { variant: VARIANT.TWO_DICE, ...extra } });

describe('config', () => {
  it('defaults to a classic 100-point, two-player game', () => {
    expect(createGame().config).toEqual(DEFAULT_CONFIG);
  });

  it('normalizes bad input into safe values', () => {
    expect(normalizeConfig({ targetScore: 'x', playerCount: 99, variant: 'nope' })).toEqual({
      targetScore: 100,
      playerCount: 4,
      variant: VARIANT.CLASSIC,
      bots: [null, null, null, null],
      seriesLength: 1,
    });
    expect(normalizeConfig({ targetScore: 5, playerCount: 1 })).toMatchObject({
      targetScore: 20,
      playerCount: 2,
    });
  });

  it('is kept by resetGame and toSetup', () => {
    const game = createGame({ config: { playerCount: 3, targetScore: 50 } });
    expect(resetGame(game).config).toEqual(game.config);
    expect(toSetup(game).config).toEqual(game.config);
    expect(toSetup(game).players).toHaveLength(3);
  });
});

describe('target score', () => {
  it('wins at the configured target', () => {
    let game = createGame({ playerNames: ['A', 'B'], config: { targetScore: 20 } });
    game = applyRoll(game, 6);
    game = applyRoll(game, 6);
    game = applyRoll(game, 6);
    game = applyRoll(game, 2);
    const banked = bankScore(game);
    expect(banked.status).toBe(GAME_STATUS.WON);
    expect(banked.winnerIndex).toBe(0);
  });

  it('does not win below the target', () => {
    let game = createGame({ config: { targetScore: 50 } });
    for (let i = 0; i < 4; i += 1) game = applyRoll(game, 6); // 24
    expect(bankScore(game).status).toBe(GAME_STATUS.SWITCHING);
  });
});

describe('multi-player turns', () => {
  it('rotates through every player', () => {
    let game = createGame({ playerNames: ['A', 'B', 'C'], config: { playerCount: 3 } });
    const order = [];
    for (let i = 0; i < 4; i += 1) {
      order.push(game.currentPlayer);
      game = settleTurn(applyRoll(game, 1));
    }
    expect(order).toEqual([0, 1, 2, 0]);
  });
});

describe('two-dice variant', () => {
  it('evaluates rolls', () => {
    const config = normalizeConfig({ variant: VARIANT.TWO_DICE });
    expect(evaluateRoll(config, [3, 4])).toMatchObject({ kind: 'add', points: 7 });
    expect(evaluateRoll(config, [1, 4])).toMatchObject({ kind: 'bust' });
    expect(evaluateRoll(config, [1, 1])).toMatchObject({ kind: 'wipe' });
    expect(evaluateRoll(config, 4)).toBeNull();
    expect(evaluateRoll(config, [0, 3])).toBeNull();
  });

  it('adds both dice to the pot', () => {
    const game = applyRoll(twoDice(), [3, 4]);
    expect(game.turnScore).toBe(7);
    expect(game.diceValues).toEqual([3, 4]);
    expect(game.lastEvent.type).toBe(EVENT_TYPE.ROLL);
  });

  it('a single 1 burns only the pot', () => {
    let game = twoDice();
    game = applyRoll(game, [6, 6]);
    game = bankScore(settleTurn(applyRoll(game, [2, 2]))) && bankScore(game);
    game = settleTurn(game); // B
    game = settleTurn(applyRoll(game, [1, 5])); // B busts → A
    expect(game.players[0].score).toBe(12);
    expect(game.currentPlayer).toBe(0);
  });

  it('snake eyes wipe the pot and the total score', () => {
    let game = twoDice();
    game = settleTurn(bankScore(applyRoll(game, [6, 6]))); // A banks 12, B up
    game = settleTurn(applyRoll(game, [1, 3])); // B busts → A
    game = applyRoll(game, [5, 5]); // A pot 10
    const wiped = applyRoll(game, [1, 1]);
    expect(wiped.players[0].score).toBe(0);
    expect(wiped.turnScore).toBe(0);
    expect(wiped.lastEvent).toMatchObject({ type: EVENT_TYPE.BUST, snakeEyes: true, lostScore: 22 });
    expect(wiped.currentPlayer).toBe(1);
  });

  it('rejects a single face', () => {
    const game = twoDice();
    expect(applyRoll(game, 4)).toBe(game);
  });
});

describe('restoreGame with config', () => {
  it('round-trips config and two-dice faces', () => {
    const game = applyRoll(twoDice({ targetScore: 150, playerCount: 3 }), [2, 5]);
    const restored = restoreGame(JSON.parse(JSON.stringify(game)));
    expect(restored.config).toEqual(game.config);
    expect(restored.players).toHaveLength(3);
    expect(restored.diceValues).toEqual([2, 5]);
  });

  it('upgrades legacy saves that have no config', () => {
    const legacy = JSON.parse(JSON.stringify(createGame({ playerNames: ['A', 'B'] })));
    delete legacy.config;
    expect(restoreGame(legacy).config).toEqual(DEFAULT_CONFIG);
  });

  it('rejects a player list that disagrees with the config', () => {
    const game = JSON.parse(JSON.stringify(createGame({ config: { playerCount: 3 } })));
    game.players.pop();
    expect(restoreGame(game)).toBeNull();
  });
});
