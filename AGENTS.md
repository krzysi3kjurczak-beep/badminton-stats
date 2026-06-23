# Badminton App — wskazówki dla agenta

**Zawsze czytaj i aktualizuj `docs/HANDOFF.md` po większych zmianach.**

## Projekt
PWA HTML/CSS/JS, mobile-first, ciemny motyw, akcent `#3dd68c`.

## Pliki
- `js/app.js` — logika + localStorage
- `css/styles.css` — style
- `index.html`, `manifest.json`, `sw.js`
- `docs/HANDOFF.md` — stan, model danych, backlog, **architektura storage**

## GitHub Pages
https://krzysi3kjurczak-beep.github.io/badminton-stats/

## Dane — gdzie i co dalej
- **Teraz:** `localStorage` klucz `badminton-app-state` — dane tylko na urządzeniu użytkownika
- **Nowe mecze:** `matches.unshift()` + `saveState()`; formularz FAB → `createMatchFromDraft()`
- **Multi-user:** potrzebny backend (Firestore/Supabase rekomendowane) — szczegóły w HANDOFF

## Konwencje
- Zawodnik: `{ id, displayName, isGuest? }` — nazwy **unikalne** (case-insensitive)
- Drużyna: `{ id, name, avatarUrl?, playerIds: [id1, id2] }` — zapis przy meczu deblowym
- Mecz: `teamMeta.A/B` dla debli (`name`, `avatarUrl`, `teamId?`), `status: active|finished`
- Avatary: user session + `teamMeta.avatarUrl` w deblu
- Po zmianach: podbij `CACHE` w `sw.js` i `stateVersion` jeśli migracja danych

## Push (Windows)
```
& "C:\Program Files\Git\bin\git.exe" add .
& "C:\Program Files\Git\bin\git.exe" -c user.name="krzysi3kjurczak-beep" -c user.email="krzysi3kjurczak-beep@users.noreply.github.com" commit -m "..."
& "C:\Program Files\Git\bin\git.exe" push
```
