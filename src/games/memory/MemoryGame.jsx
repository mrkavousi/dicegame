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
import { MemoryIcon } from './icon.jsx';
import { MAX_PLAYERS, MIN_PLAYERS, SIZES } from './engine.js';
import { VIEW, useMemory } from './useMemory.js';
import './strings.js';
import './Memory.css';

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
  const active = seats.slice(0, count).map((seat) => (count === 1 ? { ...seat, bot: null } : seat));

  return (
    <form
      className="mem-setup"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(active, { size });
      }}
    >
      <section className="mem-hero">
        <span className="mem-hero__icon" aria-hidden="true">
          <MemoryIcon />
        </span>
        <h1 className="mem-hero__title">{t('mem.title')}</h1>
        <p className="mem-hero__tagline">{t('mem.tagline')}</p>
      </section>

      <HowToPlay
        title={t('hub.howto')}
        steps={[t('mem.rules.1'), t('mem.rules.2'), t('mem.rules.3'), t('mem.rules.4')]}
      />

      <ChoiceGroup
        legend={t('mem.players')}
        name="mem-players"
        options={PLAYER_COUNTS.map((value) => ({ value, label: n(value) }))}
        value={count}
        onChange={setCount}
      />
      <ChoiceGroup
        legend={t('mem.size')}
        name="mem-size"
        options={Object.keys(SIZES).map((value) => ({ value, label: t(`mem.size.${value}`) }))}
        value={size}
        onChange={setSize}
      />

      <h2 className="mem-setup__heading label">{t('setup.heading')}</h2>
      {active.map((seat, index) => (
        <SeatPicker
          key={index}
          idPrefix="mem"
          index={index}
          name={seats[index].name}
          bot={seat.bot}
          allowBot={count > 1}
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
 * The Memory Match table: setup → board (+ result card when it ends).
 */
export default function MemoryGame() {
  const { t, n } = useI18n();
  const { recordResult } = useRewards();

  const onFinish = useCallback(
    (finished) => {
      const { winners, players } = finished;
      if (players.length === 1) recordResult('memory', OUTCOME.WIN);
      else if (winners.length > 1) recordResult('memory', OUTCOME.DRAW);
      else recordResult('memory', players[winners[0]].bot ? OUTCOME.LOSS : OUTCOME.WIN);
    },
    [recordResult],
  );
  const game = useMemory({ onFinish });
  const { state } = game;

  const announcement = useMemo(() => {
    const event = state.lastEvent;
    if (!event) return '';
    return event.type === 'match' ? t('mem.matchAnn', { name: state.players[event.player].name }) : t('mem.missAnn');
  }, [state.lastEvent, state.players, t]);

  if (game.view === VIEW.SETUP) return <Setup initial={state} onStart={game.startGame} />;

  const solo = state.players.length === 1;
  let result = null;
  if (game.finished) {
    const winners = state.winners.map((index) => state.players[index]);
    if (solo) result = { title: t('mem.solo'), text: t('mem.soloSub', { n: state.moves }), draw: false };
    else if (winners.length > 1) {
      result = {
        title: t('mem.tie'),
        text: t('mem.tieSub', { names: winners.map((p) => p.name).join(' · ') }),
        draw: true,
      };
    } else
      result = {
        title: t('mem.win', { name: winners[0].name, n: winners[0].score }),
        text: t('mem.winSub'),
        draw: false,
      };
  }

  return (
    <main className="mem" aria-label={t('mem.title')}>
      <section className="mem-players" aria-label={t('board.players')} data-count={state.players.length}>
        {state.players.map((player) => {
          const active = !game.finished && !solo && player.index === state.currentPlayer;
          return (
            <p
              key={player.index}
              className={`mem-player mem-player--p${player.index + 1} ${active ? 'is-active' : ''}`}
              aria-current={active ? 'true' : undefined}
            >
              <span className="mem-player__name">{player.name}</span>
              <span className="mem-player__score">{n(player.score)}</span>
            </p>
          );
        })}
      </section>

      <p className="mem-status" role="status">
        {game.finished
          ? t('mem.tries', { n: state.moves })
          : solo
            ? t('mem.tries', { n: state.moves })
            : game.isBotTurn
              ? t('controls.hintBot', { name: game.current.name })
              : t('board.turn', { name: game.current.name })}
      </p>

      <Board state={state} canFlip={game.canFlip} onFlip={game.flipCard} />

      {result ? (
        <ResultBanner
          draw={result.draw}
          title={result.title}
          text={result.text}
          actions={[
            { label: t('winner.again'), onClick: game.playAgain },
            { label: t('mem.changePlayers'), onClick: game.changePlayers },
          ]}
        />
      ) : (
        <p className="mem-keys">{t('mem.keys')}</p>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}
