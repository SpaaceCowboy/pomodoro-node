const TimerState = require('../models/timerState');

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name || '',
    nickname: user.nickname || '',
    avatarDataUrl: user.avatarDataUrl || '',
    username: user.username,
  };
}

function displayName(user) {
  return user.nickname || user.name || user.username;
}

function projectPresence(user, timerState) {
  const nowMs = Date.now();
  let timeLeft = timerState?.remainingSec || 0;
  if (timerState?.isRunning && timerState.startedAt) {
    const elapsedSec = Math.floor((nowMs - timerState.startedAt.getTime()) / 1000);
    timeLeft = Math.max(0, timerState.remainingSec - elapsedSec);
  }

  const isRunning = Boolean(timerState?.isRunning && timeLeft > 0);
  const isFocus = timerState?.mode !== 'break';

  return {
    user: {
      ...safeUser(user),
      displayName: displayName(user),
    },
    isRunning,
    isFocus,
    timeLeft,
    label: isRunning && isFocus ? timerState.currentLabel || '' : '',
    updatedAt: timerState?.updatedAt || null,
  };
}

async function getPresenceForUsers(users) {
  const ids = users.map((user) => user._id);
  const states = await TimerState.find({ user: { $in: ids } }).lean();
  const byUser = new Map(states.map((state) => [state.user.toString(), state]));
  return users.map((user) => projectPresence(user, byUser.get(user._id.toString())));
}

module.exports = {
  safeUser,
  getPresenceForUsers,
};
