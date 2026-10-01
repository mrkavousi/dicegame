import { describe, expect, it } from 'vitest';
import { OUTCOME, STARS_FOR, emptyRewards, normalizeRewards, recordResult } from '../../src/casino/rewards.js';

describe('recordResult', () => {
  it('awards 3 stars for a win, 1 for a draw or a loss', () => {
    expect(STARS_FOR).toEqual({ win: 3, draw: 1, loss: 1 });
    let rewards = recordResult(emptyRewards(), 'pig', OUTCOME.WIN);
    rewards = recordResult(rewards, 'pig', OUTCOME.DRAW);
    rewards = recordResult(rewards, 'pig', OUTCOME.LOSS);
    expect(rewards.stars).toBe(5);
    expect(rewards.games.pig).toEqual({ played: 3, won: 1 });
  });

  it('tracks each game separately', () => {
    let rewards = recordResult(emptyRewards(), 'pig', OUTCOME.WIN);
    rewards = recordResult(rewards, 'connect4', OUTCOME.LOSS);
    expect(rewards.games).toEqual({ pig: { played: 1, won: 1 }, connect4: { played: 1, won: 0 } });
  });

  it('never mutates its input', () => {
    const before = emptyRewards();
    recordResult(before, 'pig', OUTCOME.WIN);
    expect(before).toEqual({ stars: 0, games: {} });
  });

  it('ignores unknown outcomes and empty ids', () => {
    const before = emptyRewards();
    expect(recordResult(before, 'pig', 'jackpot')).toBe(before);
    expect(recordResult(before, '', OUTCOME.WIN)).toBe(before);
  });

  it('only ever adds stars', () => {
    let rewards = emptyRewards();
    for (const outcome of Object.values(OUTCOME)) {
      const next = recordResult(rewards, 'g', outcome);
      expect(next.stars).toBeGreaterThan(rewards.stars);
      rewards = next;
    }
  });
});

describe('normalizeRewards', () => {
  it('survives junk', () => {
    expect(normalizeRewards(null)).toEqual(emptyRewards());
    expect(normalizeRewards('x')).toEqual(emptyRewards());
    expect(normalizeRewards({ stars: 4 })).toEqual(emptyRewards());
  });

  it('clamps negative and non-numeric counts and drops bad entries', () => {
    const result = normalizeRewards({ stars: -5, games: { pig: { played: 'many', won: -2 }, bad: 7 } });
    expect(result).toEqual({ stars: 0, games: { pig: { played: 0, won: 0 } } });
  });

  it('round-trips valid data', () => {
    const data = { stars: 12, games: { pig: { played: 5, won: 3 } } };
    expect(normalizeRewards(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
});
