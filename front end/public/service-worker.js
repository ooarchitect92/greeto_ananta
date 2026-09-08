self.addEventListener('install', function(event) {
    self.skipWaiting();
    console.log('[Service Worker] Installed.');
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
    console.log('[Service Worker] Activated.');
});

self.addEventListener('push', function(event) {
    console.log('[Service Worker] Push Received.');
    if (event.data) {
        try {
            const data = event.data.json();
            console.log('[Service Worker] Push Data:', data);
            
            const options = {
                body: data.body,
                icon: data.icon || '/logo192.png',
                badge: data.badge || '/badge.png',
                data: data.data,
                vibrate: [100, 50, 100],
                actions: [
                    { action: 'open', title: 'Open App' }
                ]
            };

            event.waitUntil(
                self.registration.showNotification(data.title, options)
                    .then(() => console.log('[Service Worker] Notification shown.'))
                    .catch(err => console.error('[Service Worker] showNotification failed:', err))
            );
        } catch (e) {
            console.error('[Service Worker] Error parsing push data:', e);
        }
    } else {
        console.warn('[Service Worker] Push event but no data.');
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();

    const urlToOpen = event.notification.data.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(windowClients) {
                // Check if there is already a window tab open with the target URL
                for (let i = 0; i < windowClients.length; i++) {
                    let client = windowClients[i];
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If no window tab is open, open a new one
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
    );
});
