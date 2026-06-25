# Badminton App

PWA do śledzenia meczów i statystyk badmintona (singiel i debel). Mobile-first, ciemny motyw, opcjonalna synchronizacja przez Supabase.

**Live:** https://krzysi3kjurczak-beep.github.io/badminton-stats/

## Dla deweloperów / agentów AI

→ **[docs/HANDOFF.md](docs/HANDOFF.md)** — pełna dokumentacja projektu (architektura, model danych, sync, zaproszenia, pułapki).

→ **[AGENTS.md](AGENTS.md)** — skrót dla agenta.

→ **[docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md)** — konfiguracja chmury krok po kroku.

→ **[docs/GOOGLE-LOGIN.md](docs/GOOGLE-LOGIN.md)** — logowanie Google OAuth.

## Lokalny podgląd

```powershell
node serve.js
```

Otwórz w przeglądarce adres z terminala (np. `http://192.168.x.x:3456`). Telefon i komputer w tej samej sieci Wi‑Fi.

Opcjonalnie: skopiuj `js/config.example.js` → `js/config.js` i uzupełnij klucze Supabase.

## Instalacja jako PWA

Chrome Android: menu ⋮ → „Dodaj do ekranu głównego”.  
iPhone Safari: Udostępnij → „Do ekranu początkowego”.

## Stack

- HTML / CSS / vanilla JavaScript (bez bundlera)
- `localStorage` + opcjonalnie Supabase (auth, realtime)
- GitHub Pages + service worker (`sw.js`)
