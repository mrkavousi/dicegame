import { useRef } from 'react';
import { useI18n } from '../../../shared/i18n/index.jsx';
import { KIND, SIZE } from '../engine.js';

/** Which neighbour an arrow key moves to (left/right swap in right-to-left languages). */
function neighbour(key, index, total, rtl) {
  const horizontal = rtl ? { ArrowLeft: 1, ArrowRight: -1 } : { ArrowLeft: -1, ArrowRight: 1 };
  const delta = key in horizontal ? horizontal[key] : key === 'ArrowDown' ? SIZE : key === 'ArrowUp' ? -SIZE : 0;
  const next = index + delta;
  // Stepping sideways must not wrap onto the next/previous row.
  const sideways = Math.abs(delta) === 1;
  if (delta === 0 || next < 0 || next >= total || (sideways && Math.floor(next / SIZE) !== Math.floor(index / SIZE))) {
    return null;
  }
  return next;
}

/** A small faceted gem; the colour depends on its value. */
function Gem({ value }) {
  return (
    <svg viewBox="0 0 24 24" className={`hunt-gem hunt-gem--v${value}`} aria-hidden="true" focusable="false">
      <path d="M6.5 4h11l4 5.5L12 21 2.5 9.5l4-5.5Z" />
      <path d="M2.5 9.5h19M9 4l-2 5.5L12 21M15 4l2 5.5L12 21" fill="none" />
    </svg>
  );
}

/**
 * The 5 × 5 treasure field. Hidden tiles are real buttons (Tab / Enter / Space,
 * arrow keys move around). A tile's contents are only drawn once it is revealed.
 *
 * @param {object} props
 * @param {object} props.state engine state
 * @param {boolean} props.canOpen false during hand-overs, on the computer's turn and after the game
 * @param {(index: number) => void} props.onOpen
 */
export function Board({ state, canOpen, onOpen }) {
  const { t, n, dir } = useI18n();
  const gridRef = useRef(null);
  const total = state.tiles.length;
  const last = state.lastEvent;

  const onKeyDown = (event) => {
    const index = Number(event.target.closest?.('[data-index]')?.dataset.index);
    if (!Number.isInteger(index)) return;
    const next = neighbour(event.key, index, total, dir === 'rtl');
    if (next === null) return;
    event.preventDefault();
    gridRef.current?.querySelector(`[data-index="${next}"]`)?.focus();
  };

  return (
    <div className="hunt-grid" ref={gridRef} role="group" aria-label={t('hunt.boardLabel')} onKeyDown={onKeyDown}>
      {state.tiles.map((tile, index) => {
        const shown = state.revealed[index];
        const isTrap = shown && tile.kind === KIND.TRAP;
        const label = !shown
          ? t('hunt.tileHidden', { n: index + 1 })
          : isTrap
            ? t('hunt.tileTrap', { n: index + 1 })
            : t('hunt.tileGem', { n: index + 1, value: tile.value });
        return (
          <button
            key={index}
            type="button"
            data-index={index}
            className={[
              'hunt-tile',
              shown ? 'is-open' : '',
              isTrap ? 'is-trap' : '',
              shown && !isTrap ? 'is-gem' : '',
              shown && last?.tile === index ? 'is-new' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={!canOpen || shown}
            aria-label={label}
            onClick={() => onOpen(index)}
          >
            {!shown ? (
              <span className="hunt-tile__lid" aria-hidden="true" />
            ) : isTrap ? (
              <span className="hunt-hole" aria-hidden="true" />
            ) : (
              <span className="hunt-found" aria-hidden="true">
                <Gem value={tile.value} />
                <span className="hunt-found__value">{n(tile.value)}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Board;
