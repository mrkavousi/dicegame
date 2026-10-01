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
import { DotsIcon } from './icon.jsx';
import { EVENT, MAX_PLAYERS, MIN_PLAYERS, SIZES } from './engine.js';
import { VIEW, useDots } from './useDots.js';
import './strings.js';
import './Dots.css';

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

function Setup({ initial, onStart }) {
  const { t, n } = useI18n();
  const [size, setSize] = useState(initial.config.size);
  const [count, setCount] = useState(initial.config.playerCount);
  const [seats, setSeats] = useState(() =>
    Array.from({ length: MAX_PLAYERS }, (_, i) => ({
      name: initial.players[i] && !initial.players[i].name.startsWith('Player ') ? initial.players[i].name : '',
      bot: initial.players[i]?.bot ?? null,
    })),
  );
  const update = (index) => (next) => setSeats((current) => current.map((seat, i) => (i === index ? next : seat)));

  return (
    <form
      className="dab-setup"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(seats.slice(0, count), { size });
      }}
    >
      <section className="dab-hero">
        <span className="dab-hero__icon" aria-hidden="true">
          <DotsIcon />
        </span>
        <h1 className="dab-hero__title">{t('dab.title')}</h1>
        <p className="dab-hero__tagline">{t('dab.tagline')}</p>
      </section>

      <HowToPlay
        title={t('hub.howto')}
        steps={[t('dab.rules.1'), t('dab.rules.2'), t('dab.rules.3'), t('dab.rules.4')]}
      />

      <ChoiceGroup
        legend={t('dab.players')}
        name="dab-players"
        options={PLAYER_COUNTS.map((value) => ({ value, label: n(value) }))}
        value={count}
        onChange={setCount}
      />
      <ChoiceGroup
        legend={t('dab.size')}
        name="dab-size"
        options={SIZES.map((value) => ({ value, label: t(`dab.size.${value}`) }))}
        value={size}
        onChange={setSize}
      />

      <h2 className="dab-setup__heading label">{t('setup.heading')}</h2>
      {seats.slice(0, count).map((seat, index) => (
        <SeatPicker key={index} idPrefix="dab" index={index} name={seat.name} bot={seat.bot} onChange={update(index)} />
      ))}

      <Button type="submit" variant="primary" size="lg" block>
        {t('setup.start')}
      </Button>
    </form>
  );
}

/**
 * The Dots & Boxes table: setup → board (+ result card when it ends).
 */
export default function DotsGame() {
  const { t, n } = useI18n();
  const { recordResult } = useRewards();

  const onFinish = useCallback(
    (finished) => {
      const { winners, players } = finished;
      if (winners.length > 1) recordResult('dots', OUTCOME.DRAW);
      else recordResult('dots', players[winners[0]].bot ? OUTCOME.LOSS : OUTCOME.WIN);
    },
    [recordResult],
  );
  const game = useDots({ onFinish });
  const { state } = game;

  /** One friendly sentence about the latest move, also read out by screen readers. */
  const message = useMemo(() => {
    const event = state.lastEvent;
    if (!event) return '';
    const name = state.players[event.player].name;
    if (event.type === EVENT.LINE) return t('dab.lineAnn', { name });
    return event.boxes.length === 1 ? t('dab.boxOne', { name }) : t('dab.boxMany', { name, n: event.boxes.length });
  }, [state.lastEvent, state.players, t]);

  if (game.view === VIEW.SETUP) return <Setup initial={state} onStart={game.startGame} />;

  let result = null;
  if (game.finished) {
    const winners = state.winners.map((index) => state.players[index]);
    result =
      winners.length > 1
        ? { title: t('dab.tie'), text: t('dab.tieSub', { names: winners.map((p) => p.name).join(' · ') }), draw: true }
        : { title: t('dab.win', { name: winners[0].name, n: winners[0].score }), text: t('dab.winSub'), draw: false };
  }

  return (
    <main className="dab" aria-label={t('dab.title')}>
      <section className="dab-players" aria-label={t('board.players')} data-count={state.players.length}>
        {state.players.map((player) => {
          const active = !game.finished && player.index === state.currentPlayer;
          return (
            <p
              key={player.index}
              className={`dab-player dab-player--p${player.index + 1} ${active ? 'is-active' : ''}`}
              aria-current={active ? 'true' : undefined}
            >
              <span className="dab-player__name">{player.name}</span>
              <span className="dab-player__score">{n(player.score)}</span>
            </p>
          );
        })}
      </section>

      {game.finished ? null : (
        <p className="dab-turn" role="status">
          {game.isBotTurn
            ? t('controls.hintBot', { name: game.current.name })
            : t('board.turn', { name: game.current.name })}
        </p>
      )}

      <p className={`dab-message ${state.lastEvent ? `dab-message--${state.lastEvent.type}` : ''}`} aria-live="polite">
        {message}
      </p>

      <Board state={state} canDraw={game.canDraw} onDraw={game.draw} />

      {result ? (
        <ResultBanner
          draw={result.draw}
          title={result.title}
          text={result.text}
          actions={[
            { label: t('winner.again'), onClick: game.playAgain },
            { label: t('dab.changePlayers'), onClick: game.changePlayers },
          ]}
        />
      ) : (
        <p className="dab-keys">{t('dab.keys')}</p>
      )}
    </main>
  );
}
