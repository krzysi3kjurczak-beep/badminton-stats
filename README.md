# Badminton Stats — prototyp

Wizualny prototyp aplikacji (PWA) do oceny wyglądu.

## Jak obejrzeć

### Na komputerze
Otwórz plik `index.html` w Chrome (kliknij dwukrotnie lub przeciągnij do przeglądarki).

### Na telefonie (ta sama sieć Wi‑Fi)

1. W terminalu, w folderze projektu, uruchom serwer:
   ```powershell
   node serve.js
   ```
   Jeśli `node` nie działa w zwykłym terminalu, użyj pełnej ścieżki z Cursora:
   ```powershell
   & "$env:LOCALAPPDATA\Programs\cursor\resources\app\resources\helpers\node.exe" serve.js
   ```
2. Na telefonie otwórz Chrome i wejdź na adres z terminala, np. `http://192.168.1.132:3456`
3. Zatrzymanie serwera: `Ctrl+C` w terminalu.

**Uwaga:** Telefon i komputer muszą być w tej samej sieci Wi‑Fi. Przy pierwszym uruchomieniu Windows może zapytać o zezwolenie w zaporze — kliknij „Zezwól”.

**Instalacja jako apka (PWA):** W Chrome na Androidzie: menu ⋮ → „Dodaj do ekranu głównego”. Na iPhonie: Udostępnij → „Do ekranu początkowego”.

## Co jest w prototypie

- 3 zakładki: Statystyki, Mecze, Zawodnicy
- Ciemny motyw z zielonym akcentem
- Przykładowe dane z AppSheet (Krzysiek, Julia, Michał, Ola, Maciek)
- Podgląd statystyk (globalne, ranking, konfrontacje)
- Responsywny wygląd pod telefon i tablet
- PWA (`manifest.json`, `sw.js`)

## Następne kroki

Po Twojej opinii o wyglądzie: dodawanie meczów, graczy i prawdziwe statystyki.
