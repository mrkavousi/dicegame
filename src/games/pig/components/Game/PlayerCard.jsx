import { WINNING_SCORE } from '../../utils/gameLogic.js';
import { useI18n } from '../../../../shared/i18n/index.jsx';
import { TrophyIcon } from '../../../../shared/ui/icons.jsx';
import './PlayerCard.css';

/**
 * One player's scoreboard: identity, total, live pot, progress and whose turn
 * it is. The active player is unmistakable; the waiting player stays quiet.
 *
 * @param {object} props
 * @param {{name: string, score: number, index: number}} props.player
 * @param {boolean} props.isActive
 * @param {number} [props.turnScore] live pot (only meaningful for the active player)
 * @param {boolean} [props.isWinner]
 * @param {boolean} [props.isLeader]
 * @param {number} [props.bumpKey] changes when the total score changes
 * @param {number} [props.targetScore] points needed to win
 */
export function PlayerCard({
  player,
  isActive,
  turnScore = 0,
  isWinner = false,
  isLeader = false,
  bumpKey = 0,
  targetScore = WINNING_SCORE,
}) {
  const { t, n } = useI18n();
  const progress = Math.min(100, (player.score / targetScore) * 100);
  const remaining = Math.max(0, targetScore - player.score);
  const initial = player.name.trim().charAt(0).toUpperCase() || n(player.index + 1);

  const classes = [
    'player-card',
    `player-card--p${player.index + 1}`,
    isActive ? 'is-active' : 'is-waiting',
    isWinner ? 'is-winner' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article className={classes} aria-label={t('player.aria', { name: player.name, points: player.score })}>
      <header className="player-card__head">
        <span className="player-card__avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="player-card__identity">
          <span className="player-card__label label">
            {t(player.bot ? 'player.labelBot' : 'player.label', { n: player.index + 1 })}
          </span>
          <span className="player-card__name">{player.name}</span>
        </span>
        <span className="player-card__status">
          {isWinner ? (
            <span className="player-card__chip player-card__chip--win">
              <TrophyIcon /> {t('player.chipWin')}
            </span>
          ) : isActive ? (
            <span className="player-card__chip player-card__chip--turn">{t('player.chipTurn')}</span>
          ) : (
            <span className="player-card__chip player-card__chip--waiting">{t('player.chipWait')}</span>
          )}
        </span>
      </header>

      <p className="player-card__score" key={`score-${bumpKey}`}>
        <span className="sr-only">{t('player.totalScore')}</span>
        {n(player.score)}
        {isLeader && !isWinner ? (
          <span className="player-card__crown" aria-label={t('player.highest')} role="img">
            <TrophyIcon />
          </span>
        ) : null}
      </p>

      {isActive && !isWinner ? (
        <p className="player-card__pot" data-empty={turnScore === 0 ? 'true' : 'false'}>
          <span className="label">{t('board.currentTurn')}</span>
          <span className="player-card__pot-value">{turnScore > 0 ? `+${n(turnScore)}` : n(0)}</span>
        </p>
      ) : null}

      <div className="player-card__progress">
        <div
          className="player-card__bar"
          role="progressbar"
          aria-valuenow={Math.round(player.score)}
          aria-valuemin={0}
          aria-valuemax={targetScore}
          aria-label={t('player.progress', { n: remaining })}
        >
          <span className="player-card__fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="player-card__remaining label">
          {isWinner ? t('player.winner') : t('player.toGo', { n: remaining })}
        </span>
      </div>
    </article>
  );
}

export default PlayerCard;
