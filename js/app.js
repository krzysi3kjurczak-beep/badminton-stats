const APP_NAME = 'Badminton App';
const STORAGE_KEY = 'badminton-app-state';
const STATE_VERSION = 9;
const TEMP_GUEST_BASE = -1000;
const AVATAR_MAX_PX = 256;

const DEFAULT_PLAYERS = [
  { id: 1, displayName: 'Krzysiek' },
  { id: 2, displayName: 'Julia' },
  { id: 3, displayName: 'Michał' },
  { id: 4, displayName: 'Ola' },
  { id: 5, displayName: 'Maciek' },
];

const DEFAULT_MATCHES = [
  {
    id: 1, date: '2026-04-14', teamA: [1, 2], teamB: [3, 4],
    scoreA: 1, scoreB: 1, result: 'draw', winnerId: null, status: 'finished',
    sets: [
      { n: 1, scoreA: 21, scoreB: 21, durationSec: 720 },
      { n: 2, scoreA: 18, scoreB: 21, durationSec: 680 },
    ],
  },
  {
    id: 2, date: '2026-06-17', teamA: [1], teamB: [5],
    scoreA: 3, scoreB: 2, result: 'win', winnerId: 1, status: 'finished',
    sets: [
      { n: 1, scoreA: 21, scoreB: 18, durationSec: 720 },
      { n: 2, scoreA: 19, scoreB: 21, durationSec: 840 },
      { n: 3, scoreA: 21, scoreB: 15, durationSec: 660 },
      { n: 4, scoreA: 18, scoreB: 21, durationSec: 780 },
      { n: 5, scoreA: 21, scoreB: 19, durationSec: 900 },
    ],
  },
  {
    id: 3, date: '2026-06-17', teamA: [3], teamB: [4],
    scoreA: 3, scoreB: 0, result: 'win', winnerId: 3, status: 'finished',
    sets: [
      { n: 1, scoreA: 21, scoreB: 12, durationSec: 540 },
      { n: 2, scoreA: 21, scoreB: 17, durationSec: 600 },
      { n: 3, scoreA: 21, scoreB: 14, durationSec: 570 },
    ],
  },
  {
    id: 4, date: '2026-06-05', teamA: [2], teamB: [1],
    scoreA: 2, scoreB: 3, result: 'win', winnerId: 1, status: 'finished',
    sets: [
      { n: 1, scoreA: 21, scoreB: 19, durationSec: 700 },
      { n: 2, scoreA: 21, scoreB: 16, durationSec: 620 },
      { n: 3, scoreA: 17, scoreB: 21, durationSec: 760 },
      { n: 4, scoreA: 19, scoreB: 21, durationSec: 810 },
      { n: 5, scoreA: 18, scoreB: 21, durationSec: 850 },
    ],
  },
  {
    id: 5, date: '2026-04-06', teamA: [1], teamB: [5],
    scoreA: 2, scoreB: 3, result: 'win', winnerId: 5, status: 'finished',
    sets: [
      { n: 1, scoreA: 21, scoreB: 23, durationSec: 920 },
      { n: 2, scoreA: 21, scoreB: 18, durationSec: 710 },
      { n: 3, scoreA: 19, scoreB: 21, durationSec: 800 },
      { n: 4, scoreA: 21, scoreB: 17, durationSec: 650 },
      { n: 5, scoreA: 20, scoreB: 22, durationSec: 880 },
    ],
  },
];

const SUBTITLES = {
  stats: 'Statystyki',
  matches: 'Mecze',
  players: 'Zawodnicy',
  profile: 'Profil',
  'stats-global': 'Statystyki globalne',
  'stats-players': 'Statystyki zawodników',
  'stats-h2h': 'Konfrontacja',
  'match-detail': 'Mecz',
  'add-set': 'Nowy set',
  'new-match': 'Nowy mecz',
};

let players = [];
let teams = [];
let matches = [];
let userSession = { playerId: 1, avatarUrl: null, notifications: false, loggedIn: true };

let currentTab = 'stats';
let statsSubView = null;
let profileOpen = false;
let openMatchId = null;
let matchView = 'detail';
let matchInfoOpen = false;
let newMatchOpen = false;
let newMatchDraft = null;
let teamAvatarSide = null;
let matchTeamEditSide = null;
let matchTeamAvatarSide = null;
let setPlayOpen = false;
let editSetN = null;
let setDetailN = null;
let setTimerInterval = null;
let longPressTimer = null;
let suppressNextClick = false;
let matchClockInterval = null;
let reopenMatchEdit = false;
let ctxTarget = null;

const CALENDAR_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
const HOME_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const DICE_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.2" fill="currentColor" stroke="none"/></svg>`;

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

const content = document.getElementById('content');
const pageSubtitle = document.getElementById('page-subtitle');
const headerAvatar = document.getElementById('header-avatar');
const profileBtn = document.getElementById('profile-btn');
const avatarInput = document.getElementById('avatar-input');
const teamAvatarInput = document.getElementById('team-avatar-input');
const fab = document.getElementById('fab');

function normalizeMatch(m) {
  const def = DEFAULT_MATCHES.find(d => d.id === m.id);
  const base = def ? structuredClone(def) : { sets: [], status: 'finished' };
  return {
    ...base,
    ...m,
    sets: m.sets?.length ? m.sets : (base.sets || []),
    status: m.status || base.status || 'finished',
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      players = data.players || structuredClone(DEFAULT_PLAYERS);
      teams = data.teams || [];
      matches = (data.matches || structuredClone(DEFAULT_MATCHES)).map(normalizeMatch);
      userSession = { ...userSession, ...data.userSession };
      if (!data.stateVersion || data.stateVersion < 2) {
        userSession.avatarUrl = null;
      }
      if (!data.stateVersion || data.stateVersion < 3) {
        matches = DEFAULT_MATCHES.map(normalizeMatch);
      } else if (!data.stateVersion || data.stateVersion < STATE_VERSION) {
        matches = matches.map(normalizeMatch);
      }
      if (!data.stateVersion || data.stateVersion < STATE_VERSION) {
        players = players.map(p => ({ ...p, isGuest: p.isGuest ?? false }));
        if (!data.teams) teams = [];
        matches = matches.map(m => ({
          ...normalizeMatch(m),
          teamMeta: m.teamMeta || undefined,
          isArchive: m.isArchive ?? (m.date < todayIso()),
          tempGuests: m.tempGuests || undefined,
          liveSet: m.liveSet || undefined,
          createdAt: m.createdAt || Date.parse(m.date + 'T12:00:00') || Date.now(),
          matchClock: m.matchClock || undefined,
          firstSetStartedAt: m.firstSetStartedAt || undefined,
        }));
        saveState();
      }
      return;
    }
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
  }
  players = structuredClone(DEFAULT_PLAYERS);
  teams = [];
  matches = DEFAULT_MATCHES.map(normalizeMatch);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    stateVersion: STATE_VERSION,
    players,
    teams,
    matches,
    userSession,
  }));
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

function getLiveBusyPlayerIds() {
  const ids = new Set();
  matches.filter(isMatchLiveActive).forEach(m => {
    getMatchPlayerIds(m).forEach(id => ids.add(id));
  });
  return ids;
}

function isDraftToday(draft) {
  return (draft?.date || todayIso()) === todayIso();
}

function getDraftBusyPlayerIds(draft) {
  return isDraftToday(draft) ? getLiveBusyPlayerIds() : new Set();
}

function isTeamBusy(team, busyIds) {
  return team.playerIds.some(id => busyIds.has(id));
}

function pickRandomTeamName() {
  return RANDOM_TEAM_NAMES[Math.floor(Math.random() * RANDOM_TEAM_NAMES.length)];
}

function formatTeamLabel(playerIds) {
  return playerIds.map(id => getPlayerName(id)).join(' & ');
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
  const byPlayers = findTeamByPlayerIds(playerIds);
  if (byPlayers) {
    if (avatarUrl && !byPlayers.avatarUrl) byPlayers.avatarUrl = avatarUrl;
    return byPlayers.id;
  }
  const trimmed = name.trim() || formatTeamLabel(playerIds);
  const existing = teams.find(t =>
    t.playerIds[0] === playerIds[0] && t.playerIds[1] === playerIds[1] &&
    t.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (existing) {
    if (avatarUrl && !existing.avatarUrl) existing.avatarUrl = avatarUrl;
    return existing.id;
  }
  const id = nextTeamId();
  teams.push({ id, name: trimmed, avatarUrl: avatarUrl || null, playerIds: [...playerIds] });
  return id;
}

function saveTeamFromDraft(draft, side, playerIds) {
  const mode = side === 'A' ? draft.teamModeA : draft.teamModeB;
  const meta = side === 'A' ? draft.teamMetaA : draft.teamMetaB;
  if (mode === 'existing') {
    const id = side === 'A' ? draft.teamIdA : draft.teamIdB;
    if (id) {
      const t = getTeam(id);
      if (t && meta.avatarUrl) t.avatarUrl = meta.avatarUrl;
      return id;
    }
  }
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

function getTimingPhase(m) {
  if (!isMatchLiveActive(m)) return null;
  if (m.liveSet?.status === 'running') return 'live';
  if (m.liveSet?.status === 'paused') return 'set_pause';
  if (!hasFinishedSets(m)) return 'warmup';
  return 'inter_break';
}

function getMatchPhase(m) {
  const phase = getTimingPhase(m);
  if (phase === 'set_pause' || phase === 'inter_break') return 'break';
  return phase;
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

function syncMatchPhase(m) {
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
  saveState();
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

function isSetComplete(scoreA, scoreB) {
  const max = Math.max(scoreA, scoreB);
  const min = Math.min(scoreA, scoreB);
  if (max >= 30) return true;
  if (max >= 21 && max - min >= 2) return true;
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
    const trimmed = name.trim();
    if (!trimmed) return;
    let id;
    const existing = players.find(p => p.displayName.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      id = existing.id;
    } else {
      id = nextPlayerId();
      players.push({ id, displayName: trimmed, isGuest: true });
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

function cleanupGuestsForMatch(m) {
  getMatchPlayerIds(m).forEach(id => {
    const p = getPlayer(id);
    if (p?.isGuest && isGuestOnlyInMatch(id, m.id)) {
      players = players.filter(x => x.id !== id);
    }
  });
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
    saveState();
    return;
  }
  const delta = Math.floor((now - m.matchClock.lastTickAt) / 1000);
  if (delta > 0) {
    m.matchClock.elapsedSec += delta;
    m.matchClock.lastTickAt = now;
    saveState();
  }
}

function tickAllLiveMatches() {
  matches.forEach(m => {
    if (!isMatchLiveActive(m) || reopenMatchEdit) return;
    if (m.matchClock?.status !== 'running') return;
    tickMatchClock(m);
    syncMatchPhase(m);
    if (m.liveSet?.status === 'running') tickLiveSet(m);
  });
  const openM = openMatchId ? matches.find(x => x.id === openMatchId) : null;
  if (openM && isMatchLiveActive(openM) && !reopenMatchEdit) updateLiveTimingDOM(openM);
}

function hasRunningLiveMatches() {
  return matches.some(m => isMatchLiveActive(m) && !reopenMatchEdit && m.matchClock?.status === 'running');
}

function startMatchClockTicker() {
  if (!hasRunningLiveMatches()) {
    clearMatchClockTicker();
    return;
  }
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
  matches.forEach(m => {
    if (isMatchLiveActive(m) && !reopenMatchEdit) ensureMatchClockRunning(m);
  });
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
  const el = document.getElementById('match-clock-display');
  if (el) el.textContent = formatSportClock(getMatchClockElapsed(m));
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

function getLivePlayDuration(m) {
  let play = setsPlayDuration(m);
  if (m.liveSet?.status === 'running') play += getLiveSetElapsed(m);
  return play;
}

function computeTimingStats(m) {
  if (isMatchLiveActive(m) && !reopenMatchEdit) syncMatchPhase(m);
  const total = getMatchClockElapsed(m);
  const play = getLivePlayDuration(m);
  const rest = getTimingRest(m);
  return { total, play, rest };
}

function getPlayerLiveMatch(playerId) {
  return matches.find(m => isMatchLiveActive(m) && getMatchPlayerIds(m).includes(playerId));
}

function renderCtxActions(type, matchId, setN = null) {
  const m = matches.find(x => x.id === matchId);
  if (!m) return '';
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
    saveState();
    updateSetPlayClock(m);
  }
}

function ensureSetTimerRunning(m) {
  if (!m?.liveSet || m.liveSet.status !== 'running') return;
  if (setTimerInterval) return;
  setTimerInterval = setInterval(() => {
    const match = matches.find(x => x.id === m.id);
    if (match?.liveSet?.status === 'running') {
      tickLiveSet(match);
      if (matchInfoOpen) updateLiveTimingDOM(match);
    } else clearSetTimer();
  }, 1000);
}

function startSetTimer(m) {
  clearSetTimer();
  if (!m.liveSet) return;
  if (!m.firstSetStartedAt) m.firstSetStartedAt = Date.now();
  m.liveSet.status = 'running';
  m.liveSet.lastTickAt = Date.now();
  syncMatchPhase(m);
  saveState();
  setTimerInterval = setInterval(() => {
    const match = matches.find(x => x.id === m.id);
    if (match?.liveSet?.status === 'running') {
      tickLiveSet(match);
      if (matchInfoOpen) updateLiveTimingDOM(match);
    } else clearSetTimer();
  }, 1000);
}

function pauseLiveSet(m) {
  if (!m.liveSet) return;
  if (m.liveSet.status === 'running') {
    m.liveSet.elapsedSec = getLiveSetElapsed(m);
    m.liveSet.status = 'paused';
    m.liveSet.lastTickAt = null;
    clearSetTimer();
    syncMatchPhase(m);
    saveState();
  }
}

function resumeLiveSet(m) {
  if (!m.liveSet || m.liveSet.status !== 'paused') return;
  m.liveSet.status = 'running';
  m.liveSet.lastTickAt = Date.now();
  syncMatchPhase(m);
  saveState();
  clearSetTimer();
  setTimerInterval = setInterval(() => {
    const match = matches.find(x => x.id === m.id);
    if (match?.liveSet?.status === 'running') {
      tickLiveSet(match);
      if (matchInfoOpen) updateLiveTimingDOM(match);
    } else clearSetTimer();
  }, 1000);
}

function updateSetPlayClock(m) {
  const el = document.getElementById('set-play-clock');
  if (el) el.textContent = formatSportClock(getLiveSetElapsed(m));
}

function renderLiveBadge(small = false) {
  return `<span class="live-badge${small ? ' live-badge--sm' : ''}"><span class="live-dot"></span> W trakcie</span>`;
}

function renderBreakBadge(small = false) {
  return `<span class="live-badge live-badge--break${small ? ' live-badge--sm' : ''}"><span class="live-dot live-dot--break"></span> Przerwa</span>`;
}

function renderWarmupBadge(small = false) {
  return `<span class="live-badge live-badge--warmup${small ? ' live-badge--sm' : ''}"><span class="live-dot live-dot--warmup"></span> Rozgrzewka</span>`;
}

function renderMatchStatusBadge(m, small = false) {
  if (!isMatchLiveActive(m) || reopenMatchEdit) return '';
  const phase = getMatchPhase(m);
  if (phase === 'break') return renderBreakBadge(small);
  if (phase === 'warmup') return renderWarmupBadge(small);
  if (phase === 'live') return renderLiveBadge(small);
  return '';
}

function createGuestPlayer(name) {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: 'Podaj nazwę gościa' };
  if (isNameTaken(trimmed)) return { ok: false, error: 'Ta nazwa jest już zajęta' };
  const id = nextPlayerId();
  players.push({ id, displayName: trimmed, isGuest: true });
  saveState();
  return { ok: true, id };
}

function newMatchDefault() {
  const today = todayIso();
  return {
    date: today,
    type: 'singles',
    slots: { a1: null, a2: null, b1: null, b2: null },
    pendingGuests: {},
    teamModeA: 'create',
    teamModeB: 'create',
    teamIdA: null,
    teamIdB: null,
    teamMetaA: { name: '', avatarUrl: null },
    teamMetaB: { name: '', avatarUrl: null },
    guestSlot: null,
    guestName: '',
    guestError: '',
    dateError: '',
    calendarOpen: false,
    calendarMonth: today.slice(0, 7),
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
    playersEl.innerHTML = renderNewMatchPlayersSection(newMatchDraft);
  }
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

function getCurrentPlayer() {
  return getPlayer(userSession.playerId);
}

function renamePlayer(id, newName) {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  if (isNameTaken(trimmed, id)) return false;
  const player = getPlayer(id);
  if (!player) return false;
  player.displayName = trimmed;
  saveState();
  return true;
}

function formatDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

function renderAvatarHtml(name, avatarUrl, sizeClass) {
  if (avatarUrl) {
    return `<span class="avatar-frame ${sizeClass}"><img class="avatar-frame__img" src="${avatarUrl}" alt=""></span>`;
  }
  return `<span class="${sizeClass} avatar--initials">${initials(name)}</span>`;
}

function renderPlayerAvatars(ids, sizeClass = 'avatar-sm') {
  const items = ids.map((id, i) => {
    const p = getPlayer(id);
    if (!p) return '';
    const z = ids.length - i;
    return `<span class="match-card__avatar-slot" style="z-index:${z}">${renderAvatarHtml(p.displayName, getPlayerAvatarUrl(id), sizeClass)}</span>`;
  }).filter(Boolean);
  if (!items.length) return '';
  const overlap = items.length > 1 ? ' match-card__avatars--overlap' : '';
  return `<div class="match-card__avatars${overlap}">${items.join('')}</div>`;
}

function renderSideAvatars(m, side, sizeClass = 'avatar-sm') {
  const meta = getTeamMeta(m, side);
  if (meta?.avatarUrl) {
    return `<div class="match-card__avatars"><span class="match-card__avatar-slot"><span class="avatar-frame ${sizeClass}"><img class="avatar-frame__img" src="${meta.avatarUrl}" alt=""></span></span></div>`;
  }
  const ids = side === 'A' ? m.teamA : m.teamB;
  return renderPlayerAvatars(ids, sizeClass);
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
  if (!userSession.loggedIn) {
    headerAvatar.innerHTML = `<span class="avatar-sm avatar--guest">?</span>`;
    return;
  }
  const player = getCurrentPlayer();
  if (!player) {
    headerAvatar.innerHTML = `<span class="avatar-sm avatar--guest">?</span>`;
    return;
  }
  headerAvatar.innerHTML = renderAvatarHtml(player.displayName, userSession.avatarUrl, 'avatar-sm');
}

function computeWins() {
  const wins = {};
  players.forEach(p => { wins[p.id] = 0; });
  matches.forEach(m => {
    if (m.result === 'win' && m.winnerId) wins[m.winnerId] = (wins[m.winnerId] || 0) + 1;
  });
  return wins;
}

function setSubtitle(key) {
  pageSubtitle.textContent = SUBTITLES[key] || SUBTITLES.stats;
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
  return m.status === 'finished' || reopenMatchEdit;
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

function getPlayerAvatarUrl(id) {
  if (id === userSession.playerId && userSession.avatarUrl) return userSession.avatarUrl;
  return null;
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
  const name = document.getElementById('match-team-name')?.value.trim();
  if (!name) {
    alert('Podaj nazwę drużyny');
    return;
  }
  const meta = ensureMatchTeamMeta(m, side);
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

function renderMatchTeamEditPanel(m, side) {
  const meta = ensureMatchTeamMeta(m, side);
  const avatarHtml = meta.avatarUrl
    ? `<span class="avatar-frame avatar-sm"><img class="avatar-frame__img" src="${meta.avatarUrl}" alt=""></span>`
    : renderSideAvatars(m, side, 'avatar-sm');
  return `
    <div class="team-edit-sheet">
      <button class="team-edit-sheet__backdrop" data-action="close-team-edit" type="button" aria-label="Zamknij"></button>
      <div class="team-edit-sheet__panel">
        <div class="team-edit-sheet__head">
          <h3 class="team-edit-sheet__title">Drużyna ${side}</h3>
          <button class="icon-btn" data-action="close-team-edit" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>
        </div>
        <button class="team-edit-sheet__avatar" data-action="match-team-avatar" data-side="${side}" type="button">
          ${avatarHtml}
          <span class="team-edit-sheet__camera">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </span>
        </button>
        <label class="profile-card__label" for="match-team-name">Nazwa drużyny</label>
        <input class="profile-card__input" id="match-team-name" type="text" value="${meta.name || formatTeam(side === 'A' ? m.teamA : m.teamB, meta, m)}" maxlength="40">
        <button class="btn btn--primary btn--full" data-action="save-match-team" data-side="${side}" type="button">Zapisz</button>
      </div>
    </div>`;
}

function renderSetPlaySide(m, side, { inputId, plusAction, value } = {}) {
  const meta = getTeamMeta(m, side);
  const ids = side === 'A' ? m.teamA : m.teamB;
  const name = formatTeam(ids, meta, m);
  const score = value !== undefined ? value : (side === 'A' ? m.liveSet?.scoreA : m.liveSet?.scoreB);
  const plusBtn = plusAction
    ? `<button class="set-play__pt-btn set-play__pt-btn--sm" data-action="${plusAction}" type="button" aria-label="Dodaj punkt — ${name}">+</button>`
    : '';
  return `
    <div class="set-play__side set-play__side--${side.toLowerCase()}">
      <div class="set-play__side-head">
        ${renderSideAvatars(m, side)}
        <div class="set-play__side-meta">
          <span class="set-play__side-name">${name}</span>
        </div>
      </div>
      <div class="set-play__score-row">
        <input class="set-play__input" id="${inputId}" type="number" min="0" max="30" value="${score ?? ''}" placeholder="0" inputmode="numeric" aria-label="Punkty — ${name}">
        ${plusBtn}
      </div>
    </div>`;
}

const TROPHY_ICON = `<svg class="winner-trophy" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM5 5H3v1a3 3 0 003 3M19 5h2v1a3 3 0 01-3 3"/></svg>`;

const WHISTLE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3c-1.5 3-4 4.5-7 5v2c3-.5 5.5-2 7-5"/><path d="M9 10v4"/><path d="M12 14v3"/><circle cx="17" cy="8" r="2"/></svg>`;

const CLOSE_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

const FINISH_ICON = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;

const EDIT_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

const TRASH_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>`;

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

function renderMatchFace(m, { large = false, card = false, showClock = true, editableTeams = false } = {}) {
  const live = isMatchLiveActive(m) && !reopenMatchEdit;
  const phase = live ? getMatchPhase(m) : null;
  const avSize = 'avatar-sm';
  const teamEditable = editableTeams && m.teamA.length > 1;
  const avOpts = { editable: teamEditable };
  const boardCls = large ? 'match-board match-board--lg' : card ? 'match-board match-board--card' : 'match-board';
  const metaA = getTeamMeta(m, 'A');
  const metaB = getTeamMeta(m, 'B');
  const hasTeamName = !!(metaA?.name?.trim() || metaB?.name?.trim());
  const namesCls = large
    ? `match-board__names match-board__names--lg${hasTeamName ? ' match-board__names--team' : ''}`
    : card ? `match-board__names match-board__names--card${hasTeamName ? ' match-board__names--team' : ''}` : 'match-board__names';
  const scoreCls = large ? 'match-board__score match-board__score--xl'
    : card ? 'match-board__score match-board__score--card' : 'match-board__score';
  const showClockRow = showClock && large && matchClockVisible(m);
  const frozen = matchClockFrozen(m);
  const clockCls = `match-board__clock match-board__clock--display${frozen ? ' match-board__clock--finished' : ''}`;

  return `
    <div class="${boardCls}">
      <div class="match-board__row">
        <div class="match-board__side match-board__side--a">
          <div class="match-board__side-inner">
            ${renderTeamAvatarsForMatch(m, 'A', avSize, avOpts)}
            <div class="${namesCls}">${formatTeam(m.teamA, metaA, m)}</div>
          </div>
        </div>
        <div class="${scoreCls}">${renderScore(m.scoreA, m.scoreB, phase === 'live')}</div>
        <div class="match-board__side match-board__side--b">
          <div class="match-board__side-inner">
            <div class="${namesCls}">${formatTeam(m.teamB, metaB, m)}</div>
            ${renderTeamAvatarsForMatch(m, 'B', avSize, avOpts)}
          </div>
        </div>
      </div>
      ${showClockRow ? `
        <div class="${clockCls}">
          <span class="match-board__clock-time" id="match-clock-display">${formatSportClock(getMatchClockElapsed(m))}</span>
        </div>` : ''}
    </div>
  `;
}

function renderMatchResult(m) {
  if (isMatchLiveActive(m) && !reopenMatchEdit) {
    const phase = getMatchPhase(m);
    const cls = phase === 'break' ? ' match-card__result--break'
      : phase === 'warmup' ? ' match-card__result--warmup' : '';
    return `<div class="match-card__result match-card__result--live${cls}">${renderMatchStatusBadge(m, true)}</div>`;
  }
  if (isMatchActive(m) && isMatchArchive(m)) {
    return `<div class="match-card__result match-card__result--archive">Archiwum</div>`;
  }
  if (m.result === 'draw') {
    return `<div class="match-card__result match-card__result--draw"><span class="match-card__result-label">Wynik meczu</span><span class="match-card__result-name">Remis</span></div>`;
  }
  if (m.result === 'win' && m.status === 'finished') {
    const myWin = isUserMatchWin(m);
    return `
      <div class="match-card__result match-card__result--win">
        <span class="match-card__result-label">Zwycięzca</span>
        <span class="match-card__result-badge${myWin ? ' match-card__result-badge--gold' : ''}">
          ${myWin ? TROPHY_ICON : ''}
          <span class="match-card__result-name">${getWinnerLabel(m)}</span>
        </span>
      </div>`;
  }
  return '';
}

function renderSetRow(m, set) {
  const isLive = set.status === 'live' || (m.liveSet && m.liveSet.n === set.n && m.liveSet.status !== 'idle');
  const scoreA = isLive && m.liveSet ? m.liveSet.scoreA : set.scoreA;
  const scoreB = isLive && m.liveSet ? m.liveSet.scoreB : set.scoreB;
  const draw = scoreA === scoreB;
  const clsA = draw ? 'set-row__pts--draw' : (scoreA > scoreB ? 'set-row__pts--win' : 'set-row__pts--lose');
  const clsB = draw ? 'set-row__pts--draw' : (scoreB > scoreA ? 'set-row__pts--win' : 'set-row__pts--lose');
  const showDur = !isMatchArchive(m) && set.durationSec && !isLive;
  const canCtx = m.status === 'active' || reopenMatchEdit;
  const ctxOpen = canCtx && ctxTarget?.type === 'set' && ctxTarget.matchId === m.id && ctxTarget.setN === set.n;
  const setBadge = isLive && m.liveSet
    ? (m.liveSet.status === 'paused' ? renderBreakBadge(true) : renderLiveBadge(true))
    : '';
  return `
    <div class="set-row${isLive ? ' set-row--live' : ''}${ctxOpen ? ' set-row--ctx' : ''}" data-set-n="${set.n}" data-action="open-set">
      ${ctxOpen ? renderCtxActions('set', m.id, set.n) : ''}
      <div class="set-row__score-side set-row__score-side--a">
        <span class="set-row__pts ${clsA}">${scoreA}</span>
      </div>
      <div class="set-row__center">
        <span class="set-row__n">Set ${set.n}${setBadge ? ' · ' + setBadge : ''}</span>
        ${showDur ? `<span class="set-row__dur">${formatSportClock(set.durationSec)}</span>` : ''}
      </div>
      <div class="set-row__score-side set-row__score-side--b">
        <span class="set-row__pts ${clsB}">${scoreB}</span>
      </div>
    </div>
  `;
}

function renderMatchCard(m) {
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

function renderInfoStatRow(label, valA, valB) {
  return `
    <div class="info-stat">
      <span class="info-stat__val">${valA}</span>
      <span class="info-stat__label">${label}</span>
      <span class="info-stat__val info-stat__val--right">${valB}</span>
    </div>
  `;
}

function renderMatchInfoPanel(m) {
  const side = computeSideStats(m);
  const match = computeMatchStats(m);

  return `
    <div class="match-info-layer">
      <div class="match-info-glass">
        <button class="match-info-glass__close" data-action="close-match-info" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>

        <div class="match-info-glass__scoreboard">
          ${renderMatchFace(m, { large: true, showClock: false })}
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
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Czas meczu</span><strong id="info-stat-total">${formatSportClock(match.totalDur)}</strong></div>` : ''}
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Czas realnej gry</span><strong id="info-stat-play">${formatSportClock(match.playDur)}</strong></div>` : ''}
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Czas odpoczynku</span><strong id="info-stat-rest">${formatSportClock(match.restDur)}</strong></div>` : ''}
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Średni czas seta</span><strong>${formatSportClock(match.avgDur)}</strong></div>` : ''}
          ${!isMatchArchive(m) ? `<div class="info-match-row"><span>Średni czas przerwy</span><strong id="info-stat-avg-break">${match.avgBreakDur ? formatSportClock(match.avgBreakDur) : '—'}</strong></div>` : ''}
          <div class="info-match-row"><span>Średnia punktów w secie</span><strong>${match.avgPtsPerSet}</strong></div>
          <div class="info-match-row"><span>Sety na przewadze (łącznie)</span><strong>${match.deuceSets}</strong></div>
          ${match.longestSet ? `<div class="info-match-row"><span>Najdłuższy set</span><strong>Set ${match.longestSet.n} · ${formatSportClock(match.longestSet.durationSec)}</strong></div>` : ''}
          <div class="info-match-row"><span>Typ meczu</span><strong>${m.teamA.length > 1 ? 'Debel' : 'Singiel'}</strong></div>
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
      <span class="match-detail__winner-label">Zwycięzca</span>
      <strong class="match-detail__winner-name">${getWinnerLabel(m)}</strong>
    </div>`;
}

function ensureLiveSet(m) {
  if (m.liveSet) return m.liveSet;
  const n = (m.sets?.filter(s => s.status !== 'live').length || 0) + 1;
  m.liveSet = { n, scoreA: 0, scoreB: 0, elapsedSec: 0, status: 'idle', lastTickAt: null };
  if (!m.sets) m.sets = [];
  if (!m.sets.find(s => s.n === n && s.status === 'live')) {
    m.sets.push({ n, scoreA: 0, scoreB: 0, status: 'live' });
  }
  saveState();
  return m.liveSet;
}

function beginLiveSet(m) {
  ensureLiveSet(m);
  if (m.liveSet.status === 'idle') startSetTimer(m);
  else if (m.liveSet.status === 'running') ensureSetTimerRunning(m);
  ensureMatchClockRunning(m);
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
  const setData = {
    n: ls.n,
    scoreA: ls.scoreA,
    scoreB: ls.scoreB,
    durationSec: isMatchArchive(m) ? 0 : getLiveSetElapsed(m),
    status: 'finished',
  };
  const idx = m.sets.findIndex(s => s.n === ls.n);
  if (idx >= 0) m.sets[idx] = setData;
  else m.sets.push(setData);
  recalcMatchScores(m);
  delete m.liveSet;
  clearSetTimer();
  syncMatchPhase(m);
  ensureMatchClockRunning(m);
  saveState();
  return true;
}

function finishLiveSet(m) {
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
  if (!confirm('Wynik nie kończy seta według zasad badmintona. Zapisać niepełny set?')) return;
  if (commitLiveSet(m, true)) {
    setPlayOpen = false;
    render();
  }
}

function syncScoresFromSetForm(m) {
  if (!m.liveSet) return;
  const a = parseInt(document.getElementById('set-score-a')?.value, 10);
  const b = parseInt(document.getElementById('set-score-b')?.value, 10);
  if (!isNaN(a) && a >= 0) m.liveSet.scoreA = a;
  if (!isNaN(b) && b >= 0) m.liveSet.scoreB = b;
  const row = m.sets?.find(s => s.n === m.liveSet.n);
  if (row) {
    row.scoreA = m.liveSet.scoreA;
    row.scoreB = m.liveSet.scoreB;
  }
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
  saveState();
  updateSetPlayDOM(m);
}

function renderSetClockControls(m) {
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
  const el = document.querySelector('.match-detail__live');
  if (el && isMatchLiveActive(m) && !reopenMatchEdit) {
    el.innerHTML = renderMatchStatusBadge(m, true);
  }
}

function updateSetPlayDOM(m) {
  const ls = m.liveSet;
  if (!ls) return;
  const a = document.getElementById('set-score-a');
  const b = document.getElementById('set-score-b');
  if (a && document.activeElement !== a) a.value = ls.scoreA;
  if (b && document.activeElement !== b) b.value = ls.scoreB;
  updateSetPlayClock(m);
  const clockWrap = document.querySelector('.set-play__clock-wrap');
  if (clockWrap) {
    const badge = clockWrap.querySelector('.live-badge');
    const wantBreak = ls.status === 'paused';
    const wantLive = ls.status === 'running';
    if ((wantLive || wantBreak) && !badge) {
      clockWrap.insertAdjacentHTML('afterbegin', wantBreak ? renderBreakBadge(true) : renderLiveBadge(true));
    } else if (badge) {
      if (!wantLive && !wantBreak) badge.remove();
      else if (wantBreak && !badge.classList.contains('live-badge--break')) {
        badge.outerHTML = renderBreakBadge(true);
      } else if (wantLive && badge.classList.contains('live-badge--break')) {
        badge.outerHTML = renderLiveBadge(true);
      }
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
  if (mainBtn) {
    mainBtn.dataset.action = 'finish-live-set';
    mainBtn.textContent = 'Zakończ set';
    mainBtn.hidden = false;
  }
}

function renderSetPlayOverlay(m) {
  const ls = m.liveSet || ensureLiveSet(m);
  const setBadge = ls.status === 'running' ? renderLiveBadge(true)
    : ls.status === 'paused' ? renderBreakBadge(true) : renderLiveBadge(true);

  return `
    <div class="overlay-layer">
      <div class="overlay-glass overlay-glass--static set-play-glass">
        <button class="match-info-glass__close" data-action="close-set-play" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>
        <h2 class="new-match__title">Set ${ls.n}</h2>
        <p class="match-sheet__context">${formatTeam(m.teamA, getTeamMeta(m, 'A'), m)} vs ${formatTeam(m.teamB, getTeamMeta(m, 'B'), m)}</p>

        <div class="set-play__clock-wrap">
          ${setBadge}
          <div class="set-play__clock" id="set-play-clock">${formatSportClock(getLiveSetElapsed(m))}</div>
          ${renderSetClockControls(m)}
        </div>

        <div class="set-play__live-score">
          ${renderSetPlaySide(m, 'A', { inputId: 'set-score-a', plusAction: 'score-a-plus' })}
          ${renderSetPlaySide(m, 'B', { inputId: 'set-score-b', plusAction: 'score-b-plus' })}
        </div>

        <button class="btn btn--primary btn--full set-play__save" data-action="finish-live-set" type="button">Zakończ set</button>
        <button class="set-play__delete" data-action="delete-set" data-set-n="${ls.n}" type="button" aria-label="Usuń set">${TRASH_ICON} Usuń set</button>
      </div>
    </div>`;
}

function renderArchiveSetOverlay(m) {
  const nextN = editSetN || ((m.sets?.filter(s => s.status !== 'live').length || 0) + 1);
  const existing = editSetN ? m.sets.find(s => s.n === editSetN) : null;
  const title = existing ? `Edycja seta ${nextN}` : (reopenMatchEdit ? `Dodaj set ${nextN}` : `Set ${nextN}`);
  const saveLabel = existing ? 'Zapisz zmiany' : (reopenMatchEdit ? 'Dodaj set' : 'Zapisz set');
  return `
    <div class="overlay-layer">
      <div class="overlay-glass overlay-glass--static set-play-glass">
        <button class="match-info-glass__close" data-action="close-set-play" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>
        <h2 class="new-match__title">${title}</h2>
        <div class="set-play__live-score">
          ${renderSetPlaySide(m, 'A', { inputId: 'archive-score-a', value: existing?.scoreA ?? '' })}
          ${renderSetPlaySide(m, 'B', { inputId: 'archive-score-b', value: existing?.scoreB ?? '' })}
        </div>
        <button class="btn btn--primary btn--full set-play__save" data-action="save-archive-set" type="button">${saveLabel}</button>
        ${existing && (m.status === 'active' || reopenMatchEdit) ? `<button class="set-play__delete" data-action="delete-set" data-set-n="${nextN}" type="button">${TRASH_ICON} Usuń set</button>` : ''}
      </div>
    </div>`;
}

function renderSetDetailOverlay(m, setN) {
  const set = m.sets.find(s => s.n === setN);
  if (!set || set.status === 'live') return '';
  const draw = set.scoreA === set.scoreB;
  const clsA = draw ? 'match-card__score-part--draw' : (set.scoreA > set.scoreB ? 'match-card__score-part--win' : 'match-card__score-part--lose');
  const clsB = draw ? 'match-card__score-part--draw' : (set.scoreB > set.scoreA ? 'match-card__score-part--win' : 'match-card__score-part--lose');
  const metaA = getTeamMeta(m, 'A');
  const metaB = getTeamMeta(m, 'B');
  return `
    <div class="overlay-layer">
      <div class="overlay-glass overlay-glass--static">
        <button class="match-info-glass__close" data-action="close-set-play" type="button" aria-label="Zamknij">${CLOSE_ICON}</button>
        <h2 class="new-match__title">Set ${set.n}</h2>
        <div class="set-detail-board match-board">
          <div class="match-board__row">
            <div class="match-board__side match-board__side--a">
              <div class="match-board__side-inner">
                ${renderTeamAvatarsForMatch(m, 'A', 'avatar-sm')}
                <div class="match-board__names">${formatTeam(m.teamA, metaA, m)}</div>
              </div>
            </div>
            <div class="match-board__score match-board__score--set">
              <span class="match-card__score-part ${clsA}">${set.scoreA}</span><span class="match-card__score-sep">:</span><span class="match-card__score-part ${clsB}">${set.scoreB}</span>
            </div>
            <div class="match-board__side match-board__side--b">
              <div class="match-board__side-inner">
                <div class="match-board__names">${formatTeam(m.teamB, metaB, m)}</div>
                ${renderTeamAvatarsForMatch(m, 'B', 'avatar-sm')}
              </div>
            </div>
          </div>
        </div>
        ${set.durationSec ? `<p class="set-detail__dur">${formatSportClock(set.durationSec)}</p>` : ''}
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
  const data = { n, scoreA, scoreB, durationSec: 0, status: 'finished' };
  const idx = m.sets.findIndex(s => s.n === n);
  if (idx >= 0) m.sets[idx] = { ...m.sets[idx], ...data };
  else m.sets.push(data);
  recalcMatchScores(m);
  if (m.status === 'finished') recalcMatchResult(m);
  saveState();
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  render();
}

function deleteSetFromMatch(m, setN) {
  if (!confirm('Usunąć ten set? Tej operacji nie można cofnąć.')) return;
  m.sets = (m.sets || []).filter(s => s.n !== setN);
  if (m.liveSet?.n === setN) {
    delete m.liveSet;
    clearSetTimer();
    syncMatchPhase(m);
    if (isMatchLiveActive(m) && !reopenMatchEdit) ensureMatchClockRunning(m);
  }
  recalcMatchScores(m);
  if (m.status === 'finished') recalcMatchResult(m);
  saveState();
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  render();
}

function deleteMatchById(id) {
  const m = matches.find(x => x.id === id);
  if (!m) return;
  const guestWarning = getMatchPlayerIds(m).some(pid => {
    const p = getPlayer(pid);
    return p?.isGuest && isGuestOnlyInMatch(pid, id);
  });
  let msg = 'Usunąć ten mecz? Tej operacji nie można cofnąć.';
  if (guestWarning) msg += '\n\nZawodnik-gość użyty tylko w tym meczu zostanie usunięty z listy.';
  if (!confirm(msg)) return;
  cleanupGuestsForMatch(m);
  matches = matches.filter(x => x.id !== id);
  saveState();
  if (openMatchId === id) closeMatch();
  else render();
}

function renderMatchDetailPage(m) {
  const active = isMatchActive(m);
  const finished = m.status === 'finished' && !reopenMatchEdit;
  const archive = isMatchArchive(m);
  const live = isMatchLiveActive(m);
  const hasLiveSet = m.liveSet && (m.liveSet.status === 'running' || m.liveSet.status === 'paused');
  const canPlaySet = active && !hasLiveSet;
  const overlayOpen = setPlayOpen || matchInfoOpen;
  const finishedSets = (m.sets || []).filter(s => s.status !== 'live' || (m.liveSet && s.n === m.liveSet.n));

  const canEnd = hasFinishedSets(m);
  const playSetLabel = reopenMatchEdit ? 'Dodaj set' : 'Rozegraj set';

  return `
    <div class="match-page${overlayOpen ? ' match-page--info-open' : ''}">
      <div class="match-page__main">
        <div class="back-bar match-page__top">
          <button class="back-btn" data-action="close-match" type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
            Mecze
          </button>
          <div class="match-page__toolbar">
            ${finished ? `<button class="icon-btn" data-action="edit-match" type="button" aria-label="Edytuj mecz">${EDIT_ICON}</button>` : ''}
            <button class="icon-btn icon-btn--danger" data-action="delete-match" type="button" aria-label="Usuń mecz">${TRASH_ICON}</button>
          </div>
        </div>

        <div class="match-detail__hero">
          <div class="match-detail__date">${formatDateLong(m.date)}</div>
          ${live && !reopenMatchEdit ? `<div class="match-detail__live">${renderMatchStatusBadge(m, true)}</div>` : ''}
          ${archive && active && !reopenMatchEdit ? '<div class="match-detail__archive-tag">Mecz archiwalny</div>' : ''}
          ${renderMatchFace(m, { large: true, editableTeams: m.teamA.length > 1 })}
        </div>

        <p class="section-label">Sety</p>
        <div class="set-list">
          ${finishedSets.length ? finishedSets.map(s => renderSetRow(m, s)).join('') : '<p class="match-detail__empty">Brak rozegranych setów</p>'}
        </div>

        ${active ? `
          <div class="match-actions">
            ${canPlaySet ? `<button class="btn btn--primary btn--full" data-action="play-set" type="button">${playSetLabel}</button>` : ''}
            ${hasLiveSet ? `<button class="btn btn--primary btn--full" data-action="resume-set-play" type="button">Wróć do seta na żywo</button>` : ''}
            <button class="btn btn--accent btn--full match-actions__end${canEnd ? '' : ' btn--disabled'}" data-action="end-match" type="button"${canEnd ? '' : ' disabled'}>${archive || reopenMatchEdit ? 'Zapisz mecz' : 'Zakończ mecz'}</button>
          </div>
        ` : ''}

        ${finished || reopenMatchEdit ? renderWinnerBlock(m) : ''}

        <button class="match-detail__stats-link" data-action="toggle-match-info" type="button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-6M22 20V8"/></svg>
          <span>Szczegóły meczu</span>
        </button>
      </div>

      ${matchInfoOpen ? renderMatchInfoPanel(m) : ''}
      ${setPlayOpen && setDetailN ? renderSetDetailOverlay(m, setDetailN) : ''}
      ${setPlayOpen && !setDetailN && !editSetN && !archive && active && !reopenMatchEdit ? renderSetPlayOverlay(m) : ''}
      ${setPlayOpen && !setDetailN && (editSetN || (archive && active) || reopenMatchEdit) ? renderArchiveSetOverlay(m) : ''}
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
  if (isMatchLiveActive(m) && !reopenMatchEdit) ensureMatchClockRunning(m);
  if (m?.liveSet?.status === 'running') ensureSetTimerRunning(m);
  render();
}

function closeMatch() {
  clearSetTimer();
  openMatchId = null;
  matchView = 'detail';
  matchInfoOpen = false;
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  matchTeamEditSide = null;
  reopenMatchEdit = false;
  ctxTarget = null;
  render();
}

function enterMatchEditMode(m) {
  syncMatchPhase(m);
  stopMatchClock(m);
  if (m.liveSet) {
    delete m.liveSet;
    clearSetTimer();
  }
  m.status = 'active';
  openMatchId = m.id;
  reopenMatchEdit = true;
  matchTeamEditSide = null;
  setPlayOpen = false;
  editSetN = null;
  setDetailN = null;
  saveState();
  render();
}

function finalizeMatch(m) {
  if (m.liveSet) {
    alert('Najpierw zakończ lub zapisz trwający set');
    return false;
  }
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
  saveState();
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

function renderPlayerSelectOptions(draft, slot) {
  const excluded = getExcludedPlayerIds(draft, slot);
  const selected = draft.slots[slot];
  const busyIds = getDraftBusyPlayerIds(draft);
  let html = '<option value="">— wybierz —</option>';
  const registered = players.filter(p => !p.isGuest);
  if (registered.length) {
    html += '<option disabled value="" class="new-match__select-sep">── Zawodnicy ──</option>';
    registered.forEach(p => {
      if (excluded.includes(p.id) && p.id !== selected) return;
      const busy = busyIds.has(p.id) && p.id !== selected;
      if (busy) {
        html += `<option value="${p.id}" disabled class="new-match__select-busy">● ${p.displayName} · w grze</option>`;
      } else {
        html += `<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${p.displayName}</option>`;
      }
    });
  }
  const guests = players.filter(p => p.isGuest);
  if (guests.length) {
    html += '<option disabled value="" class="new-match__select-sep">── Goście ──</option>';
    guests.forEach(p => {
      if (excluded.includes(p.id) && p.id !== selected) return;
      const busy = busyIds.has(p.id) && p.id !== selected;
      if (busy) {
        html += `<option value="${p.id}" disabled class="new-match__select-busy">● ${p.displayName} · w grze</option>`;
      } else {
        html += `<option value="${p.id}"${p.id === selected ? ' selected' : ''}>${p.displayName}</option>`;
      }
    });
  }
  if (draft.pendingGuests?.[slot]) {
    html += `<option value="${draft.slots[slot]}" selected>${draft.pendingGuests[slot]} (gość)</option>`;
  }
  html += `<option value="__guest__"${draft.guestSlot === slot ? ' selected' : ''}>+ Nowy gość…</option>`;
  return html;
}

function renderPlayerSlot(draft, slot, label) {
  const guestOpen = draft.guestSlot === slot;
  return `
    <div class="new-match__field">
      <label class="profile-card__label">${label}</label>
      <select class="profile-card__input new-match__select" data-new-match-slot="${slot}">
        ${renderPlayerSelectOptions(draft, slot)}
      </select>
      ${guestOpen ? `
        <div class="new-match__guest">
          <input class="profile-card__input" type="text" data-new-match-guest-name placeholder="Imię gościa" value="${draft.guestName}">
          ${draft.guestError ? `<p class="new-match__error">${draft.guestError}</p>` : ''}
          <div class="new-match__guest-actions">
            <button class="btn btn--secondary btn--sm" data-action="cancel-guest" type="button">Anuluj</button>
            <button class="btn btn--primary btn--sm" data-action="confirm-guest" data-guest-slot="${slot}" type="button">Dodaj gościa</button>
          </div>
        </div>
      ` : ''}
    </div>`;
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
  const busyIds = getDraftBusyPlayerIds(draft);

  const existingBlock = `
    <div class="new-match__field">
      <label class="profile-card__label">Wybierz drużynę</label>
      ${availableTeams.length ? `
        <select class="profile-card__input new-match__select" data-new-match-team="${side}">
          <option value="">— wybierz drużynę —</option>
          ${availableTeams.map(t => {
            const busy = isTeamBusy(t, busyIds) && t.id !== teamId;
            if (busy) {
              return `<option value="${t.id}" disabled class="new-match__select-busy">● ${t.name} · w grze</option>`;
            }
            return `<option value="${t.id}"${teamId === t.id ? ' selected' : ''}>${t.name} (${formatTeamLabel(t.playerIds)})</option>`;
          }).join('')}
        </select>
        ${teamId ? `
          <div class="new-match__team-preview">
            ${meta.avatarUrl
              ? `<span class="avatar-frame avatar-xs"><img class="avatar-frame__img" src="${meta.avatarUrl}" alt=""></span>`
              : ''}
            <span>${meta.name}</span>
            <span class="new-match__team-preview-players">${formatTeamLabel([draft.slots[slots[0]], draft.slots[slots[1]]].filter(Boolean))}</span>
          </div>
        ` : ''}
      ` : '<p class="new-match__empty-teams">Brak zapisanych drużyn. Utwórz nową drużynę.</p>'}
    </div>`;

  const createBlock = `
    <div class="new-match__team-meta">
      <div class="team-name-field">
        <input class="profile-card__input team-name-field__input" type="text" data-new-match-field="${nameField}" placeholder="Nazwa drużyny (opcjonalnie)" value="${meta.name}">
        <button class="team-name-field__dice" data-action="random-team-name" data-side="${side}" type="button" aria-label="Losuj nazwę drużyny">${DICE_ICON}</button>
      </div>
      <button class="new-match__team-avatar-btn" data-action="${avatarAction}" type="button" aria-label="Zdjęcie drużyny">
        ${meta.avatarUrl
          ? `<span class="avatar-frame avatar-xs"><img class="avatar-frame__img" src="${meta.avatarUrl}" alt=""></span>`
          : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'}
      </button>
    </div>
    ${renderPlayerSlot(draft, slots[0], 'Zawodnik 1')}
    ${renderPlayerSlot(draft, slots[1], 'Zawodnik 2')}`;

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
    </div>`;
}

function syncNewMatchDraftFromDom() {
  if (!newMatchDraft) return;
  const dateEl = document.querySelector('[data-new-match-field="date"]');
  if (dateEl) newMatchDraft.date = dateEl.value;
  const nameA = document.querySelector('[data-new-match-field="team-a-name"]');
  const nameB = document.querySelector('[data-new-match-field="team-b-name"]');
  if (nameA) newMatchDraft.teamMetaA.name = nameA.value;
  if (nameB) newMatchDraft.teamMetaB.name = nameB.value;
  const guestNameEl = document.querySelector('[data-new-match-guest-name]');
  if (guestNameEl) newMatchDraft.guestName = guestNameEl.value;
}

function createMatchFromDraft() {
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
  }
  const nextId = matches.reduce((max, m) => Math.max(max, m.id), 0) + 1;
  const isArchive = draft.date < todayIso();
  const tempGuests = {};
  const resolveId = id => {
    if (id > 0) return id;
    return id;
  };
  [...teamA, ...teamB].forEach(id => {
    if (id < 0 && draft.pendingGuests) {
      const slot = Object.entries(draft.slots).find(([, v]) => v === id)?.[0];
      if (slot && draft.pendingGuests[slot]) tempGuests[id] = draft.pendingGuests[slot];
    }
  });
  const match = {
    id: nextId,
    date: draft.date,
    teamA: teamA.map(resolveId),
    teamB: teamB.map(resolveId),
    scoreA: 0,
    scoreB: 0,
    sets: [],
    status: 'active',
    result: null,
    winnerId: null,
    isArchive,
    tempGuests: Object.keys(tempGuests).length ? tempGuests : undefined,
    createdAt: Date.now(),
  };
  if (!isArchive) {
    const now = Date.now();
    match.matchClock = { elapsedSec: 0, status: 'running', lastTickAt: now, startedAt: now };
    match.matchTiming = { restSec: 0, breakPeriods: [], phase: 'warmup', phaseStartedAt: now };
  }
  if (isDoubles) {
    match.teamMeta = {};
    const metaA = draft.teamMetaA;
    const metaB = draft.teamMetaB;
    const teamIdA = saveTeamFromDraft(draft, 'A', teamA);
    const teamIdB = saveTeamFromDraft(draft, 'B', teamB);
    match.teamMeta.A = {
      name: getTeam(teamIdA)?.name || metaA.name.trim() || formatTeamLabel(teamA),
      avatarUrl: getTeam(teamIdA)?.avatarUrl || metaA.avatarUrl || null,
      teamId: teamIdA,
    };
    match.teamMeta.B = {
      name: getTeam(teamIdB)?.name || metaB.name.trim() || formatTeamLabel(teamB),
      avatarUrl: getTeam(teamIdB)?.avatarUrl || metaB.avatarUrl || null,
      teamId: teamIdB,
    };
  }
  saveState();
  matches.unshift(match);
  newMatchOpen = false;
  newMatchDraft = null;
  openMatch(nextId);
}

function renderMatches() {
  return `
    <div class="matches-page${newMatchOpen ? ' matches-page--form-open' : ''}">
      <div class="matches-page__main">
        <p class="section-label">${matches.length} meczów</p>
        <div class="match-list">${matches.map(renderMatchCard).join('')}</div>
      </div>
      ${newMatchOpen ? renderNewMatchForm() : ''}
    </div>
  `;
}

function renderPlayers() {
  const wins = computeWins();
  const registered = players.filter(p => !p.isGuest);
  const guests = players.filter(p => p.isGuest);
  const renderCard = p => {
    const liveMatch = getPlayerLiveMatch(p.id);
    return `
    <article class="player-card${p.id === userSession.playerId ? ' player-card--me' : ''}${p.isGuest ? ' player-card--guest' : ''}">
      ${renderAvatarHtml(p.displayName, p.id === userSession.playerId ? userSession.avatarUrl : null, 'player-card__avatar')}
      <div class="player-card__name">${p.displayName}</div>
      <div class="player-card__record"><span>${wins[p.id] || 0}</span> wygranych</div>
      ${liveMatch ? `<button class="player-card__ingame" data-action="open-live-match" data-match-id="${liveMatch.id}" type="button"><span class="live-dot"></span> W grze</button>` : ''}
      ${p.isGuest ? '<span class="player-card__badge">Gość</span>' : ''}
    </article>`;
  };
  const renderTeamCard = t => `
    <article class="team-card">
      ${t.avatarUrl
        ? `<span class="team-card__avatar avatar-frame avatar-sm"><img class="avatar-frame__img" src="${t.avatarUrl}" alt=""></span>`
        : `<span class="team-card__avatar avatar-sm avatar--initials">${initials(t.name)}</span>`}
      <div class="team-card__name">${t.name}</div>
      <div class="team-card__players">${formatTeamLabel(t.playerIds)}</div>
    </article>`;
  return `
    <p class="section-label">${registered.length} zawodników</p>
    <div class="player-grid">${registered.map(renderCard).join('')}</div>
    ${teams.length ? `
      <p class="section-label section-label--muted">Drużyny</p>
      <div class="team-grid">${teams.map(renderTeamCard).join('')}</div>
    ` : ''}
    ${guests.length ? `
      <p class="section-label section-label--muted">Zawodnicy goście</p>
      <div class="player-grid player-grid--guests">${guests.map(renderCard).join('')}</div>
    ` : ''}
  `;
}

function renderProfileLoggedOut() {
  return `
    <div class="profile-panel sub-screen">
      <div class="profile-panel__login">
        <div class="profile-panel__login-icon">🏸</div>
        <h2>Witaj w ${APP_NAME}</h2>
        <p>Zaloguj się, aby zarządzać swoim profilem zawodnika.</p>
        <button class="btn btn--primary btn--full" data-action="login" type="button">Zaloguj się</button>
      </div>
    </div>
  `;
}

function renderProfile() {
  if (!userSession.loggedIn) return renderProfileLoggedOut();

  const player = getCurrentPlayer();
  if (!player) return renderProfileLoggedOut();

  const notifLabel = userSession.notifications ? 'Wyłącz powiadomienia' : 'Włącz powiadomienia';
  const notifBtnClass = userSession.notifications ? 'btn--secondary' : 'btn--primary';
  const notifIcon = userSession.notifications
    ? '<path d="M13.73 21a2 2 0 01-3.46 0M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>';

  return `
    <div class="profile-panel sub-screen">
      <div class="profile-card">
        <div class="profile-card__avatar-row">
          <div class="profile-avatar-stack">
            <button class="profile-panel__avatar-wrap" data-action="change-avatar" type="button">
              ${renderAvatarHtml(player.displayName, userSession.avatarUrl, 'avatar-lg')}
              <span class="profile-panel__camera">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </span>
            </button>
            ${userSession.avatarUrl ? `
              <button class="profile-avatar-remove" data-action="remove-avatar" type="button" aria-label="Usuń zdjęcie">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            ` : ''}
          </div>
          <p class="profile-card__desc profile-card__desc--center">Kliknij ikonę aparatu, aby zmienić avatar.</p>
        </div>
      </div>

      <div class="profile-card">
        <label class="profile-card__label" for="display-name">Imię wyświetlane</label>
        <input class="profile-card__input" id="display-name" type="text" value="${player.displayName}" maxlength="30" autocomplete="name">
        <button class="btn btn--primary btn--full" id="save-name-btn" data-action="save-name" type="button" hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Zapisz
        </button>
      </div>

      <div class="profile-card">
        <h3 class="profile-card__title">Powiadomienia</h3>
        <p class="profile-card__desc">Wkrótce: przypomnienie o meczach i wynikach. Na razie możesz włączyć preferencję.</p>
        <button class="btn ${notifBtnClass} btn--full" data-action="toggle-notifications" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${notifIcon}</svg>
          ${notifLabel}
        </button>
      </div>

      <button class="btn btn--outline btn--full" data-action="logout" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        Wyloguj się
      </button>
    </div>
  `;
}

function render() {
  if (profileOpen) {
    content.innerHTML = renderProfile();
    setSubtitle('profile');
    fab.classList.remove('fab--visible');
    updateHeaderAvatar();
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
    content.innerHTML = renderPlayers();
    setSubtitle('players');
  }

  fab.classList.toggle('fab--visible', (currentTab === 'matches' || currentTab === 'players') && !openMatchId && !newMatchOpen);
  updateHeaderAvatar();
  ensureLiveMatchTickers();
}

profileBtn.addEventListener('click', () => {
  profileOpen = !profileOpen;
  render();
});

document.querySelectorAll('.bottom-nav__item').forEach(btn => {
  btn.addEventListener('click', () => {
    profileOpen = false;
    closeMatch();
    newMatchOpen = false;
    newMatchDraft = null;
    currentTab = btn.dataset.tab;
    statsSubView = null;
    document.querySelectorAll('.bottom-nav__item').forEach(b => {
      b.classList.toggle('bottom-nav__item--active', b === btn);
    });
    render();
  });
});

content.addEventListener('click', e => {
  if (e.target.closest('[data-action="ctx-edit"]')) {
    const btn = e.target.closest('[data-action="ctx-edit"]');
    const matchId = parseInt(btn.dataset.matchId, 10);
    const m = matches.find(x => x.id === matchId);
    ctxTarget = null;
    if (btn.dataset.ctxType === 'match' && m) {
      enterMatchEditMode(m);
    } else if (btn.dataset.ctxType === 'set') {
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
    ctxTarget = null;
    if (btn.dataset.ctxType === 'match') {
      deleteMatchById(matchId);
    } else {
      const m = matches.find(x => x.id === matchId);
      if (m) deleteSetFromMatch(m, parseInt(btn.dataset.setN, 10));
    }
    return;
  }

  if (ctxTarget && !e.target.closest('.ctx-actions')) {
    ctxTarget = null;
    render();
    return;
  }

  if (e.target.closest('[data-action="open-live-match"]')) {
    const id = parseInt(e.target.closest('[data-action="open-live-match"]').dataset.matchId, 10);
    currentTab = 'matches';
    document.querySelectorAll('.bottom-nav__item').forEach(b => {
      b.classList.toggle('bottom-nav__item--active', b.dataset.tab === 'matches');
    });
    openMatch(id);
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
    if (m && side) saveMatchTeamEdit(m, side);
    return;
  }

  if (e.target.closest('[data-action="match-team-avatar"]')) {
    matchTeamAvatarSide = e.target.closest('[data-action="match-team-avatar"]').dataset.side;
    teamAvatarInput.click();
    return;
  }

  if (e.target.closest('[data-action="save-name"]')) {
    const input = document.getElementById('display-name');
    if (input && renamePlayer(userSession.playerId, input.value)) {
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="change-avatar"]')) {
    avatarInput.click();
    return;
  }

  if (e.target.closest('[data-action="remove-avatar"]')) {
    userSession.avatarUrl = null;
    saveState();
    render();
    return;
  }

  if (e.target.closest('[data-action="toggle-notifications"]')) {
    userSession.notifications = !userSession.notifications;
    saveState();
    render();
    return;
  }

  if (e.target.closest('[data-action="logout"]')) {
    userSession.loggedIn = false;
    saveState();
    render();
    return;
  }

  if (e.target.closest('[data-action="login"]')) {
    userSession.loggedIn = true;
    if (!userSession.playerId) userSession.playerId = 1;
    saveState();
    render();
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

  if (e.target.closest('[data-action="play-set"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m) return;
    if (m.liveSet) {
      alert('Najpierw zakończ trwający set');
      return;
    }
    setPlayOpen = true;
    editSetN = null;
    setDetailN = null;
    if (isMatchArchive(m) || reopenMatchEdit) {
      render();
    } else {
      beginLiveSet(m);
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="resume-set-play"]')) {
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

  if (e.target.closest('[data-action="pause-set-timer"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (m) {
      pauseLiveSet(m);
      updateSetPlayDOM(m);
      updateMatchDetailLiveBadge(m);
    }
    return;
  }

  if (e.target.closest('[data-action="resume-set-timer"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (m) {
      resumeLiveSet(m);
      updateSetPlayDOM(m);
      updateMatchDetailLiveBadge(m);
    }
    return;
  }

  if (e.target.closest('[data-action="score-a-plus"]')) {
    adjustLiveScore(matches.find(x => x.id === openMatchId), 'A', 1);
    return;
  }
  if (e.target.closest('[data-action="score-b-plus"]')) {
    adjustLiveScore(matches.find(x => x.id === openMatchId), 'B', 1);
    return;
  }

  if (e.target.closest('[data-action="finish-live-set"]')) {
    finishLiveSet(matches.find(x => x.id === openMatchId));
    return;
  }

  if (e.target.closest('[data-action="save-archive-set"]')) {
    saveArchiveSet(matches.find(x => x.id === openMatchId));
    return;
  }

  if (e.target.closest('[data-action="delete-set"]')) {
    const btn = e.target.closest('[data-action="delete-set"]');
    const m = matches.find(x => x.id === openMatchId);
    if (m) deleteSetFromMatch(m, parseInt(btn.dataset.setN, 10));
    return;
  }

  if (e.target.closest('[data-action="edit-set"]')) {
    const btn = e.target.closest('[data-action="edit-set"]');
    editSetN = parseInt(btn.dataset.setN, 10);
    setDetailN = null;
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
      beginLiveSet(m);
      render();
    } else if (set && set.status !== 'live') {
      if (m.status === 'active' || reopenMatchEdit) {
        editSetN = setN;
        setDetailN = null;
      } else {
        setDetailN = setN;
        editSetN = null;
      }
      setPlayOpen = true;
      render();
    }
    return;
  }

  if (e.target.closest('[data-action="delete-match"]')) {
    if (openMatchId) deleteMatchById(openMatchId);
    return;
  }

  if (e.target.closest('[data-action="edit-match"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (m) enterMatchEditMode(m);
    return;
  }

  if (e.target.closest('[data-action="end-match"]')) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m || !hasFinishedSets(m)) return;
    if (reopenMatchEdit) {
      if (finalizeMatch(m)) render();
      return;
    }
    const label = isMatchArchive(m) ? 'Zapisać mecz archiwalny?' : 'Zakończyć mecz?';
    if (confirm(label) && finalizeMatch(m)) render();
    return;
  }

  if (e.target.closest('[data-action="toggle-match-info"]')) {
    matchInfoOpen = true;
    const m = matches.find(x => x.id === openMatchId);
    if (isMatchLiveActive(m) && !reopenMatchEdit) ensureMatchClockRunning(m);
    render();
    return;
  }

  if (e.target.closest('[data-action="close-match-info"]')) {
    matchInfoOpen = false;
    render();
    return;
  }

  if (e.target.closest('[data-action="close-new-match"]')) {
    newMatchOpen = false;
    newMatchDraft = null;
    render();
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
    newMatchDraft.guestSlot = null;
    newMatchDraft.guestName = '';
    newMatchDraft.guestError = '';
    updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="confirm-guest"]')) {
    syncNewMatchDraftFromDom();
    const slot = e.target.closest('[data-action="confirm-guest"]').dataset.guestSlot;
    const trimmed = newMatchDraft.guestName.trim();
    if (!trimmed) {
      newMatchDraft.guestError = 'Podaj nazwę gościa';
      updateNewMatchPlayersDOM();
      return;
    }
    if (isNameTaken(trimmed)) {
      newMatchDraft.guestError = 'Ta nazwa jest już zajęta';
      updateNewMatchPlayersDOM();
      return;
    }
    const tempId = nextTempGuestId(newMatchDraft);
    if (!newMatchDraft.pendingGuests) newMatchDraft.pendingGuests = {};
    newMatchDraft.pendingGuests[slot] = trimmed;
    newMatchDraft.slots[slot] = tempId;
    newMatchDraft.guestSlot = null;
    newMatchDraft.guestName = '';
    newMatchDraft.guestError = '';
    updateNewMatchPlayersDOM();
    return;
  }

  if (e.target.closest('[data-action="open-guest-slot"]')) {
    const slot = e.target.closest('[data-action="open-guest-slot"]').dataset.slot;
    newMatchDraft.guestSlot = slot;
    newMatchDraft.guestName = '';
    newMatchDraft.guestError = '';
    updateNewMatchPlayersDOM();
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
});

avatarInput.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) return;
  try {
    userSession.avatarUrl = await resizeAvatarFile(file);
    saveState();
    render();
  } catch (_) {
    alert('Nie udało się dodać zdjęcia. Spróbuj innego pliku.');
  }
});

fab.addEventListener('click', () => {
  if (currentTab === 'matches') {
    newMatchDraft = newMatchDefault();
    newMatchOpen = true;
    render();
  } else if (currentTab === 'players') {
    alert('Dodawanie zawodnika z kontem — w kolejnym kroku');
  }
});

content.addEventListener('change', e => {
  const teamSel = e.target.closest('[data-new-match-team]');
  if (teamSel && newMatchDraft) {
    syncNewMatchDraftFromDom();
    const side = teamSel.dataset.newMatchTeam;
    const val = parseInt(teamSel.value, 10);
    if (val) {
      const team = getTeam(val);
      const busyIds = getDraftBusyPlayerIds(newMatchDraft);
      if (team && isTeamBusy(team, busyIds)) {
        const busyPlayer = team.playerIds.find(id => busyIds.has(id));
        alert(`${getPlayerName(busyPlayer)} jest w grze — nie można wybrać drużyny „${team.name}”`);
        teamSel.value = '';
        if (side === 'A') {
          newMatchDraft.teamIdA = null;
          newMatchDraft.slots.a1 = null;
          newMatchDraft.slots.a2 = null;
        } else {
          newMatchDraft.teamIdB = null;
          newMatchDraft.slots.b1 = null;
          newMatchDraft.slots.b2 = null;
        }
        updateNewMatchPlayersDOM();
        return;
      }
      applyExistingTeamToDraft(newMatchDraft, side, val);
      enforceOtherSideAfterTeamPick(newMatchDraft, side);
    } else if (side === 'A') {
      newMatchDraft.teamIdA = null;
      newMatchDraft.slots.a1 = null;
      newMatchDraft.slots.a2 = null;
    } else {
      newMatchDraft.teamIdB = null;
      newMatchDraft.slots.b1 = null;
      newMatchDraft.slots.b2 = null;
    }
    updateNewMatchPlayersDOM();
    return;
  }
  const slotSel = e.target.closest('[data-new-match-slot]');
  if (slotSel && newMatchDraft) {
    syncNewMatchDraftFromDom();
    const slot = slotSel.dataset.newMatchSlot;
    const val = slotSel.value;
    if (val === '__guest__') {
      newMatchDraft.guestSlot = slot;
      newMatchDraft.guestName = '';
      newMatchDraft.guestError = '';
    } else if (val) {
      newMatchDraft.slots[slot] = parseInt(val, 10) || val;
      if (newMatchDraft.pendingGuests) delete newMatchDraft.pendingGuests[slot];
      newMatchDraft.guestSlot = null;
      newMatchDraft.guestError = '';
    } else {
      newMatchDraft.slots[slot] = null;
    }
    updateNewMatchPlayersDOM();
    return;
  }
});

content.addEventListener('input', e => {
  if (e.target.id === 'display-name') {
    const btn = document.getElementById('save-name-btn');
    const player = getCurrentPlayer();
    if (btn && player) btn.hidden = e.target.value.trim() === player.displayName.trim();
    return;
  }
  if ((e.target.id === 'set-score-a' || e.target.id === 'set-score-b') && openMatchId) {
    const m = matches.find(x => x.id === openMatchId);
    if (!m?.liveSet) return;
    const a = parseInt(document.getElementById('set-score-a')?.value, 10);
    const b = parseInt(document.getElementById('set-score-b')?.value, 10);
    if (!isNaN(a) && a >= 0) m.liveSet.scoreA = a;
    if (!isNaN(b) && b >= 0) m.liveSet.scoreB = b;
    const row = m.sets?.find(s => s.n === m.liveSet.n);
    if (row) {
      row.scoreA = m.liveSet.scoreA;
      row.scoreB = m.liveSet.scoreB;
    }
    saveState();
  }
});

content.addEventListener('pointerdown', e => {
  const card = e.target.closest('.match-card--clickable[data-match-id]');
  if (card && !openMatchId && !e.target.closest('.ctx-actions')) {
    const id = parseInt(card.dataset.matchId, 10);
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      suppressNextClick = true;
      ctxTarget = { type: 'match', id };
      render();
    }, 550);
  }
  const setRow = e.target.closest('.set-row[data-set-n]');
  if (setRow && openMatchId && !e.target.closest('.ctx-actions')) {
    const m = matches.find(x => x.id === openMatchId);
    const setN = parseInt(setRow.dataset.setN, 10);
    const set = m?.sets?.find(s => s.n === setN);
    const canCtx = m && (m.status === 'active' || reopenMatchEdit);
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

content.addEventListener('pointerup', () => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
});
content.addEventListener('pointercancel', () => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
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
            if (t) t.avatarUrl = url;
          }
          saveState();
          render();
        }
        matchTeamAvatarSide = null;
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

loadState();
ensureLiveMatchTickers();
render();
