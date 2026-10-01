import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/games/pig/PigGame.jsx';
import { SoundProvider } from '../../src/shared/hooks/useSound.jsx';
import { TIMINGS } from '../../src/games/pig/hooks/useGame.js';

const dice = vi.hoisted(() => ({ queue: [] }));

vi.mock('../../src/shared/utils/random.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rollDie: () => (dice.queue.length > 0 ? dice.queue.shift() : 6) };
});

const mountApp = () =>
  render(
    <SoundProvider>
      <App />
    </SoundProvider>,
  );
const toPersian = () => fireEvent.click(screen.getByRole('button', { name: 'Switch to Persian' }));

beforeEach(() => {
  dice.queue = [];
  document.documentElement.lang = '';
  document.documentElement.dir = '';
});
afterEach(() => vi.useRealTimers());

describe('language switch', () => {
  it('starts in English, left-to-right', () => {
    mountApp();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByText('Roll. Risk. Win.')).toBeInTheDocument();
  });

  it('switches to Persian with RTL and remembers the choice', () => {
    mountApp();
    toPersian();
    expect(document.documentElement.lang).toBe('fa');
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByText('تاس بریز. ریسک کن. ببر.')).toBeInTheDocument();
    expect(window.localStorage.getItem('pig.lang.v1')).toBe('fa');
  });

  it('restores the saved language on the next visit', () => {
    window.localStorage.setItem('pig.lang.v1', 'fa');
    mountApp();
    expect(document.documentElement.dir).toBe('rtl');
    expect(screen.getByRole('button', { name: 'تغییر به انگلیسی' })).toBeInTheDocument();
  });

  it('switches back to English', () => {
    mountApp();
    toPersian();
    fireEvent.click(screen.getByRole('button', { name: 'تغییر به انگلیسی' }));
    expect(document.documentElement.dir).toBe('ltr');
    expect(screen.getByText('Roll. Risk. Win.')).toBeInTheDocument();
  });

  it('plays a game in Persian: default names, Persian digits and notices', () => {
    vi.useFakeTimers();
    mountApp();
    toPersian();
    fireEvent.click(screen.getByRole('button', { name: 'شروع بازی' }));
    expect(screen.getByLabelText('بازیکن ۱، ۰ امتیاز')).toBeInTheDocument();
    expect(screen.getByLabelText('بازیکن ۲، ۰ امتیاز')).toBeInTheDocument();

    dice.queue.push(4);
    fireEvent.click(screen.getByRole('button', { name: 'ریختن تاس' }));
    act(() => {
      vi.advanceTimersByTime(TIMINGS.roll + 40);
    });
    expect(screen.getByLabelText('امتیاز نوبت ۴')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^بانک امتیاز/ }));
    expect(screen.getByText('+۴ ذخیره شد')).toBeInTheDocument();
    expect(screen.getByLabelText('بازیکن ۱، ۴ امتیاز')).toBeInTheDocument();
  });

  it('shortcuts work on a Persian keyboard layout (physical key codes)', () => {
    vi.useFakeTimers();
    mountApp();
    toPersian();
    fireEvent.click(screen.getByRole('button', { name: 'شروع بازی' }));
    dice.queue.push(5);
    fireEvent.keyDown(window, { key: 'ق', code: 'KeyR' });
    act(() => {
      vi.advanceTimersByTime(TIMINGS.roll + 40);
    });
    expect(screen.getByLabelText('امتیاز نوبت ۵')).toBeInTheDocument();
  });
});
