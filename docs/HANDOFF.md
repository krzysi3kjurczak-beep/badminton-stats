# Handoff — stan projektu (czerwiec 2026)

## Repo i deploy
- GitHub: `krzysi3kjurczak-beep/badminton-stats`
- Pages: https://krzysi3kjurczak-beep.github.io/badminton-stats/
- Ostatni push: `main` z pełnym flow meczów live/archiwum/debel

## Przechowywanie danych
- **Lokalnie:** `localStorage` → klucz `badminton-app-state`
- **Chmura (opcjonalnie):** Supabase — tabela `app_state`, jeden wiersz na użytkownika (JSON)
- **Konfiguracja:** `js/config.js` + instrukcja `docs/SUPABASE-SETUP.md`
- `stateVersion: 12` — deduplikacja zawodników (goście po nazwie, konta po `authUserId`); v11 czyści stare konta
- Zawodnik: `{ id, displayName, isGuest?, authUserId? }` — konto Supabase ↔ `authUserId`
- Po rejestracji: od razu panel profilu (nazwa, avatar); flaga `authWantsProfile` + fix sync nie zeruje `loggedIn`
- Rejestracja: generator hasła (kostka), poprawione ikony pokaż/ukryj hasło
- Brak demo-zawodników i demo-meczów w nowej instalacji
- Logowanie: Google OAuth + email/hasło (profil)
- Sync: przy logowaniu pull/push; przy `saveState()` debounced push

## Model danych
```js
{
  stateVersion: 9,
  players: [{ id, displayName, isGuest?, authUserId? }],
  teams: [{ id, name, avatarUrl?, playerIds: [id1, id2] }],
  matches: [{
    id, date, teamA[], teamB[], scoreA, scoreB,
    status: 'active' | 'finished',
    result, winnerId, sets[],
    isArchive?, createdAt,
    matchClock?: { elapsedSec, status: idle|running|stopped, lastTickAt, startedAt },
    matchTiming?: { restSec, breakPeriods[], phase, phaseStartedAt },
    firstSetStartedAt?, liveSet?,
    teamMeta?: { A: { name?, avatarUrl?, teamId? }, B: {...} },
    tempGuests?: { [tempId]: 'Imię gościa' },
  }],
  userSession: { playerId, avatarUrl, notifications, loggedIn },
}
```

## Kluczowa logika (`js/app.js`)
- **W trakcie / przerwa / rozgrzewka**: `getMatchPhase()` → `live` | `break` | `warmup`; badge „W trakcie” (zielona kropka); przerwa = pauza seta lub między setami; rozgrzewka = przed 1. setem; żółty badge „Przerwa” wszędzie; aktywny mecz = zielona obwódka kafelka (wszystkie fazy)
- **Avatary**: zawsze na zewnątrz — lewa strona po lewej od nazwy, prawa po prawej od nazwy (`match-board`)
- **Czas meczu**: leci zawsze (od utworzenia meczu), także między setami; globalny ticker `tickAllLiveMatches()`; biały, większy; bez pauzy w widoku meczu; po zakończeniu szary
- **Pauza**: tylko w widoku seta — zatrzymuje czas seta, ustawia przerwę globalnie
- **Statystyki live**: czas meczu, czas realnej gry, czas odpoczynku (pauza seta + przerwy między setami), średni czas seta, **średni czas przerwy** (tylko między setami, bez pauzy w secie) — dynamicznie w panelu info
- **Fazy timing**: `getTimingPhase()` → `live` | `set_pause` | `inter_break` | `warmup`; UI badge używa `getMatchPhase()` (set_pause + inter_break = przerwa)
- **Kafelki meczów**: większe avatary (48px) i wynik (2.25rem); status live mniejszy
- **Edycja zakończonego**: brak statusu, zegar zamrożony szary, „Zapisz mecz” bez confirm
- **Set live**: Start seta → Zakończ set; mały guzik pauzy pod czasem; plusy zawsze aktywne; auto-zapis przy poprawnym wyniku badmintonowym
- **Archiwum**: data < dziś; sety tylko wynik
- **Formularz meczu**: deble domyślnie „Istniejąca drużyna” (jeśli są drużyny); jedna drużyna → druga strona „Nowa”; kostka w polu nazwy; kalendarz zamyka się tylko ponownym kliknięciem w pole daty
- **Pickery (dropdown)**: wspólny komponent `.dropdown-picker` — wybór drużyny (istniejąca) oraz zawodników (singiel + tworzenie drużyny); sekcje **Zawodnicy / Goście / Dodaj**; nazwy `font-weight: 500` (bez bolda); `● Imię · w grze` tylko dla daty dzisiejszej
- **Debel**: istniejąca drużyna z zawodnikiem w grze = disabled (dziś)
- **Long-press**: ctx edytuj/usuń; aktywny mecz na liście = usuń; set (także live) = usuń z confirm
- **Widok seta**: karty stron z avatarami/nazwami; usuń set (live i edycja); edycja/dodanie seta = ten sam układ co live
- **Debel w meczu**: przycisk edycji na avatarze (szare tło jak ✕ w profilu); panel nazwa + avatar; walidacja drużyn — wspólny zawodnik w obu istniejących drużynach = blokada
- **Formularz meczu**: gość wpisywany inline w polu zawodnika (bez osobnego panelu)
- **Widok meczu (UI)**: większy wynik na telefonie; mniejszy badge statusu; nazwy drużyn `clamp()` + zawijanie; zegar monospace (odróżnienie od wyniku); status seta live pod „Set N”; statystyki: czas gry zielony, odpoczynek żółty; etykieta „Średnia punktów w secie (łącznie)”
- **Profil**: Zapisz tylko po zmianie imienia; mały ✕ przy zdjęciu
- **Zakończ mecz**: disabled bez setów; edycja zakończonego = tylko punkty („Dodaj set”); klik seta w edycji = od razu formularz punktów

## Pliki
- `js/app.js` — cała logika
- `js/cloud.js` — Supabase auth + synchronizacja
- `js/config.js` — URL i klucz API (puste = tylko lokalnie)
- `docs/SUPABASE-SETUP.md` — konfiguracja chmury krok po kroku
- `supabase/schema.sql` — schemat bazy
- `css/styles.css` — style
- `sw.js` — cache **v40**
- `AGENTS.md` — skrót dla agenta
- `index.html`, `manifest.json`

## Zmienne UI (stan w pamięci)
`newMatchOpen`, `newMatchDraft`, `setPlayOpen`, `editSetN`, `setDetailN`, `reopenMatchEdit`, `ctxTarget`, `openMatchId`, `matchInfoOpen`

## Git (Windows, bez globalnego git config)
```powershell
& "C:\Program Files\Git\bin\git.exe" -C "C:\Users\kjurc\Projects\badminton-stats" status
& "C:\Program Files\Git\bin\git.exe" -C "..." -c user.name="krzysi3kjurczak-beep" -c user.email="krzysi3kjurczak-beep@users.noreply.github.com" commit -m "..."
& "C:\Program Files\Git\bin\git.exe" -C "..." push origin main
```

## Backlog / znane ograniczenia
- Bez `config.js` — dane tylko lokalnie (przycisk „Kontynuuj lokalnie”); uprawnienia meczów wyłączone
- Avatary nadal base64 w JSON (Storage — później)
- **Liga (plan):** jedna liga na start; wspólny `league_state` zamiast `app_state` per user — Faza 3
- **Uprawnienia meczów (v63):** edycja/usuwanie = uczestnik meczu lub admin (`krzysi3k.jurczak@gmail.com`); dodawanie meczu = każdy zalogowany z kontem; podgląd live dla wszystkich
- **v66 (krytyczny fix):** podwójna deklaracja `const m` w `remove-match-team-avatar` blokowała parsowanie całego `app.js` (pusta aplikacja, martwe zakładki). Bootstrap: ekran logowania zamiast pustego contentu + timeout 5s
- **v67:** ikona logowania w nagłówku (dostęp do panelu bez sesji), przewijanie formularza singla przy wyborze zawodnika, panel edycji drużyny nad dolną nawigacją
- Zaproszenia gości: link claim + Web Share (WhatsApp/Messenger) — Faza 2
- Statystyki H2H — przykładowe dane na sztywno
- Powiadomienia — tylko preferencja w profilu

## Liga — ustalenia (czerwiec 2026)
1. **Jedna liga** na start (wszyscy znajomi w jednej grupie)
2. **Nowy mecz:** każdy zalogowany zawodnik z kontem Supabase
3. **Edycja / usuwanie meczu:** tylko uczestnik (singiel lub członek drużyny w deblu) + admin
4. **Podgląd:** każdy może przeglądać listę i oglądać mecze na żywo bez możliwości zmian
5. **Następny krok architektury:** tabele `leagues`, `league_members`, `league_state` (wspólny JSON lub normalizacja)

## Po większych zmianach
1. Podbić `CACHE` w `sw.js`
2. Podbić `STATE_VERSION` + migracja w `loadState()` jeśli zmiana modelu
3. Zaktualizować ten plik
