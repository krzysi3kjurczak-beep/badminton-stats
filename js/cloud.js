/**
 * Chmura Supabase — logowanie i synchronizacja stanu aplikacji.
 * Wymaga: config.js + biblioteka @supabase/supabase-js (CDN w index.html).
 */
(function () {
  const SYNC_META_KEY = 'badminton-sync-meta';
  const PUSH_DEBOUNCE_MS = 1200;

  let client = null;
  let hooks = null;
  let pushTimer = null;
  let currentUser = null;
  let syncStatus = 'idle'; // idle | syncing | synced | error | offline | unconfigured

  function cfg() {
    return window.APP_CONFIG || {};
  }

  function isConfigured() {
    const c = cfg();
    if (!c.supabaseUrl || !c.supabaseAnonKey) return false;
    if (c.supabaseUrl.includes('TWOJ-PROJEKT') || c.supabaseAnonKey.includes('TWOJ-ANON')) return false;
    return c.supabaseUrl.includes('supabase.co');
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!window.supabase?.createClient) return null;
    if (!client) {
      client = window.supabase.createClient(cfg().supabaseUrl, cfg().supabaseAnonKey);
    }
    return client;
  }

  function getSyncMeta() {
    try {
      const raw = localStorage.getItem(SYNC_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function setSyncMeta(patch) {
    const next = { ...getSyncMeta(), ...patch };
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(next));
  }

  function setStatus(status, detail) {
    syncStatus = status;
    if (hooks?.onStatusChange) hooks.onStatusChange(status, detail);
  }

  function authRedirectUrl() {
    return window.location.origin + window.location.pathname;
  }

  async function init(appHooks) {
    hooks = appHooks;
    if (!isConfigured()) {
      setStatus('unconfigured');
      return { configured: false, session: null };
    }

    const sb = getClient();
    if (!sb) {
      setStatus('error', 'Brak biblioteki Supabase');
      return { configured: false, session: null, error: 'sdk' };
    }

    const { data: { session }, error } = await sb.auth.getSession();
    if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
      window.history.replaceState({}, document.title, authRedirectUrl());
    }
    if (error) {
      setStatus('error', error.message);
      return { configured: true, session: null, error: error.message };
    }

    currentUser = session?.user || null;

    sb.auth.onAuthStateChange(async (event, sess) => {
      currentUser = sess?.user || null;
      if (event === 'SIGNED_IN' && sess?.user) {
        await syncAfterLogin();
        if (hooks?.onAuthChange) hooks.onAuthChange(sess.user, true);
      }
      if (event === 'SIGNED_OUT') {
        setStatus('idle');
        if (hooks?.onAuthChange) hooks.onAuthChange(null, false);
      }
    });

    if (session?.user) {
      await syncAfterLogin();
    }

    return { configured: true, session };
  }

  async function signInWithGoogle() {
    const sb = getClient();
    if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana');
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: authRedirectUrl() },
    });
    if (error) throw error;
  }

  async function signUpWithEmail(email, password) {
    const sb = getClient();
    if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana');
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error) throw error;
    if (data.session) {
      currentUser = data.user;
      await syncAfterLogin();
    }
    return data;
  }

  async function signInWithEmail(email, password) {
    const sb = getClient();
    if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana');
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    currentUser = data.user;
    await syncAfterLogin();
    return data;
  }

  async function signOut() {
    const sb = getClient();
    if (sb) await sb.auth.signOut();
    currentUser = null;
    setStatus('idle');
  }

  async function verifyPassword(email, password) {
    const sb = getClient();
    if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana');
    const { error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    const { data: { user } } = await sb.auth.getUser();
    currentUser = user;
  }

  async function deleteAccount() {
    const sb = getClient();
    if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana');
    const { error } = await sb.rpc('delete_account');
    if (error) throw error;
    await sb.auth.signOut();
    currentUser = null;
    setStatus('idle');
  }

  function getAuthProvider() {
    if (!currentUser) return null;
    const identities = currentUser.identities || [];
    if (identities.some(i => i.provider === 'google')) return 'google';
    if (identities.some(i => i.provider === 'email')) return 'email';
    return currentUser.app_metadata?.provider || 'email';
  }

  async function manualSync() {
    await syncAfterLogin();
    const status = getStatus();
    if (status !== 'error' && status !== 'offline' && navigator.onLine) {
      await flushPush();
    }
    return getStatus();
  }

  function parseCloudTime(iso) {
    return iso ? Date.parse(iso) : 0;
  }

  async function pullFromCloud(userId) {
    const sb = getClient();
    const { data, error } = await sb
      .from('app_state')
      .select('payload, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function pushToCloud(userId, payload) {
    const sb = getClient();
    const updatedAt = new Date().toISOString();
    const { error } = await sb.from('app_state').upsert({
      user_id: userId,
      payload,
      updated_at: updatedAt,
    });
    if (error) throw error;
    setSyncMeta({
      lastPushedAt: Date.now(),
      cloudUpdatedAt: updatedAt,
    });
    return updatedAt;
  }

  async function syncAfterLogin() {
    if (!hooks?.getState || !hooks?.applyState) return;
    const sb = getClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    currentUser = user;
    setStatus('syncing');

    try {
      const localState = hooks.getState();
      const meta = getSyncMeta();
      const localUpdatedAt = meta.localUpdatedAt || 0;
      const cloudRow = await pullFromCloud(user.id);

      if (!cloudRow?.payload || Object.keys(cloudRow.payload).length === 0) {
        await pushToCloud(user.id, localState);
        setStatus('synced');
        return;
      }

      const cloudUpdatedAt = parseCloudTime(cloudRow.updated_at);
      const cloudHasData = cloudRow.payload?.matches?.length > 0
        || cloudRow.payload?.players?.length > 0;

      if (cloudUpdatedAt > localUpdatedAt && cloudHasData) {
        hooks.applyState(cloudRow.payload);
        setSyncMeta({
          cloudUpdatedAt: cloudRow.updated_at,
          lastPulledAt: Date.now(),
        });
      } else if (localUpdatedAt >= cloudUpdatedAt) {
        await pushToCloud(user.id, localState);
      }

      setStatus('synced');
    } catch (err) {
      if (!navigator.onLine) setStatus('offline');
      else setStatus('error', err.message || 'Błąd synchronizacji');
    }
  }

  function schedulePush() {
    if (!currentUser || !hooks?.getState) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      flushPush().catch(() => {});
    }, PUSH_DEBOUNCE_MS);
  }

  async function flushPush() {
    if (!currentUser || !hooks?.getState) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    setStatus('syncing');
    try {
      const payload = hooks.getState();
      await pushToCloud(currentUser.id, payload);
      setStatus('synced');
    } catch (err) {
      setStatus('error', err.message || 'Błąd zapisu');
    }
  }

  function touchLocalSave() {
    setSyncMeta({ localUpdatedAt: Date.now() });
  }

  function getUser() {
    return currentUser;
  }

  function getStatus() {
    return syncStatus;
  }

  function statusLabel() {
    switch (syncStatus) {
      case 'synced': return 'Zsynchronizowano';
      case 'syncing': return 'Synchronizacja…';
      case 'offline': return 'Offline — zapis lokalny';
      case 'error': return 'Błąd synchronizacji';
      case 'unconfigured': return 'Chmura nie skonfigurowana';
      default: return '';
    }
  }

  window.BadmintonCloud = {
    init,
    isConfigured,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    verifyPassword,
    deleteAccount,
    getAuthProvider,
    manualSync,
    syncAfterLogin,
    schedulePush,
    flushPush,
    touchLocalSave,
    getUser,
    getStatus,
    statusLabel,
  };
})();
