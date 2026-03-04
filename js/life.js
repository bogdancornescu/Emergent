// ── Conway's Game of Life ──

import { clearCanvas, getCanvasPos } from './utils.js';

const CELL_SIZE = 6;
const PATTERNS = {
  glider: { w: 3, h: 3, cells: [[1,0],[2,1],[0,2],[1,2],[2,2]] },
  pulsar: {
    w: 13, h: 13, cells: [
      [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
      [0,2],[5,2],[7,2],[12,2],
      [0,3],[5,3],[7,3],[12,3],
      [0,4],[5,4],[7,4],[12,4],
      [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],
      [2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
      [0,8],[5,8],[7,8],[12,8],
      [0,9],[5,9],[7,9],[12,9],
      [0,10],[5,10],[7,10],[12,10],
      [2,12],[3,12],[4,12],[8,12],[9,12],[10,12],
    ],
  },
  gun: {
    w: 36, h: 9, cells: [
      [24,0],
      [22,1],[24,1],
      [12,2],[13,2],[20,2],[21,2],[34,2],[35,2],
      [11,3],[15,3],[20,3],[21,3],[34,3],[35,3],
      [0,4],[1,4],[10,4],[16,4],[20,4],[21,4],
      [0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],
      [10,6],[16,6],[24,6],
      [11,7],[15,7],
      [12,8],[13,8],
    ],
  },
  rpentomino: { w: 3, h: 3, cells: [[1,0],[2,0],[0,1],[1,1],[1,2]] },
};

export class LifeSim {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.cols = 0;
    this.rows = 0;
    this.grid = null;
    this.nextGrid = null;
    this.running = false;
    this.generation = 0;
    this.population = 0;
    this.speed = 15;
    this.frameCount = 0;
    this.animId = null;
    this.drawing = false;
    this.drawValue = 1;

    // Bind handlers
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._loop = this._loop.bind(this);

    // Bind UI
    this._bindUI();
  }

  init({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.cols = Math.floor(width / CELL_SIZE);
    this.rows = Math.floor(height / CELL_SIZE);
    this.grid = new Uint8Array(this.cols * this.rows);
    this.nextGrid = new Uint8Array(this.cols * this.rows);
    this.generation = 0;
    this.population = 0;

    // Canvas events
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('mouseleave', this._onMouseUp);
    this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this._onTouchEnd);

    this._draw();
    this._updateStats();
    this._startLoop();
  }

  resize({ ctx, width, height }) {
    const oldCols = this.cols;
    const oldRows = this.rows;
    const oldGrid = this.grid;

    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.cols = Math.floor(width / CELL_SIZE);
    this.rows = Math.floor(height / CELL_SIZE);
    this.grid = new Uint8Array(this.cols * this.rows);
    this.nextGrid = new Uint8Array(this.cols * this.rows);

    // Copy old data
    const minC = Math.min(oldCols, this.cols);
    const minR = Math.min(oldRows, this.rows);
    for (let y = 0; y < minR; y++) {
      for (let x = 0; x < minC; x++) {
        this.grid[y * this.cols + x] = oldGrid[y * oldCols + x];
      }
    }

    this._draw();
  }

  destroy() {
    this.running = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mouseleave', this._onMouseUp);
    this.canvas.removeEventListener('touchstart', this._onTouchStart);
    this.canvas.removeEventListener('touchmove', this._onTouchMove);
    this.canvas.removeEventListener('touchend', this._onTouchEnd);
    this.overlay.textContent = '';
  }

  // ── Simulation ──

  step() {
    const { cols, rows, grid, nextGrid } = this;
    let pop = 0;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // Count neighbors (toroidal wrap)
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = (x + dx + cols) % cols;
            const ny = (y + dy + rows) % rows;
            n += grid[ny * cols + nx];
          }
        }
        const idx = y * cols + x;
        const alive = grid[idx];
        // Birth: exactly 3 neighbors. Survival: 2 or 3 neighbors.
        nextGrid[idx] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
        pop += nextGrid[idx];
      }
    }

    // Swap buffers
    this.grid = nextGrid;
    this.nextGrid = grid;
    this.generation++;
    this.population = pop;
  }

  // ── Rendering ──

  _draw() {
    const { ctx, cols, rows, grid, width, height } = this;
    clearCanvas(ctx, width, height);

    // Draw grid lines (very subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, rows * CELL_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(cols * CELL_SIZE, y * CELL_SIZE);
      ctx.stroke();
    }

    // Draw alive cells
    ctx.fillStyle = '#4fc3f7';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y * cols + x]) {
          ctx.fillRect(x * CELL_SIZE + 0.5, y * CELL_SIZE + 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
        }
      }
    }
  }

  _updateStats() {
    document.getElementById('life-gen').textContent = this.generation;
    document.getElementById('life-pop').textContent = this.population;
  }

  // ── Loop ──

  _startLoop() {
    const loop = () => {
      this.animId = requestAnimationFrame(loop);
      this.frameCount++;
      if (this.running && this.frameCount % Math.max(1, Math.round(60 / this.speed)) === 0) {
        this.step();
        this._draw();
        this._updateStats();
      }
    };
    this.animId = requestAnimationFrame(loop);
  }

  _loop() {} // placeholder

  // ── Mouse interactions ──

  _cellAt(pos) {
    const x = Math.floor(pos.x / CELL_SIZE);
    const y = Math.floor(pos.y / CELL_SIZE);
    if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
      return { x, y };
    }
    return null;
  }

  _toggleCell(pos) {
    const cell = this._cellAt(pos);
    if (!cell) return;
    const idx = cell.y * this.cols + cell.x;
    this.grid[idx] = this.drawValue;
    this._draw();
    this._countPop();
    this._updateStats();
  }

  _countPop() {
    let pop = 0;
    for (let i = 0; i < this.grid.length; i++) pop += this.grid[i];
    this.population = pop;
  }

  _onMouseDown(e) {
    this.drawing = true;
    const pos = getCanvasPos(this.canvas, e);
    const cell = this._cellAt(pos);
    if (cell) {
      const idx = cell.y * this.cols + cell.x;
      this.drawValue = this.grid[idx] ? 0 : 1;
    }
    this._toggleCell(pos);
  }

  _onMouseMove(e) {
    if (!this.drawing) return;
    this._toggleCell(getCanvasPos(this.canvas, e));
  }

  _onMouseUp() {
    this.drawing = false;
  }

  _onTouchStart(e) {
    e.preventDefault();
    this.drawing = true;
    const pos = getCanvasPos(this.canvas, e);
    const cell = this._cellAt(pos);
    if (cell) {
      const idx = cell.y * this.cols + cell.x;
      this.drawValue = this.grid[idx] ? 0 : 1;
    }
    this._toggleCell(pos);
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (!this.drawing) return;
    this._toggleCell(getCanvasPos(this.canvas, e));
  }

  _onTouchEnd() {
    this.drawing = false;
  }

  // ── Pattern placement ──

  _placePattern(name) {
    const p = PATTERNS[name];
    if (!p) return;
    const ox = Math.floor(this.cols / 2 - p.w / 2);
    const oy = Math.floor(this.rows / 2 - p.h / 2);
    this.grid.fill(0);
    this.generation = 0;
    for (const [cx, cy] of p.cells) {
      const x = ox + cx;
      const y = oy + cy;
      if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
        this.grid[y * this.cols + x] = 1;
      }
    }
    this._countPop();
    this._draw();
    this._updateStats();
  }

  // ── UI Bindings ──

  _bindUI() {
    const playBtn = document.getElementById('life-play');
    playBtn.addEventListener('click', () => {
      this.running = !this.running;
      playBtn.textContent = this.running ? 'Pause' : 'Play';
      playBtn.classList.toggle('primary', !this.running);
    });

    document.getElementById('life-step').addEventListener('click', () => {
      if (!this.running) {
        this.step();
        this._draw();
        this._updateStats();
      }
    });

    document.getElementById('life-clear').addEventListener('click', () => {
      this.grid.fill(0);
      this.generation = 0;
      this.population = 0;
      this._draw();
      this._updateStats();
    });

    document.getElementById('life-random').addEventListener('click', () => {
      for (let i = 0; i < this.grid.length; i++) {
        this.grid[i] = Math.random() < 0.25 ? 1 : 0;
      }
      this.generation = 0;
      this._countPop();
      this._draw();
      this._updateStats();
    });

    const speedSlider = document.getElementById('life-speed');
    const speedVal = document.getElementById('life-speed-val');
    speedSlider.addEventListener('input', () => {
      this.speed = parseInt(speedSlider.value);
      speedVal.textContent = this.speed;
    });

    // Pattern buttons
    document.querySelectorAll('[data-pattern]').forEach(btn => {
      btn.addEventListener('click', () => {
        this._placePattern(btn.dataset.pattern);
      });
    });
  }
}
