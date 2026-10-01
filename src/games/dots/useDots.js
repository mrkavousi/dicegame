/**
 * ============================================================================
 * Dots & Boxes — useDots
 * ============================================================================
 * Orchestrates the pure engine for React: the computer's thinking pause, the
 * input lock on its turn, autosave/resume and sound. (There is no hand-over
 * window: drawing a line is instant, and completing a box simply lets you go on.)
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../shared/i18n/index.jsx';
import { useScheduler } from '../../shared/hooks/useScheduler.js';
import { useSound } from '../../shared/hooks/useSound.jsx';
import { SOUND } from '../../shared/services/sound.js';
import { readJSON, removeKey, writeJSON } from '../../shared/services/storage.js';
import { chooseLine } from './bot.js';
import {
  EVENT,
  STATUS,
  createGame,
  drawLine,
  getBotLevel,
  getCurrentPlayer,
  isFinished,
  normalizeConfig,
  rematch,
  restoreGame,
  toSetup,
} from './engine.js';

export const SAVE_KEY = 'dots.game.v1';

/** Timings (ms). */
export const TIMINGS = {
  botThink: 650, // pause before each computer move
};

export const VIEW = Object.freeze({ SETUP: 'setup', GAME: 'game' });

/**
 * @param {{ storage?: boolean, onFinish?: (finished: object) => void }} [options]
 *        `onFinish` fires once when the last line is drawn (used for stars).
 */
export function useDots({ storage = true, onFinish } = {}) {
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

  /* --------------------------------------------------------------- actions */

  const performDraw = useCallback(
    (edge) => {
      const current = stateRef.current;
      const next = drawLine(current, edge);
      if (next === current) return;
      commit(next);
      if (next.status === STATUS.WON) {
        play(SOUND.WIN);
        onFinishRef.current?.(next);
      } else {
        play(next.lastEvent?.type === EVENT.BOX ? SOUND.BANK : SOUND.ROLL);
      }
    },
    [commit, play],
  );

  /** A person tapping a line: never allowed on the computer's turn. */
  const draw = useCallback(
    (edge) => {
      if (getBotLevel(stateRef.current)) return;
      performDraw(edge);
    },
    [performDraw],
  );

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

  // The computer's turn: think, then draw a line. Completing a box gives it
  // another move, so this re-runs after every move until the turn passes.
  const botLevel = state.status === STATUS.PLAYING ? getBotLevel(state) : null;
  useEffect(() => {
    if (!botLevel) return undefined;
    const id = schedule(() => {
      const current = stateRef.current;
      if (current.status !== STATUS.PLAYING || getBotLevel(current) !== botLevel) return;
      performDraw(chooseLine(current, botLevel));
    }, TIMINGS.botThink);
    return () => cancel(id);
  }, [botLevel, state.moves, state.currentPlayer, state.status, schedule, cancel, performDraw]);

  /* ------------------------------------------------------------------ view */

  return useMemo(
    () => ({
      state,
      view: state.status === STATUS.SETUP ? VIEW.SETUP : VIEW.GAME,
      current: getCurrentPlayer(state),
      isBotTurn: Boolean(getBotLevel(state)) && !isFinished(state),
      canDraw: state.status === STATUS.PLAYING && !getBotLevel(state),
      finished: isFinished(state),
      startGame,
      draw,
      playAgain,
      changePlayers,
    }),
    [state, startGame, draw, playAgain, changePlayers],
  );
}

export default useDots;
