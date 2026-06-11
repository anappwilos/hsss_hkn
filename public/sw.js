self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SHOW_NOTIFICATION') {
    return;
  }

  const title = event.data.title || 'AdoraPlus';
  const options = {
    body: event.data.body || '',
    tag: event.data.tag,
    icon: '/favicon.svg',
    badge: '/favicon.svg'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('fetch', () => {
  return;
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);

      if (existing) {
        return existing.focus();
      }

      return self.clients.openWindow('/');
    })
  );
});
