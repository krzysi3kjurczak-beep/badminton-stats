# Handoff — stan projektu (czerwiec 2026)

## Przechowywanie danych
`localStorage` → `badminton-app-state`. Multi-user → backend (Supabase/Firebase).

## Ostatnie zmiany
- **Na żywo**: jeden badge pod datą (mniejszy); lista meczów bez duplikatu w scoreboardzie
- **Czas meczu**: `matchClock` od startu 1. seta (nie suma setów); pauza/wznowienie ikonkami przy zegarze
- **Szczegóły**: czas meczu, czas gry (suma setów), czas odpoczynku
- **Zakończ mecz**: przycisk `btn--accent` (jak Rozegraj set, kolor brązowo-pomarańczowy)
- **Archiwum**: data w przeszłości + notka; przycisk „Dodaj mecz archiwalny”; sety tylko wynik
- **Zawodnicy**: select z listy (bez avatarów); badge „W grze” → mecz na żywo
- **Long-press**: ikonki edycji/usuń na karcie meczu i secie
- **Set live**: input wyniku + plusy; „Zakończ set”; bez animacji przy każdym kliku; brak remisu w secie
- **Edycja meczu**: `reopenMatchEdit` → status active, Rozegraj set + Zapisz mecz

## Model (`stateVersion: 8`)
```js
matches: [{
  createdAt, matchClock?: { elapsedSec, status, lastTickAt, startedAt },
  firstSetStartedAt?, liveSet?, isArchive?, tempGuests?, ...
}]
```

## Pliki: `js/app.js`, `css/styles.css`, `sw.js` (cache v12)
