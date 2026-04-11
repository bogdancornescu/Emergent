import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createMockCanvas,
  createMockOverlay,
  setupDomElements,
  cleanupDom,
  stubAnimationFrame,
} from './helpers.js';

describe('BoidsSim', () => {
  let canvas, ctx, overlay, sim, raf;

  beforeEach(async () => {
    raf = stubAnimationFrame();

    setupDomElements({
      'boids-separation': { tag: 'input', type: 'range', value: '1.5' },
      'boids-separation-val': { tag: 'span', textContent: '1.5' },
      'boids-alignment': { tag: 'input', type: 'range', value: '1.0' },
      'boids-alignment-val': { tag: 'span', textContent: '1.0' },
      'boids-cohesion': { tag: 'input', type: 'range', value: '1.0' },
      'boids-cohesion-val': { tag: 'span', textContent: '1.0' },
      'boids-radius': { tag: 'input', type: 'range', value: '60', max: '200' },
      'boids-radius-val': { tag: 'span', textContent: '60' },
      'boids-trails': { tag: 'input', type: 'range', value: '85' },
      'boids-trails-val': { tag: 'span', textContent: '85' },
      'boids-count': { tag: 'input', type: 'range', value: '150' },
      'boids-count-val': { tag: 'span', textContent: '150' },
      'boids-reset': { tag: 'button', textContent: 'Reset' },
    });

    ({ canvas, ctx } = createMockCanvas(800, 600));
    overlay = createMockOverlay();

    const mod = await import('../js/boids.js');
    sim = new mod.BoidsSim(canvas, overlay);
  });

  afterEach(() => {
    sim.destroy();
    cleanupDom();
    vi.restoreAllMocks();
  });

  // ── Constructor defaults ──

  describe('constructor', () => {
    it('sets default parameter values', () => {
      expect(sim.separation).toBe(1.5);
      expect(sim.alignment).toBe(1.0);
      expect(sim.cohesion).toBe(1.0);
      expect(sim.perceptionRadius).toBe(60);
      expect(sim.count).toBe(150);
      expect(sim.trailFade).toBe(85);
      expect(sim.maxSpeed).toBe(3);
      expect(sim.maxForce).toBe(0.15);
    });

    it('starts with empty boids array', () => {
      expect(sim.boids).toEqual([]);
    });
  });

  // ── init ──

  describe('init()', () => {
    it('stores canvas dimensions', () => {
      sim.init({ ctx, width: 800, height: 600 });
      expect(sim.width).toBe(800);
      expect(sim.height).toBe(600);
      expect(sim.ctx).toBe(ctx);
    });

    it('spawns the correct number of boids', () => {
      sim.init({ ctx, width: 800, height: 600 });
      expect(sim.boids.length).toBe(150);
    });

    it('starts animation loop', () => {
      sim.init({ ctx, width: 800, height: 600 });
      expect(raf.pending()).toBeGreaterThan(0);
    });
  });

  // ── _spawnBoids ──

  describe('_spawnBoids()', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 800, height: 600 });
    });

    it('creates this.count boids', () => {
      sim.count = 50;
      sim._spawnBoids();
      expect(sim.boids.length).toBe(50);
    });

    it('each boid has pos, vel, acc, and hue', () => {
      sim._spawnBoids();
      const boid = sim.boids[0];
      expect(boid).toHaveProperty('pos');
      expect(boid).toHaveProperty('vel');
      expect(boid).toHaveProperty('acc');
      expect(boid).toHaveProperty('hue');
      expect(typeof boid.pos.x).toBe('number');
      expect(typeof boid.pos.y).toBe('number');
      expect(typeof boid.vel.x).toBe('number');
      expect(typeof boid.vel.y).toBe('number');
    });

    it('boid positions are within canvas bounds', () => {
      sim._spawnBoids();
      for (const boid of sim.boids) {
        expect(boid.pos.x).toBeGreaterThanOrEqual(0);
        expect(boid.pos.x).toBeLessThanOrEqual(800);
        expect(boid.pos.y).toBeGreaterThanOrEqual(0);
        expect(boid.pos.y).toBeLessThanOrEqual(600);
      }
    });

    it('boid hues are in the blue-cyan-teal range (190-240)', () => {
      sim._spawnBoids();
      for (const boid of sim.boids) {
        expect(boid.hue).toBeGreaterThanOrEqual(190);
        expect(boid.hue).toBeLessThanOrEqual(240);
      }
    });

    it('replaces existing boids array', () => {
      sim.boids = [{ pos: { x: 0, y: 0 } }];
      sim._spawnBoids();
      expect(sim.boids.length).toBe(sim.count);
    });
  });

  // ── _flock ──

  describe('_flock()', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 800, height: 600 });
    });

    it('sets acceleration on each boid', () => {
      // Place two boids close together
      sim.boids = [
        { pos: { x: 100, y: 100 }, vel: { x: 1, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
        { pos: { x: 110, y: 100 }, vel: { x: 1, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
      ];
      sim._flock();
      // Both boids should have non-zero acceleration (they're within perception radius)
      const acc0 = sim.boids[0].acc;
      const acc1 = sim.boids[1].acc;
      expect(typeof acc0.x).toBe('number');
      expect(typeof acc0.y).toBe('number');
      // With two aligned boids close together, there should be some force
      const hasSomeForce = acc0.x !== 0 || acc0.y !== 0 || acc1.x !== 0 || acc1.y !== 0;
      expect(hasSomeForce).toBe(true);
    });

    it('boids far apart have zero acceleration', () => {
      sim.boids = [
        { pos: { x: 0, y: 0 }, vel: { x: 1, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
        { pos: { x: 700, y: 500 }, vel: { x: -1, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
      ];
      sim.perceptionRadius = 60;
      sim._flock();
      // Both are beyond perception radius, so no flocking forces
      expect(sim.boids[0].acc.x).toBe(0);
      expect(sim.boids[0].acc.y).toBe(0);
    });

    it('separation pushes close boids apart', () => {
      // Two boids very close, same velocity
      sim.boids = [
        { pos: { x: 100, y: 100 }, vel: { x: 1, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
        { pos: { x: 105, y: 100 }, vel: { x: 1, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
      ];
      sim.separation = 5.0;
      sim.alignment = 0;
      sim.cohesion = 0;
      sim._flock();
      // Boid 0 should be pushed left (away from boid 1)
      expect(sim.boids[0].acc.x).toBeLessThan(0);
      // Boid 1 should be pushed right
      expect(sim.boids[1].acc.x).toBeGreaterThan(0);
    });
  });

  // ── _update ──

  describe('_update()', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 800, height: 600 });
    });

    it('applies acceleration to velocity and velocity to position', () => {
      sim.boids = [
        { pos: { x: 100, y: 100 }, vel: { x: 2, y: 0 }, acc: { x: 0.1, y: 0 }, hue: 200 },
      ];
      sim._update();
      // vel = (2 + 0.1, 0) = (2.1, 0), pos = (100 + 2.1, 100) = (102.1, 100)
      expect(sim.boids[0].vel.x).toBeCloseTo(2.1);
      expect(sim.boids[0].pos.x).toBeCloseTo(102.1);
      expect(sim.boids[0].pos.y).toBe(100);
    });

    it('limits velocity to maxSpeed', () => {
      sim.boids = [
        { pos: { x: 100, y: 100 }, vel: { x: 10, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
      ];
      sim._update();
      const speed = Math.sqrt(sim.boids[0].vel.x ** 2 + sim.boids[0].vel.y ** 2);
      expect(speed).toBeLessThanOrEqual(sim.maxSpeed + 0.001);
    });

    it('wraps position when going off the right edge', () => {
      sim.boids = [
        { pos: { x: 799, y: 100 }, vel: { x: 3, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
      ];
      sim._update();
      // 799 + 3 = 802 > 800, so wraps: 802 - 800 = 2
      expect(sim.boids[0].pos.x).toBeCloseTo(2);
    });

    it('wraps position when going off the left edge', () => {
      sim.boids = [
        { pos: { x: 1, y: 100 }, vel: { x: -3, y: 0 }, acc: { x: 0, y: 0 }, hue: 200 },
      ];
      sim._update();
      // 1 + (-3) = -2 < 0, wraps: -2 + 800 = 798
      expect(sim.boids[0].pos.x).toBeCloseTo(798);
    });

    it('wraps position when going off the top edge', () => {
      sim.boids = [
        { pos: { x: 100, y: 1 }, vel: { x: 0, y: -3 }, acc: { x: 0, y: 0 }, hue: 200 },
      ];
      sim._update();
      expect(sim.boids[0].pos.y).toBeCloseTo(598);
    });

    it('wraps position when going off the bottom edge', () => {
      sim.boids = [
        { pos: { x: 100, y: 599 }, vel: { x: 0, y: 3 }, acc: { x: 0, y: 0 }, hue: 200 },
      ];
      sim._update();
      expect(sim.boids[0].pos.y).toBeCloseTo(2);
    });
  });

  // ── resize ──

  describe('resize()', () => {
    it('updates dimensions without respawning boids', () => {
      sim.init({ ctx, width: 800, height: 600 });
      const boidCount = sim.boids.length;
      sim.resize({ ctx, width: 400, height: 300 });
      expect(sim.width).toBe(400);
      expect(sim.height).toBe(300);
      expect(sim.boids.length).toBe(boidCount);
    });
  });

  // ── destroy ──

  describe('destroy()', () => {
    it('cancels animation and clears overlay', () => {
      sim.init({ ctx, width: 800, height: 600 });
      overlay.textContent = '150 boids';
      sim.destroy();
      expect(overlay.textContent).toBe('');
    });
  });

  // ── UI bindings ──

  describe('UI bindings', () => {
    beforeEach(() => {
      sim.init({ ctx, width: 800, height: 600 });
    });

    it('separation slider updates separation value', () => {
      const slider = document.getElementById('boids-separation');
      slider.value = '2.5';
      slider.dispatchEvent(new Event('input'));
      expect(sim.separation).toBe(2.5);
      expect(document.getElementById('boids-separation-val').textContent).toBe('2.5');
    });

    it('alignment slider updates alignment value', () => {
      const slider = document.getElementById('boids-alignment');
      slider.value = '0.5';
      slider.dispatchEvent(new Event('input'));
      expect(sim.alignment).toBe(0.5);
    });

    it('cohesion slider updates cohesion value', () => {
      const slider = document.getElementById('boids-cohesion');
      slider.value = '2.0';
      slider.dispatchEvent(new Event('input'));
      expect(sim.cohesion).toBe(2.0);
    });

    it('radius slider updates perceptionRadius', () => {
      const slider = document.getElementById('boids-radius');
      slider.value = '120';
      slider.dispatchEvent(new Event('input'));
      expect(sim.perceptionRadius).toBe(120);
    });

    it('trails slider updates trailFade', () => {
      const slider = document.getElementById('boids-trails');
      slider.value = '50';
      slider.dispatchEvent(new Event('input'));
      expect(sim.trailFade).toBe(50);
    });

    it('count slider adjusts boid count upward', () => {
      sim.count = 150;
      sim.boids = sim.boids.slice(0, 10); // reduce to 10
      const slider = document.getElementById('boids-count');
      slider.value = '20';
      slider.dispatchEvent(new Event('input'));
      expect(sim.count).toBe(20);
      expect(sim.boids.length).toBe(20);
    });

    it('count slider adjusts boid count downward', () => {
      const slider = document.getElementById('boids-count');
      slider.value = '50';
      slider.dispatchEvent(new Event('input'));
      expect(sim.count).toBe(50);
      expect(sim.boids.length).toBe(50);
    });

    it('reset button respawns boids', () => {
      sim.boids = [];
      document.getElementById('boids-reset').click();
      expect(sim.boids.length).toBe(sim.count);
    });
  });
});
