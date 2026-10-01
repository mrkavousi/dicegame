import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App.jsx';
import { SoundProvider } from '../../src/shared/hooks/useSound.jsx';
import { GAMES } from '../../src/games/index.js';
import { LANGUAGES } from '../../src/shared/i18n/index.jsx';

const enName = (game) => LANGUAGES.en.dict[`game.${game.id}.name`];

const mountApp = () =>
  render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );

beforeEach(() => {
  window.location.hash = '';
});

describe('lobby', () => {
  it('opens on the lobby with a card for every registered game', () => {
    mountApp();
    expect(screen.getByRole('heading', { name: 'Pick a game', level: 1 })).toBeInTheDocument();
    for (const game of GAMES) {
      expect(screen.getByRole('link', { name: new RegExp(`^${enName(game)}`) })).toHaveAttribute(
        'href',
        `#/${game.id}`,
      );
    }
  });

  it('shows age and player hints on each card, straight from the registry', () => {
    mountApp();
    for (const game of GAMES) {
      const card = screen.getByRole('link', { name: new RegExp(`^${enName(game)}`) });
      const { min, max } = game.players;
      expect(within(card).getByText(`Ages ${game.ages.from}+`), game.id).toBeInTheDocument();
      expect(within(card).getByText(`Players: ${min === max ? min : `${min}–${max}`}`), game.id).toBeInTheDocument();
    }
  });

  it('opens a game from its card and comes back with the home button', () => {
    mountApp();
    expect(screen.queryByRole('button', { name: 'Back to the game hall' })).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: /^pig/i }));
    expect(window.location.hash).toBe('#/pig');
    expect(screen.getByRole('heading', { name: 'Pig', level: 1 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to the game hall' }));
    expect(window.location.hash).toBe('#/');
    expect(screen.getByRole('heading', { name: 'Pick a game' })).toBeInTheDocument();
  });

  it('shows the lobby for an unknown route', () => {
    window.location.hash = '#/nope';
    mountApp();
    expect(screen.getByRole('heading', { name: 'Pick a game' })).toBeInTheDocument();
  });

  it('follows the browser Back button (hashchange)', () => {
    mountApp();
    fireEvent.click(screen.getByRole('link', { name: /^pig/i }));
    expect(screen.queryByRole('heading', { name: 'Pick a game' })).toBeNull();
    window.location.hash = '#/';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(screen.getByRole('heading', { name: 'Pick a game' })).toBeInTheDocument();
  });

  it('starts at zero stars and speaks Persian when asked', () => {
    mountApp();
    expect(screen.getByLabelText('0 stars')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Persian' }));
    expect(screen.getByRole('heading', { name: 'یک بازی انتخاب کن' })).toBeInTheDocument();
    expect(screen.getByLabelText('۰ ستاره')).toBeInTheDocument();
    for (const game of GAMES) {
      const card = screen.getByRole('link', { name: new RegExp(`^${LANGUAGES.fa.dict[`game.${game.id}.name`]}`) });
      expect(
        within(card).getByText(`سن ${new Intl.NumberFormat('fa-IR').format(game.ages.from)}+`),
      ).toBeInTheDocument();
    }
  });

  it('loads saved stars and shows the wins on the Pig card', () => {
    window.localStorage.setItem('casino.stats.v1', JSON.stringify({ stars: 9, games: { pig: { played: 4, won: 2 } } }));
    mountApp();
    expect(screen.getByLabelText('9 stars')).toBeInTheDocument();
    expect(screen.getByText('2 wins')).toBeInTheDocument();
  });

  it('ignores corrupted saved stars', () => {
    window.localStorage.setItem('casino.stats.v1', '{not json');
    mountApp();
    expect(screen.getByLabelText('0 stars')).toBeInTheDocument();
  });
});
