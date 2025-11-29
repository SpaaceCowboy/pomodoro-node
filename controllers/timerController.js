//store timer state

let timerState = {
    isRunning: false,
    isFocus: true,
    timeLeft: 25 * 60,
    totalSessions: 0,
    consecutiveSessions: 0,
    lastUpdated: Date.now()
  };
  
  // Calculate current state with elapsed time
  const getCurrentState = () => {
    const state = { ...timerState };
    
    if (state.isRunning) {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - state.lastUpdated) / 1000);
      
      if (elapsedSeconds > 0) {
        state.timeLeft = Math.max(0, state.timeLeft - elapsedSeconds);
        state.lastUpdated = now;
        
        // Timer completed
        if (state.timeLeft <= 0) {
          state.isRunning = false;
          
          if (state.isFocus) {
            // Focus completed - switch to break
            state.isFocus = false;
            state.totalSessions += 1;
            state.consecutiveSessions += 1;
            
            if (state.consecutiveSessions >= 4) {
              state.timeLeft = 15 * 60; // Long break
              state.consecutiveSessions = 0;
            } else {
              state.timeLeft = 5 * 60; // Short break
            }
          } else {
            // Break completed - switch to focus
            state.isFocus = true;
            state.timeLeft = 25 * 60;
          }
        }
      }
    }
    
    return state;
  };
  
  // Update stored state
  const updateState = (newState) => {
    timerState = { ...newState };
  };
//controller

exports.getHealth = (req, res, next) => {
    const currentState = getCurrentState();
    res.json({ 
      message: 'Backend is working!',
      timestamp: new Date().toISOString(),
      state: currentState
    })
}

exports.getState = (req, res, next) => {
    const currentState = getCurrentState();
    updateState(currentState)
    res.json(currentState)
}

exports.postStart = (req, res, next) => {
    const currentState = getCurrentState();
    currentState.isRunning = true;
    currentState.lastUpdated = Date.now();
    updateState(currentState);
    res.json({ success: true, state: currentState });
}

exports.postPause = (req, res, next) => {
    const currentState = getCurrentState();
    currentState.isRunning = false;
    currentState.lastUpdated = Date.now();
    updateState(currentState);
    res.json({
        success: true,
        state: currentState
    })
}

exports.postReset = (req, res, next) => {
    const currentState = getCurrentState()
    currentState.isRunning = false;
    currentState.timeLeft = currentState.isFocus ? 25 * 60 : 5 * 60;
    updateState(currentState);
    res.json({
        success: true,
        state: currentState
    })
}

exports.postSwitch = (req, res, next) => {
    const currentState = getCurrentState();
    currentState.isFocus = !currentState.isFocus;
    currentState.timeLeft = false; 
    currentState.lastUpdated = Date.now() 
    
  // The increment happens in getCurrentState() when timeLeft reaches 0
  
  updateState(currentState);
  res.json({ success: true, state: currentState });
};


exports.getStats = (req, res, next) => {
    const currentState = getCurrentState()
    const stats = {
        totalSessions: currentState.totalSessions,
        consecutiveSessions: currentState.consecutiveSessions,
        nextLongBreak: Math.max(0, 4 - currentState.consecutiveSessions),
        isLongBreakNext: currentState.consecutiveSessions >= 3
    }
    res.json(stats)
}

