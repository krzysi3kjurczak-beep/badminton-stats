# Handoff — stan projektu (czerwiec 2026)

## Repo i deploy
- GitHub: `krzysi3kjurczak-beep/badminton-stats`
- Pages: https://krzysi3kjurczak-beep.github.io/badminton-stats/
- Ostatni push: `main` z pełnym flow meczów live/archiwum/debel

## Przechowywanie danych
- `localStorage` → klucz `badminton-app-state`
- `stateVersion: 9`
- Multi-user w przyszłości: Supabase/Firebase (szczegóły w rozmowach z userem)

## Model danych
```js
{
  stateVersion: 9,
  players: [{ id, displayName, isGuest? }],
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
- **Select zawodników**: `● Imię · w grze` tylko dla daty dzisiejszej
- **Debel**: istniejąca drużyna z zawodnikiem w grze = disabled (dziś)
- **Long-press**: ctx edytuj/usuń; aktywny mecz na liście = usuń; set (także live) = usuń z confirm
- **Widok seta**: karty stron z avatarami/nazwami; usuń set (live i edycja); edycja/dodanie seta = ten sam układ co live
- **Debel w meczu**: zielony znaczek edycji na avatarze drużyny → panel nazwa + avatar; `findTeamByPlayerIds()` przy tworzeniu meczu
- **Profil**: Zapisz tylko po zmianie imienia; mały ✕ przy zdjęciu
- **Zakończ mecz**: disabled bez setów; edycja zakończonego = tylko punkty („Dodaj set”); klik seta w edycji = od razu formularz punktów

## Pliki
- `js/app.js` — cała logika (~2900 linii)
- `css/styles.css` — style
- `sw.js` — cache **v24**
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
- Brak backendu — dane tylko lokalnie
- Dodawanie zawodnika z kontem (FAB na zakładce Zawodnicy) — placeholder alert
- Statystyki H2H — przykładowe dane na sztywno
- Powiadomienia — tylko preferencja w profilu

## Po większych zmianach
1. Podbić `CACHE` w `sw.js`
2. Podbić `STATE_VERSION` + migracja w `loadState()` jeśli zmiana modelu
3. Zaktualizować ten plik
