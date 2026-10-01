import { useI18n } from '../../../shared/i18n/index.jsx';
import { COLS, ROWS, STATUS, cellIndex } from '../engine.js';

/**
 * The 7 × 6 board. Each column is one big button (a generous touch target);
 * the newest disc replays its fall animation, a winning four pulses.
 *
 * @param {object} props
 * @param {object} props.state engine state
 * @param {boolean} props.canDrop false while a disc falls, on the computer's turn and after the game
 * @param {(col: number) => void} props.onDrop
 */
export function Board({ state, canDrop, onDrop }) {
  const { t, n } = useI18n();
  const winning = new Set(state.winningCells);
  const last = state.lastMove;

  return (
    <div className="c4-board" role="group" aria-label={t('c4.boardLabel')} data-status={state.status}>
      {Array.from({ length: COLS }, (_, col) => {
        const full = state.board[cellIndex(0, col)] !== null;
        return (
          <button
            key={col}
            type="button"
            className="c4-col"
            disabled={!canDrop || full}
            aria-label={full ? t('c4.columnFull', { n: col + 1 }) : t('c4.column', { n: col + 1 })}
            onClick={() => onDrop(col)}
          >
            {Array.from({ length: ROWS }, (_, row) => {
              const owner = state.board[cellIndex(row, col)];
              const isNew = last && last.row === row && last.col === col;
              return (
                <span className="c4-cell" key={row} aria-hidden="true">
                  {owner !== null ? (
                    <span
                      key={isNew ? `new-${last.id}` : 'old'}
                      className={[
                        'c4-disc',
                        `c4-disc--p${owner + 1}`,
                        isNew && state.status !== STATUS.SETUP ? 'is-new' : '',
                        winning.has(cellIndex(row, col)) ? 'is-win' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{ '--fall': row + 1 }}
                    />
                  ) : null}
                </span>
              );
            })}
            <span className="c4-col__number" aria-hidden="true">
              {n(col + 1)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default Board;
