const APP_NAME = 'Badminton App';
const STORAGE_KEY = 'badminton-app-state';
const STATE_VERSION = 2;
const AVATAR_MAX_PX = 256;

const DEFAULT_PLAYERS = [
  { id: 1, displayName: 'Krzysiek' },
  { id: 2, displayName: 'Julia' },
  { id: 3, displayName: 'Michał' },
  { id: 4, displayName: 'Ola' },
  { id: 5, displayName: 'Maciek' },
];

const DEFAULT_MATCHES = [
  { id: 1, date: '2026-04-14', teamA: [1, 2], teamB: [3, 4], scoreA: 1, scoreB: 1, result: 'draw', winnerId: null },
  { id: 2, date: '2026-06-17', teamA: [1], teamB: [5], scoreA: 3, scoreB: 2, result: 'win', winnerId: 1 },
  { id: 3, date: '2026-06-17', teamA: [3], teamB: [4], scoreA: 3, scoreB: 0, result: 'win', winnerId: 3 },
  { id: 4, date: '2026-06-05', teamA: [2], teamB: [1], scoreA: 2, scoreB: 3, result: 'win', winnerId: 1 },
  { id: 5, date: '2026-04-06', teamA: [1], teamB: [5], scoreA: 2, scoreB: 3, result: 'win', winnerId: 5 },
];

const SUBTITLES = {
  stats: 'Statystyki',
  matches: 'Mecze',
  players: 'Zawodnicy',
  profile: 'Profil',
  'stats-global': 'Statystyki globalne',
  'stats-players': 'Statystyki zawodników',
  'stats-h2h': 'Konfrontacja',
};

let players = [];
let matches = [];
let userSession = { playerId: 1, avatarUrl: null, notifications: false, loggedIn: true };

let currentTab = 'stats';
let statsSubView = null;
let profileOpen = false;

const content = document.getElementById('content');
const pageSubtitle = document.getElementById('page-subtitle');
const headerAvatar = document.getElementById('header-avatar');
const profileBtn = document.getElementById('profile-btn');
const avatarInput = document.getElementById('avatar-input');
const fab = document.getElementById('fab');

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      players = data.players || structuredClone(DEFAULT_PLAYERS);
      matches = data.matches || structuredClone(DEFAULT_MATCHES);
      userSession = { ...userSession, ...data.userSession };
      if (!data.stateVersion || data.stateVersion < STATE_VERSION) {
        userSession.avatarUrl = null;
        saveState();
      }
      return;
    }
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
  }
  players = structuredClone(DEFAULT_PLAYERS);
  matches = structuredClone(DEFAULT_MATCHES);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    stateVersion: STATE_VERSION,
    players,
    matches,
    userSession,
  }));
}

function getPlayer(id) {
  return players.find(p => p.id === id);
}

function getPlayerName(id) {
  return getPlayer(id)?.displayName ?? '?';
}

function getCurrentPlayer() {
  return getPlayer(userSession.playerId);
}

function renamePlayer(id, newName) {
  const trimmed = newName.trim();
  if (!trimmed) return false;
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

function formatTeam(ids) {
  return ids.map(getPlayerName).join(' & ');
}

function avatarClass(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `avatar--${Math.abs(hash) % 6}`;
}

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

function renderAvatarHtml(name, avatarUrl, sizeClass) {
  if (avatarUrl) {
    return `<span class="avatar-frame ${sizeClass}"><img class="avatar-frame__img" src="${avatarUrl}" alt=""></span>`;
  }
  return `<span class="${sizeClass} ${avatarClass(name)}">${initials(name)}</span>`;
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

function renderScore(scoreA, scoreB) {
  const draw = scoreA === scoreB;
  const clsA = draw ? 'match-card__score-part--draw' : (scoreA > scoreB ? 'match-card__score-part--win' : 'match-card__score-part--lose');
  const clsB = draw ? 'match-card__score-part--draw' : (scoreB > scoreA ? 'match-card__score-part--win' : 'match-card__score-part--lose');
  return `<span class="match-card__score-part ${clsA}">${scoreA}</span><span class="match-card__score-sep"> : </span><span class="match-card__score-part ${clsB}">${scoreB}</span>`;
}

function renderMatchCard(m) {
  const resultClass = m.result === 'draw' ? 'match-card__result--draw' : 'match-card__result--win';
  const resultText = m.result === 'draw'
    ? 'Remis'
    : `<span class="match-card__trophy">🏆</span> ${getPlayerName(m.winnerId)}`;

  return `
    <article class="match-card">
      <div class="match-card__date">${formatDate(m.date)}</div>
      <div class="match-card__body">
        <div class="match-card__side"><div class="match-card__names">${formatTeam(m.teamA)}</div></div>
        <div class="match-card__score-col"><div class="match-card__score">${renderScore(m.scoreA, m.scoreB)}</div></div>
        <div class="match-card__side" style="text-align:right"><div class="match-card__names">${formatTeam(m.teamB)}</div></div>
      </div>
      <div class="match-card__result ${resultClass}">${resultText}</div>
    </article>
  `;
}

function renderH2HCard(idA, idB, winsA, winsB) {
  return `
    <div class="match-card">
      <div class="match-card__body">
        <div class="match-card__side"><div class="match-card__names">${getPlayerName(idA)}</div></div>
        <div class="match-card__score-col"><div class="match-card__score">${renderScore(winsA, winsB)}</div></div>
        <div class="match-card__side" style="text-align:right"><div class="match-card__names">${getPlayerName(idB)}</div></div>
      </div>
    </div>
  `;
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

function renderMatches() {
  return `
    <p class="section-label">${matches.length} meczów</p>
    <div class="match-list">${matches.map(renderMatchCard).join('')}</div>
  `;
}

function renderPlayers() {
  const wins = computeWins();
  return `
    <p class="section-label">${players.length} zawodników</p>
    <div class="player-grid">
      ${players.map(p => `
        <article class="player-card${p.id === userSession.playerId ? ' player-card--me' : ''}">
          ${renderAvatarHtml(p.displayName, p.id === userSession.playerId ? userSession.avatarUrl : null, 'player-card__avatar')}
          <div class="player-card__name">${p.displayName}</div>
          <div class="player-card__record"><span>${wins[p.id] || 0}</span> wygranych</div>
        </article>
      `).join('')}
    </div>
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
        <h3 class="profile-card__title">Zdjęcie profilowe</h3>
        <p class="profile-card__desc">Kliknij ikonę aparatu, aby zmienić avatar.</p>
        <div class="profile-card__avatar-row">
          <button class="profile-panel__avatar-wrap" data-action="change-avatar" type="button">
            ${renderAvatarHtml(player.displayName, userSession.avatarUrl, 'avatar-lg')}
            <span class="profile-panel__camera">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </span>
          </button>
        </div>
        ${userSession.avatarUrl ? `
          <button class="btn btn--outline btn--full profile-card__remove-photo" data-action="remove-avatar" type="button">
            Usuń zdjęcie
          </button>
        ` : ''}
      </div>

      <div class="profile-card">
        <label class="profile-card__label" for="display-name">Imię wyświetlane</label>
        <input class="profile-card__input" id="display-name" type="text" value="${player.displayName}" maxlength="30" autocomplete="name">
        <button class="btn btn--primary btn--full" data-action="save-name" type="button">
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
    content.innerHTML = renderMatches();
    setSubtitle('matches');
  } else {
    content.innerHTML = renderPlayers();
    setSubtitle('players');
  }

  fab.classList.toggle('fab--visible', currentTab === 'matches' || currentTab === 'players');
  updateHeaderAvatar();
}

profileBtn.addEventListener('click', () => {
  profileOpen = !profileOpen;
  render();
});

document.querySelectorAll('.bottom-nav__item').forEach(btn => {
  btn.addEventListener('click', () => {
    profileOpen = false;
    currentTab = btn.dataset.tab;
    statsSubView = null;
    document.querySelectorAll('.bottom-nav__item').forEach(b => {
      b.classList.toggle('bottom-nav__item--active', b === btn);
    });
    render();
  });
});

content.addEventListener('click', e => {
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
  const label = currentTab === 'matches' ? 'Dodawanie meczu' : 'Dodawanie zawodnika';
  alert(`${label} — w kolejnym kroku`);
});

loadState();
render();
