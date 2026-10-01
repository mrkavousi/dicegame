import { useCallback, useEffect, useState } from 'react';
import { VIEW, useGame } from './hooks/useGame.js';
import { useI18n } from '../../shared/i18n/index.jsx';
import { HeaderActions, useShell } from '../../casino/ShellContext.jsx';
import { useRewards } from '../../casino/useRewards.jsx';
import { OUTCOME } from '../../casino/rewards.js';
import { StartScreen } from './components/Screens/StartScreen.jsx';
import { WinnerScreen } from './components/Screens/WinnerScreen.jsx';
import { GameBoard } from './components/Game/GameBoard.jsx';
import { Modal } from '../../shared/ui/Modal.jsx';
import { IconButton } from '../../shared/ui/IconButton.jsx';
import { ChartIcon, RestartIcon } from '../../shared/ui/icons.jsx';
import { StatsModal } from './components/Screens/StatsModal.jsx';

/**
 * The Pig table: view routing inside the game.
 *
 * setup → game → winner. The rules and timing live in `useGame`; this component
 * only decides which screen is on stage, adds Pig's buttons to the casino header
 * and handles the "abandon game?" confirm.
 */
export default function PigGame() {
  const { t } = useI18n();
  const { setNight } = useShell();
  const { recordResult } = useRewards();

  // A game won by a computer still earns the (human) players a consolation star.
  const onFinish = useCallback(
    (finished) => recordResult('pig', finished.players[finished.winnerIndex]?.bot ? OUTCOME.LOSS : OUTCOME.WIN),
    [recordResult],
  );
  const game = useGame({ onFinish });
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const isPlaying = game.view === VIEW.GAME;

  // The winner screen uses the night theme for the whole shell.
  useEffect(() => {
    setNight(game.view === VIEW.WINNER);
    return () => setNight(false);
  }, [game.view, setNight]);

  const requestRestart = useCallback(() => {
    if (isPlaying) {
      setConfirmRestart(true);
      return;
    }
    game.newGame();
  }, [game, isPlaying]);

  const confirmAndRestart = useCallback(() => {
    setConfirmRestart(false);
    game.newGame();
  }, [game]);

  return (
    <>
      <HeaderActions>
        <IconButton label={t('header.stats')} onClick={() => setShowStats(true)} icon={<ChartIcon />} />
        {game.view !== VIEW.SETUP ? (
          <IconButton label={t('header.newGame')} onClick={requestRestart} icon={<RestartIcon />} />
        ) : null}
      </HeaderActions>

      {game.view === VIEW.SETUP ? (
        <StartScreen onStart={game.startGame} initialConfig={game.config} />
      ) : game.view === VIEW.WINNER && game.winner ? (
        <WinnerScreen
          winner={game.winner}
          others={game.players.filter((player) => player.index !== game.winner.index)}
          targetScore={game.targetScore}
          players={game.players}
          series={{
            length: game.seriesLength,
            wins: game.seriesWins,
            gameNumber: game.gameNumber,
            winner: game.seriesWinner,
          }}
          onPlayAgain={game.playAgain}
          onMainMenu={game.newGame}
        />
      ) : (
        <GameBoard game={game} />
      )}

      <StatsModal
        open={showStats}
        stats={game.lifetimeStats}
        onClose={() => setShowStats(false)}
        onReset={game.resetStats}
      />

      <Modal
        open={confirmRestart}
        title={t('confirm.title')}
        description={t('confirm.body')}
        onClose={() => setConfirmRestart(false)}
        actions={[
          {
            label: t('confirm.keep'),
            variant: 'secondary',
            onClick: () => setConfirmRestart(false),
            autofocus: true,
          },
          { label: t('confirm.new'), variant: 'danger', onClick: confirmAndRestart },
        ]}
      />
    </>
  );
}
