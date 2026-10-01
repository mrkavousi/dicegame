import { EVENT_TYPE } from '../../utils/gameLogic.js';
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
  const busted = lastEvent?.type === EVENT_TYPE.BUST && (lastEvent.lostScore ?? 0) > 0;
  const atRisk = turnScore > 0;

  return (
    <section className="turn-score" aria-labelledby="turn-score-heading">
      <h2 className="turn-score__heading label" id="turn-score-heading">
        Current turn
      </h2>

      <p
        className="turn-score__value"
        data-state={atRisk ? 'risk' : 'empty'}
        key={`pot-${bumpKey}`}
        aria-label={`Turn score ${turnScore}`}
      >
        <span className="turn-score__sign" aria-hidden="true">
          {atRisk ? '+' : ''}
        </span>
        <span aria-hidden="true">{turnScore}</span>
      </p>

      <p className="turn-score__hint">{atRisk ? 'At risk — bank it to keep it' : 'Nothing at risk yet'}</p>

      {busted ? (
        <span className="turn-score__ghost" key={`lost-${lastEvent.id}`} aria-hidden="true">
          −{lastEvent.lostScore}
        </span>
      ) : null}
    </section>
  );
}

export default TurnScore;
