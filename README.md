# PIG 🎲 — Roll. Risk. Win.

A fast, polished **local-multiplayer dice game** (2–4 players) for the browser.
Roll as often as you dare, bank before the 1 shows up, first to **100 points** wins
(or 50 / 150 / 200 — you choose).

Built mobile-first with React + Vite, a fully separated rules engine, and a
chunky, flat, playful visual language driven by design tokens.

> **خلاصهٔ فارسی:** بازی دو نفرهٔ «Pig» — هر بازیکن چند بار تاس می‌ریزد و امتیازها به
> «پات» همان نوبت اضافه می‌شود. با BANK امتیاز را ذخیره می‌کند؛ اگر ۱ بیاورد کل پات
> از دست می‌رود و نوبت عوض می‌شود. اولین نفر به ۱۰۰ امتیاز برنده است. رابط کاربری
> کاملاً واکنش‌گرا (Mobile-first)، با انیمیشن‌های کوتاه، افکت صوتی، ذخیرهٔ خودکار بازی
> و تست‌های خودکار.

---

## Quick start

```bash
npm install       # install dependencies
npm run dev       # start the dev server → http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build locally
npm test          # run the test suite (Vitest + jsdom)
npm run lint      # ESLint
npm run format    # Prettier (write)
npm run verify    # lint + tests + production build in one go (also run by CI)
```

Requires **Node 18+**.

---

## Game rules

| # | Rule |
|---|------|
| 1 | 2–4 players share one six-sided die and take turns. |
| 2 | On your turn, roll as many times as you like. Each roll adds to your **turn score** (the pot). |
| 3 | Press **BANK** at any time to move the pot into your **total score**. The turn then passes to the other player. |
| 4 | Roll a **1** and the pot is gone, the turn ends immediately and the next player is up. |
| 5 | The first player to reach the **target score** (default **100**) wins. |

### Game settings

Chosen on the start screen and remembered between visits (`pig.config.v1`).

| Setting | Options |
|---------|---------|
| Players | 2, 3 or 4 |
| Seat type | each player is **Human** or a **computer** (Easy / Normal / Hard) |
| Play to | 50, 100, 150 or 200 points |
| Variant | **Classic** (one die) or **Two dice** |
| Match | **Single game**, **Best of 3** or **Best of 5** |

### Computer opponent

Pick *Bot · Easy / Normal / Hard* in a player's seat dropdown. The bot pauses
briefly ("thinking…"), then rolls or banks on its own; the Roll/Bank buttons and
the `R`/`B` keys are disabled on its turn. Bots can fill any seat, so
bot-vs-bot (a spectator game) works too. The strategy lives in the pure module
`src/utils/bot.js` (`decideMove(state)`):

| Level | Strategy |
|-------|----------|
| Easy | banks early — at about 60% of the break-even pot |
| Normal | banks at the break-even pot: 20 in classic, `(200 − score) / 11` in two-dice (accounts for the snake-eyes score wipe) |
| Hard | Normal, but keeps pushing when a rival is close to winning and plays safe when far ahead |

All levels always roll an empty pot and always bank a pot that wins the game.

### Best-of series

In a best-of-3 / best-of-5 match the board shows the series score. After each
game the winner screen offers **Next game** (scores reset, series score carries
over, and the starting player rotates). When someone takes the series, the
screen says *wins the match* and **Play again** starts a fresh series.

### Undo

Took the points too early? **Undo bank** (or `U`) puts the pot back and returns
the turn to you — until the next player rolls. It is a hot-seat feature and is
not offered in games with a computer player.

### Lifetime stats

The bar-chart button in the header opens a leaderboard of every human who has
finished a game on this device: wins, games, bust rate and best turn. Names are
matched case-insensitively, computer players are not tracked, and **Reset stats**
clears it. Stored under `pig.stats.v1`.

**Two-dice variant:** each roll uses two dice. Both dice are added to the pot,
except: a single **1** burns the pot (turn ends), and **two 1s** ("snake eyes")
wipe the pot *and* your whole total score.

**Example — Alex's turn:** rolls 5, then 4, then 6 → pot = 15.
Banking scores 15 and hands over the turn. Rolling once more and hitting a 1
destroys all 15 points.

---

## How to play (keyboard included)

| Action | Control |
|--------|---------|
| Roll the die | **ROLL DICE** button or `R` |
| Bank the pot | **BANK POINTS** button or `B` |
| Undo the last bank | **UNDO BANK** button or `U` |
| Mute / unmute | speaker icon in the header or `M` |
| Again / leave the match | restart icon in the header, `PLAY AGAIN`, `MAIN MENU` |

Shortcuts are ignored while typing in a name field, and while a roll, a
hand-over or a modal is in progress.

---

## Project structure

```
src/
├── components/
│   ├── Game/
│   │   ├── GameBoard.jsx      # play screen composition + screen-reader live region
│   │   ├── PlayerCard.jsx     # name, total, pot, progress, active state
│   │   ├── Dice.jsx           # big die, tumble + landing animation, aria-label
│   │   ├── TurnScore.jsx      # the pot, including the "burnt pot" animation
│   │   ├── GameControls.jsx   # ROLL / BANK + contextual hint
│   │   └── GameHistory.jsx    # collapsible "last rolls" log
│   ├── Setup/
│   │   └── PlayerSetup.jsx    # optional player names
│   ├── Screens/
│   │   ├── AppHeader.jsx      # wordmark, sound toggle, new game
│   │   ├── StartScreen.jsx    # pitch + rules + setup
│   │   └── WinnerScreen.jsx   # celebration, stats, PLAY AGAIN / MAIN MENU
│   └── UI/
│       ├── Button.jsx         # chunky primary/bank/secondary/danger/ghost
│       ├── IconButton.jsx     # header controls with accessible labels
│       ├── Modal.jsx          # focus-trapped confirm dialog
│       ├── Notice.jsx         # transient feedback banner (live region)
│       └── icons.jsx          # inline SVG icon set (no external assets)
├── hooks/
│   ├── useGame.js             # the only orchestrator: state, timing, sound, lock
│   ├── useSound.jsx           # SoundProvider + mute state
│   └── useReducedMotion.js    # live prefers-reduced-motion
├── services/
│   ├── storage.js             # guard-wrapped localStorage (game, settings, config, stats)
│   └── sound.js               # Web Audio cue synthesis (no audio files needed)
├── styles/
│   ├── tokens.css             # design tokens: colour, type, space, lips, motion
│   ├── base.css               # reset, app shell, utilities
│   └── index.css              # style entry point
├── utils/
│   ├── bot.js                 # pure computer-opponent strategy (decideMove)
│   ├── gameLogic.js           # pure rules — no React, no DOM, no timers
│   ├── stats.js               # pure lifetime-stats aggregation (recordGame, leaderboard)
│   └── random.js              # injectable RNG + seeded RNG for tests
└── App.jsx                    # shell + view routing
tests/
├── gameLogic.test.js          # 45 rules/anti-bug/persistence tests
├── settings.test.js           # 14 config / target score / N-player / two-dice engine tests
├── settings.test.jsx          # 4 settings-screen UI flow tests
├── bot.test.js                # 12 bot config + strategy tests
├── bot.test.jsx               # 4 end-to-end computer-turn tests
├── series.test.js             # 11 series + lifetime-stats engine tests
├── series.test.jsx            # 9 undo / series / stats-modal UI tests
├── App.test.jsx               # 22 end-to-end flow tests through the real UI
├── Dice.test.jsx              # 11 die rendering/a11y tests
└── setup.js                   # jsdom environment shims
```

---

## Architecture

Three layers, one direction of dependency:

```
utils/gameLogic.js   pure functions      state in → state out
        ↑
hooks/useGame.js     orchestration        timers, lock, sound, storage, notices
        ↑
components/**        presentation         props in, events out — no game state
```

### Rules engine — `src/utils/gameLogic.js`

No React, no DOM, no `Math.random`, no timers. Every function returns a **new**
state object, so the rules can be unit-tested without rendering anything.

```
createGame()  applyRoll()  rollDice()  bankScore()  switchPlayer()
settleTurn()  checkWinner()  canRoll()  canBank()  resetGame()
restoreGame()  resolveDiceMood()  normalizeName()
```

### State machine

```
setup ──▶ playing ──▶ rolling ──▶ (2–6) ──▶ playing
                    │
                    └── (1) ──▶ switching ──▶ playing   (pot burnt, turn handed over)

playing ──▶ bank ──▶ switching ──▶ playing               (points secured)
                 └─▶ won                                 (score ≥ 100)
                                        won ──▶ playAgain ──▶ playing
                                            └─▶ mainMenu ──▶ setup
```

`rolling` and `switching` are **feedback windows**, not turn owners: the input
lock lives in the status, the turn marker always points at the player who is
actually up next, and each window closes on a timer owned by `useGame`.
The equivalent pure state shape:

```js
{
  status: 'setup' | 'playing' | 'rolling' | 'switching' | 'won',
  players: [{ id, index, name, score, bestTurn, stats: { rolls, busts } }],
  currentPlayer: 0,
  turnScore: 0,
  diceValue: null,
  rollCount: 0,          // animation + announcement trigger
  turnCount: 1,
  lastEvent: null,       // drives banners and dice mood
  history: [],           // newest-first log (capped at 24)
  winnerIndex: null,
}
```

### Timing — `TIMINGS` in `src/hooks/useGame.js`

| Key | ms | Purpose |
|-----|----|---------|
| `roll` | 460 | dice tumble (brief asks for 300–700ms) |
| `rollReduced` | 120 | same beat for reduced-motion players |
| `bust` | 1250 | "OH NO!" window before the next player may act |
| `bankPause` | 650 | short beat so secured points register |
| `winReveal` | 900 | pause on the winning score before the winner screen |
| `notice` | 1700 | default toast lifetime |

---

## Anti-bug guarantees

| Risk | How it is prevented |
|------|---------------------|
| Rolling after game over | `applyRoll`/`canRoll` reject every status except `playing`/`rolling`; the WON transition is terminal |
| Banking with an empty pot | `canBank` requires `turnScore > 0` and the `playing` status |
| Double-clicking ROLL / BANK | synchronous `guardRef` input lock, released only after the resulting state lands |
| Two rolls in flight | the lock plus the `rolling` status; a click during the tumble is a no-op |
| Points added after a 1 | the bust branch resets the pot and never touches `score` |
| Playing on after a winner | `switchPlayer` and `bankScore` are no-ops once `status === 'won'` |
| Negative scores | `restoreGame` clamps every stored score to `≥ 0`; the rules only ever add |
| Stale timers / race conditions | every timer is generation-tagged and cleared on unmount, `newGame` and `playAgain` |
| Switching player mid-animation | the hand-over happens when the die lands, never during `rolling` |
| UI/logic drift | the UI has no rules of its own — it renders `gameLogic` output and calls its actions |
| Resuming mid-animation | `restoreGame` settles `rolling`/`switching` back to `playing` |

---

## Design system

Colour, typography, spacing, radii, "lips" and motion are declared once in
`src/styles/tokens.css`. Components read semantic tokens (`--color-brand`,
`--color-danger`, `--lip-3`, `--dur-roll`) and never hard-code a colour.

**Palette** — Primary Green `#58CC02`, Dark Green `#58A700`, Light Green
`#A5ED6E`, Pale Green `#D7FFB8`, Blue `#1CB0F6`, Pale Blue `#DDF4FF`,
Dark Text `#3C3C3C`, Secondary `#4B4B4B`, Muted `#777777`, Light Gray `#E5E5E5`,
White `#FFFFFF`, Deep Navy `#100F3E`, Dark Navy `#000437`.
Two derived inks (`#173300` on pale green, `#0B6E9E` on pale blue/white) keep
text at or above WCAG AA contrast.

**Buttons** are chunky and hard-lipped — the shadow has **zero blur**, and the
press state translates the button down by exactly the lip height:

```css
.btn--primary {
  background: var(--color-brand);
  color: var(--white);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 0 var(--color-brand-dark);   /* the lip */
}
.btn:active { transform: translateY(4px); box-shadow: none; }
```

**Typography** — `Baloo 2` (rounded, heavy) for display and numbers, `Barlow`
for body copy, `Vazirmatn` for Persian text; all self-hosted via `@fontsource`
with unicode-range subsets, so Persian glyphs cost nothing to Latin-only users.

**Banned by design:** glassmorphism, blurred/soft shadows, gradients, neon,
dashboard chrome, decoration without purpose.

---

## Responsive behaviour

| Breakpoint | Layout |
|-----------|--------|
| `< 560px` (phone) | single column · two player cards side by side · 96–132px die · full-width stacked CTAs · history collapsed |
| `560–1099px` (tablet) | larger type, 120–148px die, roomier spacing, pot hint visible |
| `≥ 1100px` (desktop) | play column (max 560px) + sticky "last rolls" aside, generous free space, keyboard hints revealed |

Touch targets are ≥ 48px, taps never zoom (`touch-action: manipulation`), safe
area insets are respected, and `prefers-reduced-motion` shortens every animation
to ~1ms while keeping all feedback.

---

## Accessibility

* Semantic landmarks (`header`, `main`, `section`, `article`, `aside`, `ol`) and one `h1` per screen.
* The die is `role="img"` with `aria-label="Dice showing 6"` / `"Dice rolling"` / `"Dice not rolled yet"`.
* A polite live region announces every committed event ("Alex rolled 5. Turn score 11."), and busts are announced assertively via `role="alert"`.
* Buttons carry explicit labels (`Roll dice`, `Bank points, 12 points`, `Turn sound off`); the sound toggle exposes `aria-pressed`.
* Visible `:focus-visible` rings everywhere, full keyboard operation, a focus-trapped confirm dialog, and focus moved to the result heading on the winner screen.
* Progress bars expose `role="progressbar"` with `aria-valuenow`/`aria-valuemax` and a "points to go" name.
* Motion respects `prefers-reduced-motion` in both CSS and the dice roll timer.

---

## Sound

`src/services/sound.js` synthesises every cue with the Web Audio API, so the
game ships with **zero audio files** and nothing to autoplay-block:

| Cue | Synthesis |
|-----|-----------|
| `roll` | filtered noise burst + click |
| `bank` | two-note rising arpeggio |
| `bust` | descending "oops" |
| `win` | four-note fanfare |

The context is created on the first user gesture, cues are rate-limited to avoid
spam, and muting (persisted in `localStorage`) suspends audio immediately.
To use real samples instead, drop files in `public/sounds/` and map them in
`SOUND_FILES` — the service prefers the file when it loads and silently falls
back to synthesis if it does not.

---

## Persistence

The match is mirrored to `localStorage` (`pig.game.v1`) after every state change
and re-validated on load by `restoreGame`, which repairs tampered or
half-written payloads. Refresh mid-match and you resume where you left off;
`NEW GAME` (header ⌫ / `MAIN MENU`) clears the saved match deliberately, and
asks for confirmation first. Mute preference lives in `pig.settings.v1`, the last-used game settings in
`pig.config.v1` and lifetime stats in `pig.stats.v1`.
Storage failures (private mode, quota) degrade silently to an in-memory game.

---

## Testing

```bash
npm test
```

132 tests across nine files, all deterministic (the die is injected, never random):

* **`tests/gameLogic.test.js`** — the six scenarios from the brief
  (roll 5 → pot 5; 5+4 → 9; bank → score 9, pot 0, turn passes; 5 then 1 → pot lost,
  turn passes; 98+3 banked → win; 99 then 1 → no win), plus every anti-bug rule,
  history capping, stats, resets and `restoreGame` validation.
* **`tests/App.test.jsx`** — plays the real UI with fake timers and a scripted
  die: setup → rolls → bank hand-over → bust → win → play again → main menu,
  double-click protection, input locking, keyboard shortcuts, persistence,
  resume-on-refresh and the abandon-match confirm dialog.
* **`tests/settings.test.js` / `.jsx`** — game settings: config normalisation,
  custom target scores, 3-player turn rotation, the two-dice rules (including
  snake eyes), save/restore of the config (and legacy saves without one), and the
  start-screen controls end to end.
* **`tests/bot.test.js` / `.jsx`** — bot seats in the config, default bot names,
  every strategy rule, and full computer turns through the real UI (rolling to
  the threshold, banking, busting, and the keyboard being locked out).
* **`tests/series.test.js` / `.jsx`** — best-of-N bookkeeping (wins, next game,
  starting-seat rotation, legacy-save upgrade), stats aggregation and the
  leaderboard, plus the undo button/key and the stats modal through the real UI.
* **`tests/Dice.test.jsx`** — pip rendering for all six faces, mood classes,
  landing replay and the accessible labels.

---

## License

MIT — do what you like. Built as an original product: this shares a *visual
language* with modern playful UI systems (flat, bright, chunky, hard-lipped)
but no logos, assets, layouts or copy from any other product.
