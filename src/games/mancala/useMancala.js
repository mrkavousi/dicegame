/**
 * ============================================================================
 * Mancala — useMancala
 * ============================================================================
 * Orchestrates the pure engine for React: the sowing-animation window (input is
 * locked while stones move), the computer's thinking pause, autosave/resume,
 * sound and the 1–6 keys. Under reduced motion the window is just a short beat.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../shared/i18n/index.jsx';
import { useReducedMotion } from '../../shared/hooks/useReducedMotion.js';
import { useScheduler } from '../../shared/hooks/useScheduler.js';
import { useSound } from '../../shared/hooks/useSound.jsx';
import { SOUND } from '../../shared/services/sound.js';
import { readJSON, removeKey, writeJSON } from '../../shared/services/storage.js';
import { chooseMove } from './bot.js';
import {
  EVENT,
  STATUS,
  createGame,
  getBotLevel,
  getCurrentPlayer,
  isFinished,
  normalizeConfig,
  pitIndex,
  play as playPit,
  rematch,
  restoreGame,
  settle,
  toSetup,
} from './engine.js';

export const SAVE_KEY = 'mancala.game.v1';

/** Timings (ms). */
export const TIMINGS = {
  perStone: 140, // each stone drops with this delay (also used by the CSS animation)
  settle: 300, // a beat after the last stone
  reduced: 150, // the whole window under reduced motion
  botThink: 800, // pause before the computer moves
};

export const VIEW = Object.freeze({ SETUP: 'setup', GAME: 'game' });

/**
 * @param {{ storage?: boolean, onFinish?: (finished: object) => void }} [options]
 *        `onFinish` fires once when the game ends (used for stars).
 */
export function useMancala({ storage = true, onFinish } = {}) {
  const { t } = useI18n();
  const { play } = useSound();
  const reducedMotion = useReducedMotion();
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

  /* --------------------------------------------------------------- actions */

  const performMove = useCallback(
    (pit) => {
      const current = stateRef.current;
      const next = playPit(current, pit);
      if (next === current) return;
      commit(next);

      const event = next.lastEvent;
      if (next.status === STATUS.WON) {
        play(SOUND.WIN);
        onFinishRef.current?.(next);
        return;
      }
      play(event.type === EVENT.CAPTURE ? SOUND.BANK : event.type === EVENT.EXTRA ? SOUND.BANK : SOUND.ROLL);
      const wait = reducedMotion ? TIMINGS.reduced : event.path.length * TIMINGS.perStone + TIMINGS.settle;
      schedule(() => commit(settle(stateRef.current)), wait);
    },
    [commit, play, reducedMotion, schedule],
  );

  /** A person choosing a pit: never allowed on the computer's turn. */
  const choosePit = useCallback(
    (pit) => {
      if (getBotLevel(stateRef.current)) return;
      performMove(pit);
    },
    [performMove],
  );

  /** Start a game; blank names get a default in the active language. */
  const startGame = useCallback(
    (seats, config) => {
      reset();
      const rules = normalizeConfig({ ...config, bots: seats.map((seat) => seat.bot) });
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

  // The computer's turn: think, then play a pit. An extra turn re-runs this.
  const botLevel = state.status === STATUS.PLAYING ? getBotLevel(state) : null;
  useEffect(() => {
    if (!botLevel) return undefined;
    const id = schedule(() => {
      const current = stateRef.current;
      if (current.status !== STATUS.PLAYING || getBotLevel(current) !== botLevel) return;
      performMove(chooseMove(current, botLevel));
    }, TIMINGS.botThink);
    return () => cancel(id);
  }, [botLevel, state.status, state.moves, state.currentPlayer, schedule, cancel, performMove]);

  // Keyboard: 1–6 play the current player's pits (in sowing order).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const match = /^(?:Digit|Numpad)([1-6])$/.exec(event.code ?? '') ?? /^([1-6])$/.exec(event.key ?? '');
      const current = stateRef.current;
      if (!match || current.status === STATUS.SETUP) return;
      event.preventDefault();
      choosePit(pitIndex(current.currentPlayer, Number(match[1])));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choosePit]);

  /* ------------------------------------------------------------------ view */

  return useMemo(
    () => ({
      state,
      view: state.status === STATUS.SETUP ? VIEW.SETUP : VIEW.GAME,
      current: getCurrentPlayer(state),
      isBotTurn: Boolean(getBotLevel(state)) && !isFinished(state),
      canPlay: state.status === STATUS.PLAYING && !getBotLevel(state),
      finished: isFinished(state),
      startGame,
      choosePit,
      playAgain,
      changePlayers,
    }),
    [state, startGame, choosePit, playAgain, changePlayers],
  );
}

export default useMancala;
