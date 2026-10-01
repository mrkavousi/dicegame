import { BUST_TONE } from './noticeUtils.js';
import './Notice.css';

/**
 * Transient feedback banner ("OH NO!", "+12 SECURED", "GAME RESTORED").
 * It is purely informational: `pointer-events: none` so it can never swallow a
 * tap, and it is announced to assistive tech through a live region.
 *
 * @param {object} props
 * @param {{id: number, tone: string, title: string, lines?: string[], turnLine?: string}|null} props.notice
 */
export function Notice({ notice }) {
  if (!notice) return null;

  const isAlert = notice.tone === BUST_TONE;
  const lines = notice.lines?.filter(Boolean) ?? [];

  return (
    <div
      key={notice.id}
      className={`notice notice--${notice.tone}`}
      role={isAlert ? 'alert' : 'status'}
      aria-live={isAlert ? 'assertive' : 'polite'}
    >
      <div className="notice__card">
        <p className="notice__title">{notice.title}</p>
        {lines.map((line) => (
          <p className="notice__line" key={line}>
            {line}
          </p>
        ))}
        {notice.turnLine ? <p className="notice__turn">{notice.turnLine}</p> : null}
      </div>
    </div>
  );
}

export default Notice;
