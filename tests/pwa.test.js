import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');

describe('PWA assets', () => {
  it('ships every icon the HTML and manifest rely on', () => {
    for (const file of [
      'favicon.svg',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-512.png',
    ]) {
      expect(existsSync(`public/${file}`), file).toBe(true);
    }
  });

  it('links the favicon, touch icon and theme colour', () => {
    expect(html).toContain('href="/favicon.svg"');
    expect(html).toContain('href="/apple-touch-icon.png"');
    expect(html).toContain('name="theme-color"');
  });
});
