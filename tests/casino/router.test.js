import { afterEach, describe, expect, it } from 'vitest';
import { navigate, parseHash } from '../../src/casino/router.js';

describe('parseHash', () => {
  it('normalises hashes into route paths', () => {
    expect(parseHash('')).toBe('/');
    expect(parseHash('#')).toBe('/');
    expect(parseHash('#/')).toBe('/');
    expect(parseHash('#/pig')).toBe('/pig');
    expect(parseHash('#/pig/')).toBe('/pig');
    expect(parseHash('#pig')).toBe('/pig');
    expect(parseHash('#/pig?x=1')).toBe('/pig');
    expect(parseHash(undefined)).toBe('/');
  });
});

describe('navigate', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('writes the hash', () => {
    navigate('/pig');
    expect(window.location.hash).toBe('#/pig');
    navigate('/');
    expect(window.location.hash).toBe('#/');
  });
});
