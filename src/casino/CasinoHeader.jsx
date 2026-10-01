import { useI18n } from '../shared/i18n/index.jsx';
import { useSound } from '../shared/hooks/useSound.jsx';
import { IconButton } from '../shared/ui/IconButton.jsx';
import { DiceIcon, HomeIcon, SoundOffIcon, SoundOnIcon, StarIcon } from '../shared/ui/icons.jsx';
import './CasinoHeader.css';

/**
 * Sticky app bar for the whole game hall: brand, a way home, the star count,
 * language and sound. A game may add its own buttons through the `slotRef`
 * (see `HeaderActions` in ShellContext).
 *
 * @param {object} props
 * @param {boolean} props.atHome true on the lobby (hides the home button)
 * @param {number} props.stars
 * @param {() => void} props.onHome
 * @param {(el: HTMLElement|null) => void} props.slotRef
 */
export function CasinoHeader({ atHome, stars, onHome, slotRef }) {
  const { t, n, toggleLang } = useI18n();
  const { muted, toggleMuted } = useSound();

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <p className="app-header__brand">
          <span className="app-header__mark" aria-hidden="true">
            <DiceIcon />
          </span>
          <span className="app-header__name">{t('hub.brand')}</span>
        </p>

        <div className="app-header__actions">
          <div className="app-header__game-actions" ref={slotRef} />
          {atHome ? null : <IconButton label={t('hub.home')} onClick={onHome} icon={<HomeIcon />} />}
          <p className="app-header__stars" aria-label={t('hub.stars', { n: stars })}>
            <StarIcon aria-hidden="true" />
            <span aria-hidden="true">{n(stars)}</span>
          </p>
          <IconButton
            label={t('lang.switch')}
            onClick={toggleLang}
            icon={<span className="app-header__lang">{t('lang.button')}</span>}
          />
          <IconButton
            label={muted ? t('header.soundOn') : t('header.soundOff')}
            active={muted}
            onClick={toggleMuted}
            icon={muted ? <SoundOffIcon /> : <SoundOnIcon />}
          />
        </div>
      </div>
    </header>
  );
}

export default CasinoHeader;
