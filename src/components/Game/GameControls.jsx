import { WINNING_SCORE } from '../../utils/gameLogic.js';
import { Button } from '../UI/Button.jsx';
import { DiceIcon } from '../UI/icons.jsx';
import './GameControls.css';

/** Pot size that deserves a nudge to bank. */
const TEMPTING_POT = 20;

/**
 * The two — and only two — actions the player can take.
 * Roll is always primary; Bank is a distinct colour and only lights up when
 * there is something worth protecting.
 *
 * @param {object} props
 * @param {boolean} props.canRoll
 * @param {boolean} props.canBank
 * @param {number} props.turnScore
 * @param {number} props.score current player's total
 * @param {boolean} props.isRolling
 * @param {boolean} props.isSwitching
 */
export function GameControls({ canRoll, canBank, turnScore, score, isRolling, isSwitching, onRoll, onBank }) {
  const wouldWin = score + turnScore >= WINNING_SCORE && turnScore > 0;

  let hint = 'Roll the die to build your pot.';
  if (isRolling) hint = 'Rolling…';
  else if (isSwitching) hint = 'Next player is up…';
  else if (wouldWin) hint = `Bank now to win the game!`;
  else if (turnScore >= TEMPTING_POT) hint = `${turnScore} points on the line — bank to keep them.`;
  else if (turnScore > 0) hint = `Bank to keep your ${turnScore} points, or push your luck.`;

  return (
    <div className="controls">
      <Button
        variant="primary"
        size="lg"
        block
        onClick={onRoll}
        disabled={!canRoll}
        icon={<DiceIcon />}
        shortcut="R"
        aria-label="Roll dice"
      >
        Roll dice
      </Button>

      <Button
        variant="bank"
        size="lg"
        block
        onClick={onBank}
        disabled={!canBank}
        pulse={canBank && turnScore >= TEMPTING_POT}
        shortcut="B"
        aria-label={`Bank points${turnScore > 0 ? `, ${turnScore} points` : ''}`}
      >
        {wouldWin ? 'Bank & win' : 'Bank points'}
      </Button>

      <p className="controls__hint" role="status">
        {hint}
      </p>
    </div>
  );
}

export default GameControls;
