'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

// ---- Skins ----
// Cada skin define su paleta (índice = tipo de pieza, 0 vacío), el fondo y la
// rejilla del tablero, y un renderer drawBlock(context, px, py, size, color, alpha)
// que recibe coordenadas en píxeles. drawBlock() global fija globalAlpha y
// restaura el estado del contexto (sombras incluidas) después de cada bloque.

const SKIN_STORAGE_KEY = 'tetris.skin';

// Traza un rectángulo redondeado; usa roundRect si existe y arcTo si no.
function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, w, h, r);
    return;
  }
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

const SKINS = {
  retro: {
    name: 'Retro',
    bg: '#1a1a25',
    grid: '#22222e',
    colors: [
      null,
      '#4dd0e1', // I - cyan
      '#ffd54f', // O - yellow
      '#ba68c8', // T - purple
      '#81c784', // S - green
      '#e57373', // Z - red
      '#00bfff', // J - deep sky blue
      '#ffb74d', // L - orange
    ],
    // Bloque cuadrado plano con un brillo en la parte superior (estilo original)
    drawBlock(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },

  neon: {
    name: 'Neón',
    bg: '#000000',
    grid: '#0c1420',
    colors: [
      null,
      '#00f0ff', // I
      '#fff200', // O
      '#d400ff', // T
      '#39ff14', // S
      '#ff1744', // Z
      '#2979ff', // J
      '#ff9100', // L
    ],
    // Contorno brillante con glow (shadowBlur) y relleno translúcido
    drawBlock(context, px, py, size, color, alpha) {
      const inset = 3;
      context.globalAlpha = alpha * 0.25;
      context.fillStyle = color;
      context.fillRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
      context.globalAlpha = alpha;
      context.shadowColor = color;
      context.shadowBlur = size * 0.4;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
      // núcleo blanco tenue para dar sensación de tubo de neón
      context.shadowBlur = 0;
      context.globalAlpha = alpha * 0.5;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 0.75;
      context.strokeRect(px + inset, py + inset, size - inset * 2, size - inset * 2);
    },
  },

  pastel: {
    name: 'Pastel',
    bg: '#fbf6f1',
    grid: '#ece3dc',
    colors: [
      null,
      '#9ee6e3', // I
      '#fbe89a', // O
      '#cdb4db', // T
      '#b5ead7', // S
      '#ffadad', // Z
      '#a2d2ff', // J
      '#ffd6a5', // L
    ],
    // Bloque con esquinas redondeadas, borde suave y brillo superior
    drawBlock(context, px, py, size, color, alpha) {
      const pad = 1.5;
      const w = size - pad * 2;
      const r = size * 0.25;
      roundRectPath(context, px + pad, py + pad, w, w, r);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = 'rgba(90,70,90,0.18)';
      context.lineWidth = 1;
      context.stroke();
      roundRectPath(context, px + pad + 3, py + pad + 3, w - 6, w * 0.3, r * 0.6);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
      // Pieza fantasma: sobre el fondo claro casi no se ve, así que se
      // refuerza con un contorno discontinuo más opaco.
      if (alpha < 0.5) {
        context.globalAlpha = 0.6;
        context.setLineDash([4, 3]);
        roundRectPath(context, px + pad, py + pad, w, w, r);
        context.strokeStyle = 'rgba(90,70,90,0.7)';
        context.lineWidth = 1.5;
        context.stroke();
      }
    },
  },

  pixel: {
    name: 'Pixel art',
    bg: '#1b1b2f',
    grid: '#25254a',
    colors: [
      null,
      '#3cbcfc', // I
      '#f8d838', // O
      '#b853f8', // T
      '#58d854', // S
      '#f83800', // Z
      '#0078f8', // J
      '#fc9838', // L
    ],
    // Bloque plano con textura de "píxeles": bisel claro arriba/izquierda,
    // sombra abajo/derecha, contorno oscuro y un punto de brillo.
    drawBlock(context, px, py, size, color) {
      const p = Math.max(1, Math.floor(size / 6)); // tamaño de un "píxel"
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(px + p, py + p, size - p * 2, p);
      context.fillRect(px + p, py + p * 2, p, size - p * 3);
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.fillRect(px + p, py + size - p * 2, size - p * 2, p);
      context.fillRect(px + size - p * 2, py + p * 2, p, size - p * 4);
      context.fillStyle = 'rgba(255,255,255,0.75)';
      context.fillRect(px + p * 2, py + p * 2, p, p);
      context.strokeStyle = 'rgba(0,0,0,0.55)';
      context.lineWidth = 1;
      context.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
    },
  },
};

// Lee la skin guardada; si no existe o no es válida, usa retro.
function loadSkin() {
  try {
    const stored = localStorage.getItem(SKIN_STORAGE_KEY);
    if (stored && Object.prototype.hasOwnProperty.call(SKINS, stored)) return stored;
  } catch (e) { /* localStorage no disponible */ }
  return 'retro';
}

let currentSkin = loadSkin();
// Accesor compatible con el antiguo COLORS: siempre apunta a la paleta activa.
let COLORS = SKINS[currentSkin].colors;

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, hold, canHold, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createPiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return createPiece(Math.floor(Math.random() * 7) + 1);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Intervalo de caída (ms) para un nivel dado.
function dropIntervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = gameStartLevel + Math.floor(lines / 10);
    dropInterval = dropIntervalFor(level);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  canHold = true;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  drawHold();
}

// Guarda la pieza actual en el hold (o la intercambia). Solo una vez por pieza.
function holdPiece() {
  if (!canHold) return;
  const heldType = hold;
  hold = current.type;
  if (heldType) {
    current = createPiece(heldType);
    if (collide(current.shape, current.x, current.y)) endGame();
  } else {
    spawn();
  }
  canHold = false;
  dropAccum = 0;
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const a = alpha ?? 1;
  context.save();
  context.globalAlpha = a;
  const skin = SKINS[currentSkin];
  skin.drawBlock(context, x * size, y * size, size, skin.colors[colorIndex], a);
  context.restore();
}

function drawGrid() {
  ctx.strokeStyle = SKINS[currentSkin].grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawPreview(context, previewCanvas, shape, alpha) {
  const NB = 30;
  context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  if (!shape) return;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB, alpha);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next.shape);
}

function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold ? PIECES[hold] : null, canHold ? 1 : 0.3);
  holdCanvas.classList.toggle('locked', !canHold);
}

// ---- Selector de skin ----
const skinSelect = document.getElementById('skin-select');

for (const [key, skin] of Object.entries(SKINS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = skin.name;
  skinSelect.appendChild(opt);
}

// Aplica la skin al instante: paleta, fondos de los canvas y redibujado.
function applySkin(name) {
  if (!Object.prototype.hasOwnProperty.call(SKINS, name)) name = 'retro';
  currentSkin = name;
  COLORS = SKINS[name].colors;
  document.documentElement.style.setProperty('--board-bg', SKINS[name].bg);
  document.body.dataset.skin = name;
  skinSelect.value = name;
  if (current) {
    draw();
    drawNext();
    drawHold();
  }
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  try { localStorage.setItem(SKIN_STORAGE_KEY, currentSkin); } catch (e) { /* sin persistencia */ }
  skinSelect.blur(); // para que las flechas vuelvan a controlar el juego
});

// Las teclas del juego nunca deben cambiar la skin si el selector quedó
// enfocado (p. ej. tras cerrarlo con Escape): se suelta el foco y el evento
// sigue hasta el manejador del juego.
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space',
  'KeyP', 'KeyC', 'KeyX', 'ShiftLeft', 'ShiftRight'];
skinSelect.addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code)) {
    e.preventDefault();
    skinSelect.blur();
  }
});

applySkin(currentSkin);

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  if (paused) resumeGame();
  else pauseGame();
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = gameStartLevel = startLevel;
  paused = false;
  gameOver = false;
  dropInterval = dropIntervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (handlePauseKey(e)) return;
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ---- Menú de pausa ----
// Nivel inicial elegido para la próxima partida (persistido en localStorage).
const START_LEVEL_KEY = 'tetris.startLevel';
const MIN_START_LEVEL = 1;
const MAX_START_LEVEL = 10;

const pauseMenu = document.getElementById('pause-menu');
const pmResumeBtn = document.getElementById('pm-resume');
const pmRestartBtn = document.getElementById('pm-restart');
const pmControlsBtn = document.getElementById('pm-controls');
const pmControlsList = document.getElementById('pm-controls-list');
const pmLevel = document.getElementById('pm-level');
const pmLevelValue = document.getElementById('pm-level-value');
const pmLevelDown = document.getElementById('pm-level-down');
const pmLevelUp = document.getElementById('pm-level-up');
// Elementos navegables con ↑/↓, en orden visual.
const pmItems = [pmResumeBtn, pmRestartBtn, pmControlsBtn, pmLevel];

let startLevel = loadStartLevel();
let gameStartLevel = startLevel; // nivel con el que empezó la partida en curso

function clampLevel(n) {
  return Math.min(MAX_START_LEVEL, Math.max(MIN_START_LEVEL, n));
}

function loadStartLevel() {
  try {
    const n = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
    if (Number.isFinite(n)) return clampLevel(n);
  } catch (err) { /* localStorage no disponible */ }
  return MIN_START_LEVEL;
}

function setStartLevel(n) {
  startLevel = clampLevel(n);
  try {
    localStorage.setItem(START_LEVEL_KEY, String(startLevel));
  } catch (err) { /* localStorage no disponible */ }
  renderStartLevel();
}

function renderStartLevel() {
  pmLevelValue.textContent = startLevel;
  pmLevel.setAttribute('aria-valuenow', startLevel);
  pmLevelDown.disabled = startLevel <= MIN_START_LEVEL;
  pmLevelUp.disabled = startLevel >= MAX_START_LEVEL;
}

function setControlsVisible(visible) {
  pmControlsList.classList.toggle('hidden', !visible);
  pmControlsBtn.textContent = visible ? 'Ocultar controles' : 'Ver controles';
  pmControlsBtn.setAttribute('aria-expanded', String(visible));
}

function pauseGame() {
  paused = true;
  cancelAnimationFrame(animId);
  setControlsVisible(false);
  renderStartLevel();
  pauseMenu.classList.remove('hidden');
  pmResumeBtn.focus();
}

function hidePauseMenu() {
  pauseMenu.classList.add('hidden');
  if (pauseMenu.contains(document.activeElement)) document.activeElement.blur();
}

function resumeGame() {
  hidePauseMenu();
  paused = false;
  // Reinicia el reloj para que la pieza no "salte" al reanudar.
  lastTime = performance.now();
  dropAccum = 0;
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function restartFromMenu() {
  hidePauseMenu();
  init();
}

function focusMenuItem(delta) {
  const idx = pmItems.findIndex(el => el.contains(document.activeElement));
  const nextIdx = idx === -1
    ? 0
    : (idx + delta + pmItems.length) % pmItems.length;
  pmItems[nextIdx].focus();
}

// Gestiona las teclas de pausa y del menú. Devuelve true si consumió el evento
// (mientras el menú está abierto se consumen todas para bloquear el juego).
function handlePauseKey(e) {
  if (gameOver) return false;
  const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
  const isToggle = !hasModifier && (e.code === 'KeyP' || e.code === 'Escape');
  if (isToggle) {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return true;
  }
  if (!paused) return false;
  // Atajos del navegador (Cmd/Ctrl+R, etc.) siguen funcionando, pero no llegan al juego.
  if (hasModifier) return true;

  const onLevel = pmLevel.contains(document.activeElement);
  switch (e.code) {
    case 'ArrowUp':
      e.preventDefault();
      focusMenuItem(-1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      focusMenuItem(1);
      break;
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      if (onLevel) setStartLevel(startLevel + (e.code === 'ArrowRight' ? 1 : -1));
      break;
    case 'Enter':
    case 'NumpadEnter':
    case 'Space':
      // Evita el click nativo del botón para no ejecutar la acción dos veces.
      e.preventDefault();
      if (!e.repeat && !onLevel && pmItems.includes(document.activeElement)) {
        document.activeElement.click();
      }
      break;
    case 'Tab':
      // Mantiene el foco dentro del menú.
      e.preventDefault();
      focusMenuItem(e.shiftKey ? -1 : 1);
      break;
  }
  return true;
}

pmResumeBtn.addEventListener('click', resumeGame);
pmRestartBtn.addEventListener('click', restartFromMenu);
pmControlsBtn.addEventListener('click', () => {
  setControlsVisible(pmControlsList.classList.contains('hidden'));
});
// Los botones −/+ no toman el foco: lo dejamos en el selector para que ←/→ sigan
// funcionando aunque un botón quede deshabilitado al llegar al límite.
for (const [btn, delta] of [[pmLevelDown, -1], [pmLevelUp, 1]]) {
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => {
    setStartLevel(startLevel + delta);
    pmLevel.focus();
  });
}
// Algunos navegadores activan el botón con Espacio en keyup; ya lo hicimos en keydown.
document.addEventListener('keyup', e => {
  if ((e.code === 'Space' || e.code === 'Enter') && pauseMenu.contains(e.target)) {
    e.preventDefault();
  }
});
renderStartLevel();

init();
