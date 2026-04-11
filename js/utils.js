// ── Shared utilities for Emergent simulations ──

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width: rect.width, height: rect.height, dpr };
}

export function clearCanvas(ctx, width, height, color = '#0d0d0f') {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

// Linearly interpolate between two values
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Clamp a value between min and max
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Distance between two points
export function dist(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

// Map value from one range to another
export function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

// HSL to CSS string
export function hsl(h, s, l, a = 1) {
  return a < 1
    ? `hsla(${h}, ${s}%, ${l}%, ${a})`
    : `hsl(${h}, ${s}%, ${l}%)`;
}

// Get mouse/touch position relative to canvas (CSS pixels)
export function getCanvasPos(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  const e = event.touches ? event.touches[0] : event;
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

// Throttle function
export function throttle(fn, delay) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// Simple 2D vector operations
export const vec2 = {
  add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; },
  sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; },
  mul(a, s) { return { x: a.x * s, y: a.y * s }; },
  div(a, s) { return { x: a.x / s, y: a.y / s }; },
  mag(a) { return Math.sqrt(a.x * a.x + a.y * a.y); },
  normalize(a) {
    const m = vec2.mag(a);
    return m > 0 ? { x: a.x / m, y: a.y / m } : { x: 0, y: 0 };
  },
  limit(a, max) {
    const m = vec2.mag(a);
    if (m > max) {
      return { x: (a.x / m) * max, y: (a.y / m) * max };
    }
    return a;
  },
  dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  },
  random(mag = 1) {
    const angle = Math.random() * Math.PI * 2;
    return { x: Math.cos(angle) * mag, y: Math.sin(angle) * mag };
  },
};
