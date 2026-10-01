/**
 * ============================================================================
 * Memory Match — useMemory
 * ============================================================================
 * Orchestrates the pure engine for React: the "both cards face-up" window, the
 * computer's thinking pauses, the input lock, autosave/resume and sound.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../shared/i18n/index.jsx';
import { useScheduler } from '../../shared/hooks/useScheduler.js';
import { useSound } from '../../shared/hooks/useSound.jsx';
import { SOUND } from '../../shared/services/sound.js';
import { readJSON, removeKey, writeJSON } from '../../shared/services/storage.js';
import { chooseFlip } from './bot.js';
import {
  STATUS,
  createGame,
  flip,
  getBotLevel,
  getCurrentPlayer,
  isFinished,
  normalizeConfig,
  rematch,
  resolve,
  restoreGame,
  toSetup,
} from './engine.js';

export const SAVE_KEY = 'memory.game.v1';

/** Timings (ms). */
export const TIMINGS = {
  reveal: 900, // both cards stay face-up so everyone can see them
  botThink: 650, // pause before each of the computer's flips
};

export const VIEW = Object.freeze({ SETUP: 'setup', GAME: 'game' });

/**
 * @param {{ storage?: boolean, onFinish?: (finished: object) => void }} [options]
 *        `onFinish` fires once when the last pair is found (used for stars).
 */
export function useMemory({ storage = true, onFinish } = {}) {
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

  // A reload mid-check must not strand the game: judge the two cards once on mount.
  useEffect(() => {
    if (stateRef.current.status === STATUS.CHECKING) commit(resolve(stateRef.current));
  }, [commit]);

  /* --------------------------------------------------------------- actions */

  const performFlip = useCallback(
    (index) => {
      const current = stateRef.current;
      const next = flip(current, index);
      if (next === current) return;
      commit(next);
      play(SOUND.ROLL);

      if (next.status !== STATUS.CHECKING) return;
      // Both cards are face-up: let everyone see them, then judge.
      schedule(() => {
        const judged = resolve(stateRef.current);
        commit(judged);
        if (judged.lastEvent?.type === 'match') play(SOUND.BANK);
        if (judged.status === STATUS.WON) {
          play(SOUND.WIN);
          onFinishRef.current?.(judged);
        }
      }, TIMINGS.reveal);
    },
    [commit, play, schedule],
  );

  /** A person tapping a card: never allowed on the computer's turn. */
  const flipCard = useCallback(
    (index) => {
      if (getBotLevel(stateRef.current)) return;
      performFlip(index);
    },
    [performFlip],
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

  // The computer's turn: think, flip a card — and again for the second one.
  const botLevel = state.status === STATUS.PLAYING ? getBotLevel(state) : null;
  useEffect(() => {
    if (!botLevel) return undefined;
    const id = schedule(() => {
      const current = stateRef.current;
      if (current.status !== STATUS.PLAYING || getBotLevel(current) !== botLevel) return;
      performFlip(chooseFlip(current, botLevel));
    }, TIMINGS.botThink);
    return () => cancel(id);
  }, [botLevel, state.status, state.flipped.length, state.moves, schedule, cancel, performFlip]);

  /* ------------------------------------------------------------------ view */

  return useMemo(
    () => ({
      state,
      view: state.status === STATUS.SETUP ? VIEW.SETUP : VIEW.GAME,
      current: getCurrentPlayer(state),
      isBotTurn: Boolean(getBotLevel(state)) && !isFinished(state),
      canFlip: state.status === STATUS.PLAYING && !getBotLevel(state),
      finished: isFinished(state),
      startGame,
      flipCard,
      playAgain,
      changePlayers,
    }),
    [state, startGame, flipCard, playAgain, changePlayers],
  );
}

export default useMemory;
