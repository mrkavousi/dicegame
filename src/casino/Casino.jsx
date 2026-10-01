import { Suspense, useEffect, useMemo, useState } from 'react';
import { useI18n } from '../shared/i18n/index.jsx';
import { findGame } from '../games/index.js';
import { CasinoHeader } from './CasinoHeader.jsx';
import { Lobby } from './Lobby.jsx';
import { ShellContext } from './ShellContext.jsx';
import { useRewards } from './useRewards.jsx';
import { useRoute } from './router.js';
import './strings.js';

/**
 * The game hall shell: header + whichever screen the route points at
 * (the lobby, or one of the games from the registry).
 */
export function Casino() {
  const { t } = useI18n();
  const { rewards } = useRewards();
  const [path, navigate] = useRoute();
  const [slotEl, setSlotEl] = useState(null);
  const [nightRequested, setNight] = useState(false);

  const game = findGame(path);
  const Game = game?.component ?? null;
  // Only a game on stage can ask for the night theme; the lobby is always light.
  const night = Boolean(game) && nightRequested;

  // Paint the document background to match the active theme.
  useEffect(() => {
    document.body.classList.toggle('is-night', night);
    return () => document.body.classList.remove('is-night');
  }, [night]);

  const shell = useMemo(() => ({ slotEl, setNight }), [slotEl]);

  return (
    <ShellContext.Provider value={shell}>
      <div className={`app-shell ${night ? 'theme-night' : ''}`}>
        <CasinoHeader atHome={!game} stars={rewards.stars} onHome={() => navigate('/')} slotRef={setSlotEl} />

        <div className="app-main">
          {Game ? (
            <Suspense fallback={<p role="status">{t('hub.loading')}</p>}>
              <Game />
            </Suspense>
          ) : (
            <Lobby />
          )}
        </div>
      </div>
    </ShellContext.Provider>
  );
}

export default Casino;
