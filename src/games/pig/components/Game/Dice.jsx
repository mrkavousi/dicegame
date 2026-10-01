import { useEffect, useState } from 'react';
import { randomInt } from '../../../../shared/utils/random.js';
import { DICE_MOOD } from '../../utils/gameLogic.js';
import { useI18n } from '../../../../shared/i18n/index.jsx';
import useReducedMotion from '../../../../shared/hooks/useReducedMotion.js';
import './Dice.css';

/** Which of the nine grid cells carry a pip, per face. */
const PIP_MAP = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

const CELLS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * The die — the loudest element on the screen.
 *
 * `value` is the committed face (owned by game state). While `rolling` is true
 * the die tumbles and cycles faces locally for flavour; the final number is
 * never invented here, it always comes from the rules.
 *
 * @param {object} props
 * @param {number|null} props.value committed face, or null before the first roll
 * @param {string} [props.mood] one of DICE_MOOD
 * @param {boolean} [props.rolling]
 * @param {number} [props.rollCount] changes once per roll, used to replay the landing
 */
export function Dice({ value = null, mood = DICE_MOOD.IDLE, rolling = false, rollCount = 0 }) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const [face, setFace] = useState(value);

  // Local tumble: cycle random faces while the die is in the air.
  useEffect(() => {
    if (!rolling || reducedMotion) {
      setFace(value);
      return undefined;
    }
    setFace(randomInt(1, 6));
    const interval = setInterval(() => setFace(randomInt(1, 6)), 78);
    return () => clearInterval(interval);
  }, [rolling, reducedMotion, value]);

  const pips = face ? PIP_MAP[face] : [];
  const label = rolling ? t('dice.rolling') : value ? t('dice.showing', { n: value }) : t('dice.empty');

  const classes = ['dice', `dice--${mood}`, rolling ? 'is-rolling' : '', !rolling && rollCount > 0 ? 'is-landing' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="img" aria-label={label}>
      <div className="dice__cube" key={`${rollCount}-${rolling ? 'air' : 'landed'}`}>
        {face === null ? (
          <span className="dice__empty" aria-hidden="true">
            ?
          </span>
        ) : (
          <div className="dice__grid" aria-hidden="true">
            {CELLS.map((cell) => (
              <span key={cell} className={`dice__pip ${pips.includes(cell) ? 'is-on' : ''}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dice;
