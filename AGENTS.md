# Badminton App — wskazówki dla agenta

**Zawsze czytaj i aktualizuj `docs/HANDOFF.md` po większych zmianach.**

## Projekt
PWA HTML/CSS/JS, mobile-first, ciemny motyw, akcent `#3dd68c`. Cache **v133**.

## Pliki
- `js/app.js` — logika + localStorage + merge sync
- `js/cloud.js` — Supabase auth + realtime
- `css/styles.css` — style
- `index.html`, `manifest.json`, `sw.js`
- `docs/HANDOFF.md` — stan, model, sync, backlog

## GitHub Pages
https://krzysi3kjurczak-beep.github.io/badminton-stats/

## Dane
- **Lokalnie:** `localStorage` → `badminton-app-state`
- **Chmura:** Supabase `app_state` + `league_state` (szczegóły w HANDOFF)
- **Nowe mecze:** `matches.unshift()` + `saveState()`; FAB → `createMatchFromDraft()`

## Konwencje
- Zawodnik: `{ id, displayName, isGuest?, authUserId? }` — nazwy unikalne (case-insensitive)
- Drużyna: `{ id, name, avatarUrl?, playerIds }`; mecz deblowy: `teamMeta.A/B`
- Mecz: `status: active|finished`; `scoreA/B` = wygrane sety; sety w `sets[]`
- Live: `liveSet` + opcjonalnie `serveDuel`; merge multi-device — patrz HANDOFF
- Po zmianach: podbić cache w `sw.js` + `index.html`; `STATE_VERSION` jeśli migracja

## Push (Windows)
```
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" -c user.name="krzysi3kjurczak-beep" -c user.email="krzysi3kjurczak-beep@users.noreply.github.com" commit -m "..."
& "C:\Program Files\Git\bin\git.exe" push
```
