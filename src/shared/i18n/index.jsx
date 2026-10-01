/**
 * ============================================================================
 * PIG — i18n
 * ============================================================================
 * A tiny dictionary-based translator: English (LTR) and Persian (RTL).
 *  - `t(key, params)` fills `{placeholders}`; numbers are formatted for the
 *    active language (Persian digits in `fa`).
 *  - `n(value)` formats a bare number for display.
 *  - Without a provider the hooks fall back to English, so components stay
 *    renderable in isolation (and in unit tests).
 * ============================================================================
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadLanguage, saveLanguage } from '../services/storage.js';
import en from './en.js';
import fa from './fa.js';

export const LANGUAGES = Object.freeze({
  en: { dict: en, dir: 'ltr', locale: 'en' },
  fa: { dict: fa, dir: 'rtl', locale: 'fa-IR' },
});

const FALLBACK_LANGUAGE = 'en';

/**
 * Build the translation helpers for one language.
 * @param {string} lang
 */
export function createTranslator(lang) {
  const config = LANGUAGES[lang] ?? LANGUAGES[FALLBACK_LANGUAGE];
  const formatter = lang === 'fa' ? new Intl.NumberFormat(config.locale, { useGrouping: false }) : null;
  const n = (value) => (formatter ? formatter.format(value) : String(value));

  const t = (key, params) => {
    const template = config.dict[key] ?? en[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name) => {
      const value = params[name];
      if (value === undefined || value === null) return match;
      return typeof value === 'number' ? n(value) : String(value);
    });
  };

  return { t, n };
}

const DEFAULT_VALUE = {
  lang: FALLBACK_LANGUAGE,
  dir: 'ltr',
  setLang: () => {},
  toggleLang: () => {},
  ...createTranslator(FALLBACK_LANGUAGE),
};

const I18nContext = createContext(DEFAULT_VALUE);

/** The language to start in: the saved choice, else the browser's, else English. */
function initialLanguage() {
  const saved = loadLanguage();
  if (saved) return saved;
  const browser = typeof navigator !== 'undefined' ? navigator.language : '';
  return typeof browser === 'string' && browser.toLowerCase().startsWith('fa') ? 'fa' : FALLBACK_LANGUAGE;
}

/** @param {{ children: React.ReactNode }} props */
export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage);

  const setLang = useCallback((next) => setLangState(next in LANGUAGES ? next : FALLBACK_LANGUAGE), []);
  const toggleLang = useCallback(() => setLangState((current) => (current === 'fa' ? 'en' : 'fa')), []);

  const dir = LANGUAGES[lang].dir;
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    saveLanguage(lang);
  }, [lang, dir]);

  const value = useMemo(
    () => ({ lang, dir, setLang, toggleLang, ...createTranslator(lang) }),
    [lang, dir, setLang, toggleLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** @returns {{ lang: string, dir: string, t: (key: string, params?: object) => string, n: (value: number) => string, setLang: (lang: string) => void, toggleLang: () => void }} */
export function useI18n() {
  return useContext(I18nContext);
}
