// src/utils/circuitBreaker.js

function createCircuitBreaker({
  failureThreshold = 5,
  cooldownMs = 30000,
  halfOpenMaxCalls = 1
} = {}) {

  let state = 'CLOSED';
  let failureCount = 0;
  let nextAttemptAfter = 0;
  let halfOpenCalls = 0;

  function now() {
    return Date.now();
  }

  function shouldAllow() {
    if (state === 'CLOSED') {
      return true;
    }

    if (state === 'OPEN') {
      if (now() > nextAttemptAfter) {
        state = 'HALF_OPEN';
        halfOpenCalls = 0;
        return true;
      }
      return false;
    }

    if (state === 'HALF_OPEN') {
      if (halfOpenCalls < halfOpenMaxCalls) {
        halfOpenCalls += 1;
        return true;
      }
      return false;
    }

    return true;
  }

  function reportSuccess() {
    failureCount = 0;
    state = 'CLOSED';
  }

  function reportFailure() {
    failureCount += 1;

    if (failureCount >= failureThreshold) {
      state = 'OPEN';
      nextAttemptAfter = now() + cooldownMs;
    }
  }

  return {
    shouldAllow,
    reportSuccess,
    reportFailure,
    _debug: () => ({ state, failureCount, nextAttemptAfter })
  };
}

module.exports = { createCircuitBreaker };
