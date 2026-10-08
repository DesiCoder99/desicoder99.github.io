import { scenarios, steps, sampleTimeline, timelineCode, setupCode } from './vulkan-timeline-model.js';

const lab = document.querySelector('#timeline-lab');
const get = id => lab.querySelector(`#tl-${id}`);
const play = get('play'), step = get('step'), slider = get('progress');
let mode = 'chain', progress = 0, raf = 0, lastTime = null, lastPhase = '';

function draw() {
  const state = sampleTimeline(mode, progress), config = scenarios[mode];
  get('counter').textContent = state.counter;
  get('gpu-status').textContent = state.gpuStatus;
  get('gpu-status').dataset.tone = state.gpuReady ? 'good' : progress >= 5 ? 'warn' : '';
  get('host-status').textContent = state.hostStatus;
  get('host-status').dataset.tone = state.hostReady ? 'good' : progress >= 5 ? 'warn' : '';
  get('phase').textContent = state.phase;
  get('detail').textContent = state.detail;
  get('position').textContent = `${Math.round(progress)}%`;
  slider.value = String(Math.round(progress));
  slider.setAttribute('aria-valuetext', `${Math.round(progress)} percent. Counter ${state.counter}. ${state.phase}`);
  get('playhead').style.left = `${progress}%`;
  for (const node of get('milestones').children) node.dataset.reached = Number(node.dataset.value) <= state.counter;
  for (const [name, start, end, active] of [
    ['upload', 8, 35, state.active.upload], ['gpu-wait', 5, 35, state.active.gpuWait],
    ['work', 42, 75, state.active.work], ['host-wait', 5, config.hostEnd, state.active.hostWait],
  ]) {
    get(name).style.setProperty('--fill', Math.max(0, Math.min(1, (progress - start) / (end - start))));
    get(name).dataset.active = active;
  }
  get('signal-a').dataset.reached = progress >= 35;
  get('signal-b').dataset.reached = progress >= 75;
  for (const line of get('code').children) line.dataset.active = Boolean(state.active[line.dataset.group]);
  step.disabled = progress >= 100;
  if (lastPhase !== state.phase) { lastPhase = state.phase; get('announcement').textContent = `${state.phase}. ${state.detail}`; }
}
function pause() {
  cancelAnimationFrame(raf); raf = 0; lastTime = null;
  play.textContent = progress >= 100 ? 'Replay' : 'Play';
}
function tick(now) {
  if (lastTime !== null) progress = Math.min(100, progress + Math.min(now - lastTime, 100) / 100 * Number(get('speed').value));
  lastTime = now; draw();
  if (progress >= 100) pause();
  else raf = requestAnimationFrame(tick);
}
function selectMode() {
  pause(); progress = 0; lastPhase = '';
  mode = lab.querySelector('input[name="timeline-mode"]:checked').value;
  const c = scenarios[mode];
  get('gpu-target').textContent = `Queue B waits ≥ ${c.gpuTarget}`;
  get('host-target').textContent = `CPU waits ≥ ${c.hostTarget}`;
  get('gpu-wait').querySelector('span').textContent = `≥ ${c.gpuTarget}`;
  get('host-wait').querySelector('span').textContent = `wait ≥ ${c.hostTarget}`;
  get('host-wait').style.width = `${c.hostEnd - 5}%`;
  get('signal-a').textContent = `↑ ${c.first}`;
  get('signal-b').textContent = `↑ ${c.second}`;
  get('code-status').textContent = c.status;
  get('milestones').replaceChildren(...[0, c.first, c.second].map(value => {
    const node = document.createElement('span'); node.textContent = value; node.dataset.value = value; return node;
  }));
  get('code').replaceChildren(...timelineCode(mode).map(([text, group]) => {
    const line = document.createElement('span'); line.className = 'lab-code-line'; line.dataset.group = group; line.textContent = text || ' '; return line;
  }));
  play.textContent = 'Play'; draw();
}
play.addEventListener('click', () => {
  if (raf) { pause(); return; }
  if (progress >= 100) progress = 0;
  play.textContent = 'Pause'; lastTime = null; raf = requestAnimationFrame(tick);
});
step.addEventListener('click', () => { pause(); progress = steps.find(value => value > progress + .01) ?? 100; draw(); pause(); });
get('reset').addEventListener('click', () => { pause(); progress = 0; draw(); pause(); });
slider.addEventListener('input', () => { pause(); progress = Number(slider.value); draw(); pause(); });
lab.querySelectorAll('input[name="timeline-mode"]').forEach(input => input.addEventListener('change', selectMode));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
new IntersectionObserver(entries => { if (!entries[0].isIntersecting) pause(); }).observe(lab);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => { if (event.matches) pause(); });
get('setup-code').textContent = setupCode;
lab.hidden = false;
selectMode();
