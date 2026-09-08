import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

function getAuthConfig() {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

/**
 * Utility to convert base64 to Uint8Array for VAPID key
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers the service worker and returns the registration
 */
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      console.log('Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }
  return null;
}

/**
 * Subscribes the current user to push notifications
 */
export async function subscribeUserToPush() {
  try {
    const permission = await Notification.requestPermission();
    console.log('Notification permission status:', permission);
    if (permission !== 'granted') {
      alert('Notification permission denied. Please enable it in your browser settings.');
      return false;
    }

    const registration = await registerServiceWorker();
    if (!registration) throw new Error('Service Worker not supported');

    // Get public key from server
    const { data: { publicKey } } = await axios.get(
      `${API_BASE}/api/settings/notifications/vapid-public-key`,
      getAuthConfig(),
    );
    if (!publicKey) throw new Error('VAPID Public Key not found');

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    // Save subscription to server
    await axios.post(
      `${API_BASE}/api/settings/notifications/subscribe`,
      { subscription },
      getAuthConfig(),
    );
    
    console.log('User subscribed successfully');
    return true;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return false;
  }
}

/**
 * Checks if the user is already subscribed
 */
export async function checkPushSubscription() {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  }
  return false;
}

/**
 * Unsubscribes the user
 */
export async function unsubscribeUserFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await axios.post(
        `${API_BASE}/api/settings/notifications/unsubscribe`,
        { subscription },
        getAuthConfig(),
      );
    }
    return true;
  } catch (error) {
    console.error('Unsubscribe failed:', error);
    return false;
  }
}
