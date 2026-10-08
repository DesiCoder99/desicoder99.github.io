// Conceptual schedule, not a prediction of device timing.
export const modes = {
  none: { start: 25, end: 55, read: 35, dependency: 'none', status: 'Missing dependency', steps: [0, 5, 25, 35, 45, 55, 100] },
  execution: { start: 70, end: 95, read: 80, dependency: 'order only', status: 'Missing memory dependency', steps: [0, 5, 45, 47, 67, 70, 80, 95, 100] },
  memory: { start: 70, end: 95, read: 80, dependency: 'order + memory', status: 'Correct dependency', steps: [0, 5, 45, 47, 57, 67, 70, 80, 95, 100] },
};

export function sample(mode, progress) {
  const config = modes[mode];
  if (!config) throw new Error(`Unknown mode: ${mode}`);
  const p = Math.max(0, Math.min(100, progress));
  const safe = mode === 'memory';
  const visible = safe && p >= 67;
  const read = p >= config.read;
  let phase = 'Ready to compare', detail = 'A writes 42; B reads the same location. Press Play, step through the events, or drag the timeline.';
  if (p >= 5) { phase = 'A is writing'; detail = 'The producer dispatch is executing in the COMPUTE_SHADER stage. Its write is still in progress.'; }
  if (p >= 45) { phase = 'The write has finished'; detail = 'Finishing the producer is only part of the dependency. The reader also needs the written value to be made visible to its access.'; }
  if (mode === 'none') {
    if (p >= 25) { phase = 'B can overlap A'; detail = 'Submission order alone does not resolve this read-after-write hazard. This example schedule lets B start while A is still writing.'; }
    if (read) { phase = 'No guaranteed read value'; detail = 'B reads without a dependency. The question mark means undefined behavior, not a particular old value; the code may even appear to work.'; }
  } else if (mode === 'execution') {
    if (p >= 47) { phase = 'Ordered, but not visible'; detail = 'The stage masks order A before B. With zero access masks, this barrier provides no availability or visibility guarantee for the written data.'; }
    if (read) { phase = 'Ordering alone does not fix a RAW hazard'; detail = 'B starts after A finishes, but its read still has no guaranteed value. Add the producer write and consumer read to the access scopes.'; }
  } else {
    if (p >= 47) { phase = 'Make the write available'; detail = 'COMPUTE_SHADER + SHADER_WRITE selects the producer write in the source scope of the memory dependency.'; }
    if (p >= 57) { phase = 'Make it visible to the reader'; detail = 'COMPUTE_SHADER + SHADER_READ selects the consumer access. The dependency makes the available write visible before B reads.'; }
    if (p >= 67) { phase = 'B can now safely read'; detail = 'Both requirements are satisfied: A completes before B, and A’s write is visible to B’s shader read.'; }
    if (read) { phase = 'B reads 42'; detail = 'The correct stage and access scopes resolve this read-after-write hazard. The consumer is guaranteed to observe the producer’s value in this example.'; }
  }
  return {
    phase, detail, write: p >= 45 ? '42 · done' : p >= 5 ? 'writing…' : 'pending',
    visible: visible ? 'yes · 42' : safe ? 'not yet' : 'not guaranteed',
    result: read ? safe ? '42' : '?' : p >= config.start ? 'reading…' : 'waiting',
    read, safe, visibilityReady: visible,
    active: { producer: p >= 5 && p < 45, dependency: mode !== 'none' && p >= 47 && p < 70, consumer: p >= config.start && p < config.end },
  };
}

export function codeLines(mode) {
  const lines = [['// Bind producer pipeline + descriptors (omitted).', 'producer'], ['vkCmdDispatch(cmd, 1, 1, 1); // A writes 42', 'producer'], ['', '']];
  if (mode === 'none') {
    lines.push(['// No dependency: this RAW hazard is unresolved.', 'dependency']);
  } else {
    const source = mode === 'memory' ? 'VK_ACCESS_2_SHADER_WRITE_BIT' : '0';
    const destination = mode === 'memory' ? 'VK_ACCESS_2_SHADER_READ_BIT' : '0';
    for (const line of [
      'VkMemoryBarrier2 barrier = {',
      '  .sType = VK_STRUCTURE_TYPE_MEMORY_BARRIER_2,',
      '  .srcStageMask = VK_PIPELINE_STAGE_2_COMPUTE_SHADER_BIT,',
      `  .srcAccessMask = ${source},`,
      '  .dstStageMask = VK_PIPELINE_STAGE_2_COMPUTE_SHADER_BIT,',
      `  .dstAccessMask = ${destination}`, '};', '',
      'VkDependencyInfo dependency = {',
      '  .sType = VK_STRUCTURE_TYPE_DEPENDENCY_INFO,',
      '  .memoryBarrierCount = 1,',
      '  .pMemoryBarriers = &barrier', '};',
      'vkCmdPipelineBarrier2(cmd, &dependency);',
    ]) lines.push([line, 'dependency']);
  }
  lines.push(['', ''], ['// Bind consumer pipeline + descriptors (omitted).', 'consumer'], ['vkCmdDispatch(cmd, 1, 1, 1); // B reads', 'consumer']);
  return lines;
}
