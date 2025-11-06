// src/utils/circuitBreaker.js

function createCircuitBreaker({
  failureThreshold = 5,     // cuántos fallos seguidos gatillan OPEN
  cooldownMs = 30000,       // cuánto tiempo esperamos antes de probar de nuevo
  halfOpenMaxCalls = 1      // cuántas llamadas "de prueba" permitimos cuando salimos de OPEN
} = {}) {

  let state = 'CLOSED'; // CLOSED -> OPEN -> HALF_OPEN -> CLOSED
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
        // pasamos a HALF_OPEN para probar
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
