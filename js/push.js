/**
 * Web Push — rejestracja subskrypcji i wysyłka przez Supabase Edge Function send-push.
 * Wymaga: js/config.js → vapidPublicKey, supabaseUrl, supabaseAnonKey
 * Edge: supabase/functions/send-push + sekrety VAPID_* w Supabase Dashboard
 */
(function () {
  const SHOWN_KEY = 'badminton-plan-push-shown';

  function cfg() {
    return window.APP_CONFIG || {};
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
    return out;
  }

  function isSupported() {
    return !!(typeof navigator !== 'undefined'
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window);
  }

  function getShownIds() {
    try {
      const raw = sessionStorage.getItem(SHOWN_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function markShown(id) {
    if (id == null) return;
    const ids = getShownIds();
    if (!ids.includes(id)) ids.push(id);
    while (ids.length > 120) ids.shift();
    try {
      sessionStorage.setItem(SHOWN_KEY, JSON.stringify(ids));
    } catch (_) {}
  }

  async function getRegistration() {
    if (!('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.ready;
  }

  async function showViaServiceWorker(title, body, data = {}) {
    const reg = await getRegistration();
    if (!reg) return false;
    const tag = data.tag || `plan-${data.notifId || Date.now()}`;
    await reg.showNotification(title, {
      body,
      tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data,
      renotify: true,
    });
    return true;
  }

  async function requestPermission() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
  }

  async function subscribePush() {
    const publicKey = cfg().vapidPublicKey;
    if (!publicKey || !isSupported()) return null;
    const reg = await getRegistration();
    if (!reg) return null;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    return sub ? sub.toJSON() : null;
  }

  async function unsubscribePush() {
    const reg = await getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) await sub.unsubscribe();
  }

  async function sendWebPush(subscriptions, { title, body, data = {} }) {
    const subs = (subscriptions || []).filter(s => s?.endpoint);
    if (!subs.length) return 0;
    const c = cfg();
    if (!c.supabaseUrl || !c.supabaseAnonKey) return 0;
    try {
      const res = await fetch(`${c.supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${c.supabaseAnonKey}`,
        },
        body: JSON.stringify({ subscriptions: subs, title, body, data }),
      });
      if (!res.ok) return 0;
      const json = await res.json().catch(() => ({}));
      return json.sent || 0;
    } catch (_) {
      return 0;
    }
  }

  window.BadmintonPush = {
    isSupported,
    requestPermission,
    subscribePush,
    unsubscribePush,
    sendWebPush,
    showViaServiceWorker,
    getShownIds,
    markShown,
  };
})();
