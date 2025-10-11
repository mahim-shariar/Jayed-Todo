// Service Worker for ChronoTask Pro PWA
const CACHE_NAME = "chronotask-pro-v1.3.0";
const urlsToCache = [
  "/",
  "/index.html",
  "/static/js/bundle.js",
  "/static/css/main.css",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/urgent.png",
  "/icons/warning.png",
  "/icons/reminder.png",
  "/icons/completed.png",
];

// Install event - cache essential files
self.addEventListener("install", (event) => {
  console.log("ChronoTask Pro: Service Worker installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("ChronoTask Pro: Opened cache");
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log("ChronoTask Pro: All resources cached successfully");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.log("ChronoTask Pro: Cache installation failed:", error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("ChronoTask Pro: Service Worker activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("ChronoTask Pro: Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("ChronoTask Pro: Service Worker activated");
        return self.clients.claim();
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests and chrome-extension requests
  if (
    event.request.method !== "GET" ||
    event.request.url.startsWith("chrome-extension")
  ) {
    return;
  }

  event.respondWith(
    caches
      .match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }

        return fetch(event.request).then((response) => {
          // Check if we received a valid response
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, show offline page
        if (event.request.destination === "document") {
          return caches.match("/");
        }
      })
  );
});

// Push event - handle push notifications
self.addEventListener("push", (event) => {
  console.log("ChronoTask Pro: Push event received", event);

  if (!event.data) {
    console.log("ChronoTask Pro: Push event has no data");
    return;
  }

  let data = {};
  try {
    data = event.data.json();
    console.log("ChronoTask Pro: Push data parsed:", data);
  } catch (error) {
    console.log(
      "ChronoTask Pro: Push data is not JSON, using text:",
      event.data.text()
    );
    data = {
      title: "ChronoTask Pro",
      body: event.data.text() || "New notification",
      icon: "/icons/icon-192.png",
    };
  }

  const options = {
    body: data.body || "Task reminder",
    icon: data.icon || "/icons/icon-192.png",
    badge: "/icons/icon-72.png",
    tag: data.tag || "chronotask-reminder",
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      {
        action: "view",
        title: "View Task",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
    data: data.data || {},
  };

  // Add vibration pattern for mobile devices if available
  if (data.vibrate) {
    options.vibrate = data.vibrate;
  }

  event.waitUntil(
    self.registration
      .showNotification(data.title || "ChronoTask Pro", options)
      .then(() => {
        console.log("ChronoTask Pro: Notification shown successfully");
      })
      .catch((error) => {
        console.error("ChronoTask Pro: Failed to show notification:", error);
      })
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("ChronoTask Pro: Notification clicked", event);

  event.notification.close();

  const action = event.action;
  const notificationData = event.notification.data;

  if (action === "dismiss") {
    console.log("ChronoTask Pro: Notification dismissed");
    return;
  }

  // Default action - focus or open the app
  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();

            // Send message to the client about which notification was clicked
            if (notificationData && notificationData.taskId) {
              client.postMessage({
                type: "NOTIFICATION_CLICKED",
                taskId: notificationData.taskId,
                action: action,
              });
            }

            return;
          }
        }

        // If no window is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow("/");
        }
      })
  );
});

// Notification close event
self.addEventListener("notificationclose", (event) => {
  console.log("ChronoTask Pro: Notification closed", event);
});

// Handle messages from the main app
self.addEventListener("message", (event) => {
  console.log(
    "ChronoTask Pro: Message received in service worker:",
    event.data
  );

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "TEST_NOTIFICATION") {
    // Test notification from the main app
    self.registration.showNotification("Test Notification", {
      body: "This is a test notification from the service worker",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      tag: "test-notification",
      requireInteraction: true,
    });
  }
});

// Handle background sync for offline task creation
self.addEventListener("sync", (event) => {
  if (event.tag === "background-task-sync") {
    console.log("ChronoTask Pro: Background sync triggered");
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    console.log("ChronoTask Pro: Performing background sync...");

    // Show a notification to indicate background sync is happening
    await self.registration.showNotification("ChronoTask Pro", {
      body: "Syncing your tasks in the background...",
      icon: "/icons/icon-192.png",
      tag: "background-sync",
      silent: true,
    });

    // Implement your actual sync logic here
    // For example, sync pending tasks with server
  } catch (error) {
    console.error("ChronoTask Pro: Background sync failed:", error);
  }
}

// Periodic sync for background updates (if supported)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "periodic-task-updates") {
    console.log("ChronoTask Pro: Periodic sync triggered");
    event.waitUntil(doPeriodicSync());
  }
});

async function doPeriodicSync() {
  console.log("ChronoTask Pro: Performing periodic sync...");
  // Check for due tasks and show notifications
}
