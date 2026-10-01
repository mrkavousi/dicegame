/**
 * ============================================================================
 * PIG — Lifetime stats (pure)
 * ============================================================================
 * Aggregates finished games per player name. Computer players are not tracked.
 * Shape: { games, byName: { [key]: { name, games, wins, rolls, busts, bestTurn } } }
 * ============================================================================
 */

const MAX_TRACKED_PLAYERS = 50;

export const emptyStats = () => ({ games: 0, byName: {} });

const count = (value) => Math.max(0, Math.trunc(Number(value) || 0));

/** Case-insensitive identity for a player name. */
const keyOf = (name) => String(name).trim().toLowerCase();

/**
 * Sanitise untrusted stored stats.
 * @param {unknown} raw
 */
export function normalizeStats(raw) {
  if (!raw || typeof raw !== 'object' || !raw.byName || typeof raw.byName !== 'object') return emptyStats();
  const byName = {};
  for (const [key, entry] of Object.entries(raw.byName).slice(0, MAX_TRACKED_PLAYERS)) {
    if (!entry || typeof entry.name !== 'string') continue;
    byName[key] = {
      name: entry.name,
      games: count(entry.games),
      wins: count(entry.wins),
      rolls: count(entry.rolls),
      busts: count(entry.busts),
      bestTurn: count(entry.bestTurn),
    };
  }
  return { games: count(raw.games), byName };
}

/**
 * Record a finished game. Returns new stats; the input is never mutated.
 * @param {ReturnType<typeof emptyStats>} stats
 * @param {object} state a game in the WON state
 */
export function recordGame(stats, state) {
  const humans = state.players.filter((player) => !player.bot);
  if (humans.length === 0 || state.winnerIndex === null) return stats;

  const byName = { ...stats.byName };
  for (const player of humans) {
    const key = keyOf(player.name);
    const previous = byName[key] ?? { name: player.name, games: 0, wins: 0, rolls: 0, busts: 0, bestTurn: 0 };
    byName[key] = {
      name: player.name,
      games: previous.games + 1,
      wins: previous.wins + (player.index === state.winnerIndex ? 1 : 0),
      rolls: previous.rolls + player.stats.rolls,
      busts: previous.busts + player.stats.busts,
      bestTurn: Math.max(previous.bestTurn, player.bestTurn),
    };
  }
  return { games: stats.games + 1, byName };
}

/**
 * Players sorted for display: most wins first, then best win rate.
 * @param {ReturnType<typeof emptyStats>} stats
 */
export function leaderboard(stats) {
  return Object.values(stats.byName).sort(
    (a, b) => b.wins - a.wins || b.wins / b.games - a.wins / a.games || a.name.localeCompare(b.name),
  );
}
