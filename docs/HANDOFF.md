# Handoff — Badminton App (lipiec 2026)

**Dla nowego agenta:** przeczytaj ten plik **w całości** przed zmianami. To jedyne źródło prawdy o projekcie. Po większych zmianach **zaktualizuj ten dokument** i podbij cache (checklist na końcu). Skrót: `AGENTS.md`.

---

## Szybki start

| Co | Gdzie |
|----|--------|
| **Live (GitHub Pages)** | https://krzysi3kjurczak-beep.github.io/badminton-stats/ |
| **Repo** | `krzysi3kjurczak-beep/badminton-stats` |
| **Gałąź** | `main` |
| **Ostatni push** | v273 — konfrontacja zawodników/drużyn |
| **Cache PWA** | `sw.js` → `badminton-stats-v273`; `index.html` → `APP_CACHE_VER = '273'` |
| **Skrypty** | `js/app.js?v=273`, `js/cloud.js?v=273`, `js/push.js?v=273`, `css/styles.css?v=273` |
| **Wersja danych** | `STATE_VERSION = 26` w `js/app.js` |
| **Motyw** | Mobile-first PWA, ciemny UI, akcent `#3dd68c` |
| **Język UI** | Polski |

Lokalny dev: `node serve.js` → otwórz IP:3456 na telefonie (ta sama sieć Wi‑Fi).

---

## Architektura (jednym zdaniem)

Jednoplikowa aplikacja **HTML + CSS + vanilla JS** (bez bundlera): stan w `localStorage`, opcjonalna synchronizacja **Supabase** (profil + wspólna liga), render przez `innerHTML` + delegacja zdarzeń na `#content`.

```
index.html
  ├── css/styles.css
  ├── js/config.js          (URL + anon key Supabase — gitignored w produkcji użytkownika)
  ├── js/cloud.js           (auth, push/pull, realtime league_state)
  └── js/app.js             (~17k linii: UI, mecze live, statystyki, planowanie, powiadomienia, merge)
  ├── js/push.js            (Web Push: rejestracja subskrypcji, lokalny push)
sw.js                       (service worker, precache)
manifest.json               (PWA)
supabase/*.sql              (schema bazy)
docs/                       (ten plik + setup Supabase/Google)
```

**Brak frameworka, brak testów automatycznych, brak TypeScript.**

---

## Przechowywanie danych

### Lokalnie (`localStorage`)

| Klucz | Zawartość |
|-------|-----------|
| `badminton-app-state` | Cały stan aplikacji (liga + sesja) |
| `badminton-ui-state` | UI: zakładka, otwarty mecz, profil, `reopenMatchEdit` |
| `badminton-sync-meta` | Metadane syncu chmurowego (legacy); od v299 per konto: `badminton-sync-meta:<user_id>` |
| `badminton-biometric-store` | WebAuthn credential IDs per user |
| `badminton-install-dismiss` | Ukrycie banera instalacji PWA |

### `sessionStorage`

| Klucz | Zawartość |
|-------|-----------|
| `badminton-pending-claim` | `{ playerId, token }` — deep link przejęcia gościa |
| `badminton-pending-join` | `{ token }` — deep link zaproszenia do ligi |
| `badminton-pending-plan` | `{ token }` — deep link planowania treningu (`?plan=`) |
| `badminton-app-role` | `'spectator'` \| `'player'` — wybór roli z ekranu powitalnego (tylko `sessionStorage`) |
| `badminton-serve-picker-match` | ID meczu z aktywnym serve pickerem |
| `badminton-referee-session` | `{ matchId, joinedAt }` — aktywna sesja trybu sędziego (link `?referee=` lub po zatwierdzeniu prośby) |
| `badminton-pending-referee` | ID meczu z URL `?referee=` przed wejściem w sesję |

### Supabase (gdy `js/config.js` skonfigurowany)

| Tabela | Zawartość |
|--------|-----------|
| `app_state` | `user_id` → JSON profilu (`userSession`, `pinHash`, powiadomienia) |
| `league_state` | `league_id = 'default'` → JSON ligi (`players`, `teams`, `matches`, `plannedSessions`, **`planNotifications`**, **`pushSubscriptions`**, `tombstones`, `signupInvites`, `leagueResetAt`) |

**Realtime:** subskrypcja zmian `league_state` → `applyLeagueState` z `merge: false` gdy `cloud.leagueResetAt > local`.

**Usuwanie (v21+):** `recordLeagueTombstone()` + filtrowanie przed merge — tombstone zawsze wygrywa. Push ligi przez `exportLeagueState()`.

**Wyzeruj ligę (v22+):** zostają tylko zawodnicy z `authUserId`; `leagueResetAt` wymusza pełne nadpisanie u wszystkich klientów (bez merge ze starym localStorage). ~~Admin v229: jednorazowy `adminRepairLeagueOnce()`~~ — **usunięte v259** (kasowało ligę przy pierwszym logowaniu admina na nowym urządzeniu). SQL awaryjny: `supabase/league_reset_keep_accounts.sql`.

**Bez `config.js`:** tylko lokalnie; `matchPermissionsActive()` zwraca `false` → edycja meczów dla wszystkich.

Instrukcje setup: `docs/SUPABASE-SETUP.md`, `docs/GOOGLE-LOGIN.md`.

---

## Model danych

### Zawodnik (`players[]`)

```js
{
  id: number,                    // kolejne int, unikalne
  displayName: string,           // unikalne case-insensitive w lidze
  isGuest?: boolean,             // gość bez konta
  authUserId?: string,           // UUID Supabase po rejestracji
  avatarUrl?: string,            // data URL lub URL
  createdByPlayerId?: number,  // kto dodał gościa
  pendingClaim?: {               // zaproszenie gościa → pełne konto
    token: string,
    createdAt: number,
    email?: string,              // opcjonalne wiązanie (rzadko używane)
    lastSharedAt?: number,
    lastSharedVia?: string,
  },
  updatedAt?: number,
}
```

### Drużyna (`teams[]`)

```js
{ id, name, avatarUrl?, playerIds: [id1, id2], updatedAt? }
```

### Mecz (`matches[]`)

```js
{
  id, date, teamA: [playerId...], teamB: [...],
  scoreA, scoreB,              // liczba WYGRANYCH setów (nie punkty!)
  status: 'active' | 'finished',
  result?: 'win' | 'draw',
  winnerId?: number,
  sets: SetRow[],
  updatedAt?, createdAt?,
  matchClock?: { elapsedSec, status: 'idle'|'running'|'stopped', lastTickAt, startedAt },
  matchTiming?: { restSec, breakPeriods[], phase, phaseStartedAt },
  firstSetStartedAt?, warmupStartedAt?,
  liveSet?: LiveSet,          // trwający set (tylko gdy active)
  serveDuel?: { startedAt, serveSec, serveTickAt, startedByPlayerId },
  teamMeta?: { A: { name?, avatarUrl?, teamId? }, B: {...} },  // deble
  tempGuests?: { [negativeId]: 'Imię' },  // goście tymczasowi w trakcie meczu
  isArchive?: boolean,
  rotationSessionId?: number,     // ID korzenia serii (debel rotacja składów)
  rotationFromMatchId?: number,   // poprzedni mecz w serii
  planMeta?: { sessionId, slotId, token? },  // mecz utworzony z planowania
  refereePlayerId?, refereeGuest?, refereeGuestName?, refereeRecord?,
}
```

### Set (`sets[]`)

```js
{ n, scoreA, scoreB, status: 'live'|'finished', durationSec?, firstServer?: 'A'|'B' }
```

### `liveSet` (runtime)

```js
{
  n, scoreA, scoreB, elapsedSec,
  status: 'idle'|'running'|'paused'|'serve_pending',
  lastTickAt, firstServer?, serveSec?,
}
```

### Zaproszenie do ligi (`signupInvites[]`)

```js
{ token: uuid, invitedByPlayerId?, createdAt, lastSharedAt?, lastSharedVia? }
```

### Planowanie (`plannedSessions[]`, v23+)

```js
{
  id, token,                    // link: ?plan=<token>
  createdByPlayerId,
  scheduledAt,                  // ISO datetime
  placeId,                      // PLAN_VENUES (hardcoded)
  defaultFormat: 'singles' | 'doubles',
  courtCount: 1–4,
  status: 'open' | 'started' | 'cancelled',
  pool: [playerId],             // wielokortowość: zapis przez link
  slots: [{
    id, label, format,
    teamA: (id|null)[], teamB: (id|null)[],
    startedMatchId?,             // po starcie kortu
  }],
  createdAt, updatedAt,
}
```

**Flow:** FAB tylko w Planowaniu (konto wymagane) → link → logowanie → dołączenie (singiel 1 kort: auto A/B; debel 1 kort: wybór strony; multi: pula) → organizator przypisuje z puli → start pełnego kortu tworzy normalny `match`.

### Powiadomienia in-app (`planNotifications[]`, v246+)

Przechowywane w **stanie ligi** (sync między urządzeniami). To **nie** osobna tabela — tablica w `league_state.payload`.

```js
{
  id: number,
  type: string,           // patrz lista typów poniżej
  playerId: number,       // odbiorca
  sessionId?, matchId?, token?, joinToken?,
  fromPlayerId?, joinPlayerId?,
  dedupeKey?, meta?, createdAt, readAt?,
}
```

**Typy aktywne:** `invite`, `league_invite`, `join`, `plan_updated`, `plan_cancelled`, `plan_started`, `plan_assigned`, `plan_leave`, `plan_reminder_24h`, `plan_reminder_2h`, `match_finished_won`, `match_finished_lost`, `match_finished_draw`, `win_streak`, `referee_request`, `referee_approved`, `referee_rejected`.

**Wyłączone / ukryte:** `match_set_won`, `match_set_lost` — nie generowane (v267).

**Kluczowe funkcje:** `queueLeagueNotification()`, `processIncomingPlanNotifications()`, `showNotifFloatingBanner()`, `openPlanNotification()`, `deletePlanNotificationsByIds()`.

**Push:** `dispatchPlanPush()` → Edge Function `send-push`; lokalnie `showLocalPlanPush()` + baner 4 s gdy apka widoczna.

**Preferencje kategorii (v297+):** profil → „Włącz powiadomienia” (od razu panel checkboxów) → „Zarządzaj powiadomieniami”. Grupy: `invites`, `plans`, `matches`. Sędziowanie zawsze włączone. Zapis w `userSession.notificationPrefs` + kopia na `player.notificationPrefs`.

**Kluczowe funkcje (v297):** `normalizeNotificationPrefs()`, `shouldDeliverNotificationToPlayer()`, `renderProfileNotificationsCard()`.

### `pushSubscriptions` (v250+)

Mapa `{ [playerId]: PushSubscriptionJSON }` w stanie ligi — używana przez backend do wysyłki Web Push.

### `userSession`

```js
{
  playerId, avatarUrl, notifications: boolean,
  notificationPrefs?: { invites, plans, matches, referee },  // v297
  loggedIn: boolean, authEmail?,
  pinHash?: string,   // SHA-256(PIN + userKey), tylko w profilu chmurowym
}
```

### Tombstones (`leagueTombstones`)

```js
{ matches: { [id]: deletedAt }, players: {}, teams: {} }
```

---

## Autentykacja i onboarding

### Ekran powitalny (wybór roli) — v153

Przed logowaniem użytkownik **musi wybrać rolę** (`sessionStorage` → `badminton-app-role`):

| Rola | Wartość | Zachowanie |
|------|---------|------------|
| **Kibic** | `spectator` | Bez logowania; zakładki **Statystyki** + **Mecze**; **Zawodnicy** ukryci; brak FAB; brak profili; nagłówek „Zaloguj się i graj” |
| **Zawodnik** | `player` | Bramka logowania (`renderAuthScreen` z chmurą lub `renderPlayerLocalAuthScreen` bez `config.js`) |

**Kiedy welcome:** cold start (brak roli), po **każdym wylogowaniu** (`clearSessionRole()`), po zamknięciu apki.

**Funkcje:** `needsWelcomeScreen()`, `shouldShowPlayerAuthChrome()`, `isSpectatorMode()`, `enforceSpectatorTabAccess()`, `canCreateMatch()` → `false` dla kibica.

**Deep linki `?claim=` / `?join=`:** welcome z wyróżnioną kartą „Graj jako zawodnik” + baner zaproszenia (nie pomijają welcome).

### Bramka logowania (po wyborze zawodnika)

- `shouldShowPlayerAuthChrome()` — rola `player`, brak `userSession.loggedIn`
- `shouldShowAuthChrome()` — alias do powyższego
- `needsInviteAuthScreen()` — deep link w sesji (baner na welcome/auth)
- Bez Supabase: `renderPlayerLocalAuthScreen()` — „Kontynuuj lokalnie” + hint o `config.js`

### Rejestracja e-mail

- **Confirm email OFF** w Supabase (Providers → Email) — konto aktywne od razu po e-mail + hasło + PIN
- `completeEmailRegistration()` → `signUpWithEmail()`; jeśli brak sesji, fallback `signInWithPassword()`
- Walidacja po polsku (`formatAuthError`, `novalidate` na formularzu); kostka losuje hasło (jak przy nazwie drużyny)
- PIN 4 cyfry przy rejestracji → `setUserPin()` po pierwszym logowaniu
- Google OAuth: `signInWithGoogle()` — nie działa w webview Messengera/Instagram (`isInAppBrowser()` → ostrzeżenie)

### Przejęcie konta gościa (`?claim=PLAYER_ID&t=TOKEN`)

1. `parseClaimFromUrl()` → `sessionStorage` + `inviteAuthMode = 'guest'` + rola `player` (pomija welcome i kibica)
2. Od razu ekran auth (Google + e-mail) — bez welcome i kibica; domyślnie zakładka „Załóż konto”
3. Po rejestracji/logowaniu: `tryApplyGuestClaim(user)` w `finishAuthSession()` (`allowGuestClaim: true`) — **nie** przy samym otwarciu linku
   - Ten sam `player.id`, `isGuest=false`, `authUserId=user.id`
   - Mecze/statystyki/drużyny zostają (ID się nie zmienia)
   - **Jednorazowe** — po claim token nieważny
   - Przy linku na nowym urządzeniu: bez lokalnego gościa rejestracja **czeka** na sync ligi (`claimPending`); po `applyLeagueStateUiFromCloud()` → `tryRetryGuestClaimAfterLeagueSync()`
   - Przy aktywnym `?claim=` nie łączy gościa po samym imieniu — tylko po tokenie z URL
   - Zalogowany użytkownik z profilem otwierający link testowy — claim ignorowany (gość zostaje gościem)
4. Admin w profilu gościa: „Wyślij link do przejęcia konta” / „Kopiuj link” (panel `renderGuestClaimAdminCard`)
5. → automatycznie panel użytkownika (PIN, avatar, instalacja)

### Zaproszenie nowego gracza (`?join=TOKEN`)

1. `parseJoinFromUrl()` → `signupInvites` rozwiązywane po syncu
2. Ekran **welcome** z banerem „X zaprasza” → wybór roli → „Graj jako zawodnik” → rejestracja
3. FAB **Zaproś nowego gracza** — udostępnia tekst + link (jak sędziowanie), bez samej grafiki

### PIN i biometria

- PIN: 4 cyfry, pola `.pin-input` — `bindPinInputGuards()` (tylko cyfry)
- Hash: `hashPin(pin, userKey)` w `userSession.pinHash`
- Operacje chronione: usuwanie drużyny/zawodnika, reset statystyk, zmiana Google, usunięcie konta
- WebAuthn opcjonalnie (`hasBiometricEnrolled`, `verifyDeviceBiometric`)

---

## Zaproszenia i udostępnianie

### Źródła zaproszeń

| Akcja | Funkcja |
|-------|---------|
| FAB → Zaproś nowego gracza | `createSignupInvite()` → share sheet |
| Profil gościa → Wyślij link do przejęcia konta | `ensureGuestClaimToken()` → `shareTextInvite()` (tekst + link, native share) |
| Profil gościa → Kopiuj link | schowek: tekst + URL `?claim=` |

### Share sheet (`openInviteShareSheet`, `dispatchInviteShare`)

**Gość / nowy gracz:** tylko tekst + klikalny URL (`navigator.share` lub schowek) — **bez grafiki PNG**.

**Sędziowanie / kibicowanie:** tekst + link (bez grafiki).

**Inne (legacy):** kanały z grafiką PNG w schowku — tylko jeśli sheet zostanie otwarty dla innego typu payloadu.

**Ważne (ograniczenia platform):**
- **Nie używać** `navigator.share({ files })` dla zaproszeń gościa / do ligi — Messengery często wysyłają sam obrazek bez linku
- Baner PNG: `generateInviteShareImage()` — tylko dla legacy share sheet

### Deep linki

```
https://.../badminton-stats/?claim=3&t=uuid      → przejęcie gościa
https://.../badminton-stats/?join=uuid           → zaproszenie do ligi
https://.../badminton-stats/?plan=token          → zaplanowana gra
https://.../badminton-stats/?match=ID            → otwarcie meczu (push/deep link)
https://.../badminton-stats/?referee=ID          → tryb sędziego (link do meczu)
https://.../badminton-stats/?watch=ID            → oglądanie meczu (kibic)
```

Po parsowaniu query usuwane przez `history.replaceState` (zostaje w `sessionStorage`).

---

## Tryb sędziego (v203–v204)

- Link `?referee=MATCH_ID` → sesja w `sessionStorage` (`badminton-referee-session`)
- Sędzia: konto zalogowane **lub** gość z imieniem (`refereeGuest`, `refereeGuestName`)
- Uprawnienia: serwis, punkty, zakończenie seta/meczu — jak uczestnik + `canRefereeControlMatch`
- Prośba o sędziowanie → powiadomienie `referee_request` / `approved` / `rejected`
- Po zakończeniu meczu przez sędziego-gościa: przejście w tryb kibica na tym meczu
- UI: badge „Sędzia: …”, ukryte zaproszenia dla aktywnego sędziego

---

## Mecze na żywo — logika kluczowa

### Fazy meczu (`getMatchPhase`)

`warmup` → `serve_duel` (1. set) → `live` (set trwa) → `break` (pauza seta) → kolejny set

### Zegary

- Główny zegar meczu startuje przy **1. secie** (`firstSetStartedAt`)
- Przed 1. setem: sub-zegar rozgrzewki (niebieski)
- Między setami: sub-zegar przerwy (żółty); główny zegar leci dalej
- Set live: własny zegar; pauza tylko w overlay (`pauseLiveSet` → `paused`)

### Rozegranie seta

1. Serve picker (kto serwuje) — `renderServePickerOverlay`, `finalizeServeSide`
2. Overlay seta — `renderSetPlayOverlay`, `setPlayOpen = true`
3. Punkty: `adjustLiveScore` → `immediatePush`; auto-koniec przy `isSetComplete()` (21+ z 2 pkt przewagi, 30 max)
4. **Zakończ set:** `finishLiveSet` → `syncScoresFromSetForm` → `commitLiveSet`
   - Sync wyniku: **nie nadpisuj** wyniku z +/- zerami z pól formularza (`domA+domB >= modelA+modelB`)
   - Po commicie: `beginLiveSettling(3000)` — ochrona przed nadpisaniem ze zdalnej kopii

### Zakończony set — UI

- Klik w wiersz seta → `setDetailN` → podgląd (`renderSetDetailOverlay`)
- Edytuj / Usuń (gdy `canEditSetScores`)
- Zakończony mecz: edycja setów po „Edytuj mecz” (`reopenMatchEdit`)

### Uprawnienia

| Akcja | Kto |
|-------|-----|
| Podgląd meczów / live | wszyscy |
| Nowy mecz | zalogowany z kontem Supabase (`canCreateMatch`) |
| Edycja/usuwanie meczu, setów, live | uczestnik meczu **lub** admin |
| Admin | `APP_ADMIN_EMAILS` w `app.js` |

`canEditMatch(m)`, `canEditSetScores(m)`, `isMatchPlayableLive(m)` — sprawdzać przed akcjami.

### Status „W GRZE”

- Chip `ingame-chip` tylko gdy `isMatchPlayableLive(m)` (aktywny mecz + uczestnik może wejść)
- Klik → `openMatch(id)`

---

## Synchronizacja multi-device

### Przepływ zapisu

```
saveState({ immediatePush? })
  → localStorage
  → debounced push (cloud.js) lub immediatePush przy live
  → flushPush() najpierw mergeLeagueFromCloud(), potem upsert
```

### Merge meczów (`mergeMatchByUpdatedAt`)

Kolejność reguł (skrót):

1. Lokalnie zakończony set, zdalnie wciąż `liveSet` → **preferuj lokalny** (`isSetFinishedInMatch`)
2. Lokalny aktywny set, zdalnie brak → preferuj lokalny (jeśli `lT >= rT`)
3. Zdalne anulowanie live + nowszy `updatedAt` → preferuj zdalny
4. `openProtected` — otwarty widok seta / serve picker / `isLiveSettling()` → chroni lokalny stan (~1 s tolerancja)
5. Domyślnie: nowszy `updatedAt` wygrywa
6. Oba mają ten sam live set → `mergeActiveLiveSetScores` (nowszy czas lub wyższa suma punktów)

### Merge czasu (`mergeMatchTimings`)

- **Max** elapsed dla meczu, seta, rozgrzewki, przerwy (nigdy nie cofaj czasu w dół)
- Status zegara z wyniku merge, nie „running zawsze wygrywa”

### Po merge

`scrubGhostLiveSet()` → `repairSetRows()` → `recalcMatchScores()` (wynik meczu = liczba wygranych setów)

### UI bez pełnego renderu

- `softUpdateMatchDetail(m, remoteHints)` — aktualizuje DOM meczu przy realtime
- `reconcileRemoteMatchView(before, after)` — hinty: `closeSetPlay`, `mountSetPlay`, `liveSetEnded`
- `pendingRemoteMatchUi` — bufor hintów między merge a paint

---

## Centrum powiadomień (v267–v269)

### UI
- **Dzwonek** w pasku górnym (`#notif-center-btn`, `#notif-center-badge`) — widoczny dla zalogowanych z kontem (nie kibic)
- **Panel** montowany na `#app` jako `#notif-center-root` (NIE w `#content`!)
- **Pływający baner** ~4 s (`#notif-float`) przy nowym powiadomieniu — tap otwiera szczegóły
- Stare zielone banery w treści usunięte (`mountPlanNotificationBanners` = no-op)

### Stan UI
```
notifCenterOpen, notifListSelectMode, notifListSelectedIds
notifFloatShownIds, notifFloatTimer
```

### Handlery zdarzeń
- **`document.addEventListener('click', handleNotifUiClick)`** — zamykanie (X, backdrop), otwieranie, usuwanie, zaznaczanie
- **Pułapka v268:** handlery na `#content` nie widzą panelu → panel nie zamykał się; naprawione przez delegację na `document`
- **Pułapka v269:** pasek multi-select (`.notif-list-select-bar`) wymaga `pointer-events: auto` — root ma `pointer-events: none`
- Long-press na pozycji → tryb zaznaczania + usuń (jak mecze/plany)
- `refreshNotifCenterUi()` — odświeża panel bez pełnego `render()`; zachowuje `scrollTop` listy

### Otwieranie powiadomienia
`openPlanNotification(id)` — oznacza `readAt`, zamyka panel, nawiguje (plan / mecz / join / profil).

---

## Statystyki zawodników (v270)

### Podział singiel / debel
`computePlayerStats(id)` zwraca **trzy kubełki:**
```js
{ singles: Stats, doubles: Stats, combined: Stats }
```
Routing: `isDoublesMatch(m)` → `(teamA.length > 1 || teamB.length > 1)`.

**Przełącznik** `Łącznie | Singiel | Debel` (`statsFormatView`, `h2hFormatView`):
- Statystyki globalne ligi
- Ranking zawodników (sortowanie per format!)
- Profil zawodnika
- Konfrontacja H2H (filtruje też listę meczów) — **Zawodnicy | Drużyny** (`h2hEntityView`), drużyny tylko debel (`computeTeamH2HStats`)

**Partial refresh (v272):** `set-stats-format` / `set-h2h-format` → `refreshStatsFormatUi()` — aktualizuje tylko `#stats-format-content`, `#player-detail-stats` lub `#h2h-comparison` (+ klasy przycisków toggle), bez pełnego `render()`. Scroll `#content` zachowany.

**Konfrontacja (v273):** menu „Konfrontacja”; przełącznik `Zawodnicy | Drużyny`; dyskretny „Wyczyść wybór”; `resetH2HView()` przy wyjściu (stats-back, zmiana podwidoku, zmiana zakładki).

**Bez podziału (celowo):**
- Kafelki zawodników na liście — `computeWins()` łącznie
- Statystyki drużyn — tylko debel (`computeTeamStats`)

### Metryki w kubełku (`createParticipantStatsShell` → `finalizeParticipantStats`)
Mecze/sety/wygrane, skuteczność %, punkty, tempo, przewagi (margin), serwis (z lotką / bez), czas gry.

**Funkcje:** `pickParticipantStatsBucket()`, `renderStatsFormatToggle()`, `renderParticipantStatsRows()`, `computeH2HStats()`, `computeGlobalStats()` (też S/D/combined).

---

## Serie meczów i rotacja składów (v256–v266)

### Seria meczów
- Pole `rotationSessionId` na meczach debla — wspólny ID serii
- Lista meczów grupuje serie w zwijane bloki (`matchSeriesExpanded`)
- Serie **nie wpływają na ranking** — to wizualna grupa powiązanych meczów
- Long-press nagłówka serii → usuń całą serię
- Long-press meczu → multi-select: usuń / połącz w serię (ten sam dzień)

### Rotacja składów (debel)
- **Po zakończeniu meczu:** FAB/historia — „Zmiana składów” (gdy `canOpenRosterRotation` — tylko **aktywny debel**, ≥1 set, widok live)
- Kończy bieżący mecz, otwiera formularz nowego z tymi samymi zawodnikami
- Sync: uczestnicy nowego meczu przechodzą automatycznie (`processRotationLeagueSync`)
- Formularz rotacji **nie** jest usuwany przez `dismissAllMatchOverlays` przy syncu

---

## Zaznaczanie wielokrotne (v264–v265)

| Kontekst | Wejście | Akcje |
|----------|---------|-------|
| Lista meczów | Long-press karty | Usuń, Połącz w serię |
| Zaplanowane gry | Long-press karty | Usuń wiele |
| Centrum powiadomień | Long-press pozycji | Usuń wiele |

Wspólny wzorzec: `*ListSelectMode`, `*ListSelectedIds`, pasek na dole (`match-list-select-bar`).

---

## Render i stan UI

### Główne zmienne (pamięć)

```
// Nawigacja
currentTab: 'stats' | 'matches' | 'players'
statsSubView: null | 'global' | 'players' | 'h2h'
statsFormatView: 'combined' | 'singles' | 'doubles'
h2hFormatView: 'combined' | 'singles' | 'doubles'
h2hEntityView: 'players' | 'teams'
h2hPlayerA, h2hPlayerB, h2hTeamA, h2hTeamB, h2hPickerOpen

// Profile / encje
profileOpen, openMatchId, openPlayerId, openTeamId
openPlannedSessionId, planningArchivedOpen

// Formularze
newMatchOpen, newMatchDraft, newTeamOpen, newTeamDraft
newPlannedOpen, newPlannedDraft, planEditOpen, planEditDraft
rosterRotationOpen, rosterRotationDraft, rosterRotationSourceMatchId

// Mecz live
setPlayOpen, setDetailN, editSetN, reopenMatchEdit, matchEditSnapshot
matchInfoOpen, servePickerPhase, servePickerMatchId
liveSettlingUntil, beginLiveSettling()

// Multi-select
matchListSelectMode, matchListSelectedIds
planListSelectMode, planListSelectedIds
notifListSelectMode, notifListSelectedIds

// Powiadomienia
notifCenterOpen

// Zaproszenia / auth
inviteShareOpen, inviteSharePayload, inviteAuthMode
authBootstrapPending, profileAuthMode, pinSetupOpen
rolePickerOpen  // welcome screen

// Serie
matchSeriesExpanded: Set<seriesId>
```

### Punkt wejścia

`bootstrap()` → `BadmintonCloud.init()` → `render()`

`render()` kolejność:
1. `needsWelcomeScreen()` → `renderWelcomeChrome` (STOP)
2. `shouldShowPlayerAuthChrome()` → `renderAuthGateChrome` (STOP)
3. `profileOpen` → `renderProfile()`
4. Zakładka: stats / matches / players
5. Overlays: `mountNotifCenterPanel()`, `mountPlanOverlays()`, `mountInviteShareSheet()`, …

### Delegacja zdarzeń

| Cel | Zakres | Uwagi |
|-----|--------|-------|
| Główna logika UI | `#content` click (**`async`!**) | mecze, profile, plany, formularze |
| Invite share sheet | `#app` click | modal poza content |
| **Centrum powiadomień** | **`document` click** | panel w `#app`, nie w `#content` |
| Long-press (notif) | `document` pointerdown/up | anulowanie timera |
| Plan modal host | `document` capture (v249) | klik poza modalem |

**Pułapka:** `await` poza `async` handler = **martwy JS** (v151/v152).

### Modale

- `showAppConfirm()` — Promise, overlay `#app-confirm` (nie `window.confirm` dla ważnych akcji)
- `showToast(message, 'success'|'warn'|'info')`

---

## Pliki — mapa odpowiedzialności

| Plik | Rola |
|------|------|
| `js/app.js` | Cała logika UI (~17k linii): stan, mecze live, statystyki, planowanie, powiadomienia, merge |
| `js/cloud.js` | Supabase client, auth, push/pull, realtime, `resendSignupEmail` |
| `js/push.js` | Web Push: permission, subscription, `showLocalPlanPush` |
| `js/config.js` | `window.APP_CONFIG` — **nie commituj prawdziwych kluczy** |
| `js/config.example.js` | Szablon configu |
| `css/styles.css` | Wszystkie style (~6k linii) |
| `sw.js` | Service worker, lista `ASSETS`, `CACHE` version |
| `index.html` | Shell PWA, nawigacja, FAB, wersje cache |
| `manifest.json` | Ikony PWA |
| `supabase/schema.sql` | Tabela `app_state` |
| `supabase/league_schema.sql` | Tabela `league_state` + RLS |
| `supabase/delete_account.sql` | RPC usuwania konta |
| `AGENTS.md` | Skrót dla agenta (odnośnik tutaj) |

---

## Changelog (v144–v153)

| Wersja | Temat |
|--------|--------|
| v144 | Status „W GRZE” tylko przy realnym aktywnym meczu; klikalny chip |
| v145 | Zaproszenia gość→konto + nowy gracz; share sheet; landing logowania |
| v146 | Reset nawigacji zakładek; baner PIN po logowaniu |
| v147 | Baner zaproszenia PNG; fix profilu przy sync |
| v148 | Instagram + SMS zamiast Facebook w share |
| v149 | Share per-kanał z linkiem; `?claim=` wymusza auth; przejęcie gościa |
| v150 | Pola PIN: tylko cyfry (`bindPinInputGuards`) |
| v151 | Rejestracja: zielony komunikat + resend; fix kończenia seta |
| v152 | **Hotfix:** `content` click handler → `async` (v151 miał `await` w sync → cały JS się nie ładował) |
| v204 | **Tryb sędziego v2:** jeden sędzia (konto/gość), auto-przypisanie z linku dla zalogowanych, upgrade gość→konto po logowaniu, badge „Sędzia: …”, ukryte zaproszenia dla sędziego, padding niebieskiej ramki |
| v203 | **Tryb sędziego (naprawa):** sesja linkowa przetrwa odświeżenie; sync chmury (`ensureRefereeLeagueSync`); uprawnienia linku tylko gdy brak innego sędziego; serve picker + anulowanie dla sędziego; auto-mount UI przy syncu zdalnym |
| v169 | **Info meczu:** „Sety przedłużone” (z ?), tempo pkt/min (strony + mecz), oś czasu (rozgrzewka/serwis/gra/przerwy między setami), najkrótszy set |
| v244 | **Planowanie UX:** Zaproś do gry, edycja/korty do 6, nazwy kortów, mapy, fix przypisywania z ligi |
| v245 | **Planowanie v2:** ikona miejsca, „Zaplanuj”, mapy w szczegółach, realtime pula, archiwum/auto-archiwum, Edytuj/Archiwizuj/Usuń (admin+twórca), start kortu → widok meczu |
| v246 | **Planowanie zaproszenia:** menu Zaproś w aplikacji / link, `planNotifications`, przypisywanie tylko z puli, debel 2v1 z potwierdzeniem, ikony UI |
| v247 | **Planowanie UI fix:** sloty z ciągłą obwódką (nieaktywne bez puli), modal zaproszeń wyśrodkowany ze scrollem |
| v248 | **Fix modal zaproszeń** (klik na #app), `planMeta` w meczu z planowania, mapy w widoku meczu |
| v249 | **Fix modal zaproszeń v2:** `document` capture + `body` host, auto-zamykanie przy zmianie zakładki, Escape |
| v250 | **Push planowania:** Web Push (zaproszenie + dołączenie), `js/push.js`, `pushSubscriptions`, tekst „zaprasza do gry” |
| v253 | **Nawigacja/UX planów:** domyślnie zakładka Mecze, „Zaplanowane” zamiast „Planowanie”, szybsze wejście z `?plan=` bezpośrednio do zaplanowanej gry dla zalogowanego zawodnika |
| v254 | **Push pełny:** przypomnienia 24h/2h, zmiana/odwołanie/start planu, leave/assign, set/mecz live, sędziowanie, zaproszenia do ligi in-app, seria 5 wygranych; `queueLeagueNotification`, cron `plan-reminders`, deep-link `?match=` |
| v256 | **Rotacja składów po deblu:** przycisk „Zmiana składów” po zakończeniu meczu, formularz nowego meczu z tymi samymi zawodnikami |
| v257 | **Fix rotacji:** klik nie działał (przechwytywany przez `[data-match-id]` → `openMatch`); przycisk zielony (`btn--primary`) |
| v258 | **Rotacja v2:** pusty formularz, auto-dopasowanie istniejącej drużyny po składzie, unikalne nazwy drużyn, ikona zdjęcia zamiast avatarów graczy, sędzia w składzie → widok zawodnika bez auto-sędziowania |
| v259 | **Fix sync:** usunięty `adminRepairLeagueOnce` (kasował ligę na nowym urządzeniu admina); blokada pustego pusha nad pełną chmurą |
| v260 | **Fix rotacji:** formularz „Zmiana składów” nie znika przy syncu chmury (`dismissAllMatchOverlays` nie usuwa warstwy rotacji) |
| v261 | **Seria meczów:** start przy „Zmiana składów” (`rotationSessionId` na korzeniu); rozwijana grupa w liście meczów (bez wpływu na ranking) |
| v262 | **Seria fix:** zwijanie przez CSS (góra/dół); jednorazowa migracja — wczorajsze mecze → jedna seria |
| v263 | **Rotacja w trakcie meczu:** „Zmiana składów” obok „Zakończ mecz” (debel, gdy `canEndMatch`); klik kończy mecz i otwiera formularz; sync — uczestnicy nowego meczu przechodzą automatycznie |
| v264 | **Serie + zaznaczanie:** neutralny styl ramek serii; long-press serii → usuń całą serię; long-press meczu → tryb zaznaczania (usuń / połącz w serię — ten sam dzień) |
| v265 | **Zaznaczanie planów:** long-press na zaplanowanej grze → tryb zaznaczania (usuń wiele naraz); działa na aktywnych i zarchiwizowanych |
| v266 | **Fix rotacji:** „Zmiana składów” tylko w trakcie aktywnego debla (≥1 set); znika po zakończeniu / powrocie do historii |
| v267 | **Centrum powiadomień:** dzwonek z licznikiem w pasku; push także przy otwartej apce; bez powiadomień o setach |
| v268 | **Centrum powiadomień UX:** fix zamykania (X + klik poza); long-press → zaznaczanie wielu + usuń; pływający baner ~4 s przy nowym powiadomieniu |
| v269 | **Fix powiadomień:** pasek usuń klikalny (`pointer-events`); zachowanie scrolla listy przy zaznaczaniu |
| v270 | **Statystyki S/D:** przełącznik Łącznie/Singiel/Debel w globalnych, rankingu, profilu i H2H; kafelki zawodników bez zmian (łącznie) |
| v297 | **Preferencje powiadomień:** profil — Włącz/Wyłącz + „Zarządzaj powiadomieniami” (4 kategorie); filtr push, centrum i banera |
| v298 | **Fix UX powiadomień:** panel bez flashu, Włącz → od razu checkboxy, sędziowanie zawsze ON, zielony „Zarządzaj” |
| v299 | **Fix sync multi-konto:** meta sync per user_id, pusta lokalna liga → zawsze pull z chmury, odświeżanie przy focus/online |
| v300 | **Fix sync częściowej ligi:** chmura wygrywa gdy ma więcej meczów/zawodników; avatar z app_state; strzałka na Zarządzaj |
| v301 | **Fix sync tombstones:** merge z chmury nie filtruje remote lokalnymi tombstones; pełny pull gdy brak meczów |

---

## Pułapki dla agenta (czytaj!)

1. **`await` tylko w `async` funkcjach** — błąd składni = martwa aplikacja (zero kliknięć). Handler: `content?.addEventListener('click', async e => {`
2. **Cache:** podbij **trzy miejsca:** `sw.js` `CACHE`, `index.html` `APP_CACHE_VER`, oraz `?v=` na `app.js`, `cloud.js`, `push.js` i `styles.css` w `index.html`
3. **Nie używaj** `navigator.share({ files })` jako domyślnego share dla Messengera/WhatsApp
4. **Welcome przed auth** — `?claim=` / `?join=` / `?plan=` pokazują welcome z wyróżnionym „Graj jako zawodnik”
5. **`commitLiveSet`** + merge: po zakończeniu seta chroni `beginLiveSettling` i reguła `isSetFinishedInMatch`
6. **`syncScoresFromSetForm`:** pola input mogą być nieaktualne vs model z przycisków +
7. **Supabase Confirm email:** mail idzie z Supabase, nie z apki — sprawdź SMTP/spam; w dev można wyłączyć Confirm
8. **`js/config.js`** w `.gitignore` — na Pages musi być w deployu u użytkownika
9. **Commit/push** tylko na wyraźną prośbę użytkownika
10. **`_live_app.js`, `fonts/roboto-mono*`** — lokalne śmieci, nie commitować
11. **Przyciski z `data-match-id` + `data-action`** — ogólny handler listy meczów ignoruje elementy z `data-action`; inaczej klik trafia w `openMatch()` zamiast w dedykowany handler
12. **Sync między urządzeniami** wymaga **tego samego konta Google/e-mail** + chmury Supabase; każda przeglądarka ma własny `localStorage`. Pusty stan na nowym PC = zaloguj się i dotknij badge sync w profilu. **Nigdy** nie pushuj pustej ligi nad pełną (v259: blokada w `pushToLeague`)
13. **Centrum powiadomień** montuje się na `#app`, handlery na `document` — nie przenoś logiki z powrotem na `#content`
14. **Pasek zaznaczania powiadomień** — `pointer-events: auto` (rodzic `.notif-center-root` ma `none`)
15. **`mergePlanNotifications`** łączy lokalne i zdalne — usunięcie wymaga filtrowania + push; brak tombstone dla powiadomień
16. **Statystyki:** `computePlayerStats` zwraca `{ singles, doubles, combined }` — nie traktuj wyniku jako płaskiego obiektu
17. **Rotacja składów** — przycisk tylko w **aktywnym** deblu z ≥1 setem; znika po zakończeniu meczu

---

## Backlog / znane ograniczenia

- [ ] Wiele lig / `league_members` — teraz jedna liga `default`
- [x] Powiadomienia push + centrum in-app — `planNotifications[]`, `queueLeagueNotification`, baner, multi-delete
- [x] Statystyki singiel/debel z przełącznikiem (v270)
- [ ] Normalizacja SQL zamiast JSON blob w `league_state`
- [ ] Share: Messengers nie zawsze wspierają obrazek+link programowo (schowek + deep link to workaround)
- [ ] Reset hasła e-mail — brak dedykowanego UI w apce
- [ ] Testy automatyczne — brak

### Ustalenia MVP ligi

1. Jedna wspólna liga (`league_id = default`)
2. Realtime + tombstones dla usunięć
3. Nowy mecz: każdy zalogowany z kontem
4. Edycja: uczestnik + admin; podgląd live: wszyscy

---

## Checklist po większych zmianach

- [ ] `CACHE` w `sw.js`
- [ ] `APP_CACHE_VER` w `index.html`
- [ ] `?v=` na `js/app.js`, `js/cloud.js`, **`js/push.js`**, **`css/styles.css`** w `index.html`
- [ ] `STATE_VERSION` + migracja w `applyLeagueState()` / `loadState()` jeśli zmiana modelu
- [ ] Zaktualizuj **ten plik** (`docs/HANDOFF.md`) — wersja, changelog, nowe pułapki
- [ ] Zaktualizuj `AGENTS.md` jeśli zmieniły się konwencje
- [ ] Przetestuj na telefonie: live set, sync, claim URL, rejestracja

---

## Git (Windows, autor bez globalnego config)

```powershell
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" -c user.name="krzysi3kjurczak-beep" -c user.email="krzysi3kjurczak-beep@users.noreply.github.com" commit -m "..."
& "C:\Program Files\Git\bin\git.exe" push
```

---

## Słownik funkcji (najczęściej używane)

| Obszar | Funkcje |
|--------|---------|
| Stan | `loadState`, `saveState`, `applyLeagueState`, `applyPersistedState`, `exportLeagueState` |
| Auth | `bootstrap`, `finishAuthSession`, `needsWelcomeScreen`, `isSpectatorMode`, `shouldShowPlayerAuthChrome`, `tryApplyGuestClaim` |
| Mecz live | `beginLiveSet`, `commitLiveSet`, `finishLiveSet`, `adjustLiveScore`, `finalizeServeSide`, `finalizeMatch` |
| Merge | `mergeMatchByUpdatedAt`, `mergeMatchTimings`, `mergePlanNotifications`, `scrubGhostLiveSet`, `softUpdateMatchDetail` |
| Zaproszenia | `openInviteShareSheet`, `dispatchInviteShare`, `buildGuestInvitePayload`, `parseClaimFromUrl`, `parsePlanFromUrl` |
| Planowanie | `createPlannedSessionFromDraft`, `tryJoinPlannedSession`, `startPlannedSlot`, `renderPlannedSessionDetail`, `sendPlanInAppInvites` |
| Powiadomienia | `queueLeagueNotification`, `openPlanNotification`, `mountNotifCenterPanel`, `handleNotifUiClick`, `showNotifFloatingBanner` |
| Statystyki | `computePlayerStats`, `pickParticipantStatsBucket`, `computeH2HStats`, `computeGlobalStats`, `renderStatsFormatToggle` |
| Serie / rotacja | `ensureMatchSeriesStarted`, `getMatchSeriesMembers`, `openRosterRotationForm`, `canOpenRosterRotation` |
| Render | `render()`, `renderWelcomeScreen`, `renderMatchDetailPage`, `renderSetPlayOverlay`, `renderAuthScreen` |
| Uprawnienia | `canEditMatch`, `canCreateMatch`, `canEditSetScores`, `isAppAdmin`, `canManagePlannedSession` |

---

## Mapa zakładek UI

```
Bottom nav
├── Statystyki (stats)
│   ├── Statystyki globalne   [statsSubView=global]   + przełącznik S/D
│   ├── Ranking zawodników    [statsSubView=players]  + przełącznik S/D
│   └── Konfrontacja (H2H)    [statsSubView=h2h]      + przełącznik S/D
├── Mecze (matches)
│   ├── Lista / filtry / serie / multi-select
│   ├── Szczegół meczu (openMatchId)
│   ├── Zaplanowane (matchesRosterTab=planned)
│   └── Overlay: set play, serve picker, info meczu
└── Zawodnicy (players) — ukryte dla kibica
    ├── Kafelki zawodników (wygrane łącznie)
    ├── Kafelki drużyn
    └── Profil zawodnika / drużyny + przełącznik S/D

Top bar: logo | dzwonek powiadomień | avatar → profil
FAB (planowanie): tylko zalogowany zawodnik, zakładka mecze + planned
```

---

*Ostatnia aktualizacja dokumentacji: lipiec 2026, cache v301, `STATE_VERSION` 27.*
