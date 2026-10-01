import { useI18n } from '../i18n/index.jsx';
import './SeatPicker.css';

/** Difficulty levels a computer seat can have (same names every game uses). */
const LEVELS = ['easy', 'normal', 'hard'];

/**
 * One seat at the table: a name box and a Human / Bot (Easy · Normal · Hard) choice.
 * Blank names fall back to a default in the *game's* rules layer, never here.
 *
 * @param {object} props
 * @param {string} props.idPrefix unique per game, e.g. "c4"
 * @param {number} props.index 0-based seat
 * @param {number} [props.tone] 1–4: which player-colour tokens tint the seat (default index + 1)
 * @param {string} props.name
 * @param {string|null} props.bot
 * @param {boolean} [props.allowBot] set false for seats that must be human
 * @param {(next: { name: string, bot: string|null }) => void} props.onChange
 */
export function SeatPicker({ idPrefix, index, tone, name, bot, allowBot = true, onChange }) {
  const { t, n } = useI18n();
  const fallback = bot ? t(`bot.${bot}`) : t('player.default', { n: index + 1 });
  const id = `${idPrefix}-seat-${index + 1}`;

  return (
    <div className={`seat seat--t${tone ?? index + 1}`}>
      <div className="seat__row">
        <label className="seat__label label" htmlFor={`${id}-name`}>
          {t('player.label', { n: index + 1 })}
        </label>
        {allowBot ? (
          <select
            className="seat__type"
            aria-label={t('setup.type', { n: index + 1 })}
            value={bot ?? ''}
            onChange={(event) => onChange({ name, bot: event.target.value || null })}
          >
            <option value="">{t('setup.human')}</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`bot.${level}`)}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="seat__control">
        <span className="seat__avatar" aria-hidden="true">
          {(name.trim().charAt(0) || n(index + 1)).toUpperCase()}
        </span>
        <input
          id={`${id}-name`}
          className="seat__input"
          type="text"
          value={name}
          onChange={(event) => onChange({ name: event.target.value, bot })}
          placeholder={fallback}
          maxLength={14}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          enterKeyHint="go"
        />
      </div>
    </div>
  );
}

export default SeatPicker;
