/**
 * Chmura Supabase — logowanie, profil użytkownika (app_state) i wspólna liga (league_state).
 * Wymaga: config.js + biblioteka @supabase/supabase-js (CDN w index.html).
 */
(function () {
  const SYNC_META_KEY = 'badminton-sync-meta';
  const PUSH_DEBOUNCE_MS = 1200;
  const DEFAULT_LEAGUE_ID = 'default';

  let client = null;
  let hooks = null;
  let pushTimer = null;
  let currentUser = null;
  let syncStatus = 'idle';
  let leagueChannel = null;
  let applyingRemoteLeague = false;

  function cfg() {
    return window.APP_CONFIG || {};
  }

  function leagueId() {
    return cfg().leagueId || DEFAULT_LEAGUE_ID;
  }

  function isConfigured() {
    const c = cfg();
    if (!c.supabaseUrl || !c.supabaseAnonKey) return false;
    if (c.supabaseUrl.includes('TWOJ-PROJEKT') || c.supabaseAnonKey.includes('TWOJ-ANON')) return false;
    return c.supabaseUrl.includes('supabase.co');
  }

  function isReady() {
    return isConfigured() && !!getClient();
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

  function parseCloudTime(iso) {
    return iso ? Date.parse(iso) : 0;
  }

  function isEmptyLeaguePayload(payload) {
    if (!payload || typeof payload !== 'object') return true;
    return !(payload.matches?.length > 0 || payload.players?.length > 0 || payload.teams?.length > 0);
  }

  function extractLeagueFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return {
      stateVersion: payload.stateVersion || 1,
      players: payload.players || [],
      teams: payload.teams || [],
      matches: payload.matches || [],
    };
  }

  function extractUserFromPayload(payload) {
    if (!payload?.userSession) return null;
    return {
      stateVersion: payload.stateVersion || 1,
      userSession: payload.userSession,
    };
  }

  function getLeagueState() {
    if (hooks?.getLeagueState) return hooks.getLeagueState();
    const full = hooks?.getState?.();
    return extractLeagueFromPayload(full);
  }

  function getUserState() {
    if (hooks?.getUserState) return hooks.getUserState();
    const full = hooks?.getState?.();
    return extractUserFromPayload(full) || { stateVersion: 1, userSession: full?.userSession || {} };
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

  async function pullFromLeague() {
    const sb = getClient();
    const { data, error } = await sb
      .from('league_state')
      .select('payload, updated_at')
      .eq('league_id', leagueId())
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
      lastUserPushedAt: Date.now(),
      userCloudUpdatedAt: updatedAt,
    });
    return updatedAt;
  }

  async function pushToLeague(payload) {
    const sb = getClient();
    const updatedAt = new Date().toISOString();
    const { error } = await sb.from('league_state').upsert({
      league_id: leagueId(),
      payload,
      updated_at: updatedAt,
    });
    if (error) throw error;
    setSyncMeta({
      lastLeaguePushedAt: Date.now(),
      leagueCloudUpdatedAt: updatedAt,
      leagueLocalUpdatedAt: Date.now(),
    });
    return updatedAt;
  }

  function unsubscribeLeague() {
    const sb = getClient();
    if (leagueChannel && sb) {
      sb.removeChannel(leagueChannel);
    }
    leagueChannel = null;
  }

  function subscribeLeagueRealtime() {
    if (!hooks?.applyLeagueState || !currentUser) return;
    const sb = getClient();
    if (!sb) return;
    unsubscribeLeague();

    leagueChannel = sb
      .channel(`league-state-${leagueId()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'league_state',
        filter: `league_id=eq.${leagueId()}`,
      }, payload => {
        const row = payload.new;
        if (!row?.payload) return;
        const meta = getSyncMeta();
        if (row.updated_at && row.updated_at === meta.leagueCloudUpdatedAt) return;
        applyingRemoteLeague = true;
        try {
          hooks.applyLeagueState(row.payload, { merge: true });
          setSyncMeta({
            leagueCloudUpdatedAt: row.updated_at,
            lastLeaguePulledAt: Date.now(),
          });
          if (hooks.onLeagueStateApplied) hooks.onLeagueStateApplied();
          else if (hooks.onStateApplied) hooks.onStateApplied();
        } finally {
          applyingRemoteLeague = false;
        }
      })
      .subscribe();
  }

  async function syncLeagueData(userRow) {
    if (!hooks?.applyLeagueState) return;
    const meta = getSyncMeta();
    const leagueLocalUpdatedAt = meta.leagueLocalUpdatedAt || meta.localUpdatedAt || 0;
    const localLeague = getLeagueState();
    let leagueRow = await pullFromLeague();

    if (!leagueRow?.payload || isEmptyLeaguePayload(leagueRow.payload)) {
      const legacy = extractLeagueFromPayload(userRow?.payload);
      const seed = !isEmptyLeaguePayload(legacy) ? legacy : localLeague;
      if (!isEmptyLeaguePayload(seed)) {
        await pushToLeague(seed);
        hooks.applyLeagueState(seed);
      }
      return;
    }

    const cloudUpdatedAt = parseCloudTime(leagueRow.updated_at);
    const cloudHasData = !isEmptyLeaguePayload(leagueRow.payload);

    if (cloudUpdatedAt > leagueLocalUpdatedAt && cloudHasData) {
      hooks.applyLeagueState(leagueRow.payload, { merge: true });
      setSyncMeta({
        leagueCloudUpdatedAt: leagueRow.updated_at,
        lastLeaguePulledAt: Date.now(),
        leagueLocalUpdatedAt: cloudUpdatedAt,
      });
      if (hooks.onLeagueStateApplied) hooks.onLeagueStateApplied();
    } else if (leagueLocalUpdatedAt >= cloudUpdatedAt && !isEmptyLeaguePayload(localLeague)) {
      await pushToLeague(localLeague);
    }
  }

  async function syncUserData(user) {
    if (!hooks?.applyUserState) return;
    const meta = getSyncMeta();
    const userLocalUpdatedAt = meta.userLocalUpdatedAt || meta.localUpdatedAt || 0;
    const localUser = getUserState();
    const cloudRow = await pullFromCloud(user.id);

    if (!cloudRow?.payload || !cloudRow.payload.userSession) {
      await pushToCloud(user.id, localUser);
      return;
    }

    const cloudUpdatedAt = parseCloudTime(cloudRow.updated_at);
    const cloudUser = extractUserFromPayload(cloudRow.payload);

    if (cloudUpdatedAt > userLocalUpdatedAt && cloudUser) {
      hooks.applyUserState(cloudUser);
      setSyncMeta({
        userCloudUpdatedAt: cloudRow.updated_at,
        lastUserPulledAt: Date.now(),
        userLocalUpdatedAt: cloudUpdatedAt,
      });
    } else if (userLocalUpdatedAt >= cloudUpdatedAt) {
      await pushToCloud(user.id, localUser);
    }

    // Jednorazowa migracja: dane ligi z app_state → league_state (syncLeagueData też to robi)
    if (!isEmptyLeaguePayload(cloudRow.payload) && hooks.applyLeagueState) {
      const leagueRow = await pullFromLeague();
      if (!leagueRow?.payload || isEmptyLeaguePayload(leagueRow.payload)) {
        const legacy = extractLeagueFromPayload(cloudRow.payload);
        if (!isEmptyLeaguePayload(legacy)) {
          await pushToLeague(legacy);
        }
      }
    }
  }

  async function syncAfterLogin() {
    if (!hooks?.getState && !hooks?.getLeagueState) return;
    const sb = getClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    currentUser = user;
    setStatus('syncing');

    try {
      const userRow = await pullFromCloud(user.id);
      await syncLeagueData(userRow);
      await syncUserData(user);
      subscribeLeagueRealtime();
      setStatus('synced');
    } catch (err) {
      if (!navigator.onLine) setStatus('offline');
      else setStatus('error', err.message || 'Błąd synchronizacji');
    }
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
        unsubscribeLeague();
        setStatus('idle');
        if (hooks?.onAuthChange) hooks.onAuthChange(null, false);
      }
    });

    if (session?.user) {
      if (hooks?.skipInitialSync?.()) {
        currentUser = session.user;
        setStatus('idle');
      } else {
        await syncAfterLogin();
      }
    }

    return { configured: true, session };
  }

  async function signInWithGoogle({ selectAccount = false } = {}) {
    const sb = getClient();
    if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana');
    const options = { redirectTo: authRedirectUrl() };
    if (selectAccount) options.queryParams = { prompt: 'select_account' };
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options,
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
    unsubscribeLeague();
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
    unsubscribeLeague();
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

  async function forcePushState() {
    if (!hooks?.getState && !hooks?.getLeagueState) return;
    const sb = getClient();
    if (!sb) throw new Error('Synchronizacja nie jest skonfigurowana');
    const { data: { user } } = await sb.auth.getUser();
    if (!user) throw new Error('Brak aktywnej sesji');
    currentUser = user;
    setStatus('syncing');
    try {
      await pushToLeague(getLeagueState());
      await pushToCloud(user.id, getUserState());
      setSyncMeta({
        userLocalUpdatedAt: Date.now(),
        leagueLocalUpdatedAt: Date.now(),
        localUpdatedAt: Date.now(),
      });
      setStatus('synced');
    } catch (err) {
      setStatus('error', err.message || 'Błąd zapisu');
      throw err;
    }
  }

  function schedulePush() {
    if (!currentUser) return;
    if (!hooks?.getState && !hooks?.getLeagueState) return;
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
    if (!currentUser) return;
    if (applyingRemoteLeague) return;
    if (!hooks?.getState && !hooks?.getLeagueState) return;
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    setStatus('syncing');
    try {
      await pushToLeague(getLeagueState());
      await pushToCloud(currentUser.id, getUserState());
      setStatus('synced');
    } catch (err) {
      setStatus('error', err.message || 'Błąd zapisu');
    }
  }

  function touchLocalSave({ mutation = true } = {}) {
    const now = Date.now();
    const patch = { localUpdatedAt: now };
    if (mutation) {
      patch.userLocalUpdatedAt = now;
      patch.leagueLocalUpdatedAt = now;
    }
    setSyncMeta(patch);
  }

  async function pushLeagueQuiet() {
    if (!currentUser || applyingRemoteLeague) return;
    if (!hooks?.getLeagueState && !hooks?.getState) return;
    if (!navigator.onLine) return;
    try {
      await pushToLeague(getLeagueState());
    } catch (_) {}
  }

  function getUser() {
    return currentUser;
  }

  function getStatus() {
    return syncStatus;
  }

  function getLeagueId() {
    return leagueId();
  }

  function statusLabel() {
    switch (syncStatus) {
      case 'synced': return 'Liga zsynchronizowana';
      case 'syncing': return 'Synchronizacja ligi…';
      case 'offline': return 'Offline — zapis lokalny';
      case 'error': return 'Błąd synchronizacji';
      case 'unconfigured': return 'Chmura nie skonfigurowana';
      default: return '';
    }
  }

  window.BadmintonCloud = {
    init,
    isConfigured,
    isReady,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    verifyPassword,
    deleteAccount,
    getAuthProvider,
    manualSync,
    forcePushState,
    syncAfterLogin,
    schedulePush,
    flushPush,
    touchLocalSave,
    pushLeagueQuiet,
    getUser,
    getStatus,
    getLeagueId,
    statusLabel,
  };
})();
