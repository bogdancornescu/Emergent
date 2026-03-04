// ── Emergent: Main Application Controller ──

import { setupCanvas } from './utils.js';
import { LifeSim } from './life.js';
import { WolframSim } from './wolfram.js';
import { BoidsSim } from './boids.js';
import { LSystemSim } from './lsystem.js';
import { ReactionDiffusionSim } from './reaction-diffusion.js';

const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const tabs = document.querySelectorAll('#tabs button');
const panels = document.querySelectorAll('.sim-panel');

let currentSim = null;
let currentName = null;

// ── Simulation registry ──
const sims = {
  life: () => new LifeSim(canvas, overlay),
  wolfram: () => new WolframSim(canvas, overlay),
  boids: () => new BoidsSim(canvas, overlay),
  lsystem: () => new LSystemSim(canvas, overlay),
  reaction: () => new ReactionDiffusionSim(canvas, overlay),
};

// ── Switch simulation ──
function switchSim(name) {
  if (name === currentName) return;

  // Tear down current sim
  if (currentSim) {
    currentSim.destroy();
    currentSim = null;
  }

  currentName = name;

  // Update tabs
  tabs.forEach(t => t.classList.toggle('active', t.dataset.sim === name));
  panels.forEach(p => p.classList.toggle('active', p.dataset.panel === name));

  // Setup canvas fresh
  const info = setupCanvas(canvas);

  // Create new sim
  currentSim = sims[name]();
  currentSim.init(info);
}

// ── Tab clicks ──
tabs.forEach(tab => {
  tab.addEventListener('click', () => switchSim(tab.dataset.sim));
});

// ── Handle resize ──
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (currentSim) {
      const info = setupCanvas(canvas);
      currentSim.resize(info);
    }
  }, 150);
});

// ── Boot ──
switchSim('life');
