/**
 * ============================================================================
 * Connect Four — useConnectFour
 * ============================================================================
 * The single orchestrator between the pure engine and the React tree: it owns
 * the game state, the falling-disc and "computer thinking" timers, the input
 * lock, autosave/resume, sound and the 1–7 keyboard shortcuts.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../shared/i18n/index.jsx';
import { useScheduler } from '../../shared/hooks/useScheduler.js';
import { useSound } from '../../shared/hooks/useSound.jsx';
import { SOUND } from '../../shared/services/sound.js';
import { readJSON, removeKey, writeJSON } from '../../shared/services/storage.js';
import { chooseMove } from './bot.js';
import {
  COLS,
  STATUS,
  createGame,
  drop,
  getBotLevel,
  getCurrentPlayer,
  isFinished,
  rematch,
  restoreGame,
  settleDrop,
  toSetup,
} from './engine.js';

export const SAVE_KEY = 'connect4.game.v1';

/** Timings (ms). */
export const TIMINGS = {
  drop: 450, // a disc falling; input is locked meanwhile
  botThink: 750, // pause before the computer plays
};

export const VIEW = Object.freeze({ SETUP: 'setup', GAME: 'game' });

/** Map a key event to a column (Digit1–7 / Numpad1–7 by physical key, else the typed digit). */
function columnFromKey(event) {
  const match = /^(?:Digit|Numpad)([1-7])$/.exec(event.code ?? '') ?? /^([1-7])$/.exec(event.key ?? '');
  return match ? Number(match[1]) - 1 : null;
}

/**
 * @param {{ storage?: boolean, onFinish?: (finished: object) => void }} [options]
 *        `onFinish` fires once when a game is won or drawn (used for stars).
 */
export function useConnectFour({ storage = true, onFinish } = {}) {
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

  // Autosave (the setup screen has nothing worth resuming).
  useEffect(() => {
    if (!storage) return;
    if (state.status === STATUS.SETUP) removeKey(SAVE_KEY);
    else writeJSON(SAVE_KEY, state);
  }, [state, storage]);

  /** Commit a new state synchronously so a second click in the same tick sees it. */
  const commit = useCallback((next) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /* --------------------------------------------------------------- actions */

  const performDrop = useCallback(
    (col) => {
      const current = stateRef.current;
      const next = drop(current, col);
      if (next === current) return; // locked, wrong column, or full column
      commit(next);

      if (next.status === STATUS.WON) {
        play(SOUND.WIN);
        onFinishRef.current?.(next);
      } else if (next.status === STATUS.DRAW) {
        play(SOUND.BUST);
        onFinishRef.current?.(next);
      } else {
        play(SOUND.BANK);
        schedule(() => commit(settleDrop(stateRef.current)), TIMINGS.drop);
      }
    },
    [commit, play, schedule],
  );

  /** A person clicking or pressing a key: never allowed on the computer's turn. */
  const dropDisc = useCallback(
    (col) => {
      if (getBotLevel(stateRef.current)) return;
      performDrop(col);
    },
    [performDrop],
  );

  /** Start a game; blank names get a default in the active language. */
  const startGame = useCallback(
    (seats) => {
      reset();
      const names = seats.map((seat, index) => {
        const typed = seat.name.trim();
        if (typed) return typed;
        return seat.bot ? t(`bot.${seat.bot}`) : t('player.default', { n: index + 1 });
      });
      commit(createGame({ playerNames: names, bots: seats.map((seat) => seat.bot) }));
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

  // The computer's turn: think for a moment, then drop a disc. Every state
  // change re-runs this, and leaving the turn (or the game) cancels the move.
  const botLevel = state.status === STATUS.PLAYING ? getBotLevel(state) : null;
  useEffect(() => {
    if (!botLevel) return undefined;
    const id = schedule(() => {
      const current = stateRef.current;
      if (current.status !== STATUS.PLAYING || getBotLevel(current) !== botLevel) return;
      performDrop(chooseMove(current, botLevel));
    }, TIMINGS.botThink);
    return () => cancel(id);
  }, [botLevel, state.moves, state.status, schedule, cancel, performDrop]);

  // Keyboard: 1–7 drop a disc.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const col = columnFromKey(event);
      if (col === null || stateRef.current.status === STATUS.SETUP) return;
      event.preventDefault();
      dropDisc(col);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dropDisc]);

  /* ------------------------------------------------------------------ view */

  return useMemo(
    () => ({
      state,
      view: state.status === STATUS.SETUP ? VIEW.SETUP : VIEW.GAME,
      current: getCurrentPlayer(state),
      isBotTurn: Boolean(getBotLevel(state)) && !isFinished(state),
      canDrop: state.status === STATUS.PLAYING && !getBotLevel(state),
      finished: isFinished(state),
      cols: COLS,
      startGame,
      dropDisc,
      playAgain,
      changePlayers,
    }),
    [state, startGame, dropDisc, playAgain, changePlayers],
  );
}

export default useConnectFour;
