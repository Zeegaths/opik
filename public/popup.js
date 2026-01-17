// Load stats from storage
chrome.storage.local.get([
  'tasksCompleted', 
  'sessionsToday', 
  'dailyFocusMinutes'
], (result) => {
  // Update UI with stored data
  document.getElementById('tasks-today').textContent = 
    result.tasksCompleted || 0;
  
  const focusHours = Math.round((result.dailyFocusMinutes || 0) / 60 * 10) / 10;
  document.getElementById('focus-time').textContent = 
    focusHours + 'h';
});

// Open main app
document.getElementById('open-app').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://opik-liard.vercel.app/' });
  window.close();
});

// Quick check-in
document.getElementById('quick-checkin').addEventListener('click', () => {
  chrome.tabs.create({ 
    url: 'https://opik-liard.vercel.app/#checkin' 
  });
  window.close();
});

// Quick actions
document.getElementById('view-stats').addEventListener('click', () => {
  chrome.tabs.create({ 
    url: 'https://opik-liard.vercel.app/#stats' 
  });
  window.close();
});

document.getElementById('settings').addEventListener('click', () => {
  chrome.tabs.create({ 
    url: 'https://opik-liard.vercel.app/#settings' 
  });
  window.close();
});

document.getElementById('help').addEventListener('click', () => {
  chrome.tabs.create({ 
    url: 'https://opik-liard.vercel.app/#help' 
  });
  window.close();
});

// Update status based on time
const hour = new Date().getHours();
const statusText = document.getElementById('status-text');

if (hour >= 22 || hour < 6) {
  statusText.textContent = 'Rest Time 💤';
} else if (hour >= 6 && hour < 12) {
  statusText.textContent = 'Morning Flow ☀️';
} else if (hour >= 12 && hour < 18) {
  statusText.textContent = 'Afternoon Sprint 🚀';
} else {
  statusText.textContent = 'Evening Wind-down 🌙';
}