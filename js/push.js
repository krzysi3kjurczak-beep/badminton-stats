/**
 * Web Push — rejestracja subskrypcji i wysyłka przez Supabase Edge Function send-push.
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
      const raw = localStorage.getItem(SHOWN_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  function markShown(id) {
    if (id == null) return;
    const ids = getShownIds();
    if (!ids.includes(id)) ids.push(id);
    while (ids.length > 200) ids.shift();
    try {
      localStorage.setItem(SHOWN_KEY, JSON.stringify(ids));
    } catch (_) {}
  }

  function wasShown(id) {
    return id != null && getShownIds().includes(id);
  }

  async function getRegistration() {
    if (!('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.ready;
  }

  async function showViaServiceWorker(title, body, data = {}) {
    const notifId = data.notifId;
    if (wasShown(notifId)) return false;
    markShown(notifId);
    const reg = await getRegistration();
    if (!reg) return false;
    const tag = data.tag || (notifId != null ? `plan-notif-${notifId}` : `plan-${Date.now()}`);
    await reg.showNotification(title, {
      body,
      tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data,
    });
    return true;
  }

  async function requestPermission() {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
  }

  async function subscribePush({ force = false } = {}) {
    const publicKey = cfg().vapidPublicKey;
    if (!publicKey || !isSupported()) return null;
    const reg = await getRegistration();
    if (!reg) return null;
    let sub = await reg.pushManager.getSubscription();
    if (force && sub) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
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

  function pushHeaders() {
    const key = cfg().supabaseAnonKey;
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      apikey: key,
    };
  }

  async function sendWebPush(target, { title, body, data = {} }) {
    const playerIds = Array.isArray(target) ? target : (target?.playerIds || null);
    const subscriptions = Array.isArray(target) ? null : (target?.subscriptions || null);
    const subs = (subscriptions || []).filter(s => s?.endpoint);
    if (!subs.length && !(playerIds && playerIds.length)) return { sent: 0 };
    const c = cfg();
    if (!c.supabaseUrl || !c.supabaseAnonKey) return { sent: 0, error: 'no_config' };
    const bodyJson = {
      playerIds: playerIds || undefined,
      subscriptions: subs.length ? subs : undefined,
      leagueId: 'default',
      title,
      body,
      data,
    };
    try {
      const url = `${c.supabaseUrl}/functions/v1/send-push`;
      const headers = pushHeaders();
      let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(bodyJson) });
      let json = await res.json().catch(() => ({}));
      if (json.error === 'no_subscriptions' && playerIds?.length) {
        await new Promise(r => setTimeout(r, 600));
        res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(bodyJson) });
        json = await res.json().catch(() => ({}));
      }
      if (!res.ok) return { sent: 0, error: json.error || String(res.status) };
      return { sent: json.sent || 0, error: json.error, errors: json.errors };
    } catch (e) {
      return { sent: 0, error: String(e) };
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
    wasShown,
  };
})();
