import { useEffect } from 'react';

export function useExtensionNotifications() {
  const isExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

  const sendNotification = (title: string, message: string) => {
    if (isExtension) {
      chrome.runtime.sendMessage({
        type: 'LOW_ENERGY_ALERT',
        title,
        message
      }).catch(err => console.error('Notification error:', err));
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }
  };

  const requestPermission = async () => {
    if (!isExtension && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    requestPermission();
  }, []);

  return {
    sendNotification,
    isExtension
  };
}