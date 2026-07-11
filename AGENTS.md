# Badminton App — wskazówki dla agenta

**Zawsze czytaj i aktualizuj `docs/HANDOFF.md` po większych zmianach** — to pełna dokumentacja projektu.

## Projekt
PWA HTML/CSS/JS (vanilla), mobile-first, ciemny motyw, akcent `#3dd68c`.

- **Live:** https://krzysi3kjurczak-beep.github.io/badminton-stats/
- **Cache:** `badminton-stats-v290` (`sw.js` + `APP_CACHE_VER` w `index.html`)
- **Dane:** `STATE_VERSION = 27` w `js/app.js`

## Pliki kluczowe
| Plik | Rola |
|------|------|
| `js/app.js` | Logika UI (~17k linii), stan, mecze live, statystyki, planowanie, powiadomienia, merge |
| `js/cloud.js` | Supabase auth + realtime + push/pull |
| `js/push.js` | Web Push (subskrypcja, lokalny push) |
| `js/config.js` | URL + anon key (puste = tylko lokalnie) |
| `css/styles.css` | Style |
| `docs/HANDOFF.md` | **Pełny handoff — czytaj najpierw** |
| `docs/SUPABASE-SETUP.md` | Setup chmury |

## Dane
- **Lokalnie:** `localStorage` → `badminton-app-state`
- **Chmura:** Supabase `app_state` (profil) + `league_state` (liga `default`)
- **Powiadomienia:** `planNotifications[]` w stanie ligi (nie osobna tabela)
- **Nowy mecz:** `matches.unshift()` + `saveState()`; FAB → planowanie / nowy mecz

## Konwencje
- Zawodnik: `{ id, displayName, isGuest?, authUserId? }` — nazwy unikalne (case-insensitive)
- Gość z claim: `pendingClaim.token`, link `?claim=ID&t=TOKEN`
- Drużyna: `{ id, name, avatarUrl?, playerIds }`; debel: `teamMeta.A/B`
- Mecz: `status: active|finished`; `scoreA/B` = wygrane sety; `liveSet` podczas gry
- Seria debla: `rotationSessionId`, `rotationFromMatchId`
- Statystyki: `computePlayerStats()` → `{ singles, doubles, combined }`
- Po zmianach: podbić cache (`sw.js`, `index.html` APP_CACHE_VER + `?v=` na JS/CSS)
- **Welcome (v153):** rola w `sessionStorage` (`badminton-app-role`: `spectator`|`player`); kibic = stats+mecze bez FAB/profili; logout → welcome

## Pułapki
- `await` tylko w `async` handlerach (v151/v152 — martwa apka przy błędzie składni)
- Share Messengera/WhatsApp: nie `navigator.share({files})` jako pierwszy krok
- `?claim=` / `?join=` / `?plan=` → welcome z wyróżnionym „Graj jako zawodnik”, potem auth
- **Centrum powiadomień** montowane na `#app` — handlery na `document`, nie `#content`
- Pasek usuwania powiadomień: `pointer-events: auto` na `.notif-list-select-bar`
- Przyciski z `data-match-id` + `data-action` — ogólny handler listy ignoruje elementy z `data-action`
- Commit/push **tylko na prośbę użytkownika**
- Nie commitować: `_live_app.js`, `fonts/roboto-mono*`, `supabase/.temp/`

## Push (Windows)
```powershell
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" -c user.name="krzysi3kjurczak-beep" -c user.email="krzysi3kjurczak-beep@users.noreply.github.com" commit -m "..."
& "C:\Program Files\Git\bin\git.exe" push
```
