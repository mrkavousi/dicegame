import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every .css file under src/. */
function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith('.css') ? [path] : [];
  });
}

describe('stylesheets', () => {
  const files = cssFiles('src');

  it('finds the stylesheets', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)('%s has balanced braces', (file) => {
    const css = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(['"])(?:\\.|(?!\1).)*\1/g, '');
    const opens = (css.match(/\{/g) ?? []).length;
    const closes = (css.match(/\}/g) ?? []).length;
    expect(opens, file).toBe(closes);
  });
});
