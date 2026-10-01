import { useEffect, useMemo, useRef } from 'react';
import { WINNING_SCORE } from '../../utils/gameLogic.js';
import { createSeededRandom } from '../../utils/random.js';
import { Button } from '../UI/Button.jsx';
import { TrophyIcon } from '../UI/icons.jsx';
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
 * @param {object} props.loser
 * @param {() => void} props.onPlayAgain
 * @param {() => void} props.onMainMenu
 */
export function WinnerScreen({ winner, loser, onPlayAgain, onMainMenu }) {
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

        <p className="winner__eyebrow label">Game over</p>

        <h1 className="winner__title" id="winner-title" tabIndex={-1} ref={headingRef}>
          {winner.name} wins!
        </h1>

        <p className="winner__score">
          <span className="winner__score-value">{winner.score}</span>
          <span className="winner__score-label label">points</span>
        </p>

        <p className="winner__loser">
          <span className={`winner__dot winner__dot--p${loser.index + 1}`} aria-hidden="true" />
          {loser.name} finished on {loser.score} · {Math.max(0, WINNING_SCORE - loser.score)} to go
        </p>

        <dl className="winner__stats">
          {[winner, loser].map((player) => (
            <div className="winner__stat" key={player.id}>
              <dt className="label">{player.name}</dt>
              <dd>
                {player.stats.rolls} rolls · best turn {player.bestTurn}
              </dd>
            </div>
          ))}
        </dl>

        <div className="winner__actions">
          <Button variant="primary" size="lg" block onClick={onPlayAgain}>
            Play again
          </Button>
          <Button variant="secondary" size="lg" block onClick={onMainMenu}>
            Main menu
          </Button>
        </div>
      </section>
    </div>
  );
}

export default WinnerScreen;
