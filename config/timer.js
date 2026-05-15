// Single source of truth for Pomodoro segment durations and cadence.
// Imported by the TimerState model (defaults) and the timer controller.

const FOCUS_SEC = 25 * 60;
const SHORT_BREAK_SEC = 5 * 60;
const LONG_BREAK_SEC = 15 * 60;

// A long break is granted on every Nth consecutive completed focus session.
const LONG_BREAK_EVERY = 4;

// Cap the auto-finalize loop so a corrupted startedAt can't burn the request.
const MAX_AUTO_FINALIZE_ITERATIONS = 100;

// How many more focus sessions until the next long break, given the current
// consecutive-session count. Returns 0 the moment a long break is due.
function focusSessionsUntilLongBreak(consecutiveSessions) {
  return Math.max(0, LONG_BREAK_EVERY - consecutiveSessions);
}

module.exports = {
  FOCUS_SEC,
  SHORT_BREAK_SEC,
  LONG_BREAK_SEC,
  LONG_BREAK_EVERY,
  MAX_AUTO_FINALIZE_ITERATIONS,
  focusSessionsUntilLongBreak,
};
