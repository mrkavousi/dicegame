import { useState } from 'react';
import {
  DIFFICULTY,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TARGET_SCORES,
  SERIES_LENGTHS,
  VARIANT,
} from '../../utils/gameLogic.js';
import { useI18n } from '../../../../shared/i18n/index.jsx';
import { Button } from '../../../../shared/ui/Button.jsx';
import './PlayerSetup.css';

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

/** A row of radio "chips" — native inputs, so keyboard and screen readers just work. */
function ChoiceGroup({ legend, name, options, value, onChange }) {
  return (
    <fieldset className="setup__group">
      <legend className="label">{legend}</legend>
      <div className="setup__choices">
        {options.map((option) => (
          <label className="setup__choice" key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Game settings + name entry. Names are optional — empty fields fall back to
 * "Player N" in the rules layer, never here.
 *
 * @param {object} props
 * @param {string[]} [props.initialNames]
 * @param {import('../../utils/gameLogic.js').GameConfig} props.config
 * @param {(config: object) => void} props.onConfigChange
 * @param {(names: string[], config: object) => void} props.onStart
 */
export function PlayerSetup({ initialNames = [], config, onConfigChange, onStart }) {
  const { t, n } = useI18n();
  const [names, setNames] = useState(() => Array.from({ length: MAX_PLAYERS }, (_, i) => initialNames[i] ?? ''));

  const update = (index) => (event) => {
    const value = event.target.value;
    setNames((current) => current.map((name, i) => (i === index ? value : name)));
  };

  const variants = [
    { value: VARIANT.CLASSIC, label: t('variant.classic') },
    { value: VARIANT.TWO_DICE, label: t('variant.twoDice') },
  ];
  /** Who sits in each seat. The empty value is a human. */
  const seatTypes = [
    { value: '', label: t('setup.human') },
    ...Object.values(DIFFICULTY).map((level) => ({ value: level, label: t(`bot.${level}`) })),
  ];

  const setOption = (key) => (value) => onConfigChange({ ...config, [key]: value });

  const setSeat = (index) => (event) => {
    const bots = Array.from({ length: MAX_PLAYERS }, (_, i) => config.bots?.[i] ?? null);
    bots[index] = event.target.value || null;
    onConfigChange({ ...config, bots });
  };

  const submit = (event) => {
    event.preventDefault();
    onStart(names.slice(0, config.playerCount), config);
  };

  return (
    <form className="setup" onSubmit={submit} aria-labelledby="setup-heading">
      <h2 className="setup__heading label" id="setup-heading">
        {t('setup.heading')}
      </h2>

      <div className="setup__fields">
        {names.slice(0, config.playerCount).map((name, index) => {
          const bot = config.bots?.[index] ?? null;
          const fallback = bot ? t(`bot.${bot}`) : t('player.default', { n: index + 1 });
          return (
            <div className={`setup__field setup__field--p${index + 1}`} key={index}>
              <div className="setup__row">
                <label className="setup__label label" htmlFor={`player-${index + 1}-name`}>
                  {t('player.label', { n: index + 1 })}
                </label>
                <select
                  className="setup__seat"
                  aria-label={t('setup.type', { n: index + 1 })}
                  value={bot ?? ''}
                  onChange={setSeat(index)}
                >
                  {seatTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="setup__control">
                <span className="setup__avatar" aria-hidden="true">
                  {(name.trim().charAt(0) || n(index + 1)).toUpperCase()}
                </span>
                <input
                  id={`player-${index + 1}-name`}
                  className="setup__input"
                  type="text"
                  name={`player-${index + 1}-name`}
                  value={name}
                  onChange={update(index)}
                  placeholder={fallback}
                  maxLength={MAX_NAME_LENGTH}
                  autoComplete="off"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck="false"
                  enterKeyHint="go"
                  aria-describedby={`player-${index + 1}-hint`}
                />
              </div>
              <p className="setup__hint" id={`player-${index + 1}-hint`}>
                {t('setup.hint', { name: fallback })}
              </p>
            </div>
          );
        })}
      </div>

      <div className="setup__options">
        <ChoiceGroup
          legend={t('setup.players')}
          name="player-count"
          options={PLAYER_COUNTS.map((count) => ({ value: count, label: n(count) }))}
          value={config.playerCount}
          onChange={setOption('playerCount')}
        />
        <ChoiceGroup
          legend={t('setup.playTo')}
          name="target-score"
          options={TARGET_SCORES.map((score) => ({ value: score, label: n(score) }))}
          value={config.targetScore}
          onChange={setOption('targetScore')}
        />
        <ChoiceGroup
          legend={t('setup.variant')}
          name="variant"
          options={variants}
          value={config.variant}
          onChange={setOption('variant')}
        />
        <ChoiceGroup
          legend={t('setup.match')}
          name="series-length"
          options={SERIES_LENGTHS.map((length) => ({
            value: length,
            label: length === 1 ? t('series.single') : t('series.bestOf', { n: length }),
          }))}
          value={config.seriesLength ?? 1}
          onChange={setOption('seriesLength')}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" block>
        {t('setup.start')}
      </Button>
    </form>
  );
}

export default PlayerSetup;
