// ── Wolfram Elementary Cellular Automata ──

import { clearCanvas } from './utils.js';

const CELL_SIZE = 3;

export class WolframSim {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.cols = 0;
    this.maxRows = 0;
    this.rule = 30;
    this.ruleTable = [];
    this.rows = [];
    this.initMode = 'single'; // 'single' or 'random'
    this.animId = null;
    this.currentRow = 0;
    this.running = true;

    this._bindUI();
  }

  init({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.cols = Math.floor(width / CELL_SIZE);
    this.maxRows = Math.floor(height / CELL_SIZE);

    this._buildRuleTable();
    this._reset();
    this._updatePreview();
    this._startLoop();
  }

  resize({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.cols = Math.floor(width / CELL_SIZE);
    this.maxRows = Math.floor(height / CELL_SIZE);
    this._reset();
  }

  destroy() {
    this.running = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.overlay.textContent = '';
  }

  // ── Rule Table ──

  _buildRuleTable() {
    this.ruleTable = [];
    for (let i = 0; i < 8; i++) {
      this.ruleTable[i] = (this.rule >> i) & 1;
    }
  }

  // ── Reset ──

  _reset() {
    this.rows = [];
    this.currentRow = 0;

    // First row
    const first = new Uint8Array(this.cols);
    if (this.initMode === 'single') {
      first[Math.floor(this.cols / 2)] = 1;
    } else {
      for (let i = 0; i < this.cols; i++) {
        first[i] = Math.random() < 0.5 ? 1 : 0;
      }
    }
    this.rows.push(first);

    clearCanvas(this.ctx, this.width, this.height);
    this._drawRow(0);
  }

  // ── Step ──

  _step() {
    if (this.currentRow >= this.maxRows - 1) return false;

    const prev = this.rows[this.currentRow];
    const next = new Uint8Array(this.cols);

    for (let x = 0; x < this.cols; x++) {
      const left = x > 0 ? prev[x - 1] : prev[this.cols - 1];
      const center = prev[x];
      const right = x < this.cols - 1 ? prev[x + 1] : prev[0];
      const index = (left << 2) | (center << 1) | right;
      next[x] = this.ruleTable[index];
    }

    this.rows.push(next);
    this.currentRow++;
    this._drawRow(this.currentRow);
    return true;
  }

  // ── Rendering ──

  _drawRow(rowIdx) {
    const row = this.rows[rowIdx];
    if (!row) return;
    const { ctx } = this;

    for (let x = 0; x < this.cols; x++) {
      if (row[x]) {
        // Color based on position — gradient across width
        const hue = 190 + (x / this.cols) * 40; // blue-cyan range
        const light = 55 + (rowIdx / this.maxRows) * 15;
        ctx.fillStyle = `hsl(${hue}, 80%, ${light}%)`;
        ctx.fillRect(x * CELL_SIZE, rowIdx * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  _drawAll() {
    clearCanvas(this.ctx, this.width, this.height);
    for (let r = 0; r <= this.currentRow; r++) {
      this._drawRow(r);
    }
  }

  // ── Loop ──

  _startLoop() {
    let frameCount = 0;
    const loop = () => {
      this.animId = requestAnimationFrame(loop);
      frameCount++;
      if (this.running && frameCount % 2 === 0) {
        // Do several rows per frame for speed
        for (let i = 0; i < 3; i++) {
          if (!this._step()) break;
        }
        this.overlay.textContent = `Row ${this.currentRow} / ${this.maxRows}`;
      }
    };
    this.animId = requestAnimationFrame(loop);
  }

  // ── Rule Preview ──

  _updatePreview() {
    const container = document.getElementById('wolfram-preview');
    container.innerHTML = '';

    for (let i = 7; i >= 0; i--) {
      const caseEl = document.createElement('div');
      caseEl.className = 'rule-case';

      const neighborhood = document.createElement('div');
      neighborhood.className = 'neighborhood';

      // Input pattern (3 cells)
      for (let bit = 2; bit >= 0; bit--) {
        const cell = document.createElement('div');
        cell.className = 'rule-cell ' + ((i >> bit) & 1 ? 'on' : 'off');
        neighborhood.appendChild(cell);
      }

      // Output
      const result = document.createElement('div');
      result.className = 'rule-cell ' + (this.ruleTable[i] ? 'on' : 'off');
      result.style.marginTop = '3px';

      caseEl.appendChild(neighborhood);
      caseEl.appendChild(result);
      container.appendChild(caseEl);
    }
  }

  // ── UI ──

  _bindUI() {
    const ruleSlider = document.getElementById('wolfram-rule');
    const ruleVal = document.getElementById('wolfram-rule-val');

    ruleSlider.addEventListener('input', () => {
      this.rule = parseInt(ruleSlider.value);
      ruleVal.textContent = this.rule;
      this._buildRuleTable();
      this._updatePreview();
      this._reset();
    });

    // Famous rules
    document.querySelectorAll('[data-rule]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.rule = parseInt(btn.dataset.rule);
        ruleSlider.value = this.rule;
        ruleVal.textContent = this.rule;
        this._buildRuleTable();
        this._updatePreview();
        this._reset();
      });
    });

    // Init mode buttons
    const singleBtn = document.getElementById('wolfram-single');
    const randomBtn = document.getElementById('wolfram-random-init');

    singleBtn.addEventListener('click', () => {
      this.initMode = 'single';
      singleBtn.classList.add('active');
      randomBtn.classList.remove('active');
      this._reset();
    });

    randomBtn.addEventListener('click', () => {
      this.initMode = 'random';
      randomBtn.classList.add('active');
      singleBtn.classList.remove('active');
      this._reset();
    });

    document.getElementById('wolfram-reset').addEventListener('click', () => {
      this._reset();
    });
  }
}
