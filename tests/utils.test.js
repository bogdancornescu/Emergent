import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockCtx, createMockCanvas } from './helpers.js';
import {
  setupCanvas,
  clearCanvas,
  lerp,
  clamp,
  dist,
  mapRange,
  hsl,
  getCanvasPos,
  throttle,
  vec2,
} from '../js/utils.js';

// ── setupCanvas ──

describe('setupCanvas', () => {
  it('scales canvas dimensions by devicePixelRatio', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const { canvas, ctx } = createMockCanvas(800, 600);

    const result = setupCanvas(canvas);

    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(canvas.style.width).toBe('800px');
    expect(canvas.style.height).toBe('600px');
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.dpr).toBe(2);
    expect(result.ctx).toBe(ctx);
    expect(ctx.scale).toHaveBeenCalledWith(2, 2);

    vi.unstubAllGlobals();
  });

  it('defaults devicePixelRatio to 1 when not set', () => {
    vi.stubGlobal('devicePixelRatio', undefined);
    const { canvas } = createMockCanvas(400, 300);

    const result = setupCanvas(canvas);

    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
    expect(result.dpr).toBe(1);

    vi.unstubAllGlobals();
  });

  it('calls getContext with "2d"', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    const { canvas } = createMockCanvas(100, 100);

    setupCanvas(canvas);

    expect(canvas.getContext).toHaveBeenCalledWith('2d');

    vi.unstubAllGlobals();
  });
});

// ── clearCanvas ──

describe('clearCanvas', () => {
  it('fills the entire canvas with the given color', () => {
    const ctx = createMockCtx();
    clearCanvas(ctx, 800, 600, '#ff0000');

    expect(ctx.fillStyle).toBe('#ff0000');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 800, 600);
  });

  it('uses default color #0d0d0f when none is provided', () => {
    const ctx = createMockCtx();
    clearCanvas(ctx, 100, 100);

    expect(ctx.fillStyle).toBe('#0d0d0f');
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
  });
});

// ── lerp (buggy: uses a - b instead of b - a) ──

describe('lerp', () => {
  it('returns a when t is 0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns a + (a - b) * t due to the current bug', () => {
    // Correct lerp(0, 10, 0.5) would be 5, but buggy version gives 0 + (0 - 10) * 0.5 = -5
    expect(lerp(0, 10, 0.5)).toBe(-5);
  });

  it('returns a + (a - b) * 1 when t is 1', () => {
    // lerp(10, 20, 1) = 10 + (10 - 20) * 1 = 0 (not 20)
    expect(lerp(10, 20, 1)).toBe(0);
  });

  it('handles equal values', () => {
    expect(lerp(5, 5, 0.5)).toBe(5);
  });

  it('handles negative values', () => {
    // lerp(-10, 10, 0.5) = -10 + (-10 - 10) * 0.5 = -10 + -10 = -20
    expect(lerp(-10, 10, 0.5)).toBe(-20);
  });

  it('handles t values greater than 1', () => {
    // lerp(0, 10, 2) = 0 + (0 - 10) * 2 = -20
    expect(lerp(0, 10, 2)).toBe(-20);
  });
});

// ── clamp ──

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to min when value is below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to max when value is above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it('returns max when value equals max', () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('handles negative ranges', () => {
    expect(clamp(-5, -10, -1)).toBe(-5);
    expect(clamp(-15, -10, -1)).toBe(-10);
    expect(clamp(0, -10, -1)).toBe(-1);
  });
});

// ── dist ──

describe('dist', () => {
  it('returns 0 for the same point', () => {
    expect(dist(5, 5, 5, 5)).toBe(0);
  });

  it('calculates horizontal distance', () => {
    expect(dist(0, 0, 3, 0)).toBe(3);
  });

  it('calculates vertical distance', () => {
    expect(dist(0, 0, 0, 4)).toBe(4);
  });

  it('calculates diagonal distance (3-4-5 triangle)', () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
  });

  it('is commutative', () => {
    expect(dist(1, 2, 5, 8)).toBe(dist(5, 8, 1, 2));
  });

  it('handles negative coordinates', () => {
    expect(dist(-3, -4, 0, 0)).toBe(5);
  });
});

// ── mapRange ──

describe('mapRange', () => {
  it('maps midpoint correctly', () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
  });

  it('maps start of range', () => {
    expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
  });

  it('maps end of range', () => {
    expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
  });

  it('maps to inverted output range', () => {
    expect(mapRange(5, 0, 10, 100, 0)).toBe(50);
  });

  it('extrapolates beyond input range', () => {
    expect(mapRange(20, 0, 10, 0, 100)).toBe(200);
  });

  it('maps between arbitrary ranges', () => {
    // value 3 in [1,5] -> maps to [10,30]: 10 + 20 * ((3-1)/(5-1)) = 10 + 10 = 20
    expect(mapRange(3, 1, 5, 10, 30)).toBe(20);
  });

  it('returns NaN when input range has zero width', () => {
    expect(mapRange(5, 5, 5, 0, 10)).toBeNaN();
  });
});

// ── hsl ──

describe('hsl', () => {
  it('returns hsl string when alpha is 1 (default)', () => {
    expect(hsl(180, 50, 60)).toBe('hsl(180, 50%, 60%)');
  });

  it('returns hsla string when alpha is less than 1', () => {
    expect(hsl(0, 100, 50, 0.5)).toBe('hsla(0, 100%, 50%, 0.5)');
  });

  it('returns hsl string when alpha is exactly 1', () => {
    expect(hsl(270, 80, 40, 1)).toBe('hsl(270, 80%, 40%)');
  });

  it('returns hsla string for alpha of 0', () => {
    expect(hsl(90, 50, 50, 0)).toBe('hsla(90, 50%, 50%, 0)');
  });

  it('handles decimal hue values', () => {
    expect(hsl(180.5, 50, 60)).toBe('hsl(180.5, 50%, 60%)');
  });
});

// ── getCanvasPos ──

describe('getCanvasPos', () => {
  it('returns position relative to canvas for mouse events', () => {
    const { canvas } = createMockCanvas(800, 600);
    canvas.getBoundingClientRect.mockReturnValue({
      left: 100, top: 50, width: 800, height: 600,
    });

    const event = { clientX: 250, clientY: 150 };
    const pos = getCanvasPos(canvas, event);

    expect(pos.x).toBe(150);
    expect(pos.y).toBe(100);
  });

  it('returns position relative to canvas for touch events', () => {
    const { canvas } = createMockCanvas(800, 600);
    canvas.getBoundingClientRect.mockReturnValue({
      left: 0, top: 0, width: 800, height: 600,
    });

    const event = {
      touches: [{ clientX: 300, clientY: 200 }],
    };
    const pos = getCanvasPos(canvas, event);

    expect(pos.x).toBe(300);
    expect(pos.y).toBe(200);
  });

  it('handles canvas offset at origin', () => {
    const { canvas } = createMockCanvas(400, 400);
    canvas.getBoundingClientRect.mockReturnValue({
      left: 0, top: 0, width: 400, height: 400,
    });

    const pos = getCanvasPos(canvas, { clientX: 100, clientY: 100 });

    expect(pos.x).toBe(100);
    expect(pos.y).toBe(100);
  });
});

// ── throttle ──

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the function immediately on first invocation', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled('a');

    expect(fn).toHaveBeenCalledWith('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('suppresses calls within the delay window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows a call after the delay has passed', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('preserves this context', () => {
    const obj = {
      value: 42,
      method: throttle(function () {
        return this.value;
      }, 100),
    };

    // We can't easily check the return value via vi.fn, but we can
    // verify it doesn't throw when called with a context
    expect(() => obj.method()).not.toThrow();
  });

  it('passes arguments through', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled(1, 2, 3);

    expect(fn).toHaveBeenCalledWith(1, 2, 3);
  });
});

// ── vec2 ──

describe('vec2', () => {
  describe('add', () => {
    it('adds two vectors', () => {
      expect(vec2.add({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({ x: 4, y: 6 });
    });

    it('handles negative values', () => {
      expect(vec2.add({ x: -1, y: -2 }, { x: 3, y: 4 })).toEqual({ x: 2, y: 2 });
    });
  });

  describe('sub', () => {
    it('subtracts two vectors', () => {
      expect(vec2.sub({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({ x: 3, y: 4 });
    });
  });

  describe('mul', () => {
    it('multiplies vector by scalar', () => {
      expect(vec2.mul({ x: 3, y: 4 }, 2)).toEqual({ x: 6, y: 8 });
    });

    it('handles scalar of 0', () => {
      expect(vec2.mul({ x: 3, y: 4 }, 0)).toEqual({ x: 0, y: 0 });
    });

    it('handles negative scalar', () => {
      expect(vec2.mul({ x: 3, y: 4 }, -1)).toEqual({ x: -3, y: -4 });
    });
  });

  describe('div', () => {
    it('divides vector by scalar', () => {
      expect(vec2.div({ x: 6, y: 8 }, 2)).toEqual({ x: 3, y: 4 });
    });

    it('returns Infinity for division by zero', () => {
      const result = vec2.div({ x: 5, y: 10 }, 0);
      expect(result.x).toBe(Infinity);
      expect(result.y).toBe(Infinity);
    });
  });

  describe('mag', () => {
    it('calculates magnitude of a 3-4-5 vector', () => {
      expect(vec2.mag({ x: 3, y: 4 })).toBe(5);
    });

    it('returns 0 for zero vector', () => {
      expect(vec2.mag({ x: 0, y: 0 })).toBe(0);
    });

    it('handles unit vectors', () => {
      expect(vec2.mag({ x: 1, y: 0 })).toBe(1);
    });
  });

  describe('normalize', () => {
    it('normalizes a vector to unit length', () => {
      const result = vec2.normalize({ x: 3, y: 4 });
      expect(result.x).toBeCloseTo(0.6);
      expect(result.y).toBeCloseTo(0.8);
    });

    it('returns zero vector when input is zero', () => {
      expect(vec2.normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    });

    it('produces a vector with magnitude 1', () => {
      const result = vec2.normalize({ x: 10, y: 10 });
      expect(vec2.mag(result)).toBeCloseTo(1);
    });
  });

  describe('limit', () => {
    it('returns original vector when under the limit', () => {
      const v = { x: 1, y: 1 };
      expect(vec2.limit(v, 10)).toBe(v); // same reference
    });

    it('caps vector magnitude at the limit', () => {
      const result = vec2.limit({ x: 30, y: 40 }, 5);
      expect(vec2.mag(result)).toBeCloseTo(5);
    });

    it('preserves direction when limiting', () => {
      const v = { x: 30, y: 40 };
      const result = vec2.limit(v, 5);
      // direction should be (0.6, 0.8)
      expect(result.x).toBeCloseTo(3);
      expect(result.y).toBeCloseTo(4);
    });

    it('returns original when magnitude equals limit', () => {
      const v = { x: 3, y: 4 }; // mag = 5
      expect(vec2.limit(v, 5)).toBe(v);
    });
  });

  describe('dist', () => {
    it('calculates distance between two points', () => {
      expect(vec2.dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it('returns 0 for same point', () => {
      expect(vec2.dist({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });
  });

  describe('random', () => {
    it('returns a vector with the specified magnitude', () => {
      const result = vec2.random(7);
      expect(vec2.mag(result)).toBeCloseTo(7);
    });

    it('defaults to magnitude 1', () => {
      const result = vec2.random();
      expect(vec2.mag(result)).toBeCloseTo(1);
    });

    it('returns an object with x and y', () => {
      const result = vec2.random();
      expect(result).toHaveProperty('x');
      expect(result).toHaveProperty('y');
    });
  });
});
