import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '../../shared/i18n/index.jsx';
import { ChoiceGroup } from '../../shared/components/ChoiceGroup.jsx';
import { HowToPlay } from '../../shared/components/HowToPlay.jsx';
import { ResultBanner } from '../../shared/components/ResultBanner.jsx';
import { SeatPicker } from '../../shared/components/SeatPicker.jsx';
import { Button } from '../../shared/ui/Button.jsx';
import { useRewards } from '../../casino/useRewards.jsx';
import { OUTCOME } from '../../casino/rewards.js';
import { Board } from './components/Board.jsx';
import { MancalaIcon } from './icon.jsx';
import { EVENT, STONES, scores } from './engine.js';
import { VIEW, useMancala } from './useMancala.js';
import './strings.js';
import './Mancala.css';

function Setup({ initial, onStart }) {
  const { t, n } = useI18n();
  const [stones, setStones] = useState(initial.config.stones);
  const [seats, setSeats] = useState(() =>
    initial.players.map((player) => ({ name: player.name.startsWith('Player ') ? '' : player.name, bot: player.bot })),
  );
  const update = (index) => (next) => setSeats((current) => current.map((seat, i) => (i === index ? next : seat)));

  return (
    <form
      className="mnc-setup"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(seats, { stones });
      }}
    >
      <section className="mnc-hero">
        <span className="mnc-hero__icon" aria-hidden="true">
          <MancalaIcon />
        </span>
        <h1 className="mnc-hero__title">{t('mnc.title')}</h1>
        <p className="mnc-hero__tagline">{t('mnc.tagline')}</p>
      </section>

      <HowToPlay
        title={t('hub.howto')}
        steps={[t('mnc.rules.1'), t('mnc.rules.2'), t('mnc.rules.3'), t('mnc.rules.4')]}
      />

      <ChoiceGroup
        legend={t('mnc.stones')}
        name="mnc-stones"
        options={STONES.map((value) => ({ value, label: `${n(value)} · ${t(`mnc.len.${value}`)}` }))}
        value={stones}
        onChange={setStones}
      />

      <h2 className="mnc-setup__heading label">{t('setup.heading')}</h2>
      {seats.map((seat, index) => (
        <SeatPicker key={index} idPrefix="mnc" index={index} name={seat.name} bot={seat.bot} onChange={update(index)} />
      ))}

      <Button type="submit" variant="primary" size="lg" block>
        {t('setup.start')}
      </Button>
    </form>
  );
}

/**
 * The Mancala table: setup → board (+ result card when it ends).
 */
export default function MancalaGame() {
  const { t } = useI18n();
  const { recordResult } = useRewards();

  const onFinish = useCallback(
    (finished) => {
      const { winners, players } = finished;
      if (winners.length > 1) recordResult('mancala', OUTCOME.DRAW);
      else recordResult('mancala', players[winners[0]].bot ? OUTCOME.LOSS : OUTCOME.WIN);
    },
    [recordResult],
  );
  const game = useMancala({ onFinish });
  const { state } = game;

  /** One friendly sentence about the latest move, also read out by screen readers. */
  const message = useMemo(() => {
    const event = state.lastEvent;
    if (!event) return '';
    const name = state.players[event.player].name;
    if (event.type === EVENT.CAPTURE) return t('mnc.captureAnn', { name, n: event.captured });
    if (event.type === EVENT.EXTRA) return t('mnc.extraAnn', { name });
    return t('mnc.moveAnn', { name, n: event.path.length });
  }, [state.lastEvent, state.players, t]);

  if (game.view === VIEW.SETUP) return <Setup initial={state} onStart={game.startGame} />;

  let result = null;
  if (game.finished) {
    const [a, b] = scores(state);
    result =
      state.winners.length > 1
        ? { title: t('mnc.tie'), text: t('mnc.tieSub', { n: a }), draw: true }
        : {
            title: t('mnc.win', { name: state.players[state.winners[0]].name, a: Math.max(a, b), b: Math.min(a, b) }),
            text: t('mnc.winSub'),
            draw: false,
          };
  }

  return (
    <main className="mnc" aria-label={t('mnc.title')}>
      {game.finished ? null : (
        <p className="mnc-turn" role="status">
          {game.isBotTurn
            ? t('controls.hintBot', { name: game.current.name })
            : t('board.turn', { name: game.current.name })}
        </p>
      )}

      <p className={`mnc-message ${state.lastEvent ? `mnc-message--${state.lastEvent.type}` : ''}`} aria-live="polite">
        {message}
      </p>

      <Board state={state} canPlay={game.canPlay} onPlay={game.choosePit} />

      {result ? (
        <ResultBanner
          draw={result.draw}
          title={result.title}
          text={result.text}
          actions={[
            { label: t('winner.again'), onClick: game.playAgain },
            { label: t('mnc.changePlayers'), onClick: game.changePlayers },
          ]}
        />
      ) : (
        <p className="mnc-keys">{t('mnc.keys')}</p>
      )}
    </main>
  );
}
