import { runLocalBuildJob, RIFT_LOCAL_BUILD_VERSION } from './local-build-core.js';

self.postMessage({ type: 'ready', version: RIFT_LOCAL_BUILD_VERSION });

self.addEventListener('message', async event => {
  const message = event.data || {};
  if (message.type !== 'build') return;
  const requestId = String(message.requestId || crypto.randomUUID());
  try {
    const output = await runLocalBuildJob(message.job, message.program);
    self.postMessage({ type: 'result', requestId, ...output });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      error: String(error?.message || error),
      stack: String(error?.stack || '')
    });
  }
});
