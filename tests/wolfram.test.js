import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockCanvas,
  createMockOverlay,
  setupDomElements,
  cleanupDom,
  stubAnimationFrame,
} from './helpers.js';

describe('WolframSim', () => {
  let canvas, ctx, overlay, sim, raf;

  beforeEach(async () => {
    raf = stubAnimationFrame();

    setupDomElements({
      'wolfram-rule': { tag: 'input', type: 'range', value: '30', max: '255' },
      'wolfram-rule-val': { tag: 'span', textContent: '30' },
      'wolfram-preview': { tag: 'div' },
      'wolfram-single': { tag: 'button', textContent: 'Single' },
      'wolfram-random-init': { tag: 'button', textContent: 'Random' },
      'wolfram-reset': { tag: 'button', textContent: 'Reset' },
      'rule-30': { tag: 'button', dataset: { rule: '30' } },
      'rule-110': { tag: 'button', dataset: { rule: '110' } },
      'rule-90': { tag: 'button', dataset: { rule: '90' } },
    });

    ({ canvas, ctx } = createMockCanvas(300, 150));
    overlay = createMockOverlay();

    const mod = await import('../js/wolfram.js');
    sim = new mod.WolframSim(canvas, overlay);
  });

  afterEach(() => {
    sim.destroy();
    cleanupDom();
    vi.restoreAllMocks();
  });

  // ── init ──

  describe('init()', () => {
    it('calculates cols and maxRows from canvas size (CELL_SIZE=3)', () => {
      sim.init({ ctx, width: 300, height: 150 });
      expect(sim.cols).toBe(100); // 300/3
      expect(sim.maxRows).toBe(50); // 150/3
    });

    it('creates the first row', () => {
      sim.init({ ctx, width: 300, height: 150 });
      expect(sim.rows.length).toBe(1);
      expect(sim.rows[0]).toBeInstanceOf(Uint8Array);
      expect(sim.rows[0].length).toBe(100);
    });

    it('starts animation loop', () => {
      sim.init({ ctx, width: 300, height: 150 });
      expect(raf.pending()).toBeGreaterThan(0);
    });
  });

  // ── _buildRuleTable ──

  describe('_buildRuleTable()', () => {
    it('builds 8-entry table from rule number', () => {
      sim.rule = 30;
      sim._buildRuleTable();
      // Rule 30 = 00011110 in binary
      // Index: 0->0, 1->1, 2->1, 3->1, 4->1, 5->0, 6->0, 7->0
      expect(sim.ruleTable).toEqual([0, 1, 1, 1, 1, 0, 0, 0]);
    });

    it('builds correct table for rule 110', () => {
      sim.rule = 110;
      sim._buildRuleTable();
      // Rule 110 = 01101110
      expect(sim.ruleTable).toEqual([0, 1, 1, 1, 0, 1, 1, 0]);
    });

    it('builds correct table for rule 90', () => {
      sim.rule = 90;
      sim._buildRuleTable();
      // Rule 90 = 01011010
      expect(sim.ruleTable).toEqual([0, 1, 0, 1, 1, 0, 1, 0]);
    });

    it('rule 0 produces all-zero table', () => {
      sim.rule = 0;
      sim._buildRuleTable();
      expect(sim.ruleTable).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it('rule 255 produces all-one table', () => {
      sim.rule = 255;
      sim._buildRuleTable();
      expect(sim.ruleTable).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
    });
  });

  // ── _reset ──

  describe('_reset()', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 300, height: 150 });
    });

    it('in single mode, only center cell is alive', () => {
      sim.initMode = 'single';
      sim._reset();
      const row = sim.rows[0];
      const center = Math.floor(sim.cols / 2);
      expect(row[center]).toBe(1);
      // All others should be 0
      let total = 0;
      for (let i = 0; i < row.length; i++) total += row[i];
      expect(total).toBe(1);
    });

    it('resets currentRow to 0', () => {
      sim.currentRow = 25;
      sim._reset();
      expect(sim.currentRow).toBe(0);
    });

    it('clears all previous rows', () => {
      // Simulate some rows existing
      sim.rows = [new Uint8Array(10), new Uint8Array(10), new Uint8Array(10)];
      sim._reset();
      expect(sim.rows.length).toBe(1);
    });

    it('in random mode, first row has a mix of values', () => {
      sim.initMode = 'random';
      // Use a deterministic mock for Math.random
      let callCount = 0;
      const origRandom = Math.random;
      Math.random = () => {
        callCount++;
        return callCount % 3 === 0 ? 0.3 : 0.7;
      };
      sim._reset();
      const row = sim.rows[0];
      let ones = 0;
      for (let i = 0; i < row.length; i++) ones += row[i];
      // Should have some 1s and some 0s
      expect(ones).toBeGreaterThan(0);
      expect(ones).toBeLessThan(row.length);
      Math.random = origRandom;
    });
  });

  // ── _step ──

  describe('_step()', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 30, height: 30 });
      // cols=10, maxRows=10
    });

    it('advances currentRow by 1', () => {
      sim._step();
      expect(sim.currentRow).toBe(1);
      expect(sim.rows.length).toBe(2);
    });

    it('returns false when currentRow reaches maxRows-1', () => {
      sim.currentRow = sim.maxRows - 1;
      const result = sim._step();
      expect(result).toBe(false);
    });

    it('returns true when a step is taken', () => {
      const result = sim._step();
      expect(result).toBe(true);
    });

    it('applies rule with toroidal wrap on edges', () => {
      // Set up a known first row and rule
      sim.rule = 90;
      sim._buildRuleTable();
      // Rule 90: XOR of left and right
      const firstRow = new Uint8Array(sim.cols);
      firstRow[Math.floor(sim.cols / 2)] = 1;
      sim.rows = [firstRow];
      sim.currentRow = 0;

      sim._step();
      const nextRow = sim.rows[1];
      const center = Math.floor(sim.cols / 2);
      // For rule 90 with single center cell:
      // left of center: left=0, center=0, right=1 -> index=1 -> ruleTable[1]=1
      expect(nextRow[center - 1]).toBe(1);
      // center: left=0, center=1, right=0 -> index=2 -> ruleTable[2]=0
      expect(nextRow[center]).toBe(0);
      // right of center: left=1, center=0, right=0 -> index=4 -> ruleTable[4]=1
      expect(nextRow[center + 1]).toBe(1);
    });

    it('wraps leftmost cell to read from rightmost', () => {
      sim.rule = 255; // all outputs = 1
      sim._buildRuleTable();
      const firstRow = new Uint8Array(sim.cols);
      firstRow[sim.cols - 1] = 1; // only rightmost cell alive
      sim.rows = [firstRow];
      sim.currentRow = 0;

      sim._step();
      // Cell 0 looks left to cols-1: left=1, center=0, right=0 -> index=4
      // ruleTable[4]=1 for rule 255
      expect(sim.rows[1][0]).toBe(1);
    });
  });

  // ── resize ──

  describe('resize()', () => {
    it('recalculates cols and maxRows and resets', () => {
      sim.init({ ctx, width: 300, height: 150 });
      sim.currentRow = 20;
      sim.resize({ ctx, width: 600, height: 300 });
      expect(sim.cols).toBe(200);
      expect(sim.maxRows).toBe(100);
      expect(sim.currentRow).toBe(0);
      expect(sim.rows.length).toBe(1);
    });
  });

  // ── destroy ──

  describe('destroy()', () => {
    it('stops running and clears overlay', () => {
      sim.init({ ctx, width: 300, height: 150 });
      overlay.textContent = 'Row 5 / 50';
      sim.destroy();
      expect(sim.running).toBe(false);
      expect(overlay.textContent).toBe('');
    });
  });

  // ── UI bindings ──

  describe('UI bindings', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 300, height: 150 });
    });

    it('rule slider changes rule and rebuilds table', () => {
      const slider = document.getElementById('wolfram-rule');
      slider.value = '110';
      slider.dispatchEvent(new Event('input'));
      expect(sim.rule).toBe(110);
      expect(document.getElementById('wolfram-rule-val').textContent).toBe('110');
      // Rule table should be rebuilt
      expect(sim.ruleTable).toEqual([0, 1, 1, 1, 0, 1, 1, 0]);
    });

    it('data-rule button sets rule and resets', () => {
      const btn = document.getElementById('rule-110');
      btn.click();
      expect(sim.rule).toBe(110);
      expect(sim.currentRow).toBe(0);
    });

    it('single button sets initMode to single', () => {
      sim.initMode = 'random';
      document.getElementById('wolfram-single').click();
      expect(sim.initMode).toBe('single');
    });

    it('random button sets initMode to random', () => {
      sim.initMode = 'single';
      document.getElementById('wolfram-random-init').click();
      expect(sim.initMode).toBe('random');
    });

    it('reset button resets the simulation', () => {
      // Advance a few steps
      sim._step();
      sim._step();
      expect(sim.currentRow).toBe(2);
      document.getElementById('wolfram-reset').click();
      expect(sim.currentRow).toBe(0);
      expect(sim.rows.length).toBe(1);
    });
  });
});
