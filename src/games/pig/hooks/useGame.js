/**
 * ============================================================================
 * PIG — useGame
 * ============================================================================
 * The single orchestrator between the pure rules (`utils/gameLogic.js`) and the
 * React tree. It owns:
 *
 *  - the current game state (hydrated from localStorage when possible)
 *  - animation/feedback timing (the only place timers are allowed)
 *  - the input lock that makes double-clicks and race conditions impossible
 *  - sound + on-screen notices
 *
 * Components below this hook are presentational and never mutate game state.
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GAME_STATUS,
  applyRoll,
  bankScore as bankScoreLogic,
  canBank as canBankLogic,
  canRoll as canRollLogic,
  checkWinner,
  createGame,
  evaluateRoll,
  getCurrentPlayer,
  getBotLevel,
  getSeriesWinner,
  getTargetScore,
  nextPlayerIndex,
  normalizeConfig,
  resetGame,
  ROLL_OUTCOME,
  rollForConfig,
  resolveDiceMood,
  settleTurn,
  toSetup,
} from '../utils/gameLogic.js';
import { useI18n } from '../../../shared/i18n/index.jsx';
import { MOVE, decideMove } from '../utils/bot.js';
import { clearGame, loadConfig, loadGame, loadStats, saveConfig, saveGame, saveStats } from '../../../shared/services/storage.js';
import { emptyStats, recordGame } from '../utils/stats.js';
import { SOUND } from '../../../shared/services/sound.js';
import { useSound } from '../../../shared/hooks/useSound.jsx';

/** Every timing in the game, in one place (ms). */
export const TIMINGS = {
  roll: 460, // dice tumble — brief calls for 300–700ms
  rollReduced: 120, // …and a snappy version for reduced-motion players
  bust: 1250, // "OH NO" window after rolling a 1
  bankPause: 650, // short beat so the secured points register before the next turn
  winReveal: 900, // beat between the winning bank and the winner screen
  notice: 1700, // default toast lifetime
  botThink: 800, // pause before a computer player acts
};

/** Which top-level screen is visible. Derived — never stored. */
export const VIEW = Object.freeze({
  SETUP: 'setup',
  GAME: 'game',
  WINNER: 'winner',
});

/** Notice tones map onto semantic colours in the UI layer. */
export const NOTICE_TONE = Object.freeze({
  BUST: 'bust',
  BANK: 'bank',
  INFO: 'info',
});

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * @param {{ storage?: boolean }} [options]
 */
export function useGame({ storage = true } = {}) {
  const [state, setState] = useState(() => {
    if (storage) {
      const saved = loadGame();
      if (saved) return saved;
    }
    return createGame({ status: GAME_STATUS.SETUP, config: storage ? loadConfig() : undefined });
  });

  const [notice, setNotice] = useState(null);
  const [lifetimeStats, setLifetimeStats] = useState(() => (storage ? loadStats() : emptyStats()));
  // The position just before the last human bank — lets that one bank be taken back.
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [winnerRevealed, setWinnerRevealed] = useState(() => state.status === GAME_STATUS.WON);
  const { play, muted, toggleMuted, soundEnabled } = useSound();
  const { t } = useI18n();

  // ---- refs ----------------------------------------------------------------
  const stateRef = useRef(state);
  const guardRef = useRef(false);
  const statsRef = useRef(lifetimeStats);
  const timersRef = useRef(new Set());
  const generationRef = useRef(0);
  const noticeTimerRef = useRef(null);
  const noticeIdRef = useRef(0);
  const resumedRef = useRef(state.status !== GAME_STATUS.SETUP);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  // Keep the synchronous mirror fresh and drop the input lock once the state
  // produced by the last action has landed in the tree.
  useEffect(() => {
    stateRef.current = state;
    guardRef.current = false;
  }, [state]);

  /* ----------------------------------------------------------------- timers */

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => clearTimeout(id));
    timersRef.current.clear();
  }, []);

  const cancelTimer = useCallback((id) => {
    clearTimeout(id);
    timersRef.current.delete(id);
  }, []);

  /**
   * Schedule work that is automatically cancelled on unmount, on a new game,
   * or when a newer action has taken over (generation guard).
   */
  const schedule = useCallback((callback, delay) => {
    const generation = generationRef.current;
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      if (generation !== generationRef.current) return; // stale — a reset happened
      callback();
    }, delay);
    timersRef.current.add(id);
    return id;
  }, []);

  useEffect(
    () => () => {
      clearTimers();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    [clearTimers],
  );

  /* ---------------------------------------------------------------- notices */

  const showNotice = useCallback((next, { duration = TIMINGS.notice } = {}) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeIdRef.current += 1;
    setNotice({ ...next, id: noticeIdRef.current });
    if (duration !== Infinity) {
      noticeTimerRef.current = setTimeout(() => setNotice(null), duration);
    }
  }, []);

  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(null);
  }, []);

  /* ----------------------------------------------------------- persistence */

  useEffect(() => {
    if (!storage) return;
    saveGame(state);
  }, [state, storage]);

  // "Game restored" toast on the first mount after a refresh.
  useEffect(() => {
    if (!resumedRef.current) return;
    resumedRef.current = false;
    if (stateRef.current.status === GAME_STATUS.PLAYING) {
      showNotice(
        { tone: NOTICE_TONE.INFO, title: t('notice.restored'), lines: [t('notice.welcomeBack')] },
        { duration: 2400 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------------------------------------------- actions */

  /** Start a brand new match with the given (optional) names and settings. */
  const startGame = useCallback(
    (names = [], config) => {
      const rules = normalizeConfig(config ?? stateRef.current.config);
      if (storage) saveConfig(rules);
      generationRef.current += 1;
      clearTimers();
      dismissNotice();
      setWinnerRevealed(false);
      setUndoSnapshot(null);
      // Blank names get a default in the active language ("Player 2", "بازیکن ۲", "Bot · Hard"…).
      const named = Array.from({ length: rules.playerCount }, (_, index) => {
        const typed = typeof names[index] === 'string' ? names[index].trim() : '';
        if (typed) return typed;
        const bot = rules.bots[index];
        return bot ? t(`bot.${bot}`) : t('player.default', { n: index + 1 });
      });
      const next = createGame({ playerNames: named, status: GAME_STATUS.PLAYING, config: rules });
      stateRef.current = next;
      setState(next);
      clearGame();
    },
    [clearTimers, dismissNotice, storage, t],
  );

  /** Roll the die. Resolves after the tumble animation has committed. */
  const performRoll = useCallback(() => {
    const current = stateRef.current;
    if (guardRef.current || !canRollLogic(current)) return; // anti double-click
    guardRef.current = true;

    const rolled = rollForConfig(current.config);
    const outcome = evaluateRoll(current.config, rolled);
    const playerCount = current.players.length;
    const loser = getCurrentPlayer(current);
    const potAtRisk = current.turnScore;

    // Lock input; the face is decided now and revealed when the die lands.
    setState((previous) => ({ ...previous, status: GAME_STATUS.ROLLING }));
    play(SOUND.ROLL);

    schedule(
      () => {
        setState((previous) => applyRoll(previous, rolled));

        if (outcome.kind !== ROLL_OUTCOME.ADD) {
          play(SOUND.BUST);
          const nextName = current.players[nextPlayerIndex(current.currentPlayer, playerCount)].name;
          const wiped = outcome.kind === ROLL_OUTCOME.WIPE;
          const lost = potAtRisk + (wiped ? loser.score : 0);
          showNotice(
            {
              tone: NOTICE_TONE.BUST,
              title: t(wiped ? 'notice.snake' : 'notice.bust'),
              lines: [
                t(wiped ? 'notice.rolledTwo' : 'notice.rolledOne', { name: loser.name }),
                lost > 0 ? t('notice.lost', { n: lost }) : t('notice.noneLost'),
              ],
              turnLine: t('notice.turn', { name: nextName }),
            },
            { duration: TIMINGS.bust + 650 },
          );
          // Hold the feedback, then let the next player act.
          schedule(() => setState((previous) => settleTurn(previous)), TIMINGS.bust);
        }
      },
      reducedMotion ? TIMINGS.rollReduced : TIMINGS.roll,
    );
  }, [play, reducedMotion, schedule, showNotice, t]);

  /** Bank the pot: secure the points and end the turn (or win). */
  const performBank = useCallback(() => {
    const current = stateRef.current;
    if (guardRef.current || !canBankLogic(current)) return; // anti double-click / empty pot
    guardRef.current = true;

    const player = getCurrentPlayer(current);
    const amount = current.turnScore;
    const total = player.score + amount;
    const next = bankScoreLogic(current);

    setState(next);
    play(SOUND.BANK);

    // Winning bank: record the result; the winner screen takes over (see the WON effect).
    if (next.status === GAME_STATUS.WON) {
      const updated = recordGame(statsRef.current, next);
      statsRef.current = updated;
      setLifetimeStats(updated);
      if (storage) saveStats(updated);
      setUndoSnapshot(null);
      return;
    }

    // One-step undo is for hot-seat games; with a computer in the mix it would
    // be racing the bot's turn.
    setUndoSnapshot(current.config.bots.some(Boolean) ? null : current);

    showNotice({
      tone: NOTICE_TONE.BANK,
      title: t('notice.secured', { n: amount }),
      lines: [player.name, t('notice.total', { n: total })],
      turnLine: t('notice.turn', { name: next.players[next.currentPlayer].name }),
    });

    // Short beat so the secured points are seen, then the next player may act.
    schedule(() => setState((previous) => settleTurn(previous)), TIMINGS.bankPause);
  }, [play, schedule, showNotice, storage, t]);

  // Human-facing actions: the computer's seat cannot be driven from the keyboard or buttons.
  const roll = useCallback(() => {
    if (getBotLevel(stateRef.current)) return;
    performRoll();
  }, [performRoll]);

  const bank = useCallback(() => {
    if (getBotLevel(stateRef.current)) return;
    performBank();
  }, [performBank]);

  // Computer turns: after a short "thinking" beat the bot rolls or banks. Every
  // state change (a roll landing, the turn settling) re-runs this, so a bot
  // keeps going until it banks or busts. Switching away cancels the pending move.
  const botLevel = getBotLevel(state);
  useEffect(() => {
    if (!botLevel || state.status !== GAME_STATUS.PLAYING) return undefined;
    const id = schedule(() => {
      const current = stateRef.current;
      if (getBotLevel(current) !== botLevel || current.status !== GAME_STATUS.PLAYING) return;
      if (decideMove(current) === MOVE.BANK) performBank();
      else performRoll();
    }, TIMINGS.botThink);
    return () => cancelTimer(id);
  }, [
    botLevel,
    state.status,
    state.currentPlayer,
    state.turnScore,
    state.rollCount,
    schedule,
    cancelTimer,
    performRoll,
    performBank,
  ]);

  /**
   * Take back the last bank (hot-seat games only): valid from the moment the
   * points are secured until the next player rolls.
   */
  const canUndo =
    undoSnapshot !== null &&
    !botLevel &&
    state.status !== GAME_STATUS.WON &&
    state.status !== GAME_STATUS.ROLLING &&
    state.rollCount === undoSnapshot.rollCount &&
    state.turnCount === undoSnapshot.turnCount + 1;

  const undo = useCallback(() => {
    const current = stateRef.current;
    if (!undoSnapshot || guardRef.current) return;
    if (current.status === GAME_STATUS.WON || current.status === GAME_STATUS.ROLLING) return;
    if (current.rollCount !== undoSnapshot.rollCount || current.turnCount !== undoSnapshot.turnCount + 1) return;
    generationRef.current += 1; // cancels the pending hand-over timer
    clearTimers();
    dismissNotice();
    stateRef.current = undoSnapshot;
    setState(undoSnapshot);
    setUndoSnapshot(null);
  }, [undoSnapshot, clearTimers, dismissNotice]);

  /** Wipe the lifetime stats. */
  const resetStats = useCallback(() => {
    const cleared = emptyStats();
    statsRef.current = cleared;
    setLifetimeStats(cleared);
    if (storage) saveStats(cleared);
  }, [storage]);

  /** Play again with the same players. */
  const playAgain = useCallback(() => {
    generationRef.current += 1;
    clearTimers();
    dismissNotice();
    setWinnerRevealed(false);
    setUndoSnapshot(null);
    // Mid-series this is "next game" (scores carry over); after the deciding game it starts a new series.
    setState((previous) => resetGame(previous, { keepNames: true, nextGame: getSeriesWinner(previous) === null }));
  }, [clearTimers, dismissNotice]);

  /** Back to the player setup screen (names are kept as a convenience). */
  const newGame = useCallback(() => {
    generationRef.current += 1;
    clearTimers();
    dismissNotice();
    setWinnerRevealed(false);
    setUndoSnapshot(null);
    setState((previous) => toSetup(previous));
    clearGame();
  }, [clearTimers, dismissNotice]);

  /* ------------------------------------------------------------- reactions */

  // Winning: celebrate, then reveal the winner screen after a short beat.
  useEffect(() => {
    if (state.status === GAME_STATUS.WON) {
      if (winnerRevealed) return;
      dismissNotice();
      play(SOUND.WIN);
      schedule(() => setWinnerRevealed(true), TIMINGS.winReveal);
      return;
    }
    if (winnerRevealed) setWinnerRevealed(false);
  }, [state.status, winnerRevealed, play, schedule, dismissNotice]);

  // Keyboard shortcuts: R = roll, B = bank, M = mute.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;

      // Prefer the physical key so the shortcuts also work on a Persian keyboard layout.
      const key = /^Key[A-Z]$/.test(event.code) ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
      if (key === 'm') {
        toggleMuted();
        return;
      }
      if (stateRef.current.status === GAME_STATUS.SETUP || winnerRevealed) return;
      if (key === 'r') {
        event.preventDefault();
        roll();
      } else if (key === 'b') {
        event.preventDefault();
        bank();
      } else if (key === 'u') {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [bank, roll, undo, toggleMuted, winnerRevealed]);

  /* ------------------------------------------------------------------ view */

  const view =
    state.status === GAME_STATUS.SETUP
      ? VIEW.SETUP
      : state.status === GAME_STATUS.WON && winnerRevealed
        ? VIEW.WINNER
        : VIEW.GAME;

  const winner = useMemo(() => checkWinner(state), [state]);

  const value = useMemo(
    () => ({
      // state
      state,
      view,
      status: state.status,
      players: state.players,
      currentPlayer: getCurrentPlayer(state),
      currentPlayerIndex: state.currentPlayer,
      opponentIndex: nextPlayerIndex(state.currentPlayer, state.players.length),
      config: state.config,
      targetScore: getTargetScore(state),
      diceValues: state.diceValues,
      turnScore: state.turnScore,
      diceValue: state.diceValue,
      diceMood: resolveDiceMood(state),
      rollCount: state.rollCount,
      turnCount: state.turnCount,
      history: state.history,
      lastEvent: state.lastEvent,
      winner,
      isRolling: state.status === GAME_STATUS.ROLLING,
      isAnimating: state.status === GAME_STATUS.ROLLING || state.status === GAME_STATUS.SWITCHING,
      // permissions
      canRoll: canRollLogic(state) && !botLevel,
      canBank: canBankLogic(state) && !botLevel,
      isBotTurn: Boolean(botLevel),
      canUndo,
      undo,
      lifetimeStats,
      resetStats,
      seriesWins: state.seriesWins,
      gameNumber: state.gameNumber,
      seriesLength: state.config.seriesLength,
      seriesWinner: getSeriesWinner(state),
      // feedback
      notice,
      dismissNotice,
      // sound
      muted,
      soundEnabled,
      toggleMuted,
      // actions
      startGame,
      roll,
      bank,
      playAgain,
      newGame,
    }),
    [
      state,
      view,
      winner,
      notice,
      dismissNotice,
      muted,
      soundEnabled,
      toggleMuted,
      botLevel,
      canUndo,
      undo,
      lifetimeStats,
      resetStats,
      startGame,
      roll,
      bank,
      playAgain,
      newGame,
    ],
  );

  return value;
}

export default useGame;
