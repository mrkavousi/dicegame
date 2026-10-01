import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '../../../../shared/i18n/index.jsx';
import { createSeededRandom } from '../../../../shared/utils/random.js';
import { Button } from '../../../../shared/ui/Button.jsx';
import { TrophyIcon } from '../../../../shared/ui/icons.jsx';
import './WinnerScreen.css';

/** Confetti palette — resolved from design tokens, never hard-coded here. */
const CONFETTI_COLORS = [
  'var(--confetti-1)',
  'var(--confetti-2)',
  'var(--confetti-3)',
  'var(--confetti-4)',
  'var(--confetti-5)',
  'var(--confetti-6)',
];

/**
 * Build a stable set of confetti pieces (seeded, so re-renders don't jump).
 * @param {number} count
 */
function buildConfetti(count) {
  const rng = createSeededRandom(20240607);
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    left: `${Math.round(rng() * 96) + 2}%`,
    delay: `${(rng() * 2.4).toFixed(2)}s`,
    duration: `${(2.6 + rng() * 1.8).toFixed(2)}s`,
    size: 8 + Math.round(rng() * 10),
    rotate: Math.round(rng() * 360),
    round: rng() > 0.6,
    color: CONFETTI_COLORS[Math.floor(rng() * CONFETTI_COLORS.length)],
  }));
}

/**
 * The celebration. Two clear ways forward, the final score in giant type and a
 * bit of confetti — then straight back into the next match.
 *
 * @param {object} props
 * @param {object} props.winner
 * @param {object[]} props.others everyone who did not win
 * @param {number} props.targetScore
 * @param {object[]} props.players everyone, in seat order
 * @param {{ length: number, wins: number[], gameNumber: number, winner: number|null }} props.series
 * @param {() => void} props.onPlayAgain
 * @param {() => void} props.onMainMenu
 */
export function WinnerScreen({ winner, others, targetScore, players, series, onPlayAgain, onMainMenu }) {
  const isSeries = series.length > 1;
  const matchOver = series.winner !== null;
  const { t, n } = useI18n();
  const headingRef = useRef(null);
  const confetti = useMemo(() => buildConfetti(34), []);

  // Move focus to the result so screen readers land on the announcement.
  useEffect(() => {
    headingRef.current?.focus?.();
  }, []);

  return (
    <div className="winner">
      <div className="winner__confetti" aria-hidden="true">
        {confetti.map((piece) => (
          <span
            key={piece.id}
            className={`winner__confetti-piece ${piece.round ? 'is-round' : ''}`}
            style={{
              left: piece.left,
              width: `${piece.size}px`,
              height: `${piece.size * (piece.round ? 1 : 0.45)}px`,
              background: piece.color,
              transform: `rotate(${piece.rotate}deg)`,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
            }}
          />
        ))}
      </div>

      <section className="winner__card theme-light" aria-labelledby="winner-title">
        <span className="winner__trophy" aria-hidden="true">
          <TrophyIcon />
        </span>

        <p className="winner__eyebrow label">
          {isSeries ? t('winner.eyebrowSeries', { n: series.gameNumber, len: series.length }) : t('winner.eyebrow')}
        </p>

        <h1 className="winner__title" id="winner-title" tabIndex={-1} ref={headingRef}>
          {t(isSeries && matchOver ? 'winner.titleMatch' : 'winner.title', { name: winner.name })}
        </h1>

        <p className="winner__score">
          <span className="winner__score-value">{n(winner.score)}</span>
          <span className="winner__score-label label">{t('winner.points')}</span>
        </p>

        {isSeries ? (
          <p className="winner__series" aria-label={t('winner.seriesAria')}>
            {players.map((player) => `${player.name} ${n(series.wins[player.index])}`).join(' – ')}
          </p>
        ) : null}

        {others.map((loser) => (
          <p className="winner__loser" key={loser.id}>
            <span className={`winner__dot winner__dot--p${loser.index + 1}`} aria-hidden="true" />
            {t('winner.finished', {
              name: loser.name,
              score: loser.score,
              n: Math.max(0, targetScore - loser.score),
            })}
          </p>
        ))}

        <dl className="winner__stats">
          {[winner, ...others].map((player) => (
            <div className="winner__stat" key={player.id}>
              <dt className="label">{player.name}</dt>
              <dd>{t('winner.stat', { rolls: player.stats.rolls, best: player.bestTurn })}</dd>
            </div>
          ))}
        </dl>

        <div className="winner__actions">
          <Button variant="primary" size="lg" block onClick={onPlayAgain}>
            {isSeries && !matchOver ? t('winner.next') : t('winner.again')}
          </Button>
          <Button variant="secondary" size="lg" block onClick={onMainMenu}>
            {t('winner.menu')}
          </Button>
        </div>
      </section>
    </div>
  );
}

export default WinnerScreen;
