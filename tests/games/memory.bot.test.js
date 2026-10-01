import { describe, expect, it } from 'vitest';
import { RECALL, chooseFlip } from '../../src/games/memory/bot.js';
import { STATUS, createGame, flip, flippable, resolve } from '../../src/games/memory/engine.js';
import { createSeededRandom } from '../../src/shared/utils/random.js';

/** Pairs sit at (0,1)(2,3)… so the layout is easy to reason about. */
function game(config = { bots: [null, 'hard'] }) {
  const base = createGame({ rng: createSeededRandom(1), config });
  return { ...base, deck: Array.from({ length: base.deck.length }, (_, i) => Math.floor(i / 2)) };
}

/** Show a few cards (as misses so they are `seen` but still hidden), then give the bot the turn. */
function afterSeeing(state, cards) {
  let current = state;
  for (let i = 0; i < cards.length; i += 2) {
    current = resolve(flip(flip(current, cards[i]), cards[i + 1]));
  }
  return { ...current, currentPlayer: 1 };
}

describe('chooseFlip', () => {
  it('always returns a flippable position, at every level', () => {
    const rng = createSeededRandom(4);
    for (const level of ['easy', 'normal', 'hard']) {
      let state = game();
      for (let step = 0; step < 40 && state.status !== STATUS.WON; step += 1) {
        const choice = chooseFlip(state, level, rng);
        expect(flippable(state), `${level} step ${step}`).toContain(choice);
        state = flip(state, choice);
        if (state.status === STATUS.CHECKING) state = resolve(state);
      }
    }
  });

  it('plays the only card left', () => {
    const state = game();
    const nearlyDone = {
      ...state,
      matched: state.matched.map((_, i) => (i < 14 ? 0 : null)),
      seen: state.seen.map(() => true),
    };
    expect(chooseFlip(nearlyDone, 'hard', () => 0)).toBe(14);
  });

  it('hard remembers a seen pair and starts with it', () => {
    // Cards 0,2 were seen, then 1 and 3 were seen: bot knows both halves of (0,1) and (2,3).
    const state = afterSeeing(game(), [0, 2, 1, 4]);
    const choice = chooseFlip(state, 'hard', () => 0.5);
    expect([0, 1]).toContain(choice);
  });

  it('hard completes a pair on the second flip when it remembers the twin', () => {
    // Card 6 was seen earlier; now card 7 (its twin) is face-up…
    let state = afterSeeing(game(), [6, 8]);
    state = flip(state, 7);
    expect(chooseFlip(state, 'hard', () => 0.5)).toBe(6);
  });

  it('does not know a card it has never seen: it explores unseen cards instead', () => {
    const state = flip({ ...game(), currentPlayer: 1 }, 7); // twin (6) was never seen
    const choice = chooseFlip(state, 'hard', () => 0.5);
    expect(choice).not.toBe(6); // it cannot know where the twin is… unless by luck of the draw
    expect(state.seen[choice]).toBe(false);
  });

  it('easy forgets most cards, hard forgets none (driven by the injected rng)', () => {
    let state = afterSeeing(game(), [6, 8]);
    state = flip(state, 7);
    // rng just under Easy's recall → remembered; just above → forgotten.
    expect(chooseFlip(state, 'easy', () => RECALL.easy - 0.01)).toBe(6);
    expect(chooseFlip(state, 'easy', () => RECALL.easy + 0.01)).not.toBe(6);
    expect(chooseFlip(state, 'hard', () => 0.999)).toBe(6);
  });

  it('is deterministic for the same rng', () => {
    const state = game();
    expect(chooseFlip(state, 'normal', createSeededRandom(8))).toBe(chooseFlip(state, 'normal', createSeededRandom(8)));
  });

  it('does not mutate the state', () => {
    const state = afterSeeing(game(), [0, 2]);
    const snapshot = JSON.stringify(state);
    chooseFlip(state, 'normal', createSeededRandom(2));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('strength', () => {
  /** Two computers play a whole game; return the pairs found by (a, b). */
  function duel(levelA, levelB, seed) {
    const rng = createSeededRandom(seed);
    let state = createGame({ rng, config: { size: '4x4', playerCount: 2, bots: [levelA, levelB] } });
    let guard = 0;
    while (state.status !== STATUS.WON && guard < 2000) {
      guard += 1;
      state = flip(state, chooseFlip(state, undefined, rng));
      if (state.status === STATUS.CHECKING) state = resolve(state);
    }
    return state;
  }

  it('finishes every game', () => {
    for (const seed of [1, 2, 3]) expect(duel('normal', 'hard', seed).status).toBe(STATUS.WON);
  });

  it('hard beats easy over several games', () => {
    let hard = 0;
    let easy = 0;
    for (let seed = 1; seed <= 8; seed += 1) {
      const result = duel('hard', 'easy', seed);
      hard += result.players[0].score;
      easy += result.players[1].score;
    }
    expect(hard).toBeGreaterThan(easy);
  });
});
