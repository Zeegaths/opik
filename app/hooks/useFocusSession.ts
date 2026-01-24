// hooks/useFocusSession.ts
import { useState, useEffect, useRef, useCallback } from 'react';

interface FocusSessionConfig {
  userId: string;
  onBreakReminder?: () => void;
  onSessionComplete?: (duration: number) => void;
  onDistraction?: (type: string) => void;
}

interface FocusStats {
  totalFocusTime: number;
  sessionsToday: number;
  longestSession: number;
  distractions: number;
}

// Audio notification URLs (using Web Audio API for reliability)
const SOUNDS = {
  breakReminder: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', // Gentle chime
  sessionStart: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // Start bell
  sessionEnd: 'https://assets.mixkit.co/active_storage/sfx/1862/1862-preview.mp3', // Completion sound
  warning: 'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3', // Soft alert
};

export function useFocusSession({ 
  userId, 
  onBreakReminder, 
  onSessionComplete,
  onDistraction 
}: FocusSessionConfig) {
  // Session state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [sessionGoal, setSessionGoal] = useState(25 * 60); // Default 25 min (Pomodoro)
  const [breaksDue, setBreaksDue] = useState(0);
  
  // Focus lock state
  const [focusLockEnabled, setFocusLockEnabled] = useState(false);
  const [showExitWarning, setShowExitWarning] = useState(false);
  
  // Stats
  const [stats, setStats] = useState<FocusStats>({
    totalFocusTime: 0,
    sessionsToday: 0,
    longestSession: 0,
    distractions: 0,
  });

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastActiveRef = useRef<number>(Date.now());
  const visibilityRef = useRef<boolean>(true);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = 0.5;
    
    // Load stats from localStorage
    const savedStats = localStorage.getItem(`focus_stats_${userId}`);
    if (savedStats) {
      const parsed = JSON.parse(savedStats);
      // Reset if it's a new day
      const today = new Date().toDateString();
      if (parsed.date === today) {
        setStats(parsed.stats);
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [userId]);

  // Play sound helper
  const playSound = useCallback((soundType: keyof typeof SOUNDS) => {
    if (audioRef.current) {
      audioRef.current.src = SOUNDS[soundType];
      audioRef.current.play().catch(e => {
        console.log('Audio play failed (user interaction required):', e);
      });
    }
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // Send browser notification
  const sendNotification = useCallback((title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'focus-session',
        requireInteraction: true,
      });
    }
  }, []);

  // Visibility change detection (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      
      if (isRunning && !isPaused && focusLockEnabled) {
        if (!isVisible) {
          // User switched away
          visibilityRef.current = false;
          
          // Track as distraction after 5 seconds
          setTimeout(() => {
            if (!visibilityRef.current && isRunning) {
              setStats(prev => ({ ...prev, distractions: prev.distractions + 1 }));
              onDistraction?.('tab_switch');
              playSound('warning');
            }
          }, 5000);
        } else {
          visibilityRef.current = true;
          
          // Show warning if they were away
          if (!visibilityRef.current) {
            setShowExitWarning(true);
            setTimeout(() => setShowExitWarning(false), 3000);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, isPaused, focusLockEnabled, onDistraction, playSound]);

  // Before unload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning && focusLockEnabled) {
        e.preventDefault();
        e.returnValue = 'You have an active focus session. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRunning, focusLockEnabled]);

  // Main timer effect
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setFocusSeconds(prev => {
          const newSeconds = prev + 1;
          
          // Check for break reminders (every 25 minutes for Pomodoro, or 90 min for deep work)
          if (newSeconds === sessionGoal) {
            playSound('breakReminder');
            sendNotification('🌱 Break Time!', `You've focused for ${Math.floor(sessionGoal / 60)} minutes. Take a 5-minute break!`);
            onBreakReminder?.();
            setBreaksDue(prev => prev + 1);
          }
          
          // Extended work warning (every 30 min after goal)
          if (newSeconds > sessionGoal && (newSeconds - sessionGoal) % 1800 === 0) {
            playSound('warning');
            sendNotification('⚠️ Extended Focus', 'You\'ve been working past your goal. Consider taking a break!');
          }
          
          return newSeconds;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, sessionGoal, playSound, sendNotification, onBreakReminder]);

  // Start session
  const startSession = useCallback(async (goalMinutes: number = 25) => {
    await requestNotificationPermission();
    
    setSessionGoal(goalMinutes * 60);
    setFocusSeconds(0);
    setBreaksDue(0);
    setIsRunning(true);
    setIsPaused(false);
    
    playSound('sessionStart');
    sendNotification('🎯 Focus Session Started', `${goalMinutes} minute session. Let's build!`);
    
    setStats(prev => ({
      ...prev,
      sessionsToday: prev.sessionsToday + 1,
    }));
  }, [playSound, sendNotification, requestNotificationPermission]);

  // Pause session
  const pauseSession = useCallback(() => {
    setIsPaused(true);
    playSound('warning');
  }, [playSound]);

  // Resume session
  const resumeSession = useCallback(() => {
    setIsPaused(false);
    playSound('sessionStart');
  }, [playSound]);

  // End session
  const endSession = useCallback(() => {
    const duration = focusSeconds;
    
    setIsRunning(false);
    setIsPaused(false);
    
    if (duration > 60) { // Only count sessions > 1 minute
      playSound('sessionEnd');
      sendNotification('✅ Session Complete!', `Great work! You focused for ${Math.floor(duration / 60)} minutes.`);
      
      setStats(prev => {
        const newStats = {
          ...prev,
          totalFocusTime: prev.totalFocusTime + duration,
          longestSession: Math.max(prev.longestSession, duration),
        };
        
        // Save to localStorage
        localStorage.setItem(`focus_stats_${userId}`, JSON.stringify({
          date: new Date().toDateString(),
          stats: newStats,
        }));
        
        return newStats;
      });
      
      onSessionComplete?.(duration);
    }
    
    setFocusSeconds(0);
    setBreaksDue(0);
  }, [focusSeconds, userId, playSound, sendNotification, onSessionComplete]);

  // Take break (pause + reset timer)
  const takeBreak = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setFocusSeconds(0);
    setBreaksDue(0);
    playSound('breakReminder');
  }, [playSound]);

  // Toggle focus lock
  const toggleFocusLock = useCallback(() => {
    setFocusLockEnabled(prev => !prev);
  }, []);

  // Format time helper
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Progress percentage
  const progress = sessionGoal > 0 ? Math.min(100, (focusSeconds / sessionGoal) * 100) : 0;

  return {
    // State
    isRunning,
    isPaused,
    focusSeconds,
    sessionGoal,
    breaksDue,
    focusLockEnabled,
    showExitWarning,
    stats,
    progress,
    
    // Actions
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    takeBreak,
    toggleFocusLock,
    setSessionGoal,
    
    // Helpers
    formatTime,
    playSound,
  };
}