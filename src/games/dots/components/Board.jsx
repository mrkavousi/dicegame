import { useRef } from 'react';
import { useI18n } from '../../../shared/i18n/index.jsx';
import { horizontalCount } from '../engine.js';

/** Grid coordinates of a line inside the (2N+1)×(2N+1) layout (dots even/even, boxes odd/odd). */
function gridPosition(size, edge) {
  const h = horizontalCount(size);
  if (edge < h) return { gr: 2 * Math.floor(edge / size), gc: 2 * (edge % size) + 1 };
  const offset = edge - h;
  return { gr: 2 * Math.floor(offset / (size + 1)) + 1, gc: 2 * (offset % (size + 1)) };
}

/** The line at grid coordinates, or null if those coordinates are not a line. */
function edgeAt(size, gr, gc) {
  const last = 2 * size;
  if (gr < 0 || gc < 0 || gr > last || gc > last) return null;
  if (gr % 2 === 0 && gc % 2 === 1) return (gr / 2) * size + (gc - 1) / 2;
  if (gr % 2 === 1 && gc % 2 === 0) return horizontalCount(size) + ((gr - 1) / 2) * (size + 1) + gc / 2;
  return null;
}

/** Arrow keys step to the next line of the same kind in that direction (left/right swap in RTL). */
function neighbour(size, edge, key, rtl) {
  const { gr, gc } = gridPosition(size, edge);
  const horizontal = rtl ? { ArrowLeft: 2, ArrowRight: -2 } : { ArrowLeft: -2, ArrowRight: 2 };
  if (key in horizontal) return edgeAt(size, gr, gc + horizontal[key]);
  if (key === 'ArrowUp') return edgeAt(size, gr - 2, gc);
  if (key === 'ArrowDown') return edgeAt(size, gr + 2, gc);
  return null;
}

/**
 * The dots, lines and boxes. Every line is a real button (Tab / Enter / Space);
 * arrow keys hop between lines. Completed boxes show the owner's colour and initial.
 *
 * @param {object} props
 * @param {object} props.state engine state
 * @param {boolean} props.canDraw false on the computer's turn and after the game
 * @param {(edge: number) => void} props.onDraw
 */
export function Board({ state, canDraw, onDraw }) {
  const { t, dir } = useI18n();
  const gridRef = useRef(null);
  const { size } = state.config;
  const h = horizontalCount(size);
  const last = state.lastEvent;

  const onKeyDown = (event) => {
    const edge = Number(event.target.closest?.('[data-edge]')?.dataset.edge);
    if (!Number.isInteger(edge)) return;
    const next = neighbour(size, edge, event.key, dir === 'rtl');
    if (next === null) return;
    event.preventDefault();
    gridRef.current?.querySelector(`[data-edge="${next}"]`)?.focus();
  };

  const cells = [];
  for (let gr = 0; gr <= 2 * size; gr += 1) {
    for (let gc = 0; gc <= 2 * size; gc += 1) {
      const key = `${gr}-${gc}`;
      if (gr % 2 === 0 && gc % 2 === 0) {
        cells.push(<span key={key} className="dab-dot" aria-hidden="true" />);
      } else if (gr % 2 === 1 && gc % 2 === 1) {
        const box = ((gr - 1) / 2) * size + (gc - 1) / 2;
        const owner = state.boxes[box];
        cells.push(
          <span
            key={key}
            className={`dab-box ${owner !== null ? 'is-owned' : ''} ${owner !== null && last?.boxes?.includes(box) ? 'is-new' : ''}`}
            data-owner={owner ?? undefined}
            aria-hidden="true"
          >
            {owner !== null ? state.players[owner].name.trim().charAt(0).toUpperCase() : ''}
          </span>,
        );
      } else {
        const edge = edgeAt(size, gr, gc);
        const owner = state.edges[edge];
        const horizontal = edge < h;
        const position = horizontal ? { row: gr / 2 + 1, col: (gc + 1) / 2 } : { row: (gr + 1) / 2, col: gc / 2 + 1 };
        const base = t(horizontal ? 'dab.edgeH' : 'dab.edgeV', position);
        cells.push(
          <button
            key={key}
            type="button"
            data-edge={edge}
            data-owner={owner ?? undefined}
            className={`dab-edge dab-edge--${horizontal ? 'h' : 'v'} ${owner !== null ? 'is-drawn' : ''} ${last?.edge === edge ? 'is-new' : ''}`}
            disabled={!canDraw || owner !== null}
            aria-label={owner !== null ? t('dab.drawn', { label: base, name: state.players[owner].name }) : base}
            onClick={() => onDraw(edge)}
          />,
        );
      }
    }
  }

  return (
    <div
      className={`dab-board dab-board--${size}`}
      ref={gridRef}
      role="group"
      aria-label={t('dab.boardLabel')}
      style={{ '--n': size }}
      onKeyDown={onKeyDown}
    >
      {cells}
    </div>
  );
}

export default Board;
