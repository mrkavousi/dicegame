import { IconButton } from '../UI/IconButton.jsx';
import { DiceIcon, RestartIcon, SoundOffIcon, SoundOnIcon } from '../UI/icons.jsx';
import './AppHeader.css';

/**
 * Sticky app bar: wordmark, sound toggle and "new game".
 * The wordmark is a logo rather than a heading — each screen owns its own h1.
 *
 * @param {object} props
 * @param {boolean} props.muted
 * @param {boolean} props.showRestart
 */
export function AppHeader({ muted, onToggleMute, onRestart, showRestart = true }) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <p className="app-header__brand">
          <span className="app-header__mark" aria-hidden="true">
            <DiceIcon />
          </span>
          <span className="app-header__name">Pig</span>
          <span className="app-header__tag">first to 100</span>
        </p>

        <div className="app-header__actions">
          <IconButton
            label={muted ? 'Turn sound on' : 'Turn sound off'}
            active={muted}
            onClick={onToggleMute}
            icon={muted ? <SoundOffIcon /> : <SoundOnIcon />}
          />
          {showRestart ? (
            <IconButton label="Start a new game" onClick={onRestart} icon={<RestartIcon />} />
          ) : null}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
