// Deliberately illustrative times; Vulkan makes no such scheduling guarantees.
export const scenarios = {
  chain: { first: 1, second: 2, gpuTarget: 1, hostTarget: 2, hostEnd: 75, status: 'Wait for completion' },
  skip: { first: 3, second: 5, gpuTarget: 2, hostTarget: 2, hostEnd: 35, status: 'At least, not exactly' },
  missing: { first: 1, second: 2, gpuTarget: 1, hostTarget: 3, hostEnd: 95, status: 'Finite wait times out' },
};
export const steps = [0, 5, 8, 35, 42, 75, 95, 100];

export function sampleTimeline(mode, progress) {
  const config = scenarios[mode];
  if (!config) throw new Error(`Unknown timeline scenario: ${mode}`);
  const p = Math.max(0, Math.min(100, progress));
  const counter = p >= 75 ? config.second : p >= 35 ? config.first : 0;
  const gpuReady = counter >= config.gpuTarget;
  const hostReady = counter >= config.hostTarget;
  const timeout = mode === 'missing' && p >= 95;
  let phase = 'Start with counter 0', detail = 'A timeline semaphore holds a monotonically increasing 64-bit value. Each waiter chooses its own target.';
  if (p >= 5) { phase = 'Submit the wait before its signal'; detail = `Queue B is submitted first, waiting for ${config.gpuTarget}. The host can still submit Queue A, then wait for ${config.hostTarget}. A future timeline signal may satisfy an already-submitted wait.`; }
  if (p >= 8) { phase = 'Upload runs; waiters stay blocked'; detail = `Queue A uploads the buffer. The counter is still 0, so Queue B and the waiting CPU thread have not reached their targets.`; }
  if (p >= 35) {
    phase = `Queue A signals ${config.first}`;
    detail = mode === 'skip'
      ? 'The counter jumps directly to 3. Both waits for 2 are satisfied by the same value. Neither wait consumes the signal or resets the counter.'
      : `Queue B’s wait for ${config.gpuTarget} is satisfied. The CPU target is ${config.hostTarget}, so the CPU thread remains blocked. The counter stays at ${config.first}.`;
  }
  if (p >= 42) {
    phase = mode === 'skip' ? 'CPU resumed; Queue B still works' : 'Queue B processes the uploaded buffer';
    detail = mode === 'skip'
      ? 'Waiting for 2 only observed the upload milestone. It does not promise that Queue B is finished; the CPU cannot yet reuse a buffer still in use by B.'
      : `The semaphore dependency allows B to consume A’s upload. The CPU is still waiting for ${config.hostTarget}; the counter has not changed.`;
  }
  if (p >= 75) {
    phase = `Queue B signals ${config.second}`;
    detail = mode === 'missing'
      ? 'All submitted GPU work is complete, but the counter is only 2. No submission in this example signals 3, so the CPU wait is still pending.'
      : mode === 'skip'
        ? 'Processing finishes and the counter advances to 5. Future waits for 2 or 3 are already satisfied; waiting never decrements the counter.'
        : 'The counter reaches 2. The CPU wait succeeds and Queue B’s work is complete. The semaphore stays at 2 and can be used for later milestones.';
  }
  if (timeout) { phase = 'Host wait returns VK_TIMEOUT'; detail = 'The finite timeout expires without reaching 3. A timeout does not advance the counter or cancel GPU work. Check the return value instead of treating this as successful completion.'; }
  return { counter, gpuReady, hostReady, timeout, phase, detail,
    gpuStatus: p < 5 ? 'not submitted' : !gpuReady ? 'blocked' : p < 42 ? 'wait satisfied' : p < 75 ? 'processing' : 'complete',
    hostStatus: p < 5 ? 'not waiting' : timeout ? 'VK_TIMEOUT' : hostReady ? 'VK_SUCCESS' : 'blocked',
    active: { upload: p >= 8 && p < 35, gpuWait: p >= 5 && !gpuReady, work: p >= 42 && p < 75, hostWait: p >= 5 && !hostReady && !timeout },
  };
}

export function timelineCode(mode) {
  const c = scenarios[mode];
  return [
    ['// Timeline semaphore initially 0; setup below.', ''],
    ['// Enqueue the consumer BEFORE its producer.', 'gpuWait'],
    [`submit(queueB, processCmd, ${c.gpuTarget}, ${c.second});`, 'gpuWait'],
    [`// wait >= ${c.gpuTarget}, process buffer, then signal ${c.second}`, 'work'], ['', ''],
    ['// No wait on A; upload then signal.', 'upload'],
    [`submit(queueA, uploadCmd, 0, ${c.first});`, 'upload'], ['', ''],
    [`const uint64_t target = ${c.hostTarget};`, 'hostWait'],
    ['VkSemaphoreWaitInfo wait = {', 'hostWait'],
    ['  .sType = VK_STRUCTURE_TYPE_SEMAPHORE_WAIT_INFO,', 'hostWait'],
    ['  .semaphoreCount = 1,', 'hostWait'],
    ['  .pSemaphores = &timeline,', 'hostWait'],
    ['  .pValues = &target', 'hostWait'],
    ['};', 'hostWait'],
    [mode === 'missing' ? "const uint64_t timeoutNs = 1'000'000'000ULL;" : 'const uint64_t timeoutNs = UINT64_MAX;', 'hostWait'],
    ['VkResult result = vkWaitSemaphores(', 'hostWait'],
    ['  device, &wait, timeoutNs);', 'hostWait'],
    ['// Handle VK_SUCCESS, VK_TIMEOUT, and errors.', 'hostWait'],
  ];
}

export const setupCode = `// Enable timelineSemaphore and synchronization2 device features.
VkSemaphoreTypeCreateInfo type = {
  .sType = VK_STRUCTURE_TYPE_SEMAPHORE_TYPE_CREATE_INFO,
  .semaphoreType = VK_SEMAPHORE_TYPE_TIMELINE,
  .initialValue = 0
};
VkSemaphoreCreateInfo create = {
  .sType = VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO,
  .pNext = &type
};
VkSemaphore timeline;
VK_CHECK(vkCreateSemaphore(device, &create, nullptr, &timeline));

// This lambda captures device/timeline from the surrounding scope.
// 0 means no wait in this helper, not a special Vulkan wait value.
auto submit = [&](VkQueue queue, VkCommandBuffer cmd,
                  uint64_t waitValue, uint64_t signalValue) {
  VkSemaphoreSubmitInfo waitInfo = {
    .sType = VK_STRUCTURE_TYPE_SEMAPHORE_SUBMIT_INFO,
    .semaphore = timeline,
    .value = waitValue,
    .stageMask = VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT
  };
  VkSemaphoreSubmitInfo signalInfo = {
    .sType = VK_STRUCTURE_TYPE_SEMAPHORE_SUBMIT_INFO,
    .semaphore = timeline,
    .value = signalValue,
    .stageMask = VK_PIPELINE_STAGE_2_ALL_COMMANDS_BIT
  };
  VkCommandBufferSubmitInfo command = {
    .sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_SUBMIT_INFO,
    .commandBuffer = cmd,
    .deviceMask = 1
  };
  VkSubmitInfo2 info = {
    .sType = VK_STRUCTURE_TYPE_SUBMIT_INFO_2,
    .waitSemaphoreInfoCount = waitValue ? 1u : 0u,
    .pWaitSemaphoreInfos = waitValue ? &waitInfo : nullptr,
    .commandBufferInfoCount = 1,
    .pCommandBufferInfos = &command,
    .signalSemaphoreInfoCount = 1,
    .pSignalSemaphoreInfos = &signalInfo
  };
  VK_CHECK(vkQueueSubmit2(queue, 1, &info, VK_NULL_HANDLE));
};
// VK_CHECK is the application's result-checking helper.
// Record uploadCmd and processCmd before calling submit().
// Destroy timeline only after all submissions using it complete.`;
