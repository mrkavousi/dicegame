/**
 * ============================================================================
 * Treasure Hunt — useHunt
 * ============================================================================
 * Orchestrates the pure engine for React: the hand-over window after a trapdoor
 * or a bank, the computer's thinking pauses, the input lock, autosave/resume,
 * sound and the B (bank) shortcut. Mirrors Pig's `useGame`, in a new skin.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../shared/i18n/index.jsx';
import { useScheduler } from '../../shared/hooks/useScheduler.js';
import { useSound } from '../../shared/hooks/useSound.jsx';
import { SOUND } from '../../shared/services/sound.js';
import { readJSON, removeKey, writeJSON } from '../../shared/services/storage.js';
import { MOVE, decideMove } from './bot.js';
import {
  EVENT,
  STATUS,
  bank,
  createGame,
  getBotLevel,
  getCurrentPlayer,
  isFinished,
  knowledge,
  normalizeConfig,
  openTile,
  rematch,
  restoreGame,
  settleTurn,
  toSetup,
} from './engine.js';

export const SAVE_KEY = 'hunt.game.v1';

/** Timings (ms). */
export const TIMINGS = {
  trap: 1300, // "oops" window after a trapdoor
  bank: 800, // short beat so the banked points register
  botThink: 800, // pause before each computer move
};

export const VIEW = Object.freeze({ SETUP: 'setup', GAME: 'game' });

/**
 * @param {{ storage?: boolean, onFinish?: (finished: object) => void }} [options]
 *        `onFinish` fires once when the game ends (used for stars).
 */
export function useHunt({ storage = true, onFinish } = {}) {
  const { t } = useI18n();
  const { play } = useSound();
  const { schedule, cancel, reset } = useScheduler();

  const [state, setState] = useState(() => {
    const saved = storage ? restoreGame(readJSON(SAVE_KEY)) : null;
    return saved && saved.status !== STATUS.SETUP ? saved : createGame({ status: STATUS.SETUP });
  });
  const stateRef = useRef(state);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (!storage) return;
    if (state.status === STATUS.SETUP) removeKey(SAVE_KEY);
    else writeJSON(SAVE_KEY, state);
  }, [state, storage]);

  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** After any move: sound, end-of-game handling, or the hand-over timer. */
  const afterMove = useCallback(
    (next) => {
      const event = next.lastEvent;
      if (next.status === STATUS.WON) {
        play(SOUND.WIN);
        onFinishRef.current?.(next);
        return;
      }
      if (event?.type === EVENT.TRAP) play(SOUND.BUST);
      else if (event?.type === EVENT.BANK) play(SOUND.BANK);
      else play(SOUND.ROLL);

      if (next.status === STATUS.SWITCHING) {
        const delay = event?.type === EVENT.TRAP ? TIMINGS.trap : TIMINGS.bank;
        schedule(() => commit(settleTurn(stateRef.current)), delay);
      }
    },
    [commit, play, schedule],
  );

  /* --------------------------------------------------------------- actions */

  const performOpen = useCallback(
    (index) => {
      const current = stateRef.current;
      const next = openTile(current, index);
      if (next === current) return;
      commit(next);
      afterMove(next);
    },
    [afterMove, commit],
  );

  const performBank = useCallback(() => {
    const current = stateRef.current;
    const next = bank(current);
    if (next === current) return;
    commit(next);
    afterMove(next);
  }, [afterMove, commit]);

  /** Human-facing actions: never allowed on the computer's turn. */
  const open = useCallback(
    (index) => {
      if (getBotLevel(stateRef.current)) return;
      performOpen(index);
    },
    [performOpen],
  );

  const bankPot = useCallback(() => {
    if (getBotLevel(stateRef.current)) return;
    performBank();
  }, [performBank]);

  /** Start a game; blank names get a default in the active language. */
  const startGame = useCallback(
    (seats, config) => {
      reset();
      const rules = normalizeConfig({ ...config, playerCount: seats.length, bots: seats.map((seat) => seat.bot) });
      const names = seats.map((seat, index) => {
        const typed = seat.name.trim();
        if (typed) return typed;
        return seat.bot ? t(`bot.${seat.bot}`) : t('player.default', { n: index + 1 });
      });
      commit(createGame({ playerNames: names, config: rules }));
    },
    [commit, reset, t],
  );

  const playAgain = useCallback(() => {
    reset();
    commit(rematch(stateRef.current));
  }, [commit, reset]);

  const changePlayers = useCallback(() => {
    reset();
    commit(toSetup(stateRef.current));
  }, [commit, reset]);

  /* ------------------------------------------------------------- reactions */

  // The computer's turn: think, then open a tile or bank. Every state change
  // re-runs this, so it keeps digging until it banks or hits a trapdoor.
  const botLevel = state.status === STATUS.PLAYING ? getBotLevel(state) : null;
  useEffect(() => {
    if (!botLevel) return undefined;
    const id = schedule(() => {
      const current = stateRef.current;
      if (current.status !== STATUS.PLAYING || getBotLevel(current) !== botLevel) return;
      const move = decideMove(current, botLevel);
      if (move.action === MOVE.BANK) performBank();
      else performOpen(move.index);
    }, TIMINGS.botThink);
    return () => cancel(id);
  }, [botLevel, state.status, state.moves, state.currentPlayer, schedule, cancel, performBank, performOpen]);

  // Keyboard: B banks.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
      if (key !== 'b' || stateRef.current.status === STATUS.SETUP) return;
      event.preventDefault();
      bankPot();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bankPot]);

  /* ------------------------------------------------------------------ view */

  return useMemo(
    () => ({
      state,
      view: state.status === STATUS.SETUP ? VIEW.SETUP : VIEW.GAME,
      current: getCurrentPlayer(state),
      isBotTurn: Boolean(getBotLevel(state)) && !isFinished(state),
      canOpen: state.status === STATUS.PLAYING && !getBotLevel(state),
      canBank: state.status === STATUS.PLAYING && !getBotLevel(state) && state.pot > 0,
      finished: isFinished(state),
      info: knowledge(state),
      startGame,
      open,
      bankPot,
      playAgain,
      changePlayers,
    }),
    [state, startGame, open, bankPot, playAgain, changePlayers],
  );
}

export default useHunt;
