// src/utils/retry.js

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithJitter(fn, { maxAttempts = 3, baseDelayMs = 200 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) {
        break;
      }

      const backoff = baseDelayMs * Math.pow(2, attempt - 1);

      const jitter = Math.floor(Math.random() * baseDelayMs);

      const delay = backoff + jitter;

      console.warn(
        `[retryWithJitter] intento ${attempt} falló: ${err.message}. Reintentando en ~${delay}ms`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = { retryWithJitter };
