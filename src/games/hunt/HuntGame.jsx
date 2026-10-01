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
import { HuntIcon } from './icon.jsx';
import { DANGER, EVENT, MAX_PLAYERS, MIN_PLAYERS } from './engine.js';
import { VIEW, useHunt } from './useHunt.js';
import './strings.js';
import './Hunt.css';

const PLAYER_COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

function Setup({ initial, onStart }) {
  const { t, n } = useI18n();
  const [danger, setDanger] = useState(initial.config.danger);
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
      className="hunt-setup"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(seats.slice(0, count), { danger });
      }}
    >
      <section className="hunt-hero">
        <span className="hunt-hero__icon" aria-hidden="true">
          <HuntIcon />
        </span>
        <h1 className="hunt-hero__title">{t('hunt.title')}</h1>
        <p className="hunt-hero__tagline">{t('hunt.tagline')}</p>
      </section>

      <HowToPlay
        title={t('hub.howto')}
        steps={[t('hunt.rules.1'), t('hunt.rules.2'), t('hunt.rules.3'), t('hunt.rules.4')]}
      />

      <ChoiceGroup
        legend={t('hunt.players')}
        name="hunt-players"
        options={PLAYER_COUNTS.map((value) => ({ value, label: n(value) }))}
        value={count}
        onChange={setCount}
      />
      <ChoiceGroup
        legend={t('hunt.danger')}
        name="hunt-danger"
        options={Object.values(DANGER).map((value) => ({ value, label: t(`hunt.danger.${value}`) }))}
        value={danger}
        onChange={setDanger}
      />

      <h2 className="hunt-setup__heading label">{t('setup.heading')}</h2>
      {seats.slice(0, count).map((seat, index) => (
        <SeatPicker
          key={index}
          idPrefix="hunt"
          index={index}
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
 * The Treasure Hunt table: setup → field (+ result card when it ends).
 */
export default function HuntGame() {
  const { t, n } = useI18n();
  const { recordResult } = useRewards();

  const onFinish = useCallback(
    (finished) => {
      const { winners, players } = finished;
      if (winners.length > 1) recordResult('hunt', OUTCOME.DRAW);
      else recordResult('hunt', players[winners[0]].bot ? OUTCOME.LOSS : OUTCOME.WIN);
    },
    [recordResult],
  );
  const game = useHunt({ onFinish });
  const { state, info } = game;

  /** One friendly sentence about the latest event, also read out by screen readers. */
  const message = useMemo(() => {
    const event = state.lastEvent;
    if (!event) return '';
    const name = state.players[event.player].name;
    if (event.type === EVENT.GEM) return t('hunt.gemAnn', { name, value: event.value });
    if (event.type === EVENT.TRAP) {
      return event.lost > 0 ? t('hunt.trapAnn', { name, lost: event.lost }) : t('hunt.trapNone', { name });
    }
    return t(event.auto ? 'hunt.autoBankAnn' : 'hunt.bankAnn', { name, amount: event.amount });
  }, [state.lastEvent, state.players, t]);

  if (game.view === VIEW.SETUP) return <Setup initial={state} onStart={game.startGame} />;

  let result = null;
  if (game.finished) {
    const winners = state.winners.map((index) => state.players[index]);
    result =
      winners.length > 1
        ? {
            title: t('hunt.tie'),
            text: t('hunt.tieSub', { names: winners.map((p) => p.name).join(' · ') }),
            draw: true,
          }
        : { title: t('hunt.win', { name: winners[0].name, n: winners[0].score }), text: t('hunt.winSub'), draw: false };
  }

  const odds =
    info.trapsLeft === 0
      ? t('hunt.oddsNone')
      : info.trapsLeft === 1
        ? t('hunt.oddsOne', { hidden: info.hidden })
        : t('hunt.odds', { traps: info.trapsLeft, hidden: info.hidden });

  return (
    <main className="hunt" aria-label={t('hunt.title')}>
      <section className="hunt-players" aria-label={t('board.players')} data-count={state.players.length}>
        {state.players.map((player) => {
          const active = !game.finished && player.index === state.currentPlayer;
          return (
            <p
              key={player.index}
              className={`hunt-player hunt-player--p${player.index + 1} ${active ? 'is-active' : ''}`}
              aria-current={active ? 'true' : undefined}
            >
              <span className="hunt-player__name">{player.name}</span>
              <span className="hunt-player__score">{n(player.score)}</span>
            </p>
          );
        })}
      </section>

      {game.finished ? null : (
        <p className="hunt-turn" role="status">
          {game.isBotTurn
            ? t('controls.hintBot', { name: game.current.name })
            : t('board.turn', { name: game.current.name })}
        </p>
      )}

      <section className="hunt-pot" data-empty={state.pot === 0 ? 'true' : 'false'}>
        <span className="hunt-pot__label label">{t('hunt.pot')}</span>
        <span className="hunt-pot__value" aria-label={`${t('hunt.pot')} ${n(state.pot)}`}>
          {state.pot > 0 ? `+${n(state.pot)}` : n(0)}
        </span>
        <span className="hunt-pot__hint">{state.pot > 0 ? t('hunt.potHint') : t('hunt.potEmpty')}</span>
      </section>

      <p
        className={`hunt-message ${state.lastEvent ? `hunt-message--${state.lastEvent.type}` : ''}`}
        aria-live="polite"
      >
        {message}
      </p>

      <Board state={state} canOpen={game.canOpen} onOpen={game.open} />

      <p className="hunt-odds">
        {odds} {t('hunt.gemsLeft', { n: info.gemsLeft })}
      </p>

      {result ? (
        <ResultBanner
          draw={result.draw}
          title={result.title}
          text={result.text}
          actions={[
            { label: t('winner.again'), onClick: game.playAgain },
            { label: t('hunt.changePlayers'), onClick: game.changePlayers },
          ]}
        />
      ) : (
        <>
          <Button variant="bank" size="lg" block disabled={!game.canBank} shortcut="B" onClick={game.bankPot}>
            {t('controls.bank')}
          </Button>
          <p className="hunt-keys">{t('hunt.keys')}</p>
        </>
      )}
    </main>
  );
}
