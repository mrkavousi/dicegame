import { useCallback, useEffect, useState } from 'react';
import { VIEW, useGame } from './hooks/useGame.js';
import { AppHeader } from './components/Screens/AppHeader.jsx';
import { StartScreen } from './components/Screens/StartScreen.jsx';
import { WinnerScreen } from './components/Screens/WinnerScreen.jsx';
import { GameBoard } from './components/Game/GameBoard.jsx';
import { Modal } from './components/UI/Modal.jsx';

/**
 * App shell + view routing.
 *
 * setup → game → winner. The rules and timing live in `useGame`; this component
 * only decides which screen is on stage and handles the "abandon game?" confirm.
 */
export default function App() {
  const game = useGame();
  const [confirmRestart, setConfirmRestart] = useState(false);

  const isPlaying = game.view === VIEW.GAME;

  // Paint the document background to match the active theme.
  useEffect(() => {
    document.body.classList.toggle('is-night', game.view === VIEW.WINNER);
    return () => document.body.classList.remove('is-night');
  }, [game.view]);

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
    <div className={`app-shell ${game.view === VIEW.WINNER ? 'theme-night' : ''}`}>
      <AppHeader
        muted={game.muted}
        onToggleMute={game.toggleMuted}
        onRestart={requestRestart}
        showRestart={game.view !== VIEW.SETUP}
      />

      <div className="app-main">
        {game.view === VIEW.SETUP ? (
          <StartScreen onStart={game.startGame} />
        ) : game.view === VIEW.WINNER && game.winner ? (
          <WinnerScreen
            winner={game.winner}
            loser={game.players[game.winner.index === 0 ? 1 : 0]}
            onPlayAgain={game.playAgain}
            onMainMenu={game.newGame}
          />
        ) : (
          <GameBoard game={game} />
        )}
      </div>

      <Modal
        open={confirmRestart}
        title="Start a new game?"
        description="This match will be abandoned. Scores cannot be recovered."
        onClose={() => setConfirmRestart(false)}
        actions={[
          { label: 'Keep playing', variant: 'secondary', onClick: () => setConfirmRestart(false), autofocus: true },
          { label: 'New game', variant: 'danger', onClick: confirmAndRestart },
        ]}
      />
    </div>
  );
}
