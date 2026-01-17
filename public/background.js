// Configuration
const WELLNESS_CHECK_INTERVAL = 60; // minutes
const BREAK_REMINDER_INTERVAL = 90; // minutes
const BACKEND_URL = 'https://scintillating-grace-production.up.railway.app';

let lastActivityTime = Date.now();
let focusStartTime = Date.now();
let dailyFocusMinutes = 0;

// Open app when icon clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'https://opik-liard.vercel.app/' });
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('Builder Uptime extension installed');
  
  // Set up alarms
  chrome.alarms.create('wellness-check', { 
    periodInMinutes: WELLNESS_CHECK_INTERVAL 
  });
  
  chrome.alarms.create('break-reminder', { 
    periodInMinutes: BREAK_REMINDER_INTERVAL 
  });
  
  // Initialize storage
  chrome.storage.local.set({
    sessionsToday: 0,
    tasksCompleted: 0,
    lastCheckIn: Date.now()
  });
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wellness-check') {
    sendWellnessCheckNotification();
  } else if (alarm.name === 'break-reminder') {
    sendBreakReminder();
  }
});

// Track user activity
chrome.tabs.onActivated.addListener(() => {
  lastActivityTime = Date.now();
});

chrome.tabs.onUpdated.addListener(() => {
  lastActivityTime = Date.now();
});

// Monitor idle state
chrome.idle.setDetectionInterval(300); // 5 minutes

chrome.idle.onStateChanged.addListener((newState) => {
  if (newState === 'active') {
    focusStartTime = Date.now();
  } else if (newState === 'idle' || newState === 'locked') {
    // Calculate focus time
    const focusTime = (Date.now() - focusStartTime) / 1000 / 60; // minutes
    dailyFocusMinutes += focusTime;
    
    chrome.storage.local.get(['sessionsToday'], (result) => {
      chrome.storage.local.set({
        sessionsToday: (result.sessionsToday || 0) + 1
      });
    });
  }
});

// Send wellness check notification
function sendWellnessCheckNotification() {
  chrome.storage.local.get(['lastCheckIn', 'sessionsToday'], (result) => {
    const hoursSinceLastCheck = (Date.now() - result.lastCheckIn) / 1000 / 60 / 60;
    
    if (hoursSinceLastCheck >= 1) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-48.png',
        title: '💭 Builder Uptime Check-in',
        message: `You've completed ${result.sessionsToday || 0} focus sessions today. How's your energy?`,
        priority: 2,
        buttons: [
          { title: 'Log Wellness' },
          { title: 'Dismiss' }
        ]
      });
      
      chrome.storage.local.set({ lastCheckIn: Date.now() });
    }
  });
}

// Send break reminder
function sendBreakReminder() {
  const focusTime = Math.round(dailyFocusMinutes);
  
  if (focusTime >= 90) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-48.png',
      title: '🌟 Time for a Break!',
      message: `You've focused for ${focusTime} minutes. Take 15 minutes to recharge!`,
      priority: 2,
      buttons: [
        { title: 'Start Break' },
        { title: 'Snooze 15min' }
      ]
    });
  }
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // First button
    chrome.tabs.create({ url: 'https://opik-liard.vercel.app/' });
  } else if (buttonIndex === 1) { // Snooze
    chrome.alarms.create('break-reminder', { 
      delayInMinutes: 15 
    });
  }
  chrome.notifications.clear(notificationId);
});

// Listen for messages from web app
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOW_ENERGY_ALERT') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-48.png',
      title: '🚨 Low Energy Detected',
      message: request.message || 'Your energy is low. Take a break!',
      priority: 2,
      buttons: [{ title: 'Open App' }]
    });
    sendResponse({ success: true });
  }
  
  if (request.type === 'TASK_COMPLETED') {
    chrome.storage.local.get(['tasksCompleted'], (result) => {
      const newCount = (result.tasksCompleted || 0) + 1;
      chrome.storage.local.set({ tasksCompleted: newCount });
      
      // Celebrate milestones
      if (newCount % 5 === 0) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon-48.png',
          title: '🎉 Milestone Reached!',
          message: `You've completed ${newCount} tasks today!`,
          priority: 1
        });
      }
    });
    sendResponse({ success: true });
  }
  
  return true;
});

// Daily reset
chrome.alarms.create('daily-reset', { 
  when: getTomorrowMidnight(),
  periodInMinutes: 24 * 60 
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'daily-reset') {
    chrome.storage.local.set({
      sessionsToday: 0,
      tasksCompleted: 0
    });
    dailyFocusMinutes = 0;
  }
});

function getTomorrowMidnight() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
}