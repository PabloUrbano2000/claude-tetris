'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#00bfff', // J - deep sky blue
  '#ffb74d', // L - orange
];

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
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  trackCombo(cleared);
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
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
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

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
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
  if (gameOver) return; // endGame() pudo ejecutarse dentro de este frame: no pedir otro
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  resetRecordsState();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (handleRecordsKeys(e)) return;
  if (e.code === 'KeyP') { togglePause(); return; }
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

// ---- Records ----
// Top 5 de puntuaciones y estadísticas globales guardadas en localStorage.

const RECORDS_KEY = 'tetris.records';
const STATS_KEY = 'tetris.stats';
const LAST_NAME_KEY = 'tetris.lastName';
const MAX_RECORDS = 5;
const MAX_NAME_LENGTH = 12;
const DEFAULT_NAME = 'JUGADOR';

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const startRecordsEl = document.getElementById('start-records');
const startStatsEl = document.getElementById('start-stats');
const recordsPanel = document.getElementById('records-panel');
const recordForm = document.getElementById('record-form');
const recordMsg = document.getElementById('record-msg');
const recordName = document.getElementById('record-name');
const gameoverRecordsEl = document.getElementById('gameover-records');
const gameoverGameStatsEl = document.getElementById('gameover-game-stats');
const gameoverStatsEl = document.getElementById('gameover-stats');

// Estado de records: combo actual, mejor combo de la partida, si ya empezó el juego
// si ya se guardó el record de esta partida y su índice en la tabla (-1 si ninguno).
let combo = 0, gameBestCombo = 0, started = false, recordSaved = false, savedIndex = -1;

// Acceso a localStorage siempre protegido (modo privado, cuota llena, JSON corrupto…)
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento disponible: se ignora
  }
}

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // sin almacenamiento disponible: se ignora
  }
}

function toCount(v) {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function loadRecords() {
  const data = readJSON(RECORDS_KEY, []);
  if (!Array.isArray(data)) return [];
  return data
    .filter(r => r && typeof r.name === 'string' && Number.isFinite(r.score))
    .map(r => ({
      name: r.name.slice(0, MAX_NAME_LENGTH),
      score: r.score,
      lines: toCount(r.lines),
      level: toCount(r.level) || 1,
      date: typeof r.date === 'string' ? r.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RECORDS);
}

function loadStats() {
  const data = readJSON(STATS_KEY, null);
  return {
    bestCombo: toCount(data && data.bestCombo),
    maxLines: toCount(data && data.maxLines),
  };
}

// Puesto (1..5) que ocuparía la puntuación, o 0 si no entra en el top
function recordRank(value, records) {
  if (value <= 0) return 0;
  const idx = records.findIndex(r => value > r.score);
  const pos = idx === -1 ? records.length : idx;
  return pos < MAX_RECORDS ? pos + 1 : 0;
}

// Inserta el record y devuelve su índice en la tabla
function saveRecord(name) {
  const entry = { name, score, lines, level, date: new Date().toISOString() };
  const records = loadRecords();
  records.push(entry);
  records.sort((a, b) => b.score - a.score); // sort estable: empates quedan detrás
  const top = records.slice(0, MAX_RECORDS);
  writeJSON(RECORDS_KEY, top);
  return top.indexOf(entry);
}

// Se llama en cada game over, entre o no la puntuación en el top
function updateStats() {
  const stats = loadStats();
  writeJSON(STATS_KEY, {
    bestCombo: Math.max(stats.bestCombo, gameBestCombo),
    maxLines: Math.max(stats.maxLines, lines),
  });
}

// Combo = bloqueos consecutivos que limpian al menos una línea
function trackCombo(cleared) {
  if (cleared) {
    combo++;
    if (combo > gameBestCombo) gameBestCombo = combo;
  } else {
    combo = 0;
  }
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// Construye la tabla con textContent (los nombres nunca se interpretan como HTML)
function renderRecordsTable(container, highlightIndex) {
  container.replaceChildren();
  const records = loadRecords();
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'records-empty';
    empty.textContent = 'Aún no hay records. ¡Sé el primero!';
    container.appendChild(empty);
    return;
  }
  const table = document.createElement('table');
  table.className = 'records-table';
  const headRow = table.createTHead().insertRow();
  for (const h of ['#', 'NOMBRE', 'PUNTOS', 'LÍNEAS', 'NIVEL', 'FECHA']) {
    const th = document.createElement('th');
    th.textContent = h;
    headRow.appendChild(th);
  }
  const body = table.createTBody();
  records.forEach((r, i) => {
    const row = body.insertRow();
    if (i === highlightIndex) row.className = 'highlight';
    for (const v of [i + 1, r.name, r.score.toLocaleString(), r.lines, r.level, formatDate(r.date)]) {
      row.insertCell().textContent = v;
    }
  });
  container.appendChild(table);
}

function statsText() {
  const s = loadStats();
  return `Mejor combo: ${s.bestCombo} · Líneas máx.: ${s.maxLines}`;
}

function renderStartScreen() {
  renderRecordsTable(startRecordsEl, -1);
  startStatsEl.textContent = statsText();
}

function renderGameOverRecords() {
  renderRecordsTable(gameoverRecordsEl, savedIndex);
  gameoverGameStatsEl.textContent = `Esta partida: combo ${gameBestCombo} · ${lines} líneas`;
  gameoverStatsEl.textContent = statsText();
}

// Muestra el formulario de nombre si la puntuación entra en el top 5
function updateRecordForm() {
  const rank = recordSaved ? 0 : recordRank(score, loadRecords());
  recordForm.classList.toggle('hidden', !rank);
  if (rank) recordMsg.textContent = `¡Nuevo record! Puesto #${rank}`;
  return rank;
}

function showGameOverRecords() {
  updateStats();
  recordSaved = false;
  savedIndex = -1;
  const lastName = readJSON(LAST_NAME_KEY, '');
  recordName.value = typeof lastName === 'string' && lastName
    ? lastName.slice(0, MAX_NAME_LENGTH)
    : DEFAULT_NAME;
  const rank = updateRecordForm();
  renderGameOverRecords();
  recordsPanel.classList.remove('hidden');
  if (rank) {
    // Diferido: si el game over vino de una tecla, su carácter no debe caer en el input
    setTimeout(() => {
      if (!gameOver || recordSaved) return;
      recordName.focus();
      recordName.select();
    }, 0);
  }
}

function resetRecordsState() {
  combo = 0;
  gameBestCombo = 0;
  recordSaved = false;
  savedIndex = -1;
  recordsPanel.classList.add('hidden');
  recordForm.classList.add('hidden');
}

function refreshRecordsViews() {
  renderStartScreen();
  if (gameOver) {
    updateRecordForm();
    renderGameOverRecords();
  }
}

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!gameOver || recordSaved) return;
  const name = recordName.value.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME;
  recordSaved = true;
  savedIndex = saveRecord(name);
  writeJSON(LAST_NAME_KEY, name);
  recordName.blur();
  recordForm.classList.add('hidden');
  renderGameOverRecords();
});

// Confirmación en dos clics (sin confirm()): el primero arma, el segundo borra
document.querySelectorAll('.clear-records-btn').forEach(btn => {
  const label = btn.textContent;
  let timer = null;
  const disarm = () => {
    clearTimeout(timer);
    btn.classList.remove('confirming');
    btn.textContent = label;
  };
  btn.addEventListener('click', () => {
    btn.blur(); // que un Enter posterior no "pulse" de nuevo este botón
    if (!btn.classList.contains('confirming')) {
      btn.classList.add('confirming');
      btn.textContent = '¿Seguro? Clic otra vez';
      timer = setTimeout(disarm, 3000);
      return;
    }
    disarm();
    removeKey(RECORDS_KEY);
    removeKey(STATS_KEY);
    savedIndex = -1;
    refreshRecordsViews();
  });
});

function showStartScreen() {
  renderStartScreen();
  startScreen.classList.remove('hidden');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
}

function startGame() {
  if (started) return;
  started = true;
  startScreen.classList.add('hidden');
  if (document.activeElement) document.activeElement.blur();
  init();
}

// Devuelve true si el evento ya se gestionó aquí y el juego debe ignorarlo
function handleRecordsKeys(e) {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') {
    // escribiendo el nombre; ignora la auto-repetición de Espacio que venga de un hard drop
    if (e.repeat && e.code === 'Space') e.preventDefault();
    return true;
  }
  if (!started) {
    if (e.key === 'Enter') {
      e.preventDefault(); // evita que Enter active el botón enfocado
      startGame();
    }
    return true;
  }
  return false;
}

playBtn.addEventListener('click', startGame);

showStartScreen();
