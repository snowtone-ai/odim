self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("push", (event) => {
  let payload = { title: "Odim critical alert", body: "New critical alert available.", tag: "odim-critical" };
  try {
    const data = event.data?.json();
    if (data && typeof data.title === "string") payload = data;
  } catch {}
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: "/odim-logo.png",
      data: { href: "/alerts" }
    })
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.href || "/alerts"));
});
self.addEventListener("message", (event) => {
  const payload = event.data;
  if (!payload || payload.type !== "show-notification") return;
  self.registration.showNotification(payload.title, payload.options || {});
});
