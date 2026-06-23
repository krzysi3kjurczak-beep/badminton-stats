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
    matchClock?: { elapsedSec, status: idle|running|paused, lastTickAt, startedAt },
    firstSetStartedAt?, liveSet?,
    teamMeta?: { A: { name?, avatarUrl?, teamId? }, B: {...} },
    tempGuests?: { [tempId]: 'Imię gościa' },
  }],
  userSession: { playerId, avatarUrl, notifications, loggedIn },
}
```

## Kluczowa logika (`js/app.js`)
- **Na żywo / przerwa**: `isMatchLiveActive()`; pauza meczu → `isMatchOnBreak()` → badge „Przerwa” (żółty) w widoku meczu, liście meczów, szczegółach; zawodnicy wciąż „w grze” w formularzu i zakładce Zawodnicy
- **Czas meczu**: widoczny od utworzenia (00:00, zatrzymany); start przy 1. secie; pauza meczu pauzuje też aktywny set; statystyki live (czas meczu biały, czas realnej gry, odpoczynek)
- **Set live**: Start seta → Zakończ set; mały guzik pauzy pod czasem; plusy zawsze aktywne; auto-zapis przy poprawnym wyniku badmintonowym
- **Archiwum**: data < dziś; sety tylko wynik
- **Formularz meczu**: deble domyślnie „Istniejąca drużyna” (jeśli są drużyny); jedna drużyna → druga strona „Nowa”; kostka w polu nazwy; kalendarz zamyka się tylko ponownym kliknięciem w pole daty
- **Select zawodników**: `● Imię · w grze` tylko dla daty dzisiejszej
- **Debel**: istniejąca drużyna z zawodnikiem w grze = disabled (dziś)
- **Long-press**: mały pasek ctx (edytuj/usuń); sety zakończonego meczu tylko podgląd (edycja po „Edytuj mecz”)
- **Zakończ mecz**: disabled bez setów; edycja zakończonego = tylko punkty („Dodaj set”)

## Pliki
- `js/app.js` — cała logika (~2900 linii)
- `css/styles.css` — style
- `sw.js` — cache **v17**
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
