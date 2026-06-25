# Handoff — stan projektu (czerwiec 2026)

## Repo i deploy
- GitHub: `krzysi3kjurczak-beep/badminton-stats`
- Pages: https://krzysi3kjurczak-beep.github.io/badminton-stats/
- **Cache PWA:** `sw.js` → `badminton-stats-v134` (+ query `?v=134` w `index.html`)
- **Ostatni push:** `main` @ `22f4b30` — live sync, widok seta, edycja/usuwanie, pauza seta

### Ostatnie zmiany (v121–v133)
| Wersja | Temat |
|--------|--------|
| v121–v123 | Czas meczu od 1. seta; sub-zegary rozgrzewki/przerwy; statusy „W trakcie” / „Przerwa” |
| v124–v126 | Duże punkty live (`updateLiveScoresDOM`); pionowy układ kafelków set-play |
| v125–v127 | Sync punktów seta multi-device (`immediatePush`, merge `liveSet`, `recalcMatchScores` po scrub) |
| v128–v131 | Merge czasu = **max elapsed** (nie niższy); status zegara z nowszego merge (fix pauzy seta) |
| v129–v130 | Edycja archiwalnego seta: Zapisz tylko po zmianie; zapisany czas seta nad polami |
| v130–v133 | Klik w zakończony set → **panel podglądu**; dyskretne Edytuj / Usuń (uczestnicy + admin) |
| v134 | Avatary: zawodnik = koło, drużyna z logo = kwadrat zaokrąglony; zakładka Zawodnicy i drużyny + statystyki drużyn |

---

## Przechowywanie danych
- **Lokalnie:** `localStorage` → klucz `badminton-app-state`
- **Chmura (opcjonalnie):** Supabase
  - `app_state` — profil (`userSession`: powiadomienia, `playerId`; avatar w `players`)
  - `league_state` — **wspólna liga** (`players`, `teams`, `matches`, `tombstones`) — `league_id = default`
- **Konfiguracja:** `js/config.js` + `docs/SUPABASE-SETUP.md` + `supabase/league_schema.sql`
- **`STATE_VERSION = 15`** — m.in. reset zegara meczu przed 1. setem (`firstSetStartedAt`, `warmupStartedAt`)
- Zawodnik: `{ id, displayName, isGuest?, authUserId?, avatarUrl?, updatedAt? }`
- Sync: login → pull/push profilu + ligi; `saveState()` → debounced push; **realtime** na `league_state`; podczas live dodatkowo `pushLeagueQuiet` co 4 s

### Architektura sync (ważne dla agenta)
- Merge meczów: `mergeMatchByUpdatedAt()` — wygrywa `updatedAt`; osobne reguły dla anulowania live seta / serve pickera / `openProtected` (otwarty widok seta)
- Merge punktów w tym samym secie: `mergeActiveLiveSetScores()` — nowszy czas lub wyższa suma punktów
- Merge czasu: `mergeMatchTimings()` — **max** elapsed (mecz, set, rozgrzewka, przerwa); **status** (`running`/`paused`) z wyniku merge, nie z „running wygrywa”
- Po merge: `scrubGhostLiveSet()` → `recalcMatchScores()` z zakończonych setów (wynik meczu 1:0 itd.)
- Push: `flushPush()` najpierw `mergeLeagueFromCloud()`, potem push — unikać nadpisywania świeżych lokalnych zmian

---

## Model danych (skrót)
```js
{
  stateVersion: 15,
  players: [{ id, displayName, isGuest?, authUserId?, avatarUrl?, updatedAt? }],
  teams: [{ id, name, avatarUrl?, playerIds: [id1, id2], updatedAt? }],
  matches: [{
    id, date, teamA[], teamB[], scoreA, scoreB,   // scoreA/B = liczba wygranych setów
    status: 'active' | 'finished',
    result, winnerId, sets[], updatedAt?,
    matchClock?: { elapsedSec, status: idle|running|stopped, lastTickAt, startedAt },
    matchTiming?: { restSec, breakPeriods[], phase, phaseStartedAt },
    firstSetStartedAt?, warmupStartedAt?, liveSet?, serveDuel?,
    teamMeta?: { A: { name?, avatarUrl?, teamId? }, B: {...} },
    tempGuests?: { [tempId]: 'Imię' },
  }],
  tombstones: { matches: {}, players: {}, teams: {} },
  userSession: { playerId, avatarUrl, notifications, loggedIn, authEmail? },
}
```

**Set:** `{ n, scoreA, scoreB, status: 'live'|'finished', durationSec?, firstServer? }`  
**liveSet:** `{ n, scoreA, scoreB, elapsedSec, status: idle|running|paused|serve_pending, lastTickAt, firstServer?, serveSec? }`

---

## Uprawnienia
| Akcja | Kto |
|--------|-----|
| Podgląd meczów / live | wszyscy (zalogowani i nie) |
| Nowy mecz | zalogowany z kontem Supabase |
| Edycja/usuwanie meczu, setów, live | uczestnik meczu **lub** admin |
| Admin | `krzysi3k.jurczak@gmail.com`, `krzysi3k.jurczak@mail.com` |

- `canEditMatch(m)` — uczestnik lub admin (gdy `matchPermissionsActive()`)
- `canEditSetScores(m)` — `canEditMatch` **oraz** (`m.status === 'active'` **lub** `reopenMatchEdit`)
- Zakończony mecz bez trybu edycji: sety tylko podgląd; edycja setów po „Edytuj mecz”

---

## Kluczowa logika (`js/app.js`)

### Czas
- Główny zegar meczu startuje przy **1. secie** (`firstSetStartedAt`); przed tym sub-zegar **rozgrzewki** (niebieski)
- Między setami sub-zegar **przerwy** (żółty); główny zegar meczu leci dalej
- Set live: własny zegar w overlay; **pauza** tylko w widoku seta (`pauseLiveSet` → status `paused`, badge „Przerwa”)
- Anulowanie jedynego seta → `resetMatchToWarmup()`

### Set na żywo
- Start: serve picker (1. set) lub `beginLiveSet` (kolejne); overlay `renderSetPlayOverlay`
- Punkty: duże pola + `+`; `adjustLiveScore` → `immediatePush`; `updateLiveScoresDOM` bez pełnego renderu
- Auto-zakończenie przy poprawnym wyniku badmintonowym (`tryAutoFinishLiveSetIfComplete`)
- Układ kafelków: avatar + nazwa wyśrodkowane, lotka po prawej od avatara, pod spodem pole punktów

### Zakończony set — podgląd i edycja
- **Klik w set** (active lub finished) → `setDetailN` → `renderSetDetailOverlay` (wynik, avatary, czas seta)
- **Aktywny mecz** lub **edycja zakończonego** (`reopenMatchEdit`): dyskretne **Edytuj wynik** (lewo) / **Usuń set** (prawo, czerwony)
- Edytuj → `editSetN` + `renderArchiveSetOverlay`; Wróć → z powrotem do podglądu seta (`close-set-edit`)
- Zapisz zmiany: aktywny tylko gdy wynik ≠ oryginał; zapisany czas seta wygaszony nad polami (nieedytowalny)
- Usuń: `showAppConfirm` (modal aplikacji), nie `alert`

### Mecz — pozostałe
- Fazy UI: `getMatchPhase()` → `live` | `break` | `warmup`; badge zielony / żółty
- Deble: `teamMeta`, pickery drużyn/zawodników, edycja avatara drużyny w meczu
- Long-press: ctx edytuj/usuń (sety w trybie `canEditSetScores`)
- Statystyki w panelu info: czas meczu, gry, odpoczynku, średnie

---

## Pliki
| Plik | Rola |
|------|------|
| `js/app.js` | cała logika UI + stan |
| `js/cloud.js` | Supabase auth, push/pull, realtime |
| `js/config.js` | URL + anon key (puste = tylko lokalnie) |
| `css/styles.css` | style, mobile-first, landscape |
| `sw.js` | service worker, cache **v134** |
| `index.html`, `manifest.json` | PWA, ikony |
| `supabase/*.sql` | schema profilu + ligi + `delete_account.sql` |
| `docs/SUPABASE-SETUP.md`, `docs/GOOGLE-LOGIN.md` | instrukcje deploy chmury |
| `AGENTS.md` | skrót dla agenta |

---

## Zmienne UI (pamięć + `sessionStorage`)
`newMatchOpen`, `newMatchDraft`, `setPlayOpen`, `editSetN`, `setDetailN`, `reopenMatchEdit`, `ctxTarget`, `openMatchId`, `matchInfoOpen`, `servePickerPhase`, `servePickerMatchId`

- `reopenMatchEdit` + `openMatchId` w `badminton-ui-state` (odświeżenie w edycji meczu)
- `servePickerMatchId` w `badminton-serve-picker-match`

---

## Git (Windows)
```powershell
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" -c user.name="krzysi3kjurczak-beep" -c user.email="krzysi3kjurczak-beep@users.noreply.github.com" commit -m "..."
& "C:\Program Files\Git\bin\git.exe" push
```

---

## Backlog / znane ograniczenia
- Bez `config.js` — tylko lokalnie; uprawnienia meczów wyłączone
- Zaproszenia gości (link claim + Web Share) — Faza 2
- Statystyki H2H — część danych przykładowa
- Powiadomienia — tylko preferencja w profilu (brak push)
- Wiele lig / `league_members` — później; teraz jedna liga `default`
- Normalizacja tabel zamiast JSON w `league_state` — później

## Liga — ustalenia (MVP)
1. Jedna wspólna liga (`league_state`, `league_id = default`)
2. Realtime + tombstones dla usunięć
3. Nowy mecz: każdy zalogowany z kontem
4. Edycja: uczestnik + admin; podgląd live: wszyscy

## Po większych zmianach (checklist agenta)
1. Podbić `CACHE` w `sw.js` i `?v=` + `APP_CACHE_VER` w `index.html`
2. Podbić `STATE_VERSION` + migracja w `applyLeagueState` / `loadState` jeśli zmiana modelu
3. Zaktualizować ten plik (`docs/HANDOFF.md`)
