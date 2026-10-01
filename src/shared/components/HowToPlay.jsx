import './HowToPlay.css';

/**
 * A short "how to play" card for young readers: a numbered list inside a
 * native <details> (keyboard and screen-reader friendly, no JS state).
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string[]} props.steps already-translated sentences
 * @param {boolean} [props.defaultOpen]
 */
export function HowToPlay({ title, steps, defaultOpen = true }) {
  return (
    <details className="how" open={defaultOpen}>
      <summary className="how__summary">{title}</summary>
      <ol className="how__list">
        {steps.map((step) => (
          <li className="how__item" key={step}>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export default HowToPlay;
