# Handoff — Badminton App (czerwiec 2026)

**Dla nowego agenta:** przeczytaj ten plik w całości przed zmianami. Po większych PR-ach **zaktualizuj ten dokument** i podbij cache (patrz checklist na końcu).

---

## Szybki start

| Co | Gdzie |
|----|--------|
| **Live (GitHub Pages)** | https://krzysi3kjurczak-beep.github.io/badminton-stats/ |
| **Repo** | `krzysi3kjurczak-beep/badminton-stats` |
| **Gałąź** | `main` |
| **Ostatni push** | `ddbe3d5` — hotfix v152 (parse `app.js` po błędnym `await`) |
| **Cache PWA** | `sw.js` → `badminton-stats-v153`; `index.html` → `APP_CACHE_VER = '153'` |
| **Skrypty** | `js/app.js?v=153`, `js/cloud.js?v=153` (query `?v=` przy każdej większej zmianie JS!) |
| **Wersja danych** | `STATE_VERSION = 16` w `js/app.js` |
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
  └── js/app.js             (~10k linii: UI, mecze live, statystyki, zaproszenia)
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
| `badminton-sync-meta` | Metadane syncu chmurowego |
| `badminton-biometric-store` | WebAuthn credential IDs per user |
| `badminton-install-dismiss` | Ukrycie banera instalacji PWA |

### `sessionStorage`

| Klucz | Zawartość |
|-------|-----------|
| `badminton-pending-claim` | `{ playerId, token }` — deep link przejęcia gościa |
| `badminton-pending-join` | `{ token }` — deep link zaproszenia do ligi |
| `badminton-app-role` | `'spectator'` \| `'player'` — wybór roli z ekranu powitalnego (tylko `sessionStorage`) |
| `badminton-serve-picker-match` | ID meczu z aktywnym serve pickerem |

### Supabase (gdy `js/config.js` skonfigurowany)

| Tabela | Zawartość |
|--------|-----------|
| `app_state` | `user_id` → JSON profilu (`userSession`, `pinHash`, powiadomienia) |
| `league_state` | `league_id = 'default'` → JSON ligi (`players`, `teams`, `matches`, `tombstones`, `signupInvites`) |

**Realtime:** subskrypcja zmian `league_state` → merge w `applyLeagueState({ merge: true })`.

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

### `userSession`

```js
{
  playerId, avatarUrl, notifications: boolean,
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

- `BadmintonCloud.signUpWithEmail()` → jeśli **Confirm email** w Supabase: brak `session`, zielony komunikat + `resendSignupEmail()`
- PIN 4 cyfry przy rejestracji → `setUserPin()` po pierwszym logowaniu
- Google OAuth: `signInWithGoogle()` — nie działa w webview Messengera/Instagram (`isInAppBrowser()` → ostrzeżenie)

### Przejęcie konta gościa (`?claim=PLAYER_ID&t=TOKEN`)

1. `parseClaimFromUrl()` → `sessionStorage` + `inviteAuthMode = 'guest'`
2. Ekran auth z banerem „Gość → pełne konto”
3. Po logowaniu: `tryApplyGuestClaim(user)` w `ensurePlayerForAuthUser()`
   - Ten sam `player.id`, `isGuest=false`, `authUserId=user.id`
   - Mecze/statystyki/drużyny zostają (ID się nie zmienia)
   - **Jednorazowe** — po claim token nieważny
4. → automatycznie panel użytkownika (PIN, avatar, instalacja)

### Zaproszenie nowego gracza (`?join=TOKEN`)

1. `parseJoinFromUrl()` → `signupInvites` rozwiązywane po syncu
2. Standardowa rejestracja z banerem „X zaprasza”

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
| Profil gościa → Zaproś do konta | `ensureGuestClaimToken()` → `buildGuestInvitePayload()` |

### Share sheet (`openInviteShareSheet`, `dispatchInviteShare`)

Kanały: native, WhatsApp, Messenger, Instagram, SMS, e-mail, kopiuj.

**Ważne (ograniczenia platform):**
- **Nie używać** `navigator.share({ files })` jako pierwszego kroku dla Messengera/WhatsApp — otwiera systemowy picker, często wysyła sam obrazek bez linku
- Każdy kanał ma własną ścieżkę: tekst z **klikalnym URL** + grafika PNG w schowku / pobranych plikach
- Baner PNG: `generateInviteShareImage()` (canvas 600×320)

### Deep linki

```
https://.../badminton-stats/?claim=3&t=uuid
https://.../badminton-stats/?join=uuid
```

Po parsowaniu query usuwane przez `history.replaceState` (zostaje w `sessionStorage`).

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

## Render i stan UI

### Główne zmienne (pamięć)

```
currentTab: 'stats' | 'matches' | 'players'
statsSubView: null | 'global' | 'players' | 'h2h'
profileOpen, openMatchId, openPlayerId, openTeamId
newMatchOpen, newMatchDraft, newTeamOpen, newTeamDraft
setPlayOpen, setDetailN, editSetN, reopenMatchEdit
matchInfoOpen, servePickerPhase, servePickerMatchId
inviteShareOpen, inviteSharePayload, inviteAuthMode
authBootstrapPending, profileAuthMode, pinSetupOpen
```

### Punkt wejścia

`bootstrap()` → `BadmintonCloud.init()` → `render()`

`render()` kolejność:
1. `needsWelcomeScreen()` → `renderWelcomeChrome` (STOP)
2. `shouldShowPlayerAuthChrome()` → `renderAuthGateChrome` (STOP)
3. `profileOpen` → `renderProfile()`
4. Zakładka: stats / matches / players

**Eventy:** delegacja na `content` (**handler musi być `async`** jeśli używasz `await`!), osobno `#app` dla invite share.

### Modale

- `showAppConfirm()` — Promise, overlay `#app-confirm` (nie `window.confirm` dla ważnych akcji)
- `showToast(message, 'success'|'warn'|'info')`

---

## Pliki — mapa odpowiedzialności

| Plik | Rola |
|------|------|
| `js/app.js` | Cała logika UI, stan, mecze live, statystyki, zaproszenia, merge |
| `js/cloud.js` | Supabase client, auth, push/pull, realtime, `resendSignupEmail` |
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
| v153 | **Ekran powitalny:** wybór kibic vs zawodnik; ograniczenia kibica; logout → welcome; invite na welcome |

---

## Pułapki dla agenta (czytaj!)

1. **`await` tylko w `async` funkcjach** — błąd składni = martwa aplikacja (zero kliknięć). Handler: `content?.addEventListener('click', async e => {`
2. **Cache:** podbij **trzy miejsca:** `sw.js` `CACHE`, `index.html` `APP_CACHE_VER`, oraz `?v=` na `app.js` i `cloud.js` w `index.html`
3. **Nie używaj** `navigator.share({ files })` jako domyślnego share dla Messengera/WhatsApp
4. **Welcome przed auth** — `?claim=` / `?join=` pokazują welcome z wyróżnionym „Graj jako zawodnik”
5. **`commitLiveSet`** + merge: po zakończeniu seta chroni `beginLiveSettling` i reguła `isSetFinishedInMatch`
6. **`syncScoresFromSetForm`:** pola input mogą być nieaktualne vs model z przycisków +
7. **Supabase Confirm email:** mail idzie z Supabase, nie z apki — sprawdź SMTP/spam; w dev można wyłączyć Confirm
8. **`js/config.js`** w `.gitignore` — na Pages musi być w deployu u użytkownika
9. **Commit/push** tylko na wyraźną prośbę użytkownika
10. **`_live_app.js`, `fonts/roboto-mono*`** — lokalne śmieci, nie commitować

---

## Backlog / znane ograniczenia

- [ ] Wiele lig / `league_members` — teraz jedna liga `default`
- [ ] Powiadomienia push — tylko flaga `notifications` w profilu
- [ ] Statystyki H2H — część danych przykładowa
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
- [ ] `?v=` na `js/app.js` i `js/cloud.js` w `index.html`
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
| Mecz live | `beginLiveSet`, `commitLiveSet`, `finishLiveSet`, `adjustLiveScore`, `finalizeServeSide` |
| Merge | `mergeMatchByUpdatedAt`, `mergeMatchTimings`, `scrubGhostLiveSet`, `softUpdateMatchDetail` |
| Zaproszenia | `openInviteShareSheet`, `dispatchInviteShare`, `buildGuestInvitePayload`, `parseClaimFromUrl` |
| Render | `render()`, `renderWelcomeScreen`, `renderMatchDetailPage`, `renderSetPlayOverlay`, `renderAuthScreen` |
| Uprawnienia | `canEditMatch`, `canCreateMatch`, `canEditSetScores`, `isAppAdmin` |

---

*Ostatnia aktualizacja dokumentacji: czerwiec 2026, cache v153, `STATE_VERSION` 16.*
