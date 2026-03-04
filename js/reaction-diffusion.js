// ── Gray-Scott Reaction-Diffusion System ──

import { clearCanvas, getCanvasPos } from './utils.js';

const PRESETS = {
  mitosis:  { feed: 0.028, kill: 0.062, name: 'Mitosis' },
  coral:    { feed: 0.055, kill: 0.062, name: 'Coral Growth' },
  maze:     { feed: 0.029, kill: 0.057, name: 'Labyrinth' },
  spots:    { feed: 0.035, kill: 0.065, name: 'Stable Spots' },
  waves:    { feed: 0.014, kill: 0.054, name: 'Waves' },
};

export class ReactionDiffusionSim {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.gridW = 0;
    this.gridH = 0;
    this.a = null;
    this.b = null;
    this.nextA = null;
    this.nextB = null;
    this.imageData = null;
    this.tempCanvas = null;
    this.tempCtx = null;
    this.running = true;
    this.frame = 0;
    this.animId = null;
    this.brushSize = 10;

    // Gray-Scott parameters — match "Mitosis" preset
    this.dA = 1.0;
    this.dB = 0.5;
    this.feed = 0.028;
    this.kill = 0.062;
    this.dt = 1.0;

    // Scale factor — simulate at lower resolution for performance
    this.scale = 2;

    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);

    this._bindUI();
  }

  init({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.gridW = Math.floor(width / this.scale);
    this.gridH = Math.floor(height / this.scale);

    // Create reusable temp canvas for rendering
    this.tempCanvas = document.createElement('canvas');
    this.tempCanvas.width = this.gridW;
    this.tempCanvas.height = this.gridH;
    this.tempCtx = this.tempCanvas.getContext('2d');

    this._initGrids();
    this._seed();

    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mouseup', this._onMouseUp);
    this.canvas.addEventListener('mouseleave', this._onMouseUp);

    this._startLoop();
  }

  resize({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  destroy() {
    this.running = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mouseleave', this._onMouseUp);
    this.overlay.textContent = '';
  }

  // ── Grid initialization ──

  _initGrids() {
    const size = this.gridW * this.gridH;
    this.a = new Float32Array(size).fill(1.0);
    this.b = new Float32Array(size).fill(0.0);
    this.nextA = new Float32Array(size);
    this.nextB = new Float32Array(size);
  }

  _seed() {
    this._initGrids();
    const { gridW, gridH } = this;

    // Place several seed clusters with slight noise for organic feel
    const numSeeds = 12 + Math.floor(Math.random() * 10);
    for (let s = 0; s < numSeeds; s++) {
      const cx = Math.floor(Math.random() * (gridW - 30)) + 15;
      const cy = Math.floor(Math.random() * (gridH - 30)) + 15;
      const r = 2 + Math.floor(Math.random() * 4);

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const x = cx + dx;
            const y = cy + dy;
            if (x >= 1 && x < gridW - 1 && y >= 1 && y < gridH - 1) {
              const idx = y * gridW + x;
              this.b[idx] = 1.0;
              // Add small amount of noise around edges
              if (dx * dx + dy * dy > (r - 1) * (r - 1)) {
                this.b[idx] = 0.5 + Math.random() * 0.5;
              }
            }
          }
        }
      }
    }

    this.frame = 0;
  }

  // ── Simulation step ──

  _step() {
    const { gridW, gridH, a, b, nextA, nextB, dA, dB, feed, kill, dt } = this;

    for (let y = 1; y < gridH - 1; y++) {
      for (let x = 1; x < gridW - 1; x++) {
        const idx = y * gridW + x;
        const aVal = a[idx];
        const bVal = b[idx];

        // Laplacian (9-point weighted stencil for smoother results)
        const lapA =
          0.05 * a[idx - gridW - 1] + 0.2 * a[idx - gridW] + 0.05 * a[idx - gridW + 1] +
          0.2  * a[idx - 1]                                  + 0.2  * a[idx + 1] +
          0.05 * a[idx + gridW - 1] + 0.2 * a[idx + gridW] + 0.05 * a[idx + gridW + 1] -
          aVal;
        const lapB =
          0.05 * b[idx - gridW - 1] + 0.2 * b[idx - gridW] + 0.05 * b[idx - gridW + 1] +
          0.2  * b[idx - 1]                                  + 0.2  * b[idx + 1] +
          0.05 * b[idx + gridW - 1] + 0.2 * b[idx + gridW] + 0.05 * b[idx + gridW + 1] -
          bVal;

        const reaction = aVal * bVal * bVal;

        nextA[idx] = aVal + (dA * lapA - reaction + feed * (1 - aVal)) * dt;
        nextB[idx] = bVal + (dB * lapB + reaction - (kill + feed) * bVal) * dt;

        // Clamp
        if (nextA[idx] < 0) nextA[idx] = 0;
        if (nextA[idx] > 1) nextA[idx] = 1;
        if (nextB[idx] < 0) nextB[idx] = 0;
        if (nextB[idx] > 1) nextB[idx] = 1;
      }
    }

    // Swap
    const tmpA = this.a;
    const tmpB = this.b;
    this.a = this.nextA;
    this.b = this.nextB;
    this.nextA = tmpA;
    this.nextB = tmpB;

    this.frame++;
  }

  // ── Rendering ──

  _draw() {
    const { ctx, gridW, gridH, a, b } = this;

    // Create ImageData at simulation resolution
    if (!this.imageData || this.imageData.width !== gridW || this.imageData.height !== gridH) {
      this.imageData = new ImageData(gridW, gridH);
    }

    const data = this.imageData.data;

    for (let i = 0; i < gridW * gridH; i++) {
      const bVal = b[i];
      const aVal = a[i];
      const p = i * 4;

      // Color based on both chemicals for richer visualization
      // Use B as primary driver, modulated by A-B difference
      const t = bVal * 2.5; // amplify for visibility
      const clamped = Math.min(1, Math.max(0, t));

      // 4-stop gradient: black → deep blue → cyan → white
      if (clamped < 0.25) {
        const f = clamped / 0.25;
        data[p]     = Math.floor(13 + f * 5);
        data[p + 1] = Math.floor(13 + f * 15);
        data[p + 2] = Math.floor(18 + f * 50);
      } else if (clamped < 0.5) {
        const f = (clamped - 0.25) / 0.25;
        data[p]     = Math.floor(18 + f * 20);
        data[p + 1] = Math.floor(28 + f * 90);
        data[p + 2] = Math.floor(68 + f * 110);
      } else if (clamped < 0.75) {
        const f = (clamped - 0.5) / 0.25;
        data[p]     = Math.floor(38 + f * 40);
        data[p + 1] = Math.floor(118 + f * 77);
        data[p + 2] = Math.floor(178 + f * 55);
      } else {
        const f = (clamped - 0.75) / 0.25;
        data[p]     = Math.floor(78 + f * 140);
        data[p + 1] = Math.floor(195 + f * 50);
        data[p + 2] = Math.floor(233 + f * 22);
      }
      data[p + 3] = 255;
    }

    // Render to temp canvas then scale up
    this.tempCtx.putImageData(this.imageData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.tempCanvas, 0, 0, this.width, this.height);

    document.getElementById('reaction-frame').textContent = this.frame;
  }

  // ── Loop ──

  _startLoop() {
    const loop = () => {
      this.animId = requestAnimationFrame(loop);
      if (this.running) {
        // Multiple steps per frame for faster evolution
        for (let i = 0; i < 10; i++) {
          this._step();
        }
        this._draw();
      }
    };
    this.animId = requestAnimationFrame(loop);
  }

  // ── Mouse painting ──

  _painting = false;

  _paint(e) {
    const pos = getCanvasPos(this.canvas, e);
    const gx = Math.floor(pos.x / this.scale);
    const gy = Math.floor(pos.y / this.scale);
    const r = Math.floor(this.brushSize / this.scale);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const x = gx + dx;
          const y = gy + dy;
          if (x >= 1 && x < this.gridW - 1 && y >= 1 && y < this.gridH - 1) {
            const idx = y * this.gridW + x;
            this.b[idx] = 1.0;
          }
        }
      }
    }
  }

  _onMouseDown(e) {
    this._painting = true;
    this._paint(e);
  }

  _onMouseMove(e) {
    if (this._painting) this._paint(e);
  }

  _onMouseUp() {
    this._painting = false;
  }

  // ── UI ──

  _bindUI() {
    const presetSelect = document.getElementById('reaction-preset');
    presetSelect.addEventListener('change', () => {
      const preset = PRESETS[presetSelect.value];
      if (preset) {
        this.feed = preset.feed;
        this.kill = preset.kill;
        document.getElementById('reaction-feed').value = preset.feed;
        document.getElementById('reaction-feed-val').textContent = preset.feed;
        document.getElementById('reaction-kill').value = preset.kill;
        document.getElementById('reaction-kill-val').textContent = preset.kill;
        this._seed();
      }
    });

    this._bindSlider('reaction-feed', 'reaction-feed-val', v => { this.feed = v; });
    this._bindSlider('reaction-kill', 'reaction-kill-val', v => { this.kill = v; });
    this._bindSlider('reaction-brush', 'reaction-brush-val', v => { this.brushSize = Math.round(v); });

    const playBtn = document.getElementById('reaction-play');
    playBtn.addEventListener('click', () => {
      this.running = !this.running;
      playBtn.textContent = this.running ? 'Pause' : 'Play';
      playBtn.classList.toggle('primary', !this.running);
    });

    document.getElementById('reaction-clear').addEventListener('click', () => {
      this._seed();
    });
  }

  _bindSlider(sliderId, valId, callback) {
    const slider = document.getElementById(sliderId);
    const valEl = document.getElementById(valId);
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valEl.textContent = v;
      callback(v);
    });
  }
}
