# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A falling-block puzzle game in vanilla JavaScript + HTML5 Canvas. No dependencies, no `package.json`, no build step, no tests, no linter. The whole game is three files: `index.html` (DOM + canvases), `style.css` (dark/retro theme), `game.js` (all logic). The README and the in-game text are in Spanish, so keep new user-facing strings in Spanish.

## Running

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or simply: open index.html
```

To check a change, reload the browser. Nothing gets compiled.

## Architecture (`game.js`)

- **Global mutable state**: one `let` line holds all of it (`board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId`). `init()` resets everything and also restarts the game (it is wired to the restart button).
- **Color index is the piece identity.** `PIECES[type]` matrices store the piece's type number (1–7) in their filled cells. That same number indexes the active skin's `colors` array and is what `merge()` writes into `board`. Index 0 is empty or `null`. Adding a piece type means adding an entry at the same index in `PIECES` and in **every** skin's `colors`, and widening the `* 7` in `randomPiece()`.
- **Skins** (`// ---- Skins ----`): `SKINS = { retro, neon, pastel, pixel }`, each `{ name, bg, grid, colors[8], drawBlock(context, px, py, size, color, alpha) }` (pixel coords). `currentSkin` holds the active key and `COLORS` is a `let` alias of `SKINS[currentSkin].colors`. The global `drawBlock(context, x, y, colorIndex, size, alpha)` keeps its cell-based signature, wraps the skin renderer in `save()/restore()` (so neon's `shadowBlur` never leaks) and sets `globalAlpha`. `drawGrid` takes its color from the skin; canvas backgrounds come from the CSS variable `--board-bg`, and `body[data-skin]` allows per-skin CSS. `applySkin(name)` (in `// ---- Selector de skin ----`) validates the name, updates all of this and redraws; the choice is persisted in `localStorage` key `tetris.skin` (falls back to `retro`). The `<select id="skin-select">` blurs after a change so arrow keys keep driving the game.
- **Pieces** are `{ type, shape, x, y }`. Rotation (`rotateCW`) builds a new matrix. `tryRotate` tries horizontal kicks `[0, -1, 1, -2, 2]`; this is not SRS.
- **`collide(shape, ox, oy)`** is the single validity check used for movement, rotation, the ghost piece (`ghostY`), gravity and spawn. Cells above the board (`ny < 0`) are allowed.
- **Lifecycle**: gravity in `loop()` or a drop → `lockPiece()` → `merge()` → `clearLines()` (updates score, level and `dropInterval`) → `spawn()`. If the new piece collides when it spawns, `spawn()` calls `endGame()`.
- **Loop**: `requestAnimationFrame` collects elapsed time in `dropAccum` and compares it against `dropInterval = max(100, 1000 - (level-1)*90)`. `draw()` redraws the whole canvas every frame. The HUD (`updateHUD`) and next-piece preview (`drawNext`) only update when an event triggers them.
- **Overlay**: `#overlay` is the GAME OVER screen. Its title and score text are set from JS. On game over it also shows `#records-panel` (hidden again by `init()`).
- **Pause menu** (`// ---- Menú de pausa ----` section): `#pause-menu` opens with `P`/`Escape`: the keydown listener calls `handlePauseKey(e)` first, which calls `togglePause()` → `pauseGame()`/`resumeGame()`. While `paused` it swallows every key (menu nav with ↑/↓/Tab, Enter/Space, ←/→ for the level), so game input is blocked. The menu's controls list (`#pm-controls-list`) duplicates the sidebar list, so keep both in sync when rebinding keys. `resumeGame()` resets `lastTime` and `dropAccum`. Pause does nothing during game over.
- **Start level**: `startLevel` (1–10, saved in `localStorage` key `tetris.startLevel`) is the menu choice for the next game. `init()` copies it into `gameStartLevel`, and `clearLines()` computes `level = gameStartLevel + floor(lines / 10)`, so changing the selector mid-game does not affect the current game.
- **Records** (`// ---- Records ----` section at the end of `game.js`): its own `let` line (`combo, gameBestCombo, started, recordSaved, savedIndex`). `localStorage` keys `tetris.records` (top 5 `{name, score, lines, level, date}`), `tetris.stats` (`{bestCombo, maxLines}`) and `tetris.lastName` (prefills the name input), always accessed via the try/catch helpers `readJSON`/`writeJSON`/`removeKey`. Hooks into shared code are single calls: `trackCombo(cleared)` in `clearLines()`, `showGameOverRecords()` in `endGame()` (also updates stats), `resetRecordsState()` in `init()`, and `handleRecordsKeys(e)` at the top of the keydown listener (ignores keys typed in inputs; before the first game only Enter does anything). Names are rendered with `textContent`.
- **Startup**: the script ends with `showStartScreen()`, not `init()`. The `#start-screen` overlay shows the records; `startGame()` (Jugar button or Enter) runs `init()` for the first time. Later restarts go straight through `init()`.

## Gotchas

- Canvas size is hard-coded in `index.html` (`300×600` = `COLS*BLOCK × ROWS*BLOCK`; the preview is `120×120` = 4×30). Change those when you change `COLS`, `ROWS` or `BLOCK`.
- `endGame()` can run from inside `loop()` (gravity lock → spawn). `loop()` checks `gameOver` after `draw()` and stops requesting frames.
