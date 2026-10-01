import { describe, expect, it } from 'vitest';
import { MOVE, breakEvenPot, decideMove } from '../src/utils/bot.js';
import {
  BOT_NAMES,
  DIFFICULTY,
  VARIANT,
  applyRoll,
  createGame,
  getBotLevel,
  normalizeConfig,
  restoreGame,
} from '../src/utils/gameLogic.js';

/** A game where seat 0 (the bot under test) has `score` points and `pot` in the pot. */
function position({ level = DIFFICULTY.NORMAL, pot = 0, score = 0, rival = 0, variant, target = 100 } = {}) {
  const game = createGame({
    playerNames: ['Bot', 'Human'],
    config: { bots: [level, null], variant, targetScore: target },
  });
  return {
    ...game,
    turnScore: pot,
    players: game.players.map((player, index) => ({ ...player, score: index === 0 ? score : rival })),
  };
}

describe('bot seats in the config', () => {
  it('normalizes bots to the player count and valid levels', () => {
    expect(normalizeConfig({ playerCount: 3, bots: ['hard', 'nonsense'] }).bots).toEqual(['hard', null, null]);
    expect(normalizeConfig({ playerCount: 2, bots: ['easy', 'easy', 'easy'] }).bots).toEqual(['easy', 'easy']);
  });

  it('marks computer players and gives them a default name', () => {
    const game = createGame({ playerNames: ['', 'Sam'], config: { bots: ['hard', null] } });
    expect(game.players[0]).toMatchObject({ bot: 'hard', name: BOT_NAMES.hard });
    expect(game.players[1]).toMatchObject({ bot: null, name: 'Sam' });
    expect(getBotLevel(game)).toBe('hard');
  });

  it('keeps a typed name for a bot', () => {
    expect(createGame({ playerNames: ['Robo'], config: { bots: ['easy', null] } }).players[0].name).toBe('Robo');
  });

  it('survives save and restore', () => {
    const game = createGame({ config: { bots: [null, 'normal'] } });
    expect(restoreGame(JSON.parse(JSON.stringify(game))).players[1].bot).toBe('normal');
  });
});

describe('decideMove', () => {
  it('always rolls an empty pot', () => {
    for (const level of Object.values(DIFFICULTY)) {
      expect(decideMove(position({ level, pot: 0 }))).toBe(MOVE.ROLL);
    }
  });

  it('always banks a winning pot', () => {
    for (const level of Object.values(DIFFICULTY)) {
      expect(decideMove(position({ level, pot: 12, score: 90 }))).toBe(MOVE.BANK);
    }
  });

  it('normal holds at 20 in classic Pig', () => {
    expect(breakEvenPot({ variant: VARIANT.CLASSIC }, 0)).toBe(20);
    expect(decideMove(position({ pot: 19 }))).toBe(MOVE.ROLL);
    expect(decideMove(position({ pot: 20 }))).toBe(MOVE.BANK);
  });

  it('easy banks earlier than normal', () => {
    expect(decideMove(position({ level: DIFFICULTY.EASY, pot: 12 }))).toBe(MOVE.BANK);
    expect(decideMove(position({ level: DIFFICULTY.EASY, pot: 11 }))).toBe(MOVE.ROLL);
  });

  it('two-dice threshold shrinks as the total score grows (snake eyes risk)', () => {
    const config = { variant: VARIANT.TWO_DICE };
    expect(breakEvenPot(config, 0)).toBeGreaterThan(breakEvenPot(config, 90));
  });

  it('hard pushes on when a rival is about to win', () => {
    const state = position({ level: DIFFICULTY.HARD, pot: 25, score: 40, rival: 90 });
    expect(decideMove(state)).toBe(MOVE.ROLL);
    expect(decideMove(position({ level: DIFFICULTY.NORMAL, pot: 25, score: 40, rival: 90 }))).toBe(MOVE.BANK);
  });

  it('hard plays safe when far ahead', () => {
    const state = position({ level: DIFFICULTY.HARD, pot: 16, score: 60, rival: 10 });
    expect(decideMove(state)).toBe(MOVE.BANK);
    expect(decideMove({ ...state, players: state.players.map((p) => ({ ...p, bot: 'normal' })) })).toBe(MOVE.ROLL);
  });

  it('never decides outside a live turn', () => {
    const state = applyRoll(position({ pot: 5 }), 1); // switching
    expect(decideMove(state)).toBe(MOVE.ROLL);
  });
});
