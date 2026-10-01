# Pig Game Hall 🎲⭐

A bright, kid-friendly **game hall** for the browser (ages 6–15): pick a table in the
lobby, play with friends on one device or against the computer, and collect stars.
No betting, no money, no accounts, no ads — everything stays on your device.

| Game | Status | Players | Ages |
|------|--------|---------|------|
| **Pig** — roll the die, bank your points, beware the 1 | ✅ playable | 2–4 | 6+ |
| **Connect Four** — drop discs, connect four in a row | ✅ playable | 2 (or vs computer) | 6+ |
| **Memory Match** — flip cards, find the pairs | ✅ playable | 1–4 | 6+ |
| **Treasure Hunt** — dig up gems, bank them, dodge trapdoors | ✅ playable | 2–4 | 7+ |
| **Dots & Boxes** — connect dots, close boxes | ✅ playable | 2–4 | 8+ |
| **Mancala** — sow stones, capture, fill your store | ✅ playable | 2 (or vs computer) | 8+ |

Built mobile-first with React + Vite, pure rules engines (one per game), and a
chunky, flat, playful visual language driven by design tokens. English and Persian
(RTL) throughout; installable and playable offline.

## Safe for kids

* **No betting, no money, no purchases** — the only reward is a count of harmless *stars*
  that can't be spent or lost.
* **No accounts, ads, analytics or external links.** Everything is stored on the device
  (`localStorage`); there is no server.
* Friendly wording for young readers (English and Persian), big tap targets, a short
  *How to play* card on every setup screen, calm animations that respect
  *reduced motion*, and **Easy** as the first computer level to try.
* Ages are shown on every lobby card (Pig, Connect Four, Memory Match 6+ · Treasure Hunt 7+ ·
  Dots & Boxes, Mancala 8+).

## The game hall

* **Lobby** (`#/`) — one card per game, built from the registry in
  `src/games/index.js`. Each card shows the age hint, player count and your wins.
* **Routing** — a tiny dependency-free hash router (`src/casino/router.js`):
  `#/` is the lobby, `#/pig` is Pig. It needs no server setup, works offline and
  the browser Back button behaves. Unknown routes fall back to the lobby.
* **Stars** — finishing a game earns stars (**+3 win, +1 draw or loss**). Stars
  can only go up: they can't be spent or lost. Stars and per-game win counts are
  kept in `localStorage` (`casino.stats.v1`) and shown in the header and lobby.
* **Header** — home button, star count, language toggle and sound for every game;
  a game can add its own buttons (Pig adds *Show stats* and *New game*).
* **Adding a game** — create `src/games/<id>/` with a pure `engine.js`, a hook,
  UI and a `strings.js` (registered with `registerStrings`); add its
  `game.<id>.name/desc` to `src/casino/strings.js` and one entry to
  `src/games/index.js` (`component`, or `load: () => import(...)` to code-split).

> **خلاصهٔ فارسی:** «سرای بازی» مجموعه‌ای از بازی‌های نوبتی مناسب سن ۶ تا ۱۵ سال است؛
> با دوستان روی یک دستگاه یا با کامپیوتر بازی کنید و ستاره جمع کنید. شرط‌بندی و پول
> در کار نیست. اولین بازی «Pig» است: تاس بریز، امتیاز را بانک کن و مراقب عدد ۱ باش!
> (در «Pig»، هر بازیکن چند بار تاس می‌ریزد و امتیازها به «پات» نوبت اضافه می‌شود؛
> اگر ۱ بیاورد پات می‌سوزد. اولین نفر به ۱۰۰ امتیاز برنده است.)

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

## Install & offline (PWA)

PIG is an installable Progressive Web App. Build and serve it
(`npm run build && npm run preview`), then use your browser's *Install app* /
*Add to Home Screen*. A service worker (via `vite-plugin-pwa`, Workbox) precaches
the whole app shell — JS, CSS, icons and the bundled fonts — so after the first
visit it **works fully offline**, and updates itself silently when you deploy a
new build.

* Config: the `VitePWA(...)` block in `vite.config.js` (manifest, theme colour,
  precache globs). It is skipped under Vitest.
* Icons live in `public/` (`icon-192.png`, `icon-512.png`, a maskable
  `icon-maskable-512.png`, `apple-touch-icon.png`, `favicon.svg`).
* The service worker only runs in the production build, not in `npm run dev`.
* To check offline mode: preview the build, open DevTools → Application →
  Service Workers, tick *Offline* and reload.

---

## Languages (English · فارسی)

The header button (**فا** / **EN**) switches the whole interface between
English (LTR) and Persian (RTL). The choice is saved (`pig.lang.v1`); on a first
visit a Persian browser locale starts the game in Persian.

* All text lives in `src/i18n/en.js` and `src/i18n/fa.js` (flat keys, `{placeholders}`).
  `useI18n()` returns `t(key, params)` and `n(number)`; numbers show as Persian
  digits (۱۲۳) in `fa`. Without a provider the hooks fall back to English.
* `<html lang dir>` is updated, the CSS uses logical properties (so layouts
  mirror), Vazirmatn leads the font stack and letter-spacing is disabled
  (it breaks Arabic-script joining).
* Blank player names get a default in the active language ("بازیکن ۲", "ربات · سخت").
  Names already chosen are never translated.
* Keyboard shortcuts use the physical key (`event.code`), so `R` / `B` / `U` / `M`
  work on a Persian keyboard layout too.
* Adding a language = a new dictionary + an entry in `LANGUAGES`; a test enforces
  that every language has the same keys and placeholders.

---

## Connect Four

Two players take turns dropping a disc into one of 7 columns; it falls to the lowest
free spot. Connect **four of your discs in a row** — across, up and down, or
diagonally — to win. A full board is a draw. After a game, **Play again** gives the
other player the first move; the win counter for each player is kept until you
*Change players*.

* **Seats** — each seat is a person or a computer (**Easy / Normal / Hard**), so you
  can play 2 people, person vs computer, or watch two computers.
* **Computer** (`src/games/connect4/bot.js`) — every level grabs an immediate win and
  blocks an immediate loss. *Easy* then plays a random column that doesn't hand over a
  win; *Normal* searches 4 moves ahead and *Hard* 6 moves ahead (negamax with
  alpha-beta pruning, centre-first). Equal-scoring moves are chosen with the injected
  RNG, so games vary but tests are deterministic.
* **Controls** — click/tap a column, or press **1–7** (physical keys, so it also works
  on a Persian keyboard layout). The board is locked while a disc is falling and on the
  computer's turn.
* **Saved automatically** (`connect4.game.v1`); a reload resumes the game. Saved boards
  are validated (gravity, disc counts) and the result is recomputed from the board.
* Finished games earn stars (+3 win, +1 draw, +1 when the computer wins).
* **Code** — `engine.js` (pure rules), `bot.js` (pure), `useConnectFour.js`
  (timers, input lock, autosave, keys), `Connect4Game.jsx` + `components/Board.jsx`
  (UI), `strings.js` (EN/FA). Shared building blocks it introduced, reusable by the
  next games: `shared/hooks/useScheduler.js`, `shared/components/{SeatPicker,
  HowToPlay,ResultBanner}.jsx`.

---

## Memory Match

A grid of face-down cards hides pairs of pictures. On your turn **flip two cards**: if
they match you keep them and **go again**; if not, they flip back and the turn passes.
When every pair is found, the player with the most pairs wins (ties are shared). Play
alone to find them all in as few tries as you can.

* **Setup** — 1–4 players, each a person or a computer (Easy / Normal / Hard), and a
  board size: *Small* 3×4, *Medium* 4×4, *Large* 4×5, *Huge* 6×6 (so younger kids can
  start small).
* **Pictures** — 18 symbols drawn in SVG (6 shapes × 3 colours), no image files. Every
  card has a text label ("Card 5: red heart") for screen readers.
* **Computer** (`src/games/memory/bot.js`) — it only uses what a person could know:
  cards that have been face-up before. Difficulty is *memory*: Easy remembers ~30% of
  the cards it has seen, Normal ~65%, Hard 100%. It completes a pair it remembers,
  otherwise explores unseen cards. The recall roll uses the injected RNG, so tests are exact.
* **Controls** — tap/click a card, or Tab + Enter/Space; the **arrow keys** move between
  cards (and swap left/right in Persian). Input is locked while two cards are showing
  and on the computer's turn.
* **Saved automatically** (`memory.game.v1`); the saved deck is validated (every symbol
  exactly twice, pairs found together, scores recomputed from the board).
* Stars: +3 for a win (every solo game), +1 for a tie or when the computer wins.
* **Code** — `engine.js` (pure), `bot.js` (pure), `useMemory.js` (timers, lock, autosave),
  `MemoryGame.jsx` + `components/{Board,Glyph}.jsx`, `strings.js`. New shared pieces:
  `shared/components/ChoiceGroup.jsx` and `shuffle()` in `shared/utils/random.js`.

---

## Treasure Hunt

Pig's push-your-luck idea in a new skin — and, like everything here, **nothing to bet,
only points**. A 5×5 field of tiles hides gems (worth 1, 2 or 3) and a few trapdoors.

* On your turn, **open tiles one at a time**; each gem goes into your **pot**.
* Open a **trapdoor** and the pot is lost — and so is your turn.
* **Bank** at any time to move the pot into your score and pass the turn.
* When the **last gem** is found it is banked automatically and the game ends: the
  highest score wins (ties are shared).
* **Setup** — 2–4 players, each a person or a computer (Easy / Normal / Hard), and the
  number of trapdoors: *Few* (3), *Some* (5), *Many* (7).
* **It teaches odds** — the screen always says how many trapdoors are hiding among how
  many tiles ("5 trapdoors are hiding among 23 tiles"). How many gems of each value
  exist is public (`composition()`), so everyone can work out the chances.
* **Computer** (`src/games/hunt/bot.js`) — it only uses that public knowledge, never the
  hidden tiles (a test proves two different fields give the same decision). It keeps
  digging while the pot is below the *break-even pot* `(1 − p) · average gem ÷ p`
  (p = chance of a trapdoor). *Easy* banks at ~60% of that, *Normal* at 100%, *Hard*
  adapts: bolder when far behind, safer when well ahead, and it locks in a lead near the end.
* **Controls** — tap a tile, or Tab + Enter/Space; **arrow keys** move around the field
  (swapping left/right in Persian, never wrapping across rows); **B** banks. The field is
  locked during the short hand-over after a trapdoor or a bank, and on the computer's turn.
* **Saved automatically** (`hunt.game.v1`); a saved field must contain exactly the public
  composition, otherwise it is rejected as tampered.
* Stars: +3 for a win, +1 for a tie or when the computer wins.
* **Code** — `engine.js` (pure), `bot.js` (pure), `useHunt.js` (hand-over timers, bot,
  autosave, B key), `HuntGame.jsx` + `components/Board.jsx`, `strings.js`, `icon.jsx`.

---

## Dots & Boxes

A grid of dots. On your turn **draw one line** between two neighbouring dots. Draw the
**4th side of a box** and it is yours (+1 point) — and you **go again**. Otherwise the turn
passes. When every line is drawn, the most boxes wins (ties are shared). There is no luck
in the rules at all.

* **Setup** — 2–4 players, each a person or a computer (Easy / Normal / Hard), and a board:
  *Small* 3×3, *Medium* 4×4, *Large* 5×5, *Huge* 6×6 boxes.
* **Computer** (`src/games/dots/bot.js`) —
  *Easy* takes a box when it can, otherwise draws a random line.
  *Normal* takes boxes (the biggest bite first), then prefers **safe** lines that don't hand
  the next player a third side; when every line gives something away it gives away the least.
  *Hard* plays like Normal until at most 14 lines are left, then (with two players) **solves
  the rest of the game exactly** with a memoised search, so it finds the classic sacrifices —
  declining the last two boxes of a chain to keep control. Tests check its choice against an
  independent brute-force search.
* **Controls** — tap a line, or Tab + Enter/Space; the **arrow keys** hop between lines of
  the same kind (left/right swap in Persian). Lines have a generous invisible hit area, so
  they are easy to tap on a phone. Input is locked on the computer's turn.
* **Saved automatically** (`dots.game.v1`); boxes and scores are recomputed from the saved
  lines, so a tampered save can't invent points.
* Stars: +3 for a win, +1 for a tie or when the computer wins.
* **Code** — `engine.js` (pure; geometry helpers `boxEdges`, `edgeBoxes`, `completes`),
  `bot.js` (pure), `useDots.js`, `DotsGame.jsx` + `components/Board.jsx`, `strings.js`, `icon.jsx`.

---

## Mancala (Kalah)

Two players, six pits each, and a **store** at each end of the board.

* Pick one of **your** pits, pick up all its stones and **sow** them one by one around the
  board (counter-clockwise). Your own store gets a stone each lap; your opponent's store is
  skipped.
* Your **last stone lands in your store** → you **play again**.
* It lands in an **empty pit of yours** with stones in the pit across from it → you
  **capture** them (plus your last stone) into your store.
* When **one side is empty** the game ends and the other player keeps the stones left on their
  side. The most stones in the store wins (ties are shared).
* **Setup** — each seat is a person or a computer (Easy / Normal / Hard), and the number of
  stones per pit: 3 *Quick*, 4 *Classic*, 5 *Long*.
* **Computer** (`src/games/mancala/bot.js`) — *Easy* plays a random pit; *Normal* is greedy
  (extra turn first, then the biggest capture / store gain); *Hard* is **minimax with
  alpha-beta pruning, 7 moves deep**, with extra turns handled properly. A test checks its
  move against a plain, unpruned minimax.
* **Controls** — tap a pit, or Tab + Enter/Space, or press **1–6** (your pits in sowing order;
  physical keys, so it works on a Persian layout). Each pit shows its number, a dot per stone
  and the count (in Persian digits in Persian). The board is a physical object, so it is
  **never mirrored** in right-to-left languages.
* **Animation** — the sown pits light up one after another (`--step` × 140 ms); the board is
  locked while stones move, and under *reduced motion* it is only a short beat.
* **Saved automatically** (`mancala.game.v1`); a saved board must hold exactly 12 × stones, so
  stones can't appear or vanish, and a board with an empty side loads as a finished game.
* Stars: +3 for a win, +1 for a tie or when the computer wins.
* **Code** — `engine.js` (pure; `sow()` is shared with the bot), `bot.js` (pure),
  `useMancala.js`, `MancalaGame.jsx` + `components/Board.jsx`, `strings.js`, `icon.jsx`.

---

## Pig — game rules

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
├── main.jsx                   # fonts, styles, SoundProvider, mounts <App/>
├── App.jsx                    # I18nProvider → RewardsProvider → <Casino/>
├── casino/                    # the game hall
│   ├── Casino.jsx             # shell: header + route outlet (lobby or a game)
│   ├── CasinoHeader.jsx       # home, stars, language, sound + a slot for game buttons
│   ├── Lobby.jsx              # one card per registered game
│   ├── router.js              # hash router (useRoute, navigate, parseHash)
│   ├── rewards.js             # pure: stars + per-game stats (recordResult)
│   ├── useRewards.jsx         # RewardsProvider / useRewards (persisted)
│   ├── ShellContext.jsx       # header slot + night theme for the game on stage
│   └── strings.js             # hub + game-card text (EN/FA)
├── games/
│   ├── index.js               # the game registry (add a game = one entry)
│   ├── mancala/               # Mancala: engine.js, bot.js, useMancala.js, MancalaGame.jsx, components/Board.jsx, strings.js, icon.jsx
│   ├── dots/                  # Dots & Boxes: engine.js, bot.js, useDots.js, DotsGame.jsx, components/Board.jsx, strings.js, icon.jsx
│   ├── hunt/                  # Treasure Hunt: engine.js, bot.js, useHunt.js, HuntGame.jsx, components/Board.jsx, strings.js, icon.jsx
│   ├── memory/                # Memory Match: engine.js, bot.js, useMemory.js, MemoryGame.jsx, components/{Board,Glyph}.jsx, strings.js, icon.jsx
│   ├── connect4/              # Connect Four: engine.js, bot.js, useConnectFour.js, Connect4Game.jsx, components/Board.jsx, strings.js, icon.jsx
│   └── pig/                   # everything Pig-specific
│       ├── PigGame.jsx        # the Pig table: setup → board → winner
│       ├── components/{Game,Setup,Screens}/   # board, cards, die, controls, history, start/winner/stats
│       ├── hooks/useGame.js   # orchestrator: state, timing, sound, input lock, bot turns
│       ├── services/pigStorage.js            # saved match, last settings, lifetime stats
│       └── utils/{gameLogic,bot,stats}.js    # pure rules, computer opponent, stats
└── shared/                    # used by every game
    ├── ui/                    # Button, IconButton, Modal, Notice, icons
    ├── i18n/                  # en.js / fa.js core strings, registerStrings, I18nProvider, useI18n (t, n)
    ├── components/            # SeatPicker, ChoiceGroup, HowToPlay, ResultBanner (shared by the games)
    ├── hooks/                 # useSound (SoundProvider), useReducedMotion, useScheduler
    ├── services/              # storage.js (guarded localStorage), sound.js (Web Audio cues)
    ├── styles/                # tokens.css (design tokens), base.css, index.css
    └── utils/random.js        # injectable RNG + seeded RNG for tests
tests/
├── setup.js                   # jsdom shims; starts each test on #/pig
├── games/                     # connect4 engine / bot / UI tests (+ pig/: rules, settings, bot, series, UI flows)
├── casino/                    # router, rewards, lobby, stars earned from Pig
└── shared/                    # i18n dictionaries + language switch, PWA assets
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

### Rules engine — `src/games/pig/utils/gameLogic.js`

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

### Timing — `TIMINGS` in `src/games/pig/hooks/useGame.js`

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

## Storage keys

Every key lives in the browser's `localStorage`; each game validates what it reads (a damaged
or tampered value is ignored and the game starts fresh).

| Key | Owner | Holds |
|-----|-------|-------|
| `casino.stats.v1` | hub | stars + per-game played/won |
| `pig.lang.v1` | shared | interface language (`en` / `fa`) |
| `pig.settings.v1` | shared | sound on/off |
| `pig.game.v1`, `pig.config.v1`, `pig.stats.v1` | Pig | the saved match, last settings, lifetime stats |
| `connect4.game.v1` | Connect Four | the saved game |
| `memory.game.v1` | Memory Match | the saved game |
| `hunt.game.v1` | Treasure Hunt | the saved game |
| `dots.game.v1` | Dots & Boxes | the saved game |
| `mancala.game.v1` | Mancala | the saved game |

(`pig.lang.v1` / `pig.settings.v1` keep their original names so nobody loses a setting.)

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

483 tests across 33 files (`tests/games`, `tests/casino`, `tests/shared`), all deterministic (dice and other randomness are injected, never random):

* **`tests/games/pig/gameLogic.test.js`** — the six scenarios from the brief
  (roll 5 → pot 5; 5+4 → 9; bank → score 9, pot 0, turn passes; 5 then 1 → pot lost,
  turn passes; 98+3 banked → win; 99 then 1 → no win), plus every anti-bug rule,
  history capping, stats, resets and `restoreGame` validation.
* **`tests/games/pig/App.test.jsx`** — plays the real UI with fake timers and a scripted
  die: setup → rolls → bank hand-over → bust → win → play again → main menu,
  double-click protection, input locking, keyboard shortcuts, persistence,
  resume-on-refresh and the abandon-match confirm dialog.
* **`tests/games/pig/settings.test.js` / `.jsx`** — game settings: config normalisation,
  custom target scores, 3-player turn rotation, the two-dice rules (including
  snake eyes), save/restore of the config (and legacy saves without one), and the
  start-screen controls end to end.
* **`tests/games/pig/bot.test.js` / `.jsx`** — bot seats in the config, default bot names,
  every strategy rule, and full computer turns through the real UI (rolling to
  the threshold, banking, busting, and the keyboard being locked out).
* **`tests/games/pig/series.test.js` / `.jsx`** — best-of-N bookkeeping (wins, next game,
  starting-seat rotation, legacy-save upgrade), stats aggregation and the
  leaderboard, plus the undo button/key and the stats modal through the real UI.
* **`tests/shared/i18n.test.js` / `.jsx`** — Persian and English dictionaries have identical
  keys and placeholders, number formatting, fallbacks, the language toggle
  (`lang`/`dir`, persistence) and a game played in Persian, including shortcuts
  from a Persian keyboard layout.
* **`tests/casino/*`** — a smoke test of the real entry point (`main.jsx` mounts the hall), the hash router, stars/rewards maths and corrupt-data handling,
  the lobby built from the registry (cards, age/player hints, navigation, Back button,
  unknown routes, Persian), and the stars Pig awards (+3 for a win, +1 when the
  computer wins).
* **`tests/games/connect4.*.test.js(x)`** — the engine (gravity, all four win directions,
  a real 42-move draw, input lock, rematch, save/restore incl. impossible boards), the
  bot (takes wins, blocks losses, never hands over a win when avoidable, Normal/Hard beat
  a random player from both seats, Hard beats Easy) and the UI (setup, lock while a disc
  falls, 1–7 keys, win/draw banners, rematch, stars, computer turns, resume after reload,
  corrupted save, Persian).
* **`tests/games/mancala.*.test.js(x)`** — the engine (layout and opposite pits, sowing that skips
  the opponent's store, full laps, extra turns, captures on both sides, end-of-game sweep, ties,
  stone conservation, validated save/restore), the bot (extra turn / capture preferences, Hard
  checked against plain minimax, Hard beats a random player from both seats) and the UI (setup, the
  sowing lock, keys 1–6, captures, finishing and rematch, computer turns incl. a computer win, resume,
  tampered saves, Persian with an unmirrored board).
* **`tests/games/dots.*.test.js(x)`** — the engine (geometry for every board size, one line
  completing two boxes, extra turns, ties, rematch rotation, validated save/restore), the bot
  (takes boxes, avoids third sides, gives away the least, Hard's exact solver agrees with an
  independent brute-force search, Normal beats Easy) and the UI (setup, drawing, scoring, a full
  game, arrow keys, computer turns incl. a computer win, resume, bad saves, Persian).
* **`tests/games/hunt.*.test.js(x)`** — the engine (public composition, gem/trapdoor/bank rules,
  input lock, auto-bank on the last gem, ties, rematch rotation, validated save/restore incl.
  tampered fields), the bot (break-even maths, level thresholds, never peeks at hidden tiles,
  Normal outscores Easy) and the UI (setup, odds text, hand-over locks, B key, labels, arrow keys
  without row-wrapping, win/rematch, computer turns incl. a computer win, resume, bad saves, Persian).
* **`tests/games/memory.*.test.js(x)`** — the engine (deck has each symbol twice, flip rules and
  input lock, match keeps the turn / miss passes it, ties, solo, rematch rotation, validated
  save/restore), the bot (always flips a legal card, uses only seen cards, recall levels via the
  injected RNG, Hard beats Easy) and the UI (setup, sizes, locks, arrow keys, wins/ties/solo,
  computer turns incl. a computer win, resume, tampered saves, Persian/RTL).
* **`tests/shared/css.test.js`** — every stylesheet has balanced braces (a broken rule once slipped in).
* **`tests/games/pig/Dice.test.jsx`** — pip rendering for all six faces, mood classes,
  landing replay and the accessible labels.

---

## License

MIT — do what you like. Built as an original product: this shares a *visual
language* with modern playful UI systems (flat, bright, chunky, hard-lipped)
but no logos, assets, layouts or copy from any other product.
