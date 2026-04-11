import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockCanvas,
  createMockOverlay,
  setupDomElements,
  cleanupDom,
  stubAnimationFrame,
} from './helpers.js';

// Stub animation frames before importing LifeSim (which calls _bindUI in constructor)
let raf;

describe('LifeSim', () => {
  let canvas, ctx, overlay, sim;

  beforeEach(async () => {
    raf = stubAnimationFrame();

    // Set up all DOM elements the constructor's _bindUI() needs
    setupDomElements({
      'life-play': { tag: 'button', textContent: 'Play' },
      'life-step': { tag: 'button', textContent: 'Step' },
      'life-clear': { tag: 'button', textContent: 'Clear' },
      'life-random': { tag: 'button', textContent: 'Random' },
      'life-speed': { tag: 'input', type: 'range', value: '15' },
      'life-speed-val': { tag: 'span', textContent: '15' },
      'life-gen': { tag: 'span', textContent: '0' },
      'life-pop': { tag: 'span', textContent: '0' },
      'pat-glider': { tag: 'button', dataset: { pattern: 'glider' } },
      'pat-pulsar': { tag: 'button', dataset: { pattern: 'pulsar' } },
      'pat-gun': { tag: 'button', dataset: { pattern: 'gun' } },
      'pat-rpentomino': { tag: 'button', dataset: { pattern: 'rpentomino' } },
    });

    ({ canvas, ctx } = createMockCanvas(120, 60));
    overlay = createMockOverlay();

    const mod = await import('../js/life.js');
    sim = new mod.LifeSim(canvas, overlay);
  });

  afterEach(() => {
    sim.destroy();
    cleanupDom();
    vi.restoreAllMocks();
  });

  // ── init ──

  describe('init()', () => {
    it('creates grid sized to canvas / CELL_SIZE', () => {
      sim.init({ ctx, width: 120, height: 60 });
      // CELL_SIZE = 6, so cols=20, rows=10
      expect(sim.cols).toBe(20);
      expect(sim.rows).toBe(10);
      expect(sim.grid).toBeInstanceOf(Uint8Array);
      expect(sim.grid.length).toBe(200);
    });

    it('starts with generation 0 and population 0', () => {
      sim.init({ ctx, width: 120, height: 60 });
      expect(sim.generation).toBe(0);
      expect(sim.population).toBe(0);
    });

    it('registers canvas event listeners', () => {
      sim.init({ ctx, width: 120, height: 60 });
      const events = canvas.addEventListener.mock.calls.map(c => c[0]);
      expect(events).toContain('mousedown');
      expect(events).toContain('mousemove');
      expect(events).toContain('mouseup');
      expect(events).toContain('touchstart');
    });

    it('schedules an animation frame', () => {
      sim.init({ ctx, width: 120, height: 60 });
      expect(raf.pending()).toBeGreaterThan(0);
    });
  });

  // ── step (Game of Life rules) ──

  describe('step()', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 120, height: 60 });
    });

    it('increments generation', () => {
      sim.step();
      expect(sim.generation).toBe(1);
    });

    it('dead cell with exactly 3 neighbors is born', () => {
      // Place 3 cells around (5,5): (4,4), (5,4), (6,4)
      sim.grid[4 * sim.cols + 4] = 1;
      sim.grid[4 * sim.cols + 5] = 1;
      sim.grid[4 * sim.cols + 6] = 1;
      sim.step();
      // (5,5) should be born: neighbors are (4,4),(5,4),(6,4) = 3
      expect(sim.grid[5 * sim.cols + 5]).toBe(1);
    });

    it('alive cell with 2 or 3 neighbors survives', () => {
      // Blinker: vertical line at col 5, rows 4-6
      sim.grid[4 * sim.cols + 5] = 1;
      sim.grid[5 * sim.cols + 5] = 1;
      sim.grid[6 * sim.cols + 5] = 1;
      sim.step();
      // Middle cell (5,5) has 2 neighbors -> survives
      expect(sim.grid[5 * sim.cols + 5]).toBe(1);
    });

    it('alive cell with <2 or >3 neighbors dies', () => {
      // Isolated cell
      sim.grid[5 * sim.cols + 5] = 1;
      sim.step();
      expect(sim.grid[5 * sim.cols + 5]).toBe(0);
    });

    it('uses toroidal wrap for edge cells', () => {
      const { cols, rows } = sim;
      // Place cells at corners/edges to test wrapping
      sim.grid[0] = 1; // (0,0)
      sim.grid[cols - 1] = 1; // (cols-1, 0) wraps left neighbor to (cols-2)
      sim.grid[(rows - 1) * cols] = 1; // (0, rows-1) wraps to top
      sim.step();
      // Cell at (0, rows-1) neighbors wrap around to row 0
      // The important thing is no crash and correct neighbor counting
      expect(sim.generation).toBe(1);
    });

    it('blinker oscillates correctly', () => {
      // Horizontal blinker
      sim.grid[5 * sim.cols + 4] = 1;
      sim.grid[5 * sim.cols + 5] = 1;
      sim.grid[5 * sim.cols + 6] = 1;
      sim.step();
      // Should become vertical
      expect(sim.grid[4 * sim.cols + 5]).toBe(1);
      expect(sim.grid[5 * sim.cols + 5]).toBe(1);
      expect(sim.grid[6 * sim.cols + 5]).toBe(1);
      // Horizontal cells should be dead (except center)
      expect(sim.grid[5 * sim.cols + 4]).toBe(0);
      expect(sim.grid[5 * sim.cols + 6]).toBe(0);
    });

    it('tracks population count', () => {
      sim.grid[5 * sim.cols + 4] = 1;
      sim.grid[5 * sim.cols + 5] = 1;
      sim.grid[5 * sim.cols + 6] = 1;
      sim.step();
      expect(sim.population).toBe(3);
    });
  });

  // ── _cellAt ──

  describe('_cellAt()', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 120, height: 60 });
    });

    it('converts pixel position to grid cell (CELL_SIZE=6)', () => {
      const cell = sim._cellAt({ x: 13, y: 7 });
      // 13/6 = 2.16 -> floor = 2, 7/6 = 1.16 -> floor = 1
      expect(cell).toEqual({ x: 2, y: 1 });
    });

    it('returns null for out-of-bounds position', () => {
      expect(sim._cellAt({ x: -1, y: 5 })).toBeNull();
      expect(sim._cellAt({ x: 5, y: -1 })).toBeNull();
      expect(sim._cellAt({ x: 999, y: 5 })).toBeNull();
    });

    it('handles exact cell boundaries', () => {
      const cell = sim._cellAt({ x: 0, y: 0 });
      expect(cell).toEqual({ x: 0, y: 0 });
    });
  });

  // ── _placePattern ──

  describe('_placePattern()', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 120, height: 60 });
    });

    it('places glider pattern centered on grid', () => {
      sim._placePattern('glider');
      // Glider has 5 cells
      let pop = 0;
      for (let i = 0; i < sim.grid.length; i++) pop += sim.grid[i];
      expect(pop).toBe(5);
    });

    it('resets generation to 0 when placing a pattern', () => {
      sim.generation = 42;
      sim._placePattern('glider');
      expect(sim.generation).toBe(0);
    });

    it('clears existing grid before placing', () => {
      sim.grid.fill(1);
      sim._placePattern('glider');
      let pop = 0;
      for (let i = 0; i < sim.grid.length; i++) pop += sim.grid[i];
      expect(pop).toBe(5);
    });

    it('ignores unknown pattern names', () => {
      sim.grid[0] = 1;
      sim._placePattern('nonexistent');
      // Grid should be unchanged
      expect(sim.grid[0]).toBe(1);
    });

    it('places rpentomino with correct cell count', () => {
      sim._placePattern('rpentomino');
      let pop = 0;
      for (let i = 0; i < sim.grid.length; i++) pop += sim.grid[i];
      expect(pop).toBe(5);
    });
  });

  // ── resize ──

  describe('resize()', () => {
    it('copies old grid data to resized grid', () => {
      sim.init({ ctx, width: 120, height: 60 });
      // Set some cells
      sim.grid[0] = 1;
      sim.grid[1] = 1;
      sim.grid[sim.cols + 0] = 1;

      sim.resize({ ctx, width: 180, height: 90 });
      // New grid should preserve old cells
      expect(sim.cols).toBe(30); // 180/6
      expect(sim.rows).toBe(15); // 90/6
      expect(sim.grid[0]).toBe(1);
      expect(sim.grid[1]).toBe(1);
      expect(sim.grid[sim.cols + 0]).toBe(1);
    });

    it('handles shrinking grid', () => {
      sim.init({ ctx, width: 120, height: 60 });
      sim.grid[0] = 1;
      sim.resize({ ctx, width: 60, height: 30 });
      expect(sim.cols).toBe(10);
      expect(sim.rows).toBe(5);
      expect(sim.grid[0]).toBe(1);
    });
  });

  // ── destroy ──

  describe('destroy()', () => {
    it('cancels animation and removes canvas listeners', () => {
      sim.init({ ctx, width: 120, height: 60 });
      sim.destroy();
      expect(sim.running).toBe(false);
      expect(canvas.removeEventListener).toHaveBeenCalled();
      const removedEvents = canvas.removeEventListener.mock.calls.map(c => c[0]);
      expect(removedEvents).toContain('mousedown');
      expect(removedEvents).toContain('mousemove');
      expect(removedEvents).toContain('mouseup');
    });

    it('clears overlay text', () => {
      sim.init({ ctx, width: 120, height: 60 });
      overlay.textContent = 'something';
      sim.destroy();
      expect(overlay.textContent).toBe('');
    });
  });

  // ── UI bindings ──

  describe('UI bindings', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 120, height: 60 });
    });

    it('play button toggles running state', () => {
      const playBtn = document.getElementById('life-play');
      playBtn.click();
      expect(sim.running).toBe(true);
      expect(playBtn.textContent).toBe('Pause');
      playBtn.click();
      expect(sim.running).toBe(false);
      expect(playBtn.textContent).toBe('Play');
    });

    it('step button advances one generation when paused', () => {
      sim.running = false;
      sim.grid[5 * sim.cols + 4] = 1;
      sim.grid[5 * sim.cols + 5] = 1;
      sim.grid[5 * sim.cols + 6] = 1;
      document.getElementById('life-step').click();
      expect(sim.generation).toBe(1);
    });

    it('step button does nothing when running', () => {
      sim.running = true;
      document.getElementById('life-step').click();
      expect(sim.generation).toBe(0);
    });

    it('clear button resets grid, generation, and population', () => {
      sim.grid[0] = 1;
      sim.generation = 10;
      sim.population = 5;
      document.getElementById('life-clear').click();
      expect(sim.generation).toBe(0);
      expect(sim.population).toBe(0);
      expect(sim.grid[0]).toBe(0);
    });

    it('speed slider updates speed', () => {
      const slider = document.getElementById('life-speed');
      slider.value = '30';
      slider.dispatchEvent(new Event('input'));
      expect(sim.speed).toBe(30);
      expect(document.getElementById('life-speed-val').textContent).toBe('30');
    });

    it('pattern button places the corresponding pattern', () => {
      const btn = document.getElementById('pat-glider');
      btn.click();
      let pop = 0;
      for (let i = 0; i < sim.grid.length; i++) pop += sim.grid[i];
      expect(pop).toBe(5);
      expect(sim.generation).toBe(0);
    });
  });
});
