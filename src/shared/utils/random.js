/**
 * Randomness helpers.
 *
 * Everything random flows through here so gameplay can be made deterministic
 * in tests (and in future "daily challenge"/replay features) by injecting an
 * RNG function instead of touching `Math.random` all over the codebase.
 *
 * @typedef {() => number} Rng — returns a float in [0, 1)
 */

/** The six faces of a standard die. */
export const DICE_FACES = Object.freeze([1, 2, 3, 4, 5, 6]);

/**
 * Inclusive integer in [min, max].
 * @param {number} min
 * @param {number} max
 * @param {Rng} [rng]
 * @returns {number}
 */
export function randomInt(min, max, rng = Math.random) {
  if (max < min) throw new RangeError('randomInt: max must be >= min');
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Pick one item from a list.
 * @template T
 * @param {readonly T[]} list
 * @param {Rng} [rng]
 * @returns {T}
 */
export function pickOne(list, rng = Math.random) {
  if (!list.length) throw new RangeError('pickOne: list is empty');
  return list[randomInt(0, list.length - 1, rng)];
}

/**
 * Roll one six-sided die.
 * @param {Rng} [rng]
 * @returns {number} 1–6
 */
export function rollDie(rng = Math.random) {
  return randomInt(1, 6, rng);
}

/**
 * A random face, guaranteed different from `value` when possible.
 * Used only for the visual tumble, never for game state.
 * @param {number} value
 * @param {Rng} [rng]
 * @returns {number}
 */
export function rollDifferentFace(value, rng = Math.random) {
  const candidates = DICE_FACES.filter((face) => face !== value);
  return pickOne(candidates, rng);
}

/**
 * Deterministic RNG (mulberry32) — lets tests and demos drive exact dice.
 * @param {number} seed
 * @returns {Rng}
 */
export function createSeededRandom(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build an RNG that plays a fixed sequence of dice values, then repeats the
 * last one. The simplest possible way to test game rules end-to-end.
 * @param {number[]} values
 * @returns {Rng}
 */
export function sequenceRng(values) {
  let index = 0;
  return function next() {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    // 1..6 → (value - 1) / 6 ... maps deterministically onto rollDie()
    return (value - 0.5) / 6;
  };
}

/**
 * Fisher–Yates shuffle. Returns a NEW array; the input is left untouched.
 * @template T
 * @param {readonly T[]} list
 * @param {Rng} [rng]
 * @returns {T[]}
 */
export function shuffle(list, rng = Math.random) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
