import { useMemo } from 'react';
import { EVENT_TYPE, GAME_STATUS, usesTwoDice } from '../../utils/gameLogic.js';
import { useI18n } from '../../i18n/index.jsx';
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
    config,
    targetScore,
    diceValue,
    diceValues,
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

  const { t, n } = useI18n();
  const current = players[currentPlayerIndex];
  const leaderIndex = useMemo(() => {
    const top = Math.max(...players.map((player) => player.score));
    const leaders = players.filter((player) => player.score === top);
    return leaders.length === 1 ? leaders[0].index : -1;
  }, [players]);
  const diceFaces = usesTwoDice(config) ? [diceValues?.[0] ?? null, diceValues?.[1] ?? null] : [diceValue];

  // One polite announcement per committed event — screen readers get the same
  // information sighted players read from the die and the pot.
  const announcement = useMemo(() => {
    if (!lastEvent) return '';
    switch (lastEvent.type) {
      case EVENT_TYPE.BUST:
        return t(lastEvent.snakeEyes ? 'ann.snake' : 'ann.bust', {
          name: lastEvent.playerName,
          lost: lastEvent.lostScore,
        });
      case EVENT_TYPE.BANK:
        return t('ann.bank', {
          name: lastEvent.playerName,
          amount: lastEvent.amount,
          total: lastEvent.totalScore,
        });
      default:
        return t('ann.roll', {
          name: lastEvent.playerName,
          faces: (lastEvent.values ?? [lastEvent.value]).map(n).join(t('ann.and')),
          pot: lastEvent.turnScore,
        });
    }
  }, [lastEvent, t, n]);

  return (
    <main className="board" aria-label={t('board.aria')}>
      <Notice notice={notice} />

      <div className="board__main">
        <section className="board__players" aria-label={t('board.players')} data-count={players.length}>
          {players.map((player, index) => (
            <PlayerCard
              key={player.id}
              player={player}
              isActive={index === currentPlayerIndex && !winner}
              isWinner={winner?.index === index}
              isLeader={index === leaderIndex}
              targetScore={targetScore}
              turnScore={index === currentPlayerIndex ? turnScore : 0}
              bumpKey={`${index}-${player.score}-${rollCount}`}
            />
          ))}
        </section>

        <section className="board__stage" aria-label={t('board.currentTurn')}>
          {game.seriesLength > 1 ? (
            <p className="board__series">
              {t('board.series', {
                len: game.seriesLength,
                game: game.gameNumber,
                scores: players.map((player) => `${player.name} ${n(game.seriesWins[player.index])}`).join(' – '),
              })}
            </p>
          ) : null}

          <p
            className={`board__turn board__turn--p${currentPlayerIndex + 1}`}
            key={`turn-${currentPlayerIndex}-${winner ? 'w' : ''}`}
          >
            <span className="board__turn-dot" aria-hidden="true" />
            <span className="board__turn-name">
              {winner ? t('board.wins', { name: winner.name }) : t('board.turn', { name: current.name })}
            </span>
          </p>

          <div className="board__dice">
            {diceFaces.map((face, index) => (
              <Dice key={index} value={face} mood={diceMood} rolling={isRolling} rollCount={rollCount} />
            ))}
          </div>

          <TurnScore turnScore={turnScore} lastEvent={lastEvent} bumpKey={rollCount} />

          <GameControls
            canRoll={canRoll}
            canBank={canBank}
            turnScore={turnScore}
            score={current.score}
            targetScore={targetScore}
            isRolling={isRolling}
            isSwitching={game.status === GAME_STATUS.SWITCHING}
            botName={game.isBotTurn ? current.name : null}
            canUndo={game.canUndo}
            onUndo={game.undo}
            onRoll={roll}
            onBank={bank}
          />
        </section>
      </div>

      <aside className="board__aside" aria-label={t('board.activity')}>
        <GameHistory history={history} />
        <p className="board__keys">
          {t('start.keyboard')} <kbd>R</kbd> {t('key.roll')} · <kbd>B</kbd> {t('key.bank')} · <kbd>U</kbd>{' '}
          {t('key.undo')} · <kbd>M</kbd> {t('key.mute')}
        </p>
      </aside>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}

export default GameBoard;
