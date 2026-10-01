import { useMemo } from 'react';
import { EVENT_TYPE, GAME_STATUS } from '../../utils/gameLogic.js';
import { Notice } from '../UI/Notice.jsx';
import { Dice } from './Dice.jsx';
import { PlayerCard } from './PlayerCard.jsx';
import { TurnScore } from './TurnScore.jsx';
import { GameControls } from './GameControls.jsx';
import { GameHistory } from './GameHistory.jsx';
import './GameBoard.css';

/**
 * The play screen: who is up, the die, the pot, and the two actions.
 * Everything here is presentational — all state and timing lives in `useGame`.
 *
 * @param {object} props
 * @param {ReturnType<import('../../hooks/useGame.js').useGame>} props.game
 */
export function GameBoard({ game }) {
  const {
    players,
    currentPlayerIndex,
    turnScore,
    diceValue,
    diceMood,
    rollCount,
    isRolling,
    canRoll,
    canBank,
    lastEvent,
    history,
    notice,
    roll,
    bank,
    winner,
  } = game;

  const current = players[currentPlayerIndex];
  const leaderIndex = useMemo(() => {
    if (players[0].score === players[1].score) return -1;
    return players[0].score > players[1].score ? 0 : 1;
  }, [players]);

  // One polite announcement per committed event — screen readers get the same
  // information sighted players read from the die and the pot.
  const announcement = useMemo(() => {
    if (!lastEvent) return '';
    switch (lastEvent.type) {
      case EVENT_TYPE.BUST:
        return `${lastEvent.playerName} rolled a 1. ${lastEvent.lostScore} points lost. Turn passes.`;
      case EVENT_TYPE.BANK:
        return `${lastEvent.playerName} banked ${lastEvent.amount} points. Total score ${lastEvent.totalScore}.`;
      default:
        return `${lastEvent.playerName} rolled ${lastEvent.value}. Turn score ${lastEvent.turnScore}.`;
    }
  }, [lastEvent]);

  return (
    <main className="board" aria-label="Pig game board">
      <Notice notice={notice} />

      <div className="board__main">
        <section className="board__players" aria-label="Players">
          {players.map((player, index) => (
            <PlayerCard
              key={player.id}
              player={player}
              isActive={index === currentPlayerIndex && !winner}
              isWinner={winner?.index === index}
              isLeader={index === leaderIndex}
              turnScore={index === currentPlayerIndex ? turnScore : 0}
              bumpKey={`${index}-${player.score}-${rollCount}`}
            />
          ))}
        </section>

        <section className="board__stage" aria-label="Current turn">
          <p
            className={`board__turn board__turn--p${currentPlayerIndex + 1}`}
            key={`turn-${currentPlayerIndex}-${winner ? 'w' : ''}`}
          >
            <span className="board__turn-dot" aria-hidden="true" />
            {winner ? `${winner.name} wins!` : `${current.name}'s turn`}
          </p>

          <Dice value={diceValue} mood={diceMood} rolling={isRolling} rollCount={rollCount} />

          <TurnScore turnScore={turnScore} lastEvent={lastEvent} bumpKey={rollCount} />

          <GameControls
            canRoll={canRoll}
            canBank={canBank}
            turnScore={turnScore}
            score={current.score}
            isRolling={isRolling}
            isSwitching={game.status === GAME_STATUS.SWITCHING}
            onRoll={roll}
            onBank={bank}
          />
        </section>
      </div>

      <aside className="board__aside" aria-label="Recent activity">
        <GameHistory history={history} />
        <p className="board__keys">
          Press <kbd>R</kbd> to roll · <kbd>B</kbd> to bank · <kbd>M</kbd> to mute
        </p>
      </aside>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}

export default GameBoard;
