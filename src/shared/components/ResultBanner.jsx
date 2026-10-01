import { Button } from '../ui/Button.jsx';
import { TrophyIcon } from '../ui/icons.jsx';
import './ResultBanner.css';

/**
 * The end-of-game card: who won (or that it was a draw) and what to do next.
 * Announced politely to screen readers.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.text]
 * @param {boolean} [props.draw] calmer styling for a draw
 * @param {Array<{ label: string, onClick: () => void, variant?: string }>} props.actions
 */
export function ResultBanner({ title, text, draw = false, actions }) {
  return (
    <section className={`result ${draw ? 'result--draw' : ''}`} role="status" aria-live="polite">
      <span className="result__icon" aria-hidden="true">
        <TrophyIcon />
      </span>
      <h2 className="result__title">{title}</h2>
      {text ? <p className="result__text">{text}</p> : null}
      <div className="result__actions">
        {actions.map((action, index) => (
          <Button
            key={action.label}
            variant={action.variant ?? (index === 0 ? 'primary' : 'secondary')}
            size="lg"
            block
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </section>
  );
}

export default ResultBanner;
