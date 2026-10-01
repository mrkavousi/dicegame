/**
 * ============================================================================
 * Treasure Hunt — rules engine (pure, framework-free, unit-testable)
 * ============================================================================
 * A 5 × 5 field of tiles hides gems (worth 1, 2 or 3 points) and a few
 * trapdoors. It is Pig's push-your-luck idea in a new skin — and, like Pig,
 * there is nothing to bet: only points.
 *
 *  - On your turn, open tiles one at a time. A gem adds to your **pot**.
 *  - Open a trapdoor and the pot is lost; the turn passes.
 *  - **Bank** to move the pot into your score (and pass the turn).
 *  - When the last gem is found it is banked automatically and the game ends:
 *    the highest score wins (ties are shared).
 *
 * How many gems of each value exist is public (see `composition`), so a clever
 * player — or the computer — can work out the odds from what is still hidden
 * without ever peeking. Every function takes a state and returns a NEW state.
 * ============================================================================
 */

import { shuffle } from '../../shared/utils/random.js';

export const SIZE = 5;
export const CELLS = SIZE * SIZE;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_NAME_LENGTH = 14;

/** How many trapdoors hide in the field. */
export const DANGER = Object.freeze({ FEW: 'few', SOME: 'some', MANY: 'many' });
export const TRAPS_FOR = Object.freeze({ [DANGER.FEW]: 3, [DANGER.SOME]: 5, [DANGER.MANY]: 7 });

export const KIND = Object.freeze({ GEM: 'gem', TRAP: 'trap' });

/** setup → playing → switching (trap / bank feedback, input locked) → playing … → won */
export const STATUS = Object.freeze({
  SETUP: 'setup',
  PLAYING: 'playing',
  SWITCHING: 'switching',
  WON: 'won',
});

export const EVENT = Object.freeze({ GEM: 'gem', TRAP: 'trap', BANK: 'bank' });

export const DIFFICULTY = Object.freeze({ EASY: 'easy', NORMAL: 'normal', HARD: 'hard' });
const LEVELS = Object.values(DIFFICULTY);

const clampInt = (value, min, max, fallback) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

/**
 * @param {unknown} name
 * @param {number} index
 */
export function normalizeName(name, index) {
  const fallback = `Player ${index + 1}`;
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH);
  return trimmed.length > 0 ? trimmed : fallback;
}

/**
 * Safe config from untrusted/partial input.
 * @param {{ danger?: string, playerCount?: number, bots?: Array<string|null> }} [raw]
 */
export function normalizeConfig(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const playerCount = clampInt(input.playerCount, MIN_PLAYERS, MAX_PLAYERS, 2);
  return {
    danger: Object.hasOwn(TRAPS_FOR, input.danger) ? input.danger : DANGER.SOME,
    playerCount,
    bots: Array.from({ length: playerCount }, (_, index) =>
      Array.isArray(input.bots) && LEVELS.includes(input.bots[index]) ? input.bots[index] : null,
    ),
  };
}

/**
 * What the field contains — public knowledge, derived from the rules alone.
 * @param {{ danger: string }} config
 * @returns {{ traps: number, gems: { 1: number, 2: number, 3: number } }}
 */
export function composition(config) {
  const traps = TRAPS_FOR[config.danger];
  const gemCount = CELLS - traps;
  const threes = Math.floor(gemCount / 6);
  const twos = Math.floor(gemCount / 3);
  return { traps, gems: { 1: gemCount - threes - twos, 2: twos, 3: threes } };
}

/**
 * Lay out the hidden field: every tile is a trap or a gem with a value.
 * @param {{ danger: string }} config
 * @param {() => number} rng
 */
export function buildTiles(config, rng) {
  const { traps, gems } = composition(config);
  const tiles = [
    ...Array(traps).fill({ kind: KIND.TRAP, value: 0 }),
    ...Array(gems[1]).fill({ kind: KIND.GEM, value: 1 }),
    ...Array(gems[2]).fill({ kind: KIND.GEM, value: 2 }),
    ...Array(gems[3]).fill({ kind: KIND.GEM, value: 3 }),
  ];
  return shuffle(tiles, rng);
}

/* -------------------------------------------------------------------------- */
/* State                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * @param {{ playerNames?: string[], config?: object, status?: string,
 *           rng?: () => number, gameNumber?: number }} [options]
 */
export function createGame({
  playerNames = [],
  config,
  status = STATUS.PLAYING,
  rng = Math.random,
  gameNumber = 1,
} = {}) {
  const rules = normalizeConfig(config);
  const number = clampInt(gameNumber, 1, 999, 1);
  return {
    status,
    config: rules,
    players: Array.from({ length: rules.playerCount }, (_, index) => ({
      index,
      name: normalizeName(playerNames[index], index),
      bot: rules.bots[index],
      score: 0,
      traps: 0,
      bestPot: 0,
    })),
    /** The hidden contents — the UI only ever draws tiles whose `revealed` flag is set. */
    tiles: buildTiles(rules, rng),
    revealed: Array(CELLS).fill(false),
    pot: 0,
    // The first player rotates from game to game.
    currentPlayer: (number - 1) % rules.playerCount,
    moves: 0,
    lastEvent: null,
    winners: [],
    gameNumber: number,
  };
}

/** @param {object} state */
export const getCurrentPlayer = (state) => state.players[state.currentPlayer];

/** Difficulty of the player to move if it is a computer, else null. */
export const getBotLevel = (state) => getCurrentPlayer(state)?.bot ?? null;

export const isFinished = (state) => state.status === STATUS.WON;

/** Positions that are still hidden. @param {object} state */
export function hiddenTiles(state) {
  return state.revealed.map((shown, i) => (shown ? -1 : i)).filter((i) => i >= 0);
}

/**
 * What every player may know right now: how many tiles are hidden and how many
 * trapdoors / gems of each value are still among them (composition minus what
 * has been revealed). This never looks at hidden tiles.
 * @param {object} state
 */
export function knowledge(state) {
  const full = composition(state.config);
  const gems = { ...full.gems };
  let traps = full.traps;
  state.revealed.forEach((shown, i) => {
    if (!shown) return;
    const tile = state.tiles[i];
    if (tile.kind === KIND.TRAP) traps -= 1;
    else gems[tile.value] -= 1;
  });
  const gemsLeft = gems[1] + gems[2] + gems[3];
  const gemValueLeft = gems[1] + 2 * gems[2] + 3 * gems[3];
  return { hidden: traps + gemsLeft, trapsLeft: traps, gems, gemsLeft, gemValueLeft };
}

const nextPlayer = (state) => (state.currentPlayer + 1) % state.players.length;

/** Scores → winners (everyone sharing the top score). */
function finish(state) {
  const top = Math.max(...state.players.map((player) => player.score));
  return {
    ...state,
    status: STATUS.WON,
    winners: state.players.filter((player) => player.score === top).map((player) => player.index),
  };
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Open the tile at `index`.
 * Anti-bug: ignored unless the game is live, the tile exists and is still hidden.
 * @param {object} state
 * @param {number} index
 */
export function openTile(state, index) {
  if (state.status !== STATUS.PLAYING) return state;
  if (!Number.isInteger(index) || index < 0 || index >= CELLS || state.revealed[index]) return state;

  const tile = state.tiles[index];
  const player = state.currentPlayer;
  const revealed = state.revealed.slice();
  revealed[index] = true;
  const moves = state.moves + 1;
  const base = { ...state, revealed, moves };
  const gemsLeft = knowledge(base).gemsLeft;

  if (tile.kind === KIND.TRAP) {
    const lost = state.pot;
    const players = state.players.map((entry) =>
      entry.index === player ? { ...entry, traps: entry.traps + 1 } : entry,
    );
    const hit = {
      ...base,
      players,
      pot: 0,
      lastEvent: { type: EVENT.TRAP, tile: index, lost, player, id: moves },
    };
    // Nothing left to win: the game ends. Otherwise the turn passes after a short beat.
    if (gemsLeft === 0) return finish(hit);
    return { ...hit, status: STATUS.SWITCHING, currentPlayer: nextPlayer(state) };
  }

  const pot = state.pot + tile.value;
  const found = {
    ...base,
    pot,
    lastEvent: { type: EVENT.GEM, tile: index, value: tile.value, pot, player, id: moves },
  };
  if (gemsLeft > 0) return found;

  // The last gem: bank the pot automatically and end the game.
  const players = state.players.map((entry) =>
    entry.index === player ? { ...entry, score: entry.score + pot, bestPot: Math.max(entry.bestPot, pot) } : entry,
  );
  return finish({
    ...found,
    pot: 0,
    players,
    lastEvent: { type: EVENT.BANK, amount: pot, player, id: moves, auto: true },
  });
}

/**
 * Bank the pot into the player's score and pass the turn.
 * Anti-bug: only during a live turn, and never an empty pot.
 * @param {object} state
 */
export function bank(state) {
  if (state.status !== STATUS.PLAYING || state.pot <= 0) return state;
  const player = state.currentPlayer;
  const amount = state.pot;
  const moves = state.moves + 1;
  return {
    ...state,
    moves,
    pot: 0,
    status: STATUS.SWITCHING,
    currentPlayer: nextPlayer(state),
    players: state.players.map((entry) =>
      entry.index === player
        ? { ...entry, score: entry.score + amount, bestPot: Math.max(entry.bestPot, amount) }
        : entry,
    ),
    lastEvent: { type: EVENT.BANK, amount, player, id: moves },
  };
}

/** Close a hand-over window. Idempotent outside `switching`. @param {object} state */
export function settleTurn(state) {
  return state.status === STATUS.SWITCHING ? { ...state, status: STATUS.PLAYING } : state;
}

/**
 * Another game for the same players: a fresh field, the next player starts.
 * @param {object} state
 * @param {() => number} [rng]
 */
export function rematch(state, rng = Math.random) {
  return createGame({
    playerNames: state.players.map((player) => player.name),
    config: state.config,
    rng,
    gameNumber: state.gameNumber + 1,
  });
}

/** Back to setup, keeping names and seats. @param {object} state */
export function toSetup(state) {
  return createGame({
    playerNames: state.players.map((player) => player.name),
    config: state.config,
    status: STATUS.SETUP,
  });
}

/* -------------------------------------------------------------------------- */
/* Persistence                                                                 */
/* -------------------------------------------------------------------------- */

const count = (value, max = 100000) => clampInt(value, 0, max, 0);

/**
 * Rebuild a safe, playable state from untrusted stored data, or null.
 * The hidden field must contain exactly the public composition, so a tampered
 * save is rejected rather than trusted.
 * @param {unknown} raw
 */
export function restoreGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const config = normalizeConfig(raw.config);
  const { tiles, revealed, players } = raw;
  if (!Array.isArray(tiles) || tiles.length !== CELLS) return null;
  if (!Array.isArray(revealed) || revealed.length !== CELLS) return null;
  if (!Array.isArray(players) || players.length !== config.playerCount) return null;

  const expected = composition(config);
  const seen = { traps: 0, 1: 0, 2: 0, 3: 0 };
  for (const tile of tiles) {
    if (!tile || typeof tile !== 'object') return null;
    if (tile.kind === KIND.TRAP && tile.value === 0) seen.traps += 1;
    else if (tile.kind === KIND.GEM && [1, 2, 3].includes(tile.value)) seen[tile.value] += 1;
    else return null;
  }
  if (seen.traps !== expected.traps || [1, 2, 3].some((value) => seen[value] !== expected.gems[value])) return null;

  const base = createGame({ playerNames: players.map((player) => player?.name), config, gameNumber: raw.gameNumber });
  const state = {
    ...base,
    tiles: tiles.map((tile) => ({ kind: tile.kind, value: tile.value })),
    revealed: revealed.map((shown) => shown === true),
    players: base.players.map((player, i) => ({
      ...player,
      score: count(players[i]?.score),
      traps: count(players[i]?.traps),
      bestPot: count(players[i]?.bestPot),
    })),
    pot: count(raw.pot),
    currentPlayer: Number.isInteger(raw.currentPlayer) ? clampInt(raw.currentPlayer, 0, config.playerCount - 1, 0) : 0,
    moves: count(raw.moves),
    status: raw.status === STATUS.SETUP ? STATUS.SETUP : STATUS.PLAYING,
  };
  // A finished field is a finished game, whatever the payload claims.
  if (knowledge(state).gemsLeft === 0) return finish({ ...state, pot: 0 });
  return state;
}
