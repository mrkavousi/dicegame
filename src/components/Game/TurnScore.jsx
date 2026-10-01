import { EVENT_TYPE } from '../../utils/gameLogic.js';
import { useI18n } from '../../i18n/index.jsx';
import './TurnScore.css';

/**
 * The pot — the points currently at risk this turn. The number is the biggest
 * type on the board after the score, so the risk is always legible.
 *
 * When the player rolls a 1 the burned amount floats away, which explains the
 * loss far better than a toast alone.
 *
 * @param {object} props
 * @param {number} props.turnScore
 * @param {object|null} props.lastEvent
 * @param {number} props.bumpKey
 */
export function TurnScore({ turnScore, lastEvent, bumpKey }) {
  const { t, n } = useI18n();
  const busted = lastEvent?.type === EVENT_TYPE.BUST && (lastEvent.lostScore ?? 0) > 0;
  const atRisk = turnScore > 0;

  return (
    <section className="turn-score" aria-labelledby="turn-score-heading">
      <h2 className="turn-score__heading label" id="turn-score-heading">
        {t('board.currentTurn')}
      </h2>

      <p
        className="turn-score__value"
        data-state={atRisk ? 'risk' : 'empty'}
        key={`pot-${bumpKey}`}
        aria-label={t('turn.aria', { n: turnScore })}
      >
        <span className="turn-score__sign" aria-hidden="true">
          {atRisk ? '+' : ''}
        </span>
        <span aria-hidden="true">{n(turnScore)}</span>
      </p>

      <p className="turn-score__hint">{atRisk ? t('turn.risk') : t('turn.safe')}</p>

      {busted ? (
        <span className="turn-score__ghost" key={`lost-${lastEvent.id}`} aria-hidden="true">
          −{n(lastEvent.lostScore)}
        </span>
      ) : null}
    </section>
  );
}

export default TurnScore;
