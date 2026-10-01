/**
 * ============================================================================
 * PIG — Sound service
 * ============================================================================
 * The game ships with zero audio binaries. Every effect is synthesised with the
 * Web Audio API at play time, which keeps the bundle tiny, avoids autoplay
 * asset problems and makes the whole layer replaceable:
 *
 *   Option A (default) — synthesised cues via `SoundService`.
 *   Option B — drop files in `public/sounds/` and map them in `SOUND_FILES`
 *              below; the service will prefer the file when it loads.
 *
 * The service is intentionally framework-free. `useSound` in hooks/ wires it
 * to React state (mute toggle) and the user's first interaction.
 * ============================================================================
 */

/** Optional file overrides — set a path to use real audio instead of synthesis. */
export const SOUND_FILES = {
  // roll: '/sounds/roll.mp3',
  // bank: '/sounds/bank.mp3',
  // bust: '/sounds/bust.mp3',
  // win: '/sounds/win.mp3',
};

/** Cue names. */
export const SOUND = Object.freeze({
  ROLL: 'roll',
  BANK: 'bank',
  BUST: 'bust',
  WIN: 'win',
});

/** Per-cue timing/feel, shared by synthesis and file playback. */
const CUES = {
  [SOUND.ROLL]: { gain: 0.3, cooldown: 90 },
  [SOUND.BANK]: { gain: 0.34, cooldown: 150 },
  [SOUND.BUST]: { gain: 0.36, cooldown: 400 },
  [SOUND.WIN]: { gain: 0.34, cooldown: 900 },
};

export class SoundService {
  /** @param {{ muted?: boolean }} [options] */
  constructor({ muted = false } = {}) {
    this.muted = muted;
    this.supported = typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
    this.context = null;
    this.lastPlayed = new Map();
    this.buffers = new Map();
    this.fileMode = new Set();
  }

  /** Lazily create the AudioContext — must follow a user gesture. */
  ensureContext() {
    if (!this.supported) return null;
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      try {
        this.context = new AudioCtor();
      } catch {
        this.supported = false;
        return null;
      }
    }
    // Browsers start suspended until a gesture unlocks audio.
    if (this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
    return this.context;
  }

  /**
   * @param {boolean} muted
   */
  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.muted) this.stopAll();
  }

  /** Utility: can we actually make noise? */
  get enabled() {
    return this.supported && !this.muted;
  }

  /**
   * Play a cue.
   * @param {string} cue
   */
  play(cue) {
    if (!this.enabled) return;
    const config = CUES[cue];
    if (!config) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const last = this.lastPlayed.get(cue) ?? -Infinity;
    if (now - last < config.cooldown) return; // anti-spam guard
    this.lastPlayed.set(cue, now);

    const context = this.ensureContext();
    if (!context) return;

    const file = SOUND_FILES[cue];
    if (file && this.fileMode.has(cue)) {
      this.#playBuffer(context, cue, file, config);
      return;
    }

    this.#synthesise(context, cue, config);
    if (file && !this.fileMode.has(cue)) {
      // Try to upgrade to the real sample next time (loading failures are silent).
      this.#loadBuffer(context, cue, file);
    }
  }

  /* -------------------------------------------------------------- synth --- */

  /**
   * @param {AudioContext} context
   * @param {string} cue
   * @param {{ gain: number }} config
   */
  #synthesise(context, cue, config) {
    const t = context.currentTime;
    const master = context.createGain();
    master.gain.value = config.gain;
    master.connect(context.destination);

    switch (cue) {
      case SOUND.ROLL:
        // Dry, short noise burst + click: a die tumbling on a table.
        this.#noise(context, master, t, 0.12, 1800, 4000);
        this.#tone(context, master, t, 180, 90, 'square', 0.1);
        break;

      case SOUND.BANK:
        // Two-note "money secured" arpeggio.
        this.#tone(context, master, t, 660, 660, 'triangle', 0.16);
        this.#tone(context, master, t + 0.09, 990, 990, 'triangle', 0.22);
        break;

      case SOUND.BUST:
        // Descending "oops" — the pot is gone.
        this.#tone(context, master, t, 300, 260, 'sawtooth', 0.16);
        this.#tone(context, master, t + 0.1, 200, 150, 'sawtooth', 0.3);
        break;

      case SOUND.WIN:
        // Rising fanfare.
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
          this.#tone(context, master, t + index * 0.11, freq, freq, 'triangle', 0.3);
        });
        break;

      default:
        break;
    }
  }

  /**
   * Single enveloped oscillator.
   */
  #tone(context, destination, start, fromFreq, toFreq, type, duration) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(fromFreq, start);
    if (toFreq !== fromFreq) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(1, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  /** Filtered noise burst. */
  #noise(context, destination, start, duration, fromFreq, toFreq) {
    const frames = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      // Fade the tail so the burst sounds like a bounce, not a hiss.
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;

    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(fromFreq, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, toFreq), start + duration);
    filter.Q.value = 0.8;

    source.connect(filter).connect(destination);
    source.start(start);
    source.stop(start + duration);
  }

  /* -------------------------------------------------------- file upgrade --- */

  #loadBuffer(context, cue, url) {
    fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error('bad response'))))
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
      .then((decoded) => {
        this.buffers.set(cue, decoded);
        this.fileMode.add(cue);
      })
      .catch(() => {
        /* keep synthesising */
      });
  }

  #playBuffer(context, cue, _url, config) {
    const buffer = this.buffers.get(cue);
    if (!buffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = config.gain * 1.6;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  /** Stop everything immediately (used when muting). */
  stopAll() {
    if (this.context && this.context.state === 'running') {
      this.context.suspend().catch(() => {});
    }
  }
}

/** App-wide singleton. */
export const soundService = new SoundService();
