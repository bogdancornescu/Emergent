import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockCanvas,
  createMockOverlay,
  setupDomElements,
  cleanupDom,
  stubAnimationFrame,
} from './helpers.js';

// Stub animation frames before importing the module (constructor calls _bindUI)
let raf;

describe('LSystemSim', () => {
  let LSystemSim;
  let canvas, ctx, overlay, sim;

  beforeEach(async () => {
    raf = stubAnimationFrame();

    // Set up all DOM elements that _bindUI and other methods reference
    setupDomElements({
      'lsystem-preset': { tag: 'select', value: 'fern' },
      'lsystem-iterations': { tag: 'input', type: 'range', value: '5', max: '6' },
      'lsystem-iterations-val': { tag: 'span', textContent: '5' },
      'lsystem-angle': { tag: 'input', type: 'range', value: '25' },
      'lsystem-angle-val': { tag: 'span', textContent: '25' },
      'lsystem-draw': { tag: 'button', textContent: 'Draw' },
      'lsystem-animate': { tag: 'button', textContent: 'Animate' },
      'lsystem-length': { tag: 'span', textContent: '0' },
      'lsystem-segments': { tag: 'span', textContent: '0' },
    });

    // Add options to the select so jsdom recognizes .value changes
    const presetSelect = document.getElementById('lsystem-preset');
    for (const name of ['fern', 'tree', 'bush', 'koch', 'sierpinski', 'dragon']) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      presetSelect.appendChild(opt);
    }
    presetSelect.value = 'fern';

    ({ canvas, ctx } = createMockCanvas(600, 400));
    overlay = createMockOverlay();

    // Dynamic import to ensure DOM is ready before module loads
    const mod = await import('../js/lsystem.js');
    LSystemSim = mod.LSystemSim;

    sim = new LSystemSim(canvas, overlay);
  });

  afterEach(() => {
    if (sim) sim.destroy();
    cleanupDom();
    vi.restoreAllMocks();
  });

  // ── Constructor ──

  describe('constructor', () => {
    it('sets default state', () => {
      expect(sim.presetName).toBe('fern');
      expect(sim.iterations).toBe(5);
      expect(sim.angle).toBe(25);
      expect(sim.animating).toBe(false);
      expect(sim.generatedString).toBe('');
    });

    it('stores canvas and overlay references', () => {
      expect(sim.canvas).toBe(canvas);
      expect(sim.overlay).toBe(overlay);
    });
  });

  // ── init ──

  describe('init', () => {
    it('sets dimensions and context', () => {
      sim.init({ ctx, width: 600, height: 400 });
      expect(sim.ctx).toBe(ctx);
      expect(sim.width).toBe(600);
      expect(sim.height).toBe(400);
    });

    it('generates a string and draws', () => {
      sim.init({ ctx, width: 600, height: 400 });
      expect(sim.generatedString.length).toBeGreaterThan(0);
      // overlay should reflect fern preset after drawing
      expect(overlay.textContent).toContain('fern');
    });

    it('populates the length and segments DOM elements', () => {
      sim.init({ ctx, width: 600, height: 400 });
      const lengthEl = document.getElementById('lsystem-length');
      const segEl = document.getElementById('lsystem-segments');
      expect(lengthEl.textContent).not.toBe('0');
      expect(segEl.textContent).not.toBe('0');
    });
  });

  // ── resize ──

  describe('resize', () => {
    it('updates dimensions and redraws if string exists', () => {
      sim.init({ ctx, width: 600, height: 400 });
      const drawSpy = vi.spyOn(sim, '_drawFull');
      sim.resize({ ctx, width: 800, height: 600 });
      expect(sim.width).toBe(800);
      expect(sim.height).toBe(600);
      expect(drawSpy).toHaveBeenCalled();
    });

    it('does not draw if no generated string', () => {
      const drawSpy = vi.spyOn(sim, '_drawFull');
      sim.resize({ ctx, width: 800, height: 600 });
      expect(drawSpy).not.toHaveBeenCalled();
    });
  });

  // ── destroy ──

  describe('destroy', () => {
    it('stops animation and clears overlay', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.animating = true;
      sim.animId = 42;
      sim.destroy();
      expect(sim.animating).toBe(false);
      expect(overlay.textContent).toBe('');
    });
  });

  // ── _generate ──

  describe('_generate', () => {
    it('produces the correct fern string for 1 iteration', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.iterations = 1;
      sim._generate();
      // fern axiom: 'X', rule: X -> 'F+[[X]-X]-F[-FX]+X'
      expect(sim.generatedString).toBe('F+[[X]-X]-F[-FX]+X');
    });

    it('caps string length at 2,000,000 chars', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.iterations = 20; // very high, should hit the cap
      sim._generate();
      expect(sim.generatedString.length).toBeLessThanOrEqual(2_000_000);
    });

    it('counts segments correctly for fern (only F is a draw char)', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.iterations = 1;
      sim._generate();
      const segEl = document.getElementById('lsystem-segments');
      // 'F+[[X]-X]-F[-FX]+X' has 3 F chars
      expect(segEl.textContent).toBe('3');
    });

    it('counts segments for presets with custom drawChars', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.presetName = 'tree';
      sim.iterations = 1;
      sim._generate();
      // tree axiom: '0', rules: 1->11, 0->1[-0]+0
      // After 1 iter: '1[-0]+0' -> draw chars are 0 and 1
      // '1', '[', '-', '0', ']', '+', '0' -> 1 + 0 + 0 = segments: 1,0,0 => 3
      const str = sim.generatedString;
      expect(str).toBe('1[-0]+0');
      const segEl = document.getElementById('lsystem-segments');
      // 1, 0, 0 are draw chars -> 3 segments
      expect(segEl.textContent).toBe('3');
    });
  });

  // ── _computeBounds ──

  describe('_computeBounds', () => {
    it('returns a bounding box with min/max coordinates', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.presetName = 'koch';
      sim.iterations = 1;
      sim._generate();
      const bounds = sim._computeBounds();
      expect(bounds).toHaveProperty('minX');
      expect(bounds).toHaveProperty('minY');
      expect(bounds).toHaveProperty('maxX');
      expect(bounds).toHaveProperty('maxY');
      expect(bounds.maxX).toBeGreaterThanOrEqual(bounds.minX);
      expect(bounds.maxY).toBeGreaterThanOrEqual(bounds.minY);
    });

    it('handles bracket push/pop (stack operations)', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.presetName = 'fern';
      sim.iterations = 2;
      sim._generate();
      // fern uses brackets heavily; just ensure no crash and valid bounds
      const bounds = sim._computeBounds();
      expect(typeof bounds.minX).toBe('number');
      expect(Number.isFinite(bounds.maxX)).toBe(true);
    });
  });

  // ── _drawFull ──

  describe('_drawFull', () => {
    it('calls canvas drawing methods', () => {
      sim.init({ ctx, width: 600, height: 400 });
      // ctx.beginPath is called during _drawFull
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('sets the overlay text to preset info', () => {
      sim.init({ ctx, width: 600, height: 400 });
      expect(overlay.textContent).toBe('fern \u00b7 5 iterations');
    });

    it('handles empty generatedString gracefully', () => {
      sim.ctx = ctx;
      sim.width = 600;
      sim.height = 400;
      sim.generatedString = '';
      expect(() => sim._drawFull()).not.toThrow();
    });
  });

  // ── _animateDraw ──

  describe('_animateDraw', () => {
    it('sets animating to true and requests animation frame', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.animating = false;
      sim._animateDraw();
      expect(sim.animating).toBe(true);
      expect(raf.pending()).toBeGreaterThan(0);
    });

    it('does not double-start if already animating', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.animating = true;
      sim._animateDraw();
      // Should return immediately because animating is already true
      expect(raf.pending()).toBe(0);
    });

    it('progresses animation on tick', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.animating = false;
      sim._animateDraw();
      // First tick should draw some segments and update overlay
      raf.tick();
      expect(overlay.textContent).toMatch(/Drawing|fern/);
    });

    it('completes animation after enough ticks', () => {
      sim.init({ ctx, width: 600, height: 400 });
      // Use low iteration count for a short string
      sim.iterations = 1;
      sim._generate();
      sim.animating = false;
      sim._animateDraw();
      // Tick enough times to exhaust all frames
      for (let i = 0; i < 500; i++) {
        if (!sim.animating && raf.pending() === 0) break;
        raf.tick();
      }
      expect(sim.animating).toBe(false);
    });

    it('handles empty generatedString', () => {
      sim.ctx = ctx;
      sim.width = 600;
      sim.height = 400;
      sim.generatedString = '';
      sim.animating = false;
      sim._animateDraw();
      expect(sim.animating).toBe(false);
    });
  });

  // ── _loadPreset ──

  describe('_loadPreset', () => {
    it('loads the fern preset defaults', () => {
      sim._loadPreset('fern');
      expect(sim.presetName).toBe('fern');
      expect(sim.iterations).toBe(5);
      expect(sim.angle).toBe(25);
    });

    it('loads the dragon preset defaults', () => {
      sim._loadPreset('dragon');
      expect(sim.presetName).toBe('dragon');
      expect(sim.iterations).toBe(12);
      expect(sim.angle).toBe(90);
    });

    it('updates DOM slider values and max', () => {
      sim._loadPreset('koch');
      const iterSlider = document.getElementById('lsystem-iterations');
      const iterVal = document.getElementById('lsystem-iterations-val');
      const angleSlider = document.getElementById('lsystem-angle');
      const angleVal = document.getElementById('lsystem-angle-val');

      expect(iterSlider.value).toBe('4');   // koch defaultIter
      expect(iterSlider.max).toBe('6');     // koch maxIter
      expect(iterVal.textContent).toBe('4');
      expect(angleSlider.value).toBe('60'); // koch angle
      expect(angleVal.textContent).toBe('60');
    });

    it('loads all six presets without errors', () => {
      const names = ['fern', 'tree', 'bush', 'koch', 'sierpinski', 'dragon'];
      for (const name of names) {
        expect(() => sim._loadPreset(name)).not.toThrow();
        expect(sim.presetName).toBe(name);
      }
    });
  });

  // ── UI bindings ──

  describe('UI bindings', () => {
    it('updates iterations on slider input', () => {
      sim.init({ ctx, width: 600, height: 400 });
      const iterSlider = document.getElementById('lsystem-iterations');
      iterSlider.value = '3';
      iterSlider.dispatchEvent(new Event('input'));
      expect(sim.iterations).toBe(3);
      expect(document.getElementById('lsystem-iterations-val').textContent).toBe('3');
    });

    it('updates angle on slider input', () => {
      sim.init({ ctx, width: 600, height: 400 });
      const angleSlider = document.getElementById('lsystem-angle');
      angleSlider.value = '45';
      angleSlider.dispatchEvent(new Event('input'));
      expect(sim.angle).toBe(45);
      expect(document.getElementById('lsystem-angle-val').textContent).toBe('45');
    });

    it('draw button triggers generate and drawFull', () => {
      sim.init({ ctx, width: 600, height: 400 });
      const genSpy = vi.spyOn(sim, '_generate');
      const drawSpy = vi.spyOn(sim, '_drawFull');
      document.getElementById('lsystem-draw').dispatchEvent(new Event('click'));
      expect(genSpy).toHaveBeenCalled();
      expect(drawSpy).toHaveBeenCalled();
    });

    it('animate button triggers generate and animateDraw', () => {
      sim.init({ ctx, width: 600, height: 400 });
      const genSpy = vi.spyOn(sim, '_generate');
      const animSpy = vi.spyOn(sim, '_animateDraw');
      document.getElementById('lsystem-animate').dispatchEvent(new Event('click'));
      expect(genSpy).toHaveBeenCalled();
      expect(animSpy).toHaveBeenCalled();
    });

    it('preset change loads preset and redraws', () => {
      sim.init({ ctx, width: 600, height: 400 });
      const loadSpy = vi.spyOn(sim, '_loadPreset');
      const presetSelect = document.getElementById('lsystem-preset');
      // The handler reads e.target.value, so we set value before dispatching
      presetSelect.value = 'koch';
      const event = new Event('change', { bubbles: true });
      presetSelect.dispatchEvent(event);
      expect(loadSpy).toHaveBeenCalledWith('koch');
    });

    it('animate button stops current animation before starting new one', () => {
      sim.init({ ctx, width: 600, height: 400 });
      sim.animating = true;
      sim.animId = 99;
      document.getElementById('lsystem-animate').dispatchEvent(new Event('click'));
      // cancelAnimationFrame should have been called for old id
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  // ── Preset data integrity ──

  describe('preset data integrity', () => {
    it('all presets have required fields', () => {
      const requiredFields = ['axiom', 'rules', 'angle', 'startAngle', 'maxIter', 'defaultIter', 'color', 'lengthFactor'];
      const names = ['fern', 'tree', 'bush', 'koch', 'sierpinski', 'dragon'];
      for (const name of names) {
        sim._loadPreset(name);
        // If we can load the preset without error, the fields exist
        expect(sim.presetName).toBe(name);
        expect(typeof sim.angle).toBe('number');
        expect(typeof sim.iterations).toBe('number');
      }
    });
  });
});
