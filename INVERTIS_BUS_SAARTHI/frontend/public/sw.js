self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/logo.png', // The main image shown next to the notification
      badge: '/logo.png', // The tiny icon shown in the Android status bar
      data: {
        url: data.url || '/'
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (event.notification.data.url) {
        let client = null;
        for (let i = 0; i < clientList.length; i++) {
          let c = clientList[i];
          if (c.url.includes(event.notification.data.url) && 'focus' in c) {
            client = c;
            break;
          }
        }
        if (client) {
          return client.focus();
        }
        if (clients.openWindow) {
          // ensure the full url is opened or relative
          const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
          return clients.openWindow(urlToOpen);
        }
      }
    })
  );
});
