const APP_NAME = 'Badminton App';
const STORAGE_KEY = 'badminton-app-state';
const INSTALL_DISMISS_KEY = 'badminton-install-dismissed';
const BIOMETRIC_STORE_KEY = 'badminton-biometric';
const UI_STATE_KEY = 'badminton-ui-state';
const PENDING_CLAIM_KEY = 'badminton-pending-claim';
const PENDING_JOIN_KEY = 'badminton-pending-join';
const ROLE_SESSION_KEY = 'badminton-app-role';
const GOOGLE_RELINK_KEY = 'badminton-pending-google-relink';
const STATE_VERSION = 16;
const TEMP_GUEST_BASE = -1000;
const AVATAR_MAX_PX = 256;

const SUBTITLES = {
  stats: 'Statystyki',
  matches: 'Mecze',
  players: 'Zawodnicy i drużyny',
  profile: 'Profil',
  'stats-global': 'Statystyki globalne',
  'stats-players': 'Statystyki zawodników',
  'stats-h2h': 'Konfrontacja',
  'match-detail': 'Mecz',
  'add-set': 'Nowy set',
  'new-match': 'Nowy mecz',
  login: 'Logowanie',
  welcome: 'Witaj',
  player: 'Zawodnik',
  team: 'Drużyna',
};

const APP_PUBLIC_URL = 'https://krzysi3kjurczak-beep.github.io/badminton-stats/';
const APP_ADMIN_EMAILS = ['krzysi3k.jurczak@gmail.com', 'krzysi3k.jurczak@mail.com'];

function getAuthEmail() {
  return userSession.authEmail
    || (typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser()?.email : null)
    || null;
}

function isAppAdmin() {
  const email = getAuthEmail()?.toLowerCase();
  return !!email && APP_ADMIN_EMAILS.some(a => a.toLowerCase() === email);
}

function hasAuthAccount() {
  return userSession.loggedIn && !!getAuthEmail();
}

function matchPermissionsActive() {
  return typeof BadmintonCloud !== 'undefined' && BadmintonCloud.isConfigured();
}

function isMatchParticipant(m) {
  const pid = userSession.playerId;
  if (pid == null || !m) return false;
  return getMatchPlayerIds(m).includes(pid);
}

function canCreateMatch() {
  if (isSpectatorMode()) return false;
  if (!matchPermissionsActive()) return true;
  return hasAuthAccount();
}

function canEditMatch(m) {
  if (!m) return false;
  if (!matchPermissionsActive()) return true;
  if (isAppAdmin()) return true;
  if (!hasAuthAccount()) return false;
  return isMatchParticipant(m);
}

function canEditSetScores(m) {
  if (!canEditMatch(m)) return false;
  return m.status === 'active' || reopenMatchEdit;
}

function shouldShowArchiveSetOverlay(m) {
  if (!setPlayOpen || !m) return false;
  if (editSetN != null) return canEditSetScores(m);
  const editable = canEditMatch(m);
  const archive = isMatchArchive(m);
  const active = isMatchActive(m);
  return !setDetailN && editable && ((archive && active) || reopenMatchEdit);
}

function requireMatchEdit(m) {
  if (!canEditMatch(m)) {
    showToast('Tylko uczestnicy meczu mogą to zmieniać', 'warn');
    return false;
  }
  return true;
}

let players = [];
let teams = [];
let matches = [];
let signupInvites = [];
let leagueTombstones = { matches: {}, players: {}, teams: {} };
let userSession = { playerId: null, avatarUrl: null, notifications: false, loggedIn: false, authEmail: null, pinHash: null, pinKey: null };
let authBootstrapPending = typeof BadmintonCloud !== 'undefined' && BadmintonCloud.isConfigured();
let profileAuthMode = 'login';
let profileAuthError = '';
let profileAuthNotice = '';
let pendingSignupEmail = null;
let profileAuthShowPassword = false;
let authWantsProfile = false;
let cloudSyncDetail = '';
let syncManualActive = false;
let deleteAccountOpen = false;
let deleteAccountError = '';
let resetStatsOpen = false;
let resetStatsError = '';
let suppressAutoPlayerBootstrap = false;
let changeGoogleOpen = false;
let changeGoogleError = '';
let loginSettingsOpen = false;
let loginSettingsError = '';
let pinSetupOpen = false;
let pinSetupError = '';
let deleteTeamOpen = false;
let deleteTeamId = null;
let deleteTeamError = '';
let deletePlayerOpen = false;
let deletePlayerId = null;
let deletePlayerError = '';
let googleRelinkInProgress = false;
let syncLongPressTimer = null;
let suppressSyncClick = false;
let installHiddenThisProfileVisit = false;
let openPlayerId = null;
let openTeamId = null;
let playersRosterTab = 'players';
let inviteShareOpen = false;
let inviteSharePayload = null;
/** 'guest' | 'signup' | null — dedykowany flow po ?claim= / ?join= */
let inviteAuthMode = null;
let inviteSharePreviewUrl = null;
let addGuestOpen = false;
let playersFabMenuOpen = false;
let newTeamOpen = false;
let newTeamDraft = null;

let currentTab = 'stats';
let statsSubView = null;
let profileOpen = false;
let openMatchId = null;
let matchView = 'detail';
let matchInfoOpen = false;
let newMatchOpen = false;
let newMatchDraft = null;
let teamAvatarSide = null;
let teamAvatarEditId = null;
let matchTeamEditSide = null;
let matchTeamAvatarSide = null;
let setPlayOpen = false;
let editSetN = null;
let setDetailN = null;
let pendingRemoteMatchUi = null;
let setTimerInterval = null;
let longPressTimer = null;
let suppressNextClick = false;
let matchClockInterval = null;
let liveLeagueSyncInterval = null;
let reopenMatchEdit = false;
let matchEditSnapshot = null;
let servePickerMatchId = null;
let servePickerPhase = null;
let servePickerChosenSide = null;
let servePickerConfirmTimer = null;
let serveExpandFinalizeTimer = null;
const SERVE_CONFIRM_MS = 1000;
const SERVE_EXPAND_MS = 1200;
let liveSettlingUntil = 0;
let pendingConfirm = null;
let wakeLockRef = null;
let ctxTarget = null;
let deferredInstallPrompt = null;

const CALENDAR_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
const HOME_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const DICE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/></svg>`;
const TEAM_NAME_CLEAR_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const BIOMETRIC_ICON = '<span class="biometric-icon" aria-hidden="true"><img src="icons/biometric-fingerprint.png" width="48" height="48" alt=""></span>';
const PICKER_CHEVRON = '<svg class="dropdown-picker__chevron-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const DANGER_WORD_DELETE = 'USUŃ';
const DANGER_WORD_RESET = 'WYCZYŚĆ';
const DANGER_WORD_GOOGLE = 'ZMIEN';

const MAX_PLAYER_TEAM_NAME_LEN = 27;

function clampPlayerOrTeamName(raw) {
  return String(raw ?? '').trim().slice(0, MAX_PLAYER_TEAM_NAME_LEN);
}

function playerOrTeamNameError(raw, emptyMsg = 'Podaj nazwę') {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return emptyMsg;
  if (trimmed.length > MAX_PLAYER_TEAM_NAME_LEN) return `Maksymalnie ${MAX_PLAYER_TEAM_NAME_LEN} znaków`;
  return null;
}

function normalizeStoredNames() {
  players.forEach(p => {
    if (p.displayName) p.displayName = clampPlayerOrTeamName(p.displayName);
  });
  teams.forEach(t => {
    if (t.name) t.name = clampPlayerOrTeamName(t.name);
  });
  matches.forEach(m => {
    if (m.teamMeta?.A?.name) m.teamMeta.A.name = clampPlayerOrTeamName(m.teamMeta.A.name);
    if (m.teamMeta?.B?.name) m.teamMeta.B.name = clampPlayerOrTeamName(m.teamMeta.B.name);
    if (m.tempGuests) {
      Object.keys(m.tempGuests).forEach(k => {
        m.tempGuests[k] = clampPlayerOrTeamName(m.tempGuests[k]);
      });
    }
  });
}

const RANDOM_TEAM_NAMES = [
  'Gwardia Narciarzy', 'Ekipa Eskimosów', 'Gorzelnicy', 'Szalone Wiewiórki', 'Łotrzykowie z Podwórka',
  'Cebulowa Liga', 'Mistrzowie Kuchenki', 'Nocni Maruderzy', 'Kapitanowie Chaosu', 'Zespół z Piwnicy',
  'Wataha Niedźwiedzi', 'Bracia od Herbaty', 'Szybcy jak Ślimak', 'Drużyna Pomyłek', 'Kosmiczni Ogrodnicy',
  'Wojownicy Klawiatury', 'Bandyci od Kanapek', 'Legenda Podłogi', 'Szczęśliwe Kopyta', 'Złodzieje Snów',
  'Ekipa Bez Planu', 'Mocni w Głowie', 'Pogromcy Lodówki', 'Stoicyczni Optymiści', 'Władcy Przypadku',
  'Nieustraszeni Kanapowicze', 'Komando Konfitury', 'Zawodowi Amatorzy', 'Dzielni Niezdarni', 'Fabryka Charakteru',
  'Podróżnicy w Czasie', 'Mistrzowie Niedzieli', 'Ekipa Trzech Problemów', 'Szaleni Naukowcy', 'Grono Podejrzanych',
];

const PAUSE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
const PLAY_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
const HEADER_USER_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;

const content = document.getElementById('content');
const pageSubtitle = document.getElementById('page-subtitle');
const headerAvatar = document.getElementById('header-avatar');
const profileBtn = document.getElementById('profile-btn');
const avatarInput = document.getElementById('avatar-input');
const teamAvatarInput = document.getElementById('team-avatar-input');
const fab = document.getElementById('fab');

const SERVE_PICKER_KEY = 'badminton-serve-picker-match';

loadState();
ensureSessionRoleForLoggedInUser();
reconcilePinKey();
parseClaimFromUrl();
parseJoinFromUrl();
forceClearModals();

function normalizeMatch(m) {
  const created = m.createdAt || Date.parse((m.date || todayIso()) + 'T12:00:00') || 0;
  return {
    sets: [],
    status: 'finished',
    scoreA: 0,
    scoreB: 0,
    ...m,
    sets: Array.isArray(m.sets) ? m.sets : [],
    status: m.status || 'finished',
    updatedAt: m.updatedAt || created || 0,
  };
}

function touchMatchUpdated(m) {
  if (m) m.updatedAt = Date.now();
}

function touchPlayerUpdated(p) {
  if (p) p.updatedAt = Date.now();
}

function touchTeamUpdated(t) {
  if (t) t.updatedAt = Date.now();
}

function emptyLeagueTombstones() {
  return { matches: {}, players: {}, teams: {} };
}

function normalizeLeagueTombstones(raw) {
  const base = emptyLeagueTombstones();
  if (!raw || typeof raw !== 'object') return base;
  for (const kind of ['matches', 'players', 'teams']) {
    const src = raw[kind];
    if (!src || typeof src !== 'object') continue;
    for (const [id, ts] of Object.entries(src)) {
      const t = Number(ts) || 0;
      if (t > 0) base[kind][id] = Math.max(base[kind][id] || 0, t);
    }
  }
  return base;
}

function mergeLeagueTombstones(local, remote) {
  const a = normalizeLeagueTombstones(local);
  const b = normalizeLeagueTombstones(remote);
  const out = emptyLeagueTombstones();
  for (const kind of ['matches', 'players', 'teams']) {
    const keys = new Set([...Object.keys(a[kind]), ...Object.keys(b[kind])]);
    for (const id of keys) {
      const ts = Math.max(a[kind][id] || 0, b[kind][id] || 0);
      if (ts > 0) out[kind][id] = ts;
    }
  }
  return out;
}

function recordLeagueTombstone(kind, id) {
  if (!leagueTombstones[kind]) leagueTombstones[kind] = {};
  leagueTombstones[kind][String(id)] = Date.now();
}

function applyLeagueTombstones() {
  const matchTs = leagueTombstones.matches || {};
  matches = matches.filter(m => {
    const del = matchTs[String(m.id)] || matchTs[m.id] || 0;
    return !del || (m.updatedAt || 0) > del;
  });
  const playerTs = leagueTombstones.players || {};
  players = players.filter(p => {
    const del = playerTs[String(p.id)] || playerTs[p.id] || 0;
    return !del || (p.updatedAt || 0) > del;
  });
  const teamTs = leagueTombstones.teams || {};
  teams = teams.filter(t => {
    const del = teamTs[String(t.id)] || teamTs[t.id] || 0;
    return !del || (t.updatedAt || 0) > del;
  });
}

function mergeEntityByUpdatedAt(local, remote, idKey) {
  const map = new Map(local.map(x => [x[idKey], x]));
  for (const r of remote) {
    const l = map.get(r[idKey]);
    if (!l) {
      map.set(r[idKey], r);
      continue;
    }
    const rT = r.updatedAt || 0;
    const lT = l.updatedAt || 0;
    map.set(r[idKey], rT >= lT ? r : l);
  }
  return [...map.values()];
}

function hasActiveLiveSet(m) {
  if (!m?.liveSet) return false;
  return !(m.sets || []).some(s => s.n === m.liveSet.n && s.status === 'finished');
}

function ensureLiveSetRow(m) {
  if (!m?.liveSet || !hasActiveLiveSet(m)) return m;
  const n = m.liveSet.n;
  const sets = [...(m.sets || [])];
  const idx = sets.findIndex(s => s.n === n);
  const row = {
    n,
    scoreA: m.liveSet.scoreA ?? 0,
    scoreB: m.liveSet.scoreB ?? 0,
    status: 'live',
  };
  if (idx < 0) return { ...m, sets: [...sets, row] };
  if (sets[idx].status === 'finished') return m;
  if (sets[idx].status === 'live' && sets[idx].scoreA === row.scoreA && sets[idx].scoreB === row.scoreB) return m;
  const next = [...sets];
  next[idx] = { ...next[idx], ...row, status: 'live' };
  return { ...m, sets: next };
}

function repairSetRows(m) {
  if (!m?.sets?.length) return m;
  const liveN = hasActiveLiveSet(m) ? m.liveSet.n : null;
  let changed = false;
  const sets = m.sets.map(s => {
    if (liveN != null && s.n === liveN) return s;
    if (s.status === 'live') {
      changed = true;
      const { status, ...rest } = s;
      return { ...rest, status: 'finished' };
    }
    if (!s.status) {
      changed = true;
      return { ...s, status: 'finished' };
    }
    return s;
  });
  return changed ? { ...m, sets } : m;
}

function persistScrubbedMatch(m) {
  if (!m) return m;
  const fixed = scrubGhostLiveSet(m);
  const mi = matches.findIndex(x => x.id === m.id);
  if (mi >= 0 && matches[mi] !== fixed) matches[mi] = fixed;
  return fixed;
}

function scrubGhostLiveSet(m) {
  if (!m) return m;
  m = ensureLiveSetRow(m);
  m = repairSetRows(m);
  if (!hasActiveLiveSet(m) && m.liveSet) {
    m = { ...m };
    delete m.liveSet;
  }
  if (m.status === 'active' || m.status === 'finished') recalcMatchScores(m);
  return m;
}

function matchLiveProgress(m) {
  if (hasActiveLiveSet(m)) return 2;
  if (m?.serveDuel) return 1;
  return 0;
}

function beginLiveSettling(ms = 4000) {
  liveSettlingUntil = Date.now() + ms;
}

function isLiveSettling() {
  return Date.now() < liveSettlingUntil;
}

function ensureMatchResultFields(m) {
  if (!m || m.status !== 'finished' || m.result) return m;
  const copy = { ...m };
  recalcMatchScores(copy);
  if (copy.scoreA === copy.scoreB) {
    copy.result = 'draw';
    copy.winnerId = null;
  } else {
    copy.result = 'win';
    const team = getWinningTeamIds(copy);
    copy.winnerId = team ? team[0] : null;
  }
  return copy;
}

function mergeActiveLiveSetScores(local, remote) {
  if (!hasActiveLiveSet(local) || !hasActiveLiveSet(remote)) return null;
  if (local.liveSet.n !== remote.liveSet.n) return null;
  const lT = local.updatedAt || 0;
  const rT = remote.updatedAt || 0;
  if (rT > lT) return remote.liveSet;
  if (lT > rT) return local.liveSet;
  const lSum = (local.liveSet.scoreA || 0) + (local.liveSet.scoreB || 0);
  const rSum = (remote.liveSet.scoreA || 0) + (remote.liveSet.scoreB || 0);
  if (rSum !== lSum) return rSum > lSum ? remote.liveSet : local.liveSet;
  return null;
}

function applyMergedLiveSet(match, liveSet) {
  const m = { ...match, liveSet: { ...match.liveSet, ...liveSet } };
  m.sets = (m.sets || []).map(s => {
    if (s.n !== liveSet.n) return s;
    return { ...s, scoreA: liveSet.scoreA, scoreB: liveSet.scoreB, status: s.status === 'finished' ? 'finished' : 'live' };
  });
  return m;
}

function mergeMatchTimings(local, remote, result) {
  if (!result || result.status !== 'active') return result;
  const l = local || {};
  const r = remote || {};
  const now = Date.now();
  const out = { ...result };

  const maxMc = Math.max(getMatchClockElapsed(l), getMatchClockElapsed(r), getMatchClockElapsed(out));
  const mcBase = out.matchClock || l.matchClock || r.matchClock;
  if (mcBase) {
    const status = mcBase.status || 'idle';
    out.matchClock = {
      ...mcBase,
      elapsedSec: maxMc,
      status,
      lastTickAt: status === 'running' ? now : null,
      startedAt: mcBase.startedAt || l.matchClock?.startedAt || r.matchClock?.startedAt || null,
    };
  }

  if (out.liveSet && hasActiveLiveSet(out)) {
    const ln = l.liveSet;
    const rn = r.liveSet;
    const sameSet = (!ln || ln.n === out.liveSet.n) && (!rn || rn.n === out.liveSet.n);
    if (sameSet) {
      const maxPlay = Math.max(
        ln?.n === out.liveSet.n ? getLiveSetElapsed(l) : 0,
        rn?.n === out.liveSet.n ? getLiveSetElapsed(r) : 0,
        getLiveSetElapsed(out),
      );
      const maxServe = Math.max(ln?.serveSec || 0, rn?.serveSec || 0, out.liveSet.serveSec || 0);
      const status = out.liveSet.status;
      out.liveSet = {
        ...out.liveSet,
        serveSec: maxServe,
        elapsedSec: maxPlay,
        status,
        lastTickAt: status === 'running' ? now : null,
      };
    }
  }

  if (out.serveDuel) {
    const maxServe = Math.max(getServeDuelElapsed(l), getServeDuelElapsed(r), getServeDuelElapsed(out));
    out.serveDuel = { ...out.serveDuel, serveSec: maxServe, serveTickAt: now };
  }

  const maxRest = Math.max(getTimingRest(l), getTimingRest(r), getTimingRest(out));
  const timingBase = out.matchTiming || l.matchTiming || r.matchTiming;
  if (timingBase) {
    const phase = getTimingPhase(out);
    const timing = { ...timingBase };
    const lPeriods = l.matchTiming?.breakPeriods || [];
    const rPeriods = r.matchTiming?.breakPeriods || [];
    const lPSum = lPeriods.reduce((a, b) => a + b, 0);
    const rPSum = rPeriods.reduce((a, b) => a + b, 0);
    if (rPSum > lPSum) timing.breakPeriods = [...rPeriods];
    else if (lPSum > rPSum) timing.breakPeriods = [...lPeriods];

    if (isRestPhase(phase)) {
      const storedRest = Math.max(l.matchTiming?.restSec || 0, r.matchTiming?.restSec || 0, timing.restSec || 0);
      const phaseNeeded = Math.max(0, maxRest - storedRest);
      timing.restSec = storedRest;
      timing.phaseStartedAt = now - phaseNeeded * 1000;
    } else {
      timing.restSec = maxRest;
    }
    out.matchTiming = timing;
  }

  if (!hasMatchClockStarted(out)) {
    const maxWarm = Math.max(getPreMatchElapsed(l), getPreMatchElapsed(r), getPreMatchElapsed(out));
    if (maxWarm > 0) {
      const started = now - maxWarm * 1000;
      out.warmupStartedAt = started;
      if (out.matchTiming?.phase === 'warmup') {
        out.matchTiming = { ...out.matchTiming, phaseStartedAt: started };
      }
    }
  }

  if (getTimingPhase(out) === 'inter_break' && out.matchTiming) {
    const maxBreak = Math.max(getInterBreakElapsed(l), getInterBreakElapsed(r), getInterBreakElapsed(out));
    if (maxBreak > 0) {
      out.matchTiming = { ...out.matchTiming, phaseStartedAt: now - maxBreak * 1000 };
    }
  }

  if (out.sets?.length) {
    out.sets = out.sets.map(s => {
      if (s.status !== 'finished') return s;
      const ls = (l.sets || []).find(x => x.n === s.n && x.status === 'finished');
      const rs = (r.sets || []).find(x => x.n === s.n && x.status === 'finished');
      const maxDur = Math.max(s.durationSec || 0, ls?.durationSec || 0, rs?.durationSec || 0);
      return maxDur > (s.durationSec || 0) ? { ...s, durationSec: maxDur } : s;
    });
  }

  return out;
}

function finalizeMergedMatch(local, remote, result) {
  const lT = local?.updatedAt || 0;
  const rT = remote?.updatedAt || 0;
  let merged = mergeMatchTimings(local || {}, remote || {}, result);
  merged.updatedAt = Math.max(lT, rT, merged.updatedAt || 0);
  return scrubGhostLiveSet(ensureMatchResultFields(merged));
}

function isSetFinishedInMatch(m, setN) {
  return (m.sets || []).some(s => s.n === setN && s.status === 'finished');
}

function mergeMatchByUpdatedAt(local, remote) {
  if (!local) return finalizeMergedMatch(null, remote, remote);
  if (!remote) return finalizeMergedMatch(local, null, local);
  const lT = local.updatedAt || 0;
  const rT = remote.updatedAt || 0;

  if (!hasActiveLiveSet(local) && hasActiveLiveSet(remote)) {
    const rn = remote.liveSet.n;
    if (isSetFinishedInMatch(local, rn)) {
      const merged = { ...local, updatedAt: Math.max(lT, rT) };
      delete merged.liveSet;
      return finalizeMergedMatch(local, remote, merged);
    }
  }
  if (hasActiveLiveSet(local) && !hasActiveLiveSet(remote)) {
    const ln = local.liveSet.n;
    if (isSetFinishedInMatch(remote, ln) && rT > lT) {
      return finalizeMergedMatch(local, remote, remote);
    }
  }

  if (hasActiveLiveSet(local) && !hasActiveLiveSet(remote) && !remote?.serveDuel && lT >= rT) {
    return finalizeMergedMatch(local, remote, local);
  }

  const remoteCanceledLive = hasActiveLiveSet(local) && !hasActiveLiveSet(remote) && !remote?.serveDuel;
  const remoteCanceledServe = isServeDuelActive(local) && !remote?.serveDuel && !hasActiveLiveSet(remote);
  if ((remoteCanceledLive || remoteCanceledServe) && rT > lT) {
    return finalizeMergedMatch(local, remote, { ...remote, updatedAt: Math.max(lT, rT) });
  }

  const openProtected = local.id === openMatchId && (
    servePickerPhase || isLiveSettling() || isServeDuelActive(local)
    || (setPlayOpen && hasActiveLiveSet(local))
  );
  if (openProtected && lT >= rT - 1000 && !(remoteCanceledLive || remoteCanceledServe)) {
    return finalizeMergedMatch(local, remote, { ...local, updatedAt: Math.max(lT, rT) });
  }

  let result = lT >= rT ? local : remote;
  const mergedLiveSet = mergeActiveLiveSetScores(local, remote);
  if (mergedLiveSet) {
    result = applyMergedLiveSet(result, mergedLiveSet);
  }
  return finalizeMergedMatch(local, remote, result);
}

function mergeMatchesByUpdatedAt(local, remote) {
  const map = new Map(local.map(x => [x.id, x]));
  for (const r of remote) {
    const l = map.get(r.id);
    map.set(r.id, l ? mergeMatchByUpdatedAt(l, r) : r);
  }
  return [...map.values()];
}

function mergeSignupInvites(local, remote) {
  const map = new Map();
  [...local, ...remote].forEach(inv => {
    if (!inv?.token) return;
    const prev = map.get(inv.token);
    if (!prev || (inv.createdAt || 0) >= (prev.createdAt || 0)) map.set(inv.token, inv);
  });
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return [...map.values()].filter(inv => (inv.createdAt || 0) > cutoff).slice(-80);
}

function applyLeagueState(data, opts = {}) {
  if (!data) return;
  const ver = data.stateVersion || 0;
  const syncSnap = opts.merge ? captureMatchSyncSnapshot() : null;

  if (opts.merge) {
    leagueTombstones = mergeLeagueTombstones(leagueTombstones, data.tombstones);
    players = mergeEntityByUpdatedAt(players, Array.isArray(data.players) ? data.players : [], 'id');
    teams = mergeEntityByUpdatedAt(teams, data.teams || [], 'id');
    const remoteMatches = (data.matches || []).map(m => repairStaleLiveMatchState(normalizeMatch(m)));
    matches = mergeMatchesByUpdatedAt(
      matches.map(m => repairStaleLiveMatchState(normalizeMatch(m))),
      remoteMatches,
    );
    signupInvites = mergeSignupInvites(signupInvites, data.signupInvites || []);
  } else {
    leagueTombstones = normalizeLeagueTombstones(data.tombstones);
    players = Array.isArray(data.players) ? data.players : [];
    teams = data.teams || [];
    matches = (data.matches || []).map(m => repairStaleLiveMatchState(normalizeMatch(m)));
    signupInvites = Array.isArray(data.signupInvites) ? data.signupInvites : [];
  }

  applyLeagueTombstones();

  matches.forEach(m => resolveMatchGuests(m));

  if (ver < 9) {
    players = players.map(p => ({ ...p, isGuest: p.isGuest ?? false }));
    matches = matches.map(m => ({
      ...normalizeMatch(m),
      teamMeta: m.teamMeta || undefined,
      isArchive: m.isArchive ?? (m.date < todayIso()),
      tempGuests: m.tempGuests || undefined,
      liveSet: m.liveSet || undefined,
      createdAt: m.createdAt || Date.parse(m.date + 'T12:00:00') || Date.now(),
      matchClock: m.matchClock || undefined,
      firstSetStartedAt: m.firstSetStartedAt || undefined,
      warmupStartedAt: m.warmupStartedAt || undefined,
    }));
  }

  if (ver < 15) {
    matches = matches.map(m => {
      if (m.status !== 'active') return m;
      if (!hasFinishedSets(m) && !m.firstSetStartedAt && m.matchClock?.status === 'running') {
        const now = Date.now();
        return {
          ...m,
          matchClock: { elapsedSec: 0, status: 'idle', lastTickAt: null, startedAt: null },
          warmupStartedAt: m.warmupStartedAt || m.matchTiming?.phaseStartedAt || m.createdAt || now,
          matchTiming: {
            restSec: 0,
            breakPeriods: [],
            phase: 'warmup',
            phaseStartedAt: m.matchTiming?.phaseStartedAt || now,
          },
        };
      }
      if (hasFinishedSets(m) && !m.firstSetStartedAt && m.matchClock) {
        return { ...m, firstSetStartedAt: m.matchClock.startedAt || m.createdAt || Date.now() };
      }
      return m;
    });
  }

  players = players.map(p => ({ ...p, isGuest: p.isGuest ?? !p.authUserId }));

  if (ver < 11) {
    players = players.filter(p => p.isGuest && !p.authUserId);
    teams = [];
    matches = [];
  }

  dedupePlayers();
  normalizeStoredNames();
  matches = matches.map(m => scrubGhostLiveSet(repairStaleLiveMatchState(m)));

  if (syncSnap) {
    pendingRemoteMatchUi = reconcileRemoteMatchView(syncSnap, matches.find(x => x.id === openMatchId));
  }

  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  if (cloudUser) {
    const linked = findPlayerByAuthUserId(cloudUser.id);
    if (linked) userSession.playerId = linked.id;
  }
  syncUserSessionAvatarFromPlayer();
}

function migrateLegacySessionAvatar(session) {
  if (!session?.playerId || !session.avatarUrl) return;
  const p = getPlayer(session.playerId);
  if (p && !p.avatarUrl) setPlayerAvatarUrl(session.playerId, session.avatarUrl);
}

function applyUserState(data) {
  if (!data?.userSession) return;
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const authLoggedIn = userSession.loggedIn || !!cloudUser;
  const authEmail = userSession.authEmail || cloudUser?.email || data.userSession.authEmail || null;
  const { avatarUrl: _ignoredAvatar, ...cloudUserSession } = data.userSession;

  userSession = {
    playerId: null,
    avatarUrl: null,
    notifications: false,
    loggedIn: false,
    authEmail: null,
    ...userSession,
    ...cloudUserSession,
  };
  userSession.loggedIn = authLoggedIn;
  userSession.authEmail = authEmail;

  if (cloudUser) {
    const linked = findPlayerByAuthUserId(cloudUser.id);
    if (linked) userSession.playerId = linked.id;
  }
  syncUserSessionAvatarFromPlayer();
  reconcilePinKey();
}

function applyPersistedState(data) {
  applyLeagueState(data);
  migrateLegacySessionAvatar(data.userSession);
  applyUserState(data);

  const ver = data.stateVersion || 0;
  if (ver < 11 && userSession.playerId && !players.some(p => p.id === userSession.playerId)) {
    userSession.playerId = null;
    userSession.avatarUrl = null;
  }
  syncUserSessionAvatarFromPlayer();
}

function exportLeagueState() {
  return {
    stateVersion: STATE_VERSION,
    players,
    teams,
    matches,
    tombstones: leagueTombstones,
    signupInvites,
  };
}

function exportUserState() {
  return {
    stateVersion: STATE_VERSION,
    userSession: {
      playerId: userSession.playerId,
      notifications: userSession.notifications,
      loggedIn: userSession.loggedIn,
      authEmail: userSession.authEmail,
      pinHash: userSession.pinHash || null,
      pinKey: userSession.pinKey || null,
    },
  };
}

function exportPersistedState() {
  return {
    stateVersion: STATE_VERSION,
    players,
    teams,
    matches,
    signupInvites,
    tombstones: leagueTombstones,
    userSession: {
      playerId: userSession.playerId,
      avatarUrl: userSession.avatarUrl,
      notifications: userSession.notifications,
      loggedIn: userSession.loggedIn,
      authEmail: userSession.authEmail,
      pinHash: userSession.pinHash || null,
      pinKey: userSession.pinKey || null,
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const needsSave = !data.stateVersion || data.stateVersion < STATE_VERSION;
      const staleActive = (data.matches || []).some(m =>
        m.status === 'active' && (m.result === 'win' || m.result === 'draw') && (m.sets || []).some(s => s.status === 'finished')
      );
      applyPersistedState(data);
      if (needsSave || staleActive) saveState();
    } else {
      players = [];
      teams = [];
      matches = [];
    }
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
    players = [];
    teams = [];
    matches = [];
  }
  restoreUiState();
  restoreServePickerSession();
}

function restoreServePickerSession() {
  try {
    const raw = sessionStorage.getItem(SERVE_PICKER_KEY);
    if (!raw) return;
    const id = parseInt(raw, 10);
    const m = matches.find(x => x.id === id);
    if (m && isServeDuelActive(m) && isServeDuelStarter(m)) servePickerMatchId = id;
    else sessionStorage.removeItem(SERVE_PICKER_KEY);
  } catch (_) {}
}

function saveUiState() {
  try {
    sessionStorage.setItem(UI_STATE_KEY, JSON.stringify({
      currentTab,
      statsSubView,
      openPlayerId: currentTab === 'players' ? openPlayerId : null,
      openTeamId: currentTab === 'players' ? openTeamId : null,
      playersRosterTab: currentTab === 'players' ? playersRosterTab : 'players',
      profileOpen,
      openMatchId: currentTab === 'matches' ? openMatchId : null,
      reopenMatchEdit: reopenMatchEdit && openMatchId != null,
    }));
  } catch (_) {}
}

function restoreUiState() {
  try {
    const raw = sessionStorage.getItem(UI_STATE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.currentTab) currentTab = data.currentTab;
    if (data.statsSubView) statsSubView = data.statsSubView;
    if (data.openPlayerId && currentTab === 'players') openPlayerId = data.openPlayerId;
    else openPlayerId = null;
    if (data.openTeamId && currentTab === 'players') openTeamId = data.openTeamId;
    else openTeamId = null;
    if (data.playersRosterTab && currentTab === 'players') playersRosterTab = data.playersRosterTab;
    if (typeof data.profileOpen === 'boolean') profileOpen = data.profileOpen;
    if (data.currentTab === 'matches' && data.openMatchId) {
      openMatchId = data.openMatchId;
      reopenMatchEdit = !!data.reopenMatchEdit;
    }
    enforceSpectatorTabAccess();
  } catch (_) {}
}

function syncBottomNav() {
  const spectator = isSpectatorMode();
  document.querySelectorAll('.bottom-nav__item').forEach(b => {
    const tab = b.dataset.tab;
    const hide = spectator && tab === 'players';
    b.hidden = hide;
    b.classList.toggle('bottom-nav__item--active', !hide && tab === currentTab);
  });
  document.getElementById('app')?.classList.toggle('app--spectator', spectator);
}

function getSessionRole() {
  try {
    return sessionStorage.getItem(ROLE_SESSION_KEY);
  } catch (_) {
    return null;
  }
}

function setSessionRole(role) {
  try {
    if (role) sessionStorage.setItem(ROLE_SESSION_KEY, role);
    else sessionStorage.removeItem(ROLE_SESSION_KEY);
  } catch (_) {}
}

function clearSessionRole() {
  setSessionRole(null);
}

function isSpectatorMode() {
  return getSessionRole() === 'spectator' && !userSession.loggedIn;
}

function needsWelcomeScreen() {
  if (userSession.loggedIn) return false;
  return !getSessionRole();
}

function shouldShowPlayerAuthChrome() {
  if (authBootstrapPending) return false;
  if (userSession.loggedIn) return false;
  return getSessionRole() === 'player';
}

function ensureSessionRoleForLoggedInUser() {
  if (userSession.loggedIn) setSessionRole('player');
}

function reconcilePinKey() {
  if (!userSession.pinHash) {
    userSession.pinKey = null;
    return;
  }
  if (!userSession.pinKey) {
    userSession.pinHash = null;
    return;
  }
  const key = getPinUserKey();
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  if (!key) {
    userSession.pinHash = null;
    userSession.pinKey = null;
    return;
  }
  if (!userSession.pinKey.startsWith('local:') && !cloudUser) return;
  if (userSession.pinKey !== key) {
    userSession.pinHash = null;
    userSession.pinKey = null;
  }
}

function enforceSpectatorTabAccess() {
  if (!isSpectatorMode()) return;
  if (currentTab === 'players') currentTab = 'stats';
  openPlayerId = null;
  openTeamId = null;
  profileOpen = false;
}

function parseClaimFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const playerId = parseInt(params.get('claim') || '', 10);
  const token = params.get('t') || '';
  if (playerId && token) {
    sessionStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify({ playerId, token }));
    inviteAuthMode = 'guest';
    profileAuthMode = 'register';
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function parseJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('join') || '';
  if (token) {
    sessionStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ token }));
    inviteAuthMode = 'signup';
    profileAuthMode = 'register';
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

function getPendingJoinInvite() {
  try {
    const raw = sessionStorage.getItem(PENDING_JOIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function getPendingGuestClaim() {
  try {
    const raw = sessionStorage.getItem(PENDING_CLAIM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function tryApplyGuestClaim(user) {
  const claim = getPendingGuestClaim();
  if (!claim || !user?.id) return false;
  const guest = getPlayer(claim.playerId);
  if (!guest?.isGuest || guest.pendingClaim?.token !== claim.token) return false;
  if (guest.pendingClaim.email
    && user.email
    && guest.pendingClaim.email.toLowerCase() !== user.email.toLowerCase()) {
    return false;
  }
  guest.isGuest = false;
  guest.authUserId = user.id;
  userSession.playerId = guest.id;
  userSession.loggedIn = true;
  userSession.authEmail = user.email || userSession.authEmail;
  syncUserSessionAvatarFromPlayer();
  touchPlayerUpdated(guest);
  inviteAuthMode = null;
  sessionStorage.removeItem(PENDING_CLAIM_KEY);
  return true;
}

/** Avatar zawsze po ID zawodnika w lidze — niezależny od konta Google / email. */
function getPlayerAvatarUrl(playerId) {
  if (playerId == null) return null;
  return getPlayer(playerId)?.avatarUrl || null;
}

function setPlayerAvatarUrl(playerId, avatarUrl) {
  const p = getPlayer(playerId);
  if (!p) return false;
  const next = avatarUrl || null;
  if ((p.avatarUrl || null) === next) return false;
  if (next) p.avatarUrl = next;
  else delete p.avatarUrl;
  touchPlayerUpdated(p);
  if (playerId === userSession.playerId) syncUserSessionAvatarFromPlayer();
  return true;
}

function syncUserSessionAvatarFromPlayer() {
  const p = getCurrentPlayer();
  userSession.avatarUrl = p?.avatarUrl || null;
}

/** Zmiana avatara w profilu — zapis na rekordzie zawodnika (playerId). */
function setUserAvatar(avatarUrl) {
  if (userSession.playerId == null) return;
  setPlayerAvatarUrl(userSession.playerId, avatarUrl || null);
}

function migrateLocalAvatarToLeague() {
  migrateLegacySessionAvatar(userSession);
  syncUserSessionAvatarFromPlayer();
  if (!userSession.playerId) return;
  const p = getPlayer(userSession.playerId);
  if (p?.avatarUrl) saveState();
}

function saveState(opts = {}) {
  syncUserSessionAvatarFromPlayer();
  dedupePlayers();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    stateVersion: STATE_VERSION,
    players,
    teams,
    matches,
    signupInvites,
    tombstones: leagueTombstones,
    userSession,
  }));
  if (opts.skipCloudPush) return;
  if (typeof BadmintonCloud !== 'undefined') {
    BadmintonCloud.touchLocalSave({ mutation: true });
    if (!BadmintonCloud.getUser()) return;
    if (opts.immediatePush) BadmintonCloud.flushPush().catch(() => {});
    else BadmintonCloud.schedulePush();
  }
}

function getPlayer(id) {
  return players.find(p => p.id === id);
}

function nextPlayerId() {
  return players.reduce((max, p) => Math.max(max, p.id), 0) + 1;
}

function nextTeamId() {
  return teams.reduce((max, t) => Math.max(max, t.id), 0) + 1;
}

function getTeam(id) {
  return teams.find(t => t.id === id);
}

function isMatchRosterComplete(m) {
  if (!m) return false;
  const a = (m.teamA || []).filter(id => id != null);
  const b = (m.teamB || []).filter(id => id != null);
  if (!a.length || !b.length) return false;
  const isDoubles = a.length > 1 || b.length > 1;
  return isDoubles ? (a.length >= 2 && b.length >= 2) : true;
}

function isMatchPlayableLive(m) {
  return isMatchLiveActive(m) && !isMatchEditMode(m) && isMatchRosterComplete(m);
}

function getLiveBusyPlayerIds() {
  const ids = new Set();
  matches.filter(isMatchPlayableLive).forEach(m => {
    getMatchPlayerIds(m).forEach(id => {
      if (id != null) ids.add(id);
    });
  });
  return ids;
}

function isDraftToday(draft) {
  return (draft?.date || todayIso()) === todayIso();
}

function getDraftBusyPlayerIds(draft) {
  return isDraftToday(draft) ? getLiveBusyPlayerIds() : new Set();
}

function getOpposingSlotPlayerIds(draft, side) {
  const otherSlots = side === 'A'
    ? (draft.type === 'doubles' ? ['b1', 'b2'] : ['b1'])
    : (draft.type === 'doubles' ? ['a1', 'a2'] : ['a1']);
  return otherSlots.map(s => draft.slots[s]).filter(id => id != null);
}

function teamHasPlayerConflict(draft, team, side) {
  const currentId = side === 'A' ? draft.teamIdA : draft.teamIdB;
  if (team.id === currentId) return false;
  const opposing = getOpposingSlotPlayerIds(draft, side);
  if (!opposing.length) return false;
  return team.playerIds.some(id => opposing.includes(id));
}

function getTeamUnavailableReason(draft, team, side) {
  const teamId = side === 'A' ? draft.teamIdA : draft.teamIdB;
  const busyIds = getDraftBusyPlayerIds(draft);
  if (isTeamBusy(team, busyIds) && team.id !== teamId) return 'busy';
  if (teamHasPlayerConflict(draft, team, side)) return 'conflict';
  return null;
}

function isTeamBusy(team, busyIds) {
  return team.playerIds.some(id => busyIds.has(id));
}

function pickRandomTeamName() {
  const pool = RANDOM_TEAM_NAMES.filter(n => n.length <= MAX_PLAYER_TEAM_NAME_LEN);
  return pool[Math.floor(Math.random() * pool.length)] || 'Drużyna';
}

function formatTeamLabel(playerIds, draft = null) {
  return clampPlayerOrTeamName(playerIds.map(id => getPlayerNameForDraft(id, draft)).join(' & '));
}

function getPlayerNameForDraft(id, draft = null, m = null) {
  if (id < 0 && draft?.pendingGuests) {
    const slot = Object.entries(draft.slots || {}).find(([, v]) => v === id)?.[0];
    if (slot && draft.pendingGuests[slot]) return draft.pendingGuests[slot];
  }
  return getPlayerName(id, m);
}

function teamNameFieldShowsClear(value, autoLabel = '') {
  const v = String(value ?? '').trim();
  if (!v) return false;
  if (autoLabel && v.toLowerCase() === String(autoLabel).trim().toLowerCase()) return false;
  return true;
}

function updateTeamNameFieldChrome(input) {
  if (!input) return;
  const wrap = input.closest('.team-name-field');
  if (!wrap) return;
  const clearBtn = wrap.querySelector('.team-name-field__clear');
  if (!clearBtn) return;
  const autoLabel = input.dataset.autoLabel || '';
  clearBtn.classList.toggle('team-name-field__clear--hidden', !teamNameFieldShowsClear(input.value, autoLabel));
}

function syncAllTeamNameFieldChrome() {
  document.querySelectorAll('.team-name-field__input').forEach(updateTeamNameFieldChrome);
}

function renderTeamNameField({
  inputId = '',
  inputAttrs = '',
  value = '',
  placeholder = '',
  autoLabel = '',
  diceAction,
  diceAttrs = '',
  clearAction,
  clearAttrs = '',
}) {
  const showClear = teamNameFieldShowsClear(value, autoLabel);
  const autoAttr = autoLabel ? ` data-auto-label="${escAttr(autoLabel)}"` : '';
  return `
    <div class="team-name-field">
      <input class="profile-card__input team-name-field__input"${inputId ? ` id="${inputId}"` : ''} type="text" placeholder="${escAttr(placeholder)}" value="${escAttr(value)}" maxlength="${MAX_PLAYER_TEAM_NAME_LEN}"${autoAttr} ${inputAttrs}>
      <button class="team-name-field__clear${showClear ? '' : ' team-name-field__clear--hidden'}" data-action="${clearAction}" ${clearAttrs} type="button" aria-label="Wyczyść nazwę">${TEAM_NAME_CLEAR_ICON}</button>
      <button class="team-name-field__dice" data-action="${diceAction}" ${diceAttrs} type="button" aria-label="Losuj nazwę drużyny">${DICE_ICON}</button>
    </div>`;
}

function getTeamDisplayLines(team, draft = null) {
  const playersLabel = formatTeamLabel(team.playerIds, draft);
  const name = team.name?.trim() || '';
  const isAutoName = !name || name.toLowerCase() === playersLabel.toLowerCase();
  if (isAutoName) return { title: playersLabel, subtitle: null };
  return { title: name, subtitle: playersLabel };
}

function sortPlayersForPicker(list, busyIds, selected, excluded = []) {
  const avail = [];
  const busy = [];
  list.forEach(p => {
    if (excluded.includes(p.id) && p.id !== selected) return;
    const isBusy = busyIds.has(p.id) && p.id !== selected;
    (isBusy ? busy : avail).push(p);
  });
  const byName = (a, b) => a.displayName.localeCompare(b.displayName, 'pl');
  avail.sort(byName);
  busy.sort(byName);
  return [...avail, ...busy];
}

function sortTeamsForPicker(list, draft, side) {
  const avail = [];
  const busy = [];
  list.forEach(t => {
    const reason = getTeamUnavailableReason(draft, t, side);
    if (reason === 'busy') busy.push(t);
    else avail.push(t);
  });
  const byTitle = (a, b) => getTeamDisplayLines(a, draft).title.localeCompare(getTeamDisplayLines(b, draft).title, 'pl');
  avail.sort(byTitle);
  busy.sort(byTitle);
  return [...avail, ...busy];
}

function renderTeamPickerLabelHtml(team, draft) {
  const { title, subtitle } = getTeamDisplayLines(team, draft);
  if (subtitle) {
    return `<span class="dropdown-picker__label">${title}</span><span class="dropdown-picker__meta">${subtitle}</span>`;
  }
  return `<span class="dropdown-picker__label">${title}</span>`;
}

function renderTeamPickerDropdown(draft, side, availableTeams) {
  const teamId = side === 'A' ? draft.teamIdA : draft.teamIdB;
  const open = draft.openTeamPickerSide === side;
  const selected = teamId ? getTeam(teamId) : null;
  const triggerContent = selected
    ? renderTeamPickerLabelHtml(selected, draft)
    : '<span class="dropdown-picker__placeholder">— wybierz drużynę —</span>';

  return `
    <div class="dropdown-picker${open ? ' dropdown-picker--open' : ''}" data-team-picker="${side}">
      <button type="button" class="dropdown-picker__trigger" data-action="toggle-team-picker" data-side="${side}" aria-expanded="${open ? 'true' : 'false'}" aria-haspopup="listbox">
        <span class="dropdown-picker__value">${triggerContent}</span>
        <span class="dropdown-picker__chevron">${PICKER_CHEVRON}</span>
      </button>
      ${open ? `
        <div class="dropdown-picker__menu" role="listbox" aria-label="Drużyny">
          ${sortTeamsForPicker(availableTeams, draft, side).map(t => {
            const reason = getTeamUnavailableReason(draft, t, side);
            const active = teamId === t.id;
            if (reason === 'busy') {
              return `<button type="button" class="dropdown-picker__option dropdown-picker__option--disabled" disabled>● ${getTeamDisplayLines(t, draft).title} · w grze</button>`;
            }
            if (reason === 'conflict') {
              return `<button type="button" class="dropdown-picker__option dropdown-picker__option--disabled" disabled>● ${getTeamDisplayLines(t, draft).title} · konflikt zawodnika</button>`;
            }
            return `<button type="button" class="dropdown-picker__option${active ? ' dropdown-picker__option--active' : ''}" data-action="pick-existing-team" data-side="${side}" data-team-id="${t.id}" role="option" aria-selected="${active ? 'true' : 'false'}">${renderTeamPickerLabelHtml(t, draft)}</button>`;
          }).join('')}
        </div>
      ` : ''}
    </div>`;
}

function playerPickerOpensUpward(slot, draft) {
  if (slot === 'a2' || slot === 'b2' || slot === 'p2') return false;
  if (slot === 'a1' || slot === 'p1') return true;
  if (slot === 'b1') return draft?.type === 'doubles';
  return false;
}

function getPlayerSlotDisplay(draft, slot) {
  const id = draft.slots[slot];
  if (!id) return null;
  const p = getPlayer(id);
  if (!p) {
    if (draft.pendingGuests?.[slot]) return { name: draft.pendingGuests[slot], meta: 'gość' };
    return { name: '?' };
  }
  if (p.isGuest) return { name: p.displayName, meta: 'gość' };
  return { name: p.displayName };
}

function renderPlayerPickerMenu(draft, slot) {
  const selected = draft.slots[slot];
  const excluded = getExcludedPlayerIds(draft, slot);
  const busyIds = getDraftBusyPlayerIds(draft);
  const registered = sortPlayersForPicker(players.filter(p => !p.isGuest), busyIds, selected, excluded);
  const guests = sortPlayersForPicker(players.filter(p => p.isGuest), busyIds, selected, excluded);
  let html = '';

  if (registered.length) {
    html += '<div class="dropdown-picker__section">Zawodnicy</div>';
    registered.forEach(p => {
      const busy = busyIds.has(p.id) && p.id !== selected;
      const active = p.id === selected && !draft.pendingGuests?.[slot];
      if (busy) {
        html += `<button type="button" class="dropdown-picker__option dropdown-picker__option--disabled" disabled>● <span class="dropdown-picker__label">${p.displayName}</span> · w grze</button>`;
      } else {
        html += `<button type="button" class="dropdown-picker__option${active ? ' dropdown-picker__option--active' : ''}" data-action="pick-player" data-slot="${slot}" data-player-id="${p.id}" role="option"><span class="dropdown-picker__label">${p.displayName}</span></button>`;
      }
    });
  }

  const guestItems = guests.filter(p => !excluded.includes(p.id) || p.id === selected);
  const hasPendingGuest = draft.pendingGuests?.[slot] && selected < 0;
  if (guestItems.length || hasPendingGuest) {
    html += '<div class="dropdown-picker__section">Goście</div>';
    guestItems.forEach(p => {
      const busy = busyIds.has(p.id) && p.id !== selected;
      const active = p.id === selected && !draft.pendingGuests?.[slot];
      if (busy) {
        html += `<button type="button" class="dropdown-picker__option dropdown-picker__option--disabled" disabled>● <span class="dropdown-picker__label">${p.displayName}</span> · w grze</button>`;
      } else {
        html += `<button type="button" class="dropdown-picker__option${active ? ' dropdown-picker__option--active' : ''}" data-action="pick-player" data-slot="${slot}" data-player-id="${p.id}" role="option"><span class="dropdown-picker__label">${p.displayName}</span><span class="dropdown-picker__meta">gość</span></button>`;
      }
    });
    if (hasPendingGuest) {
      html += `<button type="button" class="dropdown-picker__option dropdown-picker__option--active" data-action="pick-player" data-slot="${slot}" data-player-id="${selected}" role="option"><span class="dropdown-picker__label">${draft.pendingGuests[slot]}</span><span class="dropdown-picker__meta">gość</span></button>`;
    }
  }

  html += '<div class="dropdown-picker__section">Dodaj</div>';
  html += `<button type="button" class="dropdown-picker__option dropdown-picker__option--add" data-action="pick-new-guest" data-slot="${slot}" role="option"><span class="dropdown-picker__label">+ Nowy gość…</span></button>`;
  return html;
}

function renderPlayerPickerDropdown(draft, slot) {
  const open = draft.openPlayerPickerSlot === slot;
  const display = getPlayerSlotDisplay(draft, slot);
  const flipUp = playerPickerOpensUpward(slot, draft);
  const triggerContent = display
    ? `<span class="dropdown-picker__label">${display.name}</span>${display.meta ? `<span class="dropdown-picker__meta">${display.meta}</span>` : ''}`
    : '<span class="dropdown-picker__placeholder">— wybierz zawodnika —</span>';

  return `
    <div class="dropdown-picker${open ? ' dropdown-picker--open' : ''}${flipUp ? ' dropdown-picker--flip' : ''}" data-player-picker="${slot}">
      <button type="button" class="dropdown-picker__trigger" data-action="toggle-player-picker" data-slot="${slot}" aria-expanded="${open ? 'true' : 'false'}" aria-haspopup="listbox">
        <span class="dropdown-picker__value">${triggerContent}</span>
        <span class="dropdown-picker__chevron">${PICKER_CHEVRON}</span>
      </button>
      ${open ? `<div class="dropdown-picker__menu" role="listbox" aria-label="Zawodnicy">${renderPlayerPickerMenu(draft, slot)}</div>` : ''}
    </div>`;
}

function samePlayerSet(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((id, i) => id === sb[i]);
}

function findTeamByPlayerIds(playerIds) {
  return teams.find(t => samePlayerSet(t.playerIds, playerIds));
}

function registerTeam(name, avatarUrl, playerIds) {
  if (!playerIds?.length || playerIds.some(id => !id || id < 0)) return null;
  const byPlayers = findTeamByPlayerIds(playerIds);
  if (byPlayers) {
    if (avatarUrl && !byPlayers.avatarUrl) byPlayers.avatarUrl = avatarUrl;
    return byPlayers.id;
  }
  const trimmed = name.trim() || formatTeamLabel(playerIds);
  const clamped = clampPlayerOrTeamName(trimmed);
  const existing = teams.find(t =>
    t.playerIds[0] === playerIds[0] && t.playerIds[1] === playerIds[1] &&
    t.name.toLowerCase() === clamped.toLowerCase()
  );
  if (existing) {
    if (avatarUrl && !existing.avatarUrl) existing.avatarUrl = avatarUrl;
    return existing.id;
  }
  const id = nextTeamId();
  teams.push({ id, name: clamped, avatarUrl: avatarUrl || null, playerIds: [...playerIds] });
  return id;
}

function saveTeamFromDraft(draft, side, playerIds) {
  if (!playerIds?.length || playerIds.some(id => !id || id < 0)) return null;
  const mode = side === 'A' ? draft.teamModeA : draft.teamModeB;
  const meta = side === 'A' ? draft.teamMetaA : draft.teamMetaB;
  const saveTeam = side === 'A' ? !!draft.saveTeamA : !!draft.saveTeamB;
  if (mode === 'existing') {
    const id = side === 'A' ? draft.teamIdA : draft.teamIdB;
    if (id) {
      const t = getTeam(id);
      if (t && meta.avatarUrl) t.avatarUrl = meta.avatarUrl;
      return id;
    }
  }
  if (mode === 'create' && !saveTeam) return null;
  const existing = findTeamByPlayerIds(playerIds);
  if (existing) return existing.id;
  return registerTeam(meta.name, meta.avatarUrl, playerIds);
}

function applyExistingTeamToDraft(draft, side, teamId) {
  const team = getTeam(teamId);
  if (!team) return;
  const slots = side === 'A' ? ['a1', 'a2'] : ['b1', 'b2'];
  draft.slots[slots[0]] = team.playerIds[0];
  draft.slots[slots[1]] = team.playerIds[1];
  const meta = { name: team.name, avatarUrl: team.avatarUrl };
  if (side === 'A') {
    draft.teamIdA = teamId;
    draft.teamMetaA = { ...meta };
  } else {
    draft.teamIdB = teamId;
    draft.teamMetaB = { ...meta };
  }
}

function getExcludedTeamIds(draft, side) {
  const otherId = side === 'A' ? draft.teamIdB : draft.teamIdA;
  return otherId ? [otherId] : [];
}

function isNameTaken(name, excludeId = null) {
  const norm = name.trim().toLowerCase();
  if (!norm) return false;
  return players.some(p => p.id !== excludeId && p.displayName.trim().toLowerCase() === norm);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isMatchArchive(m) {
  return m.isArchive === true || m.date < todayIso();
}

function isMatchLiveActive(m) {
  return m.status === 'active' && !isMatchArchive(m);
}

function isMatchOnBreak(m) {
  return isMatchLiveActive(m) && getMatchPhase(m) === 'break';
}

function isMatchWarmup(m) {
  return isMatchLiveActive(m) && getMatchPhase(m) === 'warmup';
}

function isServeDuelActive(m) {
  return !!m?.serveDuel;
}

function isServeDuelStarter(m) {
  if (!m?.serveDuel) return false;
  const starterId = m.serveDuel.startedByPlayerId;
  if (starterId == null) return false;
  return userSession.playerId === starterId;
}

function canShowServePicker(m) {
  if (!isServeDuelActive(m) || !isServeDuelStarter(m)) return false;
  return servePickerMatchId === m.id || !!servePickerPhase;
}

function migrateServePendingMatch(m) {
  if (!m?.liveSet || m.liveSet.status !== 'serve_pending') return m;
  const n = m.liveSet.n;
  m.serveDuel = {
    startedAt: Date.now(),
    serveSec: m.liveSet.serveSec || 0,
    serveTickAt: Date.now(),
  };
  delete m.liveSet;
  m.sets = (m.sets || []).filter(s => !(s.status === 'live' && s.n === n));
  return m;
}

function getTimingPhase(m) {
  if (!isMatchLiveActive(m) || isMatchEditMode(m)) return null;
  if (isServeDuelActive(m)) return 'serve_duel';
  if (m.liveSet?.status === 'running') return 'live';
  if (m.liveSet?.status === 'paused') return 'set_pause';
  if (!hasFinishedSets(m)) return 'warmup';
  return 'inter_break';
}

function getMatchPhase(m) {
  const phase = getTimingPhase(m);
  if (phase === 'inter_break') return 'break';
  if (phase === 'set_pause') return 'live';
  return phase;
}

function hasMatchClockStarted(m) {
  return !!m.firstSetStartedAt;
}

function getPhaseElapsed(m) {
  const started = m.matchTiming?.phaseStartedAt;
  if (!started) return 0;
  return Math.floor((Date.now() - started) / 1000);
}

function getPreMatchElapsed(m) {
  if (hasMatchClockStarted(m)) return 0;
  if (m.warmupStartedAt) return Math.floor((Date.now() - m.warmupStartedAt) / 1000);
  return getPhaseElapsed(m);
}

function getInterBreakElapsed(m) {
  if (getTimingPhase(m) !== 'inter_break') return 0;
  return getPhaseElapsed(m);
}

function shouldShowPreMatchSubClock(m) {
  return isMatchLiveActive(m) && !isMatchEditMode(m) && !hasMatchClockStarted(m);
}

function shouldShowBreakSubClock(m) {
  return isMatchLiveActive(m) && !isMatchEditMode(m) && getTimingPhase(m) === 'inter_break';
}

function resetMatchToWarmup(m) {
  m.matchClock = { elapsedSec: 0, status: 'idle', lastTickAt: null, startedAt: null };
  delete m.firstSetStartedAt;
  delete m.serveDuel;
  const now = Date.now();
  m.warmupStartedAt = now;
  m.matchTiming = { restSec: 0, breakPeriods: [], phase: 'warmup', phaseStartedAt: now };
}

function needsServePicker(m) {
  return !hasFinishedSets(m) && !isMatchArchive(m) && !reopenMatchEdit;
}

function isRestPhase(phase) {
  return phase === 'set_pause' || phase === 'inter_break' || phase === 'break';
}

function ensureMatchTiming(m) {
  if (!m.matchTiming) {
    m.matchTiming = {
      restSec: 0,
      breakPeriods: [],
      phase: getTimingPhase(m) || 'warmup',
      phaseStartedAt: Date.now(),
    };
  }
  if (!m.matchTiming.breakPeriods) m.matchTiming.breakPeriods = [];
  if (m.matchTiming.phase === 'break') {
    m.matchTiming.phase = getTimingPhase(m) || 'warmup';
  }
  return m.matchTiming;
}

function syncMatchPhase(m, opts = {}) {
  if (!isMatchLiveActive(m)) return;
  const timing = ensureMatchTiming(m);
  const phase = getTimingPhase(m);
  const now = Date.now();
  if (timing.phase === phase) return;
  const delta = Math.floor((now - (timing.phaseStartedAt || now)) / 1000);
  if (isRestPhase(timing.phase) && delta > 0) {
    timing.restSec = (timing.restSec || 0) + delta;
    if (timing.phase === 'inter_break') timing.breakPeriods.push(delta);
  }
  timing.phase = phase;
  timing.phaseStartedAt = now;
  saveState({ skipCloudPush: opts.silent === true });
}

function getTimingRest(m) {
  if (!m.matchTiming) return 0;
  let rest = m.matchTiming.restSec || 0;
  if (isRestPhase(getTimingPhase(m))) {
    rest += Math.floor((Date.now() - (m.matchTiming.phaseStartedAt || Date.now())) / 1000);
  }
  return rest;
}

function getAvgBreakDuration(m) {
  const periods = m.matchTiming?.breakPeriods || [];
  if (!periods.length) return 0;
  return Math.round(periods.reduce((s, x) => s + x, 0) / periods.length);
}

function hasFinishedSets(m) {
  return (m.sets || []).some(s => s.status === 'finished');
}

function isMatchEditMode(m) {
  return reopenMatchEdit && openMatchId === m.id;
}

/** Mecz zakończony, który został błędnie zostawiony jako active (np. po edycji + odświeżeniu). */
function repairStaleLiveMatchState(m) {
  m = migrateServePendingMatch(m);
  if (m.status !== 'active') return m;
  const liveRunning = m.liveSet && (m.liveSet.status === 'running' || m.liveSet.status === 'paused');
  if (liveRunning) return m;
  if (m.matchClock?.status === 'running') return m;
  if ((m.result === 'win' || m.result === 'draw') && hasFinishedSets(m)) {
    const fixed = { ...m, status: 'finished' };
    delete fixed.liveSet;
    return fixed;
  }
  if (hasFinishedSets(m) && !m.liveSet && m.matchClock?.status === 'stopped') {
    return { ...m, status: 'finished' };
  }
  return m;
}

function canCommitLiveSetForMatchEnd(m) {
  if (!m.liveSet) return false;
  const ls = m.liveSet;
  if (ls.scoreA === ls.scoreB) return false;
  if (ls.scoreA === 0 && ls.scoreB === 0) return false;
  return true;
}

function canEndMatch(m) {
  return hasFinishedSets(m) || canCommitLiveSetForMatchEnd(m);
}

function prepareMatchEnd(m) {
  if (!m.liveSet) return true;
  syncScoresFromSetForm(m);
  if (!canCommitLiveSetForMatchEnd(m)) {
    alert('Najpierw zakończ lub zapisz trwający set');
    return false;
  }
  if (!commitLiveSet(m, true)) return false;
  setPlayOpen = false;
  return true;
}

function canPickExistingTeam(draft, side) {
  if (!teams.length) return false;
  if (teams.length === 1) {
    const otherId = side === 'A' ? draft.teamIdB : draft.teamIdA;
    if (otherId) return false;
  }
  return true;
}

function applyDoublesTeamDefaults(draft) {
  const hasTeams = teams.length > 0;
  draft.teamModeA = hasTeams ? 'existing' : 'create';
  draft.teamModeB = hasTeams ? 'existing' : 'create';
  draft.teamIdA = null;
  draft.teamIdB = null;
  draft.teamMetaA = { name: '', avatarUrl: null };
  draft.teamMetaB = { name: '', avatarUrl: null };
  draft.slots = { a1: null, a2: null, b1: null, b2: null };
}

function enforceOtherSideAfterTeamPick(draft, side) {
  if (teams.length !== 1) return;
  const picked = side === 'A' ? draft.teamIdA : draft.teamIdB;
  if (!picked) return;
  if (side === 'A') {
    draft.teamModeB = 'create';
    draft.teamIdB = null;
    draft.slots.b1 = null;
    draft.slots.b2 = null;
    draft.teamMetaB = { name: '', avatarUrl: null };
  } else {
    draft.teamModeA = 'create';
    draft.teamIdA = null;
    draft.slots.a1 = null;
    draft.slots.a2 = null;
    draft.teamMetaA = { name: '', avatarUrl: null };
  }
}

function clearConflictingOtherTeam(draft, side) {
  const otherSide = side === 'A' ? 'B' : 'A';
  const otherTeamId = otherSide === 'A' ? draft.teamIdA : draft.teamIdB;
  if (!otherTeamId) return;
  const otherTeam = getTeam(otherTeamId);
  const pickedId = side === 'A' ? draft.teamIdA : draft.teamIdB;
  const pickedTeam = getTeam(pickedId);
  if (!otherTeam || !pickedTeam) return;
  if (!otherTeam.playerIds.some(id => pickedTeam.playerIds.includes(id))) return;
  if (otherSide === 'A') {
    draft.teamIdA = null;
    draft.slots.a1 = null;
    draft.slots.a2 = null;
    draft.teamMetaA = { name: '', avatarUrl: null };
  } else {
    draft.teamIdB = null;
    draft.slots.b1 = null;
    draft.slots.b2 = null;
    draft.teamMetaB = { name: '', avatarUrl: null };
  }
}

function isSetComplete(scoreA, scoreB) {
  const max = Math.max(scoreA, scoreB);
  const min = Math.min(scoreA, scoreB);
  const margin = max - min;
  if (max >= 30) return true;
  if (max === 21 && margin >= 2) return true;
  if (max >= 22 && max <= 29 && margin === 2) return true;
  return false;
}

function recalcMatchScores(m) {
  const sets = (m.sets || []).filter(s => s.status !== 'live');
  m.scoreA = sets.filter(s => s.scoreA > s.scoreB).length;
  m.scoreB = sets.filter(s => s.scoreB > s.scoreA).length;
}

function recalcMatchResult(m) {
  if (m.status !== 'finished') return;
  recalcMatchScores(m);
  if (m.scoreA === m.scoreB) {
    m.result = 'draw';
    m.winnerId = null;
  } else {
    m.result = 'win';
    const team = getWinningTeamIds(m);
    m.winnerId = team ? team[0] : null;
  }
}

function nextTempGuestId(matchOrDraft) {
  const used = new Set();
  const collect = ids => ids.forEach(id => { if (id < 0) used.add(id); });
  if (matchOrDraft.teamA) {
    collect(matchOrDraft.teamA);
    collect(matchOrDraft.teamB);
  } else if (matchOrDraft.slots) {
    Object.values(matchOrDraft.slots).forEach(id => { if (id < 0) used.add(id); });
  }
  let id = TEMP_GUEST_BASE;
  while (used.has(id)) id--;
  return id;
}

function resolveMatchGuests(m) {
  if (!m.tempGuests || !Object.keys(m.tempGuests).length) return;
  const map = {};
  Object.entries(m.tempGuests).forEach(([tempId, name]) => {
    const trimmed = clampPlayerOrTeamName(name);
    if (!trimmed) return;
    let id;
    const existing = players.find(p => p.displayName.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      id = existing.id;
    } else {
      id = nextPlayerId();
      players.push({
        id,
        displayName: trimmed,
        isGuest: true,
        ...(userSession.playerId ? { createdByPlayerId: userSession.playerId } : {}),
      });
    }
    map[parseInt(tempId, 10)] = id;
  });
  const replace = ids => ids.map(id => map[id] ?? id);
  m.teamA = replace(m.teamA);
  m.teamB = replace(m.teamB);
  delete m.tempGuests;
}

function getMatchPlayerIds(m) {
  return [...m.teamA, ...m.teamB];
}

function isGuestOnlyInMatch(guestId, matchId) {
  const p = getPlayer(guestId);
  if (!p?.isGuest) return false;
  return !matches.some(m => m.id !== matchId && getMatchPlayerIds(m).includes(guestId));
}

function getRemovableCreatedGuests(m) {
  return (m.createdGuestIds || []).filter(id => {
    const p = getPlayer(id);
    return p?.isGuest && isGuestOnlyInMatch(id, m.id);
  });
}

function removeOrphanGuestPlayer(guestId, matchId) {
  const p = getPlayer(guestId);
  if (!p?.isGuest || !isGuestOnlyInMatch(guestId, matchId)) return false;
  recordLeagueTombstone('players', guestId);
  players = players.filter(x => x.id !== guestId);
  teams = teams.map(t => ({
    ...t,
    playerIds: (t.playerIds || []).filter(id => id !== guestId),
  })).filter(t => t.playerIds.length >= 2);
  return true;
}

function cleanupGuestsForMatch(m) {
  if (m.status !== 'active') return;
  getRemovableCreatedGuests(m).forEach(id => removeOrphanGuestPlayer(id, m.id));
}

function clearMatchClockTicker() {
  if (matchClockInterval) {
    clearInterval(matchClockInterval);
    matchClockInterval = null;
  }
}

function ensureMatchClock(m) {
  if (!m.matchClock) m.matchClock = { elapsedSec: 0, status: 'idle', lastTickAt: null, startedAt: null };
  return m.matchClock;
}

function getMatchClockElapsed(m) {
  if (isMatchArchive(m) || !m.matchClock) return 0;
  if (m.status === 'finished' || reopenMatchEdit) return m.matchClock.elapsedSec || 0;
  let sec = m.matchClock.elapsedSec || 0;
  if (m.matchClock.status === 'running' && m.matchClock.lastTickAt) {
    sec += Math.floor((Date.now() - m.matchClock.lastTickAt) / 1000);
  }
  return sec;
}

function tickMatchClock(m) {
  if (!m.matchClock || m.matchClock.status !== 'running') return;
  const now = Date.now();
  if (!m.matchClock.lastTickAt) {
    m.matchClock.lastTickAt = now;
    saveState({ skipCloudPush: true });
    return;
  }
  const delta = Math.floor((now - m.matchClock.lastTickAt) / 1000);
  if (delta > 0) {
    m.matchClock.elapsedSec += delta;
    m.matchClock.lastTickAt = now;
    saveState({ skipCloudPush: true });
  }
}

function tickAllLiveMatches() {
  matches.forEach(m => {
    if (!isMatchLiveActive(m) || reopenMatchEdit) return;
    if (m.matchClock?.status === 'running') {
      tickMatchClock(m);
      syncMatchPhase(m);
    } else {
      syncMatchPhase(m, { silent: true });
    }
    if (m.liveSet?.status === 'running') tickLiveSet(m);
  });
  const openM = openMatchId ? matches.find(x => x.id === openMatchId) : null;
  if (openM && isMatchLiveActive(openM) && !reopenMatchEdit) {
    updateLiveTimingDOM(openM);
    if (setPlayOpen && openM.liveSet?.status === 'running') updateSetPlayClock(openM);
  }
}

function hasRunningLiveMatches() {
  return matches.some(m => {
    if (!isMatchLiveActive(m) || reopenMatchEdit) return false;
    if (m.matchClock?.status === 'running') return true;
    if (!hasMatchClockStarted(m)) return true;
    if (getTimingPhase(m) === 'inter_break') return true;
    const ls = m.liveSet;
    return !!(ls && ls.status === 'running');
  });
}

function clearLiveLeagueSync() {
  if (liveLeagueSyncInterval) {
    clearInterval(liveLeagueSyncInterval);
    liveLeagueSyncInterval = null;
  }
}

function ensureLiveLeagueSync() {
  if (typeof BadmintonCloud === 'undefined' || !BadmintonCloud.getUser()) {
    clearLiveLeagueSync();
    return;
  }
  if (!hasRunningLiveMatches()) {
    clearLiveLeagueSync();
    return;
  }
  if (liveLeagueSyncInterval) return;
  liveLeagueSyncInterval = setInterval(() => {
    if (!hasRunningLiveMatches()) {
      clearLiveLeagueSync();
      return;
    }
    if (BadmintonCloud.getUser()) BadmintonCloud.pushLeagueQuiet();
  }, 4000);
}

function startMatchClockTicker() {
  if (!hasRunningLiveMatches()) {
    clearMatchClockTicker();
    clearLiveLeagueSync();
    return;
  }
  ensureLiveLeagueSync();
  if (!matchClockInterval) {
    matchClockInterval = setInterval(() => {
      if (!hasRunningLiveMatches()) {
        clearMatchClockTicker();
        return;
      }
      tickAllLiveMatches();
    }, 1000);
  }
  tickAllLiveMatches();
}

function ensureMatchClockRunning(m) {
  if (!isMatchLiveActive(m) || reopenMatchEdit) return;
  if (!hasMatchClockStarted(m)) return;
  const mc = ensureMatchClock(m);
  if (mc.status === 'stopped') return;
  const now = Date.now();
  if (mc.status !== 'running') {
    mc.status = 'running';
    mc.lastTickAt = now;
    saveState();
  } else if (!mc.lastTickAt) {
    mc.lastTickAt = now;
    saveState();
  }
  startMatchClockTicker();
}

function ensureLiveMatchTickers() {
  let needsTicker = false;
  matches.forEach(m => {
    if (!isMatchLiveActive(m) || reopenMatchEdit) return;
    needsTicker = true;
    if (hasMatchClockStarted(m)) ensureMatchClockRunning(m);
    if (m.liveSet?.status === 'running') ensureSetTimerRunning(m);
    else if (isServeDuelActive(m)) ensureLivePhaseTimer(m);
  });
  if (needsTicker) startMatchClockTicker();
}

function startMatchClock(m) {
  const mc = ensureMatchClock(m);
  if (!mc.startedAt) mc.startedAt = Date.now();
  mc.status = 'running';
  mc.lastTickAt = Date.now();
  saveState();
  startMatchClockTicker();
}

function stopMatchClock(m) {
  const mc = m.matchClock;
  if (!mc) return;
  syncMatchPhase(m);
  if (mc.status === 'running') {
    mc.elapsedSec = getMatchClockElapsed(m);
    mc.status = 'stopped';
    mc.lastTickAt = null;
  }
  if (!hasRunningLiveMatches()) clearMatchClockTicker();
  saveState();
}

function updateMatchClockDOM(m) {
  const wrap = document.querySelector('.match-board__clock--display');
  if (wrap) {
    wrap.classList.toggle('match-board__clock--frozen', matchClockFrozen(m));
    const showWarmup = shouldShowPreMatchSubClock(m);
    const showBreak = shouldShowBreakSubClock(m);
    let warmupEl = document.getElementById('match-warmup-clock');
    let breakEl = document.getElementById('match-break-clock');
    if (showWarmup && !warmupEl) {
      wrap.insertAdjacentHTML('beforeend', `<span class="match-board__clock-sub match-board__clock-sub--warmup" id="match-warmup-clock">${formatSportClock(getPreMatchElapsed(m))}</span>`);
    } else if (!showWarmup) warmupEl?.remove();
    if (showBreak && !breakEl) {
      wrap.insertAdjacentHTML('beforeend', `<span class="match-board__clock-sub match-board__clock-sub--break" id="match-break-clock">${formatSportClock(getInterBreakElapsed(m))}</span>`);
    } else if (!showBreak) breakEl?.remove();
  }
  const el = document.getElementById('match-clock-display');
  if (el) el.textContent = formatSportClock(getMatchClockElapsed(m));
  const warmupEl = document.getElementById('match-warmup-clock');
  if (warmupEl) warmupEl.textContent = formatSportClock(getPreMatchElapsed(m));
  const breakEl = document.getElementById('match-break-clock');
  if (breakEl) breakEl.textContent = formatSportClock(getInterBreakElapsed(m));
  updateSetRowLiveTimes(m);
  if (openMatchId === m.id && m.liveSet) updateLiveScoresDOM(m);
}

function updateSetRowLiveTimes(m) {
  if (!m?.liveSet || m.liveSet.status !== 'running') return;
  const sec = getLiveSetElapsed(m) + (m.liveSet.serveSec || 0);
  const text = formatSportClock(sec);
  document.querySelectorAll('.set-row--live .set-row__live-time').forEach(el => {
    el.textContent = text;
  });
}

function getActiveSetPlayRoot() {
  return document.querySelector('.set-play-glass')
    || document.querySelector('.serve-expand-shell--live');
}

function updateLiveScoresDOM(m) {
  if (!m?.liveSet) return;
  const ls = m.liveSet;
  const root = getActiveSetPlayRoot();
  const a = root?.querySelector('#set-score-a') ?? document.getElementById('set-score-a');
  const b = root?.querySelector('#set-score-b') ?? document.getElementById('set-score-b');
  if (a && document.activeElement !== a) a.value = ls.scoreA ?? 0;
  if (b && document.activeElement !== b) b.value = ls.scoreB ?? 0;
  document.querySelectorAll(`.set-row--live[data-set-n="${ls.n}"]`).forEach(row => {
    const ptsA = row.querySelector('.set-row__score-side--a .set-row__pts');
    const ptsB = row.querySelector('.set-row__score-side--b .set-row__pts');
    const draw = ls.scoreA === ls.scoreB;
    if (ptsA) {
      ptsA.textContent = ls.scoreA ?? 0;
      ptsA.className = `set-row__pts ${draw ? 'set-row__pts--draw' : (ls.scoreA > ls.scoreB ? 'set-row__pts--win' : 'set-row__pts--lose')}`;
    }
    if (ptsB) {
      ptsB.textContent = ls.scoreB ?? 0;
      ptsB.className = `set-row__pts ${draw ? 'set-row__pts--draw' : (ls.scoreB > ls.scoreA ? 'set-row__pts--win' : 'set-row__pts--lose')}`;
    }
  });
}

function updateLiveTimingDOM(m) {
  updateMatchClockDOM(m);
  updateSetPlayClock(m);
  if (!matchInfoOpen) return;
  const timing = computeTimingStats(m);
  const map = {
    'info-stat-total': timing.total,
    'info-stat-play': timing.play,
    'info-stat-rest': timing.rest,
  };
  Object.entries(map).forEach(([id, sec]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatSportClock(sec);
  });
  const avgBreakEl = document.getElementById('info-stat-avg-break');
  if (avgBreakEl) {
    const avg = getAvgBreakDuration(m);
    avgBreakEl.textContent = avg ? formatSportClock(avg) : '—';
  }
}

function setsPlayDuration(m) {
  return (m.sets || [])
    .filter(s => s.status === 'finished' && s.durationSec)
    .reduce((sum, s) => sum + s.durationSec, 0);
}

function getServeDuelElapsed(m) {
  if (!m.serveDuel) return 0;
  let sec = m.serveDuel.serveSec || 0;
  if (m.serveDuel.serveTickAt) {
    sec += Math.floor((Date.now() - m.serveDuel.serveTickAt) / 1000);
  }
  return sec;
}

function getLivePlayDuration(m) {
  let play = setsPlayDuration(m);
  if (m.serveDuel) play += getServeDuelElapsed(m);
  else if (m.liveSet?.status === 'running' || m.liveSet?.status === 'paused') play += getLiveSetElapsed(m);
  return play;
}

function computeTimingStats(m) {
  if (isMatchLiveActive(m) && !reopenMatchEdit) syncMatchPhase(m, { silent: true });
  const total = getMatchClockElapsed(m);
  const play = getLivePlayDuration(m);
  const rest = getTimingRest(m);
  return { total, play, rest };
}

function getPlayerLiveMatch(playerId) {
  if (playerId == null) return null;
  return matches.find(m => isMatchPlayableLive(m) && getMatchPlayerIds(m).includes(playerId)) || null;
}

function teamSideInMatch(teamId, m) {
  const team = getTeam(teamId);
  if (!team || !m) return null;
  for (const side of ['A', 'B']) {
    const meta = getTeamMeta(m, side);
    if (meta?.teamId === teamId) return side;
    const ids = side === 'A' ? m.teamA : m.teamB;
    if (ids?.length > 1 && samePlayerSet(ids, team.playerIds)) return side;
  }
  return null;
}

function getTeamLiveMatch(teamId) {
  if (teamId == null) return null;
  return matches.find(m => isMatchPlayableLive(m) && teamSideInMatch(teamId, m)) || null;
}

function canEditTeam(team) {
  if (!team) return false;
  if (isAppAdmin()) return true;
  if (!userSession.playerId) return false;
  return team.playerIds.includes(userSession.playerId);
}

function canDeletePlayer(player) {
  if (!player) return false;
  if (player.id === userSession.playerId) return false;
  if (isAppAdmin()) return true;
  if (player.isGuest && userSession.playerId && player.createdByPlayerId === userSession.playerId) return true;
  return false;
}

function computeTeamWins() {
  const wins = {};
  teams.forEach(t => { wins[t.id] = 0; });
  matches.forEach(m => {
    if (m.status !== 'finished') return;
    const winSide = m.scoreA > m.scoreB ? 'A' : m.scoreB > m.scoreA ? 'B' : null;
    if (!winSide) return;
    teams.forEach(t => {
      if (teamSideInMatch(t.id, m) === winSide) wins[t.id]++;
    });
  });
  return wins;
}

function computeTeamStats(teamId) {
  const stats = {
    matchesPlayed: 0,
    setsPlayed: 0,
    matchesWon: 0,
    setsWon: 0,
    totalPlaySec: 0,
    totalPoints: 0,
    avgPointsPerMatch: 0,
  };
  matches.forEach(m => {
    const side = teamSideInMatch(teamId, m);
    if (!side) return;
    const sets = (m.sets || []).filter(s => s.status === 'finished');
    if (m.status === 'finished') stats.matchesPlayed++;
    sets.forEach(s => {
      stats.setsPlayed++;
      const pts = side === 'A' ? s.scoreA : s.scoreB;
      const opp = side === 'A' ? s.scoreB : s.scoreA;
      stats.totalPoints += pts;
      if (pts > opp) stats.setsWon++;
      if (s.durationSec) stats.totalPlaySec += s.durationSec;
    });
    if (m.status === 'finished') {
      const winSide = m.scoreA > m.scoreB ? 'A' : m.scoreB > m.scoreA ? 'B' : null;
      if (winSide === side) stats.matchesWon++;
    }
  });
  stats.avgPointsPerMatch = stats.matchesPlayed > 0
    ? Math.round((stats.totalPoints / stats.matchesPlayed) * 10) / 10
    : 0;
  return stats;
}

function renderCtxActions(type, matchId, setN = null) {
  const m = matches.find(x => x.id === matchId);
  if (!m || !canEditMatch(m)) return '';
  if (type === 'set' && m.status === 'finished' && !reopenMatchEdit) return '';
  const canEdit = type === 'match'
    ? m.status === 'finished'
    : (m.status === 'active' || reopenMatchEdit);
  const canDelete = type === 'match'
    ? (m.status === 'finished' || isMatchLiveActive(m))
    : (m.status === 'active' || reopenMatchEdit);
  return `
    <div class="ctx-actions">
      ${canEdit ? `<button class="ctx-actions__btn" data-action="ctx-edit" data-ctx-type="${type}" data-match-id="${matchId}"${setN ? ` data-set-n="${setN}"` : ''} type="button" aria-label="Edytuj">${EDIT_ICON}</button>` : ''}
      ${canDelete ? `<button class="ctx-actions__btn ctx-actions__btn--danger" data-action="ctx-delete" data-ctx-type="${type}" data-match-id="${matchId}"${setN ? ` data-set-n="${setN}"` : ''} type="button" aria-label="Usuń">${TRASH_ICON}</button>` : ''}
    </div>`;
}

function clearSetTimer() {
  if (setTimerInterval) {
    clearInterval(setTimerInterval);
    setTimerInterval = null;
  }
}

function tickServeDuel(m) {
  if (!m.serveDuel?.serveTickAt) return;
  const now = Date.now();
  const delta = Math.floor((now - m.serveDuel.serveTickAt) / 1000);
  if (delta > 0) {
    m.serveDuel.serveSec = (m.serveDuel.serveSec || 0) + delta;
    m.serveDuel.serveTickAt = now;
    saveState({ skipCloudPush: true });
    if (matchInfoOpen) updateLiveTimingDOM(m);
    if (openMatchId === m.id) updateMatchDetailLiveBadge(m);
  }
}

function ensureLivePhaseTimer(m) {
  const needsTimer = isServeDuelActive(m) || m?.liveSet?.status === 'running';
  if (!needsTimer) return;
  if (setTimerInterval) return;
  const matchId = m.id;
  setTimerInterval = setInterval(() => {
    const match = matches.find(x => x.id === matchId);
    if (!match) {
      clearSetTimer();
      return;
    }
    if (isServeDuelActive(match)) tickServeDuel(match);
    else if (match.liveSet?.status === 'running') tickLiveSet(match);
    else clearSetTimer();
  }, 1000);
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLockRef = await navigator.wakeLock.request('screen');
    }
  } catch (_) { /* brak wsparcia lub odrzucone */ }
}

function releaseWakeLock() {
  wakeLockRef?.release?.();
  wakeLockRef = null;
}

function getLiveSetElapsed(m) {
  if (!m.liveSet) return 0;
  let sec = m.liveSet.elapsedSec || 0;
  if (m.liveSet.status === 'running' && m.liveSet.lastTickAt) {
    sec += Math.floor((Date.now() - m.liveSet.lastTickAt) / 1000);
  }
  return sec;
}

function tickLiveSet(m) {
  if (!m.liveSet || m.liveSet.status !== 'running') return;
  const now = Date.now();
  const delta = Math.floor((now - (m.liveSet.lastTickAt || now)) / 1000);
  if (delta > 0) {
    m.liveSet.elapsedSec = (m.liveSet.elapsedSec || 0) + delta;
    m.liveSet.lastTickAt = now;
    saveState({ skipCloudPush: true });
    updateSetPlayClock(m);
    if (matchInfoOpen) updateLiveTimingDOM(m);
  }
}

function ensureSetTimerRunning(m) {
  if (!m?.liveSet) return;
  if (m.liveSet.status === 'running') ensureLivePhaseTimer(m);
  else if (isServeDuelActive(m)) ensureLivePhaseTimer(m);
}

function startSetTimer(m, opts = {}) {
  clearSetTimer();
  if (!m.liveSet) return;
  if (!m.firstSetStartedAt) {
    m.firstSetStartedAt = Date.now();
    startMatchClock(m);
  }
  m.liveSet.status = 'running';
  m.liveSet.lastTickAt = Date.now();
  syncMatchPhase(m);
  touchMatchUpdated(m);
  if (!opts.silent) saveState({ immediatePush: true });
  ensureLivePhaseTimer(m);
}

function pauseLiveSet(m) {
  if (!m.liveSet) return;
  if (m.liveSet.status === 'running') {
    m.liveSet.elapsedSec = getLiveSetElapsed(m);
    m.liveSet.status = 'paused';
    m.liveSet.lastTickAt = null;
    clearSetTimer();
    syncMatchPhase(m);
    touchMatchUpdated(m);
    saveState({ immediatePush: true });
  }
}

function resumeLiveSet(m) {
  if (!m.liveSet || m.liveSet.status !== 'paused') return;
  m.liveSet.status = 'running';
  m.liveSet.lastTickAt = Date.now();
  syncMatchPhase(m);
  touchMatchUpdated(m);
  saveState({ immediatePush: true });
  ensureLivePhaseTimer(m);
}

function updateSetPlayClock(m) {
  const el = document.getElementById('set-play-clock');
  if (el) el.textContent = formatSportClock(getLiveSetElapsed(m));
}

function renderLiveBadge(small = false, { matchLevel = false } = {}) {
  const label = matchLevel ? 'W trakcie seta' : 'W trakcie';
  return `<span class="live-badge${small ? ' live-badge--sm' : ''}"><span class="live-dot"></span> ${label}</span>`;
}

function renderBreakBadge(small = false) {
  return `<span class="live-badge live-badge--break${small ? ' live-badge--sm' : ''}"><span class="live-dot live-dot--break"></span> Przerwa</span>`;
}

function renderFinishedBadge(small = false) {
  return `<span class="match-status-badge match-status-badge--finished${small ? ' match-status-badge--sm' : ''}">Zakończony</span>`;
}

function renderWarmupBadge(small = false) {
  return `<span class="live-badge live-badge--warmup${small ? ' live-badge--sm' : ''}"><span class="live-dot live-dot--warmup"></span> Rozgrzewka</span>`;
}

function renderServeDuelBadge(small = false) {
  return `<span class="live-badge live-badge--serve${small ? ' live-badge--sm' : ''}"><span class="live-dot live-dot--serve"></span> Gra o serwis</span>`;
}

function renderMatchStatusBadge(m, small = false) {
  if (!isMatchLiveActive(m) || isMatchEditMode(m)) return '';
  const phase = getMatchPhase(m);
  if (phase === 'break') return renderBreakBadge(small);
  if (phase === 'warmup') return renderWarmupBadge(small);
  if (phase === 'serve_duel') return renderServeDuelBadge(small);
  if (phase === 'live') return renderLiveBadge(small, { matchLevel: true });
  return '';
}

function renderEntityLiveLink(m, { profile = false } = {}) {
  if (!m || !isMatchPlayableLive(m)) return '';
  const chevron = profile
    ? '<svg class="ingame-chip__chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>'
    : '';
  const cls = profile ? 'ingame-chip ingame-chip--profile' : 'ingame-chip ingame-chip--card';
  return `<span class="${cls}" data-action="open-live-match" data-match-id="${m.id}" role="button" tabindex="0" aria-label="Przejdź do meczu"><span class="live-dot"></span> W GRZE${chevron}</span>`;
}

function createGuestPlayer(name, { provisional = false } = {}) {
  const err = playerOrTeamNameError(name, 'Podaj nazwę gościa');
  if (err) return { ok: false, error: err };
  const trimmed = clampPlayerOrTeamName(name);
  if (isNameTaken(trimmed)) return { ok: false, error: 'Ta nazwa jest już zajęta' };
  const id = nextPlayerId();
  players.push({
    id,
    displayName: trimmed,
    isGuest: true,
    ...(provisional ? { guestProvisional: true } : {}),
    ...(userSession.playerId ? { createdByPlayerId: userSession.playerId } : {}),
  });
  touchPlayerUpdated(players[players.length - 1]);
  saveState({ immediatePush: true });
  return { ok: true, id, name: trimmed, player: getPlayer(id) };
}

function findOrCreateGuestPlayer(name) {
  const err = playerOrTeamNameError(name, 'Podaj nazwę gościa');
  if (err) return { ok: false, error: err };
  const trimmed = clampPlayerOrTeamName(name);
  const existing = players.find(p => p.isGuest && p.displayName.trim().toLowerCase() === trimmed.toLowerCase());
  if (existing) return { ok: true, player: existing, created: false };
  const created = createGuestPlayer(trimmed, { provisional: true });
  if (!created.ok) return created;
  return { ok: true, player: created.player, created: true };
}

function trackProvisionalDraftGuest(draft, guestId) {
  if (!draft || guestId == null) return;
  const p = getPlayer(guestId);
  if (!p?.guestProvisional) return;
  if (!draft.provisionalGuestIds) draft.provisionalGuestIds = [];
  if (!draft.provisionalGuestIds.includes(guestId)) draft.provisionalGuestIds.push(guestId);
}

function commitDraftGuests(draft, playerIds) {
  (playerIds || []).forEach(id => {
    const p = getPlayer(id);
    if (p?.guestProvisional) delete p.guestProvisional;
  });
  draft?.provisionalGuestIds?.forEach(id => {
    const p = getPlayer(id);
    if (p?.guestProvisional) delete p.guestProvisional;
  });
  if (draft) draft.provisionalGuestIds = [];
}

function cleanupProvisionalGuests(guestIds) {
  (guestIds || []).forEach(id => {
    const p = getPlayer(id);
    if (!p?.isGuest || !p.guestProvisional) return;
    if (matches.some(m => getMatchPlayerIds(m).includes(id))) return;
    if (teams.some(t => (t.playerIds || []).includes(id))) return;
    players = players.filter(x => x.id !== id);
  });
}

function newMatchDefault() {
  const today = todayIso();
  return {
    date: today,
    type: 'singles',
    slots: { a1: null, a2: null, b1: null, b2: null },
    pendingGuests: {},
    provisionalGuestIds: [],
    teamModeA: 'create',
    teamModeB: 'create',
    teamIdA: null,
    teamIdB: null,
    teamMetaA: { name: '', avatarUrl: null },
    teamMetaB: { name: '', avatarUrl: null },
    saveTeamA: false,
    saveTeamB: false,
    guestSlot: null,
    guestName: '',
    guestError: '',
    dateError: '',
    calendarOpen: false,
    calendarMonth: today.slice(0, 7),
    openTeamPickerSide: null,
    openPlayerPickerSlot: null,
  };
}

function getCalendarMonth(draft) {
  return draft.calendarMonth || draft.date?.slice(0, 7) || todayIso().slice(0, 7);
}

function canGoCalendarNext(year, month) {
  const today = todayIso();
  const ty = parseInt(today.slice(0, 4), 10);
  const tm = parseInt(today.slice(5, 7), 10);
  return year < ty || (year === ty && month < tm);
}

function setMatchDraftDate(draft, iso) {
  const today = todayIso();
  draft.date = iso > today ? today : iso;
  draft.calendarMonth = draft.date.slice(0, 7);
  if (draft.date > today) {
    draft.dateError = 'Nie można dodać meczu w przyszłości';
  } else {
    draft.dateError = '';
  }
}

function renderCalendarDays(year, month, selectedIso) {
  const today = todayIso();
  const startPad = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  let html = '';
  ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].forEach(d => {
    html += `<span class="date-calendar__wd">${d}</span>`;
  });
  for (let i = 0; i < startPad; i++) html += '<span class="date-calendar__pad"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const disabled = iso > today;
    const selected = iso === selectedIso;
    const isToday = iso === today;
    html += `<button type="button" class="date-calendar__day${selected ? ' date-calendar__day--selected' : ''}${isToday ? ' date-calendar__day--today' : ''}" data-action="pick-calendar-day" data-date="${iso}"${disabled ? ' disabled' : ''}>${d}</button>`;
  }
  return html;
}

function renderDatePickerSection(draft) {
  const date = draft.date || todayIso();
  const isArchive = date < todayIso();
  const isToday = date === todayIso();
  const [cy, cm] = getCalendarMonth(draft).split('-').map(Number);
  const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  const canNext = canGoCalendarNext(cy, cm);

  return `
    <label class="profile-card__label">Data meczu</label>
    <div class="date-picker-field">
      <button class="date-picker-field__combo" type="button" data-action="toggle-date-picker" aria-label="Wybierz datę" aria-expanded="${draft.calendarOpen ? 'true' : 'false'}">
        <span class="date-picker-field__combo-icon">${CALENDAR_ICON}</span>
        <span class="date-picker-field__combo-text" id="new-match-date-display">${formatDateLong(date)}</span>
      </button>
      <input type="hidden" id="new-match-date-value" data-new-match-field="date" value="${date}">
      <div class="date-calendar${draft.calendarOpen ? '' : ' date-calendar--hidden'}" id="new-match-calendar">
        <div class="date-calendar__head">
          <button type="button" class="date-calendar__nav" data-action="calendar-prev-month" aria-label="Poprzedni miesiąc">‹</button>
          <span class="date-calendar__title" id="new-match-calendar-title">${monthLabel}</span>
          <div class="date-calendar__head-actions">
            <button type="button" class="date-calendar__today" data-action="reset-match-date" aria-label="Ustaw dziś"${isToday || !draft.calendarOpen ? ' hidden' : ''} id="new-match-date-today">${HOME_ICON}</button>
            <button type="button" class="date-calendar__nav" data-action="calendar-next-month" aria-label="Następny miesiąc"${canNext ? '' : ' disabled'}>›</button>
          </div>
        </div>
        <div class="date-calendar__grid" id="new-match-calendar-grid">${renderCalendarDays(cy, cm, date)}</div>
      </div>
    </div>
    <div id="new-match-archive-note"${isArchive ? '' : ' hidden'}>
      <p class="new-match__archive-note">Mecz archiwalny — bez czasu na żywo, tylko wyniki setów.</p>
    </div>
    <p class="new-match__error" id="new-match-date-error"${draft.dateError ? '' : ' hidden'}>${draft.dateError || ''}</p>`;
}

function refreshCalendarDOM(draft) {
  const [cy, cm] = getCalendarMonth(draft).split('-').map(Number);
  const monthLabel = new Date(cy, cm - 1, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
  const title = document.getElementById('new-match-calendar-title');
  const grid = document.getElementById('new-match-calendar-grid');
  const nextBtn = document.querySelector('[data-action="calendar-next-month"]');
  if (title) title.textContent = monthLabel;
  if (grid) grid.innerHTML = renderCalendarDays(cy, cm, draft.date);
  if (nextBtn) nextBtn.disabled = !canGoCalendarNext(cy, cm);
}

function updateNewMatchDateUI() {
  const draft = newMatchDraft;
  if (!draft) return;
  const date = draft.date || todayIso();
  const isToday = date === todayIso();
  const display = document.getElementById('new-match-date-display');
  const hidden = document.getElementById('new-match-date-value');
  const todayBtn = document.getElementById('new-match-date-today');
  const archiveNote = document.getElementById('new-match-archive-note');
  const dateError = document.getElementById('new-match-date-error');
  const submitBtn = document.getElementById('new-match-submit');
  const toggleBtn = document.querySelector('[data-action="toggle-date-picker"]');
  const calendar = document.getElementById('new-match-calendar');
  if (display) display.textContent = formatDateLong(date);
  if (hidden) hidden.value = date;
  if (todayBtn) {
    todayBtn.hidden = !draft.calendarOpen || isToday;
  }
  if (archiveNote) archiveNote.hidden = date >= todayIso();
  if (dateError) {
    dateError.hidden = !draft.dateError;
    dateError.textContent = draft.dateError || '';
  }
  if (submitBtn) {
    submitBtn.textContent = date < todayIso() ? 'Dodaj mecz archiwalny' : 'Rozpocznij mecz';
  }
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', draft.calendarOpen ? 'true' : 'false');
  if (calendar) calendar.classList.toggle('date-calendar--hidden', !draft.calendarOpen);
  if (draft.calendarOpen) refreshCalendarDOM(draft);
}

function renderNewMatchPlayersSection(draft) {
  const isDoubles = draft.type === 'doubles';
  if (isDoubles) {
    return `${renderDoublesTeamBlock(draft, 'A', 'Drużyna A')}${renderDoublesTeamBlock(draft, 'B', 'Drużyna B')}`;
  }
  return `${renderPlayerSlot(draft, 'a1', 'Zawodnik A')}${renderPlayerSlot(draft, 'b1', 'Zawodnik B')}`;
}

function updateNewMatchTypeUI() {
  const draft = newMatchDraft;
  if (!draft) return;
  document.querySelectorAll('[data-action="set-match-type"]').forEach(btn => {
    btn.classList.toggle('new-match__type-btn--active', btn.dataset.type === draft.type);
  });
  const playersEl = document.getElementById('new-match-players');
  if (playersEl) playersEl.innerHTML = renderNewMatchPlayersSection(draft);
}

function updateNewMatchPlayersDOM() {
  const playersEl = document.getElementById('new-match-players');
  if (playersEl && newMatchDraft) {
    const guestSlot = newMatchDraft.guestSlot;
    const openSlot = newMatchDraft.openPlayerPickerSlot;
    playersEl.innerHTML = renderNewMatchPlayersSection(newMatchDraft);
    if (guestSlot) {
      const input = playersEl.querySelector(`[data-new-match-guest-slot="${guestSlot}"]`);
      if (input) input.focus();
    }
    ensureNewMatchPickerVisible();
  }
}

function syncFormPickerScrollPads(glass) {
  const scrollEl = glass?.closest('.new-match-layer__scroll');
  if (!scrollEl || !glass) return;

  const topPad = scrollEl.querySelector('.form-picker-scroll-pad--top');
  const bottomPad = scrollEl.querySelector('.form-picker-scroll-pad--bottom');

  requestAnimationFrame(() => {
    if (topPad) {
      topPad.style.height = '0px';
      topPad.style.marginBottom = '0px';
    }
    if (bottomPad) {
      bottomPad.style.height = '0px';
      bottomPad.style.marginTop = '0px';
    }

    const picker = glass.querySelector('.dropdown-picker--open');
    if (!picker) return;
    const menu = picker.querySelector('.dropdown-picker__menu');
    if (!menu) return;

    requestAnimationFrame(() => {
      const padding = 16;
      const opensUp = picker.classList.contains('dropdown-picker--flip');
      const scrollRect = scrollEl.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();

      if (opensUp) {
        const overflow = scrollRect.top + padding - menuRect.top;
        if (topPad && overflow > 0) {
          const h = Math.ceil(overflow);
          topPad.style.height = `${h}px`;
          topPad.style.marginBottom = `-${h}px`;
        }
      } else {
        const overflow = menuRect.bottom - scrollRect.bottom + padding;
        if (bottomPad && overflow > 0) {
          const h = Math.ceil(overflow);
          bottomPad.style.height = `${h}px`;
          bottomPad.style.marginTop = `-${h}px`;
        }
      }

      requestAnimationFrame(() => {
        const scrollRect2 = scrollEl.getBoundingClientRect();
        const menuRect2 = menu.getBoundingClientRect();
        if (opensUp && menuRect2.top < scrollRect2.top + padding) {
          scrollEl.scrollTop -= scrollRect2.top + padding - menuRect2.top;
        } else if (!opensUp && menuRect2.bottom > scrollRect2.bottom - padding) {
          scrollEl.scrollTop += menuRect2.bottom - scrollRect2.bottom + padding;
        }
      });
    });
  });
}

function ensureNewMatchPickerVisible() {
  syncFormPickerScrollPads(document.getElementById('new-match-glass'));
}

function closeOpenPickers() {
  if (closeTeamFormPickers()) return true;
  if (!newMatchDraft) return false;
  if (!newMatchDraft.openTeamPickerSide && !newMatchDraft.openPlayerPickerSlot) return false;
  newMatchDraft.openTeamPickerSide = null;
  newMatchDraft.openPlayerPickerSlot = null;
  updateNewMatchPlayersDOM();
  return true;
}

function getExcludedPlayerIds(draft, currentSlot) {
  const ids = [];
  Object.entries(draft.slots).forEach(([slot, id]) => {
    if (slot !== currentSlot && id) ids.push(id);
  });
  return ids;
}

function getTeamMeta(m, side) {
  const meta = m.teamMeta?.[side];
  if (!meta) return null;
  if (meta.teamId) {
    const t = getTeam(meta.teamId);
    if (t) {
      return {
        name: meta.name || t.name,
        avatarUrl: meta.avatarUrl || t.avatarUrl,
        teamId: meta.teamId,
      };
    }
  }
  return meta;
}

function getPlayerName(id, m = null) {
  if (id < 0 && m?.tempGuests) {
    return m.tempGuests[id] || m.tempGuests[String(id)] || 'Gość';
  }
  return getPlayer(id)?.displayName ?? '?';
}

function formatTeam(ids, meta, m = null) {
  if (meta?.name?.trim()) return meta.name.trim();
  return ids.map(id => getPlayerName(id, m)).join(' & ');
}

function matchNameLengthClass(name) {
  const len = String(name || '').trim().length;
  if (len > 32) return 'match-board__names--xlong';
  if (len > 24) return 'match-board__names--long';
  if (len > 16) return 'match-board__names--medium';
  return '';
}

function fitSetPlaySideNames() {
  document.querySelectorAll('.set-play__side-name').forEach(el => {
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize) || 14;
    const min = 9;
    let guard = 0;
    while (guard < 24 && size > min && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
  });
}

function fitMatchBoardNames() {
  document.querySelectorAll('.match-board--lg .match-board__names, .match-board--card .match-board__names, .set-detail-face .match-board__names').forEach(el => {
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize) || 16;
    const min = 10;
    let guard = 0;
    while (guard < 24 && size > min && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2)) {
      size -= 1;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
  });
}

function isDesktopLikeDevice() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches && window.innerWidth >= 900;
}

function isTouchOrientationDevice() {
  if (isDesktopLikeDevice()) return false;
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return true;
  if (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) <= 1024) return true;
  return false;
}

function isLandscapeViewport() {
  if (window.screen?.orientation?.type) {
    return window.screen.orientation.type.startsWith('landscape');
  }
  if (window.matchMedia('(orientation: landscape)').matches) return true;
  return window.innerWidth > window.innerHeight;
}

function syncOrientationLayout() {
  const app = document.getElementById('app');
  if (!app) return;
  const touchLandscape = isTouchOrientationDevice() && isLandscapeViewport();
  const matchOpen = openMatchId != null && currentTab === 'matches';
  const setOpen = matchOpen && setPlayOpen;
  app.classList.toggle('app--match-landscape', touchLandscape && matchOpen && !setOpen);
  app.classList.toggle('app--set-landscape', touchLandscape && setOpen);
}

let orientationFitTimer = null;
function scheduleMatchFaceFit() {
  syncOrientationLayout();
  clearTimeout(orientationFitTimer);
  orientationFitTimer = setTimeout(() => {
    requestAnimationFrame(() => {
      fitMatchBoardNames();
      fitSetPlaySideNames();
      syncOrientationLayout();
    });
  }, 80);
}

function bindOrientationListeners() {
  window.addEventListener('orientationchange', scheduleMatchFaceFit);
  window.addEventListener('resize', scheduleMatchFaceFit);
  try {
    window.screen?.orientation?.addEventListener('change', scheduleMatchFaceFit);
  } catch (_) {}
  const mq = window.matchMedia('(orientation: landscape)');
  if (mq.addEventListener) mq.addEventListener('change', scheduleMatchFaceFit);
  else if (mq.addListener) mq.addListener(scheduleMatchFaceFit);
}

function getCurrentPlayer() {
  return userSession.playerId != null ? getPlayer(userSession.playerId) : null;
}

function findPlayerByAuthUserId(authUserId) {
  return players.find(p => p.authUserId === authUserId);
}

function dedupePlayers() {
  const idRemap = new Map();
  const kept = [];
  const authSeen = new Map();
  const guestSeen = new Map();
  const sorted = [...players].sort((a, b) => a.id - b.id);

  for (const p of sorted) {
    if (p.authUserId) {
      if (authSeen.has(p.authUserId)) {
        idRemap.set(p.id, authSeen.get(p.authUserId));
        continue;
      }
      authSeen.set(p.authUserId, p.id);
      kept.push({ ...p, isGuest: false });
      continue;
    }
    if (p.isGuest) {
      const key = p.displayName.trim().toLowerCase();
      if (guestSeen.has(key)) {
        idRemap.set(p.id, guestSeen.get(key));
        continue;
      }
      guestSeen.set(key, p.id);
      kept.push(p);
      continue;
    }
    const key = `__reg__:${p.displayName.trim().toLowerCase()}`;
    if (guestSeen.has(key)) {
      idRemap.set(p.id, guestSeen.get(key));
      continue;
    }
    guestSeen.set(key, p.id);
    kept.push(p);
  }

  players = kept;

  if (!idRemap.size) return;

  const remap = id => idRemap.get(id) ?? id;
  matches = matches.map(m => ({
    ...normalizeMatch(m),
    teamA: (m.teamA || []).map(remap),
    teamB: (m.teamB || []).map(remap),
  })).filter(m => m.teamA.length > 0 && m.teamB.length > 0);
  teams = teams.map(t => ({
    ...t,
    playerIds: (t.playerIds || []).map(remap),
  })).filter(t => t.playerIds.length >= 2);
  if (userSession.playerId != null && idRemap.has(userSession.playerId)) {
    userSession.playerId = idRemap.get(userSession.playerId);
  }
}

function removePlayerFromData(playerId) {
  recordLeagueTombstone('players', playerId);
  players = players.filter(p => p.id !== playerId);
  matches.forEach(m => {
    m.teamA = (m.teamA || []).filter(id => id !== playerId);
    m.teamB = (m.teamB || []).filter(id => id !== playerId);
  });
  matches = matches.filter(m => m.teamA.length > 0 && m.teamB.length > 0);
  teams = teams.map(t => ({
    ...t,
    playerIds: (t.playerIds || []).filter(id => id !== playerId),
  })).filter(t => t.playerIds.length >= 2);
}

function deletePlayerById(playerId) {
  if (playerId === userSession.playerId) {
    return { ok: false, error: 'Własne konto usuń w profilu użytkownika' };
  }
  const p = getPlayer(playerId);
  if (!p) return { ok: false, error: 'Nie znaleziono zawodnika' };
  removePlayerFromData(playerId);
  return { ok: true };
}

function deleteTeamById(teamId) {
  const team = getTeam(teamId);
  if (!team) return { ok: false, error: 'Nie znaleziono drużyny' };
  recordLeagueTombstone('teams', teamId);
  teams = teams.filter(t => t.id !== teamId);
  matches.forEach(m => {
    if (m.teamMeta?.A?.teamId === teamId) delete m.teamMeta.A.teamId;
    if (m.teamMeta?.B?.teamId === teamId) delete m.teamMeta.B.teamId;
  });
  return { ok: true };
}

function defaultNameFromAuthUser(user) {
  const meta = user.user_metadata || {};
  if (meta.full_name) {
    const part = String(meta.full_name).trim().split(/\s+/)[0];
    if (part) return clampPlayerOrTeamName(part);
  }
  if (meta.name) return clampPlayerOrTeamName(meta.name);
  if (user.email) {
    const local = user.email.split('@')[0];
    if (local) return clampPlayerOrTeamName(local);
  }
  return 'Zawodnik';
}

function ensurePlayerForAuthUser(user) {
  if (!user?.id) return { player: null, isNew: false, claimApplied: false };
  const claimApplied = tryApplyGuestClaim(user);
  let player = findPlayerByAuthUserId(user.id);
  const isNew = !player;
  if (!player) {
    const defaultName = defaultNameFromAuthUser(user);
    const nameKey = defaultName.trim().toLowerCase();
    const guest = players.find(p => p.isGuest && p.displayName.trim().toLowerCase() === nameKey);
    const orphan = players.find(p => !p.authUserId && !p.isGuest && p.displayName.trim().toLowerCase() === nameKey);
    if (guest) {
      guest.isGuest = false;
      guest.authUserId = user.id;
      player = guest;
    } else if (orphan) {
      orphan.authUserId = user.id;
      orphan.isGuest = false;
      player = orphan;
    } else {
      const id = nextPlayerId();
      player = {
        id,
        displayName: defaultName,
        isGuest: false,
        authUserId: user.id,
      };
      players.push(player);
    }
  }
  dedupePlayers();
  player = findPlayerByAuthUserId(user.id) || player;
  userSession.playerId = player.id;
  userSession.loggedIn = true;
  userSession.authEmail = user.email || null;
  reconcilePinKey();
  const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  if (!player.avatarUrl && avatar) setPlayerAvatarUrl(player.id, avatar);
  syncUserSessionAvatarFromPlayer();
  return { player, isNew, claimApplied };
}

function readPendingGoogleRelink() {
  try {
    const raw = sessionStorage.getItem(GOOGLE_RELINK_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.playerId || Date.now() - (data.at || 0) > 15 * 60 * 1000) {
      sessionStorage.removeItem(GOOGLE_RELINK_KEY);
      return null;
    }
    return data;
  } catch (_) {
    sessionStorage.removeItem(GOOGLE_RELINK_KEY);
    return null;
  }
}

function isGoogleRelinkPending() {
  return googleRelinkInProgress || !!readPendingGoogleRelink();
}

function applyPendingGoogleRelink(user) {
  const pending = readPendingGoogleRelink();
  if (!pending || !user?.id) return false;

  const player = getPlayer(pending.playerId);
  if (!player) {
    sessionStorage.removeItem(GOOGLE_RELINK_KEY);
    return false;
  }

  players.forEach(p => {
    if (p.id !== player.id && p.authUserId === user.id) p.authUserId = null;
  });

  if (pending.oldAuthUserId && pending.oldAuthUserId !== user.id) {
    const store = getBiometricStore();
    if (store[pending.oldAuthUserId]) {
      store[user.id] = store[pending.oldAuthUserId];
      delete store[pending.oldAuthUserId];
      localStorage.setItem(BIOMETRIC_STORE_KEY, JSON.stringify(store));
    }
  }

  player.authUserId = user.id;
  player.isGuest = false;
  dedupePlayers();
  userSession.playerId = player.id;
  userSession.loggedIn = true;
  userSession.authEmail = user.email || null;
  syncUserSessionAvatarFromPlayer();

  sessionStorage.removeItem(GOOGLE_RELINK_KEY);
  googleRelinkInProgress = false;
  return true;
}

async function finishAuthSession(user, { openProfile = false, initialPin = null } = {}) {
  if (applyPendingGoogleRelink(user)) {
    await BadmintonCloud.forcePushState();
    requestProfilePanel();
    saveState();
    render();
    showToast('Konto Google zostało zmienione', 'success');
    return;
  }
  const { player, isNew, claimApplied } = ensurePlayerForAuthUser(user);
  if (!player) return;
  setSessionRole('player');
  suppressAutoPlayerBootstrap = false;
  reconcilePinKey();
  if (getPendingJoinInvite()) sessionStorage.removeItem(PENDING_JOIN_KEY);
  if (claimApplied) {
    showToast(`Przejęto profil gościa „${player.displayName}” — mecze i statystyki są Twoje`, 'success');
    requestProfilePanel();
  } else if (openProfile || isNew || authWantsProfile || needsPinSetup()) {
    requestProfilePanel();
  }
  if (initialPin) {
    await setUserPin(initialPin);
    pinSetupOpen = false;
  } else if (needsPinSetup()) {
    pinSetupOpen = true;
  }
  saveState();
  render();
}

function requestProfilePanel() {
  authWantsProfile = true;
  profileOpen = true;
}

function handleAuthSuccess(user, { openProfile = false, initialPin = null } = {}) {
  finishAuthSession(user, { openProfile, initialPin }).catch(err => {
    profileAuthError = err.message || 'Błąd logowania';
    render();
  });
}

function generateAuthPassword(len = 14) {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  const bytes = new Uint32Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, n => chars[n % chars.length]).join('');
}

function authPasswordToggleIcon() {
  return profileAuthShowPassword ? AUTH_ICON_EYE : AUTH_ICON_EYE_OFF;
}

function renamePlayer(id, newName) {
  const err = playerOrTeamNameError(newName, 'Podaj imię');
  if (err) return { ok: false, error: err };
  const trimmed = clampPlayerOrTeamName(newName);
  if (isNameTaken(trimmed, id)) return { ok: false, error: 'Ta nazwa jest już zajęta' };
  const player = getPlayer(id);
  if (!player) return { ok: false, error: 'Nie znaleziono zawodnika' };
  player.displayName = trimmed;
  saveState();
  return { ok: true };
}

function formatDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_SHAPE_CIRCLE = 'circle';
const AVATAR_SHAPE_TEAM = 'team';

function avatarShapeClass(shape) {
  return shape === AVATAR_SHAPE_TEAM ? 'avatar-shape--team' : 'avatar-shape--circle';
}

function avatarBorderClass(border) {
  return border === 'plain' ? 'avatar-border--plain' : 'avatar-border--accent';
}

function renderAvatarHtml(name, avatarUrl, sizeClass, opts = {}) {
  const shape = opts.shape || AVATAR_SHAPE_CIRCLE;
  const border = opts.border || 'accent';
  const shapeCls = avatarShapeClass(shape);
  const borderCls = avatarBorderClass(border);
  if (avatarUrl) {
    return `<span class="avatar-frame ${sizeClass} ${shapeCls} ${borderCls}"><img class="avatar-frame__img" src="${avatarUrl}" alt=""></span>`;
  }
  return `<span class="${sizeClass} avatar--initials ${shapeCls} ${borderCls}">${initials(name)}</span>`;
}

function renderPlayerAvatars(ids, sizeClass = 'avatar-sm', opts = {}) {
  const border = opts.border ?? 'accent';
  const m = opts.match ?? null;
  const items = ids.map((id, i) => {
    const p = getPlayer(id);
    if (!p) return '';
    const z = ids.length - i;
    const displayName = m ? getPlayerName(id, m) : p.displayName;
    return `<span class="match-card__avatar-slot" style="z-index:${z}">${renderAvatarHtml(displayName, getPlayerAvatarUrl(id), sizeClass, { shape: AVATAR_SHAPE_CIRCLE, border })}</span>`;
  }).filter(Boolean);
  if (!items.length) return '';
  const overlap = items.length > 1 ? ' match-card__avatars--overlap' : '';
  return `<div class="match-card__avatars${overlap}">${items.join('')}</div>`;
}

function renderTeamDedicatedAvatar(name, avatarUrl, sizeClass, opts = {}) {
  const border = opts.border ?? 'accent';
  const inner = renderAvatarHtml(name, avatarUrl, sizeClass, { shape: AVATAR_SHAPE_TEAM, border });
  return `<div class="match-card__avatars match-card__avatars--team-photo"><span class="match-card__avatar-slot">${inner}</span></div>`;
}

function renderTeamEntityAvatar(team, sizeClass = 'avatar-sm', opts = {}) {
  if (!team) return '';
  const border = opts.border ?? 'accent';
  if (team.avatarUrl) {
    return renderTeamDedicatedAvatar(team.name, team.avatarUrl, sizeClass, { border });
  }
  return renderPlayerAvatars(team.playerIds, sizeClass, { border });
}

function renderSideAvatars(m, side, sizeClass = 'avatar-sm', opts = {}) {
  const border = opts.border ?? 'accent';
  const ids = side === 'A' ? m.teamA : m.teamB;
  if (ids.length === 1) {
    const id = ids[0];
    const inner = renderAvatarHtml(getPlayerName(id, m), getPlayerAvatarUrl(id), sizeClass, { shape: AVATAR_SHAPE_CIRCLE, border });
    return `<div class="match-card__avatars"><span class="match-card__avatar-slot">${inner}</span></div>`;
  }
  const meta = getTeamMeta(m, side);
  if (meta?.avatarUrl) {
    const label = meta.name || formatTeam(ids, meta, m);
    return renderTeamDedicatedAvatar(label, meta.avatarUrl, sizeClass, { border });
  }
  return renderPlayerAvatars(ids, sizeClass, { border, match: m });
}

function resizeAvatarFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      let w = img.width;
      let h = img.height;
      const max = AVATAR_MAX_PX;
      if (w > max || h > max) {
        const scale = max / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Nie udało się wczytać zdjęcia'));
    };
    img.src = blobUrl;
  });
}

function updateHeaderAvatar() {
  const hideProfileBtn = needsWelcomeScreen()
    || (shouldShowPlayerAuthChrome() && !profileOpen && !isSpectatorMode());
  if (profileBtn) {
    profileBtn.hidden = hideProfileBtn;
    if (isSpectatorMode()) {
      profileBtn.setAttribute('aria-label', 'Zaloguj się i graj');
      profileBtn.classList.add('top-bar__avatar-btn--login');
    } else {
      profileBtn.setAttribute('aria-label', userSession.loggedIn ? 'Panel użytkownika' : 'Logowanie');
      profileBtn.classList.toggle('top-bar__avatar-btn--login', !userSession.loggedIn);
    }
  }
  if (!userSession.loggedIn) {
    if (hideProfileBtn) return;
    headerAvatar.innerHTML = `<span class="top-bar__avatar top-bar__avatar--login">${HEADER_USER_ICON}</span>`;
    return;
  }
  const player = getCurrentPlayer();
  if (!player) {
    headerAvatar.innerHTML = `<span class="avatar-sm avatar--guest">?</span>`;
    return;
  }
  headerAvatar.innerHTML = renderAvatarHtml(player.displayName, getPlayerAvatarUrl(player.id), 'avatar-sm');
}

function computeWins() {
  const wins = {};
  players.forEach(p => { wins[p.id] = 0; });
  matches.forEach(m => {
    if (m.result === 'win' && m.winnerId) wins[m.winnerId] = (wins[m.winnerId] || 0) + 1;
  });
  return wins;
}

function playerSideInMatch(playerId, m) {
  if (m.teamA?.includes(playerId)) return 'A';
  if (m.teamB?.includes(playerId)) return 'B';
  return null;
}

function computePlayerStats(playerId) {
  const stats = {
    matchesPlayed: 0,
    setsPlayed: 0,
    matchesWon: 0,
    setsWon: 0,
    totalPlaySec: 0,
    totalPoints: 0,
    avgPointsPerMatch: 0,
  };
  matches.forEach(m => {
    const side = playerSideInMatch(playerId, m);
    if (!side) return;
    const sets = (m.sets || []).filter(s => s.status === 'finished');
    if (m.status === 'finished') stats.matchesPlayed++;
    sets.forEach(s => {
      stats.setsPlayed++;
      const pts = side === 'A' ? s.scoreA : s.scoreB;
      const opp = side === 'A' ? s.scoreB : s.scoreA;
      stats.totalPoints += pts;
      if (pts > opp) stats.setsWon++;
      if (s.durationSec) stats.totalPlaySec += s.durationSec;
    });
    if (m.status === 'finished') {
      const winTeam = getWinningTeamIds(m);
      if (winTeam?.includes(playerId)) stats.matchesWon++;
    }
  });
  stats.avgPointsPerMatch = stats.matchesPlayed > 0
    ? Math.round((stats.totalPoints / stats.matchesPlayed) * 10) / 10
    : 0;
  return stats;
}

function getGuestClaimUrl(player) {
  if (!player?.pendingClaim?.token) return '';
  return `${getAppShareUrl()}?claim=${player.id}&t=${encodeURIComponent(player.pendingClaim.token)}`;
}

function getSignupInviteUrl(token) {
  if (!token) return '';
  return `${getAppShareUrl()}?join=${encodeURIComponent(token)}`;
}

function resolveSignupInvite(token) {
  return signupInvites.find(i => i.token === token) || null;
}

function createSignupInvite() {
  const token = crypto.randomUUID();
  signupInvites.push({
    token,
    invitedByPlayerId: userSession.playerId || null,
    createdAt: Date.now(),
  });
  signupInvites = mergeSignupInvites(signupInvites, []);
  saveState();
  return token;
}

function ensureGuestClaimToken(player) {
  if (!player?.isGuest) return false;
  if (!player.pendingClaim?.token) {
    player.pendingClaim = {
      token: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    touchPlayerUpdated(player);
    saveState();
  }
  return true;
}

function playerHasVisibleStats(stats) {
  return stats.matchesPlayed > 0 || stats.setsPlayed > 0 || stats.totalPlaySec > 0;
}

const SHARE_VIA_LABELS = {
  native: 'udostępniono',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
  instagram: 'Instagram',
  sms: 'SMS',
  email: 'e-mail',
  copy: 'skopiowano link',
};

function formatInviteWhen(ts) {
  const diff = Date.now() - ts;
  if (diff < 45000) return 'przed chwilą';
  if (diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))} min temu`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} godz. temu`;
  return new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function buildGuestInvitePayload(player) {
  const stats = computePlayerStats(player.id);
  const statsHint = playerHasVisibleStats(stats)
    ? `Ma już ${stats.matchesPlayed} rozegranych meczów w lidze — po rejestracji przejmiesz całą historię i statystyki.`
    : 'Po rejestracji przejmiesz profil gościa — statystyki zaczną się zbierać od razu.';
  return {
    kind: 'guest',
    guestPlayerId: player.id,
    guestName: player.displayName,
    title: `Dołącz jako ${player.displayName} — ${APP_NAME}`,
    text: `Cześć! Jesteś zapisany w naszej lidze badmintonowej jako „${player.displayName}”. ${statsHint} Kliknij link i załóż konto lub zaloguj się — profil gościa połączy się automatycznie.`,
    url: getGuestClaimUrl(player),
    bannerTag: 'Gość → pełne konto',
    bannerHeadline: player.displayName,
    bannerSub: 'Przejmij mecze i statystyki po rejestracji',
  };
}

function buildSignupInvitePayload(token) {
  const inv = resolveSignupInvite(token);
  const inviter = inv?.invitedByPlayerId ? getPlayer(inv.invitedByPlayerId) : null;
  const inviterName = inviter?.displayName || 'Zawodnik z ligi';
  return {
    kind: 'signup',
    signupToken: token,
    inviterName,
    title: `${inviterName} zaprasza do ${APP_NAME}`,
    text: `${inviterName} zaprasza Cię do wspólnej ligi badmintonowej. Załóż konto, śledź mecze i statystyki — singiel i debel w jednym miejscu.`,
    url: getSignupInviteUrl(token),
    bannerTag: 'Zaproszenie do ligi',
    bannerHeadline: `${inviterName} zaprasza!`,
    bannerSub: 'Dołącz do wspólnej ligi badmintonowej',
  };
}

function getInviteBannerMeta(payload) {
  if (!payload) {
    return { tag: 'Zaproszenie do ligi', headline: APP_NAME, sub: 'Mecze i statystyki w jednym miejscu' };
  }
  return {
    tag: payload.bannerTag || (payload.kind === 'guest' ? 'Gość → pełne konto' : 'Zaproszenie do ligi'),
    headline: payload.bannerHeadline || payload.guestName || payload.inviterName || APP_NAME,
    sub: payload.bannerSub || '',
  };
}

function renderInviteBannerCard(payload) {
  const meta = getInviteBannerMeta(payload);
  return `
    <div class="invite-banner-card">
      <div class="invite-banner-card__inner">
        <img class="invite-banner-card__logo" src="icons/logo-mark.png" width="44" height="44" alt="">
        <div class="invite-banner-card__text">
          <span class="invite-banner-card__app">${APP_NAME}</span>
          <span class="invite-banner-card__tag">${escAttr(meta.tag)}</span>
          <span class="invite-banner-card__rule" aria-hidden="true"></span>
          ${meta.headline ? `<span class="invite-banner-card__headline">${escAttr(meta.headline)}</span>` : ''}
          ${meta.sub ? `<span class="invite-banner-card__sub">${escAttr(meta.sub)}</span>` : ''}
        </div>
        <img class="invite-banner-card__hero" src="icons/auth-hero.svg" width="120" height="60" alt="">
      </div>
    </div>`;
}

function assetUrl(path) {
  return new URL(path, window.location.href).href;
}

function loadShareImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Nie udało się wczytać: ${src}`));
    img.src = src;
  });
}

function canvasRoundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrapCanvasLines(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) line = test;
    else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

async function generateInviteShareImage(payload) {
  const meta = getInviteBannerMeta(payload);
  const W = 600;
  const H = 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#1a3d32');
  grad.addColorStop(0.55, '#0f2820');
  grad.addColorStop(1, '#0a1a14');
  ctx.fillStyle = grad;
  canvasRoundRect(ctx, 0, 0, W, H, 22);
  ctx.fill();
  ctx.strokeStyle = 'rgba(61, 214, 140, 0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();
  const [logo, hero] = await Promise.all([
    loadShareImage(assetUrl('icons/logo-mark.png')),
    loadShareImage(assetUrl('icons/auth-hero.svg')),
  ]);
  ctx.drawImage(logo, 28, 36, 72, 72);
  ctx.fillStyle = '#f0faf5';
  ctx.font = 'bold 28px system-ui, Segoe UI, sans-serif';
  ctx.fillText(APP_NAME, 118, 58);
  ctx.fillStyle = '#8ec5b0';
  ctx.font = '500 17px system-ui, Segoe UI, sans-serif';
  ctx.fillText(meta.tag, 118, 84);
  ctx.fillStyle = '#3dd68c';
  ctx.fillRect(118, 94, 64, 3);
  ctx.fillStyle = '#f0faf5';
  ctx.font = 'bold 22px system-ui, Segoe UI, sans-serif';
  const headLines = wrapCanvasLines(ctx, meta.headline, 300);
  headLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 118, 124 + i * 28));
  if (meta.sub) {
    ctx.fillStyle = '#a8c4b8';
    ctx.font = '500 15px system-ui, Segoe UI, sans-serif';
    const subLines = wrapCanvasLines(ctx, meta.sub, 300);
    subLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 118, 178 + i * 22));
  }
  const heroW = 200;
  const heroH = 100;
  ctx.drawImage(hero, W - heroW - 20, 28, heroW, heroH);
  const url = payload?.url || '';
  if (url) {
    ctx.fillStyle = 'rgba(168, 196, 184, 0.9)';
    ctx.font = '500 12px system-ui, Segoe UI, sans-serif';
    ctx.fillText('Kliknij link:', 28, H - 44);
    ctx.fillStyle = 'rgba(61, 214, 140, 0.95)';
    ctx.font = '500 13px system-ui, Segoe UI, sans-serif';
    const urlLines = wrapCanvasLines(ctx, url, W - 56);
    urlLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, 28, H - 28 + i * 16));
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Błąd generowania obrazu'))), 'image/png', 0.92);
  });
}

async function getInviteShareFile(payload) {
  if (!payload._imageBlob) payload._imageBlob = await generateInviteShareImage(payload);
  return new File([payload._imageBlob], 'badminton-zaproszenie.png', { type: 'image/png' });
}

function inviteShareBody(payload) {
  return `${payload.text}\n\n${payload.url}`;
}

async function copyInviteImageOnly(payload) {
  try {
    const file = await getInviteShareFile(payload);
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]);
      return true;
    }
  } catch (_) {}
  return false;
}

async function downloadInviteImageFile(payload) {
  const file = await getInviteShareFile(payload);
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function getInviteLandingContext() {
  const claim = getPendingGuestClaim();
  if (claim) {
    const guest = getPlayer(claim.playerId);
    if (!guest) {
      return {
        kind: 'guest',
        name: 'Gość',
        statsLine: null,
        bannerTag: 'Gość → pełne konto',
        bannerHeadline: 'Profil gościa',
        bannerSub: 'Załadujemy dane ligi — załóż konto poniżej',
      };
    }
    if (guest?.isGuest) {
      const stats = computePlayerStats(guest.id);
      return {
        kind: 'guest',
        name: guest.displayName,
        statsLine: playerHasVisibleStats(stats)
          ? `${stats.matchesPlayed} meczów · ${stats.setsWon} wygranych setów w lidze`
          : null,
        bannerTag: 'Gość → pełne konto',
        bannerHeadline: guest.displayName,
        bannerSub: 'Profil gościa stanie się Twoim kontem',
      };
    }
  }
  const join = getPendingJoinInvite();
  if (join?.token) {
    const inv = resolveSignupInvite(join.token);
    const inviter = inv?.invitedByPlayerId ? getPlayer(inv.invitedByPlayerId) : null;
    const inviterName = inviter?.displayName || 'Ktoś z ligi';
    return {
      kind: 'signup',
      inviterName,
      bannerTag: 'Zaproszenie do ligi',
      bannerHeadline: `${inviterName} zaprasza!`,
      bannerSub: 'Dołącz do wspólnej ligi badmintonowej',
    };
  }
  return null;
}

function openInviteShareSheet(payload) {
  inviteSharePayload = payload;
  inviteShareOpen = true;
  inviteSharePreviewUrl = null;
  render();
  generateInviteShareImage(payload).then(blob => {
    if (inviteSharePayload !== payload) return;
    payload._imageBlob = blob;
    if (inviteSharePreviewUrl) URL.revokeObjectURL(inviteSharePreviewUrl);
    inviteSharePreviewUrl = URL.createObjectURL(blob);
    const img = document.getElementById('invite-share-preview-img');
    if (img) img.src = inviteSharePreviewUrl;
  }).catch(() => {});
}

function markInviteShared(payload, via) {
  const now = Date.now();
  if (payload.kind === 'guest') {
    const p = getPlayer(payload.guestPlayerId);
    if (p?.pendingClaim) {
      p.pendingClaim.lastSharedAt = now;
      p.pendingClaim.lastSharedVia = via;
      touchPlayerUpdated(p);
    }
  } else if (payload.kind === 'signup' && payload.signupToken) {
    const inv = resolveSignupInvite(payload.signupToken);
    if (inv) {
      inv.lastSharedAt = now;
      inv.lastSharedVia = via;
    }
  }
  saveState();
}

function shareInviteFeedback(via, extras = {}) {
  if (via === 'copy') {
    return extras.imageCopied !== false
      ? 'Skopiowano link i grafikę — wklej w wiadomości'
      : 'Skopiowano link do zaproszenia';
  }
  if (via === 'email') {
    return extras.downloaded
      ? 'E-mail z linkiem + grafika pobrana — dołącz PNG do wiadomości'
      : 'Otwarto klienta e-mail z linkiem';
  }
  if (via === 'whatsapp') {
    return extras.imageCopied
      ? 'WhatsApp: wiadomość z linkiem + grafika w schowku — wklej obraz i wyślij'
      : 'WhatsApp: wiadomość z linkiem gotowa — wyślij';
  }
  if (via === 'messenger') {
    return extras.imageCopied
      ? 'Messenger: link w schowku + grafika — wklej tekst, dołącz obraz i wyślij'
      : 'Messenger: link skopiowany — wklej w wiadomości i wyślij';
  }
  if (via === 'instagram') return 'Instagram: link i grafika w schowku — wklej w DM';
  if (via === 'sms') return 'SMS z klikalnym linkiem — wyślij wiadomość';
  if (via === 'native') return 'Udostępniono zaproszenie z linkiem';
  return 'Zaproszenie gotowe do wysłania';
}

async function dispatchInviteShare(via, payload) {
  const body = inviteShareBody(payload);

  if (via === 'native') {
    if (!navigator.share) return false;
    try {
      const shareData = { title: payload.title, text: body, url: payload.url };
      const file = await getInviteShareFile(payload);
      if (navigator.canShare?.({ ...shareData, files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
      } else {
        await navigator.share(shareData);
      }
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      return false;
    }
  }

  if (via === 'whatsapp') {
    const imageCopied = await copyInviteImageOnly(payload);
    window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
    return { imageCopied };
  }

  if (via === 'messenger') {
    const imageCopied = await copyInviteImageOnly(payload);
    try { await navigator.clipboard.writeText(body); } catch (_) {}
    const link = encodeURIComponent(payload.url);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (isMobile) {
      window.location.href = `fb-messenger://share?link=${link}`;
    } else {
      window.open(`https://www.facebook.com/dialog/send?link=${link}&display=popup&redirect_uri=${encodeURIComponent(getAppShareUrl())}`, '_blank', 'noopener,noreferrer');
    }
    return { imageCopied, textCopied: true };
  }

  if (via === 'instagram') {
    const imageCopied = await copyInviteImageOnly(payload);
    try { await navigator.clipboard.writeText(body); } catch (_) {}
    const ig = window.open('instagram://direct-inbox', '_blank');
    if (!ig) window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener');
    return { imageCopied, textCopied: true };
  }

  if (via === 'sms') {
    const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent || '') ? '&' : '?';
    window.location.href = `sms:${sep}body=${encodeURIComponent(body)}`;
    return true;
  }

  if (via === 'email') {
    await downloadInviteImageFile(payload);
    window.location.href = `mailto:?subject=${encodeURIComponent(payload.title)}&body=${encodeURIComponent(body)}`;
    return { downloaded: true };
  }

  if (via === 'copy') {
    try {
      const file = await getInviteShareFile(payload);
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': file,
            'text/plain': new Blob([body], { type: 'text/plain' }),
          }),
        ]);
        return { imageCopied: true };
      }
    } catch (_) {}
    await navigator.clipboard.writeText(body);
    return { imageCopied: false };
  }

  return false;
}

function setSubtitle(key) {
  pageSubtitle.textContent = SUBTITLES[key] || SUBTITLES.stats;
}

function profileSubtitleKey() {
  return userSession.loggedIn ? 'profile' : 'login';
}

function formatDateLong(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDuration(totalSec) {
  if (!totalSec) return '—';
  const h = Math.floor(totalSec / 3600);
  const m = Math.round((totalSec % 3600) / 60);
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

function matchDuration(m) {
  return getMatchClockElapsed(m);
}

function matchClockVisible(m) {
  if (isMatchArchive(m)) return false;
  return isMatchLiveActive(m) || m.status === 'finished' || reopenMatchEdit;
}

function matchClockFrozen(m) {
  if (m.status === 'finished' || reopenMatchEdit) return true;
  return !hasMatchClockStarted(m);
}

function formatSportClock(totalSec) {
  if (!totalSec) return '00:00';
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const pad = n => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function isSetOnAdvantage(scoreA, scoreB) {
  const max = Math.max(scoreA, scoreB);
  const min = Math.min(scoreA, scoreB);
  return max > 21 || (min >= 20 && max - min === 2);
}

function computeSideStats(m) {
  const sets = (m.sets || []).filter(s => s.status !== 'live');
  const n = sets.length || 1;
  const stats = {
    a: { points: 0, marginSets: 0, maxMargin: 0 },
    b: { points: 0, marginSets: 0, maxMargin: 0 },
  };
  sets.forEach(s => {
    stats.a.points += s.scoreA;
    stats.b.points += s.scoreB;
    const diff = Math.abs(s.scoreA - s.scoreB);
    if (s.scoreA > s.scoreB) {
      if (isSetOnAdvantage(s.scoreA, s.scoreB)) stats.a.marginSets++;
      stats.a.maxMargin = Math.max(stats.a.maxMargin, diff);
    } else if (s.scoreB > s.scoreA) {
      if (isSetOnAdvantage(s.scoreA, s.scoreB)) stats.b.marginSets++;
      stats.b.maxMargin = Math.max(stats.b.maxMargin, diff);
    }
  });
  stats.a.avgPts = n ? (stats.a.points / n).toFixed(1) : '0';
  stats.b.avgPts = n ? (stats.b.points / n).toFixed(1) : '0';
  return stats;
}

function computeMatchStats(m) {
  const sets = (m.sets || []).filter(s => s.status !== 'live');
  const n = sets.length;
  const timing = computeTimingStats(m);
  const totalDur = isMatchArchive(m) ? 0 : timing.total;
  const playDur = isMatchArchive(m) ? 0 : timing.play;
  const restDur = isMatchArchive(m) ? 0 : timing.rest;
  const avgDur = n ? Math.round(playDur / n) : 0;
  const avgBreakDur = getAvgBreakDuration(m);
  const finishedSets = sets;
  const avgPtsPerSet = finishedSets.length
    ? ((finishedSets.reduce((s, x) => s + x.scoreA + x.scoreB, 0)) / finishedSets.length).toFixed(1)
    : '0';
  const deuceSets = finishedSets.filter(s => isSetOnAdvantage(s.scoreA, s.scoreB)).length;
  const longestSet = isMatchArchive(m) ? null : finishedSets.reduce((best, s) => ((s.durationSec || 0) > (best?.durationSec || 0) ? s : best), null);
  return { totalDur, playDur, restDur, avgDur, avgBreakDur, avgPtsPerSet, deuceSets, longestSet, setCount: finishedSets.length };
}

function isUserMatchWin(m) {
  if (m.status !== 'finished' || m.result !== 'win') return false;
  const team = getWinningTeamIds(m);
  return team && userSession.playerId && team.includes(userSession.playerId);
}

function winnerLabelText(m) {
  return (m.teamA?.length > 1 || m.teamB?.length > 1) ? 'Zwycięzcy' : 'Zwycięzca';
}

function renderTeamAvatarsForMatch(m, side, sizeClass = 'avatar-sm', { editable = false } = {}) {
  const inner = renderSideAvatars(m, side, sizeClass);
  if (!editable) return inner;
  return `
    <div class="team-avatar-edit-wrap">
      ${inner}
      <button class="team-avatar-edit" data-action="edit-match-team" data-side="${side}" type="button" aria-label="Edytuj drużynę">${EDIT_ICON}</button>
    </div>`;
}

function ensureMatchTeamMeta(m, side) {
  if (!m.teamMeta) m.teamMeta = {};
  if (!m.teamMeta[side]) m.teamMeta[side] = { name: '', avatarUrl: null };
  return m.teamMeta[side];
}

function saveMatchTeamEdit(m, side) {
  const input = document.getElementById('match-team-name');
  const raw = input?.value?.trim() ?? '';
  const ids = side === 'A' ? m.teamA : m.teamB;
  const autoLabel = ids.map(id => getPlayerName(id, m)).join(' & ');
  const meta = ensureMatchTeamMeta(m, side);
  let name = '';
  if (raw) {
    const err = playerOrTeamNameError(raw, 'Podaj nazwę drużyny');
    if (err) {
      alert(err);
      return;
    }
    const clamped = clampPlayerOrTeamName(raw);
    name = clamped.toLowerCase() === autoLabel.toLowerCase() ? '' : clamped;
  }
  meta.name = name;
  if (meta.teamId) {
    const t = getTeam(meta.teamId);
    if (t) {
      t.name = name;
      if (meta.avatarUrl) t.avatarUrl = meta.avatarUrl;
    }
  }
  saveState();
  matchTeamEditSide = null;
  render();
}

function renderMatchTeamEditAvatarRow(m, side) {
  const meta = ensureMatchTeamMeta(m, side);
  const ids = side === 'A' ? m.teamA : m.teamB;
  const label = meta.name || formatTeam(ids, meta, m);
  const avatarInner = meta.avatarUrl
    ? renderTeamDedicatedAvatar(label, meta.avatarUrl, 'avatar-md')
    : renderSideAvatars(m, side, 'avatar-md');
  return `
    <div class="team-edit-sheet__avatar-row">
      <div class="profile-avatar-stack">
        <button class="profile-panel__avatar-wrap" data-action="match-team-avatar" data-side="${side}" type="button">
          ${avatarInner}
          <span class="profile-panel__camera">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </span>
        </button>
        ${meta.avatarUrl ? `
          <button class="profile-avatar-remove" data-action="remove-match-team-avatar" data-side="${side}" type="button" aria-label="Usuń zdjęcie">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        ` : ''}
      </div>
    </div>`;
}

function updateMatchTeamEditAvatarDOM(m, side) {
  if (matchTeamEditSide !== side) return;
  const row = document.querySelector('.team-edit-sheet__avatar-row');
  if (!row) return;
  row.outerHTML = renderMatchTeamEditAvatarRow(m, side);
  refreshMatchFaceAvatars(m);
}

function renderMatchTeamEditPanel(m, side) {
  const meta = ensureMatchTeamMeta(m, side);
  const ids = side === 'A' ? m.teamA : m.teamB;
  return `
    <div class="team-edit-sheet">
      <button class="team-edit-sheet__backdrop" data-action="close-team-edit" type="button" aria-label="Zamknij"></button>
      <div class="team-edit-sheet__panel">
        <div class="team-edit-sheet__head">
          <h3 class="team-edit-sheet__title">Drużyna ${side}</h3>
          <button class="icon-btn" data-action="close-team-edit" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>
        </div>
        ${renderMatchTeamEditAvatarRow(m, side)}
        <label class="profile-card__label" for="match-team-name">Nazwa drużyny</label>
        ${renderTeamNameField({
          inputId: 'match-team-name',
          value: meta.name || formatTeam(ids, meta, m),
          autoLabel: ids.map(id => getPlayerName(id, m)).join(' & '),
          diceAction: 'random-match-team-name',
          diceAttrs: `data-side="${side}"`,
          clearAction: 'clear-match-team-name',
          clearAttrs: `data-side="${side}"`,
        })}
        <button class="btn btn--primary btn--full team-edit-sheet__save" data-action="save-match-team" data-side="${side}" type="button">Zapisz</button>
      </div>
    </div>`;
}

function renderSetPlaySide(m, side, { inputId, plusAction, value, readonly = false } = {}) {
  const meta = getTeamMeta(m, side);
  const ids = side === 'A' ? m.teamA : m.teamB;
  const name = formatTeam(ids, meta, m);
  const score = value !== undefined ? value : (side === 'A' ? m.liveSet?.scoreA : m.liveSet?.scoreB);
  const isServer = m.liveSet?.firstServer === side;
  const scoreReadonly = readonly;
  const plusBtn = plusAction && !scoreReadonly
    ? `<button class="set-play__pt-btn set-play__pt-btn--sm" data-action="${plusAction}" type="button" aria-label="Dodaj punkt — ${name}">+</button>`
    : '';
  const readOnlyAttr = scoreReadonly ? ' readonly tabindex="-1"' : '';
  const shuttle = isServer
    ? `<span class="set-play__serve-mark">${renderShuttleIcon(20, 'shuttle-icon set-play__shuttle')}</span>`
    : '';
  return `
    <div class="set-play__side set-play__side--${side.toLowerCase()}${isServer ? ' set-play__side--server' : ''}">
      <div class="set-play__side-head">
        <div class="set-play__avatar-row">
          <div class="set-play__avatar-wrap">
            ${renderSideAvatars(m, side)}
            ${shuttle}
          </div>
        </div>
        <span class="set-play__side-name">${name}</span>
      </div>
      <div class="set-play__score-row">
        <input class="set-play__input${scoreReadonly ? ' set-play__input--readonly' : ''}" id="${inputId}" type="number" min="0" max="30" value="${score ?? ''}" placeholder="0" inputmode="numeric" aria-label="Punkty — ${name}"${readOnlyAttr}>
        ${plusBtn}
      </div>
    </div>`;
}

const TROPHY_ICON = `<svg class="winner-trophy" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM5 5H3v1a3 3 0 003 3M19 5h2v1a3 3 0 01-3 3"/></svg>`;

const WHISTLE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3c-1.5 3-4 4.5-7 5v2c3-.5 5.5-2 7-5"/><path d="M9 10v4"/><path d="M12 14v3"/><circle cx="17" cy="8" r="2"/></svg>`;

const CLOSE_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

const BACK_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`;

const FINISH_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;

const EDIT_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

const TRASH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;
const CANCEL_SET_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 10h7a4 4 0 014 4v0a4 4 0 01-4 4H5"/><path d="M7 6L3 10l4 4"/></svg>`;
function renderShuttleIcon(size = 16, className = 'shuttle-icon') {
  return `<img class="${className}" src="icons/shuttlecock.png" width="${size}" height="${size}" alt="" aria-hidden="true" decoding="async">`;
}

function isSetLive(m, setN) {
  if (m.liveSet?.n === setN) return true;
  return (m.sets || []).some(s => s.n === setN && s.status === 'live');
}

function isMatchActive(m) {
  return m.status === 'active';
}

function getWinningTeamIds(m) {
  if (m.scoreA > m.scoreB) return m.teamA;
  if (m.scoreB > m.scoreA) return m.teamB;
  return null;
}

function getWinnerLabel(m) {
  if (m.result === 'draw') return 'Remis';
  const team = getWinningTeamIds(m);
  if (!team) return '—';
  const side = m.scoreA > m.scoreB ? 'A' : 'B';
  return formatTeam(team, getTeamMeta(m, side), m);
}

function avgSetDuration(m) {
  const sets = m.sets || [];
  if (!sets.length) return 0;
  return Math.round(sets.reduce((s, x) => s + (x.durationSec || 0), 0) / sets.length);
}

function totalPoints(m) {
  const sets = m.sets || [];
  return {
    a: sets.reduce((s, x) => s + x.scoreA, 0),
    b: sets.reduce((s, x) => s + x.scoreB, 0),
  };
}

function renderScore(scoreA, scoreB, live = false, sizeClass = '') {
  const draw = scoreA === scoreB;
  let clsA, clsB;
  if (live) {
    clsA = clsB = 'match-card__score-part--live';
  } else if (draw) {
    clsA = clsB = 'match-card__score-part--draw';
  } else {
    clsA = scoreA > scoreB ? 'match-card__score-part--win' : 'match-card__score-part--lose';
    clsB = scoreB > scoreA ? 'match-card__score-part--win' : 'match-card__score-part--lose';
  }
  const sz = sizeClass ? ` ${sizeClass}` : '';
  return `<span class="match-card__score-part ${clsA}${sz}">${scoreA}</span><span class="match-card__score-sep">:</span><span class="match-card__score-part ${clsB}${sz}">${scoreB}</span>`;
}

function renderMatchFace(m, { large = false, card = false, showClock = true, editableTeams = false, hideAvatars = false } = {}) {
  const live = isMatchLiveActive(m) && !isMatchEditMode(m);
  const phase = live ? getMatchPhase(m) : null;
  const avSize = 'avatar-sm';
  const teamEditable = editableTeams && m.teamA.length > 1;
  const avOpts = { editable: teamEditable };
  const boardCls = `${large ? 'match-board match-board--lg' : card ? 'match-board match-board--card' : 'match-board'}${hideAvatars ? ' match-board--names-only' : ''}${m.teamA.length < 2 ? ' match-board--singles' : ''}`;
  const metaA = getTeamMeta(m, 'A');
  const metaB = getTeamMeta(m, 'B');
  const nameA = formatTeam(m.teamA, metaA, m);
  const nameB = formatTeam(m.teamB, metaB, m);
  const hasTeamName = !!(metaA?.name?.trim() || metaB?.name?.trim());
  const namesBase = large
    ? `match-board__names match-board__names--lg${hasTeamName ? ' match-board__names--team' : ''}`
    : card ? `match-board__names match-board__names--card${hasTeamName ? ' match-board__names--team' : ''}` : 'match-board__names';
  const namesClsA = `${namesBase} ${matchNameLengthClass(nameA)}`.trim();
  const namesClsB = `${namesBase} ${matchNameLengthClass(nameB)}`.trim();
  const scoreCls = large ? 'match-board__score match-board__score--xl'
    : card ? 'match-board__score match-board__score--card' : 'match-board__score';
  const showClockRow = showClock && large && matchClockVisible(m);
  const frozen = matchClockFrozen(m);
  const clockCls = `match-board__clock match-board__clock--display${frozen ? ' match-board__clock--frozen' : ''}`;
  const showWarmupSub = shouldShowPreMatchSubClock(m);
  const showBreakSub = shouldShowBreakSubClock(m);

  return `
    <div class="${boardCls}">
      <div class="match-board__row">
        <div class="match-board__side match-board__side--a">
          <div class="match-board__side-inner">
            ${hideAvatars ? '' : renderTeamAvatarsForMatch(m, 'A', avSize, avOpts)}
            <div class="${namesClsA}">${nameA}</div>
          </div>
        </div>
        <div class="${scoreCls}">${renderScore(m.scoreA, m.scoreB, phase === 'live')}</div>
        <div class="match-board__side match-board__side--b">
          <div class="match-board__side-inner">
            <div class="${namesClsB}">${nameB}</div>
            ${hideAvatars ? '' : renderTeamAvatarsForMatch(m, 'B', avSize, avOpts)}
          </div>
        </div>
      </div>
      ${showClockRow ? `
        <div class="${clockCls}">
          <span class="match-board__clock-time" id="match-clock-display">${formatSportClock(getMatchClockElapsed(m))}</span>
          ${showWarmupSub ? `<span class="match-board__clock-sub match-board__clock-sub--warmup" id="match-warmup-clock">${formatSportClock(getPreMatchElapsed(m))}</span>` : ''}
          ${showBreakSub ? `<span class="match-board__clock-sub match-board__clock-sub--break" id="match-break-clock">${formatSportClock(getInterBreakElapsed(m))}</span>` : ''}
        </div>` : ''}
    </div>
  `;
}

function renderMatchResult(m) {
  if (isMatchLiveActive(m) && !isMatchEditMode(m)) {
    const phase = getMatchPhase(m);
    const cls = phase === 'break' ? ' match-card__result--break'
      : phase === 'warmup' ? ' match-card__result--warmup'
        : phase === 'serve_duel' ? ' match-card__result--serve' : '';
    return `<div class="match-card__result match-card__result--live${cls}">${renderMatchStatusBadge(m, true)}</div>`;
  }
  if (isMatchActive(m) && isMatchArchive(m)) {
    return `<div class="match-card__result match-card__result--archive">Archiwum</div>`;
  }
  if (m.result === 'draw') {
    return `<div class="match-card__result match-card__result--draw"><span class="match-card__result-label">Wynik meczu</span><span class="match-card__result-name">Remis</span></div>`;
  }
  const finishedWin = m.status === 'finished' && (m.result === 'win' || m.scoreA !== m.scoreB);
  if (finishedWin) {
    const myWin = isUserMatchWin(m);
    return `
      <div class="match-card__result match-card__result--win">
        <span class="match-card__result-label">${winnerLabelText(m)}</span>
        <span class="match-card__result-badge${myWin ? ' match-card__result-badge--gold' : ''}">
          ${myWin ? TROPHY_ICON : ''}
          <span class="match-card__result-name">${getWinnerLabel(m)}</span>
        </span>
      </div>`;
  }
  return '';
}

function renderSetRowShuttle(isLive) {
  const cls = `shuttle-icon set-row__shuttle-icon${isLive ? '' : ' shuttle-icon--muted'}`;
  return renderShuttleIcon(18, cls);
}

function getSet1FirstServer(m) {
  const finished = (m.sets || []).find(s => s.n === 1 && s.status !== 'live');
  if (finished?.firstServer) return finished.firstServer;
  if (m.liveSet?.n === 1 && m.liveSet.firstServer) return m.liveSet.firstServer;
  return null;
}

function getAlternatingFirstServer(m, setN) {
  const base = getSet1FirstServer(m);
  if (!base || !setN) return null;
  return setN % 2 === 1 ? base : (base === 'A' ? 'B' : 'A');
}

function getSetFirstServer(m, set) {
  if (set.firstServer) return set.firstServer;
  if (m.liveSet?.n === set.n && m.liveSet.firstServer) return m.liveSet.firstServer;
  return getAlternatingFirstServer(m, set.n);
}

function assignAlternatingFirstServer(m) {
  if (!m.liveSet || m.liveSet.firstServer) return;
  const alt = getAlternatingFirstServer(m, m.liveSet.n);
  if (alt) m.liveSet.firstServer = alt;
}

function getSetDisplayDuration(m, set) {
  if (typeof set.durationSec === 'number' && !Number.isNaN(set.durationSec)) return set.durationSec;
  if (isSetRowLive(m, set) && m.liveSet) {
    return getLiveSetElapsed(m) + (m.liveSet.serveSec || 0);
  }
  return null;
}

function isSetRowLive(m, set) {
  if (!hasActiveLiveSet(m) || !m.liveSet) return false;
  return m.liveSet.n === set.n;
}

function shouldShowSetDuration(m, set) {
  if (isSetRowLive(m, set)) return false;
  if (set.status === 'live') return false;
  return getSetDisplayDuration(m, set) !== null;
}

function renderSetRow(m, set) {
  const isLive = isSetRowLive(m, set);
  const scoreA = isLive && m.liveSet ? m.liveSet.scoreA : set.scoreA;
  const scoreB = isLive && m.liveSet ? m.liveSet.scoreB : set.scoreB;
  const firstServer = getSetFirstServer(m, set);
  const draw = scoreA === scoreB;
  const clsA = draw ? 'set-row__pts--draw' : (scoreA > scoreB ? 'set-row__pts--win' : 'set-row__pts--lose');
  const clsB = draw ? 'set-row__pts--draw' : (scoreB > scoreA ? 'set-row__pts--win' : 'set-row__pts--lose');
  const showDur = shouldShowSetDuration(m, set);
  const durSec = showDur ? getSetDisplayDuration(m, set) : null;
  const canCtx = canEditSetScores(m);
  const ctxOpen = canCtx && ctxTarget?.type === 'set' && ctxTarget.matchId === m.id && ctxTarget.setN === set.n;
  const setBadge = isLive && m.liveSet
    ? (m.liveSet.status === 'paused' ? renderBreakBadge(true) : renderLiveBadge(true))
    : '';
  const subLine = setBadge
    ? `<span class="set-row__sub">${setBadge}</span>`
    : (durSec != null ? `<span class="set-row__dur">${formatSportClock(durSec)}</span>` : '');
  return `
    <div class="set-row${isLive ? ' set-row--live' : ''}${ctxOpen ? ' set-row--ctx' : ''}" data-set-n="${set.n}" data-action="open-set">
      ${ctxOpen ? renderCtxActions('set', m.id, set.n) : ''}
      <div class="set-row__score-side set-row__score-side--a">
        ${firstServer === 'A' ? `<span class="set-row__serve">${renderSetRowShuttle(isLive)}</span>` : ''}
        <span class="set-row__pts ${clsA}">${scoreA}</span>
      </div>
      <div class="set-row__center">
        <span class="set-row__n">Set ${set.n}</span>
        ${subLine}
      </div>
      <div class="set-row__score-side set-row__score-side--b">
        <span class="set-row__pts ${clsB}">${scoreB}</span>
        ${firstServer === 'B' ? `<span class="set-row__serve">${renderSetRowShuttle(isLive)}</span>` : ''}
      </div>
    </div>
  `;
}

function renderMatchCard(m) {
  m = ensureMatchResultFields(m);
  const myWin = isUserMatchWin(m);
  const ctxOpen = ctxTarget?.type === 'match' && ctxTarget.id === m.id;
  const phase = isMatchLiveActive(m) ? getMatchPhase(m) : null;
  const activeCls = phase ? ' match-card--active' : '';
  return `
    <div class="match-card match-card--clickable${myWin ? ' match-card--my-win' : ''}${activeCls}${ctxOpen ? ' match-card--ctx' : ''}" data-match-id="${m.id}" role="button" tabindex="0">
      ${ctxOpen ? renderCtxActions('match', m.id) : ''}
      <div class="match-card__date">${formatDate(m.date)}</div>
      ${renderMatchFace(m, { card: true })}
      ${renderMatchResult(m)}
    </div>
  `;
}

function parseInfoStatPair(valA, valB) {
  const numA = parseFloat(String(valA).replace(',', '.'));
  const numB = parseFloat(String(valB).replace(',', '.'));
  if (Number.isNaN(numA) || Number.isNaN(numB)) return { hasBar: false, pctA: 50, pctB: 50 };
  if (numA === 0 && numB === 0) return { hasBar: false, pctA: 50, pctB: 50 };
  const total = numA + numB;
  if (total <= 0) return { hasBar: false, pctA: 50, pctB: 50 };
  return { hasBar: true, pctA: (numA / total) * 100, pctB: (numB / total) * 100 };
}

function renderInfoStatRow(label, valA, valB) {
  const { pctA, pctB, hasBar } = parseInfoStatPair(valA, valB);
  return `
    <div class="info-stat">
      <div class="info-stat__head">
        <span class="info-stat__val">${valA}</span>
        <span class="info-stat__label">${label}</span>
        <span class="info-stat__val info-stat__val--right">${valB}</span>
      </div>
      ${hasBar ? `
      <div class="info-stat__bar" aria-hidden="true">
        <span class="info-stat__bar-a" style="width:${pctA.toFixed(1)}%"></span>
        <span class="info-stat__bar-b" style="width:${pctB.toFixed(1)}%"></span>
      </div>` : ''}
    </div>
  `;
}

function renderMatchInfoPanel(m) {
  const side = computeSideStats(m);
  const match = computeMatchStats(m);

  return `
    <div class="match-info-layer">
      <div class="match-info-glass match-info-glass--panel">
        <div class="match-info-glass__sticky-back">
          <button class="match-info-glass__close match-info-glass__back-btn" data-action="close-match-info" type="button" aria-label="Wróć do meczu">${BACK_ICON}</button>
        </div>
        <div class="match-info-glass__body">
        <div class="match-info-glass__scoreboard">
          ${renderMatchFace(m, { large: true, showClock: false, hideAvatars: true })}
        </div>

        <p class="section-label">Statystyki stron</p>
        <div class="info-stats">
          ${renderInfoStatRow('Punkty łącznie', side.a.points, side.b.points)}
          ${renderInfoStatRow('Śr. punktów / set', side.a.avgPts, side.b.avgPts)}
          ${renderInfoStatRow('Sety na przewadze', side.a.marginSets, side.b.marginSets)}
          ${renderInfoStatRow('Najwyższa przewaga', side.a.maxMargin || '—', side.b.maxMargin || '—')}
        </div>

        <div class="info-divider"></div>

        <p class="section-label">Statystyki meczu</p>
        <div class="info-match-rows">
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Czas meczu</span><strong class="info-match-row__val info-match-row__val--live" id="info-stat-total">${formatSportClock(match.totalDur)}</strong></div>` : ''}
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Czas realnej gry</span><strong class="info-match-row__val info-match-row__val--live info-match-row__val--play" id="info-stat-play">${formatSportClock(match.playDur)}</strong></div>` : ''}
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Czas odpoczynku</span><strong class="info-match-row__val info-match-row__val--live info-match-row__val--rest" id="info-stat-rest">${formatSportClock(match.restDur)}</strong></div>` : ''}
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Średni czas seta</span><strong class="info-match-row__val">${formatSportClock(match.avgDur)}</strong></div>` : ''}
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Średni czas przerwy</span><strong class="info-match-row__val" id="info-stat-avg-break">${match.avgBreakDur ? formatSportClock(match.avgBreakDur) : '—'}</strong></div>` : ''}
          <div class="info-match-row"><span>Średnia punktów w secie (łącznie)</span><strong class="info-match-row__val">${match.avgPtsPerSet}</strong></div>
          <div class="info-match-row"><span>Sety na przewadze (łącznie)</span><strong class="info-match-row__val">${match.deuceSets}</strong></div>
          ${match.longestSet ? `<div class="info-match-row"><span>Najdłuższy set</span><strong class="info-match-row__val">Set ${match.longestSet.n} · ${formatSportClock(match.longestSet.durationSec)}</strong></div>` : ''}
          <div class="info-match-row"><span>Typ meczu</span><strong class="info-match-row__val">${m.teamA.length > 1 ? 'Debel' : 'Singiel'}</strong></div>
        </div>
        </div>
      </div>
    </div>
  `;
}

function renderWinnerBlock(m) {
  if (m.result === 'draw') {
    return `
      <div class="match-detail__winner">
        <span class="match-detail__winner-label">Wynik meczu</span>
        <strong class="match-detail__winner-name">Remis</strong>
      </div>`;
  }
  const myWin = isUserMatchWin(m);
  return `
    <div class="match-detail__winner${myWin ? ' match-detail__winner--gold' : ''}">
      ${myWin ? TROPHY_ICON : ''}
      <span class="match-detail__winner-label">${winnerLabelText(m)}</span>
      <strong class="match-detail__winner-name">${getWinnerLabel(m)}</strong>
    </div>`;
}

function ensureServeDuel(m, starterPlayerId = null) {
  if (!m.serveDuel) {
    m.serveDuel = {
      startedAt: Date.now(),
      serveSec: 0,
      serveTickAt: Date.now(),
      startedByPlayerId: starterPlayerId ?? userSession.playerId ?? null,
    };
    syncMatchPhase(m);
    touchMatchUpdated(m);
    saveState({ immediatePush: true });
  }
  return m.serveDuel;
}

function startServeDuel(m) {
  if (!userSession.playerId) {
    showToast('Zaloguj się, aby rozpocząć set', 'warn');
    return;
  }
  ensureServeDuel(m, userSession.playerId);
  servePickerMatchId = m.id;
  sessionStorage.setItem(SERVE_PICKER_KEY, String(m.id));
  requestWakeLock();
  ensureLivePhaseTimer(m);
}

function ensureLiveSet(m, opts = {}) {
  if (m.liveSet && !hasActiveLiveSet(m)) delete m.liveSet;
  if (m.liveSet) return m.liveSet;
  const n = (m.sets?.filter(s => s.status !== 'live').length || 0) + 1;
  m.liveSet = { n, scoreA: 0, scoreB: 0, elapsedSec: 0, status: 'idle', lastTickAt: null, firstServer: null, serveSec: 0 };
  touchMatchUpdated(m);
  if (!opts.silent) saveState({ immediatePush: true });
  return m.liveSet;
}

function beginLiveSet(m) {
  ensureLiveSet(m);
  const n = m.liveSet.n;
  if (!m.sets) m.sets = [];
  if (!m.sets.find(s => s.n === n && s.status === 'live')) {
    m.sets.push({ n, scoreA: 0, scoreB: 0, status: 'live' });
    touchMatchUpdated(m);
    saveState({ immediatePush: true });
  }
  if (m.liveSet.status === 'idle') startSetTimer(m);
  else if (m.liveSet.status === 'running') ensureSetTimerRunning(m);
}

function renumberMatchSets(m) {
  const sets = m.sets || [];
  if (!sets.length) return m;
  const sorted = [...sets].sort((a, b) => a.n - b.n);
  const map = new Map(sorted.map((s, i) => [s.n, i + 1]));
  m.sets = sorted.map((s, i) => {
    const nn = i + 1;
    return s.n === nn ? s : { ...s, n: nn };
  });
  if (m.liveSet && map.has(m.liveSet.n)) {
    const nn = map.get(m.liveSet.n);
    if (m.liveSet.n !== nn) m.liveSet = { ...m.liveSet, n: nn };
  }
  if (editSetN != null && map.has(editSetN)) editSetN = map.get(editSetN);
  if (setDetailN != null && map.has(setDetailN)) setDetailN = map.get(setDetailN);
  return m;
}

function clearServePickerTransition() {
  clearTimeout(servePickerConfirmTimer);
  clearTimeout(serveExpandFinalizeTimer);
  servePickerConfirmTimer = null;
  serveExpandFinalizeTimer = null;
  servePickerPhase = null;
  servePickerChosenSide = null;
}

function buildServeExpandPreview(m) {
  const n = (m.sets?.filter(s => s.status !== 'live').length || 0) + 1;
  return {
    ...m,
    liveSet: {
      n,
      scoreA: 0,
      scoreB: 0,
      elapsedSec: 0,
      status: 'idle',
      lastTickAt: null,
      firstServer: servePickerChosenSide,
      serveSec: getServeDuelElapsed(m),
    },
  };
}

function isServePickerActive(m) {
  if (!m) return false;
  if (servePickerPhase || servePickerMatchId === m.id) return true;
  if (isServeDuelActive(m)) return true;
  return !!document.querySelector('.serve-picker-layer');
}

function patchServePickerConfirm(side) {
  const layer = document.querySelector('.serve-picker-layer');
  if (!layer) return false;
  layer.classList.add('serve-picker-layer--confirm');
  layer.querySelectorAll('.serve-picker__choice').forEach(btn => {
    const selected = btn.dataset.side === side;
    btn.disabled = true;
    btn.classList.toggle('serve-picker__choice--selected', selected);
    btn.classList.toggle('serve-picker__choice--confirm', selected);
    if (selected && !btn.querySelector('.serve-picker__shuttle-confirm')) {
      btn.querySelector('.serve-picker__shuttle-hover')?.remove();
      btn.insertAdjacentHTML('afterbegin', `<span class="serve-picker__shuttle-confirm">${renderShuttleIcon(22, 'shuttle-icon serve-picker__shuttle-confirm-icon')}</span>`);
    }
  });
  const shell = layer.querySelector('.serve-expand-shell');
  if (shell) shell.classList.add('serve-expand-shell--confirm');
  layer.querySelector('[data-action="cancel-serve-picker-backdrop"]')?.setAttribute('disabled', '');
  syncMatchPageChrome();
  return true;
}

function patchServePickerExpand(m) {
  const layer = document.querySelector('.serve-picker-layer');
  const shell = layer?.querySelector('.serve-expand-shell');
  if (!layer || !shell) return false;
  layer.classList.remove('serve-picker-layer--confirm');
  layer.classList.add('serve-picker-layer--expand');
  layer.querySelector('[data-action="cancel-serve-picker-backdrop"]')?.remove();
  shell.classList.remove('serve-expand-shell--confirm');

  if (!shell.querySelector('.serve-expand-stage--set')) {
    const previewM = buildServeExpandPreview(m);
    const setBody = renderSetPlayOverlayBody(previewM, { readonly: !canEditMatch(m), showTitle: true });
    shell.insertAdjacentHTML('beforeend', `<div class="serve-expand-stage serve-expand-stage--set" aria-hidden="true">${setBody}</div>`);
  }

  void shell.offsetWidth;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      shell.classList.remove('serve-expand-shell--compact');
      shell.classList.add('serve-expand-shell--expanded');
    });
  });
  syncMatchPageChrome();
  return true;
}

function scheduleFinalizeAfterExpand(matchId, side) {
  const shell = document.querySelector('.serve-expand-shell');
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    shell?.removeEventListener('transitionend', onEnd);
    finalizeServeSide(matchId, side);
  };
  const onEnd = (e) => {
    if (e.target !== shell) return;
    if (e.propertyName === 'max-width' || e.propertyName === 'transform' || e.propertyName === 'min-height') finish();
  };
  if (shell?.classList.contains('serve-expand-shell--expanded')) {
    shell.addEventListener('transitionend', onEnd);
  }
  serveExpandFinalizeTimer = setTimeout(finish, SERVE_EXPAND_MS + 180);
}

function patchServePickerOverlay(m) {
  const page = document.querySelector('.match-page');
  if (!page) return false;
  const html = renderServePickerOverlay(m);
  const existing = page.querySelector('.serve-picker-layer');
  if (existing) existing.outerHTML = html;
  else page.insertAdjacentHTML('beforeend', html);
  syncMatchPageChrome();
  if (servePickerPhase === 'expand') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => patchServePickerExpand(m));
    });
  }
  return true;
}

function mountSetPlayOverlayInPlace(m) {
  const page = document.querySelector('.match-page');
  if (!page) return false;
  if (document.querySelector('.serve-expand-shell:not(.serve-expand-shell--live)')) {
    return morphServePickerToLiveSetView(m);
  }
  document.querySelector('.serve-picker-layer')?.remove();
  if (page.querySelector('.set-play-glass')) return true;
  page.insertAdjacentHTML('beforeend', renderSetPlayOverlay(m));
  syncMatchPageChrome();
  ensureSetTimerRunning(m);
  updateSetPlayDOM(m);
  scheduleMatchFaceFit();
  return true;
}

function morphServePickerToLiveSetView(m) {
  const shell = document.querySelector('.serve-expand-shell');
  if (!shell || openMatchId !== m.id) return false;
  shell.classList.remove('serve-expand-shell--compact', 'serve-expand-shell--expanded', 'serve-expand-shell--confirm');
  shell.classList.add('serve-expand-shell--live', 'set-play-glass');
  shell.querySelector('.serve-expand-stage--picker')?.remove();
  const setStage = shell.querySelector('.serve-expand-stage--set');
  if (setStage) {
    setStage.classList.remove('serve-expand-stage', 'serve-expand-stage--set');
    setStage.removeAttribute('aria-hidden');
  }
  const layer = shell.closest('.overlay-layer');
  if (layer) layer.classList.remove('serve-picker-layer', 'serve-picker-layer--confirm', 'serve-picker-layer--expand');
  const closeBtn = shell.querySelector('.match-info-glass__close, .set-play-glass__back');
  if (!closeBtn) {
    shell.insertAdjacentHTML('afterbegin', `<button class="match-info-glass__close set-play-glass__back" data-action="close-set-play" type="button" aria-label="Wróć do meczu">${BACK_ICON}</button>`);
  } else {
    closeBtn.disabled = false;
    closeBtn.removeAttribute('aria-hidden');
    closeBtn.tabIndex = 0;
    closeBtn.dataset.action = 'close-set-play';
    closeBtn.classList.remove('set-play-glass__close--pending');
    closeBtn.classList.add('set-play-glass__back');
    closeBtn.setAttribute('aria-label', 'Wróć do meczu');
    closeBtn.innerHTML = BACK_ICON;
  }
  syncMatchAsideFromModel(m);
  updateMatchDetailLiveBadge(m);
  syncMatchPageChrome();
  ensureSetTimerRunning(m);
  updateSetPlayDOM(m);
  scheduleMatchFaceFit();
  return true;
}

function finalizeServeSide(matchId, side) {
  const m = matches.find(x => x.id === matchId);
  if (!m?.serveDuel && !servePickerPhase) return;
  beginLiveSettling(4000);
  const serveSec = getServeDuelElapsed(m);
  delete m.serveDuel;
  servePickerMatchId = null;
  sessionStorage.removeItem(SERVE_PICKER_KEY);
  releaseWakeLock();
  clearSetTimer();
  ensureLiveSet(m, { silent: true });
  m.liveSet.firstServer = side;
  m.liveSet.serveSec = serveSec;
  const n = m.liveSet.n;
  if (!m.sets) m.sets = [];
  if (!m.sets.find(s => s.n === n && s.status === 'live')) {
    m.sets.push({ n, scoreA: 0, scoreB: 0, status: 'live' });
  }
  startSetTimer(m, { silent: true });
  setPlayOpen = true;
  const hadExpandShell = !!document.querySelector('.serve-expand-shell--expanded, .serve-expand-shell:not(.serve-expand-shell--live)');
  clearServePickerTransition();
  if (openMatchId === m.id) {
    if (hadExpandShell) {
      if (!morphServePickerToLiveSetView(m)) mountSetPlayOverlayInPlace(m);
    } else {
      mountSetPlayOverlayInPlace(m);
    }
    updateMatchDetailLiveBadge(m);
    syncMatchAsideFromModel(m);
    syncMatchPageChrome();
  } else {
    render();
  }
  touchMatchUpdated(m);
  saveState({ immediatePush: true });
}

function confirmServeSide(m, side) {
  if (!m?.serveDuel || servePickerPhase) return;
  servePickerChosenSide = side;
  servePickerPhase = 'confirm';
  if (openMatchId === m.id) {
    if (!patchServePickerConfirm(side)) patchServePickerOverlay(m);
  } else {
    render();
  }
  clearTimeout(servePickerConfirmTimer);
  servePickerConfirmTimer = setTimeout(() => {
    servePickerPhase = 'expand';
    if (openMatchId === m.id) {
      if (!patchServePickerExpand(m)) patchServePickerOverlay(m);
    } else {
      render();
    }
    servePickerConfirmTimer = setTimeout(() => scheduleFinalizeAfterExpand(m.id, side), SERVE_EXPAND_MS);
  }, SERVE_CONFIRM_MS);
}

function cancelServePicker(m) {
  if (!m?.serveDuel) return;
  clearServePickerTransition();
  delete m.serveDuel;
  servePickerMatchId = null;
  sessionStorage.removeItem(SERVE_PICKER_KEY);
  releaseWakeLock();
  clearSetTimer();
  syncMatchPhase(m);
  touchMatchUpdated(m);
  saveState({ immediatePush: true });
  setPlayOpen = false;
  render();
}

function removeLiveSetFromMatch(m, setN) {
  m.sets = (m.sets || []).filter(s => s.n !== setN);
  if (m.liveSet?.n === setN) {
    delete m.liveSet;
    clearSetTimer();
    syncMatchPhase(m);
    if (!hasFinishedSets(m)) resetMatchToWarmup(m);
  }
  recalcMatchScores(m);
  touchMatchUpdated(m);
  saveState({ immediatePush: true });
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  render();
}

function commitLiveSet(m, auto = false) {
  if (!m.liveSet) return false;
  pauseLiveSet(m);
  const ls = m.liveSet;
  if (ls.scoreA === ls.scoreB) {
    alert('W secie nie może być remisu');
    return false;
  }
  if (ls.scoreA === 0 && ls.scoreB === 0 && !auto) {
    alert('Dodaj wynik seta przed zakończeniem');
    return false;
  }
  resolveMatchGuests(m);
  const playSec = getLiveSetElapsed(m) + (ls.serveSec || 0);
  const setData = {
    n: ls.n,
    scoreA: ls.scoreA,
    scoreB: ls.scoreB,
    durationSec: isMatchArchive(m) ? 0 : playSec,
    status: 'finished',
    firstServer: ls.firstServer || undefined,
  };
  const idx = m.sets.findIndex(s => s.n === ls.n);
  if (idx >= 0) m.sets[idx] = setData;
  else m.sets.push(setData);
  m.sets = (m.sets || []).filter(s => !(s.n === ls.n && s.status === 'live'));
  recalcMatchScores(m);
  delete m.liveSet;
  clearSetTimer();
  syncMatchPhase(m);
  ensureMatchClockRunning(m);
  touchMatchUpdated(m);
  beginLiveSettling(3000);
  saveState({ immediatePush: true });
  updateMatchBoardFromModel(m);
  updateSetListFromModel(m);
  return true;
}

async function finishLiveSet(m) {
  if (!m.liveSet) return;
  syncScoresFromSetForm(m);
  const ls = m.liveSet;
  if (ls.scoreA === ls.scoreB) {
    alert('W secie nie może być remisu');
    return;
  }
  if (isSetComplete(ls.scoreA, ls.scoreB)) {
    if (commitLiveSet(m, true)) {
      setPlayOpen = false;
      render();
    }
    return;
  }
  const ok = await showAppConfirm({
    title: 'Niepełny set',
    message: 'Wynik nie kończy seta według zasad badmintona. Zapisać niepełny set?',
    confirmLabel: 'Zapisz',
  });
  if (!ok) return;
  if (commitLiveSet(m, true)) {
    setPlayOpen = false;
    render();
  }
}

function syncScoresFromSetForm(m) {
  if (!m.liveSet) return;
  const root = getActiveSetPlayRoot();
  const inputA = root?.querySelector('#set-score-a') ?? document.getElementById('set-score-a');
  const inputB = root?.querySelector('#set-score-b') ?? document.getElementById('set-score-b');
  const modelA = m.liveSet.scoreA ?? 0;
  const modelB = m.liveSet.scoreB ?? 0;
  const domA = parseInt(inputA?.value, 10);
  const domB = parseInt(inputB?.value, 10);
  const aValid = !isNaN(domA) && domA >= 0;
  const bValid = !isNaN(domB) && domB >= 0;
  if (aValid && bValid) {
    // Nie nadpisuj wyniku z przycisków +/- zerami z nieaktualnego pola formularza
    if (domA + domB >= modelA + modelB) {
      m.liveSet.scoreA = domA;
      m.liveSet.scoreB = domB;
    }
  } else {
    if (aValid) m.liveSet.scoreA = domA;
    if (bValid) m.liveSet.scoreB = domB;
  }
  const row = m.sets?.find(s => s.n === m.liveSet.n);
  if (row) {
    row.scoreA = m.liveSet.scoreA;
    row.scoreB = m.liveSet.scoreB;
  }
}

function tryAutoFinishLiveSetIfComplete(m) {
  if (!m?.liveSet) return false;
  const { scoreA, scoreB } = m.liveSet;
  if (scoreA === scoreB || !isSetComplete(scoreA, scoreB)) return false;
  if (!commitLiveSet(m, true)) return false;
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  render();
  return true;
}

function adjustLiveScore(m, side, delta) {
  if (!m.liveSet) return;
  const key = side === 'A' ? 'scoreA' : 'scoreB';
  m.liveSet[key] = Math.max(0, (m.liveSet[key] || 0) + delta);
  const liveRow = m.sets?.find(s => s.n === m.liveSet.n);
  if (liveRow) {
    liveRow.scoreA = m.liveSet.scoreA;
    liveRow.scoreB = m.liveSet.scoreB;
  }
  touchMatchUpdated(m);
  if (delta > 0 && tryAutoFinishLiveSetIfComplete(m)) return;
  saveState({ immediatePush: true });
  updateSetPlayDOM(m);
}

function renderSetClockControls(m, readonly = false) {
  if (readonly) return '';
  const ls = m.liveSet;
  if (!ls || ls.status === 'idle') return '';
  const paused = ls.status === 'paused';
  return `
    <div class="match-board__clock-ctl">
      ${paused
        ? `<button class="clock-ctl" data-action="resume-set-timer" type="button" aria-label="Wznów">${PLAY_ICON}</button>`
        : `<button class="clock-ctl" data-action="pause-set-timer" type="button" aria-label="Pauza">${PAUSE_ICON}</button>`}
    </div>`;
}

function updateMatchDetailLiveBadge(m) {
  const hero = document.querySelector('.match-detail__hero');
  if (!hero) return;
  let el = hero.querySelector('.match-detail__live');
  const finished = m.status === 'finished' && !reopenMatchEdit;
  if (finished) {
    const html = `<div class="match-detail__live match-detail__live--finished">${renderFinishedBadge(true)}</div>`;
    if (el) {
      el.outerHTML = html;
    } else {
      const dateEl = hero.querySelector('.match-detail__date');
      if (dateEl) dateEl.insertAdjacentHTML('afterend', html);
    }
    return;
  }
  if (el && isMatchLiveActive(m) && !reopenMatchEdit) {
    el.className = 'match-detail__live';
    el.innerHTML = renderMatchStatusBadge(m, true);
  } else if (el && !isMatchLiveActive(m)) {
    el.remove();
  }
}

function updateMatchDetailWinner(m) {
  const aside = document.querySelector('.match-page__aside');
  if (!aside) return;
  const existing = aside.querySelector('.match-detail__winner');
  if (reopenMatchEdit || m.status !== 'finished') {
    existing?.remove();
    return;
  }
  if (m.result !== 'win' && m.result !== 'draw') return;
  if (existing) return;
  const statsLink = aside.querySelector('.match-detail__stats-link');
  const html = renderWinnerBlock(m);
  if (statsLink) statsLink.insertAdjacentHTML('beforebegin', html);
}

function updateMatchBoardFromModel(m) {
  const scoreEl = document.querySelector('.match-board--lg .match-board__score');
  if (!scoreEl) return;
  const live = isMatchLiveActive(m) && !isMatchEditMode(m);
  const phase = live ? getMatchPhase(m) : null;
  scoreEl.innerHTML = renderScore(m.scoreA, m.scoreB, phase === 'live');
}

function getMatchSetListRows(m) {
  m = persistScrubbedMatch(m);
  let sets = [...(m.sets || [])];
  if (m.liveSet && hasActiveLiveSet(m) && !sets.some(s => s.n === m.liveSet.n)) {
    sets.push({
      n: m.liveSet.n,
      scoreA: m.liveSet.scoreA ?? 0,
      scoreB: m.liveSet.scoreB ?? 0,
      status: 'live',
      firstServer: m.liveSet.firstServer,
    });
  }
  return sets.filter(s => s.status !== 'live' || (m.liveSet && s.n === m.liveSet.n));
}

function updateSetListFromModel(m) {
  const list = document.querySelector('.match-page .set-list');
  if (!list) return;
  m = persistScrubbedMatch(m);
  const displaySets = getMatchSetListRows(m);
  list.innerHTML = displaySets.length
    ? displaySets.map(s => renderSetRow(m, s)).join('')
    : '<p class="match-detail__empty">Brak rozegranych setów</p>';
}

function refreshMatchFaceAvatars(m) {
  const board = document.querySelector('.match-board--lg');
  if (!board) return;
  ['A', 'B'].forEach(side => {
    const sideEl = board.querySelector(`.match-board__side--${side.toLowerCase()}`);
    if (!sideEl) return;
    const avatars = sideEl.querySelector('.match-card__avatars');
    if (avatars) avatars.outerHTML = renderSideAvatars(m, side, 'avatar-sm');
  });
}

function refreshSetPlayAvatars(m) {
  document.querySelectorAll('.set-play__side').forEach(sideEl => {
    const side = sideEl.classList.contains('set-play__side--a') ? 'A' : 'B';
    const wrap = sideEl.querySelector('.set-play__avatar-wrap');
    if (!wrap) return;
    const avatars = wrap.querySelector('.match-card__avatars');
    const avHtml = renderSideAvatars(m, side, 'avatar-sm');
    if (avatars) avatars.outerHTML = avHtml;
  });
}

function softUpdatePlayerDetail(playerId) {
  const player = getPlayer(playerId);
  if (!player) {
    openPlayerId = null;
    render();
    return;
  }
  const stats = computePlayerStats(playerId);
  const statMap = {
    'Rozegrane mecze': stats.matchesPlayed,
    'Rozegrane sety': stats.setsPlayed,
    'Wygrane mecze': stats.matchesWon,
    'Wygrane sety': stats.setsWon,
    'Łączny czas gry': formatDuration(stats.totalPlaySec),
    'Śr. punktów / mecz': stats.avgPointsPerMatch,
  };
  document.querySelectorAll('.player-stat-row').forEach(row => {
    const label = row.querySelector('.player-stat-row__label')?.textContent;
    const valEl = row.querySelector('.player-stat-row__value');
    if (label && valEl && statMap[label] !== undefined) valEl.textContent = statMap[label];
  });
  const nameEl = document.querySelector('.player-detail__name');
  if (nameEl) nameEl.textContent = player.displayName;
}

function renderRegisteredPlayerCard(p, wins) {
  const liveMatch = getPlayerLiveMatch(p.id);
  const avatarUrl = getPlayerAvatarUrl(p.id);
  return `
    <button class="player-card player-card--btn${p.id === userSession.playerId ? ' player-card--me' : ''}" data-action="open-player" data-player-id="${p.id}" type="button">
      ${renderAvatarHtml(p.displayName, avatarUrl, 'player-card__avatar')}
      <div class="player-card__name">${escAttr(p.displayName)}</div>
      <div class="player-card__record"><span>${wins[p.id] || 0}</span> wygranych</div>
      ${renderEntityLiveLink(liveMatch)}
    </button>`;
}

function renderGuestRosterCard(p, wins) {
  const liveMatch = getPlayerLiveMatch(p.id);
  const avatarUrl = getPlayerAvatarUrl(p.id);
  const winCount = wins[p.id] || 0;
  return `
    <button class="player-card player-card--btn player-card--guest-tile" data-action="open-player" data-player-id="${p.id}" type="button">
      ${renderAvatarHtml(p.displayName, avatarUrl, 'player-card__avatar player-card__avatar--guest')}
      <div class="player-card__name">${escAttr(p.displayName)}</div>
      ${winCount ? `<div class="player-card__record"><span>${winCount}</span> wygr.</div>` : ''}
      ${liveMatch ? renderEntityLiveLink(liveMatch) : '<span class="player-card__badge">Gość</span>'}
    </button>`;
}

function renderTeamCardButton(t, teamWins) {
  const liveMatch = getTeamLiveMatch(t.id);
  const { title, subtitle } = getTeamDisplayLines(t);
  return `
    <button class="player-card player-card--btn" data-action="open-team" data-team-id="${t.id}" type="button">
      ${renderTeamEntityAvatar(t, 'player-card__avatar', { border: 'plain' })}
      <div class="player-card__name">${escAttr(title)}</div>
      <div class="player-card__record"><span>${teamWins[t.id] || 0}</span> wygranych</div>
      ${renderEntityLiveLink(liveMatch)}
      ${subtitle ? `<div class="player-card__record">${escAttr(subtitle)}</div>` : ''}
    </button>`;
}

function softUpdateTeamsTab() {
  const teamWins = computeTeamWins();
  const grid = document.querySelector('.players-page .player-grid');
  if (!grid) return;
  grid.innerHTML = teams.length
    ? teams.map(t => renderTeamCardButton(t, teamWins)).join('')
    : '';
}

function softUpdatePlayersTab() {
  if (openTeamId || newTeamOpen) return;
  if (playersRosterTab === 'teams') {
    softUpdateTeamsTab();
    return;
  }
  const wins = computeWins();
  const registeredGrid = document.querySelector('.content > .player-grid');
  if (registeredGrid) {
    const registered = players.filter(p => !p.isGuest);
    registeredGrid.innerHTML = registered.length ? registered.map(p => renderRegisteredPlayerCard(p, wins)).join('') : '';
  }
  const guestGrid = document.querySelector('.players-guest-section .player-grid');
  if (guestGrid) {
    const guests = players.filter(p => p.isGuest);
    guestGrid.innerHTML = guests.length ? guests.map(p => renderGuestRosterCard(p, wins)).join('') : '';
  }
}

function captureMatchSyncSnapshot() {
  if (!openMatchId) return null;
  const m = matches.find(x => x.id === openMatchId);
  if (!m) return null;
  return {
    liveSetN: m.liveSet?.n ?? null,
    serveDuel: isServeDuelActive(m),
    setPlayOpen,
    setDetailN,
    editSetN,
  };
}

function reconcileRemoteMatchView(before, m) {
  if (!before || !m) return {};
  const liveSetEnded = before.liveSetN != null && !m.liveSet;
  const liveSetReplaced = before.liveSetN != null && m.liveSet && before.liveSetN !== m.liveSet.n;
  const serveDuelEndedWithSet = before.serveDuel && !isServeDuelActive(m) && !!m.liveSet;
  const serveFlowCanceled = before.serveDuel && !isServeDuelActive(m) && !m.liveSet;
  const liveSetStarted = hasActiveLiveSet(m) && (
    serveDuelEndedWithSet ||
    before.liveSetN == null ||
    before.liveSetN !== m.liveSet.n
  );
  const serveDuelStarted = !before.serveDuel && isServeDuelActive(m);
  return {
    closeSetPlay: liveSetEnded || serveFlowCanceled,
    mountSetPlay: liveSetStarted && before.setPlayOpen && !before.setDetailN && !before.editSetN,
    liveSetStarted,
    serveDuelStarted,
    liveSetEnded: liveSetEnded || serveFlowCanceled,
  };
}

function resetOpenMatchLiveSession() {
  clearServePickerTransition();
  liveSettlingUntil = 0;
  servePickerMatchId = null;
  sessionStorage.removeItem(SERVE_PICKER_KEY);
  releaseWakeLock();
}

function renderMatchResumeBtn(m) {
  const editing = isMatchEditMode(m);
  const active = isMatchActive(m);
  const editable = canEditMatch(m);
  const hasOngoingSet = hasActiveLiveSet(m);
  if (!hasOngoingSet) return '';
  if ((active || editing) && editable) {
    return `<button class="btn btn--primary btn--full match-actions__resume" data-action="resume-set-play" type="button">Wróć do seta na żywo</button>`;
  }
  if (active && !editable) {
    return `<button class="btn btn--secondary btn--full match-actions__resume" data-action="resume-set-play" type="button">Oglądaj set na żywo</button>`;
  }
  return '';
}

function renderMatchActionsHtml(m) {
  const editing = isMatchEditMode(m);
  const active = isMatchActive(m);
  const editable = canEditMatch(m);
  const archive = isMatchArchive(m);
  const duelActive = isServeDuelActive(m);
  const hasOngoingSet = hasActiveLiveSet(m);
  const canPlaySet = editable && (active || editing) && !hasOngoingSet && !duelActive;
  const duelBlocksPlay = editable && (active || editing) && !hasOngoingSet && duelActive;
  const canEnd = editable && canEndMatch(m);
  const playSetLabel = reopenMatchEdit ? 'Dodaj set' : 'Rozegraj set';

  if ((active || editing) && editable) {
    return `
              <div class="match-actions">
                ${canPlaySet ? `<button class="btn btn--primary btn--full" data-action="play-set" type="button">${playSetLabel}</button>` : ''}
                ${duelBlocksPlay ? `<button class="btn btn--primary btn--full btn--disabled" type="button" disabled>${playSetLabel}</button>` : ''}
                <button class="btn btn--accent btn--full match-actions__end${canEnd ? '' : ' btn--disabled'}" data-action="end-match" type="button"${canEnd ? '' : ' disabled'}>${archive || editing ? 'Zapisz mecz' : 'Zakończ mecz'}</button>
                ${editing ? `<button class="set-play__cancel" data-action="cancel-match-edit" type="button" aria-label="Anuluj zmiany">${CANCEL_SET_ICON} Anuluj zmiany</button>` : ''}
              </div>`;
  }
  if (active && !editable && duelActive) {
    return `
              <div class="match-actions">
                ${duelBlocksPlay ? `<button class="btn btn--primary btn--full btn--disabled" type="button" disabled>${playSetLabel}</button>` : ''}
              </div>`;
  }
  return '';
}

function syncMatchAsideFromModel(m) {
  if (openMatchId !== m.id) return;
  updateSetListFromModel(m);
  updateMatchActionsFromModel(m);
}

function updateMatchResumeBtn(m) {
  const aside = document.querySelector('.match-page__aside');
  if (!aside) return;
  const html = renderMatchResumeBtn(m);
  const existing = aside.querySelector('.match-actions__resume');
  if (!html) {
    existing?.remove();
    return;
  }
  if (existing) existing.outerHTML = html;
  else {
    const setList = aside.querySelector('.set-list');
    if (setList) setList.insertAdjacentHTML('afterend', html);
    else aside.insertAdjacentHTML('afterbegin', html);
  }
}

function updateMatchActionsFromModel(m) {
  updateMatchResumeBtn(m);
  const aside = document.querySelector('.match-page__aside');
  if (!aside) return;
  const html = renderMatchActionsHtml(m);
  const actions = aside.querySelector('.match-actions');
  if (!html) {
    actions?.remove();
    return;
  }
  if (actions) actions.outerHTML = html;
  else {
    const statsLink = aside.querySelector('.match-detail__stats-link');
    if (statsLink) statsLink.insertAdjacentHTML('beforebegin', html);
    else aside.insertAdjacentHTML('beforeend', html);
  }
}

function dismissAllMatchOverlays() {
  resetOpenMatchLiveSession();
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  clearSetTimer();
  document.querySelectorAll('.match-page .overlay-layer').forEach(el => el.remove());
  syncMatchPageChrome();
}

function dismissSetPlayOverlay() {
  const m = openMatchId ? matches.find(x => x.id === openMatchId) : null;
  if (isServePickerActive(m) && !document.querySelector('.serve-expand-shell--expanded, .serve-expand-shell--live')) return false;
  const hadOverlay = setPlayOpen || document.querySelector('.match-page .set-play-glass');
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  clearSetTimer();
  document.querySelectorAll('.match-page .overlay-layer').forEach(el => {
    if (el.classList.contains('serve-picker-layer') && !el.classList.contains('serve-picker-layer--expand')) return;
    if (el.querySelector('.set-play-glass')) el.remove();
  });
  if (hadOverlay) syncMatchPageChrome();
  return !!hadOverlay;
}

function syncMatchPageChrome() {
  const page = document.querySelector('.match-page');
  const m = openMatchId ? matches.find(x => x.id === openMatchId) : null;
  const servePickerOpen = !!(m && canShowServePicker(m));
  if (page) page.classList.toggle('match-page--info-open', !!(setPlayOpen || matchInfoOpen || servePickerOpen));
  syncOrientationLayout();
  updateAppChrome();
}

function isServePickerTransitioning() {
  return !!servePickerPhase || isLiveSettling();
}

function matchDetailHasLiveOverlay() {
  return !!(document.querySelector('.match-page .set-play-glass')
    || document.querySelector('.serve-expand-shell')
    || document.querySelector('.serve-picker-layer'));
}

function shouldAvoidMatchDetailRender() {
  if (openMatchId && isServePickerTransitioning()) return true;
  if (document.querySelector('.serve-expand-shell:not(.serve-expand-shell--live)')) return true;
  return matchDetailHasLiveOverlay();
}

function softUpdateMatchDetail(m, remoteHints = {}) {
  m = persistScrubbedMatch(m);
  const transitioning = isServePickerTransitioning() && openMatchId === m.id;
  const serveActive = openMatchId === m.id && isServePickerActive(m);

  if (!transitioning && !serveActive && openMatchId === m.id && !m.liveSet && setPlayOpen && !setDetailN && !editSetN) {
    dismissAllMatchOverlays();
  } else if (remoteHints.closeSetPlay && openMatchId === m.id) {
    resetOpenMatchLiveSession();
    dismissAllMatchOverlays();
  }

  if (remoteHints.liveSetEnded && openMatchId === m.id) {
    resetOpenMatchLiveSession();
    dismissAllMatchOverlays();
    syncMatchAsideFromModel(m);
    updateMatchDetailLiveBadge(m);
    updateMatchBoardFromModel(m);
    return;
  }

  if ((remoteHints.liveSetStarted || remoteHints.serveDuelStarted) && openMatchId === m.id) {
    syncMatchAsideFromModel(m);
    updateMatchDetailLiveBadge(m);
    if (isServeDuelActive(m)) ensureLivePhaseTimer(m);
    else if (hasActiveLiveSet(m) && m.liveSet?.status === 'running') ensureSetTimerRunning(m);
  }

  if (m.liveSet && servePickerMatchId === m.id && !servePickerPhase && !isLiveSettling() && !document.querySelector('.serve-picker-layer')) {
    servePickerMatchId = null;
    sessionStorage.removeItem(SERVE_PICKER_KEY);
    releaseWakeLock();
  }

  if (transitioning) {
    if (openMatchId === m.id) syncMatchAsideFromModel(m);
    updateMatchDetailLiveBadge(m);
    return;
  }

  updateMatchClockDOM(m);
  updateMatchDetailLiveBadge(m);
  updateMatchDetailWinner(m);
  updateMatchBoardFromModel(m);
  refreshMatchFaceAvatars(m);
  syncMatchAsideFromModel(m);

  if (setPlayOpen && !setDetailN && !editSetN && m.liveSet) {
    if (!document.querySelector('.set-play-glass') && !shouldAvoidMatchDetailRender()) {
      mountSetPlayOverlayInPlace(m);
    }
    if (m.liveSet.status === 'running') ensureSetTimerRunning(m);
    updateSetPlayDOM(m);
    refreshSetPlayAvatars(m);
  } else if (remoteHints.mountSetPlay && hasActiveLiveSet(m) && !shouldAvoidMatchDetailRender()) {
    setPlayOpen = true;
    mountSetPlayOverlayInPlace(m);
    syncMatchAsideFromModel(m);
  }

  if (matchInfoOpen) updateLiveTimingDOM(m);
  if (openMatchId === m.id && m.liveSet) updateLiveScoresDOM(m);
  if (openMatchId === m.id) updateMatchBoardFromModel(m);
}

function softUpdateMatchList() {
  const label = document.querySelector('.matches-page__main > .section-label');
  if (label) label.textContent = `${matches.length} meczów`;
  const list = document.querySelector('.match-list');
  if (list) list.innerHTML = matches.map(renderMatchCard).join('');
}

function applyLeagueStateToUI() {
  ensureLiveMatchTickers();
  updateHeaderAvatar();
  if (profileOpen) {
    updateProfileSyncBadgeDOM();
    return;
  }
  if (currentTab === 'matches') {
    if (openMatchId && !matches.some(m => m.id === openMatchId)) {
      closeMatch();
      softUpdateMatchList();
      return;
    }
    if (openMatchId) {
      const m = matches.find(x => x.id === openMatchId);
      if (m) {
        const hints = pendingRemoteMatchUi || {};
        pendingRemoteMatchUi = null;
        softUpdateMatchDetail(m, hints);
        return;
      }
    }
    softUpdateMatchList();
    return;
  }
  if (currentTab === 'players') {
    if (openTeamId && !profileOpen) {
      if (!teams.some(t => t.id === openTeamId)) {
        openTeamId = null;
        if (playersRosterTab === 'teams') softUpdateTeamsTab();
        else softUpdatePlayersTab();
      }
      return;
    }
    if (openPlayerId && !profileOpen) {
      if (!players.some(p => p.id === openPlayerId)) {
        openPlayerId = null;
        softUpdatePlayersTab();
        return;
      }
      softUpdatePlayerDetail(openPlayerId);
      return;
    }
    if (!openPlayerId && !profileOpen) {
      softUpdatePlayersTab();
      return;
    }
  }
  if (openMatchId && shouldAvoidMatchDetailRender()) {
    const m = matches.find(x => x.id === openMatchId);
    if (m) {
      const hints = pendingRemoteMatchUi || {};
      pendingRemoteMatchUi = null;
      softUpdateMatchDetail(m, hints);
      return;
    }
  }
  content?.classList.add('content--remote-sync');
  requestAnimationFrame(() => {
    render();
    requestAnimationFrame(() => content?.classList.remove('content--remote-sync'));
  });
}

function updateSetPlayDOM(m) {
  const ls = m.liveSet;
  if (!ls) return;
  updateLiveScoresDOM(m);
  updateSetPlayClock(m);
  const clockWrap = document.querySelector('.set-play__clock-wrap');
  if (clockWrap) {
    const badge = clockWrap.querySelector('.live-badge');
    const wantBreak = ls.status === 'paused';
    const wantLive = ls.status === 'running';
    const badgeHtml = wantBreak ? renderBreakBadge(true) : wantLive ? renderLiveBadge(true) : '';
    if ((wantLive || wantBreak) && !badge) {
      clockWrap.insertAdjacentHTML('afterbegin', badgeHtml);
    } else if (badge && badgeHtml) {
      badge.outerHTML = badgeHtml;
    } else if (badge && !badgeHtml) {
      badge.remove();
    }
    const clockEl = document.getElementById('set-play-clock');
    if (clockEl) clockEl.classList.remove('set-play__clock--break');
    const ctl = clockWrap.querySelector('.match-board__clock-ctl');
    const ctlHtml = renderSetClockControls(m);
    if (ctlHtml && !ctl) {
      clockWrap.insertAdjacentHTML('beforeend', ctlHtml);
    } else if (!ctlHtml && ctl) {
      ctl.remove();
    } else if (ctl && ctlHtml) {
      ctl.outerHTML = ctlHtml;
    }
  }
  const mainBtn = document.querySelector('[data-action="finish-live-set"]');
  if (mainBtn) mainBtn.hidden = false;
  scheduleMatchFaceFit();
}

function renderServePickerChoice(m, side) {
  const meta = getTeamMeta(m, side);
  const ids = side === 'A' ? m.teamA : m.teamB;
  const name = formatTeam(ids, meta, m);
  const selected = servePickerChosenSide === side;
  const confirming = servePickerPhase === 'confirm' && selected;
  return `
    <button class="serve-picker__choice${selected ? ' serve-picker__choice--selected' : ''}${confirming ? ' serve-picker__choice--confirm' : ''}" data-action="pick-server" data-side="${side}" type="button"${servePickerPhase ? ' disabled' : ''}>
      ${confirming ? `<span class="serve-picker__shuttle-confirm">${renderShuttleIcon(22, 'shuttle-icon serve-picker__shuttle-confirm-icon')}</span>` : `<span class="serve-picker__shuttle-hover" aria-hidden="true">${renderShuttleIcon(20, 'shuttle-icon serve-picker__shuttle-hover-icon')}</span>`}
      ${renderSideAvatars(m, side, 'avatar-sm')}
      <span class="serve-picker__name">${name}</span>
    </button>`;
}

function renderServePickerOverlay(m) {
  const expanding = servePickerPhase === 'expand';
  const confirming = servePickerPhase === 'confirm';
  const closeDisabled = confirming || expanding;
  const previewM = expanding ? buildServeExpandPreview(m) : null;
  const setStage = expanding && previewM
    ? `<div class="serve-expand-stage serve-expand-stage--set">${renderSetPlayOverlayBody(previewM, { readonly: !canEditMatch(m), showTitle: true })}</div>`
    : '';
  return `
    <div class="overlay-layer serve-picker-layer${confirming ? ' serve-picker-layer--confirm' : ''}${expanding ? ' serve-picker-layer--expand' : ''}">
      <button class="overlay-layer__backdrop" data-action="cancel-serve-picker-backdrop" type="button" aria-label="Anuluj"${closeDisabled ? ' disabled' : ''}></button>
      <div class="overlay-glass overlay-glass--static serve-expand-shell serve-expand-shell--compact${confirming ? ' serve-expand-shell--confirm' : ''}">
        <div class="serve-expand-stage serve-expand-stage--picker">
          <h3 class="serve-picker__title">Kto serwuje?</h3>
          <p class="serve-picker__hint">Po grze o serwis wybierz stronę, która zaczyna serwować w pierwszym secie.</p>
          <div class="serve-picker__choices">
            ${renderServePickerChoice(m, 'A')}
            ${renderServePickerChoice(m, 'B')}
          </div>
        </div>
        ${setStage}
      </div>
    </div>`;
}

function renderSetPlayOverlayBody(m, { readonly = false, showTitle = true } = {}) {
  const ls = m.liveSet || ensureLiveSet(m);
  const setBadge = ls.status === 'running' ? renderLiveBadge(true)
    : ls.status === 'paused' ? renderBreakBadge(true) : renderLiveBadge(true);
  return `
        ${showTitle ? `<div class="set-play__head"><p class="set-play__set-n">Set ${ls.n}${readonly ? ' · podgląd' : ''}</p></div>` : ''}

        <div class="set-play__clock-wrap">
          ${setBadge}
          <div class="set-play__clock" id="set-play-clock">${formatSportClock(getLiveSetElapsed(m))}</div>
          ${renderSetClockControls(m, readonly)}
        </div>

        <div class="set-play__live-score">
          ${renderSetPlaySide(m, 'A', { inputId: 'set-score-a', plusAction: readonly ? null : 'score-a-plus', readonly })}
          ${renderSetPlaySide(m, 'B', { inputId: 'set-score-b', plusAction: readonly ? null : 'score-b-plus', readonly })}
        </div>

        ${readonly ? '' : `
        <button class="btn btn--primary btn--full set-play__save" data-action="finish-live-set" type="button">Zakończ set</button>
        <button class="set-play__cancel" data-action="delete-set" data-set-n="${ls.n}" type="button" aria-label="Anuluj set">${CANCEL_SET_ICON} Anuluj set</button>`}`;
}

function renderSetPlayOverlay(m) {
  const readonly = !canEditMatch(m);
  return `
    <div class="overlay-layer">
      <div class="overlay-glass overlay-glass--static set-play-glass">
        <button class="match-info-glass__close set-play-glass__back" data-action="close-set-play" type="button" aria-label="Wróć do meczu">${BACK_ICON}</button>
        ${renderSetPlayOverlayBody(m, { readonly, showTitle: true })}
      </div>
    </div>`;
}

function renderArchiveSetDurationClock(m, set) {
  if (!set) return '';
  const durSec = getSetDisplayDuration(m, set);
  if (durSec == null) return '';
  return `
        <div class="set-play__clock-wrap set-play__clock-wrap--saved">
          <div class="set-play__clock set-play__clock--saved" aria-label="Czas seta">${formatSportClock(durSec)}</div>
        </div>`;
}

function getArchiveSetInputScores() {
  const a = parseInt(document.getElementById('archive-score-a')?.value, 10);
  const b = parseInt(document.getElementById('archive-score-b')?.value, 10);
  return { scoreA: a, scoreB: b };
}

function archiveSetScoresValid({ scoreA, scoreB }) {
  return !isNaN(scoreA) && !isNaN(scoreB) && scoreA >= 0 && scoreB >= 0 && scoreA !== scoreB;
}

function updateArchiveSetSaveButton() {
  const btn = document.querySelector('[data-action="save-archive-set"]');
  if (!btn) return;
  const overlay = btn.closest('.set-play-glass');
  const hasBaseline = overlay?.dataset.originalA != null && overlay?.dataset.originalB != null;
  const scores = getArchiveSetInputScores();
  let enabled;
  if (hasBaseline) {
    const origA = parseInt(overlay.dataset.originalA, 10);
    const origB = parseInt(overlay.dataset.originalB, 10);
    enabled = archiveSetScoresValid(scores) && (scores.scoreA !== origA || scores.scoreB !== origB);
  } else {
    enabled = archiveSetScoresValid(scores);
  }
  btn.disabled = !enabled;
  btn.classList.toggle('btn--disabled', !enabled);
}

function renderArchiveSetOverlay(m) {
  const nextN = editSetN || ((m.sets?.filter(s => s.status !== 'live').length || 0) + 1);
  const existing = editSetN ? m.sets.find(s => s.n === editSetN) : null;
  const title = existing ? `Edycja seta ${nextN}` : (reopenMatchEdit ? `Dodaj set ${nextN}` : `Set ${nextN}`);
  const saveLabel = existing ? 'Zapisz zmiany' : (reopenMatchEdit ? 'Dodaj set' : 'Zapisz set');
  const saveDisabled = existing ? true : !archiveSetScoresValid({ scoreA: NaN, scoreB: NaN });
  const fromDetail = setDetailN != null && editSetN === setDetailN;
  return `
    <div class="overlay-layer">
      <div class="overlay-glass overlay-glass--static set-play-glass"${existing ? ` data-original-a="${existing.scoreA}" data-original-b="${existing.scoreB}"` : ''}>
        <button class="match-info-glass__close set-play-glass__back" data-action="${fromDetail ? 'close-set-edit' : 'close-set-play'}" type="button" aria-label="${fromDetail ? 'Wróć do seta' : 'Zamknij'}">${fromDetail ? BACK_ICON : CLOSE_ICON}</button>
        <h2 class="new-match__title">${title}</h2>
        ${renderArchiveSetDurationClock(m, existing)}
        <div class="set-play__live-score">
          ${renderSetPlaySide(m, 'A', { inputId: 'archive-score-a', value: existing?.scoreA ?? '' })}
          ${renderSetPlaySide(m, 'B', { inputId: 'archive-score-b', value: existing?.scoreB ?? '' })}
        </div>
        <button class="btn btn--primary btn--full set-play__save${saveDisabled ? ' btn--disabled' : ''}" data-action="save-archive-set" type="button"${saveDisabled ? ' disabled' : ''}>${saveLabel}</button>
        ${existing && (m.status === 'active' || reopenMatchEdit) ? `<button class="set-play__delete" data-action="delete-set" data-set-n="${nextN}" type="button">${TRASH_ICON} Usuń set</button>` : ''}
      </div>
    </div>`;
}

function renderSetDetailOverlay(m, setN) {
  m = persistScrubbedMatch(m);
  const set = m.sets.find(s => s.n === setN);
  if (!set || set.status === 'live') return '';
  const durSec = getSetDisplayDuration(m, set);
  const firstServer = getSetFirstServer(m, set);
  const metaA = getTeamMeta(m, 'A');
  const metaB = getTeamMeta(m, 'B');
  const nameA = formatTeam(m.teamA, metaA, m);
  const nameB = formatTeam(m.teamB, metaB, m);
  const hasTeamName = !!(metaA?.name?.trim() || metaB?.name?.trim());
  const namesBase = `match-board__names match-board__names--card${hasTeamName ? ' match-board__names--team' : ''}`;
  const namesClsA = `${namesBase} ${matchNameLengthClass(nameA)}`.trim();
  const namesClsB = `${namesBase} ${matchNameLengthClass(nameB)}`.trim();
  const draw = set.scoreA === set.scoreB;
  const clsA = draw ? 'match-card__score-part--draw' : (set.scoreA > set.scoreB ? 'match-card__score-part--win' : 'match-card__score-part--lose');
  const clsB = draw ? 'match-card__score-part--draw' : (set.scoreB > set.scoreA ? 'match-card__score-part--win' : 'match-card__score-part--lose');
  const serveStack = side => {
    const mark = firstServer === side
      ? `<span class="set-detail__serve">${renderSetRowShuttle(false)}</span>` : '';
    return `<div class="set-detail__avatar-stack">${mark}${renderTeamAvatarsForMatch(m, side, 'avatar-sm')}</div>`;
  };
  return `
    <div class="overlay-layer overlay-layer--set-detail">
      <div class="overlay-glass overlay-glass--static set-detail-glass">
        <button class="match-info-glass__close set-play-glass__back" data-action="close-set-play" type="button" aria-label="Wróć do meczu">${BACK_ICON}</button>
        <div class="set-play__head"><p class="set-play__set-n">Set ${set.n}</p></div>
        <div class="set-detail-face${m.teamA.length < 2 ? ' set-detail-face--singles' : ''}">
          <div class="set-detail-face__side set-detail-face__side--a">
            ${serveStack('A')}
            <div class="${namesClsA}">${nameA}</div>
          </div>
          <div class="set-detail-face__score match-board__score match-board__score--card">
            <span class="match-card__score-part ${clsA}">${set.scoreA}</span><span class="match-card__score-sep">:</span><span class="match-card__score-part ${clsB}">${set.scoreB}</span>
          </div>
          <div class="set-detail-face__side set-detail-face__side--b">
            ${serveStack('B')}
            <div class="${namesClsB}">${nameB}</div>
          </div>
        </div>
        ${durSec != null ? `
        <div class="set-detail__meta">
          <span class="set-detail__meta-label">Czas seta</span>
          <span class="set-detail__meta-time">${formatSportClock(durSec)}</span>
        </div>` : ''}
        ${canEditSetScores(m) ? `
        <div class="set-detail__actions">
          <button class="set-detail__edit" data-action="open-set-edit" data-set-n="${set.n}" type="button">${EDIT_ICON}<span>Edytuj wynik</span></button>
          <button class="set-detail__delete" data-action="delete-set" data-set-n="${set.n}" type="button">${TRASH_ICON}<span>Usuń set</span></button>
        </div>` : ''}
      </div>
    </div>`;
}

function saveArchiveSet(m) {
  const scoreA = parseInt(document.getElementById('archive-score-a')?.value, 10);
  const scoreB = parseInt(document.getElementById('archive-score-b')?.value, 10);
  if (isNaN(scoreA) || isNaN(scoreB) || scoreA < 0 || scoreB < 0) {
    alert('Podaj poprawny wynik seta');
    return;
  }
  if (scoreA === scoreB) {
    alert('W secie nie może być remisu');
    return;
  }
  resolveMatchGuests(m);
  if (!m.sets) m.sets = [];
  const n = editSetN || m.sets.filter(s => s.status !== 'live').length + 1;
  const existing = m.sets.find(s => s.n === n);
  const data = {
    n,
    scoreA,
    scoreB,
    durationSec: existing?.durationSec ?? 0,
    status: 'finished',
    firstServer: existing?.firstServer,
  };
  const idx = m.sets.findIndex(s => s.n === n);
  if (idx >= 0) m.sets[idx] = { ...m.sets[idx], ...data };
  else m.sets.push(data);
  recalcMatchScores(m);
  if (m.status === 'finished') recalcMatchResult(m);
  touchMatchUpdated(m);
  saveState();
  const returnToDetail = setDetailN != null && editSetN === setDetailN;
  editSetN = null;
  if (returnToDetail) {
    setPlayOpen = true;
  } else {
    setPlayOpen = false;
    setDetailN = null;
  }
  render();
}

async function deleteSetFromMatch(m, setN) {
  const pickerFlow = openMatchId === m.id && (servePickerPhase || servePickerMatchId === m.id);
  const overlayLive = setPlayOpen && !setDetailN && !editSetN;
  const live = isSetLive(m, setN) || overlayLive || pickerFlow;
  const msg = live
    ? 'Anulować ten set? Rozpoczęty set zostanie odrzucony.'
    : 'Usunąć ten set? Tej operacji nie można cofnąć.';
  const ok = await showAppConfirm({
    title: live ? 'Anulować set?' : 'Usunąć set?',
    message: msg,
    confirmLabel: live ? 'Anuluj set' : 'Usuń',
    cancelLabel: live ? 'Wróć' : undefined,
    danger: !live,
  });
  if (!ok) return;

  resetOpenMatchLiveSession();
  delete m.serveDuel;

  m.sets = (m.sets || []).filter(s => {
    if (s.n === setN) return false;
    if (live && s.status === 'live') return false;
    return true;
  });
  if (m.liveSet) {
    delete m.liveSet;
    clearSetTimer();
    syncMatchPhase(m);
  }

  renumberMatchSets(m);
  m = scrubGhostLiveSet(m);
  if (!hasFinishedSets(m) && !m.liveSet) resetMatchToWarmup(m);
  const mi = matches.findIndex(x => x.id === m.id);
  if (mi >= 0) matches[mi] = m;
  recalcMatchScores(m);
  if (m.status === 'finished') recalcMatchResult(m);
  touchMatchUpdated(m);
  saveState({ immediatePush: true });
  dismissAllMatchOverlays();
  render();
}

async function deleteMatchById(id) {
  const m = matches.find(x => x.id === id);
  if (!m || !requireMatchEdit(m)) return;
  const orphanGuests = getRemovableCreatedGuests(m);
  let msg = 'Usunąć ten mecz? Tej operacji nie można cofnąć.';
  if (m.status === 'active' && orphanGuests.length) {
    const label = orphanGuests.length === 1
      ? 'Zawodnik-gość utworzony w formularzu zostanie usunięty z listy zawodników'
      : 'Zawodnicy-goście utworzeni w formularzu zostaną usunięci z listy zawodników';
    msg += `\n\n${label}.`;
  }
  const ok = await showAppConfirm({
    title: 'Usunąć mecz?',
    message: msg,
    confirmLabel: 'Usuń',
    danger: true,
  });
  if (!ok) return;
  cleanupGuestsForMatch(m);
  recordLeagueTombstone('matches', id);
  matches = matches.filter(x => x.id !== id);
  saveState({ immediatePush: true });
  if (openMatchId === id) closeMatch();
  else render();
}

function renderMatchDetailPage(rawM) {
  const m = persistScrubbedMatch(rawM);
  const editing = isMatchEditMode(m);
  const active = isMatchActive(m);
  const finished = m.status === 'finished' && !editing;
  const archive = isMatchArchive(m);
  const live = isMatchLiveActive(m) && !editing;
  const editable = canEditMatch(m);
  const overlayOpen = setPlayOpen || matchInfoOpen || canShowServePicker(m);
  const finishedSets = getMatchSetListRows(m);

  return `
    <div class="match-page${overlayOpen ? ' match-page--info-open' : ''}${!editable ? ' match-page--readonly' : ''}">
      <div class="match-page__main">
        <div class="back-bar match-page__top">
          <button class="back-btn" data-action="close-match" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
            Mecze
          </button>
          ${editable ? `
          <div class="match-page__toolbar">
            ${finished ? `<button class="icon-btn" data-action="edit-match" type="button" aria-label="Edytuj mecz">${EDIT_ICON}</button>` : ''}
            <button class="icon-btn icon-btn--danger" data-action="delete-match" type="button" aria-label="Usuń mecz">${TRASH_ICON}</button>
          </div>` : ''}
        </div>

        ${!editable ? '<p class="match-detail__readonly-hint">Podgląd — edycja tylko dla uczestników meczu</p>' : ''}

        <div class="match-page__body">
          <div class="match-detail__hero">
            <div class="match-detail__date">${formatDateLong(m.date)}</div>
            ${finished && !editing
    ? `<div class="match-detail__live match-detail__live--finished">${renderFinishedBadge(true)}</div>`
    : live ? `<div class="match-detail__live">${renderMatchStatusBadge(m, true)}</div>` : ''}
            ${archive && active ? '<div class="match-detail__archive-tag">Mecz archiwalny</div>' : ''}
            ${renderMatchFace(m, { large: true, editableTeams: editable && m.teamA.length > 1 })}
          </div>

          <div class="match-page__aside">
            <p class="section-label">Sety</p>
            <div class="set-list">
              ${finishedSets.length ? finishedSets.map(s => renderSetRow(m, s)).join('') : '<p class="match-detail__empty">Brak rozegranych setów</p>'}
            </div>

            ${renderMatchResumeBtn(m)}

            ${renderMatchActionsHtml(m)}

            ${finished && !editing ? renderWinnerBlock(m) : ''}

            <button class="match-detail__stats-link" data-action="toggle-match-info" type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-6M22 20V8"/></svg>
              <span>Szczegóły meczu</span>
            </button>
          </div>
        </div>
      </div>

      ${matchInfoOpen ? renderMatchInfoPanel(m) : ''}
      ${setPlayOpen && setDetailN && !editSetN ? renderSetDetailOverlay(m, setDetailN) : ''}
      ${setPlayOpen && !setDetailN && !editSetN && !archive && active && !reopenMatchEdit ? renderSetPlayOverlay(m) : ''}
      ${canShowServePicker(m) ? renderServePickerOverlay(m) : ''}
      ${shouldShowArchiveSetOverlay(m) ? renderArchiveSetOverlay(m) : ''}
      ${matchTeamEditSide ? renderMatchTeamEditPanel(m, matchTeamEditSide) : ''}
    </div>
  `;
}

function openMatch(id) {
  openMatchId = id;
  matchView = 'detail';
  matchInfoOpen = false;
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  matchTeamEditSide = null;
  ctxTarget = null;
  const m = matches.find(x => x.id === id);
  if (m && !canEditMatch(m)) reopenMatchEdit = false;
  if (isMatchLiveActive(m) && !reopenMatchEdit) ensureLiveMatchTickers();
  if (m?.liveSet?.status === 'running') ensureSetTimerRunning(m);
  render();
}

function closeMatch() {
  resetMatchView();
  render();
}

function resetMatchView() {
  clearSetTimer();
  clearServePickerTransition();
  servePickerMatchId = null;
  openMatchId = null;
  matchView = 'detail';
  matchInfoOpen = false;
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  matchTeamEditSide = null;
  reopenMatchEdit = false;
  ctxTarget = null;
}

function resetTabToDefault(tab) {
  if (tab === 'stats') statsSubView = null;
  if (tab === 'matches') {
    resetMatchView();
    newMatchOpen = false;
    newMatchDraft = null;
  }
  if (tab === 'players') {
    openPlayerId = null;
    openTeamId = null;
    playersRosterTab = 'players';
    newTeamOpen = false;
    newTeamDraft = null;
    addGuestOpen = false;
    playersFabMenuOpen = false;
    inviteShareOpen = false;
    deletePlayerOpen = false;
    deletePlayerId = null;
    deletePlayerError = '';
  }
}

function enterMatchEditMode(m) {
  if (!requireMatchEdit(m)) return;
  matchEditSnapshot = JSON.parse(JSON.stringify(m));
  stopMatchClock(m);
  if (m.liveSet) {
    delete m.liveSet;
    clearSetTimer();
    if (m.sets) m.sets = m.sets.filter(s => s.status !== 'live');
  }
  openMatchId = m.id;
  reopenMatchEdit = true;
  matchTeamEditSide = null;
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  saveState();
  render();
}

function cancelMatchEdit() {
  const m = matches.find(x => x.id === openMatchId);
  if (!m || !matchEditSnapshot || matchEditSnapshot.id !== m.id) return;
  const idx = matches.findIndex(x => x.id === m.id);
  if (idx >= 0) matches[idx] = repairStaleLiveMatchState(normalizeMatch(matchEditSnapshot));
  reopenMatchEdit = false;
  matchEditSnapshot = null;
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  saveState({ immediatePush: true });
  render();
}

function finalizeMatch(m) {
  resolveMatchGuests(m);
  syncMatchPhase(m);
  stopMatchClock(m);
  m.status = 'finished';
  recalcMatchScores(m);
  if (m.scoreA === m.scoreB) {
    m.result = 'draw';
    m.winnerId = null;
  } else {
    m.result = 'win';
    const team = getWinningTeamIds(m);
    m.winnerId = team ? team[0] : null;
  }
  reopenMatchEdit = false;
  matchEditSnapshot = null;
  touchMatchUpdated(m);
  saveState({ immediatePush: true });
  return true;
}

function renderH2HCard(idA, idB, winsA, winsB) {
  const fake = { teamA: [idA], teamB: [idB], scoreA: winsA, scoreB: winsB, status: 'finished' };
  return `<div class="match-card match-card--static">${renderMatchFace(fake)}</div>`;
}

function renderStatsMenu() {
  return `
    <div class="menu-list">
      <button class="menu-card" data-stats-view="global" type="button">
        <div class="menu-card__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>
        <div class="menu-card__text"><h2>Statystyki globalne</h2><p>Podsumowanie wszystkich meczów</p></div>
        <svg class="menu-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button class="menu-card" data-stats-view="players" type="button">
        <div class="menu-card__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><circle cx="12" cy="8" r="3"/></svg></div>
        <div class="menu-card__text"><h2>Statystyki zawodników</h2><p>Ranking i bilans każdego gracza</p></div>
        <svg class="menu-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button class="menu-card" data-stats-view="h2h" type="button">
        <div class="menu-card__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 12h8M12 8v8"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></svg></div>
        <div class="menu-card__text"><h2>Konfrontacja zawodników</h2><p>Bezpośrednie pojedynki head-to-head</p></div>
        <svg class="menu-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>
  `;
}

function renderStatsGlobal() {
  const total = matches.length;
  const wins = matches.filter(m => m.result === 'win').length;
  const draws = matches.filter(m => m.result === 'draw').length;
  return `
    <div class="sub-screen">
      <div class="back-bar"><button class="back-btn" data-action="stats-back" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>Statystyki</button></div>
      <div class="stats-summary">
        <div class="stat-box"><div class="stat-box__value">${total}</div><div class="stat-box__label">Meczów</div></div>
        <div class="stat-box"><div class="stat-box__value">${wins}</div><div class="stat-box__label">Rozstrzygniętych</div></div>
        <div class="stat-box"><div class="stat-box__value">${draws}</div><div class="stat-box__label">Remisów</div></div>
      </div>
      <p class="section-label">Ostatnie mecze</p>
      <div class="match-list">${matches.slice(0, 3).map(renderMatchCard).join('')}</div>
    </div>
  `;
}

function renderStatsPlayers() {
  const wins = computeWins();
  const sorted = [...players].sort((a, b) => (wins[b.id] || 0) - (wins[a.id] || 0));
  return `
    <div class="sub-screen">
      <div class="back-bar"><button class="back-btn" data-action="stats-back" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>Statystyki</button></div>
      <p class="section-label">Ranking zwycięstw</p>
      <div class="leaderboard">
        ${sorted.map((p, i) => `
          <div class="leaderboard__row">
            <span class="leaderboard__rank ${i === 0 ? 'leaderboard__rank--1' : ''}">${i + 1}</span>
            <span class="leaderboard__name">${p.displayName}</span>
            <span class="leaderboard__wins"><strong>${wins[p.id] || 0}</strong> wygr.</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderStatsH2H() {
  return `
    <div class="sub-screen">
      <div class="back-bar"><button class="back-btn" data-action="stats-back" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>Statystyki</button></div>
      <p class="section-label">Przykładowe konfrontacje</p>
      <div class="match-list">
        ${renderH2HCard(1, 5, 2, 1)}
        ${renderH2HCard(3, 4, 1, 0)}
        ${renderH2HCard(2, 1, 0, 1)}
      </div>
    </div>
  `;
}

function getPlayerFormDraft() {
  if (newTeamOpen && newTeamDraft) return newTeamDraft;
  if (newMatchOpen && newMatchDraft) return newMatchDraft;
  return null;
}

function newTeamDefault() {
  return {
    date: todayIso(),
    name: '',
    avatarUrl: null,
    slots: { p1: null, p2: null },
    pendingGuests: {},
    provisionalGuestIds: [],
    guestSlot: null,
    guestName: '',
    guestError: '',
    openPlayerPickerSlot: null,
  };
}

function syncNewTeamDraftFromDom() {
  if (!newTeamDraft) return;
  const nameEl = document.getElementById('new-team-name');
  if (nameEl) newTeamDraft.name = clampPlayerOrTeamName(nameEl.value);
  const guestInput = document.querySelector('[data-team-guest-slot]');
  if (guestInput) newTeamDraft.guestName = clampPlayerOrTeamName(guestInput.value);
}

function updateNewTeamFormDOM() {
  const formEl = document.getElementById('new-team-form-body');
  if (formEl && newTeamDraft) {
    const guestSlot = newTeamDraft.guestSlot;
    const openSlot = newTeamDraft.openPlayerPickerSlot;
    formEl.innerHTML = renderNewTeamFormBody(newTeamDraft);
    if (guestSlot) {
      const input = formEl.querySelector(`[data-team-guest-slot="${guestSlot}"]`);
      if (input) input.focus();
    }
    ensureNewTeamPickerVisible();
  }
}

function ensureNewTeamPickerVisible() {
  syncFormPickerScrollPads(document.getElementById('new-team-glass'));
}

function closeTeamFormPickers() {
  if (!newTeamDraft) return false;
  if (!newTeamDraft.openPlayerPickerSlot) return false;
  newTeamDraft.openPlayerPickerSlot = null;
  updateNewTeamFormDOM();
  return true;
}

function renderNewTeamPlayerSlot(draft, slot, label) {
  const isGuestMode = draft.guestSlot === slot;
  return `
    <div class="new-match__field">
      <label class="profile-card__label">${label}</label>
      ${isGuestMode ? `
        <input class="profile-card__input dropdown-picker__guest-input" type="text" data-team-guest-slot="${slot}" placeholder="Imię gościa" value="${escAttr(draft.guestName)}" maxlength="${MAX_PLAYER_TEAM_NAME_LEN}" autocomplete="off">
        ${draft.guestError ? `<p class="new-match__error">${escAttr(draft.guestError)}</p>` : ''}
      ` : renderPlayerPickerDropdown(draft, slot)}
    </div>`;
}

function renderNewTeamFormAvatar(draft) {
  const playerIds = [draft.slots.p1, draft.slots.p2].filter(Boolean);
  if (draft.avatarUrl) {
    return renderProfileAvatarStack({
      avatarHtml: renderAvatarHtml(draft.name || 'Drużyna', draft.avatarUrl, 'avatar-lg', { shape: AVATAR_SHAPE_TEAM, border: 'plain' }),
      changeAction: 'new-team-avatar',
      removeAction: 'new-team-remove-avatar',
    });
  }
  if (playerIds.length === 2) {
    return `
      <div class="profile-avatar-stack">
        <button class="profile-panel__avatar-wrap profile-panel__avatar-wrap--team new-team-form__avatar-btn" data-action="new-team-avatar" type="button">
          ${renderPlayerAvatars(playerIds, 'avatar-lg', { border: 'plain' })}
          <span class="profile-panel__camera">${PROFILE_CAMERA_ICON}</span>
        </button>
      </div>`;
  }
  return `
    <button class="new-team-form__avatar-empty" data-action="new-team-avatar" type="button" aria-label="Dodaj zdjęcie drużyny">
      <span class="new-team-form__avatar-empty-ring">
        <span class="new-team-form__avatar-empty-icon">${PROFILE_CAMERA_ICON}</span>
      </span>
      <span class="new-team-form__avatar-empty-hint">Zdjęcie drużyny</span>
    </button>`;
}

function renderNewTeamFormBody(draft) {
  return `
    <div class="new-team-form__avatar-hero">
      ${renderNewTeamFormAvatar(draft)}
    </div>
    <div class="new-match__field">
      <label class="profile-card__label" for="new-team-name">Nazwa drużyny</label>
      ${renderTeamNameField({
        inputId: 'new-team-name',
        placeholder: 'Nazwa drużyny (opcjonalnie)',
        value: draft.name,
        autoLabel: draft.slots.p1 && draft.slots.p2 ? formatTeamLabel([draft.slots.p1, draft.slots.p2], draft) : '',
        diceAction: 'random-new-team-name',
        clearAction: 'clear-new-team-name',
      })}
    </div>
    <p class="section-label section-label--muted">Skład drużyny</p>
    ${renderNewTeamPlayerSlot(draft, 'p1', 'Zawodnik 1')}
    ${renderNewTeamPlayerSlot(draft, 'p2', 'Zawodnik 2')}`;
}

function renderNewTeamForm() {
  const draft = newTeamDraft || newTeamDefault();
  return `
    <div class="new-match-layer new-team-layer">
      <div class="new-match-layer__scroll">
        <div class="form-picker-scroll-pad form-picker-scroll-pad--top" aria-hidden="true"></div>
        <div class="new-match-glass" id="new-team-glass">
          <button class="match-info-glass__close" data-action="close-new-team" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>
          <h2 class="new-match__title">Nowa drużyna</h2>
          <div id="new-team-form-body">${renderNewTeamFormBody(draft)}</div>
          <button class="btn btn--primary btn--full new-team-form__save" data-action="create-team" type="button">Zapisz drużynę</button>
        </div>
        <div class="form-picker-scroll-pad form-picker-scroll-pad--bottom" aria-hidden="true"></div>
      </div>
    </div>`;
}

function resolveTeamDraftPlayerIds(draft) {
  return [draft.slots.p1, draft.slots.p2].filter(Boolean);
}

function createTeamFromDraft() {
  syncNewTeamDraftFromDom();
  const draft = newTeamDraft;
  if (!draft?.slots.p1 || !draft.slots.p2) {
    alert('Wybierz obu zawodników drużyny');
    return;
  }
  if (draft.slots.p1 === draft.slots.p2) {
    alert('Wybierz różnych zawodników');
    return;
  }
  for (const slot of ['p1', 'p2']) {
    if (!getPlayer(draft.slots[slot])) {
      alert('Potwierdź wszystkich gości przed zapisem');
      return;
    }
  }
  const busyIds = getDraftBusyPlayerIds(draft);
  const busyPick = [draft.slots.p1, draft.slots.p2].find(id => busyIds.has(id));
  if (busyPick) {
    alert(`${getPlayerName(busyPick)} jest w grze w innym meczu`);
    return;
  }
  const playerIds = resolveTeamDraftPlayerIds(draft);
  const existing = findTeamByPlayerIds(playerIds);
  if (existing) {
    alert(`Drużyna z tym składem już istnieje: „${existing.name}”`);
    return;
  }
  const rawName = draft.name.trim() || formatTeamLabel(playerIds);
  const nameErr = playerOrTeamNameError(rawName, 'Podaj nazwę drużyny');
  if (nameErr) {
    alert(nameErr);
    return;
  }
  const name = clampPlayerOrTeamName(rawName);
  const id = nextTeamId();
  const team = { id, name, avatarUrl: draft.avatarUrl || null, playerIds: [...playerIds] };
  teams.push(team);
  touchTeamUpdated(team);
  commitDraftGuests(draft, playerIds);
  newTeamOpen = false;
  newTeamDraft = null;
  openTeamId = id;
  playersRosterTab = 'teams';
  saveState({ immediatePush: true });
  showToast('Drużyna zapisana', 'success');
  render();
}

function renderPlayerSlot(draft, slot, label) {
  const isGuestMode = draft.guestSlot === slot;
  return `
    <div class="new-match__field">
      <label class="profile-card__label">${label}</label>
      ${isGuestMode ? `
        <input class="profile-card__input dropdown-picker__guest-input" type="text" data-new-match-guest-slot="${slot}" placeholder="Imię gościa" value="${draft.guestName}" maxlength="${MAX_PLAYER_TEAM_NAME_LEN}" autocomplete="off">
        ${draft.guestError ? `<p class="new-match__error">${draft.guestError}</p>` : ''}
      ` : renderPlayerPickerDropdown(draft, slot)}
    </div>`;
}

function confirmGuestFromSlot(draft, slot) {
  const trimmed = clampPlayerOrTeamName(draft.guestName);
  if (!trimmed) {
    draft.guestSlot = null;
    draft.guestName = '';
    draft.guestError = '';
    return true;
  }
  const result = findOrCreateGuestPlayer(trimmed);
  if (!result.ok) {
    draft.guestError = result.error || 'Nie udało się dodać gościa';
    return false;
  }
  draft.slots[slot] = result.player.id;
  trackProvisionalDraftGuest(draft, result.player.id);
  if (draft.pendingGuests) delete draft.pendingGuests[slot];
  draft.guestSlot = null;
  draft.guestName = '';
  draft.guestError = '';
  draft.openPlayerPickerSlot = null;
  return true;
}

function renderDoublesTeamBlock(draft, side, label) {
  const mode = side === 'A' ? draft.teamModeA : draft.teamModeB;
  const teamId = side === 'A' ? draft.teamIdA : draft.teamIdB;
  const meta = side === 'A' ? draft.teamMetaA : draft.teamMetaB;
  const slots = side === 'A' ? ['a1', 'a2'] : ['b1', 'b2'];
  const avatarAction = side === 'A' ? 'team-avatar-a' : 'team-avatar-b';
  const nameField = side === 'A' ? 'team-a-name' : 'team-b-name';
  const excludedTeams = getExcludedTeamIds(draft, side);
  const availableTeams = teams.filter(t => !excludedTeams.includes(t.id));

  const existingBlock = `
    <div class="new-match__field">
      <label class="profile-card__label">Wybierz drużynę</label>
      ${availableTeams.length
        ? renderTeamPickerDropdown(draft, side, availableTeams)
        : '<p class="new-match__empty-teams">Brak zapisanych drużyn. Utwórz nową drużynę.</p>'}
    </div>`;

  const slotIds = [draft.slots[slots[0]], draft.slots[slots[1]]].filter(Boolean);
  const autoLabel = slotIds.length === 2 ? formatTeamLabel(slotIds, draft) : '';

  const createBlock = `
    <div class="new-match__team-meta">
      ${renderTeamNameField({
        inputAttrs: `data-new-match-field="${nameField}"`,
        placeholder: 'Nazwa drużyny (opcjonalnie)',
        value: meta.name,
        autoLabel,
        diceAction: 'random-team-name',
        diceAttrs: `data-side="${side}"`,
        clearAction: 'clear-new-match-team-name',
        clearAttrs: `data-side="${side}"`,
      })}
      <button class="new-match__team-avatar-btn" data-action="${avatarAction}" type="button" aria-label="Zdjęcie drużyny">
        ${meta.avatarUrl
          ? renderAvatarHtml(meta.name || 'Drużyna', meta.avatarUrl, 'avatar-xs', { shape: AVATAR_SHAPE_TEAM, border: 'accent' })
          : (draft.slots[slots[0]] && draft.slots[slots[1]]
            ? renderPlayerAvatars([draft.slots[slots[0]], draft.slots[slots[1]]], 'avatar-xs')
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>')}
      </button>
    </div>
    ${renderPlayerSlot(draft, slots[0], 'Zawodnik 1')}
    ${renderPlayerSlot(draft, slots[1], 'Zawodnik 2')}
    <label class="new-match__save-team">
      <input type="checkbox" data-action="toggle-save-team" data-side="${side}"${(side === 'A' ? draft.saveTeamA : draft.saveTeamB) ? ' checked' : ''}>
      <span>Zapisz drużynę na przyszłość</span>
    </label>`;

  const canExisting = canPickExistingTeam(draft, side);
  const effectiveMode = mode === 'existing' && !canExisting ? 'create' : mode;

  return `
    <div class="new-match__team">
      <h3 class="new-match__team-title">${label}</h3>
      <div class="new-match__team-mode">
        <button class="new-match__team-mode-btn${effectiveMode === 'existing' ? ' new-match__team-mode-btn--active' : ''}" data-action="set-team-mode" data-side="${side}" data-mode="existing" type="button"${!canExisting ? ' disabled' : ''}>Istniejąca</button>
        <button class="new-match__team-mode-btn${effectiveMode === 'create' ? ' new-match__team-mode-btn--active' : ''}" data-action="set-team-mode" data-side="${side}" data-mode="create" type="button">Nowa drużyna</button>
      </div>
      ${effectiveMode === 'existing' ? existingBlock : createBlock}
    </div>`;
}

function renderNewMatchForm() {
  const draft = newMatchDraft || newMatchDefault();
  const isDoubles = draft.type === 'doubles';
  const isArchiveDate = draft.date && draft.date < todayIso();
  return `
    <div class="new-match-layer">
      <div class="new-match-layer__scroll">
        <div class="form-picker-scroll-pad form-picker-scroll-pad--top" aria-hidden="true"></div>
        <div class="new-match-glass" id="new-match-glass">
          <button class="match-info-glass__close" data-action="close-new-match" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>
          <h2 class="new-match__title">Nowy mecz</h2>

          <div id="new-match-date-section">
            ${renderDatePickerSection(draft)}
          </div>

          <p class="profile-card__label">Typ meczu</p>
          <div class="new-match__type-toggle" id="new-match-type-toggle">
            <button class="new-match__type-btn${!isDoubles ? ' new-match__type-btn--active' : ''}" data-action="set-match-type" data-type="singles" type="button">Singiel</button>
            <button class="new-match__type-btn${isDoubles ? ' new-match__type-btn--active' : ''}" data-action="set-match-type" data-type="doubles" type="button">Debel</button>
          </div>

          <div id="new-match-players">
            ${renderNewMatchPlayersSection(draft)}
          </div>

          <button class="btn btn--primary btn--full new-match__submit" id="new-match-submit" data-action="create-match" type="button">${isArchiveDate ? 'Dodaj mecz archiwalny' : 'Rozpocznij mecz'}</button>
        </div>
        <div class="form-picker-scroll-pad form-picker-scroll-pad--bottom" aria-hidden="true"></div>
      </div>
    </div>`;
}

function syncNewMatchDraftFromDom() {
  if (!newMatchDraft) return;
  const dateEl = document.querySelector('[data-new-match-field="date"]');
  if (dateEl) newMatchDraft.date = dateEl.value;
  const nameA = document.querySelector('[data-new-match-field="team-a-name"]');
  const nameB = document.querySelector('[data-new-match-field="team-b-name"]');
  if (nameA) newMatchDraft.teamMetaA.name = clampPlayerOrTeamName(nameA.value);
  if (nameB) newMatchDraft.teamMetaB.name = clampPlayerOrTeamName(nameB.value);
  const guestInput = document.querySelector('[data-new-match-guest-slot]');
  if (guestInput) newMatchDraft.guestName = clampPlayerOrTeamName(guestInput.value);
}

function createMatchFromDraft() {
  if (!canCreateMatch()) {
    showToast('Nowy mecz może dodać tylko zalogowany zawodnik z kontem', 'warn');
    return;
  }
  syncNewMatchDraftFromDom();
  const draft = newMatchDraft;
  if (!draft.date) {
    draft.dateError = 'Wybierz datę meczu';
    if (document.getElementById('new-match-glass')) {
      updateNewMatchDateUI();
    } else {
      render();
    }
    return;
  }
  if (draft.date > todayIso()) {
    draft.dateError = 'Nie można dodać meczu w przyszłości';
    if (document.getElementById('new-match-glass')) {
      updateNewMatchDateUI();
    } else {
      render();
    }
    return;
  }
  draft.dateError = '';
  const isDoubles = draft.type === 'doubles';
  const teamA = isDoubles ? [draft.slots.a1, draft.slots.a2] : [draft.slots.a1];
  const teamB = isDoubles ? [draft.slots.b1, draft.slots.b2] : [draft.slots.b1];
  if (teamA.some(id => !id) || teamB.some(id => !id)) {
    alert('Wybierz wszystkich zawodników');
    return;
  }
  const allIds = [...teamA, ...teamB];
  if (new Set(allIds).size !== allIds.length) {
    alert('Ten sam zawodnik nie może grać w obu rolach');
    return;
  }
  for (const id of allIds) {
    if (!getPlayer(id)) {
      alert('Nieprawidłowy zawodnik — wybierz ponownie');
      return;
    }
  }
  if (isDraftToday(draft)) {
    const busyIds = getLiveBusyPlayerIds();
    const busyPick = allIds.find(id => busyIds.has(id));
    if (busyPick) {
      alert(`${getPlayerName(busyPick)} jest w grze w innym meczu`);
      return;
    }
  }
  if (isDoubles) {
    if (draft.teamModeA === 'existing' && !draft.teamIdA) {
      alert('Wybierz drużynę A');
      return;
    }
    if (draft.teamModeB === 'existing' && !draft.teamIdB) {
      alert('Wybierz drużynę B');
      return;
    }
    const teamAObj = draft.teamIdA ? getTeam(draft.teamIdA) : null;
    const teamBObj = draft.teamIdB ? getTeam(draft.teamIdB) : null;
    if (teamAObj && teamBObj && teamAObj.playerIds.some(id => teamBObj.playerIds.includes(id))) {
      alert('Zawodnik nie może grać przeciwko sobie — wybierz inne drużyny');
      return;
    }
  }
  const nextId = matches.reduce((max, m) => Math.max(max, m.id), 0) + 1;
  const isArchive = draft.date < todayIso();
  const match = {
    id: nextId,
    date: draft.date,
    teamA: [...teamA],
    teamB: [...teamB],
    scoreA: 0,
    scoreB: 0,
    sets: [],
    status: 'active',
    result: null,
    winnerId: null,
    isArchive,
    createdAt: Date.now(),
  };
  if (!isArchive) {
    const now = Date.now();
    match.matchClock = { elapsedSec: 0, status: 'idle', lastTickAt: null, startedAt: null };
    match.warmupStartedAt = now;
    match.matchTiming = { restSec: 0, breakPeriods: [], phase: 'warmup', phaseStartedAt: now };
  }
  resolveMatchGuests(match);
  const createdGuestIds = (draft.provisionalGuestIds || []).filter(id => allIds.includes(id));
  if (createdGuestIds.length) match.createdGuestIds = createdGuestIds;
  commitDraftGuests(draft, allIds);
  if (isDoubles) {
    match.teamMeta = {};
    const metaA = draft.teamMetaA;
    const metaB = draft.teamMetaB;
    const teamIdA = saveTeamFromDraft(draft, 'A', match.teamA);
    const teamIdB = saveTeamFromDraft(draft, 'B', match.teamB);
    match.teamMeta.A = {
      name: clampPlayerOrTeamName((teamIdA ? getTeam(teamIdA)?.name : null) || metaA.name.trim() || formatTeamLabel(match.teamA)),
      avatarUrl: (teamIdA ? getTeam(teamIdA)?.avatarUrl : null) || metaA.avatarUrl || null,
      teamId: teamIdA || undefined,
    };
    match.teamMeta.B = {
      name: clampPlayerOrTeamName((teamIdB ? getTeam(teamIdB)?.name : null) || metaB.name.trim() || formatTeamLabel(match.teamB)),
      avatarUrl: (teamIdB ? getTeam(teamIdB)?.avatarUrl : null) || metaB.avatarUrl || null,
      teamId: teamIdB || undefined,
    };
  }
  touchMatchUpdated(match);
  matches.unshift(match);
  saveState();
  newMatchOpen = false;
  newMatchDraft = null;
  openMatch(nextId);
}

function renderMatches() {
  const leagueHint = matchPermissionsActive() && hasAuthAccount()
    ? '<p class="matches-page__league-hint">Wspólna liga — mecze widoczne dla wszystkich zalogowanych</p>'
    : '';
  return `
    <div class="matches-page${newMatchOpen ? ' matches-page--form-open' : ''}">
      <div class="matches-page__main">
        ${leagueHint}
        <p class="section-label">${matches.length} meczów</p>
        <div class="match-list">${matches.map(renderMatchCard).join('')}</div>
      </div>
      ${newMatchOpen ? renderNewMatchForm() : ''}
    </div>
  `;
}

function renderPlayers() {
  const wins = computeWins();
  const teamWins = computeTeamWins();
  const registered = players.filter(p => !p.isGuest);
  const guests = players.filter(p => p.isGuest);
  const rosterTabs = `
    <div class="roster-tabs" role="tablist">
      <button class="roster-tabs__btn${playersRosterTab === 'players' ? ' roster-tabs__btn--active' : ''}" data-action="roster-tab" data-roster-tab="players" type="button" role="tab" aria-selected="${playersRosterTab === 'players' ? 'true' : 'false'}">Zawodnicy</button>
      <button class="roster-tabs__btn${playersRosterTab === 'teams' ? ' roster-tabs__btn--active' : ''}" data-action="roster-tab" data-roster-tab="teams" type="button" role="tab" aria-selected="${playersRosterTab === 'teams' ? 'true' : 'false'}">Drużyny</button>
    </div>`;
  const renderCard = p => renderRegisteredPlayerCard(p, wins);
  const renderTeamCard = t => renderTeamCardButton(t, teamWins);
  if (playersRosterTab === 'teams') {
    return `
      <div class="players-page${newTeamOpen ? ' players-page--form-open' : ''}">
        ${rosterTabs}
        ${teams.length
          ? `<div class="player-grid">${teams.map(renderTeamCard).join('')}</div>`
          : '<p class="match-detail__empty">Brak zapisanych drużyn. Dotknij +, aby dodać pierwszą drużynę.</p>'}
        ${newTeamOpen ? renderNewTeamForm() : ''}
      </div>`;
  }
  return `
    ${rosterTabs}
    <p class="section-label">Zawodnicy z kontem</p>
    ${registered.length
      ? `<div class="player-grid">${registered.map(renderCard).join('')}</div>`
      : '<p class="match-detail__empty">Brak zarejestrowanych zawodników.</p>'}
    <div class="players-guest-section" id="players-guest-section">
      <p class="section-label section-label--muted players-guest-section__label">Zawodnicy goście</p>
      ${guests.length
        ? `<div class="player-grid player-grid--guests">${guests.map(p => renderGuestRosterCard(p, wins)).join('')}</div>`
        : '<p class="match-detail__empty">Brak gości. Dotknij +, aby dodać gracza gościa.</p>'}
    </div>
    ${renderAddGuestSheet()}
  `;
}

function renderPlayerStatRow(label, value) {
  return `<div class="player-stat-row"><span class="player-stat-row__label">${label}</span><strong class="player-stat-row__value">${value}</strong></div>`;
}

function saveTeamProfile(teamId) {
  const team = getTeam(teamId);
  if (!team || !canEditTeam(team)) return;
  const raw = document.getElementById('team-detail-name')?.value?.trim() ?? '';
  const autoLabel = formatTeamLabel(team.playerIds);
  let name = '';
  if (raw) {
    const err = playerOrTeamNameError(raw, 'Podaj nazwę drużyny');
    if (err) {
      alert(err);
      return;
    }
    const clamped = clampPlayerOrTeamName(raw);
    name = clamped.toLowerCase() === autoLabel.toLowerCase() ? '' : clamped;
  }
  team.name = name;
  touchTeamUpdated(team);
  matches.forEach(m => {
    if (m.teamMeta?.A?.teamId === teamId) m.teamMeta.A.name = team.name;
    if (m.teamMeta?.B?.teamId === teamId) m.teamMeta.B.name = team.name;
  });
  saveState();
  render();
}

function updateTeamSaveButton() {
  const input = document.getElementById('team-detail-name');
  const btn = document.querySelector('[data-action="save-team-profile"]');
  const team = openTeamId ? getTeam(openTeamId) : null;
  if (!input || !btn || !team) return;
  const raw = String(input.value ?? '').trim();
  const autoLabel = formatTeamLabel(team.playerIds);
  const effectiveNew = !raw || raw.toLowerCase() === autoLabel.toLowerCase()
    ? ''
    : clampPlayerOrTeamName(raw);
  const stored = team.name.trim();
  const effectiveStored = !stored || stored.toLowerCase() === autoLabel.toLowerCase()
    ? ''
    : stored;
  const unchanged = effectiveNew === effectiveStored;
  const invalid = raw && raw.toLowerCase() !== autoLabel.toLowerCase()
    && !!playerOrTeamNameError(clampPlayerOrTeamName(raw), 'Podaj nazwę drużyny');
  const tooLong = raw.length > MAX_PLAYER_TEAM_NAME_LEN;
  btn.disabled = unchanged || invalid || tooLong;
  btn.classList.toggle('btn--primary', !btn.disabled);
  btn.classList.toggle('btn--secondary', btn.disabled);
  btn.classList.toggle('btn--disabled', btn.disabled);
}

function renderTeamDetailAvatarEdit(team) {
  const attrs = ` data-team-id="${team.id}"`;
  if (team.avatarUrl) {
    return renderProfileAvatarStack({
      avatarHtml: renderAvatarHtml(team.name, team.avatarUrl, 'avatar-lg', { shape: AVATAR_SHAPE_TEAM, border: 'accent' }),
      changeAction: 'change-team-avatar',
      removeAction: 'remove-team-avatar',
      removeAttrs: attrs,
    });
  }
  return renderProfileAvatarStack({
    avatarHtml: renderPlayerAvatars(team.playerIds, 'avatar-lg', { border: 'accent' }),
    changeAction: 'change-team-avatar',
    removeAction: null,
    removeAttrs: attrs,
  });
}

function renderTeamDetail(teamId) {
  const team = getTeam(teamId);
  if (!team) {
    return `<div class="sub-screen"><p class="match-detail__empty">Nie znaleziono drużyny.</p><button class="btn btn--outline" data-action="team-back" type="button">Wróć</button></div>`;
  }
  const stats = computeTeamStats(teamId);
  const canEdit = canEditTeam(team);
  const liveMatch = getTeamLiveMatch(teamId);
  const renderMemberCard = id => {
    const p = getPlayer(id);
    if (!p) return '';
    return `
    <button class="player-card player-card--btn team-detail__member" data-action="open-player" data-player-id="${p.id}" type="button">
      ${renderAvatarHtml(p.displayName, getPlayerAvatarUrl(id), 'player-card__avatar', { border: 'accent' })}
      <div class="player-card__name">${escAttr(p.displayName)}</div>
    </button>`;
  };
  return `
    <div class="player-detail sub-screen">
      <div class="back-bar">
        <button class="back-btn" data-action="team-back" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
          Drużyny
        </button>
      </div>

      ${canEdit ? `
        <div class="profile-card">
          <div class="profile-card__avatar-row">
            ${renderTeamDetailAvatarEdit(team)}
            <p class="profile-card__desc profile-card__desc--center">Kliknij zdjęcie, aby je zmienić${team.avatarUrl ? ', lub ✕ aby usunąć' : ''}.</p>
          </div>
          ${renderEntityLiveLink(liveMatch, { profile: true })}
        </div>
        <div class="profile-card team-detail__edit">
          <label class="profile-card__label" for="team-detail-name">Nazwa drużyny</label>
          ${renderTeamNameField({
            inputId: 'team-detail-name',
            value: team.name,
            autoLabel: formatTeamLabel(team.playerIds),
            diceAction: 'random-team-detail-name',
            diceAttrs: `data-team-id="${team.id}"`,
            clearAction: 'clear-team-detail-name',
            clearAttrs: `data-team-id="${team.id}"`,
          })}
          <button class="btn btn--secondary btn--full btn--disabled" data-action="save-team-profile" data-team-id="${team.id}" type="button" disabled>Zapisz zmiany</button>
        </div>
      ` : `
        <div class="player-detail__hero">
          ${renderTeamEntityAvatar(team, 'avatar-lg', { border: 'accent' })}
          <h2 class="player-detail__name">${escAttr(getTeamDisplayLines(team).title)}</h2>
          <span class="player-detail__badge player-detail__badge--registered">Drużyna deblowa</span>
          ${renderEntityLiveLink(liveMatch, { profile: true })}
        </div>
      `}

      <p class="section-label team-detail__roster-label">Skład</p>
      <div class="player-grid team-detail__roster">${team.playerIds.map(renderMemberCard).join('')}</div>

      <div class="profile-card player-detail__stats">
        <h3 class="profile-card__title">Statystyki</h3>
        <p class="profile-card__desc">Mecze deblowe z tą parą.</p>
        ${renderPlayerStatRow('Rozegrane mecze', stats.matchesPlayed)}
        ${renderPlayerStatRow('Rozegrane sety', stats.setsPlayed)}
        ${renderPlayerStatRow('Wygrane mecze', stats.matchesWon)}
        ${renderPlayerStatRow('Wygrane sety', stats.setsWon)}
        ${renderPlayerStatRow('Łączny czas gry', formatDuration(stats.totalPlaySec))}
        ${renderPlayerStatRow('Śr. punktów / mecz', stats.avgPointsPerMatch)}
      </div>

      ${canEdit ? `
        <button class="profile-danger-action" data-action="open-delete-team" data-team-id="${team.id}" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg>
          Usuń drużynę
        </button>
      ` : ''}
      ${renderDeleteTeamModal()}
    </div>`;
}

function renderPlayerDetail(playerId) {
  const player = getPlayer(playerId);
  if (!player) {
    return `<div class="sub-screen"><p class="match-detail__empty">Nie znaleziono zawodnika.</p><button class="btn btn--outline" data-action="player-back" type="button">Wróć</button></div>`;
  }
  const stats = computePlayerStats(playerId);
  const isMe = player.id === userSession.playerId;
  const avatarUrl = getPlayerAvatarUrl(playerId);
  const liveMatch = getPlayerLiveMatch(playerId);
  return `
    <div class="player-detail sub-screen">
      <div class="back-bar">
        <button class="back-btn" data-action="player-back" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
          Zawodnicy i drużyny
        </button>
      </div>

      <div class="player-detail__hero">
        ${renderAvatarHtml(player.displayName, avatarUrl, 'avatar-lg')}
        <h2 class="player-detail__name">${escAttr(player.displayName)}</h2>
        ${player.isGuest ? '<span class="player-detail__badge">Gość</span>' : '<span class="player-detail__badge player-detail__badge--registered">Konto</span>'}
        ${renderEntityLiveLink(liveMatch, { profile: true })}
      </div>

      ${isMe ? `
        <button class="btn btn--primary btn--full" data-action="player-edit-profile" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z"/></svg>
          Edytuj profil
        </button>
      ` : ''}

      ${!player.isGuest || playerHasVisibleStats(stats) ? `
      <div class="profile-card player-detail__stats">
        <h3 class="profile-card__title">Statystyki</h3>
        <p class="profile-card__desc">Singiel i debel łącznie.</p>
        ${renderPlayerStatRow('Rozegrane mecze', stats.matchesPlayed)}
        ${renderPlayerStatRow('Rozegrane sety', stats.setsPlayed)}
        ${renderPlayerStatRow('Wygrane mecze', stats.matchesWon)}
        ${renderPlayerStatRow('Wygrane sety', stats.setsWon)}
        ${renderPlayerStatRow('Łączny czas gry', formatDuration(stats.totalPlaySec))}
        ${renderPlayerStatRow('Śr. punktów / mecz', stats.avgPointsPerMatch)}
      </div>
      ` : ''}

      ${player.isGuest ? `
        <div class="profile-card player-detail__guest-actions">
          ${renderInviteBannerCard({
            kind: 'guest',
            guestName: player.displayName,
            bannerTag: 'Gość → pełne konto',
            bannerHeadline: player.displayName,
            bannerSub: 'Przejmij mecze i statystyki po rejestracji',
          })}
          <h3 class="profile-card__title">Gość → pełne konto</h3>
          <p class="profile-card__desc"><strong>${escAttr(player.displayName)}</strong> już istnieje w lidze jako gość. Wyślij zaproszenie — po rejestracji przejmie mecze i statystyki tego profilu.</p>
          ${player.pendingClaim?.lastSharedAt ? `
            <p class="invite-sent-status">
              <span class="invite-sent-status__dot" aria-hidden="true"></span>
              Ostatnio ${escAttr(SHARE_VIA_LABELS[player.pendingClaim.lastSharedVia] || 'udostępniono')} · ${formatInviteWhen(player.pendingClaim.lastSharedAt)}
            </p>
          ` : ''}
          ${player.pendingClaim?.token ? `
            <p class="player-detail__claim-hint">Link zaproszenia jest aktywny — możesz wysłać go ponownie.</p>
          ` : ''}
          <button class="invite-action-card" data-action="share-guest-invite" data-player-id="${player.id}" type="button">
            <span class="invite-action-card__shine" aria-hidden="true"></span>
            <span class="invite-action-card__icon" aria-hidden="true">
              <img src="icons/logo-mark.png" width="40" height="40" alt="">
            </span>
            <span class="invite-action-card__body">
              <strong class="invite-action-card__title">Zaproś do pełnego konta</strong>
              <span class="invite-action-card__sub">WhatsApp, Instagram, SMS i więcej</span>
            </span>
            <svg class="invite-action-card__chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      ` : ''}

      ${canDeletePlayer(player) ? `
        <button class="profile-danger-action" data-action="open-delete-player" data-player-id="${player.id}" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg>
          ${player.isGuest ? 'Usuń gościa' : 'Usuń zawodnika'}
        </button>
      ` : ''}
      ${renderDeletePlayerModal()}
    </div>`;
}

function renderAddGuestSheet() {
  if (!addGuestOpen) return '';
  return `
    <div class="confirm-sheet" data-confirm="add-guest">
      <button class="confirm-sheet__backdrop" data-action="close-add-guest" type="button" aria-label="Anuluj"></button>
      <div class="confirm-sheet__panel">
        <h3 class="confirm-sheet__title">Nowy zawodnik gość</h3>
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">Imię / nick</span>
          <input class="profile-card__input" id="add-guest-name" type="text" maxlength="${MAX_PLAYER_TEAM_NAME_LEN}" autocomplete="off" placeholder="Np. Kasia">
        </label>
        <div class="confirm-sheet__actions">
          <button class="btn btn--primary btn--full" data-action="confirm-add-guest" type="button">Dodaj gościa</button>
          <button class="btn btn--outline btn--full" data-action="close-add-guest" type="button">Anuluj</button>
        </div>
      </div>
    </div>`;
}

function renderInviteLandingCard() {
  const ctx = getInviteLandingContext();
  if (!ctx) return '';
  if (ctx.kind === 'guest') {
    return `
      <section class="invite-landing" aria-label="Zaproszenie gościa">
        ${renderInviteBannerCard(ctx)}
        <div class="invite-landing__body">
          <h2 class="invite-landing__title">Przekształć gościa w pełne konto</h2>
          <p class="invite-landing__text">Imię <strong>${escAttr(ctx.name)}</strong> jest już w lidze jako gość. Załóż konto lub zaloguj się — profil gościa automatycznie stanie się Twoim kontem zawodnika${ctx.statsLine ? ` i zachowa mecze (${escAttr(ctx.statsLine)})` : ''}.</p>
          <p class="invite-landing__hint">To nie jest zwykła rejestracja: przejmujesz istniejący profil gościa wraz ze statystykami.</p>
        </div>
      </section>`;
  }
  return `
    <section class="invite-landing" aria-label="Zaproszenie do ligi">
      ${renderInviteBannerCard(ctx)}
      <div class="invite-landing__body">
        <h2 class="invite-landing__title">${escAttr(ctx.inviterName)} zaprasza!</h2>
        <p class="invite-landing__text">Załóż konto w ${APP_NAME} i dołącz do wspólnej ligi — mecze, sety i statystyki w jednym miejscu.</p>
      </div>
    </section>`;
}

const INVITE_SHARE_ICONS = {
  native: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  whatsapp: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 00-8.7 14.9L2 22l5.3-1.4A10 10 0 1012 2zm5.2 14.1c-.2.6-1.2 1.1-1.7 1.1-.4 0-1.1.2-3.4-.8-2.8-1.2-4.6-4.1-4.7-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.2.6-.3.8-.3h.6c.2 0 .4 0 .6.5.2.5.7 1.7.8 1.8.1.1.1.3 0 .4-.1.2-.2.2-.4.4-.2.2-.3.3-.5.5-.2.2-.4.3-.2.6.2.3.9 1.5 2 2.4 1.4 1.2 2.5 1.5 2.9 1.7.4.2.6.1.8-.1.2-.3.9-1 1.1-1.4.2-.4.4-.3.8-.2.4.1 2.4 1.1 2.8 1.3.4.2.7.3.8.5.1.2.1 1.1-.1 1.7z"/></svg>',
  messenger: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.5 2 2 6 2 10.9c0 2.7 1.3 5.1 3.4 6.7V22l3.9-2.1c1 .3 2.1.4 3.2.4 5.5 0 10-4 10-8.9S17.5 2 12 2zm1 11.1-2.6-2.8-5 2.8L11 9.3l2.6 2.8 5-2.8-5.6 4.8z"/></svg>',
  instagram: '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm5 5.5A4.5 4.5 0 1016.5 12 4.5 4.5 0 0012 7.5zm6.25-2.65a1.05 1.05 0 11-1.05 1.05 1.05 1.05 0 011.05-1.05z"/></svg>',
  sms: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  email: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>',
  copy: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
};

function renderInviteSharePreview(payload) {
  const guestLine = payload.kind === 'guest'
    ? `Profil <strong>${escAttr(payload.guestName)}</strong> już jest w lidze — po rejestracji przejmiesz statystyki.`
    : `<strong>${escAttr(payload.inviterName)}</strong> zaprasza do wspólnej ligi badmintonowej.`;
  const previewSrc = inviteSharePreviewUrl || '';
  return `
    <div class="invite-share-preview">
      <div class="invite-share-preview__image-wrap">
        ${previewSrc
          ? `<img class="invite-share-preview__image" id="invite-share-preview-img" src="${previewSrc}" width="600" height="320" alt="Podgląd zaproszenia">`
          : `<div class="invite-share-preview__image invite-share-preview__image--loading">${renderInviteBannerCard(payload)}</div>`}
      </div>
      <p class="invite-share-preview__text">${guestLine}</p>
      <p class="invite-share-preview__url">${escAttr(payload.url)}</p>
    </div>`;
}

function renderInviteShareSheet() {
  if (!inviteShareOpen || !inviteSharePayload) return '';
  const canNative = typeof navigator !== 'undefined' && !!navigator.share;
  const channels = [
    ...(canNative ? [{ id: 'native', label: 'Udostępnij…', accent: true }] : []),
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'messenger', label: 'Messenger' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'sms', label: 'SMS' },
    { id: 'email', label: 'E-mail' },
    { id: 'copy', label: 'Kopiuj link' },
  ];
  return `
    <div class="invite-share-sheet" data-overlay="invite-share">
      <button class="invite-share-sheet__backdrop" data-action="close-invite-share" type="button" aria-label="Zamknij"></button>
      <div class="invite-share-sheet__panel" role="dialog" aria-labelledby="invite-share-title">
        <button class="invite-share-sheet__close" data-action="close-invite-share" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>
        <h3 class="invite-share-sheet__title" id="invite-share-title">Wyślij zaproszenie</h3>
        <p class="invite-share-sheet__hint">Wiadomość zawiera klikalny link. Grafika trafia do schowka lub pobranych plików — dołącz ją w aplikacji docelowej.</p>
        ${renderInviteSharePreview(inviteSharePayload)}
        <div class="invite-share-grid">
          ${channels.map(ch => `
            <button class="invite-share-chip${ch.accent ? ' invite-share-chip--accent' : ''}" data-action="invite-share-channel" data-channel="${ch.id}" type="button">
              <span class="invite-share-chip__icon">${INVITE_SHARE_ICONS[ch.id] || ''}</span>
              <span class="invite-share-chip__label">${escAttr(ch.label)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>`;
}

function mountInviteShareSheet() {
  let root = document.getElementById('invite-share-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'invite-share-root';
    document.getElementById('app')?.appendChild(root);
  }
  root.innerHTML = renderInviteShareSheet();
}

function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Messenger|Line\/|Twitter|LinkedInApp|Snapchat/i.test(ua)
    || (/Android/i.test(ua) && /wv/i.test(ua));
}

function hasPendingInviteInSession() {
  if (getPendingGuestClaim()) return true;
  return !!getPendingJoinInvite()?.token;
}

function needsInviteAuthScreen() {
  if (userSession.loggedIn) return false;
  const claim = getPendingGuestClaim();
  if (claim?.playerId && claim?.token) {
    const guest = getPlayer(claim.playerId);
    if (!guest) return true;
    if (guest.isGuest && guest.pendingClaim?.token === claim.token) return true;
    sessionStorage.removeItem(PENDING_CLAIM_KEY);
    if (inviteAuthMode === 'guest') inviteAuthMode = null;
  }
  if (getPendingJoinInvite()?.token) return true;
  return false;
}

function shouldShowAuthChrome() {
  return shouldShowPlayerAuthChrome();
}

function getAppShareUrl() {
  return window.location.origin + window.location.pathname;
}

const AUTH_ICON_MAIL = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>`;
const AUTH_ICON_LOCK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;
const AUTH_ICON_EYE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const AUTH_ICON_EYE_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></svg>`;
const AUTH_ICON_COPY = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
const AUTH_ICON_EXTERNAL = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const AUTH_ICON_GOOGLE = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22 12c0-.68-.06-1.37-.17-2H12v3.77h5.64a5.14 5.14 0 01-2.23 3.37v2.8h3.6c2.11-1.95 3.33-4.82 3.33-8.94z"/><path fill="#34A853" d="M12 23c3.02 0 5.56-1 7.41-2.72l-3.6-2.8c-1 .67-2.28 1.07-3.81 1.07-2.93 0-5.41-1.98-6.3-4.65H2.1v2.89A11 11 0 0012 23z"/><path fill="#FBBC05" d="M5.7 14.7a6.6 6.6 0 010-5.4V6.37H2.1a11 11 0 000 11.26l3.6-2.93z"/><path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.56 1.09 15.02 0 12 0 7.27 0 3.28 2.69 2.1 6.37l3.6 2.89C6.59 6.73 9.07 4.75 12 4.75z"/></svg>`;

const WELCOME_ICON_SPECTATOR = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const WELCOME_ICON_PLAYER = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;

function renderWelcomeScreen() {
  const inviteCtx = getInviteLandingContext();
  const inviteBanner = inviteCtx ? renderInviteLandingCard() : '';
  const playerFeatured = !!inviteCtx;
  return `
    <div class="welcome-screen">
      <div class="welcome-screen__inner">
        <header class="welcome-screen__hero">
          <div class="welcome-screen__banner">
            <img class="welcome-screen__logo" src="icons/logo-mark.png" width="56" height="56" alt="">
            <img class="welcome-screen__art" src="icons/auth-hero.svg" width="200" height="100" alt="" decoding="async">
          </div>
          <h1 class="welcome-screen__title">Witaj w ${APP_NAME}</h1>
          <p class="welcome-screen__tagline">Mecze, sety i statystyki badmintona w jednym miejscu.</p>
        </header>

        ${inviteBanner ? `<div class="welcome-screen__invite">${inviteBanner}</div>` : ''}

        <p class="welcome-screen__lead">Jak chcesz korzystać z aplikacji?</p>

        <div class="welcome-role-grid">
          <button class="welcome-role-card" data-action="choose-role-spectator" type="button">
            <span class="welcome-role-card__icon welcome-role-card__icon--spectator">${WELCOME_ICON_SPECTATOR}</span>
            <span class="welcome-role-card__title">Obserwuj jako kibic</span>
            <span class="welcome-role-card__desc">Statystyki i mecze bez logowania. Bez zakładki zawodników.</span>
          </button>
          <button class="welcome-role-card${playerFeatured ? ' welcome-role-card--featured' : ''}" data-action="choose-role-player" type="button">
            <span class="welcome-role-card__icon welcome-role-card__icon--player">${WELCOME_ICON_PLAYER}</span>
            <span class="welcome-role-card__title">Graj jako zawodnik</span>
            <span class="welcome-role-card__desc">${inviteCtx ? 'Załóż konto lub zaloguj się — zaproszenie czeka poniżej.' : 'Logowanie, mecze, profil i pełna liga.'}</span>
            ${playerFeatured ? '<span class="welcome-role-card__badge">Zaproszenie</span>' : ''}
          </button>
        </div>
      </div>
    </div>`;
}

function renderPlayerLocalAuthScreen() {
  return `
    <div class="auth-screen">
      <div class="auth-screen__inner">
        <button class="welcome-back-link" data-action="back-to-welcome" type="button">← Wróć do wyboru roli</button>
        <header class="auth-screen__brand">
          <div class="auth-screen__hero-wrap">
            <img class="auth-screen__hero-art" src="icons/auth-hero.svg" width="240" height="120" alt="" decoding="async">
          </div>
          <h1 class="auth-screen__title">Graj jako zawodnik</h1>
          <p class="auth-screen__tagline">Lokalnie na tym urządzeniu lub z synchronizacją w chmurze.</p>
        </header>
        <div class="profile-panel__login">
          <p class="profile-auth__hint">Aby grać wspólnie z innymi urządzeniami, uzupełnij <code>js/config.js</code> — instrukcja w <code>docs/SUPABASE-SETUP.md</code>.</p>
          <button class="btn btn--primary btn--full" data-action="login-local" type="button">Kontynuuj lokalnie</button>
        </div>
      </div>
    </div>`;
}

function renderAuthBackLink() {
  if (getSessionRole() !== 'player') return '';
  return `<button class="welcome-back-link" data-action="back-to-welcome" type="button">← Wróć do wyboru roli</button>`;
}

function renderAuthScreen({ showBrand = true } = {}) {
  const isRegister = profileAuthMode === 'register';
  const guestClaimFlow = inviteAuthMode === 'guest' && !!getPendingGuestClaim();
  const inApp = isInAppBrowser();
  const pwType = profileAuthShowPassword ? 'text' : 'password';
  const inviteLanding = renderInviteLandingCard();
  const submitLabel = guestClaimFlow
    ? (isRegister ? 'Przejmij profil gościa' : 'Zaloguj się i przejmij profil')
    : (isRegister ? 'Zarejestruj się' : 'Zaloguj się');

  return `
    <div class="auth-screen${guestClaimFlow ? ' auth-screen--guest-claim' : ''}">
      <div class="auth-screen__inner">
        ${renderAuthBackLink()}
        ${inviteLanding || (showBrand ? `
        <header class="auth-screen__brand">
          <div class="auth-screen__hero-wrap">
            <img class="auth-screen__hero-art" src="icons/auth-hero.svg" width="240" height="120" alt="" decoding="async">
          </div>
          <h1 class="auth-screen__title">${APP_NAME}</h1>
          <p class="auth-screen__tagline">Twój podręczny trener, sędzia, menager…</p>
        </header>
        ` : '')}

        ${inApp ? `
          <div class="auth-screen__webview-warn">
            <div class="auth-screen__webview-icon">${AUTH_ICON_EXTERNAL}</div>
            <div class="auth-screen__webview-body">
              <p class="auth-screen__webview-title">Otwórz w przeglądarce</p>
              <p class="auth-screen__webview-lead">Logowanie przez Google nie działa w przeglądarce wbudowanej w aplikacje (np. Messenger, Facebook, Instagram).</p>
              <p class="auth-screen__webview-steps">Otwórz tę stronę w Safari lub Chrome: dotknij menu ⋯ (lub ⋮) u góry i wybierz „Otwórz w przeglądarce”.</p>
              <button class="auth-screen__copy-link" data-action="copy-app-link" type="button">
                ${AUTH_ICON_COPY}
                Skopiuj link do strony
              </button>
            </div>
          </div>
        ` : ''}

        <button class="auth-screen__google btn btn--primary btn--full" data-action="auth-google" type="button">
          <span class="auth-screen__google-icon">${AUTH_ICON_GOOGLE}</span>
          Zaloguj się z Google
        </button>

        <p class="auth-screen__divider"><span>lub przez e-mail</span></p>

        ${guestClaimFlow ? `
          <p class="auth-screen__claim-note">Załóż konto, aby przejąć profil gościa z meczami i statystykami.</p>
        ` : ''}

        <div class="auth-screen__tabs" role="tablist">
          <button class="auth-screen__tab${!isRegister ? ' auth-screen__tab--active' : ''}" data-action="auth-mode" data-mode="login" type="button" role="tab">Zaloguj się</button>
          <button class="auth-screen__tab${isRegister ? ' auth-screen__tab--active' : ''}" data-action="auth-mode" data-mode="register" type="button" role="tab">${guestClaimFlow ? 'Załóż konto' : 'Zarejestruj się'}</button>
        </div>

        <form class="auth-screen__form" data-action="auth-form">
          <label class="auth-screen__field">
            <span class="auth-screen__field-icon">${AUTH_ICON_MAIL}</span>
            <input class="auth-screen__input" id="auth-email" name="email" type="email" autocomplete="email" required placeholder="E-mail">
          </label>

          <label class="auth-screen__field">
            <span class="auth-screen__field-icon">${AUTH_ICON_LOCK}</span>
            <input class="auth-screen__input auth-screen__input--password" id="auth-password" name="password" type="${pwType}" autocomplete="${isRegister ? 'new-password' : 'current-password'}" required minlength="6" placeholder="Hasło">
            <span class="auth-screen__pw-actions">
              ${isRegister ? `<button class="auth-screen__pw-generate" data-action="generate-auth-password" type="button" aria-label="Wygeneruj hasło">${DICE_ICON}</button>` : ''}
              <button class="auth-screen__pw-toggle" data-action="toggle-auth-password" type="button" aria-label="${profileAuthShowPassword ? 'Ukryj hasło' : 'Pokaż hasło'}">
                ${authPasswordToggleIcon()}
              </button>
            </span>
          </label>

          ${isRegister ? `
          <label class="auth-screen__field auth-screen__field--pin">
            <span class="auth-screen__field-icon">${AUTH_ICON_LOCK}</span>
            <input class="auth-screen__input pin-input" id="auth-pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" required placeholder="PIN (4 cyfry)">
          </label>
          <label class="auth-screen__field auth-screen__field--pin">
            <span class="auth-screen__field-icon">${AUTH_ICON_LOCK}</span>
            <input class="auth-screen__input pin-input" id="auth-pin-confirm" name="pin-confirm" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" required placeholder="Powtórz PIN">
          </label>
          ` : ''}

          ${profileAuthNotice ? `<p class="auth-screen__notice auth-screen__notice--success">${escAttr(profileAuthNotice)}</p>` : ''}
          ${profileAuthError ? `<p class="auth-screen__error">${profileAuthError}</p>` : ''}
          ${pendingSignupEmail ? `<button class="btn btn--outline btn--full auth-screen__resend" data-action="resend-signup-email" type="button">Wyślij link aktywacyjny ponownie</button>` : ''}

          <button class="btn btn--primary btn--full auth-screen__submit" type="submit">${submitLabel}</button>
        </form>
      </div>
    </div>`;
}

function renderLoginProfileBackBar() {
  if (userSession.loggedIn || !profileOpen) return '';
  return `
    <div class="back-bar">
      <button class="back-btn" data-action="close-login-profile" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
        Wróć
      </button>
    </div>`;
}

function renderProfileLoggedOut() {
  const cloudReady = typeof BadmintonCloud !== 'undefined' && BadmintonCloud.isConfigured();
  if (!cloudReady) {
    return `
      <div class="profile-panel sub-screen">
        ${renderLoginProfileBackBar()}
        <div class="profile-panel__login">
          <div class="profile-panel__login-icon">🏸</div>
          <h2>Witaj w ${APP_NAME}</h2>
          <p>Zaloguj się, aby zarządzać swoim profilem zawodnika.</p>
          <p class="profile-auth__hint">Synchronizacja chmurowa: uzupełnij <code>js/config.js</code> — instrukcja w <code>docs/SUPABASE-SETUP.md</code>.</p>
          <button class="btn btn--primary btn--full" data-action="login-local" type="button">Kontynuuj lokalnie</button>
        </div>
      </div>`;
  }

  return `<div class="profile-panel sub-screen profile-panel--auth">${renderLoginProfileBackBar()}${renderAuthScreen({ showBrand: false })}</div>`;
}

function escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

let toastTimer = null;

function showToast(message, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.className = `toast toast--${type} toast--visible`;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--visible'), 3000);
}

function forceClearModals() {
  pendingConfirm = null;
  document.getElementById('app-confirm')?.remove();
}

function clearStuckOverlays() {
  if (!pendingConfirm) document.getElementById('app-confirm')?.remove();
}

function healOrphanUiState() {
  if (!openMatchId) {
    setPlayOpen = false;
    matchInfoOpen = false;
    servePickerMatchId = null;
    matchTeamEditSide = null;
    return;
  }
  const m = matches.find(x => x.id === openMatchId);
  if (!m) {
    openMatchId = null;
    setPlayOpen = false;
    matchInfoOpen = false;
    servePickerMatchId = null;
    matchTeamEditSide = null;
    return;
  }
  if (isServeDuelActive(m) && isServeDuelStarter(m) && servePickerMatchId !== m.id) {
    servePickerMatchId = m.id;
    try { sessionStorage.setItem(SERVE_PICKER_KEY, String(m.id)); } catch (_) {}
  }
  if (setPlayOpen) {
    const active = isMatchActive(m);
    const archive = isMatchArchive(m);
    const editable = canEditMatch(m);
    const willShowSetPlay = !setDetailN && !editSetN && !archive && active && !reopenMatchEdit;
    const willShowArchive = shouldShowArchiveSetOverlay(m);
    const willShowDetail = !!setDetailN && !editSetN;
    if (!willShowSetPlay && !willShowArchive && !willShowDetail) {
      setPlayOpen = false;
      editSetN = null;
      setDetailN = null;
    }
  }
  if (servePickerMatchId) {
    const duelMatch = matches.find(x => x.id === servePickerMatchId);
    if (!duelMatch || !isServeDuelActive(duelMatch)) {
      servePickerMatchId = null;
      try { sessionStorage.removeItem(SERVE_PICKER_KEY); } catch (_) {}
    }
  }
  if (matchTeamEditSide && !canEditMatch(m)) matchTeamEditSide = null;
}

function mountAppConfirmOverlay() {
  let el = document.getElementById('app-confirm');
  if (!el && pendingConfirm) {
    const { title, message, confirmLabel, cancelLabel, danger } = pendingConfirm;
    el = document.createElement('div');
    el.id = 'app-confirm';
    el.className = 'app-confirm';
    el.innerHTML = `
      <button class="app-confirm__backdrop" data-action="app-confirm-cancel" type="button" aria-label="Anuluj"></button>
      <div class="app-confirm__panel" role="alertdialog" aria-modal="true" aria-labelledby="app-confirm-title">
        <h3 class="app-confirm__title" id="app-confirm-title">${title || 'Potwierdź'}</h3>
        ${message ? `<p class="app-confirm__message">${message.replace(/\n/g, '<br>')}</p>` : ''}
        <div class="app-confirm__actions">
          <button class="btn btn--outline btn--full" data-action="app-confirm-cancel" type="button">${cancelLabel || 'Anuluj'}</button>
          <button class="btn btn--full${danger ? ' btn--danger' : ' btn--primary'}" data-action="app-confirm-ok" type="button">${confirmLabel || 'Tak'}</button>
        </div>
      </div>`;
    (document.getElementById('app') || document.body).appendChild(el);
  }
}

function dismissAppConfirm(result) {
  pendingConfirm?.resolve?.(result);
  pendingConfirm = null;
  document.getElementById('app-confirm')?.remove();
}

function showAppConfirm({ title, message = '', confirmLabel = 'Tak', cancelLabel = 'Anuluj', danger = false }) {
  return new Promise(resolve => {
    pendingConfirm = { title, message, confirmLabel, cancelLabel, danger, resolve };
    mountAppConfirmOverlay();
  });
}

function profileSyncStatusText(status, detail) {
  const label = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.statusLabel() : '';
  if (status === 'error' && detail) return `${label} — ${detail}`;
  return label;
}

const SYNC_ICON_OK = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path d="M9 12l2 2 4-4"/></svg>`;
const SYNC_ICON_SPIN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 00-9-9 8.95 8.95 0 00-5.1 1.6L5 8"/><path d="M3 12a9 9 0 009 9 8.95 8.95 0 005.1-1.6L19 16"/><polyline points="8 3 5 8 10 8"/><polyline points="16 21 19 16 14 16"/></svg>`;
const SYNC_ICON_WARN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const SYNC_ICON_OFFLINE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h.01"/><path d="M8.5 16.43a5 5 0 017 0"/><path d="M5 12.55a10 10 0 0114.08 0"/><path d="M2 8.82a16 16 0 0120 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

function profileSyncStatusLabel(status) {
  if (syncManualActive || status === 'syncing') return 'synchronizacja…';
  switch (status) {
    case 'synced': return 'połączono';
    case 'error': return 'błąd';
    case 'offline': return 'offline';
    default: return 'sprawdź';
  }
}

function profileSyncIcon(status) {
  if (syncManualActive || status === 'syncing') return SYNC_ICON_SPIN;
  if (status === 'synced') return SYNC_ICON_OK;
  if (status === 'error') return SYNC_ICON_WARN;
  if (status === 'offline') return SYNC_ICON_OFFLINE;
  return SYNC_ICON_SPIN;
}

function updateProfileSyncBadgeDOM() {
  const badge = document.querySelector('.profile-sync-badge');
  if (!badge) return;
  const status = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getStatus() : 'idle';
  const title = profileSyncStatusText(status, cloudSyncDetail);
  badge.className = `profile-sync-badge profile-sync-badge--${status}${syncManualActive ? ' profile-sync-badge--manual' : ''}`;
  badge.setAttribute('aria-label', `Synchronizacja: ${title}. Dotknij, aby odświeżyć.`);
  const iconWrap = badge.querySelector('.profile-sync-badge__icon');
  const statusEl = badge.querySelector('.profile-sync-badge__status');
  if (iconWrap) {
    iconWrap.className = `profile-sync-badge__icon${(syncManualActive || status === 'syncing') ? ' profile-sync-badge__icon--spin' : ''}`;
    iconWrap.innerHTML = profileSyncIcon(status);
  }
  if (statusEl) statusEl.textContent = profileSyncStatusLabel(status);
}

function getBiometricStore() {
  try {
    const raw = localStorage.getItem(BIOMETRIC_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function hasBiometricEnrolled(userId) {
  return !!(userId && getBiometricStore()[userId]?.credentialId);
}

function getPinUserKey() {
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  if (cloudUser?.id) return cloudUser.id;
  if (userSession.playerId != null) return `local:${userSession.playerId}`;
  return null;
}

function hasPin() {
  return !!userSession.pinHash;
}

function needsPinSetup() {
  return userSession.loggedIn && !hasPin();
}

function sanitizePinInput(el) {
  if (!el) return false;
  const max = parseInt(el.getAttribute('maxlength') || '4', 10) || 4;
  const clean = String(el.value || '').replace(/\D/g, '').slice(0, max);
  if (el.value === clean) return false;
  const sel = el.selectionStart;
  el.value = clean;
  const pos = sel != null ? Math.min(sel, clean.length) : clean.length;
  try { el.setSelectionRange(pos, pos); } catch (_) {}
  return true;
}

function isPinControlKey(e) {
  return e.ctrlKey || e.metaKey || e.altKey
    || ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key);
}

function bindPinInputGuards() {
  document.addEventListener('keydown', e => {
    if (!e.target.classList?.contains('pin-input')) return;
    if (isPinControlKey(e)) return;
    if (e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();
  });
  document.addEventListener('paste', e => {
    const el = e.target;
    if (!el.classList?.contains('pin-input')) return;
    e.preventDefault();
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const merged = (el.value.slice(0, start) + pasted + el.value.slice(end)).replace(/\D/g, '').slice(0, 4);
    el.value = merged;
    const pos = Math.min(start + pasted.length, merged.length);
    try { el.setSelectionRange(pos, pos); } catch (_) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  document.addEventListener('input', e => {
    if (!e.target.classList?.contains('pin-input')) return;
    sanitizePinInput(e.target);
  }, true);
}

async function hashPin(pin, userKey) {
  const data = new TextEncoder().encode(`${userKey}:${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(buf);
}

async function setUserPin(pin) {
  const key = getPinUserKey();
  if (!key) throw new Error('Brak konta użytkownika');
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN musi mieć dokładnie 4 cyfry');
  userSession.pinHash = await hashPin(pin, key);
  userSession.pinKey = key;
}

async function clearUserPin() {
  userSession.pinHash = null;
  userSession.pinKey = null;
}

async function verifyUserPin(pin) {
  const key = getPinUserKey();
  if (!key || !userSession.pinHash) return false;
  const hash = await hashPin(pin, key);
  return hash === userSession.pinHash;
}

async function verifyUserPinOrThrow(pin) {
  if (!(await verifyUserPin(pin))) throw new Error('Nieprawidłowy PIN');
}

async function verifySecurityAction({ pinInputId, useBiometric = false } = {}) {
  if (!hasPin()) throw new Error('Najpierw ustaw PIN w ustawieniach logowania');
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  if (useBiometric) {
    if (!cloudUser || !hasBiometricEnrolled(cloudUser.id)) {
      throw new Error('Biometria nie jest skonfigurowana');
    }
    await verifyDeviceBiometric(cloudUser);
    return;
  }
  const pin = document.getElementById(pinInputId)?.value || '';
  if (!/^\d{4}$/.test(pin)) throw new Error('Wpisz 4-cyfrowy PIN');
  await verifyUserPinOrThrow(pin);
}

const PROFILE_CAMERA_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
const PROFILE_REMOVE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

function renderProfileAvatarStack({ avatarHtml, changeAction, removeAction, removeAttrs = '' }) {
  return `
    <div class="profile-avatar-stack">
      <button class="profile-panel__avatar-wrap profile-panel__avatar-wrap--team" data-action="${changeAction}" type="button"${removeAttrs}>
        ${avatarHtml}
        <span class="profile-panel__camera">${PROFILE_CAMERA_ICON}</span>
      </button>
      ${removeAction ? `
        <button class="profile-avatar-remove" data-action="${removeAction}" type="button" aria-label="Usuń zdjęcie"${removeAttrs}>
          ${PROFILE_REMOVE_ICON}
        </button>
      ` : ''}
    </div>`;
}

function canUseBiometric() {
  return typeof window.PublicKeyCredential !== 'undefined';
}

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str);
}

function base64ToBuffer(b64) {
  const str = atob(b64);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buf[i] = str.charCodeAt(i);
  return buf;
}

async function registerDeviceBiometric(user) {
  if (!canUseBiometric()) throw new Error('Urządzenie nie obsługuje logowania biometrycznego');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: APP_NAME, id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(user.id),
        name: user.email || user.id,
        displayName: getCurrentPlayer()?.displayName || 'Użytkownik',
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
    },
  });
  if (!cred?.rawId) throw new Error('Nie udało się zapisać biometrii');
  const store = getBiometricStore();
  store[user.id] = { credentialId: bufferToBase64(cred.rawId) };
  localStorage.setItem(BIOMETRIC_STORE_KEY, JSON.stringify(store));
}

async function verifyDeviceBiometric(user) {
  const entry = getBiometricStore()[user?.id];
  if (!entry?.credentialId) throw new Error('Biometria nie jest skonfigurowana');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{
        id: base64ToBuffer(entry.credentialId),
        type: 'public-key',
        transports: ['internal'],
      }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
}

function clearLocalAppData() {
  localStorage.removeItem(STORAGE_KEY);
  players = [];
  teams = [];
  matches = [];
  userSession = {
    playerId: null,
    avatarUrl: null,
    notifications: false,
    loggedIn: false,
    authEmail: null,
    pinHash: null,
    pinKey: null,
  };
}

function updateSaveNameButton() {
  const input = document.getElementById('display-name');
  const btn = document.getElementById('save-name-btn');
  const errEl = document.getElementById('display-name-error');
  const player = getCurrentPlayer();
  if (!input || !btn || !player) return;
  const trimmed = clampPlayerOrTeamName(input.value);
  const unchanged = trimmed === player.displayName.trim();
  const taken = !unchanged && trimmed && isNameTaken(trimmed, player.id);
  const invalid = !trimmed;
  const tooLong = String(input.value ?? '').trim().length > MAX_PLAYER_TEAM_NAME_LEN;
  btn.disabled = unchanged || invalid || taken || tooLong;
  btn.classList.toggle('btn--primary', !btn.disabled);
  btn.classList.toggle('btn--secondary', btn.disabled);
  if (errEl) {
    errEl.textContent = taken ? 'Ta nazwa jest już zajęta' : tooLong ? `Maksymalnie ${MAX_PLAYER_TEAM_NAME_LEN} znaków` : '';
    errEl.hidden = !taken && !tooLong;
  }
}

async function triggerManualSync() {
  if (typeof BadmintonCloud === 'undefined' || !BadmintonCloud.isConfigured()) return;
  syncManualActive = true;
  updateProfileSyncBadgeDOM();
  showToast('Synchronizacja z chmurą…', 'info');
  try {
    const status = await BadmintonCloud.manualSync();
    if (status === 'synced') showToast('Połączono — dane zsynchronizowane', 'success');
    else if (status === 'offline') showToast('Offline — zapis tylko na urządzeniu', 'warn');
    else if (status === 'error') showToast(cloudSyncDetail || 'Błąd synchronizacji', 'error');
    else showToast(BadmintonCloud.statusLabel() || 'Gotowe', 'info');
  } catch (err) {
    showToast(err.message || 'Błąd synchronizacji', 'error');
  } finally {
    syncManualActive = false;
    updateProfileSyncBadgeDOM();
  }
}

async function verifyDangerousAction({
  confirmWord,
  textInputId,
  passwordInputId,
  emailInputId,
  useBiometric = false,
} = {}) {
  if (document.getElementById(textInputId)?.value.trim() !== confirmWord) {
    throw new Error(`Wpisz ${confirmWord}, aby potwierdzić`);
  }

  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const cloudReady = typeof BadmintonCloud !== 'undefined' && BadmintonCloud.isReady?.();

  if (useBiometric) {
    if (!cloudUser) throw new Error('Biometria wymaga zalogowanego konta');
    if (!hasBiometricEnrolled(cloudUser.id)) throw new Error('Biometria nie jest skonfigurowana');
    await verifyDeviceBiometric(cloudUser);
    return;
  }

  if (cloudReady && cloudUser) {
    if (BadmintonCloud.getAuthProvider() === 'email') {
      const pw = document.getElementById(passwordInputId)?.value || '';
      if (!pw) throw new Error('Podaj hasło, aby potwierdzić');
      await BadmintonCloud.verifyPassword(cloudUser.email, pw);
      return;
    }
    if (hasBiometricEnrolled(cloudUser.id)) {
      throw new Error('Potwierdź biometrią lub wpisz swój e-mail');
    }
    const emailConfirm = document.getElementById(emailInputId)?.value.trim().toLowerCase() || '';
    if (!cloudUser.email || emailConfirm !== cloudUser.email.toLowerCase()) {
      throw new Error('Wpisz swój adres e-mail, aby potwierdzić');
    }
    return;
  }

  const player = getCurrentPlayer();
  const second = document.getElementById(emailInputId)?.value.trim() || '';
  if (!player?.displayName || second.toLowerCase() !== player.displayName.toLowerCase()) {
    throw new Error('Wpisz swoje imię wyświetlane, aby potwierdzić');
  }
}

async function executeDeleteAccount({ useBiometric = false } = {}) {
  deleteAccountError = '';
  if (typeof BadmintonCloud === 'undefined' || !BadmintonCloud.isConfigured()) return;
  const cloudUser = BadmintonCloud.getUser();
  if (!cloudUser) {
    deleteAccountError = 'Brak aktywnej sesji';
    render();
    return;
  }
  try {
    await verifyDangerousAction({
      confirmWord: DANGER_WORD_DELETE,
      textInputId: 'delete-confirm-text',
      passwordInputId: 'delete-confirm-password',
      emailInputId: 'delete-confirm-email',
      useBiometric,
    });
    await BadmintonCloud.deleteAccount();
    const store = getBiometricStore();
    delete store[cloudUser.id];
    localStorage.setItem(BIOMETRIC_STORE_KEY, JSON.stringify(store));
    localStorage.removeItem('badminton-sync-meta');
    clearLocalAppData();
    deleteAccountOpen = false;
    authWantsProfile = false;
    profileOpen = false;
    render();
    showToast('Konto zostało usunięte', 'info');
  } catch (err) {
    deleteAccountError = err.message || 'Nie udało się usunąć konta';
    render();
  }
}

function resetAllStatsData() {
  matches = [];
  teams = [];
  players = [];
  signupInvites = [];
  leagueTombstones = { matches: {}, players: {}, teams: {} };
  userSession.playerId = null;
  userSession.avatarUrl = null;
  suppressAutoPlayerBootstrap = true;
  openMatchId = null;
  openPlayerId = null;
  openTeamId = null;
  addGuestOpen = false;
  inviteShareOpen = false;
  playersRosterTab = 'players';
  newMatchOpen = false;
  newMatchDraft = null;
  newTeamOpen = false;
  newTeamDraft = null;
  matchView = 'detail';
  matchInfoOpen = false;
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  ctxTarget = null;
  reopenMatchEdit = false;
  clearSetTimer();
  clearMatchClockTicker();
}

async function executeResetStats({ useBiometric = false } = {}) {
  resetStatsError = '';
  try {
    await verifyDangerousAction({
      confirmWord: DANGER_WORD_RESET,
      textInputId: 'reset-confirm-text',
      passwordInputId: 'reset-confirm-password',
      emailInputId: 'reset-confirm-second',
      useBiometric,
    });
    resetAllStatsData();
    saveState({ immediatePush: true });
    resetStatsOpen = false;
    render();
    showToast('Liga wyczyszczona — wszyscy zawodnicy i mecze usunięci', 'success');
  } catch (err) {
    resetStatsError = err.message || 'Nie udało się wyzerować statystyk';
    render();
  }
}

async function executeChangeGoogleAccount({ useBiometric = false } = {}) {
  changeGoogleError = '';
  if (typeof BadmintonCloud === 'undefined' || !BadmintonCloud.isConfigured()) return;
  const cloudUser = BadmintonCloud.getUser();
  if (!cloudUser) {
    changeGoogleError = 'Brak aktywnej sesji';
    render();
    return;
  }
  if (BadmintonCloud.getAuthProvider() !== 'google') {
    changeGoogleError = 'Dostępne tylko dla konta Google';
    render();
    return;
  }
  const player = getCurrentPlayer();
  if (!player) {
    changeGoogleError = 'Brak profilu zawodnika';
    render();
    return;
  }
  try {
    await verifyDangerousAction({
      confirmWord: DANGER_WORD_GOOGLE,
      textInputId: 'google-confirm-text',
      passwordInputId: 'google-confirm-password',
      emailInputId: 'google-confirm-second',
      useBiometric,
    });
    sessionStorage.setItem(GOOGLE_RELINK_KEY, JSON.stringify({
      playerId: player.id,
      oldAuthUserId: cloudUser.id,
      at: Date.now(),
    }));
    googleRelinkInProgress = true;
    saveState();
    changeGoogleOpen = false;
    await BadmintonCloud.signOut();
    await BadmintonCloud.signInWithGoogle({ selectAccount: true });
  } catch (err) {
    googleRelinkInProgress = false;
    sessionStorage.removeItem(GOOGLE_RELINK_KEY);
    changeGoogleError = err.message || 'Nie udało się zmienić konta Google';
    changeGoogleOpen = true;
    render();
  }
}

function openChangeGoogleFromLongPress() {
  suppressSyncClick = true;
  if (typeof BadmintonCloud !== 'undefined' && BadmintonCloud.getAuthProvider?.() === 'google') {
    changeGoogleOpen = true;
    changeGoogleError = '';
    render();
  } else {
    showToast('Zmiana konta Google dostępna tylko przy logowaniu przez Google', 'info');
  }
}

function renderProfileSyncBadge() {
  if (typeof BadmintonCloud === 'undefined' || !BadmintonCloud.isConfigured()) return '';
  const status = BadmintonCloud.getStatus();
  const email = userSession.authEmail || BadmintonCloud.getUser()?.email || '';
  if (!email) return '';
  const title = escAttr(profileSyncStatusText(status, cloudSyncDetail));
  const spinClass = (syncManualActive || status === 'syncing') ? ' profile-sync-badge__icon--spin' : '';
  const statusLabel = profileSyncStatusLabel(status);
  const isGoogle = BadmintonCloud.getAuthProvider?.() === 'google';
  const ariaHint = isGoogle ? ' Przytrzymaj panel, aby zmienić konto Google.' : '';
  return `
    <div class="profile-sync-wrap" data-profile-sync-panel${isGoogle ? ' data-profile-sync-google' : ''} role="group"${isGoogle ? ` aria-label="Synchronizacja: ${title}. Dotknij badge, aby odświeżyć.${ariaHint}"` : ''}>
      <button class="profile-sync-badge profile-sync-badge--${status}${syncManualActive ? ' profile-sync-badge--manual' : ''}" data-action="sync-refresh" type="button" aria-label="Synchronizacja: ${title}. Dotknij, aby odświeżyć.">
        <span class="profile-sync-badge__icon${spinClass}">${profileSyncIcon(status)}</span>
        <span class="profile-sync-badge__text">
          <span class="profile-sync-badge__email">${escAttr(email)}</span>
          <span class="profile-sync-badge__sep" aria-hidden="true">·</span>
          <span class="profile-sync-badge__status">${statusLabel}</span>
        </span>
      </button>
      ${isGoogle ? '<p class="profile-sync-hint" aria-hidden="true">Przytrzymaj panel, aby zmienić konto Google</p>' : ''}
    </div>`;
}

function renderDangerSecondFactorFields(prefix, { provider, cloudUser, bioReady } = {}) {
  const needsPassword = cloudUser && provider === 'email';
  const needsEmail = cloudUser && provider !== 'email' && !bioReady;
  const needsName = !cloudUser;
  if (needsPassword) {
    return `
      <label class="confirm-sheet__field">
        <span class="confirm-sheet__label">Hasło do konta</span>
        <input class="profile-card__input" id="${prefix}-confirm-password" type="password" autocomplete="current-password" placeholder="Hasło">
      </label>`;
  }
  if (needsEmail) {
    return `
      <label class="confirm-sheet__field">
        <span class="confirm-sheet__label">Twój adres e-mail</span>
        <input class="profile-card__input" id="${prefix}-confirm-second" type="email" autocomplete="email" placeholder="adres@email.com">
      </label>`;
  }
  if (needsName) {
    return `
      <label class="confirm-sheet__field">
        <span class="confirm-sheet__label">Twoje imię wyświetlane</span>
        <input class="profile-card__input" id="${prefix}-confirm-second" type="text" autocomplete="off" placeholder="Dokładnie jak w profilu">
      </label>`;
  }
  if (bioReady) {
    return '<p class="confirm-sheet__hint">Konto Google — wpisz słowo powyżej i potwierdź biometrią.</p>';
  }
  return '';
}

function renderDeleteAccountModal() {
  if (!deleteAccountOpen) return '';
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const provider = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getAuthProvider() : null;
  const bioReady = cloudUser && hasBiometricEnrolled(cloudUser.id);
  return `
    <div class="confirm-sheet" data-confirm="delete-account">
      <button class="confirm-sheet__backdrop" data-action="close-delete-account" type="button" aria-label="Anuluj"></button>
      <div class="confirm-sheet__panel">
        <h3 class="confirm-sheet__title">Usunąć konto?</h3>
        <p class="confirm-sheet__warn">Wszystkie dane zostaną trwale usunięte: mecze, zawodnicy, drużyny i profil w chmurze. Tej operacji nie można cofnąć.</p>
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">Wpisz <strong>${DANGER_WORD_DELETE}</strong>, aby potwierdzić</span>
          <input class="profile-card__input" id="delete-confirm-text" type="text" autocomplete="off" placeholder="${DANGER_WORD_DELETE}">
        </label>
        ${renderDangerSecondFactorFields('delete', { provider, cloudUser, bioReady })}
        ${deleteAccountError ? `<p class="auth-screen__error">${escAttr(deleteAccountError)}</p>` : ''}
        <div class="confirm-sheet__actions">
          ${bioReady ? `<button class="btn btn--secondary btn--full btn--biometric" data-action="delete-account-biometric" type="button">${BIOMETRIC_ICON}<span>Potwierdź biometrią</span></button>` : ''}
          <button class="btn btn--danger btn--full" data-action="confirm-delete-account" type="button" disabled>Usuń konto na zawsze</button>
          <button class="btn btn--outline btn--full" data-action="close-delete-account" type="button">Anuluj</button>
        </div>
      </div>
    </div>`;
}

function renderResetStatsModal() {
  if (!resetStatsOpen) return '';
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const provider = cloudUser && typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getAuthProvider() : null;
  const bioReady = cloudUser && hasBiometricEnrolled(cloudUser.id);
  return `
    <div class="confirm-sheet" data-confirm="reset-stats">
      <button class="confirm-sheet__backdrop" data-action="close-reset-stats" type="button" aria-label="Anuluj"></button>
      <div class="confirm-sheet__panel">
        <h3 class="confirm-sheet__title">Wyczyścić całą ligę?</h3>
        <p class="confirm-sheet__warn">Usuniemy wszystkich zawodników (w tym gości), mecze, sety, drużyny i zaproszenia. Twoje konto logowania zostaje — po ponownym wejściu w profil możesz założyć nowy profil zawodnika. Tej operacji nie można cofnąć.</p>
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">Wpisz <strong>${DANGER_WORD_RESET}</strong>, aby potwierdzić</span>
          <input class="profile-card__input" id="reset-confirm-text" type="text" autocomplete="off" placeholder="${DANGER_WORD_RESET}">
        </label>
        ${renderDangerSecondFactorFields('reset', { provider, cloudUser, bioReady })}
        ${resetStatsError ? `<p class="auth-screen__error">${escAttr(resetStatsError)}</p>` : ''}
        <div class="confirm-sheet__actions">
          ${bioReady ? `<button class="btn btn--secondary btn--full btn--biometric" data-action="reset-stats-biometric" type="button">${BIOMETRIC_ICON}<span>Potwierdź biometrią</span></button>` : ''}
          <button class="btn btn--danger btn--full" data-action="confirm-reset-stats" type="button" disabled>Wyczyść ligę</button>
          <button class="btn btn--outline btn--full" data-action="close-reset-stats" type="button">Anuluj</button>
        </div>
      </div>
    </div>`;
}

function renderChangeGoogleModal() {
  if (!changeGoogleOpen) return '';
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const provider = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getAuthProvider() : null;
  const bioReady = cloudUser && hasBiometricEnrolled(cloudUser.id);
  const email = userSession.authEmail || cloudUser?.email || '';
  return `
    <div class="confirm-sheet" data-confirm="change-google">
      <button class="confirm-sheet__backdrop" data-action="close-change-google" type="button" aria-label="Anuluj"></button>
      <div class="confirm-sheet__panel">
        <h3 class="confirm-sheet__title">Zmienić konto Google?</h3>
        <p class="confirm-sheet__warn">Profil zawodnika i statystyki w aplikacji zostaną bez zmian. Zalogujesz się innym kontem Google — dane w chmurze dla nowego konta zostaną nadpisane bieżącym stanem aplikacji.</p>
        ${email ? `<p class="confirm-sheet__hint">Obecne konto: <strong>${escAttr(email)}</strong></p>` : ''}
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">Wpisz <strong>${DANGER_WORD_GOOGLE}</strong>, aby potwierdzić</span>
          <input class="profile-card__input" id="google-confirm-text" type="text" autocomplete="off" placeholder="${DANGER_WORD_GOOGLE}">
        </label>
        ${renderDangerSecondFactorFields('google', { provider, cloudUser, bioReady })}
        ${changeGoogleError ? `<p class="auth-screen__error">${escAttr(changeGoogleError)}</p>` : ''}
        <div class="confirm-sheet__actions">
          ${bioReady ? `<button class="btn btn--secondary btn--full btn--biometric" data-action="change-google-biometric" type="button">${BIOMETRIC_ICON}<span>Potwierdź biometrią</span></button>` : ''}
          <button class="btn btn--primary btn--full" data-action="confirm-change-google" type="button" disabled>Zmień konto Google</button>
          <button class="btn btn--outline btn--full" data-action="close-change-google" type="button">Anuluj</button>
        </div>
      </div>
    </div>`;
}

function renderBiometricCard(cloudUser) {
  if (!canUseBiometric() || !cloudUser) return '';
  const enrolled = hasBiometricEnrolled(cloudUser.id);
  return `
    <div class="profile-card">
      <div class="profile-card__biometric-head">
        ${BIOMETRIC_ICON}
        <div>
          <h3 class="profile-card__title">Biometria</h3>
          <p class="profile-card__desc profile-card__desc--tight">${enrolled
    ? 'Odcisk palca lub Face ID do potwierdzania ważnych operacji.'
    : 'Włącz odcisk palca lub Face ID do potwierdzania ważnych operacji.'}</p>
        </div>
      </div>
      <button class="btn ${enrolled ? 'btn--secondary' : 'btn--primary'} btn--full" data-action="${enrolled ? 'remove-biometric' : 'register-biometric'}" type="button">
        ${enrolled ? 'Wyłącz biometrię' : 'Włącz biometrię'}
      </button>
    </div>`;
}

function renderPinSetupBanner() {
  if (!needsPinSetup()) return '';
  return `
    <div class="pin-setup-banner profile-card" id="pin-setup-banner">
      <div class="pin-setup-banner__head">
        <span class="pin-setup-banner__icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </span>
        <div class="pin-setup-banner__copy">
          <h3 class="pin-setup-banner__title">Ustaw PIN zabezpieczający</h3>
          <p class="pin-setup-banner__desc">4-cyfrowy PIN potwierdza ważne operacje w aplikacji: usuwanie drużyn i zawodników, wyzerowanie statystyk oraz usunięcie konta. Bez PIN-u nie wykonasz tych akcji — to dodatkowa ochrona przed przypadkowym lub nieautoryzowanym użyciem.</p>
        </div>
      </div>
      <label class="confirm-sheet__field">
        <span class="confirm-sheet__label">Nowy PIN</span>
        <input class="profile-card__input pin-input" id="pin-setup-new" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" placeholder="••••">
      </label>
      <label class="confirm-sheet__field">
        <span class="confirm-sheet__label">Powtórz PIN</span>
        <input class="profile-card__input pin-input" id="pin-setup-confirm" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" placeholder="••••">
      </label>
      ${pinSetupError ? `<p class="auth-screen__error">${escAttr(pinSetupError)}</p>` : ''}
      <button class="btn btn--primary btn--full" data-action="confirm-pin-setup" type="button" disabled id="pin-setup-submit">Zapisz PIN</button>
    </div>`;
}

function renderPinSetupModal() {
  return '';
}

function renderPinRemoveFields() {
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const provider = cloudUser && typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getAuthProvider() : null;
  if (cloudUser && provider === 'email') {
    return `
      <label class="confirm-sheet__field">
        <span class="confirm-sheet__label">Hasło do konta (potwierdzenie)</span>
        <input class="profile-card__input" id="pin-remove-password" type="password" autocomplete="current-password" placeholder="Hasło">
      </label>`;
  }
  if (cloudUser?.email) {
    return `
      <label class="confirm-sheet__field">
        <span class="confirm-sheet__label">Twój adres e-mail (potwierdzenie)</span>
        <input class="profile-card__input" id="pin-remove-email" type="email" autocomplete="email" placeholder="adres@email.com">
      </label>`;
  }
  return `
    <label class="confirm-sheet__field">
      <span class="confirm-sheet__label">Twoje imię wyświetlane (potwierdzenie)</span>
      <input class="profile-card__input" id="pin-remove-name" type="text" autocomplete="off" placeholder="Dokładnie jak w profilu">
    </label>`;
}

async function verifyPinRemovalIdentity() {
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const provider = cloudUser && typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getAuthProvider() : null;
  if (cloudUser && provider === 'email') {
    const pw = document.getElementById('pin-remove-password')?.value || '';
    if (!pw) throw new Error('Podaj hasło, aby usunąć PIN');
    await BadmintonCloud.verifyPassword(cloudUser.email, pw);
    return;
  }
  if (cloudUser?.email) {
    const email = document.getElementById('pin-remove-email')?.value.trim().toLowerCase() || '';
    if (email !== cloudUser.email.toLowerCase()) throw new Error('Wpisz swój adres e-mail, aby potwierdzić');
    return;
  }
  const player = getCurrentPlayer();
  const name = document.getElementById('pin-remove-name')?.value.trim() || '';
  if (!player?.displayName || name.toLowerCase() !== player.displayName.toLowerCase()) {
    throw new Error('Wpisz swoje imię wyświetlane, aby potwierdzić');
  }
}

function renderLoginSettingsModal() {
  if (!loginSettingsOpen) return '';
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const bioBlock = renderBiometricCard(cloudUser);
  const pinRemoveBlock = hasPin() ? `
        <div class="login-settings__remove-pin">
          <p class="confirm-sheet__hint">Nie pamiętasz PIN lub chcesz go wyłączyć? Usuń go i ustaw nowy poniżej.</p>
          ${renderPinRemoveFields()}
          <button class="btn btn--outline btn--full" data-action="confirm-remove-pin" type="button">Usuń PIN</button>
        </div>
  ` : '';
  return `
    <div class="confirm-sheet" data-confirm="login-settings">
      <button class="confirm-sheet__backdrop" data-action="close-login-settings" type="button" aria-label="Zamknij"></button>
      <div class="confirm-sheet__panel">
        <h3 class="confirm-sheet__title">Ustawienia logowania</h3>
        <p class="confirm-sheet__hint">PIN i biometria służą do potwierdzania ważnych operacji w aplikacji.</p>
        ${hasPin() ? `
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">Obecny PIN</span>
          <input class="profile-card__input pin-input" id="pin-change-current" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="current-password" placeholder="••••">
        </label>
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">Nowy PIN</span>
          <input class="profile-card__input pin-input" id="pin-change-new" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" placeholder="••••">
        </label>
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">Powtórz nowy PIN</span>
          <input class="profile-card__input pin-input" id="pin-change-confirm" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="new-password" placeholder="••••">
        </label>
        ${loginSettingsError ? `<p class="auth-screen__error">${escAttr(loginSettingsError)}</p>` : ''}
        <button class="btn btn--primary btn--full" data-action="confirm-change-pin" type="button" disabled id="pin-change-submit">Zmień PIN</button>
        ${pinRemoveBlock}
        ` : `
        <p class="confirm-sheet__hint">Nie masz ustawionego PIN. Baner w profilu pozwala go dodać.</p>
        `}
        ${bioBlock ? `<div class="login-settings__bio">${bioBlock}</div>` : ''}
        <div class="login-settings__footer">
          <button class="btn btn--outline btn--full" data-action="close-login-settings" type="button">Zamknij</button>
        </div>
      </div>
    </div>`;
}

function renderDeleteTeamModal() {
  if (!deleteTeamOpen || !deleteTeamId) return '';
  const team = getTeam(deleteTeamId);
  if (!team) return '';
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const bioReady = !!(cloudUser && hasBiometricEnrolled(cloudUser.id));
  return `
    <div class="confirm-sheet" data-confirm="delete-team">
      <button class="confirm-sheet__backdrop" data-action="close-delete-team" type="button" aria-label="Anuluj"></button>
      <div class="confirm-sheet__panel">
        <h3 class="confirm-sheet__title">Usunąć drużynę „${escAttr(team.name)}”?</h3>
        <p class="confirm-sheet__warn">Wszelkie dane drużyny zostaną utracone. Zawodnicy składowi i historia meczów pozostaną — zniknie tylko zapisana drużyna z listy.</p>
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">PIN (4 cyfry)</span>
          <input class="profile-card__input pin-input" id="delete-team-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••">
        </label>
        ${deleteTeamError ? `<p class="auth-screen__error">${escAttr(deleteTeamError)}</p>` : ''}
        <div class="confirm-sheet__actions">
          ${bioReady ? `<button class="btn btn--secondary btn--full btn--biometric" data-action="delete-team-biometric" type="button">${BIOMETRIC_ICON}<span>Potwierdź biometrią</span></button>` : ''}
          <button class="btn btn--danger btn--full" data-action="confirm-delete-team" type="button" disabled>Usuń drużynę</button>
          <button class="btn btn--outline btn--full" data-action="close-delete-team" type="button">Anuluj</button>
        </div>
      </div>
    </div>`;
}

function renderDeletePlayerModal() {
  if (!deletePlayerOpen || !deletePlayerId) return '';
  const player = getPlayer(deletePlayerId);
  if (!player) return '';
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const bioReady = !!(cloudUser && hasBiometricEnrolled(cloudUser.id));
  const isGuest = !!player.isGuest;
  return `
    <div class="confirm-sheet" data-confirm="delete-player">
      <button class="confirm-sheet__backdrop" data-action="close-delete-player" type="button" aria-label="Anuluj"></button>
      <div class="confirm-sheet__panel">
        <h3 class="confirm-sheet__title">Usunąć ${isGuest ? 'gościa' : 'zawodnika'} „${escAttr(player.displayName)}”?</h3>
        <p class="confirm-sheet__warn">${isGuest
          ? 'Gość zniknie z listy. Mecze z jego udziałem pozostaną w historii.'
          : 'Zawodnik zniknie z listy. Mecze pozostaną, ale bez tej osoby w składach.'}</p>
        <label class="confirm-sheet__field">
          <span class="confirm-sheet__label">PIN (4 cyfry)</span>
          <input class="profile-card__input pin-input" id="delete-player-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••">
        </label>
        ${deletePlayerError ? `<p class="auth-screen__error">${escAttr(deletePlayerError)}</p>` : ''}
        <div class="confirm-sheet__actions">
          ${bioReady ? `<button class="btn btn--secondary btn--full btn--biometric" data-action="delete-player-biometric" type="button">${BIOMETRIC_ICON}<span>Potwierdź biometrią</span></button>` : ''}
          <button class="btn btn--danger btn--full" data-action="confirm-delete-player" type="button" disabled>${isGuest ? 'Usuń gościa' : 'Usuń zawodnika'}</button>
          <button class="btn btn--outline btn--full" data-action="close-delete-player" type="button">Anuluj</button>
        </div>
      </div>
    </div>`;
}

function updatePinSetupButton() {
  const btn = document.getElementById('pin-setup-submit');
  if (!btn) return;
  const pin = document.getElementById('pin-setup-new')?.value || '';
  const confirm = document.getElementById('pin-setup-confirm')?.value || '';
  btn.disabled = !/^\d{4}$/.test(pin) || pin !== confirm;
}

function updatePinChangeButton() {
  const btn = document.getElementById('pin-change-submit');
  if (!btn) return;
  const current = document.getElementById('pin-change-current')?.value || '';
  const pin = document.getElementById('pin-change-new')?.value || '';
  const confirm = document.getElementById('pin-change-confirm')?.value || '';
  btn.disabled = !/^\d{4}$/.test(current) || !/^\d{4}$/.test(pin) || pin !== confirm;
}

function updateDeleteTeamConfirmButton() {
  const btn = document.querySelector('[data-action="confirm-delete-team"]');
  if (!btn) return;
  const pin = document.getElementById('delete-team-pin')?.value || '';
  btn.disabled = !/^\d{4}$/.test(pin);
}

function updateDeletePlayerConfirmButton() {
  const btn = document.querySelector('[data-action="confirm-delete-player"]');
  if (!btn) return;
  const pin = document.getElementById('delete-player-pin')?.value || '';
  btn.disabled = !/^\d{4}$/.test(pin);
}

async function confirmPinSetup() {
  pinSetupError = '';
  const pin = document.getElementById('pin-setup-new')?.value || '';
  const confirm = document.getElementById('pin-setup-confirm')?.value || '';
  if (!/^\d{4}$/.test(pin)) {
    pinSetupError = 'PIN musi mieć 4 cyfry';
    render();
    return;
  }
  if (pin !== confirm) {
    pinSetupError = 'PIN-y nie są identyczne';
    render();
    return;
  }
  try {
    await setUserPin(pin);
    pinSetupOpen = false;
    saveState();
    showToast('PIN zapisany', 'success');
    render();
  } catch (err) {
    pinSetupError = err.message || 'Nie udało się zapisać PIN';
    render();
  }
}

async function confirmRemovePin() {
  loginSettingsError = '';
  try {
    await verifyPinRemovalIdentity();
    await clearUserPin();
    pinSetupOpen = true;
    saveState({ immediatePush: true });
    showToast('PIN usunięty — ustaw nowy w profilu', 'success');
    loginSettingsOpen = false;
    render();
  } catch (err) {
    loginSettingsError = err.message || 'Nie udało się usunąć PIN';
    render();
  }
}

async function confirmChangePin() {
  loginSettingsError = '';
  const current = document.getElementById('pin-change-current')?.value || '';
  const pin = document.getElementById('pin-change-new')?.value || '';
  const confirm = document.getElementById('pin-change-confirm')?.value || '';
  if (!/^\d{4}$/.test(current) || !/^\d{4}$/.test(pin)) {
    loginSettingsError = 'PIN musi mieć 4 cyfry';
    render();
    return;
  }
  if (pin !== confirm) {
    loginSettingsError = 'Nowe PIN-y nie są identyczne';
    render();
    return;
  }
  try {
    if (!(await verifyUserPin(current))) throw new Error('Nieprawidłowy obecny PIN');
    await setUserPin(pin);
    saveState();
    showToast('PIN zmieniony', 'success');
    loginSettingsOpen = false;
    render();
  } catch (err) {
    loginSettingsError = err.message || 'Nie udało się zmienić PIN';
    render();
  }
}

async function executeDeleteTeam({ useBiometric = false } = {}) {
  deleteTeamError = '';
  const teamId = deleteTeamId;
  if (!teamId || !canEditTeam(getTeam(teamId))) return;
  try {
    await verifySecurityAction({ pinInputId: 'delete-team-pin', useBiometric });
    const result = deleteTeamById(teamId);
    if (!result.ok) throw new Error(result.error || 'Nie udało się usunąć drużyny');
    deleteTeamOpen = false;
    deleteTeamId = null;
    openTeamId = null;
    saveState({ immediatePush: true });
    showToast('Usunięto drużynę', 'info');
    render();
  } catch (err) {
    deleteTeamError = err.message || 'Nie udało się usunąć drużyny';
    render();
  }
}

async function executeDeletePlayer({ useBiometric = false } = {}) {
  deletePlayerError = '';
  const playerId = deletePlayerId;
  const player = getPlayer(playerId);
  if (!playerId || !canDeletePlayer(player)) return;
  try {
    await verifySecurityAction({ pinInputId: 'delete-player-pin', useBiometric });
    const result = deletePlayerById(playerId);
    if (!result.ok) throw new Error(result.error || 'Nie udało się usunąć zawodnika');
    deletePlayerOpen = false;
    deletePlayerId = null;
    openPlayerId = null;
    saveState({ immediatePush: true });
    showToast(player.isGuest ? 'Usunięto gościa' : 'Usunięto zawodnika', 'info');
    render();
  } catch (err) {
    deletePlayerError = err.message || 'Nie udało się usunąć zawodnika';
    render();
  }
}

function updateDangerConfirmButton({
  textId,
  confirmWord,
  passwordId,
  secondId,
  buttonSelector,
  cloudUser,
  provider,
  bioReady,
}) {
  const textOk = document.getElementById(textId)?.value.trim() === confirmWord;
  const btn = document.querySelector(buttonSelector);
  if (!btn) return;
  let ready = textOk;
  if (textOk && provider === 'email') {
    ready = !!(document.getElementById(passwordId)?.value || '').length;
  } else if (textOk && cloudUser && provider !== 'email') {
    ready = bioReady ? false : !!(document.getElementById(secondId)?.value || '').trim();
  } else if (textOk && !cloudUser) {
    ready = !!(document.getElementById(secondId)?.value || '').trim();
  }
  btn.disabled = !ready;
}

function updateDeleteConfirmButton() {
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const provider = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getAuthProvider() : null;
  const bioReady = !!(cloudUser && hasBiometricEnrolled(cloudUser.id));
  updateDangerConfirmButton({
    textId: 'delete-confirm-text',
    confirmWord: DANGER_WORD_DELETE,
    passwordId: 'delete-confirm-password',
    secondId: 'delete-confirm-second',
    buttonSelector: '[data-action="confirm-delete-account"]',
    cloudUser,
    provider,
    bioReady,
  });
}

function updateResetStatsConfirmButton() {
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const provider = cloudUser && typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getAuthProvider() : null;
  const bioReady = !!(cloudUser && hasBiometricEnrolled(cloudUser.id));
  updateDangerConfirmButton({
    textId: 'reset-confirm-text',
    confirmWord: DANGER_WORD_RESET,
    passwordId: 'reset-confirm-password',
    secondId: 'reset-confirm-second',
    buttonSelector: '[data-action="confirm-reset-stats"]',
    cloudUser,
    provider,
    bioReady,
  });
}

function updateChangeGoogleConfirmButton() {
  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  const provider = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getAuthProvider() : null;
  const bioReady = !!(cloudUser && hasBiometricEnrolled(cloudUser.id));
  updateDangerConfirmButton({
    textId: 'google-confirm-text',
    confirmWord: DANGER_WORD_GOOGLE,
    passwordId: 'google-confirm-password',
    secondId: 'google-confirm-second',
    buttonSelector: '[data-action="confirm-change-google"]',
    cloudUser,
    provider,
    bioReady,
  });
}

const NOTIF_ICON_ON = '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>';
const NOTIF_ICON_OFF = '<path d="M13.73 21a2 2 0 01-3.46 0M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><line x1="1" y1="1" x2="23" y2="23"/>';

function updateNotificationsButtonDOM() {
  const btn = document.querySelector('[data-action="toggle-notifications"]');
  if (!btn) return;
  const on = userSession.notifications;
  btn.classList.remove('btn--primary', 'btn--secondary');
  btn.classList.add(on ? 'btn--secondary' : 'btn--primary');
  const svg = btn.querySelector('svg');
  if (svg) svg.innerHTML = on ? NOTIF_ICON_OFF : NOTIF_ICON_ON;
  const label = btn.querySelector('.notif-btn__label');
  if (label) label.textContent = on ? 'Wyłącz powiadomienia' : 'Włącz powiadomienia';
}

function renderPostWipeProfileSetup() {
  return `
    <div class="profile-panel sub-screen">
      <div class="profile-card">
        <h3 class="profile-card__title">Liga wyczyszczona</h3>
        <p class="profile-card__desc">Wszyscy zawodnicy, mecze i drużyny zostały usunięte z aplikacji. Możesz założyć nowy profil zawodnika lub się wylogować.</p>
        <button class="btn btn--primary btn--full" data-action="bootstrap-player-after-wipe" type="button">Utwórz profil zawodnika</button>
        <button class="btn btn--outline btn--full" data-action="logout" type="button">Wyloguj się</button>
      </div>
    </div>`;
}

function renderProfile() {
  if (!userSession.loggedIn) return renderProfileLoggedOut();

  const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
  if (!getCurrentPlayer() && cloudUser && !suppressAutoPlayerBootstrap) {
    ensurePlayerForAuthUser(cloudUser);
  }

  const player = getCurrentPlayer();
  if (!player) {
    if (suppressAutoPlayerBootstrap) return renderPostWipeProfileSetup();
    return `<div class="profile-panel sub-screen"><p class="match-detail__empty">Ładowanie profilu…</p></div>`;
  }

  const notifLabel = userSession.notifications ? 'Wyłącz powiadomienia' : 'Włącz powiadomienia';
  const notifBtnClass = userSession.notifications ? 'btn--secondary' : 'btn--primary';
  const notifIcon = userSession.notifications ? NOTIF_ICON_OFF : NOTIF_ICON_ON;

  return `
    <div class="profile-panel sub-screen">
      ${renderProfileSyncBadge()}
      ${renderPinSetupBanner()}
      <div class="profile-card">
        <div class="profile-card__avatar-row">
          <div class="profile-avatar-stack">
            <button class="profile-panel__avatar-wrap" data-action="change-avatar" type="button">
              ${renderAvatarHtml(player.displayName, getPlayerAvatarUrl(player.id), 'avatar-lg')}
              <span class="profile-panel__camera">${PROFILE_CAMERA_ICON}</span>
            </button>
            ${getPlayerAvatarUrl(player.id) ? `
              <button class="profile-avatar-remove" data-action="remove-avatar" type="button" aria-label="Usuń zdjęcie">
                ${PROFILE_REMOVE_ICON}
              </button>
            ` : ''}
          </div>
          <p class="profile-card__desc profile-card__desc--center">Kliknij ikonę aparatu, aby zmienić avatar.</p>
        </div>
      </div>

      <div class="profile-card">
        <label class="profile-card__label" for="display-name">Imię wyświetlane</label>
        <input class="profile-card__input" id="display-name" type="text" value="${escAttr(player.displayName)}" maxlength="${MAX_PLAYER_TEAM_NAME_LEN}" autocomplete="name">
        <p class="profile-card__field-error" id="display-name-error" hidden></p>
        <button class="btn btn--secondary btn--full" id="save-name-btn" data-action="save-name" type="button" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Zapisz
        </button>
      </div>

      <div class="profile-card">
        <h3 class="profile-card__title">Powiadomienia</h3>
        <p class="profile-card__desc">Wkrótce: przypomnienie o meczach i wynikach. Na razie możesz włączyć preferencję.</p>
        <button class="btn ${notifBtnClass} btn--full" data-action="toggle-notifications" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${notifIcon}</svg>
          <span class="notif-btn__label">${notifLabel}</span>
        </button>
      </div>

      ${userSession.loggedIn ? `
        <button class="btn btn--outline btn--full" data-action="open-login-settings" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          Ustawienia logowania
        </button>
      ` : ''}

      <button class="btn btn--outline btn--full" data-action="logout" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        Wyloguj się
      </button>

      <div class="profile-danger-zone">
        <button class="profile-danger-action" data-action="open-reset-stats" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></svg>
          Wyzeruj ligę (zawodnicy, mecze, drużyny)
        </button>
        ${typeof BadmintonCloud !== 'undefined' && BadmintonCloud.isConfigured() ? `
          <button class="profile-danger-action profile-danger-action--account" data-action="open-delete-account" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Usuń konto i wszystkie dane
          </button>
        ` : ''}
      </div>
      ${renderResetStatsModal()}
      ${renderDeleteAccountModal()}
      ${renderChangeGoogleModal()}
      ${renderLoginSettingsModal()}
      ${renderPinSetupModal()}
    </div>
  `;
}

function shouldElevateBottomNav() {
  return newMatchOpen
    || newTeamOpen
    || openMatchId != null
    || setPlayOpen
    || matchInfoOpen
    || matchTeamEditSide != null;
}

function updateFabMenu() {
  const menu = document.getElementById('fab-menu');
  const fabEl = document.getElementById('fab');
  if (!menu || !fabEl) return;
  const show = playersFabMenuOpen
    && currentTab === 'players'
    && playersRosterTab === 'players'
    && !openPlayerId
    && !openTeamId
    && !addGuestOpen;
  menu.hidden = !show;
  menu.classList.toggle('fab-menu--open', show);
  fabEl.classList.toggle('fab--active', show);
  fabEl.setAttribute('aria-expanded', show ? 'true' : 'false');
}

function updateAppChrome() {
  const canAddMatch = currentTab === 'matches' && canCreateMatch();
  const fabVisible = (canAddMatch || (currentTab === 'players' && (playersRosterTab === 'players' || playersRosterTab === 'teams'))) && !openMatchId && !newMatchOpen && !newTeamOpen && !addGuestOpen && !openPlayerId && !openTeamId;
  document.getElementById('fab-anchor')?.classList.toggle('fab-anchor--visible', fabVisible);
  fab.classList.toggle('fab--visible', fabVisible);
  if (!fabVisible) playersFabMenuOpen = false;
  updateFabMenu();
  document.getElementById('app')?.classList.toggle('app--nav-elevated', shouldElevateBottomNav());
  updateInstallBanner();
}

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

function isIOSInstallable() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) && !isStandaloneApp();
}

function updateInstallBanner() {
  const el = document.getElementById('pwa-install');
  if (!el) return;

  const installable = !isStandaloneApp() && (deferredInstallPrompt || isIOSInstallable());
  const loggedIn = userSession.loggedIn && !needsWelcomeScreen() && !shouldShowPlayerAuthChrome();
  let show = false;

  if (loggedIn && installable) {
    if (profileOpen) {
      show = !installHiddenThisProfileVisit;
    } else {
      show = !localStorage.getItem(INSTALL_DISMISS_KEY);
    }
  }

  el.hidden = !show;
  document.getElementById('app')?.classList.toggle('app--install-banner', show);

  const btn = document.getElementById('pwa-install-btn');
  if (btn && isIOSInstallable() && !deferredInstallPrompt) {
    btn.textContent = 'Jak?';
  } else if (btn) {
    btn.textContent = 'Zainstaluj';
  }
}

async function promptPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (outcome === 'accepted') localStorage.setItem(INSTALL_DISMISS_KEY, '1');
    updateInstallBanner();
    return;
  }
  if (isIOSInstallable()) {
    alert('W Safari: dotknij ikony Udostępnij na dole ekranu, potem „Dodaj do ekranu początkowego”.');
  }
}

function dismissPwaInstall() {
  if (profileOpen) {
    installHiddenThisProfileVisit = true;
  } else {
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
  }
  updateInstallBanner();
}

function renderAuthGateContent() {
  if (profileOpen) {
    return renderProfile();
  }
  const cloudReady = typeof BadmintonCloud !== 'undefined' && BadmintonCloud.isConfigured();
  if (!cloudReady) {
    return renderPlayerLocalAuthScreen();
  }
  return renderAuthScreen();
}

function renderWelcomeChrome(appEl) {
  content.innerHTML = renderWelcomeScreen();
  setSubtitle('welcome');
  appEl?.classList.add('app--welcome');
  appEl?.classList.remove('app--auth-gate', 'app--auth-gate-profile', 'app--booting');
  fab.classList.remove('fab--visible');
  document.getElementById('fab-anchor')?.classList.remove('fab-anchor--visible');
  playersFabMenuOpen = false;
  updateHeaderAvatar();
  updateInstallBanner();
  syncBottomNav();
  saveUiState();
}

function renderAuthGateChrome(appEl) {
  content.innerHTML = renderAuthGateContent();
  setSubtitle(profileSubtitleKey());
  appEl?.classList.remove('app--welcome');
  appEl?.classList.add('app--auth-gate');
  appEl?.classList.toggle('app--auth-gate-profile', profileOpen && !userSession.loggedIn);
  fab.classList.remove('fab--visible');
  document.getElementById('fab-anchor')?.classList.remove('fab-anchor--visible');
  playersFabMenuOpen = false;
  updateHeaderAvatar();
  updateInstallBanner();
  syncBottomNav();
  saveUiState();
  mountInviteShareSheet();
}

function render() {
  clearStuckOverlays();
  healOrphanUiState();
  enforceSpectatorTabAccess();
  const appEl = document.getElementById('app');

  if (authBootstrapPending && !userSession.loggedIn) {
    if (needsWelcomeScreen()) {
      appEl?.classList.remove('app--booting');
      renderWelcomeChrome(appEl);
      return;
    }
    if (shouldShowPlayerAuthChrome()) {
      appEl?.classList.remove('app--booting');
      renderAuthGateChrome(appEl);
      return;
    }
    const hasLocalData = !!userSession.playerId || players.length > 0 || teams.length > 0 || matches.length > 0;
    if (!hasLocalData) {
      appEl?.classList.remove('app--booting');
      renderWelcomeChrome(appEl);
      return;
    }
    appEl?.classList.add('app--booting');
    appEl?.classList.remove('app--auth-gate', 'app--auth-gate-profile', 'app--welcome');
    content.innerHTML = '';
    fab.classList.remove('fab--visible');
  document.getElementById('fab-anchor')?.classList.remove('fab-anchor--visible');
  playersFabMenuOpen = false;
    syncBottomNav();
    saveUiState();
    return;
  }

  appEl?.classList.remove('app--booting');

  if (needsWelcomeScreen()) {
    renderWelcomeChrome(appEl);
    return;
  }

  if (shouldShowPlayerAuthChrome()) {
    renderAuthGateChrome(appEl);
    return;
  }

  appEl?.classList.remove('app--auth-gate');
  appEl?.classList.remove('app--auth-gate-profile');
  appEl?.classList.remove('app--welcome');

  if (authWantsProfile && userSession.loggedIn) {
    profileOpen = true;
  }

  if (profileOpen) {
    if (needsPinSetup()) pinSetupOpen = true;
    authWantsProfile = false;
    content.innerHTML = renderProfile();
    setSubtitle(profileSubtitleKey());
    fab.classList.remove('fab--visible');
  document.getElementById('fab-anchor')?.classList.remove('fab-anchor--visible');
  playersFabMenuOpen = false;
    document.getElementById('app')?.classList.toggle('app--nav-elevated', shouldElevateBottomNav());
    updateHeaderAvatar();
    requestAnimationFrame(() => {
      updateSaveNameButton();
      updateDeleteConfirmButton();
      updateResetStatsConfirmButton();
      updateChangeGoogleConfirmButton();
      updatePinSetupButton();
      updatePinChangeButton();
      if (needsPinSetup()) {
        document.getElementById('pin-setup-banner')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    updateInstallBanner();
    syncBottomNav();
    saveUiState();
    return;
  }

  if (currentTab === 'stats') {
    if (statsSubView === 'global') {
      content.innerHTML = renderStatsGlobal();
      setSubtitle('stats-global');
    } else if (statsSubView === 'players') {
      content.innerHTML = renderStatsPlayers();
      setSubtitle('stats-players');
    } else if (statsSubView === 'h2h') {
      content.innerHTML = renderStatsH2H();
      setSubtitle('stats-h2h');
    } else {
      content.innerHTML = renderStatsMenu();
      setSubtitle('stats');
    }
  } else if (currentTab === 'matches') {
    if (openMatchId) {
      const m = matches.find(x => x.id === openMatchId);
      if (m) {
        content.innerHTML = renderMatchDetailPage(m);
        setSubtitle('match-detail');
      } else {
        closeMatch();
        content.innerHTML = renderMatches();
        setSubtitle('matches');
      }
    } else {
      content.innerHTML = renderMatches();
      setSubtitle(newMatchOpen ? 'new-match' : 'matches');
    }
  } else {
    if (openPlayerId) {
      content.innerHTML = renderPlayerDetail(openPlayerId);
      setSubtitle('player');
    } else if (openTeamId) {
      content.innerHTML = renderTeamDetail(openTeamId);
      setSubtitle('team');
    } else {
      content.innerHTML = renderPlayers();
      setSubtitle('players');
    }
  }

  updateAppChrome();
  updateHeaderAvatar();
  ensureLiveMatchTickers();
  syncBottomNav();
  saveUiState();
  scheduleMatchFaceFit();
  mountInviteShareSheet();
  requestAnimationFrame(() => {
    updateArchiveSetSaveButton();
    updateTeamSaveButton();
    updateDeleteTeamConfirmButton();
    syncAllTeamNameFieldChrome();
  });
}

profileBtn?.addEventListener('click', () => {
  if (isSpectatorMode()) {
    setSessionRole('player');
    profileOpen = false;
    profileAuthMode = hasPendingInviteInSession() ? 'register' : 'login';
    profileAuthError = '';
    profileAuthNotice = '';
    render();
    return;
  }
  if (!userSession.loggedIn && profileOpen) return;
  const opening = !profileOpen;
  profileOpen = !profileOpen;
  if (opening) installHiddenThisProfileVisit = false;
  render();
});

document.querySelectorAll('.bottom-nav__item').forEach(btn => {
  btn.addEventListener('click', () => {
    if (needsWelcomeScreen() || shouldShowPlayerAuthChrome()) return;
    if (isSpectatorMode() && btn.dataset.tab === 'players') return;
    const nextTab = btn.dataset.tab;
    profileOpen = false;
    resetTabToDefault(nextTab);
    currentTab = nextTab;
    document.querySelectorAll('.bottom-nav__item').forEach(b => {
      b.classList.toggle('bottom-nav__item--active', b === btn);
    });
    render();
  });
});

function handleGlobalModalClick(e) {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === 'app-confirm-cancel') {
    e.preventDefault();
    dismissAppConfirm(false);
    return;
  }
  if (action === 'app-confirm-ok') {
    e.preventDefault();
    dismissAppConfirm(true);
    return;
  }
  if (action === 'pick-server') {
    if (servePickerPhase) return;
    const m = matches.find(x => x.id === openMatchId);
    if (m && requireMatchEdit(m) && isServeDuelStarter(m)) {
      e.preventDefault();
      confirmServeSide(m, actionEl.dataset.side);
    }
    return;
  }
  if (action === 'cancel-serve-picker' || action === 'cancel-serve-picker-backdrop') {
    const m = matches.find(x => x.id === openMatchId);
    if (m && requireMatchEdit(m) && isServeDuelStarter(m)) {
      e.preventDefault();
      cancelServePicker(m);
    }
  }
}

document.addEventListener('click', handleGlobalModalClick, true);

document.addEventListener('click', e => {
  if (playersFabMenuOpen && !e.target.closest('#fab-anchor')) {
    playersFabMenuOpen = false;
    updateFabMenu();
  }
  const hasMatchPicker = newMatchDraft?.openTeamPickerSide || newMatchDraft?.openPlayerPickerSlot;
  const hasTeamPicker = newTeamDraft?.openPlayerPickerSlot;
  if (!hasMatchPicker && !hasTeamPicker) return;
  if (e.target.closest('.dropdown-picker')) return;
  closeOpenPickers();
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('app-confirm')) dismissAppConfirm(false);
});

if (!content) {
  console.error('Badminton App: brak elementu #content');
}

content?.addEventListener('click', async e => {
  if (e.target.closest('[data-action="open-live-match"]')) {
    e.preventDefault();
    e.stopPropagation();
    const id = parseInt(e.target.closest('[data-action="open-live-match"]').dataset.matchId, 10);
    if (!isNaN(id)) {
      currentTab = 'matches';
      document.querySelectorAll('.bottom-nav__item').forEach(b => {
        b.classList.toggle('bottom-nav__item--active', b.dataset.tab === 'matches');
      });
      openMatch(id);
    }
    return;
  }

  if (e.target.closest('[data-action="choose-role-spectator"]')) {
    setSessionRole('spectator');
    currentTab = 'stats';
    statsSubView = null;
    profileOpen = false;
    openPlayerId = null;
    openTeamId = null;
    resetTabToDefault('matches');
    render();
    return;
  }

  if (e.target.closest('[data-action="choose-role-player"]')) {
    setSessionRole('player');
    profileOpen = false;
    profileAuthError = '';
    profileAuthNotice = '';
    if (getPendingGuestClaim()) profileAuthMode = 'register';
    else if (getPendingJoinInvite()?.token) profileAuthMode = 'register';
    else profileAuthMode = 'login';
    render();
    return;
  }

  if (e.target.closest('[data-action="back-to-welcome"]')) {
    clearSessionRole();
    profileOpen = false;
    profileAuthError = '';
    profileAuthNotice = '';
    pendingSignupEmail = null;
    render();
    return;
  }

  if (e.target.closest('[data-action="open-player"]')) {
    if (isSpectatorMode()) {
      showToast('Zaloguj się jako zawodnik, aby przeglądać profile', 'warn');
      return;
    }
    const id = parseInt(e.target.closest('[data-action="open-player"]').dataset.playerId, 10);
    if (!isNaN(id)) {
      openPlayerId = id;
      if (!e.target.closest('.team-detail__roster')) openTeamId = null;
      addGuestOpen = false;
      inviteShareOpen = false;
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="open-team"]')) {
    const id = parseInt(e.target.closest('[data-action="open-team"]').dataset.teamId, 10);
    if (!isNaN(id)) {
      openTeamId = id;
      openPlayerId = null;
      playersRosterTab = 'teams';
      addGuestOpen = false;
      inviteShareOpen = false;
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="roster-tab"]')) {
    const tab = e.target.closest('[data-action="roster-tab"]').dataset.rosterTab;
    if (tab === 'players' || tab === 'teams') {
      if (tab === playersRosterTab) return;
      playersRosterTab = tab;
      openPlayerId = null;
      openTeamId = null;
      addGuestOpen = false;
      playersFabMenuOpen = false;
      newTeamOpen = false;
      newTeamDraft = null;
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="player-back"]')) {
    openPlayerId = null;
    inviteShareOpen = false;
    deletePlayerOpen = false;
    deletePlayerId = null;
    deletePlayerError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="team-back"]')) {
    openTeamId = null;
    openPlayerId = null;
    playersRosterTab = 'teams';
    render();
    return;
  }

  if (e.target.closest('[data-action="save-team-profile"]')) {
    const id = parseInt(e.target.closest('[data-action="save-team-profile"]').dataset.teamId, 10);
    if (!isNaN(id)) saveTeamProfile(id);
    return;
  }

  if (e.target.closest('[data-action="change-team-avatar"]')) {
    const id = parseInt(e.target.closest('[data-action="change-team-avatar"]').dataset.teamId, 10);
    if (!isNaN(id) && canEditTeam(getTeam(id))) {
      teamAvatarEditId = id;
      teamAvatarInput?.click();
    }
    return;
  }

  if (e.target.closest('[data-action="remove-team-avatar"]')) {
    const id = parseInt(e.target.closest('[data-action="remove-team-avatar"]').dataset.teamId, 10);
    const team = getTeam(id);
    if (!team || !canEditTeam(team)) return;
    team.avatarUrl = null;
    touchTeamUpdated(team);
    matches.forEach(m => {
      if (m.teamMeta?.A?.teamId === id) m.teamMeta.A.avatarUrl = null;
      if (m.teamMeta?.B?.teamId === id) m.teamMeta.B.avatarUrl = null;
    });
    saveState();
    render();
    return;
  }

  if (e.target.closest('[data-action="random-team-detail-name"]')) {
    const input = document.getElementById('team-detail-name');
    if (input) {
      input.value = pickRandomTeamName();
      updateTeamNameFieldChrome(input);
      updateTeamSaveButton();
    }
    return;
  }

  if (e.target.closest('[data-action="clear-team-detail-name"]')) {
    const input = document.getElementById('team-detail-name');
    if (input) {
      input.value = '';
      updateTeamNameFieldChrome(input);
      updateTeamSaveButton();
    }
    return;
  }

  if (e.target.closest('[data-action="clear-new-team-name"]')) {
    if (!newTeamDraft) return;
    newTeamDraft.name = '';
    const input = document.getElementById('new-team-name');
    if (input) {
      input.value = '';
      updateTeamNameFieldChrome(input);
    } else {
      updateNewTeamFormDOM();
    }
    return;
  }

  if (e.target.closest('[data-action="clear-new-match-team-name"]')) {
    if (!newMatchDraft) return;
    syncNewMatchDraftFromDom();
    const side = e.target.closest('[data-action="clear-new-match-team-name"]').dataset.side;
    const nameField = side === 'A' ? 'team-a-name' : 'team-b-name';
    if (side === 'A') newMatchDraft.teamMetaA.name = '';
    else newMatchDraft.teamMetaB.name = '';
    const input = document.querySelector(`[data-new-match-field="${nameField}"]`);
    if (input) {
      input.value = '';
      updateTeamNameFieldChrome(input);
    } else {
      updateNewMatchPlayersDOM();
    }
    return;
  }

  if (e.target.closest('[data-action="clear-match-team-name"]')) {
    const input = document.getElementById('match-team-name');
    if (input) {
      input.value = '';
      updateTeamNameFieldChrome(input);
    }
    return;
  }

  if (e.target.closest('[data-action="open-delete-team"]')) {
    const id = parseInt(e.target.closest('[data-action="open-delete-team"]').dataset.teamId, 10);
    if (!isNaN(id) && canEditTeam(getTeam(id))) {
      deleteTeamId = id;
      deleteTeamOpen = true;
      deleteTeamError = '';
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="close-delete-team"]')) {
    deleteTeamOpen = false;
    deleteTeamId = null;
    deleteTeamError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="confirm-delete-team"]')) {
    executeDeleteTeam({ useBiometric: false });
    return;
  }

  if (e.target.closest('[data-action="delete-team-biometric"]')) {
    executeDeleteTeam({ useBiometric: true });
    return;
  }

  if (e.target.closest('[data-action="open-login-settings"]')) {
    loginSettingsOpen = true;
    loginSettingsError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="close-login-settings"]')) {
    loginSettingsOpen = false;
    loginSettingsError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="confirm-pin-setup"]')) {
    confirmPinSetup();
    return;
  }

  if (e.target.closest('[data-action="confirm-change-pin"]')) {
    confirmChangePin();
    return;
  }

  if (e.target.closest('[data-action="confirm-remove-pin"]')) {
    confirmRemovePin();
    return;
  }

  if (e.target.closest('[data-action="open-delete-player"]')) {
    const id = parseInt(e.target.closest('[data-action="open-delete-player"]').dataset.playerId, 10);
    if (!isNaN(id) && canDeletePlayer(getPlayer(id))) {
      deletePlayerId = id;
      deletePlayerOpen = true;
      deletePlayerError = '';
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="close-delete-player"]')) {
    deletePlayerOpen = false;
    deletePlayerId = null;
    deletePlayerError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="confirm-delete-player"]')) {
    executeDeletePlayer({ useBiometric: false });
    return;
  }

  if (e.target.closest('[data-action="delete-player-biometric"]')) {
    executeDeletePlayer({ useBiometric: true });
    return;
  }

  if (e.target.closest('[data-action="open-add-guest"]')) {
    addGuestOpen = true;
    render();
    return;
  }

  if (e.target.closest('[data-action="ctx-edit"]')) {
    const btn = e.target.closest('[data-action="ctx-edit"]');
    const matchId = parseInt(btn.dataset.matchId, 10);
    const m = matches.find(x => x.id === matchId);
    if (!requireMatchEdit(m)) return;
    ctxTarget = null;
    if (btn.dataset.ctxType === 'match' && m) {
      enterMatchEditMode(m);
    } else if (btn.dataset.ctxType === 'set') {
      if (!canEditSetScores(m)) return;
      const setN = parseInt(btn.dataset.setN, 10);
      const set = m?.sets?.find(s => s.n === setN);
      setDetailN = null;
      if (set?.status === 'live') {
        editSetN = null;
        setPlayOpen = true;
        beginLiveSet(m);
      } else {
        editSetN = setN;
        setPlayOpen = true;
      }
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="ctx-delete"]')) {
    const btn = e.target.closest('[data-action="ctx-delete"]');
    const matchId = parseInt(btn.dataset.matchId, 10);
    const m = matches.find(x => x.id === matchId);
    if (!requireMatchEdit(m)) return;
    ctxTarget = null;
    if (btn.dataset.ctxType === 'match') {
      deleteMatchById(matchId);
    } else if (m) {
      deleteSetFromMatch(m, parseInt(btn.dataset.setN, 10));
    }
    return;
  }

  if (ctxTarget && !e.target.closest('.ctx-actions')) {
    ctxTarget = null;
    render();
    return;
  }

  const matchBtn = e.target.closest('[data-match-id]');
  if (matchBtn && !matchBtn.closest('.ctx-actions')) {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    openMatch(parseInt(matchBtn.dataset.matchId, 10));
    return;
  }

  const statsView = e.target.closest('[data-stats-view]');
  if (statsView) {
    statsSubView = statsView.dataset.statsView;
    render();
    return;
  }

  if (e.target.closest('[data-action="stats-back"]')) {
    statsSubView = null;
    render();
    return;
  }

  if (e.target.closest('[data-action="edit-match-team"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!requireMatchEdit(m)) return;
    matchTeamEditSide = e.target.closest('[data-action="edit-match-team"]').dataset.side;
    render();
    return;
  }

  if (e.target.closest('[data-action="close-team-edit"]')) {
    matchTeamEditSide = null;
    render();
    return;
  }

  if (e.target.closest('[data-action="save-match-team"]')) {
    const side = e.target.closest('[data-action="save-match-team"]').dataset.side;
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !side || !requireMatchEdit(m)) return;
    saveMatchTeamEdit(m, side);
    return;
  }

  if (e.target.closest('[data-action="match-team-avatar"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!requireMatchEdit(m)) return;
    matchTeamAvatarSide = e.target.closest('[data-action="match-team-avatar"]').dataset.side;
    teamAvatarInput.click();
    return;
  }

  if (e.target.closest('[data-action="remove-match-team-avatar"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!requireMatchEdit(m)) return;
    const side = e.target.closest('[data-action="remove-match-team-avatar"]').dataset.side;
    if (m && side) {
      const meta = ensureMatchTeamMeta(m, side);
      meta.avatarUrl = null;
      if (meta.teamId) {
        const t = getTeam(meta.teamId);
        if (t) t.avatarUrl = null;
      }
      saveState();
      updateMatchTeamEditAvatarDOM(m, side);
    }
    return;
  }

  if (e.target.closest('[data-action="save-name"]')) {
    const btn = e.target.closest('[data-action="save-name"]');
    if (btn?.disabled) return;
    const input = document.getElementById('display-name');
    const result = renamePlayer(userSession.playerId, input?.value || '');
    if (result.ok) {
      showToast('Zapisano imię', 'success');
      updateSaveNameButton();
    } else if (result.error) {
      showToast(result.error, 'error');
      updateSaveNameButton();
    }
    return;
  }

  if (e.target.closest('[data-action="sync-refresh"]')) {
    if (suppressSyncClick) {
      suppressSyncClick = false;
      return;
    }
    triggerManualSync().catch(() => {});
    return;
  }

  if (e.target.closest('[data-action="open-change-google"]')) {
    changeGoogleOpen = true;
    changeGoogleError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="close-change-google"]')) {
    changeGoogleOpen = false;
    changeGoogleError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="confirm-change-google"]')) {
    executeChangeGoogleAccount().catch(() => {});
    return;
  }

  if (e.target.closest('[data-action="change-google-biometric"]')) {
    executeChangeGoogleAccount({ useBiometric: true }).catch(() => {});
    return;
  }

  if (e.target.closest('[data-action="open-delete-account"]')) {
    deleteAccountOpen = true;
    deleteAccountError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="open-reset-stats"]')) {
    resetStatsOpen = true;
    resetStatsError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="close-reset-stats"]')) {
    resetStatsOpen = false;
    resetStatsError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="confirm-reset-stats"]')) {
    executeResetStats().catch(() => {});
    return;
  }

  if (e.target.closest('[data-action="reset-stats-biometric"]')) {
    executeResetStats({ useBiometric: true }).catch(() => {});
    return;
  }

  if (e.target.closest('[data-action="close-delete-account"]')) {
    deleteAccountOpen = false;
    deleteAccountError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="confirm-delete-account"]')) {
    executeDeleteAccount().catch(() => {});
    return;
  }

  if (e.target.closest('[data-action="delete-account-biometric"]')) {
    executeDeleteAccount({ useBiometric: true }).catch(() => {});
    return;
  }

  if (e.target.closest('[data-action="register-biometric"]')) {
    if (typeof BadmintonCloud === 'undefined') return;
    const user = BadmintonCloud.getUser();
    if (!user) return;
    registerDeviceBiometric(user)
      .then(() => {
        showToast('Biometria włączona', 'success');
        render();
      })
      .catch(err => showToast(err.message || 'Nie udało się włączyć biometrii', 'error'));
    return;
  }

  if (e.target.closest('[data-action="remove-biometric"]')) {
    const user = BadmintonCloud.getUser();
    if (user) {
      const store = getBiometricStore();
      delete store[user.id];
      localStorage.setItem(BIOMETRIC_STORE_KEY, JSON.stringify(store));
      showToast('Biometria wyłączona', 'info');
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="player-edit-profile"]')) {
    profileOpen = true;
    render();
    return;
  }

  if (e.target.closest('[data-action="close-add-guest"]')) {
    addGuestOpen = false;
    playersFabMenuOpen = false;
    render();
    return;
  }

  if (e.target.closest('[data-action="confirm-add-guest"]')) {
    const name = document.getElementById('add-guest-name')?.value || '';
    const result = createGuestPlayer(name);
    if (!result.ok) {
      showToast(result.error || 'Nie udało się dodać gościa', 'error');
      return;
    }
    addGuestOpen = false;
    playersFabMenuOpen = false;
    playersRosterTab = 'players';
    openPlayerId = null;
    openTeamId = null;
    showToast(`Dodano gościa: ${result.name}`, 'success');
    render();
    requestAnimationFrame(() => {
      document.getElementById('players-guest-section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    return;
  }

  if (e.target.closest('[data-action="share-guest-invite"]')) {
    const id = parseInt(e.target.closest('[data-action="share-guest-invite"]').dataset.playerId, 10);
    const player = getPlayer(id);
    if (!player?.isGuest) return;
    ensureGuestClaimToken(player);
    openInviteShareSheet(buildGuestInvitePayload(player));
    return;
  }

  if (e.target.closest('[data-action="change-avatar"]')) {
    avatarInput.click();
    return;
  }

  if (e.target.closest('[data-action="remove-avatar"]')) {
    setUserAvatar(null);
    saveState();
    render();
    return;
  }

  if (e.target.closest('[data-action="toggle-notifications"]')) {
    userSession.notifications = !userSession.notifications;
    saveState();
    updateNotificationsButtonDOM();
    return;
  }

  if (e.target.closest('[data-action="logout"]')) {
    profileAuthError = '';
    profileAuthShowPassword = false;
    profileAuthMode = 'login';
    clearSessionRole();
    suppressAutoPlayerBootstrap = false;
    profileOpen = false;
    currentTab = 'stats';
    statsSubView = null;
    openPlayerId = null;
    openTeamId = null;
    if (typeof BadmintonCloud !== 'undefined' && BadmintonCloud.isConfigured()) {
      BadmintonCloud.signOut().catch(() => {});
    } else {
      userSession.loggedIn = false;
      userSession.playerId = null;
      userSession.authEmail = null;
      profileOpen = false;
      saveState();
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="close-login-profile"]')) {
    profileOpen = false;
    profileAuthError = '';
    render();
    return;
  }

  if (e.target.closest('[data-action="bootstrap-player-after-wipe"]')) {
    suppressAutoPlayerBootstrap = false;
    const cloudUser = typeof BadmintonCloud !== 'undefined' ? BadmintonCloud.getUser() : null;
    if (cloudUser) {
      ensurePlayerForAuthUser(cloudUser);
    } else if (!getCurrentPlayer()) {
      const id = nextPlayerId();
      players.push({ id, displayName: 'Ja', isGuest: false });
      userSession.playerId = id;
    }
    saveState({ immediatePush: true });
    render();
    return;
  }

  if (e.target.closest('[data-action="login-local"]')) {
    setSessionRole('player');
    suppressAutoPlayerBootstrap = false;
    userSession.loggedIn = true;
    if (!getCurrentPlayer()) {
      const id = nextPlayerId();
      players.push({ id, displayName: 'Ja', isGuest: false });
      userSession.playerId = id;
    }
    profileOpen = true;
    saveState();
    render();
    return;
  }

  if (e.target.closest('[data-action="auth-mode"]')) {
    profileAuthMode = e.target.closest('[data-action="auth-mode"]').dataset.mode;
    profileAuthError = '';
    profileAuthNotice = '';
    pendingSignupEmail = null;
    render();
    return;
  }

  if (e.target.closest('[data-action="resend-signup-email"]')) {
    if (!pendingSignupEmail || typeof BadmintonCloud === 'undefined') return;
    try {
      await BadmintonCloud.resendSignupEmail(pendingSignupEmail);
      profileAuthError = '';
      profileAuthNotice = `Ponownie wysłano link na ${pendingSignupEmail}. Sprawdź skrzynkę i spam.`;
      showToast('Link aktywacyjny wysłany ponownie', 'success');
      render();
    } catch (err) {
      profileAuthError = err.message || 'Nie udało się wysłać linku';
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="generate-auth-password"]')) {
    const input = document.getElementById('auth-password');
    if (input) {
      input.value = generateAuthPassword();
      profileAuthShowPassword = true;
      input.type = 'text';
      const btn = document.querySelector('[data-action="toggle-auth-password"]');
      if (btn) {
        btn.innerHTML = authPasswordToggleIcon();
        btn.setAttribute('aria-label', 'Ukryj hasło');
      }
    }
    return;
  }

  if (e.target.closest('[data-action="toggle-auth-password"]')) {
    profileAuthShowPassword = !profileAuthShowPassword;
    const input = document.getElementById('auth-password');
    const btn = e.target.closest('[data-action="toggle-auth-password"]');
    if (input) input.type = profileAuthShowPassword ? 'text' : 'password';
    if (btn) {
      btn.innerHTML = authPasswordToggleIcon();
      btn.setAttribute('aria-label', profileAuthShowPassword ? 'Ukryj hasło' : 'Pokaż hasło');
    }
    return;
  }

  if (e.target.closest('[data-action="copy-app-link"]')) {
    const url = getAppShareUrl();
    navigator.clipboard.writeText(url).then(() => {
      const btn = e.target.closest('[data-action="copy-app-link"]');
      if (btn) {
        const label = btn.innerHTML;
        btn.textContent = 'Skopiowano!';
        setTimeout(() => { btn.innerHTML = label; }, 2000);
      }
    }).catch(() => alert(url));
    return;
  }

  if (e.target.closest('[data-action="auth-google"]')) {
    profileAuthError = '';
    BadmintonCloud.signInWithGoogle().catch(err => {
      profileAuthError = err.message || 'Nie udało się zalogować przez Google';
      render();
    });
    return;
  }

  if (e.target.closest('[data-action="close-match"]')) {
    closeMatch();
    return;
  }

  if (e.target.closest('[data-action="match-back"]')) {
    setPlayOpen = false;
    editSetN = null;
    setDetailN = null;
    render();
    return;
  }

  if (e.target.closest('[data-action="cancel-match-edit"]')) {
    cancelMatchEdit();
    return;
  }

  if (e.target.closest('[data-action="play-set"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !requireMatchEdit(m)) return;
    if (m.liveSet || isServeDuelActive(m)) {
      alert('Najpierw zakończ trwający set');
      return;
    }
    editSetN = null;
    setDetailN = null;
    if (isMatchArchive(m) || reopenMatchEdit) {
      setPlayOpen = true;
      render();
    } else if (needsServePicker(m)) {
      startServeDuel(m);
      if (openMatchId === m.id) {
        updateMatchDetailLiveBadge(m);
        updateMatchActionsFromModel(m);
      }
      render();
    } else {
      beginLiveSet(m);
      assignAlternatingFirstServer(m);
      setPlayOpen = true;
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="resume-set-play"]')) {
    if (reopenMatchEdit) return;
    setPlayOpen = true;
    setDetailN = null;
    editSetN = null;
    const m = matches.find(x => x.id === openMatchId);
    if (m?.liveSet) {
      if (m.liveSet.status === 'idle') startSetTimer(m);
      else if (m.liveSet.status === 'running') ensureSetTimerRunning(m);
      ensureMatchClockRunning(m);
    }
    render();
    return;
  }

  if (e.target.closest('[data-action="close-set-play"]')) {
    setPlayOpen = false;
    editSetN = null;
    setDetailN = null;
    render();
    return;
  }

  if (e.target.closest('[data-action="close-set-edit"]')) {
    editSetN = null;
    setPlayOpen = true;
    render();
    return;
  }

  if (e.target.closest('[data-action="pause-set-timer"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !requireMatchEdit(m)) return;
    pauseLiveSet(m);
    updateSetPlayDOM(m);
    updateMatchDetailLiveBadge(m);
    return;
  }

  if (e.target.closest('[data-action="resume-set-timer"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !requireMatchEdit(m)) return;
    resumeLiveSet(m);
    updateSetPlayDOM(m);
    updateMatchDetailLiveBadge(m);
    return;
  }

  if (e.target.closest('[data-action="score-a-plus"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !requireMatchEdit(m)) return;
    adjustLiveScore(m, 'A', 1);
    return;
  }
  if (e.target.closest('[data-action="score-b-plus"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !requireMatchEdit(m)) return;
    adjustLiveScore(m, 'B', 1);
    return;
  }

  if (e.target.closest('[data-action="finish-live-set"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !requireMatchEdit(m)) return;
    finishLiveSet(m);
    return;
  }

  if (e.target.closest('[data-action="save-archive-set"]')) {
    const btn = e.target.closest('[data-action="save-archive-set"]');
    if (btn.disabled) return;
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !requireMatchEdit(m)) return;
    saveArchiveSet(m);
    return;
  }

  if (e.target.closest('[data-action="delete-set"]')) {
    const m = matches.find(x => x.id === openMatchId);
    const btn = e.target.closest('[data-action="delete-set"]');
    const setN = parseInt(btn.dataset.setN, 10);
    const set = m?.sets?.find(s => s.n === setN);
    if (!m) return;
    const isLiveCancel = set?.status === 'live' || isSetLive(m, setN);
    if (isLiveCancel) {
      if (!requireMatchEdit(m)) return;
    } else if (!canEditSetScores(m)) {
      return;
    }
    deleteSetFromMatch(m, setN);
    return;
  }

  if (e.target.closest('[data-action="edit-set"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !canEditSetScores(m)) return;
    const btn = e.target.closest('[data-action="edit-set"]');
    editSetN = parseInt(btn.dataset.setN, 10);
    setDetailN = null;
    setPlayOpen = true;
    render();
    return;
  }

  if (e.target.closest('[data-action="open-set-edit"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !canEditSetScores(m)) return;
    const btn = e.target.closest('[data-action="open-set-edit"]');
    const setN = parseInt(btn.dataset.setN, 10);
    editSetN = setN;
    if (!setDetailN) setDetailN = setN;
    setPlayOpen = true;
    render();
    return;
  }

  if (e.target.closest('[data-action="open-set"]')) {
    if (ctxTarget) return;
    const row = e.target.closest('[data-set-n]');
    if (!row) return;
    const setN = parseInt(row.dataset.setN, 10);
    const m = matches.find(x => x.id === openMatchId);
    const set = m?.sets?.find(s => s.n === setN);
    if (set?.status === 'live' && m.liveSet) {
      setPlayOpen = true;
      setDetailN = null;
      editSetN = null;
      if (canEditMatch(m)) beginLiveSet(m);
      else if (m.liveSet.status === 'running') ensureSetTimerRunning(m);
      render();
    } else if (set && set.status !== 'live') {
      setDetailN = setN;
      editSetN = null;
      setPlayOpen = true;
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="delete-match"]')) {
    if (openMatchId) {
      const m = matches.find(x => x.id === openMatchId);
      if (m && requireMatchEdit(m)) deleteMatchById(openMatchId);
    }
    return;
  }

  if (e.target.closest('[data-action="edit-match"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (m && requireMatchEdit(m)) enterMatchEditMode(m);
    return;
  }

  if (e.target.closest('[data-action="end-match"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !requireMatchEdit(m) || !canEndMatch(m)) return;
    if (!prepareMatchEnd(m)) return;
    if (!hasFinishedSets(m)) return;
    if (reopenMatchEdit) {
      if (finalizeMatch(m)) render();
      return;
    }
    const title = isMatchArchive(m) ? 'Zapisać mecz archiwalny?' : 'Zakończyć mecz?';
    showAppConfirm({
      title,
      message: isMatchArchive(m) ? 'Mecz zostanie zapisany w historii.' : 'Mecz zostanie zakończony i widoczny dla wszystkich uczestników.',
      confirmLabel: isMatchArchive(m) ? 'Zapisz' : 'Zakończ',
    }).then(ok => {
      if (ok && finalizeMatch(m)) render();
    });
    return;
  }

  if (e.target.closest('[data-action="toggle-match-info"]')) {
    matchInfoOpen = true;
    const m = matches.find(x => x.id === openMatchId);
    if (isMatchLiveActive(m) && !reopenMatchEdit) ensureLiveMatchTickers();
    render();
    return;
  }

  if (e.target.closest('[data-action="close-match-info"]')) {
    matchInfoOpen = false;
    render();
    return;
  }

  if (e.target.closest('[data-action="close-new-match"]')) {
    const provisional = newMatchDraft?.provisionalGuestIds;
    newMatchOpen = false;
    newMatchDraft = null;
    if (provisional?.length) {
      cleanupProvisionalGuests(provisional);
      saveState();
    }
    render();
    return;
  }

  if (e.target.closest('[data-action="close-new-team"]')) {
    const provisional = newTeamDraft?.provisionalGuestIds;
    newTeamOpen = false;
    newTeamDraft = null;
    if (provisional?.length) {
      cleanupProvisionalGuests(provisional);
      saveState();
    }
    render();
    return;
  }

  if (e.target.closest('[data-action="create-team"]')) {
    createTeamFromDraft();
    return;
  }

  if (e.target.closest('[data-action="random-new-team-name"]')) {
    if (!newTeamDraft) return;
    newTeamDraft.name = pickRandomTeamName();
    const input = document.getElementById('new-team-name');
    if (input) {
      input.value = newTeamDraft.name;
      updateTeamNameFieldChrome(input);
    } else {
      updateNewTeamFormDOM();
    }
    return;
  }

  if (e.target.closest('[data-action="new-team-avatar"]')) {
    teamAvatarSide = 'new-team';
    teamAvatarInput?.click();
    return;
  }

  if (e.target.closest('[data-action="new-team-remove-avatar"]')) {
    if (newTeamDraft) {
      newTeamDraft.avatarUrl = null;
      updateNewTeamFormDOM();
    }
    return;
  }

  if (e.target.closest('[data-action="create-match"]')) {
    createMatchFromDraft();
    return;
  }

  if (e.target.closest('[data-action="set-match-type"]')) {
    syncNewMatchDraftFromDom();
    const btn = e.target.closest('[data-action="set-match-type"]');
    if (newMatchDraft.type === btn.dataset.type) return;
    newMatchDraft.type = btn.dataset.type;
    newMatchDraft.slots = { a1: null, a2: null, b1: null, b2: null };
    newMatchDraft.pendingGuests = {};
    if (btn.dataset.type === 'doubles') {
      applyDoublesTeamDefaults(newMatchDraft);
    } else {
      newMatchDraft.teamModeA = 'create';
      newMatchDraft.teamModeB = 'create';
      newMatchDraft.teamIdA = null;
      newMatchDraft.teamIdB = null;
      newMatchDraft.teamMetaA = { name: '', avatarUrl: null };
      newMatchDraft.teamMetaB = { name: '', avatarUrl: null };
    }
    newMatchDraft.guestSlot = null;
    newMatchDraft.guestName = '';
    newMatchDraft.guestError = '';
    newMatchDraft.openTeamPickerSide = null;
    newMatchDraft.openPlayerPickerSlot = null;
    updateNewMatchTypeUI();
    return;
  }

  if (e.target.closest('[data-action="toggle-date-picker"]')) {
    if (!newMatchDraft) return;
    newMatchDraft.calendarOpen = !newMatchDraft.calendarOpen;
    if (newMatchDraft.calendarOpen) {
      newMatchDraft.calendarMonth = (newMatchDraft.date || todayIso()).slice(0, 7);
    }
    updateNewMatchDateUI();
    return;
  }

  if (e.target.closest('[data-action="reset-match-date"]')) {
    if (!newMatchDraft) return;
    setMatchDraftDate(newMatchDraft, todayIso());
    updateNewMatchDateUI();
    updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="pick-calendar-day"]')) {
    const btn = e.target.closest('[data-action="pick-calendar-day"]');
    if (!newMatchDraft || btn.disabled) return;
    setMatchDraftDate(newMatchDraft, btn.dataset.date);
    updateNewMatchDateUI();
    updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="calendar-prev-month"]')) {
    if (!newMatchDraft) return;
    const [y, m] = getCalendarMonth(newMatchDraft).split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    newMatchDraft.calendarMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    refreshCalendarDOM(newMatchDraft);
    return;
  }

  if (e.target.closest('[data-action="calendar-next-month"]')) {
    if (!newMatchDraft) return;
    const [y, m] = getCalendarMonth(newMatchDraft).split('-').map(Number);
    if (!canGoCalendarNext(y, m)) return;
    const d = new Date(y, m, 1);
    newMatchDraft.calendarMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    refreshCalendarDOM(newMatchDraft);
    return;
  }

  if (e.target.closest('[data-action="cancel-guest"]')) {
    const draft = getPlayerFormDraft();
    if (!draft) return;
    draft.guestSlot = null;
    draft.guestName = '';
    draft.guestError = '';
    if (newTeamOpen) updateNewTeamFormDOM();
    else updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="confirm-guest"]')) {
    const draft = getPlayerFormDraft();
    if (!draft) return;
    if (newTeamOpen) syncNewTeamDraftFromDom();
    else syncNewMatchDraftFromDom();
    const slot = e.target.closest('[data-action="confirm-guest"]').dataset.guestSlot;
    confirmGuestFromSlot(draft, slot);
    if (newTeamOpen) updateNewTeamFormDOM();
    else updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="open-guest-slot"]')) {
    const draft = getPlayerFormDraft();
    if (!draft) return;
    const slot = e.target.closest('[data-action="open-guest-slot"]').dataset.slot;
    draft.guestSlot = slot;
    draft.guestName = '';
    draft.guestError = '';
    if (newTeamOpen) updateNewTeamFormDOM();
    else updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="pick-existing-team"]')) {
    if (!newMatchDraft) return;
    const btn = e.target.closest('[data-action="pick-existing-team"]');
    const side = btn.dataset.side;
    const val = parseInt(btn.dataset.teamId, 10);
    const team = getTeam(val);
    const reason = team ? getTeamUnavailableReason(newMatchDraft, team, side) : null;
    if (reason === 'busy') {
      const busyIds = getDraftBusyPlayerIds(newMatchDraft);
      const busyPlayer = team.playerIds.find(id => busyIds.has(id));
      alert(`${getPlayerName(busyPlayer)} jest w grze — nie można wybrać drużyny „${team.name}”`);
      return;
    }
    if (reason === 'conflict') {
      alert('Ta drużyna ma wspólnego zawodnika z drugą stroną — wybierz inną drużynę');
      return;
    }
    applyExistingTeamToDraft(newMatchDraft, side, val);
    clearConflictingOtherTeam(newMatchDraft, side);
    enforceOtherSideAfterTeamPick(newMatchDraft, side);
    newMatchDraft.openTeamPickerSide = null;
    updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="toggle-player-picker"]')) {
    const draft = getPlayerFormDraft();
    if (!draft) return;
    const slot = e.target.closest('[data-action="toggle-player-picker"]').dataset.slot;
    draft.openPlayerPickerSlot = draft.openPlayerPickerSlot === slot ? null : slot;
    if (newMatchDraft) newMatchDraft.openTeamPickerSide = null;
    if (newTeamOpen) updateNewTeamFormDOM();
    else updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="pick-player"]')) {
    const draft = getPlayerFormDraft();
    if (!draft) return;
    const btn = e.target.closest('[data-action="pick-player"]');
    const slot = btn.dataset.slot;
    const id = parseInt(btn.dataset.playerId, 10);
    draft.slots[slot] = id;
    if (draft.pendingGuests) delete draft.pendingGuests[slot];
    draft.guestSlot = null;
    draft.guestError = '';
    draft.openPlayerPickerSlot = null;
    if (newTeamOpen) updateNewTeamFormDOM();
    else updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="pick-new-guest"]')) {
    const draft = getPlayerFormDraft();
    if (!draft) return;
    const slot = e.target.closest('[data-action="pick-new-guest"]').dataset.slot;
    draft.guestSlot = slot;
    draft.guestName = '';
    draft.guestError = '';
    draft.openPlayerPickerSlot = null;
    if (newTeamOpen) updateNewTeamFormDOM();
    else updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="toggle-team-picker"]')) {
    if (!newMatchDraft) return;
    const side = e.target.closest('[data-action="toggle-team-picker"]').dataset.side;
    newMatchDraft.openTeamPickerSide = newMatchDraft.openTeamPickerSide === side ? null : side;
    newMatchDraft.openPlayerPickerSlot = null;
    updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="toggle-save-team"]')) {
    if (!newMatchDraft) return;
    const side = e.target.closest('[data-action="toggle-save-team"]').dataset.side;
    const checked = e.target.checked;
    if (side === 'A') newMatchDraft.saveTeamA = checked;
    else newMatchDraft.saveTeamB = checked;
    return;
  }

  if (e.target.closest('[data-action="set-team-mode"]')) {
    syncNewMatchDraftFromDom();
    const btn = e.target.closest('[data-action="set-team-mode"]');
    const side = btn.dataset.side;
    const mode = btn.dataset.mode;
    if (mode === 'existing' && !canPickExistingTeam(newMatchDraft, side)) return;
    if (side === 'A') {
      newMatchDraft.teamModeA = mode;
      if (mode === 'create') {
        newMatchDraft.teamIdA = null;
        newMatchDraft.slots.a1 = null;
        newMatchDraft.slots.a2 = null;
        newMatchDraft.teamMetaA = { name: '', avatarUrl: null };
      }
    } else {
      newMatchDraft.teamModeB = mode;
      if (mode === 'create') {
        newMatchDraft.teamIdB = null;
        newMatchDraft.slots.b1 = null;
        newMatchDraft.slots.b2 = null;
        newMatchDraft.teamMetaB = { name: '', avatarUrl: null };
      }
    }
    newMatchDraft.openTeamPickerSide = null;
    newMatchDraft.openPlayerPickerSlot = null;
    updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="team-avatar-a"]')) {
    teamAvatarSide = 'A';
    teamAvatarInput?.click();
    return;
  }

  if (e.target.closest('[data-action="team-avatar-b"]')) {
    teamAvatarSide = 'B';
    teamAvatarInput?.click();
    return;
  }

  if (e.target.closest('[data-action="random-team-name"]')) {
    if (!newMatchDraft) return;
    syncNewMatchDraftFromDom();
    const side = e.target.closest('[data-action="random-team-name"]').dataset.side;
    const name = pickRandomTeamName();
    if (side === 'A') newMatchDraft.teamMetaA.name = name;
    else newMatchDraft.teamMetaB.name = name;
    updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="random-match-team-name"]')) {
    const input = document.getElementById('match-team-name');
    if (input) {
      input.value = pickRandomTeamName();
      updateTeamNameFieldChrome(input);
    }
    return;
  }
});

avatarInput?.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) return;
  try {
    setUserAvatar(await resizeAvatarFile(file));
    saveState();
    render();
  } catch (_) {
    alert('Nie udało się dodać zdjęcia. Spróbuj innego pliku.');
  }
});

fab?.addEventListener('click', () => {
  if (currentTab === 'matches') {
    if (!canCreateMatch()) {
      showToast('Nowy mecz może dodać tylko zalogowany zawodnik z kontem', 'warn');
      return;
    }
    newMatchDraft = newMatchDefault();
    newMatchOpen = true;
    render();
  } else if (currentTab === 'players' && playersRosterTab === 'players') {
    playersFabMenuOpen = !playersFabMenuOpen;
    openPlayerId = null;
    openTeamId = null;
    updateFabMenu();
    if (!playersFabMenuOpen) render();
  } else if (currentTab === 'players' && playersRosterTab === 'teams') {
    newTeamDraft = newTeamDefault();
    newTeamOpen = true;
    openPlayerId = null;
    openTeamId = null;
    render();
  }
});

document.getElementById('fab-anchor')?.addEventListener('click', e => {
  if (e.target.closest('[data-action="fab-invite-account"]')) {
    e.stopPropagation();
    playersFabMenuOpen = false;
    updateFabMenu();
    const token = createSignupInvite();
    openInviteShareSheet(buildSignupInvitePayload(token));
    return;
  }
  if (e.target.closest('[data-action="fab-add-guest"]')) {
    e.stopPropagation();
    playersFabMenuOpen = false;
    addGuestOpen = true;
    playersRosterTab = 'players';
    openPlayerId = null;
    openTeamId = null;
    updateFabMenu();
    render();
    requestAnimationFrame(() => document.getElementById('add-guest-name')?.focus());
  }
});

content?.addEventListener('change', e => {
  if (e.target.id === 'display-name') updateSaveNameButton();
  if (e.target.id === 'team-detail-name') updateTeamSaveButton();
  if (e.target.id === 'archive-score-a' || e.target.id === 'archive-score-b') updateArchiveSetSaveButton();
  if (e.target.id === 'delete-confirm-text') updateDeleteConfirmButton();
  if (e.target.id === 'delete-confirm-password') updateDeleteConfirmButton();
  if (e.target.id === 'delete-confirm-second') updateDeleteConfirmButton();
  if (e.target.id === 'reset-confirm-text') updateResetStatsConfirmButton();
  if (e.target.id === 'reset-confirm-password') updateResetStatsConfirmButton();
  if (e.target.id === 'reset-confirm-second') updateResetStatsConfirmButton();
  if (e.target.id === 'google-confirm-text') updateChangeGoogleConfirmButton();
  if (e.target.id === 'google-confirm-password') updateChangeGoogleConfirmButton();
  if (e.target.id === 'google-confirm-second') updateChangeGoogleConfirmButton();
  if (e.target.id === 'delete-team-pin') updateDeleteTeamConfirmButton();
  if (e.target.id === 'delete-player-pin') updateDeletePlayerConfirmButton();
  if (e.target.id === 'pin-setup-new' || e.target.id === 'pin-setup-confirm') updatePinSetupButton();
  if (e.target.id === 'pin-change-current' || e.target.id === 'pin-change-new' || e.target.id === 'pin-change-confirm') updatePinChangeButton();
});

content?.addEventListener('input', e => {
  if (e.target.matches('[data-new-match-guest-slot]') && newMatchDraft) {
    newMatchDraft.guestName = clampPlayerOrTeamName(e.target.value);
    newMatchDraft.guestError = '';
    return;
  }
  if (e.target.matches('[data-team-guest-slot]') && newTeamDraft) {
    newTeamDraft.guestName = clampPlayerOrTeamName(e.target.value);
    newTeamDraft.guestError = '';
    return;
  }
  if (e.target.matches('[data-new-match-field="team-a-name"], [data-new-match-field="team-b-name"]') && newMatchDraft) {
    const side = e.target.dataset.newMatchField === 'team-a-name' ? 'A' : 'B';
    const val = clampPlayerOrTeamName(e.target.value);
    if (side === 'A') newMatchDraft.teamMetaA.name = val;
    else newMatchDraft.teamMetaB.name = val;
    return;
  }
  if (e.target.id === 'match-team-name') {
    e.target.value = clampPlayerOrTeamName(e.target.value);
    return;
  }
  if (e.target.id === 'archive-score-a' || e.target.id === 'archive-score-b') {
    updateArchiveSetSaveButton();
    return;
  }
  if (e.target.id === 'display-name') {
    updateSaveNameButton();
    return;
  }
  if (e.target.id === 'team-detail-name') {
    updateTeamSaveButton();
    updateTeamNameFieldChrome(e.target);
    return;
  }
  if (e.target.classList.contains('team-name-field__input')) {
    updateTeamNameFieldChrome(e.target);
    return;
  }
  if (e.target.id === 'delete-confirm-text'
    || e.target.id === 'delete-confirm-password'
    || e.target.id === 'delete-confirm-second') {
    updateDeleteConfirmButton();
    return;
  }
  if (e.target.id === 'reset-confirm-text'
    || e.target.id === 'reset-confirm-password'
    || e.target.id === 'reset-confirm-second') {
    updateResetStatsConfirmButton();
    return;
  }
  if (e.target.id === 'google-confirm-text'
    || e.target.id === 'google-confirm-password'
    || e.target.id === 'google-confirm-second') {
    updateChangeGoogleConfirmButton();
    return;
  }
  if (e.target.id === 'delete-team-pin') {
    updateDeleteTeamConfirmButton();
    return;
  }
  if (e.target.id === 'delete-player-pin') {
    updateDeletePlayerConfirmButton();
    return;
  }
  if (e.target.id === 'pin-setup-new' || e.target.id === 'pin-setup-confirm') {
    updatePinSetupButton();
    return;
  }
  if (e.target.id === 'pin-change-current' || e.target.id === 'pin-change-new' || e.target.id === 'pin-change-confirm') {
    updatePinChangeButton();
    return;
  }
  if ((e.target.id === 'set-score-a' || e.target.id === 'set-score-b') && openMatchId) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m?.liveSet || !canEditMatch(m)) return;
    const a = parseInt(document.getElementById('set-score-a')?.value, 10);
    const b = parseInt(document.getElementById('set-score-b')?.value, 10);
    if (!isNaN(a) && a >= 0) m.liveSet.scoreA = a;
    if (!isNaN(b) && b >= 0) m.liveSet.scoreB = b;
    const row = m.sets?.find(s => s.n === m.liveSet.n);
    if (row) {
      row.scoreA = m.liveSet.scoreA;
      row.scoreB = m.liveSet.scoreB;
    }
    touchMatchUpdated(m);
    saveState({ immediatePush: true });
    updateLiveScoresDOM(m);
  }
});

content?.addEventListener('blur', e => {
  if (e.target.matches('[data-new-match-guest-slot]') && newMatchDraft) {
    syncNewMatchDraftFromDom();
    const slot = e.target.dataset.newMatchGuestSlot;
    confirmGuestFromSlot(newMatchDraft, slot);
    updateNewMatchPlayersDOM();
    return;
  }
  if (e.target.matches('[data-team-guest-slot]') && newTeamDraft) {
    syncNewTeamDraftFromDom();
    const slot = e.target.dataset.teamGuestSlot;
    confirmGuestFromSlot(newTeamDraft, slot);
    updateNewTeamFormDOM();
  }
}, true);

content?.addEventListener('keydown', e => {
  if (e.target.matches('[data-new-match-guest-slot]') && newMatchDraft) {
    if (e.key === 'Enter') {
      e.preventDefault();
      syncNewMatchDraftFromDom();
      const slot = e.target.dataset.newMatchGuestSlot;
      confirmGuestFromSlot(newMatchDraft, slot);
      updateNewMatchPlayersDOM();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      newMatchDraft.guestSlot = null;
      newMatchDraft.guestName = '';
      newMatchDraft.guestError = '';
      updateNewMatchPlayersDOM();
    }
    return;
  }
  if (!e.target.matches('[data-team-guest-slot]') || !newTeamDraft) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    syncNewTeamDraftFromDom();
    const slot = e.target.dataset.teamGuestSlot;
    confirmGuestFromSlot(newTeamDraft, slot);
    updateNewTeamFormDOM();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    newTeamDraft.guestSlot = null;
    newTeamDraft.guestName = '';
    newTeamDraft.guestError = '';
    updateNewTeamFormDOM();
  }
});

content?.addEventListener('pointerdown', e => {
  const syncPanel = e.target.closest('[data-profile-sync-panel]');
  if (syncPanel?.hasAttribute('data-profile-sync-google')) {
    syncLongPressTimer = setTimeout(() => {
      syncLongPressTimer = null;
      openChangeGoogleFromLongPress();
    }, 600);
    return;
  }

  const card = e.target.closest('.match-card--clickable[data-match-id]');
  if (card && !openMatchId && !e.target.closest('.ctx-actions')) {
    const id = parseInt(card.dataset.matchId, 10);
    const m = matches.find(x => x.id === id);
    if (m && canEditMatch(m)) {
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        suppressNextClick = true;
        ctxTarget = { type: 'match', id };
        render();
      }, 550);
    }
  }
  const setRow = e.target.closest('.set-row[data-set-n]');
  if (setRow && openMatchId && !e.target.closest('.ctx-actions')) {
    const m = matches.find(x => x.id === openMatchId);
    const setN = parseInt(setRow.dataset.setN, 10);
    const set = m?.sets?.find(s => s.n === setN);
    const canCtx = m && canEditSetScores(m);
    if (canCtx) {
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        suppressNextClick = true;
        ctxTarget = { type: 'set', matchId: openMatchId, setN };
        render();
      }, 550);
    }
  }
});

content?.addEventListener('pointerup', () => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  if (syncLongPressTimer) { clearTimeout(syncLongPressTimer); syncLongPressTimer = null; }
});
content?.addEventListener('pointercancel', () => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  if (syncLongPressTimer) { clearTimeout(syncLongPressTimer); syncLongPressTimer = null; }
});

if (teamAvatarInput) {
  teamAvatarInput.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const url = await resizeAvatarFile(file);
      if (matchTeamAvatarSide && openMatchId) {
        const m = matches.find(x => x.id === openMatchId);
        if (m) {
          const meta = ensureMatchTeamMeta(m, matchTeamAvatarSide);
          meta.avatarUrl = url;
          if (meta.teamId) {
            const t = getTeam(meta.teamId);
            if (t) {
              t.avatarUrl = url;
              touchTeamUpdated(t);
            }
          }
          touchMatchUpdated(m);
          saveState();
          updateMatchTeamEditAvatarDOM(m, matchTeamAvatarSide);
        }
        matchTeamAvatarSide = null;
        return;
      }
      if (teamAvatarEditId) {
        const team = getTeam(teamAvatarEditId);
        if (team && canEditTeam(team)) {
          team.avatarUrl = url;
          touchTeamUpdated(team);
          matches.forEach(m => {
            if (m.teamMeta?.A?.teamId === team.id) m.teamMeta.A.avatarUrl = url;
            if (m.teamMeta?.B?.teamId === team.id) m.teamMeta.B.avatarUrl = url;
          });
          saveState();
          render();
        }
        teamAvatarEditId = null;
        return;
      }
      if (teamAvatarSide === 'new-team' && newTeamDraft) {
        newTeamDraft.avatarUrl = url;
        updateNewTeamFormDOM();
        teamAvatarSide = null;
        return;
      }
      if (!teamAvatarSide || !newMatchDraft) return;
      if (teamAvatarSide === 'A') newMatchDraft.teamMetaA.avatarUrl = url;
      else newMatchDraft.teamMetaB.avatarUrl = url;
      updateNewMatchPlayersDOM();
    } catch (_) {
      alert('Nie udało się dodać zdjęcia drużyny.');
    }
    teamAvatarSide = null;
  });
}

async function bootstrap() {
  forceClearModals();

  const cloudConfigured = typeof BadmintonCloud !== 'undefined' && BadmintonCloud.isConfigured();
  if (!cloudConfigured) authBootstrapPending = false;

  const authBootstrapTimeout = cloudConfigured
    ? setTimeout(() => {
        if (!authBootstrapPending) return;
        authBootstrapPending = false;
        console.warn('Badminton App: auth bootstrap timeout — pokazuję UI');
        render();
      }, 5000)
    : null;

  try {
    if (typeof BadmintonCloud !== 'undefined') {
      const cloudResult = await BadmintonCloud.init({
        getState: exportPersistedState,
        getLeagueState: exportLeagueState,
        getUserState: exportUserState,
        applyState: applyPersistedState,
        applyLeagueState,
        applyUserState,
        skipInitialSync: () => !!readPendingGoogleRelink(),
        onStateApplied: () => {
          saveState({ skipCloudPush: true });
          updateHeaderAvatar();
          syncUserSessionAvatarFromPlayer();
          if (profileOpen) {
            updateProfileSyncBadgeDOM();
            return;
          }
          if (currentTab === 'players' && openPlayerId) {
            softUpdatePlayerDetail(openPlayerId);
            return;
          }
          if (currentTab === 'players') {
            softUpdatePlayersTab();
            return;
          }
          if (currentTab === 'matches' && openMatchId) {
            const m = matches.find(x => x.id === openMatchId);
            if (m) softUpdateMatchDetail(m, pendingRemoteMatchUi || {});
            else render();
            return;
          }
          if (currentTab === 'matches') {
            softUpdateMatchList();
            return;
          }
        },
        onLeagueStateApplied: () => {
          saveState({ skipCloudPush: true });
          applyLeagueStateToUI();
          if (openMatchId) {
            const m = matches.find(x => x.id === openMatchId);
            if (m?.liveSet) updateLiveScoresDOM(m);
          }
        },
        onAuthChange: (user, signedIn) => {
          if (signedIn && user) {
            finishAuthSession(user).catch(err => {
              profileAuthError = err.message || 'Błąd logowania';
              render();
            });
            return;
          }
          if (!signedIn) {
            if (isGoogleRelinkPending()) {
              userSession.loggedIn = false;
              userSession.authEmail = null;
              saveState();
              render();
              return;
            }
            userSession.loggedIn = false;
            userSession.authEmail = null;
            userSession.playerId = null;
            authWantsProfile = false;
            profileOpen = false;
            clearSessionRole();
            currentTab = 'stats';
            statsSubView = null;
            saveState();
            render();
          }
        },
        onStatusChange: (status, detail) => {
          cloudSyncDetail = detail || '';
          if (profileOpen && userSession.loggedIn) {
            updateProfileSyncBadgeDOM();
          }
        },
      });

      if (BadmintonCloud.isReady()) {
        if (cloudResult.session?.user) {
          setSessionRole('player');
          if (readPendingGoogleRelink()) {
            await finishAuthSession(cloudResult.session.user);
          } else {
            const { claimApplied } = ensurePlayerForAuthUser(cloudResult.session.user);
            if (claimApplied) requestProfilePanel();
          }
        } else if (!userSession.loggedIn && !isGoogleRelinkPending()) {
          userSession.authEmail = null;
          userSession.playerId = null;
        }
      }
    }
  } catch (err) {
    console.error('bootstrap failed', err);
  } finally {
    if (authBootstrapTimeout) clearTimeout(authBootstrapTimeout);
    authBootstrapPending = false;
    ensureSessionRoleForLoggedInUser();
    reconcilePinKey();
    migrateLocalAvatarToLeague();
    saveState();
    ensureLiveMatchTickers();
    render();
  }
}

content?.addEventListener('submit', async e => {
  const form = e.target.closest('[data-action="auth-form"]');
  if (!form) return;
  e.preventDefault();
  profileAuthError = '';
  profileAuthNotice = '';
  const email = form.querySelector('#auth-email')?.value || '';
  const password = form.querySelector('#auth-password')?.value || '';
  try {
    if (profileAuthMode === 'register') {
      const pin = form.querySelector('#auth-pin')?.value || '';
      const pinConfirm = form.querySelector('#auth-pin-confirm')?.value || '';
      if (!/^\d{4}$/.test(pin)) {
        profileAuthError = 'PIN musi mieć dokładnie 4 cyfry';
        render();
        return;
      }
      if (pin !== pinConfirm) {
        profileAuthError = 'PIN-y nie są identyczne';
        render();
        return;
      }
      requestProfilePanel();
      const data = await BadmintonCloud.signUpWithEmail(email, password);
      if (!data.session) {
        authWantsProfile = false;
        pendingSignupEmail = email.trim();
        if (data.user?.identities?.length === 0) {
          pendingSignupEmail = null;
          profileAuthError = 'Ten adres e-mail jest już zarejestrowany. Zaloguj się lub użyj resetu hasła.';
        } else {
          profileAuthNotice = `Wysłaliśmy link aktywacyjny na ${pendingSignupEmail}. Sprawdź skrzynkę i folder spam.`;
          showToast('Link aktywacyjny wysłany na e-mail', 'success');
        }
        render();
        return;
      }
      pendingSignupEmail = null;
      handleAuthSuccess(data.user, { openProfile: true, initialPin: pin });
    } else {
      const data = await BadmintonCloud.signInWithEmail(email, password);
      handleAuthSuccess(data.user);
    }
  } catch (err) {
    authWantsProfile = false;
    profileAuthError = err.message || 'Błąd logowania';
    render();
  }
});

bootstrap();
bindPinInputGuards();
bindOrientationListeners();

document.getElementById('app')?.addEventListener('click', async e => {
  if (e.target.closest('[data-action="close-invite-share"]')) {
    inviteShareOpen = false;
    render();
    return;
  }
  const chip = e.target.closest('[data-action="invite-share-channel"]');
  if (!chip || !inviteSharePayload) return;
  const via = chip.dataset.channel;
  try {
    const result = await dispatchInviteShare(via, inviteSharePayload);
    if (!result) return;
    markInviteShared(inviteSharePayload, via);
    const extras = typeof result === 'object' ? result : {};
    showToast(shareInviteFeedback(via, extras), 'success');
    if (via !== 'copy') inviteShareOpen = false;
    render();
  } catch (err) {
    if (err?.name === 'AbortError') return;
    showToast('Nie udało się udostępnić', 'warn');
  }
});

window.addEventListener('pageshow', () => {
  forceClearModals();
  restoreUiState();
  syncBottomNav();
  if (!authBootstrapPending) render();
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updateInstallBanner();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  localStorage.setItem(INSTALL_DISMISS_KEY, '1');
  updateInstallBanner();
});

document.getElementById('pwa-install-btn')?.addEventListener('click', () => {
  promptPwaInstall().catch(() => {});
});

document.getElementById('pwa-install-close')?.addEventListener('click', () => {
  dismissPwaInstall();
});
