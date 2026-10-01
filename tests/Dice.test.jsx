import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dice } from '../src/components/Game/Dice.jsx';
import { DICE_MOOD } from '../src/utils/gameLogic.js';

const pipCount = (container) => container.querySelectorAll('.dice__pip.is-on').length;

describe('<Dice />', () => {
  it('announces the face it is showing', () => {
    render(<Dice value={6} />);
    expect(screen.getByRole('img', { name: 'Dice showing 6' })).toBeInTheDocument();
  });

  it('announces an unrolled die', () => {
    render(<Dice value={null} />);
    expect(screen.getByRole('img', { name: 'Dice not rolled yet' })).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('announces that it is rolling', () => {
    render(<Dice value={5} rolling />);
    expect(screen.getByRole('img', { name: 'Dice rolling' })).toBeInTheDocument();
  });

  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
    [5, 5],
    [6, 6],
  ])('draws %i pips for a %i', (face, expected) => {
    const { container } = render(<Dice value={face} />);
    expect(pipCount(container)).toBe(expected);
  });

  it('applies the mood class so busts and wins look different', () => {
    const { container, rerender } = render(<Dice value={1} mood={DICE_MOOD.BUST} />);
    expect(container.querySelector('.dice--bust')).toBeTruthy();

    rerender(<Dice value={6} mood={DICE_MOOD.WIN} />);
    expect(container.querySelector('.dice--win')).toBeTruthy();
    expect(container.querySelector('.dice--bust')).toBeNull();
  });

  it('replays the landing animation for each new roll', () => {
    const { container, rerender } = render(<Dice value={3} rollCount={0} />);
    expect(container.querySelector('.dice.is-landing')).toBeNull();

    rerender(<Dice value={3} rollCount={1} />);
    expect(container.querySelector('.dice.is-landing')).toBeTruthy();
  });
});
