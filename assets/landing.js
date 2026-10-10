import * as earthrise from './vendor/ascii/earthrise.js';
import { mount } from './vendor/ascii/mount.js';

const canvas = document.querySelector('#earthrise');
const toggle = document.querySelector('#motion-toggle');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Build the lunar terrain once; retain play time across pause / resume.
const frame = earthrise.default();
let elapsed = 0;
let paused = reducedMotion.matches;
let stop;
const piece = {
  meta: earthrise.meta,
  default() {
    const offset = elapsed;
    return (time, env) => {
      elapsed = offset + time;
      return frame(elapsed, env);
    };
  },
};

function render() {
  stop?.();
  stop = mount(canvas, piece, { fps: paused ? 0 : 15, motion: true });
  toggle.textContent = paused ? 'Play animation' : 'Pause animation';
  toggle.hidden = false;
}

toggle.addEventListener('click', () => {
  paused = !paused;
  render();
});
reducedMotion.addEventListener('change', () => {
  paused = reducedMotion.matches;
  render();
});
render();

const tipJar = document.querySelector('#tip-jar');
const tipLabel = tipJar.textContent;
let tipTimer;
tipJar.addEventListener('click', () => {
  navigator.clipboard.writeText(tipJar.dataset.btc).then(() => {
    tipJar.textContent = 'Address copied';
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { tipJar.textContent = tipLabel; }, 1600);
  }, () => { tipJar.textContent = tipJar.dataset.btc; }); // clipboard blocked: show it
});
