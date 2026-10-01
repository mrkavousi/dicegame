/**
 * ============================================================================
 * Casino — stars & per-game stats (pure)
 * ============================================================================
 * Kid-friendly rewards: finishing a game earns stars (+3 win, +1 draw, +1 any
 * other finished game). Stars are only ever added — they cannot be spent or
 * lost — and there is no betting or currency of any kind.
 *
 * Shape: { stars, games: { [gameId]: { played, won } } }
 * ============================================================================
 */

export const OUTCOME = Object.freeze({ WIN: 'win', DRAW: 'draw', LOSS: 'loss' });

export const STARS_FOR = Object.freeze({
  [OUTCOME.WIN]: 3,
  [OUTCOME.DRAW]: 1,
  [OUTCOME.LOSS]: 1,
});

/** Upper bound that keeps a corrupted store from rendering absurd numbers. */
const MAX_COUNT = 1_000_000;

export const emptyRewards = () => ({ stars: 0, games: {} });

const count = (value) => Math.min(MAX_COUNT, Math.max(0, Math.trunc(Number(value) || 0)));

/**
 * Sanitise untrusted stored rewards.
 * @param {unknown} raw
 */
export function normalizeRewards(raw) {
  if (!raw || typeof raw !== 'object' || !raw.games || typeof raw.games !== 'object') return emptyRewards();
  const games = {};
  for (const [id, entry] of Object.entries(raw.games).slice(0, 50)) {
    if (!entry || typeof entry !== 'object') continue;
    games[id] = { played: count(entry.played), won: count(entry.won) };
  }
  return { stars: count(raw.stars), games };
}

/**
 * Record a finished game. Returns new rewards; the input is never mutated.
 * @param {ReturnType<typeof emptyRewards>} rewards
 * @param {string} gameId
 * @param {string} outcome one of OUTCOME
 */
export function recordResult(rewards, gameId, outcome) {
  const earned = STARS_FOR[outcome];
  if (earned === undefined || typeof gameId !== 'string' || gameId === '') return rewards;
  const previous = rewards.games[gameId] ?? { played: 0, won: 0 };
  return {
    stars: Math.min(MAX_COUNT, rewards.stars + earned),
    games: {
      ...rewards.games,
      [gameId]: {
        played: previous.played + 1,
        won: previous.won + (outcome === OUTCOME.WIN ? 1 : 0),
      },
    },
  };
}
