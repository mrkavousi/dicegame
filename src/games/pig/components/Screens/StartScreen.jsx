import { useState } from 'react';
import { DICE_MOOD, usesTwoDice } from '../../utils/gameLogic.js';
import { useI18n } from '../../../../shared/i18n/index.jsx';
import { Dice } from '../Game/Dice.jsx';
import { PlayerSetup } from '../Setup/PlayerSetup.jsx';
import { KeyboardIcon } from '../../../../shared/ui/icons.jsx';
import './StartScreen.css';

/** The three rules, worded for the current settings. */
function buildRules(config, t) {
  const twoDice = usesTwoDice(config);
  const who = config.playerCount === 2 ? 'opponent' : 'next';
  return [
    t(twoDice ? 'start.rule1.two' : 'start.rule1'),
    t(twoDice ? `start.rule2.two.${who}` : `start.rule2.${who}`),
    t('start.rule3', { target: config.targetScore }),
  ];
}

/**
 * The front door: the pitch, the names, and the three rules — in one screen,
 * readable in a couple of seconds.
 *
 * @param {object} props
 * @param {(names: string[], config: object) => void} props.onStart
 * @param {object} props.initialConfig the last-used game settings
 */
export function StartScreen({ onStart, initialConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const { t, n } = useI18n();
  const rules = buildRules(config, t);

  return (
    <div className="start">
      <section className="start__hero" aria-labelledby="start-title">
        <Dice value={5} mood={DICE_MOOD.IDLE} />
        <h1 className="start__title" id="start-title">
          {t('start.title')}
        </h1>
        <p className="start__tagline">{t('start.tagline')}</p>
        <p className="start__lede">
          {t('start.ledeBefore')}
          <strong>{t('start.ledeStrong', { target: config.targetScore })}</strong>
          {t('start.ledeAfter')}
        </p>
      </section>

      <PlayerSetup config={config} onConfigChange={setConfig} onStart={onStart} />

      <section className="start__rules" aria-labelledby="rules-heading">
        <h2 className="start__rules-title label" id="rules-heading">
          {t('start.rulesTitle')}
        </h2>
        <ol className="start__rules-list">
          {rules.map((rule, index) => (
            <li className="start__rule" key={rule}>
              <span className="start__rule-number" aria-hidden="true">
                {n(index + 1)}
              </span>
              <span className="start__rule-text">{rule}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="start__shortcuts">
        <KeyboardIcon />
        <span>
          {t('start.keyboard')} <kbd>R</kbd> {t('key.roll')} · <kbd>B</kbd> {t('key.bank')} · <kbd>U</kbd>{' '}
          {t('key.undo')} · <kbd>M</kbd> {t('key.mute')}
        </span>
      </p>
    </div>
  );
}

export default StartScreen;
