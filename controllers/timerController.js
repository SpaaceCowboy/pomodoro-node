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
    try {
      // Ensure timerState has all required properties
      if (!timerState || typeof timerState !== 'object') {
        timerState = {
          isRunning: false,
          isFocus: true,
          timeLeft: 25 * 60,
          totalSessions: 0,
          consecutiveSessions: 0,
          lastUpdated: Date.now()
        };
      }
      
      const state = { ...timerState };
      
      // Ensure required properties exist with defaults
      state.isRunning = state.isRunning || false;
      state.isFocus = state.isFocus !== undefined ? state.isFocus : true;
      state.timeLeft = typeof state.timeLeft === 'number' ? state.timeLeft : 25 * 60;
      state.totalSessions = typeof state.totalSessions === 'number' ? state.totalSessions : 0;
      state.consecutiveSessions = typeof state.consecutiveSessions === 'number' ? state.consecutiveSessions : 0;
      state.lastUpdated = typeof state.lastUpdated === 'number' ? state.lastUpdated : Date.now();
      
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
    } catch (error) {
      console.error('Error in getCurrentState:', error);
      // Return a safe default state
      return {
        isRunning: false,
        isFocus: true,
        timeLeft: 25 * 60,
        totalSessions: 0,
        consecutiveSessions: 0,
        lastUpdated: Date.now()
      };
    }
  };
  
  // Update stored state
  const updateState = (newState) => {
    timerState = { ...newState };
  };
//controller

exports.getHealth = (req, res, next) => {
    try {
      const currentState = getCurrentState();
      res.json({ 
        message: 'Backend is working!',
        timestamp: new Date().toISOString(),
        state: currentState
      });
    } catch (error) {
      next(error);
    }
}

exports.getState = (req, res, next) => {
    try {
      const currentState = getCurrentState();
      if (!currentState) {
        throw new Error('Failed to get timer state');
      }
      updateState(currentState);
      res.json(currentState);
    } catch (error) {
      console.error('Error in getState:', error);
      next(error);
    }
}

exports.postStart = (req, res, next) => {
    try {
      const currentState = getCurrentState();
      currentState.isRunning = true;
      currentState.lastUpdated = Date.now();
      updateState(currentState);
      res.json({ success: true, state: currentState });
    } catch (error) {
      next(error);
    }
}

exports.postPause = (req, res, next) => {
    try {
      const currentState = getCurrentState();
      currentState.isRunning = false;
      currentState.lastUpdated = Date.now();
      updateState(currentState);
      res.json({
        success: true,
        state: currentState
      });
    } catch (error) {
      next(error);
    }
}

exports.postReset = (req, res, next) => {
    try {
      const currentState = getCurrentState();
      currentState.isRunning = false;
      currentState.lastUpdated = Date.now();
      
      // Reset to appropriate time based on current mode
      if (currentState.isFocus) {
        currentState.timeLeft = 25 * 60; // Focus session
      } else {
        // Check if it should be a long break based on consecutive sessions
        if (currentState.consecutiveSessions >= 4) {
          currentState.timeLeft = 15 * 60; // Long break
        } else {
          currentState.timeLeft = 5 * 60; // Short break
        }
      }
      
      updateState(currentState);
      res.json({
        success: true,
        state: currentState
      });
    } catch (error) {
      next(error);
    }
}

exports.postSwitch = (req, res, next) => {
    try {
      const currentState = getCurrentState();
      currentState.isRunning = false; // Stop timer when switching
      currentState.isFocus = !currentState.isFocus;
      currentState.lastUpdated = Date.now();

      // Set appropriate time based on new mode
      if (currentState.isFocus) {
        currentState.timeLeft = 25 * 60; // Focus session
        currentState.totalSessions += 1;
      } else {
        // Determine break duration based on consecutive sessions
        if (currentState.consecutiveSessions >= 4) {
          currentState.timeLeft = 15 * 60; // Long break
          currentState.consecutiveSessions = 0;
        } else {
          currentState.timeLeft = 5 * 60; // Short break
        }
      }
      
      updateState(currentState);
      res.json({ success: true, state: currentState });
    } catch (error) {
      next(error);
    }
};


exports.getStats = (req, res, next) => {
    try {
      const currentState = getCurrentState();
      const stats = {
        totalSessions: currentState.totalSessions,
        consecutiveSessions: currentState.consecutiveSessions,
        nextLongBreak: Math.max(0, 4 - currentState.consecutiveSessions),
        isLongBreakNext: currentState.consecutiveSessions >= 3
      };
      res.json(stats);
    } catch (error) {
      next(error);
    }
}

