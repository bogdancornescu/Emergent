// ── L-System Fractal Renderer ──

import { clearCanvas } from './utils.js';

const PRESETS = {
  fern: {
    axiom: 'X',
    rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' },
    angle: 25,
    startAngle: -80,
    maxIter: 6,
    defaultIter: 5,
    color: { h: 130, s: 60, l: 50 },
    lengthFactor: 0.5,
  },
  tree: {
    axiom: '0',
    rules: { '1': '11', '0': '1[-0]+0' },
    angle: 45,
    startAngle: -90,
    maxIter: 8,
    defaultIter: 7,
    color: { h: 30, s: 50, l: 45 },
    lengthFactor: 0.5,
    drawChars: { '0': true, '1': true },
  },
  bush: {
    axiom: 'F',
    rules: { F: 'FF+[+F-F-F]-[-F+F+F]' },
    angle: 22,
    startAngle: -90,
    maxIter: 5,
    defaultIter: 4,
    color: { h: 100, s: 55, l: 40 },
    lengthFactor: 0.4,
  },
  koch: {
    axiom: 'F--F--F',
    rules: { F: 'F+F--F+F' },
    angle: 60,
    startAngle: 0,
    maxIter: 6,
    defaultIter: 4,
    color: { h: 200, s: 80, l: 60 },
    lengthFactor: 0.35,
  },
  sierpinski: {
    axiom: 'F-G-G',
    rules: { F: 'F-G+F+G-F', G: 'GG' },
    angle: 120,
    startAngle: 0,
    maxIter: 7,
    defaultIter: 6,
    color: { h: 280, s: 60, l: 60 },
    lengthFactor: 0.5,
    drawChars: { F: true, G: true },
  },
  dragon: {
    axiom: 'FX',
    rules: { X: 'X+YF+', Y: '-FX-Y' },
    angle: 90,
    startAngle: 0,
    maxIter: 15,
    defaultIter: 12,
    color: { h: 350, s: 70, l: 55 },
    lengthFactor: 0.7,
  },
};

export class LSystemSim {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.presetName = 'fern';
    this.iterations = 5;
    this.angle = 25;
    this.generatedString = '';
    this.animating = false;
    this.animId = null;

    this._bindUI();
  }

  init({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this._loadPreset('fern');
    this._generate();
    this._drawFull();
  }

  resize({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    if (this.generatedString) this._drawFull();
  }

  destroy() {
    this.animating = false;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.overlay.textContent = '';
  }

  // ── Generate L-System string ──

  _generate() {
    const preset = PRESETS[this.presetName];
    let current = preset.axiom;

    for (let i = 0; i < this.iterations; i++) {
      let next = '';
      for (const ch of current) {
        next += preset.rules[ch] !== undefined ? preset.rules[ch] : ch;
      }
      current = next;
      // Safety: don't generate astronomically long strings
      if (current.length > 2_000_000) {
        current = current.substring(0, 2_000_000);
        break;
      }
    }

    this.generatedString = current;
    document.getElementById('lsystem-length').textContent = current.length.toLocaleString();

    // Count segments
    const drawChars = preset.drawChars || { F: true };
    let segments = 0;
    for (const ch of current) {
      if (drawChars[ch]) segments++;
    }
    document.getElementById('lsystem-segments').textContent = segments.toLocaleString();
  }

  // ── Compute bounds (dry run) ──

  _computeBounds() {
    const preset = PRESETS[this.presetName];
    const angleRad = (this.angle * Math.PI) / 180;
    const startAngleRad = (preset.startAngle * Math.PI) / 180;
    const drawChars = preset.drawChars || { F: true };

    let x = 0, y = 0, dir = startAngleRad;
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    const stack = [];

    for (const ch of this.generatedString) {
      if (drawChars[ch]) {
        x += Math.cos(dir);
        y += Math.sin(dir);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      } else if (ch === '+') {
        dir += angleRad;
      } else if (ch === '-') {
        dir -= angleRad;
      } else if (ch === '[') {
        stack.push({ x, y, dir });
      } else if (ch === ']') {
        const s = stack.pop();
        if (s) { x = s.x; y = s.y; dir = s.dir; }
      }
    }

    return { minX, minY, maxX, maxY };
  }

  // ── Draw full L-System ──

  _drawFull() {
    const { ctx, width, height, generatedString } = this;
    const preset = PRESETS[this.presetName];
    clearCanvas(ctx, width, height);

    if (!generatedString) return;

    const bounds = this._computeBounds();
    const bw = bounds.maxX - bounds.minX || 1;
    const bh = bounds.maxY - bounds.minY || 1;
    const margin = 40;
    const scale = Math.min((width - margin * 2) / bw, (height - margin * 2) / bh);

    const offsetX = (width - bw * scale) / 2 - bounds.minX * scale;
    const offsetY = (height - bh * scale) / 2 - bounds.minY * scale;

    const angleRad = (this.angle * Math.PI) / 180;
    const startAngleRad = (preset.startAngle * Math.PI) / 180;
    const drawChars = preset.drawChars || { F: true };
    const { h, s, l } = preset.color;

    let x = 0, y = 0, dir = startAngleRad;
    const stack = [];
    let segIdx = 0;
    const totalSegs = parseInt(document.getElementById('lsystem-segments').textContent.replace(/,/g, ''));

    ctx.lineWidth = Math.max(0.5, Math.min(2, 500 / (totalSegs || 1)));
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (const ch of generatedString) {
      if (drawChars[ch]) {
        const nx = x + Math.cos(dir);
        const ny = y + Math.sin(dir);

        const progress = segIdx / (totalSegs || 1);
        const hue = h + progress * 40;
        const lightness = l + progress * 15;

        ctx.strokeStyle = `hsl(${hue}, ${s}%, ${lightness}%)`;
        ctx.beginPath();
        ctx.moveTo(x * scale + offsetX, y * scale + offsetY);
        ctx.lineTo(nx * scale + offsetX, ny * scale + offsetY);
        ctx.stroke();

        x = nx;
        y = ny;
        segIdx++;
      } else if (ch === '+') {
        dir += angleRad;
      } else if (ch === '-') {
        dir -= angleRad;
      } else if (ch === '[') {
        stack.push({ x, y, dir });
      } else if (ch === ']') {
        const s2 = stack.pop();
        if (s2) { x = s2.x; y = s2.y; dir = s2.dir; }
      }
    }

    this.overlay.textContent = `${this.presetName} · ${this.iterations} iterations`;
  }

  // ── Animate drawing ──

  _animateDraw() {
    if (this.animating) return;
    this.animating = true;

    const { ctx, width, height, generatedString } = this;
    const preset = PRESETS[this.presetName];
    clearCanvas(ctx, width, height);

    if (!generatedString) { this.animating = false; return; }

    const bounds = this._computeBounds();
    const bw = bounds.maxX - bounds.minX || 1;
    const bh = bounds.maxY - bounds.minY || 1;
    const margin = 40;
    const scale = Math.min((width - margin * 2) / bw, (height - margin * 2) / bh);
    const offsetX = (width - bw * scale) / 2 - bounds.minX * scale;
    const offsetY = (height - bh * scale) / 2 - bounds.minY * scale;

    const angleRad = (this.angle * Math.PI) / 180;
    const startAngleRad = (preset.startAngle * Math.PI) / 180;
    const drawChars = preset.drawChars || { F: true };
    const { h, s, l } = preset.color;

    const totalSegs = parseInt(document.getElementById('lsystem-segments').textContent.replace(/,/g, ''));
    ctx.lineWidth = Math.max(0.5, Math.min(2, 500 / (totalSegs || 1)));
    ctx.lineCap = 'round';

    // Pre-compute all segments
    const segments = [];
    let x = 0, y = 0, dir = startAngleRad;
    const stack = [];
    let segIdx = 0;

    for (const ch of generatedString) {
      if (drawChars[ch]) {
        const nx = x + Math.cos(dir);
        const ny = y + Math.sin(dir);
        const progress = segIdx / (totalSegs || 1);
        segments.push({
          x1: x * scale + offsetX, y1: y * scale + offsetY,
          x2: nx * scale + offsetX, y2: ny * scale + offsetY,
          hue: h + progress * 40,
          lightness: l + progress * 15,
        });
        x = nx; y = ny;
        segIdx++;
      } else if (ch === '+') {
        dir += angleRad;
      } else if (ch === '-') {
        dir -= angleRad;
      } else if (ch === '[') {
        stack.push({ x, y, dir });
      } else if (ch === ']') {
        const s2 = stack.pop();
        if (s2) { x = s2.x; y = s2.y; dir = s2.dir; }
      }
    }

    // Animate
    let drawn = 0;
    const segsPerFrame = Math.max(1, Math.ceil(segments.length / 300)); // ~5 seconds at 60fps

    const frame = () => {
      if (!this.animating) return;

      const end = Math.min(drawn + segsPerFrame, segments.length);
      for (let i = drawn; i < end; i++) {
        const seg = segments[i];
        ctx.strokeStyle = `hsl(${seg.hue}, ${s}%, ${seg.lightness}%)`;
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }
      drawn = end;

      this.overlay.textContent = `Drawing... ${Math.round((drawn / segments.length) * 100)}%`;

      if (drawn < segments.length) {
        this.animId = requestAnimationFrame(frame);
      } else {
        this.animating = false;
        this.overlay.textContent = `${this.presetName} · ${this.iterations} iterations`;
      }
    };

    this.animId = requestAnimationFrame(frame);
  }

  // ── Preset loading ──

  _loadPreset(name) {
    this.presetName = name;
    const preset = PRESETS[name];
    this.iterations = preset.defaultIter;
    this.angle = preset.angle;

    document.getElementById('lsystem-iterations').value = this.iterations;
    document.getElementById('lsystem-iterations').max = preset.maxIter;
    document.getElementById('lsystem-iterations-val').textContent = this.iterations;
    document.getElementById('lsystem-angle').value = this.angle;
    document.getElementById('lsystem-angle-val').textContent = this.angle;
  }

  // ── UI ──

  _bindUI() {
    document.getElementById('lsystem-preset').addEventListener('change', (e) => {
      this.animating = false;
      this._loadPreset(e.target.value);
      this._generate();
      this._drawFull();
    });

    const iterSlider = document.getElementById('lsystem-iterations');
    const iterVal = document.getElementById('lsystem-iterations-val');
    iterSlider.addEventListener('input', () => {
      this.iterations = parseInt(iterSlider.value);
      iterVal.textContent = this.iterations;
    });

    const angleSlider = document.getElementById('lsystem-angle');
    const angleVal = document.getElementById('lsystem-angle-val');
    angleSlider.addEventListener('input', () => {
      this.angle = parseInt(angleSlider.value);
      angleVal.textContent = this.angle;
    });

    document.getElementById('lsystem-draw').addEventListener('click', () => {
      this.animating = false;
      this._generate();
      this._drawFull();
    });

    document.getElementById('lsystem-animate').addEventListener('click', () => {
      this.animating = false;
      if (this.animId) cancelAnimationFrame(this.animId);
      this._generate();
      this._animateDraw();
    });
  }
}
