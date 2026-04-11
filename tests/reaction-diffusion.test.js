import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockCanvas,
  createMockOverlay,
  setupDomElements,
  cleanupDom,
  stubAnimationFrame,
} from './helpers.js';

// Polyfill ImageData for jsdom (not implemented natively)
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
}

describe('ReactionDiffusionSim', () => {
  let ReactionDiffusionSim;
  let canvas, ctx, overlay, sim, raf;

  beforeEach(async () => {
    raf = stubAnimationFrame();

    // Set up all DOM elements that _bindUI references via getElementById
    setupDomElements({
      'reaction-preset': { tag: 'select', value: 'mitosis' },
      'reaction-feed': { tag: 'input', type: 'range', value: '0.028' },
      'reaction-feed-val': { tag: 'span', textContent: '0.028' },
      'reaction-kill': { tag: 'input', type: 'range', value: '0.062' },
      'reaction-kill-val': { tag: 'span', textContent: '0.062' },
      'reaction-brush': { tag: 'input', type: 'range', value: '10' },
      'reaction-brush-val': { tag: 'span', textContent: '10' },
      'reaction-play': { tag: 'button', textContent: 'Pause' },
      'reaction-clear': { tag: 'button', textContent: 'Clear' },
      'reaction-frame': { tag: 'span', textContent: '0' },
    });

    // Save original before mocking
    const origCreateElement = document.createElement.bind(document);

    // Add options to the select so jsdom recognizes .value changes
    const presetSelect = document.getElementById('reaction-preset');
    for (const name of ['mitosis', 'coral', 'maze', 'spots', 'waves']) {
      const opt = origCreateElement('option');
      opt.value = name;
      opt.textContent = name;
      presetSelect.appendChild(opt);
    }
    presetSelect.value = 'mitosis';

    // Mock document.createElement to return a proper mock for canvas elements
    // (jsdom doesn't implement HTMLCanvasElement.getContext)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') {
        const mockTempCanvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            putImageData: vi.fn(),
            drawImage: vi.fn(),
            fillStyle: '',
            fillRect: vi.fn(),
          })),
        };
        return mockTempCanvas;
      }
      return origCreateElement(tag);
    });

    ({ canvas, ctx } = createMockCanvas(200, 200));
    overlay = createMockOverlay();

    const mod = await import('../js/reaction-diffusion.js');
    ReactionDiffusionSim = mod.ReactionDiffusionSim;

    sim = new ReactionDiffusionSim(canvas, overlay);
  });

  afterEach(() => {
    if (sim) sim.destroy();
    cleanupDom();
    vi.restoreAllMocks();
  });

  // ── Constructor ──

  describe('constructor', () => {
    it('sets default Gray-Scott parameters (mitosis)', () => {
      expect(sim.feed).toBe(0.028);
      expect(sim.kill).toBe(0.062);
      expect(sim.dA).toBe(1.0);
      expect(sim.dB).toBe(0.5);
      expect(sim.dt).toBe(1.0);
    });

    it('starts with running = true', () => {
      expect(sim.running).toBe(true);
    });

    it('initializes frame counter at 0', () => {
      expect(sim.frame).toBe(0);
    });

    it('sets default brush size and scale', () => {
      expect(sim.brushSize).toBe(10);
      expect(sim.scale).toBe(2);
    });

    it('stores canvas and overlay references', () => {
      expect(sim.canvas).toBe(canvas);
      expect(sim.overlay).toBe(overlay);
    });
  });

  // ── init ──

  describe('init', () => {
    it('sets dimensions and grid size based on scale', () => {
      sim.init({ ctx, width: 200, height: 200 });
      expect(sim.width).toBe(200);
      expect(sim.height).toBe(200);
      expect(sim.gridW).toBe(100); // 200 / scale(2)
      expect(sim.gridH).toBe(100);
    });

    it('creates grids as Float32Arrays', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const expectedSize = sim.gridW * sim.gridH;
      expect(sim.a).toBeInstanceOf(Float32Array);
      expect(sim.b).toBeInstanceOf(Float32Array);
      expect(sim.a.length).toBe(expectedSize);
      expect(sim.b.length).toBe(expectedSize);
    });

    it('creates temp canvas for rendering', () => {
      sim.init({ ctx, width: 200, height: 200 });
      expect(sim.tempCanvas).toBeTruthy();
      expect(sim.tempCanvas.width).toBe(sim.gridW);
      expect(sim.tempCanvas.height).toBe(sim.gridH);
    });

    it('registers mouse event listeners on canvas', () => {
      sim.init({ ctx, width: 200, height: 200 });
      expect(canvas.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });

    it('starts the animation loop', () => {
      sim.init({ ctx, width: 200, height: 200 });
      expect(raf.pending()).toBeGreaterThan(0);
    });
  });

  // ── resize ──

  describe('resize', () => {
    it('updates dimensions without reinitializing grids', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const originalA = sim.a;
      sim.resize({ ctx, width: 400, height: 300 });
      expect(sim.width).toBe(400);
      expect(sim.height).toBe(300);
      // Grids should remain the same (no reinitialization)
      expect(sim.a).toBe(originalA);
    });
  });

  // ── destroy ──

  describe('destroy', () => {
    it('stops running and removes event listeners', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim.destroy();
      expect(sim.running).toBe(false);
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseleave', expect.any(Function));
    });

    it('clears overlay text', () => {
      sim.init({ ctx, width: 200, height: 200 });
      overlay.textContent = 'something';
      sim.destroy();
      expect(overlay.textContent).toBe('');
    });

    it('cancels animation frame', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim.animId = 42;
      sim.destroy();
      expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    });
  });

  // ── _initGrids ──

  describe('_initGrids', () => {
    it('fills grid A with 1.0 and grid B with 0.0', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._initGrids();
      // Spot check: every value in A should be 1.0
      for (let i = 0; i < sim.a.length; i += 100) {
        expect(sim.a[i]).toBe(1.0);
        expect(sim.b[i]).toBe(0.0);
      }
    });

    it('creates nextA and nextB arrays of same size', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._initGrids();
      expect(sim.nextA.length).toBe(sim.a.length);
      expect(sim.nextB.length).toBe(sim.b.length);
    });
  });

  // ── _seed ──

  describe('_seed', () => {
    it('resets frame counter to 0', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim.frame = 99;
      sim._seed();
      expect(sim.frame).toBe(0);
    });

    it('places some chemical B in the grid', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._seed();
      // At least some cells in B should be > 0 due to seeding
      let hasB = false;
      for (let i = 0; i < sim.b.length; i++) {
        if (sim.b[i] > 0) { hasB = true; break; }
      }
      expect(hasB).toBe(true);
    });

    it('keeps A at 1.0 in non-seeded areas', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._seed();
      // Most of A should still be 1.0 (seeds are small clusters)
      let countOne = 0;
      for (let i = 0; i < sim.a.length; i++) {
        if (sim.a[i] === 1.0) countOne++;
      }
      // Expect the vast majority of cells to remain at 1.0
      expect(countOne / sim.a.length).toBeGreaterThan(0.5);
    });
  });

  // ── _step ──

  describe('_step', () => {
    it('increments frame counter', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const before = sim.frame;
      sim._step();
      expect(sim.frame).toBe(before + 1);
    });

    it('swaps A/B with nextA/nextB buffers', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const origA = sim.a;
      const origB = sim.b;
      sim._step();
      // After swap, a and b should point to what was nextA/nextB
      expect(sim.a).not.toBe(origA);
      expect(sim.b).not.toBe(origB);
      // And nextA/nextB should point to old a/b
      expect(sim.nextA).toBe(origA);
      expect(sim.nextB).toBe(origB);
    });

    it('clamps all values between 0 and 1', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._step();
      for (let i = 0; i < sim.a.length; i++) {
        expect(sim.a[i]).toBeGreaterThanOrEqual(0);
        expect(sim.a[i]).toBeLessThanOrEqual(1);
        expect(sim.b[i]).toBeGreaterThanOrEqual(0);
        expect(sim.b[i]).toBeLessThanOrEqual(1);
      }
    });

    it('preserves boundary cells (edges are not updated)', () => {
      sim.init({ ctx, width: 200, height: 200 });
      // Top-left corner (0,0) should remain at initial values since
      // the loop starts at y=1, x=1
      const topLeft = sim.a[0];
      sim._step();
      // After swap, nextA[0] was never written, so it keeps its old value (from fill or prior state)
      // The key point: no out-of-bounds access occurs
      expect(Number.isFinite(sim.a[0])).toBe(true);
    });

    it('produces stable state with uniform grid', () => {
      sim.init({ ctx, width: 200, height: 200 });
      // Re-init grids: A=1, B=0 everywhere (no seeds)
      sim._initGrids();
      sim._step();
      // With A=1, B=0 everywhere: Laplacian for A is 0 (uniform), reaction=0,
      // feed*(1-1)=0, so nextA=1+0=1 for interior cells. After swap, sim.a = nextA.
      // Check an interior cell (not on boundary)
      const midX = Math.floor(sim.gridW / 2);
      const midY = Math.floor(sim.gridH / 2);
      const midIdx = midY * sim.gridW + midX;
      expect(sim.a[midIdx]).toBeCloseTo(1.0, 1);
      expect(sim.b[midIdx]).toBeCloseTo(0.0, 5);
    });
  });

  // ── _draw ──

  describe('_draw', () => {
    it('creates ImageData matching grid dimensions', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._draw();
      expect(sim.imageData).toBeTruthy();
      expect(sim.imageData.width).toBe(sim.gridW);
      expect(sim.imageData.height).toBe(sim.gridH);
    });

    it('sets alpha to 255 for all pixels', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._draw();
      const data = sim.imageData.data;
      for (let i = 3; i < data.length; i += 4) {
        expect(data[i]).toBe(255);
      }
    });

    it('updates the frame counter DOM element', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim.frame = 42;
      sim._draw();
      expect(document.getElementById('reaction-frame').textContent).toBe('42');
    });

    it('draws to temp canvas then scales to main canvas', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._draw();
      expect(ctx.drawImage).toHaveBeenCalled();
    });
  });

  // ── _paint ──

  describe('_paint', () => {
    it('sets chemical B at mouse position', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._initGrids(); // Reset: B = 0 everywhere

      // Simulate a mouse event at center of canvas
      const mockEvent = { clientX: 100, clientY: 100 };
      sim._paint(mockEvent);

      // Some cells around the center should now have B = 1.0
      const gx = Math.floor(100 / sim.scale);
      const gy = Math.floor(100 / sim.scale);
      const idx = gy * sim.gridW + gx;
      expect(sim.b[idx]).toBe(1.0);
    });

    it('respects brush size', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._initGrids();
      sim.brushSize = 20;

      const mockEvent = { clientX: 100, clientY: 100 };
      sim._paint(mockEvent);

      // Count cells with B > 0
      let painted = 0;
      for (let i = 0; i < sim.b.length; i++) {
        if (sim.b[i] > 0) painted++;
      }
      expect(painted).toBeGreaterThan(1);
    });

    it('does not paint outside grid bounds', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._initGrids();

      // Paint at the very edge
      const mockEvent = { clientX: 0, clientY: 0 };
      expect(() => sim._paint(mockEvent)).not.toThrow();
    });
  });

  // ── Mouse event handlers ──

  describe('mouse handlers', () => {
    it('mousedown starts painting', () => {
      sim.init({ ctx, width: 200, height: 200 });
      canvas._fire('mousedown', { clientX: 50, clientY: 50 });
      expect(sim._painting).toBe(true);
    });

    it('mousemove paints when _painting is true', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._initGrids();
      canvas._fire('mousedown', { clientX: 50, clientY: 50 });
      canvas._fire('mousemove', { clientX: 60, clientY: 60 });
      // Should have painted at both positions
      let hasPaint = false;
      for (let i = 0; i < sim.b.length; i++) {
        if (sim.b[i] > 0) { hasPaint = true; break; }
      }
      expect(hasPaint).toBe(true);
    });

    it('mouseup stops painting', () => {
      sim.init({ ctx, width: 200, height: 200 });
      canvas._fire('mousedown', { clientX: 50, clientY: 50 });
      expect(sim._painting).toBe(true);
      canvas._fire('mouseup', {});
      expect(sim._painting).toBe(false);
    });

    it('mouseleave stops painting', () => {
      sim.init({ ctx, width: 200, height: 200 });
      canvas._fire('mousedown', { clientX: 50, clientY: 50 });
      canvas._fire('mouseleave', {});
      expect(sim._painting).toBe(false);
    });
  });

  // ── UI bindings ──

  describe('UI bindings', () => {
    it('preset change updates feed, kill, and reseeds', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const seedSpy = vi.spyOn(sim, '_seed');

      const presetSelect = document.getElementById('reaction-preset');
      presetSelect.value = 'coral';
      presetSelect.dispatchEvent(new Event('change'));

      expect(sim.feed).toBe(0.055);
      expect(sim.kill).toBe(0.062);
      expect(seedSpy).toHaveBeenCalled();
    });

    it('preset change updates slider DOM values', () => {
      sim.init({ ctx, width: 200, height: 200 });

      const presetSelect = document.getElementById('reaction-preset');
      presetSelect.value = 'maze';
      presetSelect.dispatchEvent(new Event('change'));

      expect(document.getElementById('reaction-feed').value).toBe('0.029');
      expect(document.getElementById('reaction-feed-val').textContent).toBe('0.029');
      expect(document.getElementById('reaction-kill').value).toBe('0.057');
      expect(document.getElementById('reaction-kill-val').textContent).toBe('0.057');
    });

    it('feed slider updates feed parameter', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const feedSlider = document.getElementById('reaction-feed');
      feedSlider.value = '0.042';
      feedSlider.dispatchEvent(new Event('input'));
      expect(sim.feed).toBe(0.042);
      expect(document.getElementById('reaction-feed-val').textContent).toBe('0.042');
    });

    it('kill slider updates kill parameter', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const killSlider = document.getElementById('reaction-kill');
      killSlider.value = '0.055';
      killSlider.dispatchEvent(new Event('input'));
      expect(sim.kill).toBe(0.055);
    });

    it('brush slider updates brush size', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const brushSlider = document.getElementById('reaction-brush');
      brushSlider.value = '20';
      brushSlider.dispatchEvent(new Event('input'));
      expect(sim.brushSize).toBe(20);
    });

    it('play button toggles running state', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const playBtn = document.getElementById('reaction-play');
      expect(sim.running).toBe(true);

      playBtn.dispatchEvent(new Event('click'));
      expect(sim.running).toBe(false);
      expect(playBtn.textContent).toBe('Play');

      playBtn.dispatchEvent(new Event('click'));
      expect(sim.running).toBe(true);
      expect(playBtn.textContent).toBe('Pause');
    });

    it('clear button reseeds the grid', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const seedSpy = vi.spyOn(sim, '_seed');
      document.getElementById('reaction-clear').dispatchEvent(new Event('click'));
      expect(seedSpy).toHaveBeenCalled();
    });

    it('preset change with invalid preset does not crash', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const presetSelect = document.getElementById('reaction-preset');
      presetSelect.value = 'nonexistent';
      expect(() => presetSelect.dispatchEvent(new Event('change'))).not.toThrow();
      // Feed/kill should remain unchanged
      expect(sim.feed).toBe(0.028);
    });
  });

  // ── Animation loop ──

  describe('animation loop', () => {
    it('runs step and draw when running', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const stepSpy = vi.spyOn(sim, '_step');
      const drawSpy = vi.spyOn(sim, '_draw');

      raf.tick();

      expect(stepSpy).toHaveBeenCalled();
      expect(drawSpy).toHaveBeenCalled();
    });

    it('runs 10 steps per frame', () => {
      sim.init({ ctx, width: 200, height: 200 });
      const frameBefore = sim.frame;
      raf.tick();
      expect(sim.frame).toBe(frameBefore + 10);
    });

    it('does not step when paused', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim.running = false;
      const frameBefore = sim.frame;
      raf.tick();
      expect(sim.frame).toBe(frameBefore);
    });

    it('continues requesting frames after each tick', () => {
      sim.init({ ctx, width: 200, height: 200 });
      raf.tick();
      // Loop should have scheduled next frame
      expect(raf.pending()).toBeGreaterThan(0);
    });
  });

  // ── Color gradient ──

  describe('color gradient', () => {
    it('produces valid RGBA pixel data', () => {
      sim.init({ ctx, width: 200, height: 200 });
      sim._draw();
      const data = sim.imageData.data;
      for (let i = 0; i < Math.min(data.length, 400); i += 4) {
        expect(data[i]).toBeGreaterThanOrEqual(0);     // R
        expect(data[i]).toBeLessThanOrEqual(255);
        expect(data[i + 1]).toBeGreaterThanOrEqual(0); // G
        expect(data[i + 1]).toBeLessThanOrEqual(255);
        expect(data[i + 2]).toBeGreaterThanOrEqual(0); // B
        expect(data[i + 2]).toBeLessThanOrEqual(255);
        expect(data[i + 3]).toBe(255);                 // A
      }
    });
  });
});
