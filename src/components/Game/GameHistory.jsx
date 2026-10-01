import { useId, useState } from 'react';
import { EVENT_TYPE } from '../../utils/gameLogic.js';
import { ChevronIcon, DiceIcon } from '../UI/icons.jsx';
import './GameHistory.css';

/** How many entries the compact panel shows before it scrolls. */
const VISIBLE_LIMIT = 12;

/**
 * A small, quiet log of what just happened. Collapsed by default on phones,
 * expanded by default on large screens, and never allowed to steal the show.
 *
 * @param {object} props
 * @param {Array<object>} props.history newest first
 */
export function GameHistory({ history }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    try {
      return window.matchMedia('(min-width: 1024px)').matches;
    } catch {
      return false;
    }
  });

  const panelId = useId();
  const entries = history.slice(0, VISIBLE_LIMIT);

  return (
    <section className={`history ${open ? 'is-open' : ''}`} aria-labelledby={`${panelId}-title`}>
      <button
        type="button"
        className="history__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="history__icon" aria-hidden="true">
          <DiceIcon />
        </span>
        <span className="history__title label" id={`${panelId}-title`}>
          Last rolls
        </span>
        <span className="history__count label">{history.length}</span>
        <span className="history__chevron" aria-hidden="true">
          <ChevronIcon />
        </span>
      </button>

      <div className="history__body" id={panelId} hidden={!open}>
        {entries.length === 0 ? (
          <p className="history__empty">No rolls yet — take the first one.</p>
        ) : (
          <ol className="history__list">
            {entries.map((entry) => (
              <li className={`history__row history__row--${entry.type}`} key={entry.id}>
                <span className={`history__dot history__dot--p${entry.playerIndex + 1}`} aria-hidden="true" />
                <span className="history__text">{describe(entry)}</span>
                <span className="history__value">{valueOf(entry)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

/**
 * Human-readable one-liner for a log entry.
 * @param {object} entry
 */
function describe(entry) {
  switch (entry.type) {
    case EVENT_TYPE.BUST:
      return `${entry.playerName} rolled a 1 — pot lost`;
    case EVENT_TYPE.BANK:
      return `${entry.playerName} banked`;
    default:
      return `${entry.playerName} rolled`;
  }
}

/**
 * The number that matters for this entry.
 * @param {object} entry
 */
function valueOf(entry) {
  switch (entry.type) {
    case EVENT_TYPE.BUST:
      return entry.lostScore > 0 ? `−${entry.lostScore}` : '0';
    case EVENT_TYPE.BANK:
      return `+${entry.amount}`;
    default:
      return String(entry.value);
  }
}

export default GameHistory;
