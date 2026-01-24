import { useState } from 'react';
import { useFocusSession } from '~/hooks/useFocusSession';

interface FocusSessionProps {
  userId: string;
  onWellnessLog?: (focusMinutes: number) => void;
}

const SESSION_PRESETS = [
  { label: 'Quick Focus', minutes: 15, emoji: '⚡', description: 'Short burst' },
  { label: 'Pomodoro', minutes: 25, emoji: '🍅', description: 'Classic technique' },
  { label: 'Deep Work', minutes: 50, emoji: '🧠', description: 'Extended focus' },
  { label: 'Flow State', minutes: 90, emoji: '🌊', description: 'Maximum depth' },
];

export function FocusSession({ userId, onWellnessLog }: FocusSessionProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);

  const {
    isRunning,
    isPaused,
    focusSeconds,
    sessionGoal,
    breaksDue,
    focusLockEnabled,
    showExitWarning,
    stats,
    progress,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    takeBreak,
    toggleFocusLock,
    formatTime,
  } = useFocusSession({
    userId,
    onBreakReminder: () => {
      // Could trigger a modal or notification
      console.log('Break reminder triggered!');
    },
    onSessionComplete: (duration) => {
      onWellnessLog?.(Math.floor(duration / 60));
    },
    onDistraction: (type) => {
      console.log('Distraction detected:', type);
    },
  });

  const remainingSeconds = Math.max(0, sessionGoal - focusSeconds);
  const isOvertime = focusSeconds > sessionGoal;

  return (
    <div className="relative">
      {/* Exit Warning Overlay */}
      {showExitWarning && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg">
            🎯 Stay focused! You're doing great!
          </div>
        </div>
      )}

      <div className={`group relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 border rounded-2xl p-5 md:p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-xl ${
        isRunning 
          ? isOvertime 
            ? 'border-orange-500/50 hover:shadow-orange-500/10' 
            : 'border-cyan-500/50 hover:shadow-cyan-500/10'
          : 'border-gray-700/50 hover:border-gray-600'
      }`}>
        
        {/* Focus Lock Indicator */}
        {focusLockEnabled && isRunning && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-500 rounded-full animate-pulse" title="Focus Lock Active" />
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="text-xs font-semibold text-gray-400 tracking-wide uppercase">
              Focus Session
            </div>
            {isRunning && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isOvertime 
                  ? 'bg-orange-500/20 text-orange-400' 
                  : 'bg-cyan-500/20 text-cyan-400'
              }`}>
                {isOvertime ? '⚡ Overtime' : '🎯 Active'}
              </span>
            )}
          </div>
          
          {/* Focus Lock Toggle */}
          <button
            onClick={toggleFocusLock}
            className={`p-2 rounded-lg transition-all text-sm ${
              focusLockEnabled
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-gray-500 hover:text-gray-400 hover:bg-gray-800'
            }`}
            title={focusLockEnabled ? 'Focus Lock ON' : 'Focus Lock OFF'}
          >
            {focusLockEnabled ? '🔒' : '🔓'}
          </button>
        </div>

        {/* Timer Display */}
        {isRunning ? (
          <div className="text-center mb-6">
            {/* Circular Progress */}
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-800"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="url(#focusGradient)"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 58}`}
                  strokeDashoffset={`${2 * Math.PI * 58 * (1 - Math.min(progress, 100) / 100)}`}
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="focusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={isOvertime ? '#f97316' : '#06b6d4'} />
                    <stop offset="100%" stopColor={isOvertime ? '#ef4444' : '#3b82f6'} />
                  </linearGradient>
                </defs>
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-black ${isOvertime ? 'text-orange-400' : 'text-cyan-400'}`}>
                  {isOvertime ? '+' : ''}{formatTime(isOvertime ? focusSeconds - sessionGoal : remainingSeconds)}
                </span>
                <span className="text-xs text-gray-500">
                  {isOvertime ? 'overtime' : 'remaining'}
                </span>
              </div>
            </div>

            {/* Session Info */}
            <div className="flex items-center justify-center gap-4 text-sm mb-4">
              <div className="text-gray-400">
                <span className="text-cyan-400 font-bold">{formatTime(focusSeconds)}</span> focused
              </div>
              {breaksDue > 0 && (
                <div className="text-orange-400">
                  {breaksDue} break{breaksDue > 1 ? 's' : ''} due
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="flex gap-2 justify-center">
              {isPaused ? (
                <button
                  onClick={resumeSession}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg"
                >
                  ▶ Resume
                </button>
              ) : (
                <button
                  onClick={pauseSession}
                  className="px-6 py-2.5 bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/50 rounded-xl font-bold hover:from-orange-500/30 hover:to-red-500/30 transition-all"
                >
                  ⏸ Pause
                </button>
              )}
              
              <button
                onClick={endSession}
                className="px-4 py-2.5 bg-gray-800 text-gray-400 rounded-xl font-medium hover:bg-gray-700 hover:text-gray-300 transition-all"
              >
                ⏹ End
              </button>

              {breaksDue > 0 && (
                <button
                  onClick={takeBreak}
                  className="px-4 py-2.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/50 rounded-xl font-bold hover:from-green-500/30 hover:to-emerald-500/30 transition-all animate-pulse"
                >
                  🌱 Break
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Start Session UI */
          <div>
            {showPresets ? (
              /* Session Presets */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {SESSION_PRESETS.map((preset) => (
                    <button
                      key={preset.minutes}
                      onClick={() => startSession(preset.minutes)}
                      className="p-3 bg-black/40 border border-gray-700 rounded-xl hover:border-cyan-500/50 hover:bg-black/60 transition-all group"
                    >
                      <div className="text-2xl mb-1">{preset.emoji}</div>
                      <div className="text-sm font-bold text-gray-200 group-hover:text-cyan-400 transition-colors">
                        {preset.label}
                      </div>
                      <div className="text-xs text-gray-500">{preset.minutes} min</div>
                    </button>
                  ))}
                </div>

                {/* Custom Duration */}
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(parseInt(e.target.value) || 25)}
                    className="flex-1 px-3 py-2 bg-black/50 border border-gray-700 rounded-lg text-center text-sm focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-gray-500 text-sm">min</span>
                  <button
                    onClick={() => startSession(customMinutes)}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-lg text-sm font-bold text-purple-400 hover:from-purple-500/30 hover:to-pink-500/30 transition-all"
                  >
                    Custom
                  </button>
                </div>

                <button
                  onClick={() => setShowPresets(false)}
                  className="w-full text-sm text-gray-500 hover:text-gray-400 py-2"
                >
                  Cancel
                </button>
              </div>
            ) : (
              /* Start Button */
              <div className="text-center">
                <div className="mb-4">
                  <div className="text-5xl mb-2">🎯</div>
                  <p className="text-gray-400 text-sm">Ready to focus?</p>
                </div>
                
                <button
                  onClick={() => setShowPresets(true)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02]"
                >
                  ▶ Start Focus Session
                </button>

                {/* Quick Stats */}
                {stats.sessionsToday > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700/50 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-cyan-400">{stats.sessionsToday}</div>
                      <div className="text-xs text-gray-500">Sessions</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-orange-400">{Math.floor(stats.totalFocusTime / 60)}m</div>
                      <div className="text-xs text-gray-500">Total</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-purple-400">{Math.floor(stats.longestSession / 60)}m</div>
                      <div className="text-xs text-gray-500">Best</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Focus Lock Info */}
        {focusLockEnabled && (
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="text-cyan-400">🔒</span>
              <span>Focus Lock: You'll be reminded if you switch tabs</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}