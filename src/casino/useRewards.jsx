import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { readJSON, writeJSON } from '../shared/services/storage.js';
import { emptyRewards, normalizeRewards, recordResult as recordResultPure } from './rewards.js';

export const REWARDS_KEY = 'casino.stats.v1';

const NOOP_VALUE = { rewards: emptyRewards(), recordResult: () => {} };
const RewardsContext = createContext(NOOP_VALUE);

/**
 * Holds stars + per-game stats for the whole app and persists them.
 * Without a provider `useRewards()` is a harmless no-op (games render in isolation).
 * @param {{ children: React.ReactNode, storage?: boolean }} props
 */
export function RewardsProvider({ children, storage = true }) {
  const [rewards, setRewards] = useState(() => (storage ? normalizeRewards(readJSON(REWARDS_KEY)) : emptyRewards()));
  const ref = useRef(rewards);

  const recordResult = useCallback(
    (gameId, outcome) => {
      const next = recordResultPure(ref.current, gameId, outcome);
      if (next === ref.current) return;
      ref.current = next;
      setRewards(next);
      if (storage) writeJSON(REWARDS_KEY, next);
    },
    [storage],
  );

  const value = useMemo(() => ({ rewards, recordResult }), [rewards, recordResult]);
  return <RewardsContext.Provider value={value}>{children}</RewardsContext.Provider>;
}

/** @returns {{ rewards: ReturnType<typeof emptyRewards>, recordResult: (gameId: string, outcome: string) => void }} */
export function useRewards() {
  return useContext(RewardsContext);
}
