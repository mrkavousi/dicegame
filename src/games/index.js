/**
 * ============================================================================
 * Game registry
 * ============================================================================
 * The single list of games the casino knows about. The lobby renders its cards
 * from this array and the router resolves `#/<id>` against it — adding a game
 * means adding one entry here (plus its name/description in `casino/strings.js`).
 *
 * Entry shape:
 *   id       route + storage namespace (`#/pig`)
 *   icon     component drawn on the lobby card
 *   accent   1–4: which player-colour token tints the card
 *   ages     { from }          — shown as "Ages 6+"
 *   players  { min, max }      — shown as "Players: 2–4"
 *   component | load           — an eagerly imported component, or `() => import(...)`
 *                                for a lazily loaded (code-split) game
 * ============================================================================
 */

import { lazy } from 'react';
import { DiceIcon } from '../shared/ui/icons.jsx';
import PigGame from './pig/PigGame.jsx';
import { Connect4Icon } from './connect4/icon.jsx';
import { MemoryIcon } from './memory/icon.jsx';
import { HuntIcon } from './hunt/icon.jsx';

const ENTRIES = [
  {
    id: 'pig',
    icon: DiceIcon,
    accent: 1,
    ages: { from: 6 },
    players: { min: 2, max: 4 },
    component: PigGame,
  },
  {
    id: 'connect4',
    icon: Connect4Icon,
    accent: 2,
    ages: { from: 6 },
    players: { min: 2, max: 2 },
    load: () => import('./connect4/Connect4Game.jsx'),
  },
  {
    id: 'memory',
    icon: MemoryIcon,
    accent: 3,
    ages: { from: 6 },
    players: { min: 1, max: 4 },
    load: () => import('./memory/MemoryGame.jsx'),
  },
  {
    id: 'hunt',
    icon: HuntIcon,
    accent: 4,
    ages: { from: 7 },
    players: { min: 2, max: 4 },
    load: () => import('./hunt/HuntGame.jsx'),
  },
];

/** Lazily loaded games are wrapped once, here, so React keeps their identity stable. */
export const GAMES = Object.freeze(
  ENTRIES.map((entry) => (entry.component ? entry : { ...entry, component: lazy(entry.load) })),
);

/**
 * @param {string} path a route path such as `/pig`
 * @returns {typeof GAMES[number]|null}
 */
export function findGame(path) {
  return GAMES.find((game) => path === `/${game.id}`) ?? null;
}
