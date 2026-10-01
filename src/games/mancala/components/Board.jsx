import { useI18n } from '../../../shared/i18n/index.jsx';
import { EVENT, STATUS, STORE, oppositeOf, pitIndex } from '../engine.js';
import { TIMINGS } from '../useMancala.js';

/** Up to this many stones are drawn as dots; the number is always shown. */
const MAX_DOTS = 10;

function Stones({ count }) {
  return (
    <span className="mnc-stones" aria-hidden="true">
      {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, i) => (
        <span className="mnc-stone" key={i} />
      ))}
    </span>
  );
}

/**
 * The board: player 1's pits along the top (right → left), player 0's along the
 * bottom (left → right), a store at each end. The board is a physical object, so
 * it is never mirrored in right-to-left languages.
 *
 * @param {object} props
 * @param {object} props.state engine state
 * @param {boolean} props.canPlay false while stones move, on the computer's turn and after the game
 * @param {(pit: number) => void} props.onPlay
 */
export function Board({ state, canPlay, onPlay }) {
  const { t, n } = useI18n();
  const event = state.lastEvent;
  const sowing = state.status === STATUS.SOWING && event;
  const activeSide = state.status === STATUS.WON ? null : state.currentPlayer;

  /** Position (0-based) of a pit in the last sowing path, for the staggered animation. */
  const step = (index) => (event ? event.path.indexOf(index) : -1);

  const pit = (index) => {
    const owner = index < 6 ? 0 : 1;
    const number = owner === 0 ? index + 1 : index - 6;
    const count = state.pits[index];
    const playable = canPlay && owner === state.currentPlayer && count > 0;
    const position = step(index);
    const captured =
      event?.type === EVENT.CAPTURE && (event.path.at(-1) === index || oppositeOf(event.path.at(-1)) === index);
    const name = state.players[owner].name;
    return (
      <button
        key={index}
        type="button"
        data-pit={index}
        className={[
          'mnc-pit',
          `mnc-pit--p${owner + 1}`,
          owner === activeSide ? 'is-side-active' : '',
          position >= 0 ? 'is-sown' : '',
          captured ? 'is-captured' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={position >= 0 ? { '--step': position, '--per-stone': `${TIMINGS.perStone}ms` } : undefined}
        disabled={!playable}
        aria-label={count > 0 ? t('mnc.pit', { name, n: number, count }) : t('mnc.pitEmpty', { name, n: number })}
        onClick={() => onPlay(index)}
      >
        <span className="mnc-pit__number" aria-hidden="true">
          {n(number)}
        </span>
        <Stones count={count} />
        <span className="mnc-pit__count" aria-hidden="true">
          {n(count)}
        </span>
      </button>
    );
  };

  const store = (owner) => {
    const index = STORE[owner];
    const gained = event && event.path.includes(index);
    return (
      <div
        className={`mnc-store mnc-store--p${owner + 1} ${gained ? 'is-gained' : ''} ${event?.type === EVENT.CAPTURE && event.player === owner ? 'is-captured' : ''}`}
        role="img"
        aria-label={t('mnc.store', { name: state.players[owner].name, count: state.pits[index] })}
        style={{ gridColumn: owner === 0 ? 8 : 1, gridRow: '1 / span 2' }}
      >
        <span className="mnc-store__name" aria-hidden="true">
          {state.players[owner].name}
        </span>
        <span className="mnc-store__count" aria-hidden="true">
          {n(state.pits[index])}
        </span>
      </div>
    );
  };

  // Top row, left → right: pits 12 … 7 (player 1, sowing right → left). Bottom row: pits 0 … 5.
  const top = Array.from({ length: 6 }, (_, i) => pitIndex(1, 6 - i));
  const bottom = Array.from({ length: 6 }, (_, i) => pitIndex(0, i + 1));

  return (
    <div
      className={`mnc-board ${sowing ? 'is-sowing' : ''}`}
      role="group"
      aria-label={t('mnc.boardLabel')}
      dir="ltr"
      data-turn={activeSide ?? ''}
    >
      {store(1)}
      {top.map((index, i) => (
        <div className="mnc-cell" style={{ gridColumn: i + 2, gridRow: 1 }} key={index}>
          {pit(index)}
        </div>
      ))}
      {bottom.map((index, i) => (
        <div className="mnc-cell" style={{ gridColumn: i + 2, gridRow: 2 }} key={index}>
          {pit(index)}
        </div>
      ))}
      {store(0)}
    </div>
  );
}

export default Board;
