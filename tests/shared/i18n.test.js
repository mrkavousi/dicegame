import { describe, expect, it } from 'vitest';
import en from '../../src/shared/i18n/en.js';
import fa from '../../src/shared/i18n/fa.js';
import { LANGUAGES, createTranslator, registerStrings } from '../../src/shared/i18n/index.jsx';
// Importing a strings module registers it — list every game's here as it is added.
import '../../src/casino/strings.js';
import '../../src/games/connect4/strings.js';
import '../../src/games/memory/strings.js';

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('dictionaries', () => {
  it('Persian has exactly the same keys as English', () => {
    expect(Object.keys(fa).sort()).toEqual(Object.keys(en).sort());
  });

  it('every key uses the same placeholders in both languages', () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(fa[key]), key).toEqual(placeholders(en[key]));
    }
  });

  it('has no empty strings', () => {
    for (const dict of [en, fa]) {
      for (const [key, value] of Object.entries(dict)) expect(value.length, key).toBeGreaterThan(0);
    }
  });

  it('declares text direction per language', () => {
    expect(LANGUAGES.en.dir).toBe('ltr');
    expect(LANGUAGES.fa.dir).toBe('rtl');
  });
});

describe('translator', () => {
  it('fills placeholders in English with plain digits', () => {
    const { t, n } = createTranslator('en');
    expect(t('board.turn', { name: 'Alex' })).toBe("Alex's turn");
    expect(t('player.toGo', { n: 42 })).toBe('42 to go');
    expect(n(1234)).toBe('1234');
  });

  it('formats numbers with Persian digits in fa, and leaves names alone', () => {
    const { t, n } = createTranslator('fa');
    expect(n(120)).toBe('۱۲۰');
    expect(t('player.toGo', { n: 42 })).toBe('۴۲ تا برد');
    expect(t('board.turn', { name: 'Sam 7' })).toBe('نوبت Sam 7');
  });

  it('falls back to English for missing keys and to the key itself as a last resort', () => {
    const { t } = createTranslator('xx');
    expect(t('setup.start')).toBe('Start game');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });

  it('keeps unknown placeholders visible instead of crashing', () => {
    expect(createTranslator('en').t('board.turn', {})).toBe("{name}'s turn");
  });
});

describe('merged dictionaries (core + casino + every game)', () => {
  const merged = { en: LANGUAGES.en.dict, fa: LANGUAGES.fa.dict };

  it('have identical keys in both languages', () => {
    expect(Object.keys(merged.fa).sort()).toEqual(Object.keys(merged.en).sort());
  });

  it('use identical placeholders for every key', () => {
    for (const key of Object.keys(merged.en)) {
      expect(placeholders(merged.fa[key]), key).toEqual(placeholders(merged.en[key]));
    }
  });

  it('every game in the registry has a name and description card string', async () => {
    const { GAMES } = await import('../../src/games/index.js');
    for (const game of GAMES) {
      expect(merged.en[`game.${game.id}.name`], game.id).toBeTruthy();
      expect(merged.en[`game.${game.id}.desc`], game.id).toBeTruthy();
      expect(merged.fa[`game.${game.id}.name`], game.id).toBeTruthy();
    }
  });

  it('registerStrings adds keys to both languages', () => {
    registerStrings({ en: { 'test.hello': 'Hi {name}' }, fa: { 'test.hello': 'سلام {name}' } });
    expect(createTranslator('en').t('test.hello', { name: 'A' })).toBe('Hi A');
    expect(createTranslator('fa').t('test.hello', { name: 'A' })).toBe('سلام A');
    delete LANGUAGES.en.dict['test.hello'];
    delete LANGUAGES.fa.dict['test.hello'];
  });
});
