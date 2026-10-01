import { useState } from 'react';
import { MAX_NAME_LENGTH } from '../../utils/gameLogic.js';
import { Button } from '../UI/Button.jsx';
import './PlayerSetup.css';

/**
 * Name entry for both players. Names are optional — empty fields fall back to
 * "Player 1" / "Player 2" in the rules layer, never here.
 *
 * @param {object} props
 * @param {string[]} [props.initialNames]
 * @param {(names: string[]) => void} props.onStart
 */
export function PlayerSetup({ initialNames = [], onStart }) {
  const [names, setNames] = useState([initialNames[0] ?? '', initialNames[1] ?? '']);

  const update = (index) => (event) => {
    const value = event.target.value;
    setNames((current) => current.map((name, i) => (i === index ? value : name)));
  };

  const submit = (event) => {
    event.preventDefault();
    onStart(names);
  };

  return (
    <form className="setup" onSubmit={submit} aria-labelledby="setup-heading">
      <h2 className="setup__heading label" id="setup-heading">
        Who is playing?
      </h2>

      <div className="setup__fields">
        {[0, 1].map((index) => (
          <div className={`setup__field setup__field--p${index + 1}`} key={index}>
            <label className="setup__label label" htmlFor={`player-${index + 1}-name`}>
              Player {index + 1}
            </label>
            <div className="setup__control">
              <span className="setup__avatar" aria-hidden="true">
                {(names[index].trim().charAt(0) || String(index + 1)).toUpperCase()}
              </span>
              <input
                id={`player-${index + 1}-name`}
                className="setup__input"
                type="text"
                name={`player-${index + 1}-name`}
                value={names[index]}
                onChange={update(index)}
                placeholder={`Player ${index + 1}`}
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
              Leave empty to use “Player {index + 1}”.
            </p>
          </div>
        ))}
      </div>

      <Button type="submit" variant="primary" size="lg" block>
        Start game
      </Button>
    </form>
  );
}

export default PlayerSetup;
