import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom implements neither matchMedia nor the Web Audio API. The app degrades
// gracefully for both, but stubbing matchMedia keeps the code paths exercised.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  window.localStorage.clear();
  // Pig's tests start on the Pig table; hub tests navigate explicitly.
  window.location.hash = '#/pig';
  document.body.className = '';
});

afterEach(() => {
  cleanup();
});
