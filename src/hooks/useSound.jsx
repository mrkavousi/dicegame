/**
 * Sound hook — exposes the app-wide SoundService through React context so the
 * header toggle and the game engine share exactly one audio state.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { soundService } from '../services/sound.js';
import { loadSettings, saveSettings } from '../services/storage.js';

const SoundContext = createContext(null);

/**
 * @param {{ children: React.ReactNode }} props
 */
export function SoundProvider({ children }) {
  const [settings, setSettings] = useState(() => loadSettings());

  // Keep the service in sync with the toggle.
  useEffect(() => {
    soundService.setMuted(settings.muted);
    saveSettings(settings);
  }, [settings]);

  // Browsers keep audio locked until the first user gesture — unlock on it.
  useEffect(() => {
    if (!settings.soundEnabled) return undefined;
    const unlock = () => {
      soundService.ensureContext();
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [settings.soundEnabled]);

  const toggleMuted = useCallback(() => {
    setSettings((current) => ({ ...current, muted: !current.muted }));
  }, []);

  const play = useCallback(
    (cue) => {
      if (!settings.soundEnabled) return;
      soundService.play(cue);
    },
    [settings.soundEnabled],
  );

  const value = useMemo(
    () => ({
      muted: settings.muted || !settings.soundEnabled,
      soundEnabled: settings.soundEnabled,
      toggleMuted,
      play,
    }),
    [settings.muted, settings.soundEnabled, toggleMuted, play],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/**
 * @returns {{ muted: boolean, soundEnabled: boolean, toggleMuted: () => void, play: (cue: string) => void }}
 */
export function useSound() {
  const context = useContext(SoundContext);
  // Safe fallback: a silent no-op implementation (used by isolated component tests).
  return (
    context ?? {
      muted: true,
      soundEnabled: false,
      toggleMuted: () => {},
      play: () => {},
    }
  );
}

export default useSound;
