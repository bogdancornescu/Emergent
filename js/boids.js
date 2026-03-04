// ── Boids Flocking Simulation ──

import { vec2 } from './utils.js';

export class BoidsSim {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
    this.boids = [];
    this.animId = null;

    // Parameters
    this.separation = 1.5;
    this.alignment = 1.0;
    this.cohesion = 1.0;
    this.perceptionRadius = 60;
    this.count = 150;
    this.trailFade = 85;
    this.maxSpeed = 3;
    this.maxForce = 0.15;

    this._bindUI();
  }

  init({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this._spawnBoids();
    this._startLoop();
  }

  resize({ ctx, width, height }) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  }

  destroy() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.overlay.textContent = '';
  }

  // ── Spawn ──

  _spawnBoids() {
    this.boids = [];
    for (let i = 0; i < this.count; i++) {
      this.boids.push({
        pos: { x: Math.random() * this.width, y: Math.random() * this.height },
        vel: vec2.random(this.maxSpeed * (0.5 + Math.random() * 0.5)),
        acc: { x: 0, y: 0 },
        hue: 190 + Math.random() * 50, // blue-cyan-teal range
      });
    }
  }

  // ── Forces ──

  _flock() {
    const { boids, perceptionRadius, separation, alignment, cohesion, maxForce, maxSpeed } = this;
    const n = boids.length;

    for (let i = 0; i < n; i++) {
      const boid = boids[i];
      let sepForce = { x: 0, y: 0 };
      let aliForce = { x: 0, y: 0 };
      let cohForce = { x: 0, y: 0 };
      let sepCount = 0;
      let aliCount = 0;
      let cohCount = 0;

      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const other = boids[j];
        const d = vec2.dist(boid.pos, other.pos);

        if (d < perceptionRadius) {
          // Alignment
          aliForce = vec2.add(aliForce, other.vel);
          aliCount++;

          // Cohesion
          cohForce = vec2.add(cohForce, other.pos);
          cohCount++;

          // Separation (stronger when closer)
          if (d < perceptionRadius * 0.5 && d > 0) {
            const diff = vec2.sub(boid.pos, other.pos);
            const scaled = vec2.div(diff, d * d);
            sepForce = vec2.add(sepForce, scaled);
            sepCount++;
          }
        }
      }

      // Average and apply weights
      if (aliCount > 0) {
        aliForce = vec2.div(aliForce, aliCount);
        aliForce = vec2.normalize(aliForce);
        aliForce = vec2.mul(aliForce, maxSpeed);
        aliForce = vec2.sub(aliForce, boid.vel);
        aliForce = vec2.limit(aliForce, maxForce);
      }

      if (cohCount > 0) {
        cohForce = vec2.div(cohForce, cohCount);
        cohForce = vec2.sub(cohForce, boid.pos);
        cohForce = vec2.normalize(cohForce);
        cohForce = vec2.mul(cohForce, maxSpeed);
        cohForce = vec2.sub(cohForce, boid.vel);
        cohForce = vec2.limit(cohForce, maxForce);
      }

      if (sepCount > 0) {
        sepForce = vec2.div(sepForce, sepCount);
        sepForce = vec2.normalize(sepForce);
        sepForce = vec2.mul(sepForce, maxSpeed);
        sepForce = vec2.sub(sepForce, boid.vel);
        sepForce = vec2.limit(sepForce, maxForce);
      }

      // Accumulate
      boid.acc = { x: 0, y: 0 };
      boid.acc = vec2.add(boid.acc, vec2.mul(sepForce, separation));
      boid.acc = vec2.add(boid.acc, vec2.mul(aliForce, alignment));
      boid.acc = vec2.add(boid.acc, vec2.mul(cohForce, cohesion));
    }
  }

  // ── Update ──

  _update() {
    const { boids, width, height, maxSpeed } = this;
    for (const boid of boids) {
      boid.vel = vec2.add(boid.vel, boid.acc);
      boid.vel = vec2.limit(boid.vel, maxSpeed);
      boid.pos = vec2.add(boid.pos, boid.vel);

      // Wrap around edges
      if (boid.pos.x < 0) boid.pos.x += width;
      if (boid.pos.x > width) boid.pos.x -= width;
      if (boid.pos.y < 0) boid.pos.y += height;
      if (boid.pos.y > height) boid.pos.y -= height;
    }
  }

  // ── Render ──

  _draw() {
    const { ctx, width, height, boids, trailFade } = this;

    // Trail fade effect
    const alpha = (100 - trailFade) / 100;
    ctx.fillStyle = `rgba(13, 13, 15, ${Math.max(0.02, alpha)})`;
    ctx.fillRect(0, 0, width, height);

    // Draw boids as triangles pointing in their velocity direction
    for (const boid of boids) {
      const angle = Math.atan2(boid.vel.y, boid.vel.x);
      const speed = vec2.mag(boid.vel);
      const size = 5 + speed;

      ctx.save();
      ctx.translate(boid.pos.x, boid.pos.y);
      ctx.rotate(angle);

      ctx.fillStyle = `hsl(${boid.hue}, 75%, 65%)`;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size * 0.5, size * 0.4);
      ctx.lineTo(-size * 0.3, 0);
      ctx.lineTo(-size * 0.5, -size * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
  }

  // ── Loop ──

  _startLoop() {
    const loop = () => {
      this.animId = requestAnimationFrame(loop);
      this._flock();
      this._update();
      this._draw();
      this.overlay.textContent = `${this.boids.length} boids`;
    };
    this.animId = requestAnimationFrame(loop);
  }

  // ── UI ──

  _bindUI() {
    this._bindSlider('boids-separation', 'boids-separation-val', v => { this.separation = v; });
    this._bindSlider('boids-alignment', 'boids-alignment-val', v => { this.alignment = v; });
    this._bindSlider('boids-cohesion', 'boids-cohesion-val', v => { this.cohesion = v; });
    this._bindSlider('boids-radius', 'boids-radius-val', v => { this.perceptionRadius = v; });
    this._bindSlider('boids-trails', 'boids-trails-val', v => { this.trailFade = v; });

    this._bindSlider('boids-count', 'boids-count-val', v => {
      this.count = Math.round(v);
      // Adjust boid count live
      while (this.boids.length < this.count) {
        this.boids.push({
          pos: { x: Math.random() * this.width, y: Math.random() * this.height },
          vel: vec2.random(this.maxSpeed * (0.5 + Math.random() * 0.5)),
          acc: { x: 0, y: 0 },
          hue: 190 + Math.random() * 50,
        });
      }
      while (this.boids.length > this.count) {
        this.boids.pop();
      }
    });

    document.getElementById('boids-reset').addEventListener('click', () => {
      this._spawnBoids();
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
