import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '../../shared/i18n/index.jsx';
import { HowToPlay } from '../../shared/components/HowToPlay.jsx';
import { ResultBanner } from '../../shared/components/ResultBanner.jsx';
import { SeatPicker } from '../../shared/components/SeatPicker.jsx';
import { Button } from '../../shared/ui/Button.jsx';
import { useRewards } from '../../casino/useRewards.jsx';
import { OUTCOME } from '../../casino/rewards.js';
import { Board } from './components/Board.jsx';
import { Connect4Icon } from './icon.jsx';
import { STATUS } from './engine.js';
import { VIEW, useConnectFour } from './useConnectFour.js';
import './strings.js';
import './Connect4.css';

/** Disc colours: seat 1 = red, seat 2 = yellow (the player-4 / player-3 token sets). */
const TONES = [4, 3];

function Setup({ initial, onStart }) {
  const { t } = useI18n();
  const [seats, setSeats] = useState(() =>
    initial.map((player) => ({ name: player.name.startsWith('Player ') ? '' : player.name, bot: player.bot })),
  );
  const update = (index) => (next) => setSeats((current) => current.map((seat, i) => (i === index ? next : seat)));

  return (
    <form
      className="c4-setup"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(seats);
      }}
    >
      <section className="c4-hero">
        <span className="c4-hero__icon" aria-hidden="true">
          <Connect4Icon />
        </span>
        <h1 className="c4-hero__title">{t('c4.title')}</h1>
        <p className="c4-hero__tagline">{t('c4.tagline')}</p>
      </section>

      <HowToPlay title={t('c4.rules.title')} steps={[t('c4.rules.1'), t('c4.rules.2'), t('c4.rules.3')]} />

      <h2 className="c4-setup__heading label">{t('setup.heading')}</h2>
      {seats.map((seat, index) => (
        <SeatPicker
          key={index}
          idPrefix="c4"
          index={index}
          tone={TONES[index]}
          name={seat.name}
          bot={seat.bot}
          onChange={update(index)}
        />
      ))}

      <Button type="submit" variant="primary" size="lg" block>
        {t('setup.start')}
      </Button>
    </form>
  );
}

/**
 * The Connect Four table: setup → board (+ result card when it ends).
 */
export default function Connect4Game() {
  const { t, n } = useI18n();
  const { recordResult } = useRewards();

  const onFinish = useCallback(
    (finished) => {
      if (finished.status === STATUS.DRAW) recordResult('connect4', OUTCOME.DRAW);
      else recordResult('connect4', finished.players[finished.winner]?.bot ? OUTCOME.LOSS : OUTCOME.WIN);
    },
    [recordResult],
  );
  const game = useConnectFour({ onFinish });
  const { state } = game;

  const announcement = useMemo(() => {
    const last = state.lastMove;
    if (!last) return '';
    return t('c4.moveAnn', { name: state.players[last.player].name, col: last.col + 1 });
  }, [state.lastMove, state.players, t]);

  if (game.view === VIEW.SETUP) return <Setup initial={state.players} onStart={game.startGame} />;

  const won = state.status === STATUS.WON;
  const turnText = game.isBotTurn
    ? t('controls.hintBot', { name: game.current.name })
    : t('board.turn', { name: game.current.name });

  return (
    <main className="c4" aria-label={t('c4.title')}>
      <section className="c4-players" aria-label={t('board.players')}>
        {state.players.map((player) => {
          const active = !game.finished && player.index === state.currentPlayer;
          return (
            <p
              key={player.index}
              className={`c4-player c4-player--p${player.index + 1} ${active ? 'is-active' : ''}`}
              aria-current={active ? 'true' : undefined}
            >
              <span className="c4-player__disc" aria-hidden="true" />
              <span className="c4-player__name">{player.name}</span>
              <span className="c4-player__score">{n(state.scores[player.index])}</span>
            </p>
          );
        })}
      </section>

      <p className="c4-status" role="status">
        {game.finished ? t('c4.gameNo', { n: state.gameNumber }) : turnText}
      </p>

      <Board state={state} canDrop={game.canDrop} onDrop={game.dropDisc} />

      {game.finished ? (
        <ResultBanner
          draw={!won}
          title={won ? t('c4.win', { name: state.players[state.winner].name }) : t('c4.draw')}
          text={won ? t('c4.winSub') : t('c4.drawSub')}
          actions={[
            { label: t('winner.again'), onClick: game.playAgain },
            { label: t('c4.changePlayers'), onClick: game.changePlayers },
          ]}
        />
      ) : (
        <p className="c4-keys">{t('c4.keys')}</p>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}
