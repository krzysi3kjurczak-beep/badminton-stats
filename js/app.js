const PLAYERS = [
  { id: 1, name: 'Krzysiek' },
  { id: 2, name: 'Julia' },
  { id: 3, name: 'Michał' },
  { id: 4, name: 'Ola' },
  { id: 5, name: 'Maciek' },
];

const MATCHES = [
  {
    id: 1,
    date: '2026-04-14',
    teamA: ['Krzysiek', 'Julia'],
    teamB: ['Michał', 'Ola'],
    scoreA: 1,
    scoreB: 1,
    result: 'draw',
  },
  {
    id: 2,
    date: '2026-06-17',
    teamA: ['Krzysiek'],
    teamB: ['Maciek'],
    scoreA: 3,
    scoreB: 2,
    result: 'win',
    winner: 'Krzysiek',
  },
  {
    id: 3,
    date: '2026-06-17',
    teamA: ['Michał'],
    teamB: ['Ola'],
    scoreA: 3,
    scoreB: 0,
    result: 'win',
    winner: 'Michał',
  },
  {
    id: 4,
    date: '2026-06-05',
    teamA: ['Julia'],
    teamB: ['Krzysiek'],
    scoreA: 2,
    scoreB: 3,
    result: 'win',
    winner: 'Krzysiek',
  },
  {
    id: 5,
    date: '2026-04-06',
    teamA: ['Krzysiek'],
    teamB: ['Maciek'],
    scoreA: 2,
    scoreB: 3,
    result: 'win',
    winner: 'Maciek',
  },
];

const TITLES = {
  stats: 'Statystyki',
  matches: 'Mecze',
  players: 'Zawodnicy',
  'stats-global': 'Statystyki globalne',
  'stats-players': 'Statystyki zawodników',
  'stats-h2h': 'Konfrontacja zawodników',
};

let currentTab = 'stats';
let statsSubView = null;

const content = document.getElementById('content');
const pageTitle = document.getElementById('page-title');
const fab = document.getElementById('fab');

function formatDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTeam(names) {
  return names.join(' & ');
}

function avatarClass(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `avatar--${Math.abs(hash) % 6}`;
}

function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

function computeWins() {
  const wins = {};
  PLAYERS.forEach(p => { wins[p.name] = 0; });

  MATCHES.forEach(m => {
    if (m.result === 'win' && m.winner) {
      wins[m.winner] = (wins[m.winner] || 0) + 1;
    }
  });
  return wins;
}

function renderStatsMenu() {
  return `
    <div class="menu-list">
      <button class="menu-card" data-stats-view="global" type="button">
        <div class="menu-card__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        </div>
        <div class="menu-card__text">
          <h2>Statystyki globalne</h2>
          <p>Podsumowanie wszystkich meczów</p>
        </div>
        <svg class="menu-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button class="menu-card" data-stats-view="players" type="button">
        <div class="menu-card__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><circle cx="12" cy="8" r="3"/></svg>
        </div>
        <div class="menu-card__text">
          <h2>Statystyki zawodników</h2>
          <p>Ranking i bilans każdego gracza</p>
        </div>
        <svg class="menu-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <button class="menu-card" data-stats-view="h2h" type="button">
        <div class="menu-card__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 12h8M12 8v8"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/></svg>
        </div>
        <div class="menu-card__text">
          <h2>Konfrontacja zawodników</h2>
          <p>Bezpośrednie pojedynki head-to-head</p>
        </div>
        <svg class="menu-card__chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </div>
  `;
}

function renderStatsGlobal() {
  const total = MATCHES.length;
  const wins = MATCHES.filter(m => m.result === 'win').length;
  const draws = MATCHES.filter(m => m.result === 'draw').length;

  return `
    <div class="sub-screen">
      <div class="back-bar">
        <button class="back-btn" data-action="stats-back" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
          Statystyki
        </button>
      </div>
      <div class="stats-summary">
        <div class="stat-box">
          <div class="stat-box__value">${total}</div>
          <div class="stat-box__label">Meczów</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__value">${wins}</div>
          <div class="stat-box__label">Rozstrzygniętych</div>
        </div>
        <div class="stat-box">
          <div class="stat-box__value">${draws}</div>
          <div class="stat-box__label">Remisów</div>
        </div>
      </div>
      <p class="section-label">Ostatnie mecze</p>
      <div class="match-list">
        ${MATCHES.slice(0, 3).map(renderMatchCard).join('')}
      </div>
    </div>
  `;
}

function renderStatsPlayers() {
  const wins = computeWins();
  const sorted = [...PLAYERS].sort((a, b) => (wins[b.name] || 0) - (wins[a.name] || 0));

  return `
    <div class="sub-screen">
      <div class="back-bar">
        <button class="back-btn" data-action="stats-back" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
          Statystyki
        </button>
      </div>
      <p class="section-label">Ranking zwycięstw</p>
      <div class="leaderboard">
        ${sorted.map((p, i) => `
          <div class="leaderboard__row">
            <span class="leaderboard__rank ${i === 0 ? 'leaderboard__rank--1' : ''}">${i + 1}</span>
            <span class="leaderboard__name">${p.name}</span>
            <span class="leaderboard__wins"><strong>${wins[p.name] || 0}</strong> wygr.</span>
          </div>
        `).join('')}
      </div>
      <p class="placeholder-note">Pełne statystyki (sety, % wygranych) — w kolejnym kroku</p>
    </div>
  `;
}

function renderStatsH2H() {
  return `
    <div class="sub-screen">
      <div class="back-bar">
        <button class="back-btn" data-action="stats-back" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
          Statystyki
        </button>
      </div>
      <p class="section-label">Przykładowe konfrontacje</p>
      <div class="match-list">
        ${renderH2HCard('Krzysiek', 'Maciek', 2, 1)}
        ${renderH2HCard('Michał', 'Ola', 1, 0)}
        ${renderH2HCard('Julia', 'Krzysiek', 0, 1)}
      </div>
      <p class="placeholder-note">Wybór pary zawodników — w kolejnym kroku</p>
    </div>
  `;
}

function renderH2HCard(a, b, winsA, winsB) {
  return `
    <div class="match-card">
      <div class="match-card__body">
        <div class="match-card__side">
          <div class="match-card__names">${a}</div>
        </div>
        <div class="match-card__score-col">
          <div class="match-card__score">${winsA}<span class="match-card__score-sep"> : </span>${winsB}</div>
        </div>
        <div class="match-card__side" style="text-align:right">
          <div class="match-card__names">${b}</div>
        </div>
      </div>
    </div>
  `;
}

function renderMatchCard(m) {
  const resultClass = m.result === 'draw' ? 'match-card__result--draw' : 'match-card__result--win';
  const resultText = m.result === 'draw'
    ? 'Remis'
    : `<span class="match-card__trophy">🏆</span> ${m.winner}`;

  return `
    <article class="match-card">
      <div class="match-card__date">${formatDate(m.date)}</div>
      <div class="match-card__body">
        <div class="match-card__side">
          <div class="match-card__names">${formatTeam(m.teamA)}</div>
        </div>
        <div class="match-card__score-col">
          <div class="match-card__score">${m.scoreA}<span class="match-card__score-sep"> : </span>${m.scoreB}</div>
        </div>
        <div class="match-card__side" style="text-align:right">
          <div class="match-card__names">${formatTeam(m.teamB)}</div>
        </div>
      </div>
      <div class="match-card__result ${resultClass}">${resultText}</div>
    </article>
  `;
}

function renderMatches() {
  return `
    <p class="section-label">${MATCHES.length} meczów</p>
    <div class="match-list">
      ${MATCHES.map(renderMatchCard).join('')}
    </div>
  `;
}

function renderPlayers() {
  const wins = computeWins();

  return `
    <p class="section-label">${PLAYERS.length} zawodników</p>
    <div class="player-grid">
      ${PLAYERS.map(p => `
        <article class="player-card">
          <div class="player-card__avatar ${avatarClass(p.name)}">${initials(p.name)}</div>
          <div class="player-card__name">${p.name}</div>
          <div class="player-card__record"><span>${wins[p.name] || 0}</span> wygranych</div>
        </article>
      `).join('')}
    </div>
  `;
}

function render() {
  if (currentTab === 'stats') {
    if (statsSubView === 'global') {
      content.innerHTML = renderStatsGlobal();
      pageTitle.textContent = TITLES['stats-global'];
    } else if (statsSubView === 'players') {
      content.innerHTML = renderStatsPlayers();
      pageTitle.textContent = TITLES['stats-players'];
    } else if (statsSubView === 'h2h') {
      content.innerHTML = renderStatsH2H();
      pageTitle.textContent = TITLES['stats-h2h'];
    } else {
      content.innerHTML = renderStatsMenu();
      pageTitle.textContent = TITLES.stats;
    }
  } else if (currentTab === 'matches') {
    content.innerHTML = renderMatches();
    pageTitle.textContent = TITLES.matches;
  } else {
    content.innerHTML = renderPlayers();
    pageTitle.textContent = TITLES.players;
  }

  fab.classList.toggle('fab--visible', currentTab === 'matches' || currentTab === 'players');
}

document.querySelectorAll('.bottom-nav__item').forEach(btn => {
  btn.addEventListener('click', () => {
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
  }
});

fab.addEventListener('click', () => {
  const label = currentTab === 'matches' ? 'Dodawanie meczu' : 'Dodawanie zawodnika';
  alert(`${label} — w kolejnym kroku`);
});

render();
