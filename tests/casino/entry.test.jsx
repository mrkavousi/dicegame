import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/**
 * Smoke test for the real entry point (`src/main.jsx`): it must mount the whole
 * game hall, not a single game. (Every other test renders <App/> directly, so a
 * wrong import in main.jsx would otherwise go unnoticed.)
 */
describe('main.jsx', () => {
  it('mounts the game hall lobby into #root', async () => {
    window.location.hash = '#/';
    document.body.innerHTML = '<div id="root"></div>';
    await import('../../src/main.jsx');
    expect(await screen.findByRole('heading', { name: 'Pick a game', level: 1 })).toBeInTheDocument();
    expect(document.querySelector('#root .app-header')).not.toBeNull();
  });
});
