import { useRef } from 'react';
import { useI18n } from '../../../shared/i18n/index.jsx';
import { SIZES } from '../engine.js';
import { SHAPE_COUNT, Glyph } from './Glyph.jsx';

/** Which neighbour an arrow key moves to (left/right swap in right-to-left languages). */
function neighbour(key, index, cols, total, rtl) {
  const horizontal = rtl ? { ArrowLeft: 1, ArrowRight: -1 } : { ArrowLeft: -1, ArrowRight: 1 };
  const delta = key in horizontal ? horizontal[key] : key === 'ArrowDown' ? cols : key === 'ArrowUp' ? -cols : 0;
  const next = index + delta;
  return delta !== 0 && next >= 0 && next < total ? next : null;
}

/**
 * The card grid. Face-up = currently flipped or already found. Every card is a
 * real button (Tab / Enter / Space); arrow keys move focus around the grid.
 *
 * @param {object} props
 * @param {object} props.state engine state
 * @param {boolean} props.canFlip false while two cards are shown, on the computer's turn and after the game
 * @param {(index: number) => void} props.onFlip
 */
export function Board({ state, canFlip, onFlip }) {
  const { t, dir } = useI18n();
  const gridRef = useRef(null);
  const { cols } = SIZES[state.config.size];
  const total = state.deck.length;
  const event = state.lastEvent;

  const onKeyDown = (keyEvent) => {
    const index = Number(keyEvent.target.closest?.('[data-index]')?.dataset.index);
    if (!Number.isInteger(index)) return;
    const next = neighbour(keyEvent.key, index, cols, total, dir === 'rtl');
    if (next === null) return;
    keyEvent.preventDefault();
    gridRef.current?.querySelector(`[data-index="${next}"]`)?.focus();
  };

  return (
    <div
      className={`mem-grid mem-grid--${state.config.size}`}
      ref={gridRef}
      role="group"
      aria-label={t('mem.boardLabel')}
      style={{ '--cols': cols }}
      onKeyDown={onKeyDown}
    >
      {state.deck.map((symbol, index) => {
        const owner = state.matched[index];
        const faceUp = owner !== null || state.flipped.includes(index);
        const found = owner !== null;
        const symbolName = t('mem.symbol', {
          color: t(`mem.color.${Math.floor(symbol / SHAPE_COUNT) % 3}`),
          shape: t(`mem.shape.${symbol % SHAPE_COUNT}`),
        });
        const label = found
          ? t('mem.cardFound', { n: index + 1, symbol: symbolName, name: state.players[owner].name })
          : faceUp
            ? t('mem.cardUp', { n: index + 1, symbol: symbolName })
            : t('mem.cardDown', { n: index + 1 });
        const justMatched = event?.type === 'match' && event.cells.includes(index);
        return (
          <button
            key={index}
            type="button"
            data-index={index}
            className={[
              'mem-card',
              faceUp ? 'is-up' : '',
              found ? `is-found is-found--p${owner + 1}` : '',
              justMatched ? 'is-new-match' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            disabled={!canFlip || faceUp}
            aria-label={label}
            onClick={() => onFlip(index)}
          >
            <span className="mem-card__inner" aria-hidden="true">
              <span className="mem-card__back" />
              <span className="mem-card__front">
                <Glyph id={symbol} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default Board;
