import { DICE_MOOD, WINNING_SCORE } from '../../utils/gameLogic.js';
import { Dice } from '../Game/Dice.jsx';
import { PlayerSetup } from '../Setup/PlayerSetup.jsx';
import { KeyboardIcon } from '../UI/icons.jsx';
import './StartScreen.css';

const RULES = [
  'Roll as often as you like. Every roll adds to your pot.',
  'Roll a 1 and your pot is gone — the turn passes to your opponent.',
  'Bank at any time to keep your points. First to 100 wins.',
];

/**
 * The front door: the pitch, the names, and the three rules — in one screen,
 * readable in a couple of seconds.
 *
 * @param {object} props
 * @param {(names: string[]) => void} props.onStart
 */
export function StartScreen({ onStart }) {
  return (
    <div className="start">
      <section className="start__hero" aria-labelledby="start-title">
        <Dice value={5} mood={DICE_MOOD.IDLE} />
        <h1 className="start__title" id="start-title">
          Pig
        </h1>
        <p className="start__tagline">Roll. Risk. Win.</p>
        <p className="start__lede">
          First to <strong>{WINNING_SCORE} points</strong> wins — but a single 1 wipes out everything you
          rolled this turn.
        </p>
      </section>

      <PlayerSetup onStart={onStart} />

      <section className="start__rules" aria-labelledby="rules-heading">
        <h2 className="start__rules-title label" id="rules-heading">
          How to play
        </h2>
        <ol className="start__rules-list">
          {RULES.map((rule, index) => (
            <li className="start__rule" key={rule}>
              <span className="start__rule-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="start__rule-text">{rule}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="start__shortcuts">
        <KeyboardIcon />
        <span>
          Keyboard: <kbd>R</kbd> roll · <kbd>B</kbd> bank · <kbd>M</kbd> mute
        </span>
      </p>
    </div>
  );
}

export default StartScreen;
