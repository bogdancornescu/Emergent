// Shared test helpers for Emergent simulation tests

import { vi } from 'vitest';

/**
 * Create a mock Canvas 2D rendering context with all methods stubbed.
 */
export function createMockCtx() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  };
}

/**
 * Create a mock canvas element that returns a mock context.
 */
export function createMockCanvas(width = 600, height = 400) {
  const ctx = createMockCtx();
  const listeners = {};

  const canvas = {
    width,
    height,
    style: { width: `${width}px`, height: `${height}px` },
    getContext: vi.fn(() => ctx),
    getBoundingClientRect: vi.fn(() => ({
      left: 0, top: 0, width, height, right: width, bottom: height,
    })),
    parentElement: {
      getBoundingClientRect: vi.fn(() => ({
        width, height, left: 0, top: 0, right: width, bottom: height,
      })),
    },
    addEventListener: vi.fn((event, handler, options) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: vi.fn((event, handler) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== handler);
      }
    }),
    _fire: (event, data = {}) => {
      if (listeners[event]) {
        listeners[event].forEach(h => h(data));
      }
    },
  };

  return { canvas, ctx };
}

/**
 * Create a mock overlay element.
 */
export function createMockOverlay() {
  return {
    textContent: '',
    innerHTML: '',
  };
}

/**
 * Set up DOM elements needed by a simulation's _bindUI method.
 * Pass a map of element IDs to their type and optional attributes.
 */
export function setupDomElements(elements) {
  for (const [id, config] of Object.entries(elements)) {
    const el = document.createElement(config.tag || 'div');
    el.id = id;
    if (config.type) el.type = config.type;
    if (config.value !== undefined) el.value = config.value;
    if (config.textContent !== undefined) el.textContent = config.textContent;
    if (config.max !== undefined) el.max = config.max;
    if (config.dataset) {
      for (const [key, val] of Object.entries(config.dataset)) {
        el.dataset[key] = val;
      }
    }
    document.body.appendChild(el);
  }
}

/**
 * Clean up all elements added to the document body.
 */
export function cleanupDom() {
  document.body.innerHTML = '';
}

/**
 * Stub requestAnimationFrame and cancelAnimationFrame for synchronous testing.
 * Returns an object with a `tick()` method to advance one frame.
 */
export function stubAnimationFrame() {
  let callbacks = [];
  let nextId = 1;

  vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
    const id = nextId++;
    callbacks.push({ id, cb });
    return id;
  }));

  vi.stubGlobal('cancelAnimationFrame', vi.fn((id) => {
    callbacks = callbacks.filter(c => c.id !== id);
  }));

  return {
    tick() {
      const current = [...callbacks];
      callbacks = [];
      current.forEach(({ cb }) => cb(performance.now()));
    },
    pending() {
      return callbacks.length;
    },
  };
}
