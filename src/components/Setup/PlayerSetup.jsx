import { useState } from 'react';
import {
  BOT_NAMES,
  DIFFICULTY,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TARGET_SCORES,
  VARIANT,
} from '../../utils/gameLogic.js';
import { Button } from '../UI/Button.jsx';
import './PlayerSetup.css';

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

const VARIANTS = [
  { value: VARIANT.CLASSIC, label: 'Classic' },
  { value: VARIANT.TWO_DICE, label: 'Two dice' },
];

/** Who sits in each seat. The empty value is a human. */
const SEAT_TYPES = [
  { value: '', label: 'Human' },
  ...Object.values(DIFFICULTY).map((level) => ({ value: level, label: BOT_NAMES[level] })),
];

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
  const [names, setNames] = useState(() => Array.from({ length: MAX_PLAYERS }, (_, i) => initialNames[i] ?? ''));

  const update = (index) => (event) => {
    const value = event.target.value;
    setNames((current) => current.map((name, i) => (i === index ? value : name)));
  };

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
        Who is playing?
      </h2>

      <div className="setup__fields">
        {names.slice(0, config.playerCount).map((name, index) => {
          const bot = config.bots?.[index] ?? null;
          const fallback = bot ? BOT_NAMES[bot] : `Player ${index + 1}`;
          return (
            <div className={`setup__field setup__field--p${index + 1}`} key={index}>
              <div className="setup__row">
                <label className="setup__label label" htmlFor={`player-${index + 1}-name`}>
                  Player {index + 1}
                </label>
                <select
                  className="setup__seat"
                  aria-label={`Player ${index + 1} type`}
                  value={bot ?? ''}
                  onChange={setSeat(index)}
                >
                  {SEAT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="setup__control">
                <span className="setup__avatar" aria-hidden="true">
                  {(name.trim().charAt(0) || String(index + 1)).toUpperCase()}
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
                Leave empty to use “{fallback}”.
              </p>
            </div>
          );
        })}
      </div>

      <div className="setup__options">
        <ChoiceGroup
          legend="Players"
          name="player-count"
          options={PLAYER_COUNTS.map((count) => ({ value: count, label: String(count) }))}
          value={config.playerCount}
          onChange={setOption('playerCount')}
        />
        <ChoiceGroup
          legend="Play to"
          name="target-score"
          options={TARGET_SCORES.map((score) => ({ value: score, label: String(score) }))}
          value={config.targetScore}
          onChange={setOption('targetScore')}
        />
        <ChoiceGroup
          legend="Variant"
          name="variant"
          options={VARIANTS}
          value={config.variant}
          onChange={setOption('variant')}
        />
      </div>

      <Button type="submit" variant="primary" size="lg" block>
        Start game
      </Button>
    </form>
  );
}

export default PlayerSetup;
