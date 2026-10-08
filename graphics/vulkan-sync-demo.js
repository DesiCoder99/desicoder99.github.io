import { modes, sample, codeLines } from './vulkan-sync-model.js';

const lab = document.querySelector('#sync-lab');
const get = id => lab.querySelector(`#lab-${id}`);
const play = get('play'), step = get('step'), slider = get('progress');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let mode = 'memory', progress = 0, raf = 0, lastTime = null;
let lastPhase = '';

function announce(state) {
  get('announcement').textContent = `${state.phase}. ${state.detail}`;
}

function draw() {
  const state = sample(mode, progress), config = modes[mode];
  get('write').textContent = state.write;
  get('visible').textContent = state.visible;
  get('visible').dataset.tone = state.visibilityReady ? 'good' : state.safe ? '' : 'warn';
  get('result').textContent = state.result;
  get('result').dataset.tone = state.read ? state.safe ? 'good' : 'warn' : '';
  get('phase').textContent = state.phase;
  get('detail').textContent = state.detail;
  slider.value = String(Math.round(progress));
  slider.setAttribute('aria-valuetext', `${Math.round(progress)} percent. ${state.phase}`);
  get('position').textContent = `${Math.round(progress)}%`;
  get('playhead').style.left = `${progress}%`;
  for (const [name, start, end] of [['producer', 5, 45], ['dependency', 47, 67], ['consumer', config.start, config.end]]) {
    const node = get(name);
    node.style.setProperty('--fill', Math.max(0, Math.min(1, (progress - start) / (end - start))));
    node.dataset.active = state.active[name];
  }
  for (const line of get('code').children) line.dataset.active = Boolean(state.active[line.dataset.group]);
  step.disabled = progress >= 100;
  if (state.phase !== lastPhase) { lastPhase = state.phase; announce(state); }
}

function pause() {
  cancelAnimationFrame(raf); raf = 0; lastTime = null;
  play.textContent = progress >= 100 ? 'Replay' : 'Play';
}

function tick(now) {
  if (lastTime !== null) progress = Math.min(100, progress + Math.min(now - lastTime, 100) / 100 * Number(get('speed').value));
  lastTime = now;
  draw();
  if (progress >= 100) pause();
  else raf = requestAnimationFrame(tick);
}

function selectMode() {
  pause(); progress = 0; lastPhase = '';
  mode = lab.querySelector('input[name="sync-mode"]:checked').value;
  const config = modes[mode];
  get('dependency-label').textContent = config.dependency;
  get('dependency').hidden = mode === 'none';
  get('dependency').querySelector('span').textContent = mode === 'memory' ? 'sync' : 'order';
  get('consumer').style.left = `${config.start}%`;
  get('consumer').style.width = `${config.end - config.start}%`;
  get('code-status').textContent = config.status;
  get('code-status').style.color = mode === 'memory' ? 'var(--lab-green)' : 'var(--lab-orange)';
  get('code').replaceChildren(...codeLines(mode).map(([text, group]) => {
    const line = document.createElement('span');
    line.className = 'lab-code-line'; line.dataset.group = group; line.textContent = text || ' ';
    return line;
  }));
  play.textContent = 'Play'; draw();
}

play.addEventListener('click', () => {
  if (raf) { pause(); return; }
  if (progress >= 100) progress = 0;
  play.textContent = 'Pause'; lastTime = null; raf = requestAnimationFrame(tick);
});
step.addEventListener('click', () => {
  pause(); progress = modes[mode].steps.find(value => value > progress + 0.01) ?? 100;
  draw(); pause();
});
get('reset').addEventListener('click', () => { pause(); progress = 0; draw(); pause(); });
slider.addEventListener('input', () => { pause(); progress = Number(slider.value); draw(); pause(); });
lab.querySelectorAll('input[name="sync-mode"]').forEach(input => input.addEventListener('change', selectMode));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
new IntersectionObserver(entries => { if (!entries[0].isIntersecting) pause(); }).observe(lab);
reduced.addEventListener('change', () => { if (reduced.matches) pause(); });
// Start paused for all visitors, including those who prefer reduced motion.
lab.hidden = false;
selectMode();
