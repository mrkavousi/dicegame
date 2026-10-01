import { useI18n } from '../shared/i18n/index.jsx';
import { StarIcon } from '../shared/ui/icons.jsx';
import { GAMES } from '../games/index.js';
import { navigate } from './router.js';
import { useRewards } from './useRewards.jsx';
import './strings.js';
import './Lobby.css';

/** "2–4" / "2" / "6+" — numbers go through `n()` so Persian shows Persian digits. */
function formatRange({ min, max }, n) {
  return min === max ? n(min) : `${n(min)}–${n(max)}`;
}

/**
 * The lobby: one big card per game, built from the registry.
 */
export function Lobby() {
  const { t, n } = useI18n();
  const { rewards } = useRewards();

  return (
    <main className="lobby" aria-labelledby="lobby-title">
      <header className="lobby__intro">
        <h1 className="lobby__title" id="lobby-title">
          {t('hub.title')}
        </h1>
        <p className="lobby__subtitle">{t('hub.subtitle')}</p>
      </header>

      <ul className="lobby__grid">
        {GAMES.map((game) => {
          const Icon = game.icon;
          const wins = rewards.games[game.id]?.won ?? 0;
          return (
            <li key={game.id}>
              <a
                className={`lobby-card lobby-card--a${game.accent}`}
                href={`#/${game.id}`}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(`/${game.id}`);
                }}
              >
                <span className="lobby-card__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="lobby-card__body">
                  <span className="lobby-card__name">{t(`game.${game.id}.name`)}</span>
                  <span className="lobby-card__desc">{t(`game.${game.id}.desc`)}</span>
                  <span className="lobby-card__meta">
                    <span className="lobby-card__chip">{t('hub.ages', { range: `${n(game.ages.from)}+` })}</span>
                    <span className="lobby-card__chip">
                      {t('hub.players', { range: formatRange(game.players, n) })}
                    </span>
                    {wins > 0 ? (
                      <span className="lobby-card__chip lobby-card__chip--wins">
                        <StarIcon aria-hidden="true" /> {t('hub.wins', { n: wins })}
                      </span>
                    ) : null}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

export default Lobby;
