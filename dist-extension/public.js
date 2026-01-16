// Background service worker for notifications and alarms
chrome.runtime.onInstalled.addListener(() => {
  console.log('Builder Uptime extension installed');
  
  // Set up periodic wellness checks
  chrome.alarms.create('wellness-check', { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'wellness-check') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-48.png',
      title: 'Builder Uptime Check-in',
      message: 'How are you feeling? Log your energy level.',
      priority: 2
    });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LOW_ENERGY_ALERT') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-48.png',
      title: '🚨 Low Energy Detected',
      message: request.message || 'Take a 15-minute break to stay sustainable.',
      priority: 2
    });
    sendResponse({ success: true });
  }
  return true;
});