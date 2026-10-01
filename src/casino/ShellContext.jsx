import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

/**
 * What the casino shell offers the game on stage:
 *  - `slotEl`: a spot in the header where a game may place its own toolbar buttons
 *  - `setNight`: switch the whole shell (header included) to the night theme
 */
export const ShellContext = createContext({ slotEl: null, setNight: () => {} });

export const useShell = () => useContext(ShellContext);

/**
 * Render children into the header's game-actions slot (e.g. Pig's stats and
 * "new game" buttons). Renders nothing outside the casino shell.
 * @param {{ children: React.ReactNode }} props
 */
export function HeaderActions({ children }) {
  const { slotEl } = useShell();
  return slotEl ? createPortal(children, slotEl) : null;
}
