# Badminton App — wskazówki dla agenta

**Zawsze czytaj i aktualizuj `docs/HANDOFF.md` po większych zmianach** — to pełna dokumentacja projektu.

## Projekt
PWA HTML/CSS/JS (vanilla), mobile-first, ciemny motyw, akcent `#3dd68c`.

- **Live:** https://krzysi3kjurczak-beep.github.io/badminton-stats/
- **Cache:** `badminton-stats-v259` (`sw.js` + `APP_CACHE_VER` w `index.html`)
- **Dane:** `STATE_VERSION = 26` w `js/app.js`

## Pliki kluczowe
| Plik | Rola |
|------|------|
| `js/app.js` | Logika UI, stan, mecze live, zaproszenia, merge sync |
| `js/cloud.js` | Supabase auth + realtime |
| `js/config.js` | URL + anon key (puste = tylko lokalnie) |
| `css/styles.css` | Style |
| `docs/HANDOFF.md` | **Pełny handoff — czytaj najpierw** |
| `docs/SUPABASE-SETUP.md` | Setup chmury |

## Dane
- **Lokalnie:** `localStorage` → `badminton-app-state`
- **Chmura:** Supabase `app_state` (profil) + `league_state` (liga `default`)
- **Nowy mecz:** `matches.unshift()` + `saveState()`; FAB → `createMatchFromDraft()`

## Konwencje
- Zawodnik: `{ id, displayName, isGuest?, authUserId? }` — nazwy unikalne (case-insensitive)
- Gość z claim: `pendingClaim.token`, link `?claim=ID&t=TOKEN`
- Drużyna: `{ id, name, avatarUrl?, playerIds }`; debel: `teamMeta.A/B`
- Mecz: `status: active|finished`; `scoreA/B` = wygrane sety; `liveSet` podczas gry
- Po zmianach: podbić cache (`sw.js`, `index.html` APP_CACHE_VER + `?v=` na JS)
- **Welcome (v153):** rola w `sessionStorage` (`badminton-app-role`: `spectator`|`player`); kibic = stats+mecze bez FAB/profili; logout → welcome

## Pułapki
- `await` tylko w `async` handlerach (v151/v152 — martwa apka przy błędzie składni)
- Share Messengera/WhatsApp: nie `navigator.share({files})` jako pierwszy krok
- `?claim=` / `?join=` → welcome z wyróżnionym „Graj jako zawodnik”, potem auth
- Commit/push **tylko na prośbę użytkownika**

## Push (Windows)
```powershell
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" -c user.name="krzysi3kjurczak-beep" -c user.email="krzysi3kjurczak-beep@users.noreply.github.com" commit -m "..."
& "C:\Program Files\Git\bin\git.exe" push
```
