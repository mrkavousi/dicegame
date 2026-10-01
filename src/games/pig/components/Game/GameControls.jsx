import { WINNING_SCORE } from '../../utils/gameLogic.js';
import { useI18n } from '../../../../shared/i18n/index.jsx';
import { Button } from '../../../../shared/ui/Button.jsx';
import { DiceIcon } from '../../../../shared/ui/icons.jsx';
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
 * @param {number} [props.targetScore] points needed to win
 * @param {boolean} props.isRolling
 * @param {boolean} props.isSwitching
 * @param {boolean} [props.canUndo] the last bank can be taken back
 * @param {() => void} [props.onUndo]
 * @param {string|null} [props.botName] set while a computer player is taking its turn
 */
export function GameControls({
  canRoll,
  canBank,
  turnScore,
  score,
  targetScore = WINNING_SCORE,
  isRolling,
  isSwitching,
  botName = null,
  canUndo = false,
  onUndo,
  onRoll,
  onBank,
}) {
  const { t } = useI18n();
  const wouldWin = score + turnScore >= targetScore && turnScore > 0;

  let hint = t('controls.hintIdle');
  if (isRolling) hint = t('controls.hintRolling');
  else if (isSwitching) hint = t('controls.hintSwitching');
  else if (botName) hint = t('controls.hintBot', { name: botName });
  else if (wouldWin) hint = t('controls.hintWin');
  else if (turnScore >= TEMPTING_POT) hint = t('controls.hintTempting', { n: turnScore });
  else if (turnScore > 0) hint = t('controls.hintPot', { n: turnScore });

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
        aria-label={t('controls.roll')}
      >
        {t('controls.roll')}
      </Button>

      <Button
        variant="bank"
        size="lg"
        block
        onClick={onBank}
        disabled={!canBank}
        pulse={canBank && turnScore >= TEMPTING_POT}
        shortcut="B"
        aria-label={turnScore > 0 ? t('controls.bankAria', { n: turnScore }) : t('controls.bank')}
      >
        {wouldWin ? t('controls.bankWin') : t('controls.bank')}
      </Button>

      {canUndo ? (
        <Button variant="ghost" onClick={onUndo} shortcut="U" aria-label={t('controls.undoAria')}>
          {t('controls.undo')}
        </Button>
      ) : null}

      <p className="controls__hint" role="status">
        {hint}
      </p>
    </div>
  );
}

export default GameControls;
