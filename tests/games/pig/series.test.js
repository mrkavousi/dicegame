import { describe, expect, it } from 'vitest';
import {
  GAME_STATUS,
  applyRoll,
  bankScore,
  createGame,
  getSeriesWinner,
  normalizeConfig,
  resetGame,
  restoreGame,
  seriesWinsNeeded,
} from '../../../src/games/pig/utils/gameLogic.js';
import { emptyStats, leaderboard, normalizeStats, recordGame } from '../../../src/games/pig/utils/stats.js';

/** A game where seat `winner` is about to bank a winning pot. */
function winningGame(base, winner = 0) {
  const game = { ...base, currentPlayer: winner, turnScore: 10 };
  return bankScore({ ...game, players: game.players.map((p, i) => (i === winner ? { ...p, score: 95 } : p)) });
}

describe('series', () => {
  it('normalizes the series length', () => {
    expect(normalizeConfig({ seriesLength: 3 }).seriesLength).toBe(3);
    expect(normalizeConfig({ seriesLength: 4 }).seriesLength).toBe(1);
    expect(seriesWinsNeeded({ seriesLength: 5 })).toBe(3);
    expect(seriesWinsNeeded({ seriesLength: 1 })).toBe(1);
  });

  it('starts with no wins on game 1', () => {
    const game = createGame({ config: { seriesLength: 3 } });
    expect(game.seriesWins).toEqual([0, 0]);
    expect(game.gameNumber).toBe(1);
    expect(getSeriesWinner(game)).toBeNull();
  });

  it('credits the winner and decides a single game immediately', () => {
    const won = winningGame(createGame());
    expect(won.status).toBe(GAME_STATUS.WON);
    expect(won.seriesWins).toEqual([1, 0]);
    expect(getSeriesWinner(won)).toBe(0);
  });

  it('keeps a best-of-3 open until someone has two wins', () => {
    const first = winningGame(createGame({ config: { seriesLength: 3 } }));
    expect(getSeriesWinner(first)).toBeNull();

    const second = winningGame(resetGame(first, { nextGame: true }));
    expect(second.seriesWins).toEqual([2, 0]);
    expect(getSeriesWinner(second)).toBe(0);
  });

  it('next game keeps the score, bumps the counter and rotates the starting seat', () => {
    const first = winningGame(createGame({ playerNames: ['A', 'B'], config: { seriesLength: 3 } }));
    const next = resetGame(first, { nextGame: true });
    expect(next.gameNumber).toBe(2);
    expect(next.seriesWins).toEqual([1, 0]);
    expect(next.currentPlayer).toBe(1);
    expect(next.players.every((p) => p.score === 0)).toBe(true);
  });

  it('a plain reset starts a brand-new series', () => {
    const won = winningGame(createGame({ config: { seriesLength: 3 } }));
    const fresh = resetGame(won);
    expect(fresh.seriesWins).toEqual([0, 0]);
    expect(fresh.gameNumber).toBe(1);
  });

  it('restore counts a stored winner (legacy saves) and keeps series data', () => {
    const won = winningGame(createGame());
    const legacy = JSON.parse(JSON.stringify(won));
    delete legacy.seriesWins;
    expect(restoreGame(legacy).seriesWins).toEqual([1, 0]);

    const mid = JSON.parse(
      JSON.stringify({ ...createGame({ config: { seriesLength: 5 } }), seriesWins: [2, 1], gameNumber: 4 }),
    );
    expect(restoreGame(mid)).toMatchObject({ seriesWins: [2, 1], gameNumber: 4 });
  });
});

describe('lifetime stats', () => {
  const finished = (config) => winningGame(applyRoll(createGame({ playerNames: ['Alex', 'Sam'], config }), 6));

  it('records wins, games and best turn per human', () => {
    const stats = recordGame(emptyStats(), finished());
    expect(stats.games).toBe(1);
    expect(stats.byName.alex).toMatchObject({ games: 1, wins: 1 });
    expect(stats.byName.sam).toMatchObject({ games: 1, wins: 0 });
  });

  it('accumulates across games and matches names case-insensitively', () => {
    let stats = recordGame(emptyStats(), finished());
    const again = { ...finished(), players: finished().players.map((p) => ({ ...p, name: p.name.toUpperCase() })) };
    stats = recordGame(stats, again);
    expect(stats.byName.alex.games).toBe(2);
    expect(stats.byName.alex.wins).toBe(2);
  });

  it('ignores computer players, and games with no human', () => {
    const vsBot = finished({ bots: [null, 'hard'] });
    const stats = recordGame(emptyStats(), vsBot);
    expect(Object.keys(stats.byName)).toEqual(['alex']);
    expect(recordGame(emptyStats(), finished({ bots: ['easy', 'easy'] }))).toEqual(emptyStats());
  });

  it('sorts the leaderboard by wins and survives junk input', () => {
    const rows = leaderboard(recordGame(emptyStats(), finished()));
    expect(rows.map((r) => r.name)).toEqual(['Alex', 'Sam']);
    expect(normalizeStats('junk')).toEqual(emptyStats());
    expect(normalizeStats({ games: -4, byName: { x: { name: 'X', wins: 'many' }, y: 3 } })).toEqual({
      games: 0,
      byName: { x: { name: 'X', games: 0, wins: 0, rolls: 0, busts: 0, bestTurn: 0 } },
    });
  });
});
