# Supabase — konfiguracja chmury (krok po kroku)

Nie musisz „umieć w programowaniu”. Wystarczy klikanie w panelu Supabase i wklejenie dwóch linijek do pliku `js/config.js`. Resztę (logowanie, synchronizacja) robi już aplikacja.

**Czas:** ok. 20–30 minut przy pierwszym razie.

---

## Co dostaniesz na końcu

- To samo konto na telefonie i komputerze (Google **lub** email + hasło).
- Mecze, zawodnicy i drużyny zapisane w chmurze.
- Nadal działa offline — po powrocie sieci dane się wysyłają.

---

## Krok 1 — Załóż konto Supabase

1. Wejdź na [https://supabase.com](https://supabase.com).
2. **Start your project** → zaloguj się przez **GitHub** (najprościej).
3. **New project**:
   - **Name:** np. `badminton-stats`
   - **Database password:** wymyśl silne hasło i **zapisz je** (np. w notatniku) — to hasło do bazy, nie do logowania w aplikacji.
   - **Region:** wybierz najbliższy (np. Frankfurt).
4. Poczekaj 1–2 minuty, aż projekt się utworzy.

---

## Krok 2 — Utwórz tabele w bazie

1. W lewym menu: **SQL Editor**.
2. **New query**.
3. Otwórz `supabase/schema.sql`, skopiuj **całą** zawartość i wklej → **Run**.
4. **New query** ponownie.
5. Otwórz `supabase/league_schema.sql`, skopiuj **całą** zawartość i wklej → **Run**.
6. Powinno być zielone „Success” — tabele `app_state` (profil) i `league_state` (wspólne mecze) są gotowe.

---

## Krok 3 — Skopiuj adres i klucz API

1. **Project Settings** (ikona koła zębatego) → **API**.
2. Skopiuj:
   - **Project URL** (np. `https://abcdefgh.supabase.co`)
   - **anon public** (długi klucz pod „Project API keys”)

3. W projekcie otwórz `js/config.js` i wklej:

```js
window.APP_CONFIG = {
  supabaseUrl: 'https://TWOJ-PROJEKT.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};
```

4. Zapisz plik. Jeśli testujesz lokalnie — odśwież stronę. Po wdrożeniu na GitHub Pages — zrób commit i push (albo poproś agenta).

> **Uwaga:** klucz `anon` jest **publiczny** w aplikacji — to normalne. `app_state` = tylko Twój profil; `league_state` = wspólna liga (czytają i zapisują wszyscy zalogowani).

---

## Krok 4 — Logowanie emailem i hasłem

1. W Supabase: **Authentication** → **Providers**.
2. **Email** — włączony domyślnie.
3. **Ważne — rejestracja bez maila aktywacyjnego** (zalecane):
   - **Authentication** → **Providers** → **Email**
   - Wyłącz **Confirm email** (przełącznik OFF).
   - Zapisz zmiany.
   - Po tym: e-mail + hasło w aplikacji = konto od razu aktywne, bez linku w skrzynce.
4. Jeśli **Confirm email** jest włączone, Supabase wymaga kliknięcia linku — aplikacja nie może tego obejść z poziomu kodu.

Rejestracja w aplikacji: Profil → **Zarejestruj się** → e-mail + hasło (min. 6 znaków) + PIN (4 cyfry).

---

## Krok 5 — Logowanie przez Google

**Szczegółowa instrukcja (łopatologicznie):** [`docs/GOOGLE-LOGIN.md`](GOOGLE-LOGIN.md)

Skrót:

1. [https://console.cloud.google.com](https://console.cloud.google.com) → nowy projekt (np. `badminton-app`).
2. **APIs & Services** → **OAuth consent screen** → External → wypełnij nazwę aplikacji, zapisz.
3. **Credentials** → **Create Credentials** → **OAuth client ID** → **Web application**.
4. **Authorized JavaScript origins** — dodaj oba:
   - `https://krzysi3kjurczak-beep.github.io`
   - `http://localhost` (opcjonalnie, do testów)
5. **Authorized redirect URIs** — dodaj **dokładnie** (zamień `TWOJ-PROJEKT` na swój URL z kroku 3):

```
https://TWOJ-PROJEKT.supabase.co/auth/v1/callback
```

6. Skopiuj **Client ID** i **Client Secret**.

### 5b. Supabase

1. **Authentication** → **Providers** → **Google** → Enable.
2. Wklej Client ID i Client Secret → **Save**.

### 5c. Adresy powrotu w Supabase

1. **Authentication** → **URL Configuration**.
2. **Site URL:**

```
https://krzysi3kjurczak-beep.github.io/badminton-stats/
```

3. **Redirect URLs** — dodaj:

```
https://krzysi3kjurczak-beep.github.io/badminton-stats/
http://localhost:5500/
http://127.0.0.1:5500/
```

(Zależnie od tego, jak otwierasz plik lokalnie.)

---

## Krok 6 — Sprawdzenie

1. Otwórz aplikację → ikona profilu (góra prawo).
2. **Zaloguj się przez Google** lub **Załóż konto** (email).
3. Po zalogowaniu w profilu powinna być widoczna **synchronizacja** (status „Zsynchronizowano”).
4. W Supabase: **Table Editor** → `app_state` — po pierwszym zapisie meczu powinien pojawić się wiersz z Twoim `user_id`.

Na drugim urządzeniu: ta sama aplikacja, to samo konto → te same mecze.

---

## Usuwanie konta z aplikacji

W profilu jest opcja **Usuń konto** (wymaga potwierdzenia hasłem lub biometrią).

Jednorazowo uruchom w **SQL Editor** plik `supabase/delete_account.sql` — bez tego przycisk zwróci błąd z Supabase.

---

## Reset testowych kont (od zera)

Aplikacja **nie może** usuwać kont z Supabase — to robisz w panelu:

1. **Authentication** → **Users** — zaznacz testowe konta → **Delete user**.
2. **Table Editor** → `app_state` — usuń wszystkie wiersze (dane w chmurze).
3. W przeglądarce (telefon / komputer): wyczyść dane strony dla adresu aplikacji (localStorage) albo tryb prywatny / Ctrl+F5 po usunięciu kont.

Potem możesz zarejestrować się ponownie i przetestować cały flow.

---

## Rozwiązywanie problemów

| Problem | Co zrobić |
|--------|-----------|
| „Synchronizacja nie skonfigurowana” | Uzupełnij `js/config.js` i odśwież stronę (Ctrl+F5). |
| Google wraca z błędem | Sprawdź redirect URI w Google i URL Configuration w Supabase. |
| „Invalid login credentials” | Złe hasło lub konto nie istnieje — użyj **Załóż konto**. |
| Po rejestracji nic się nie dzieje / brak maila | Wyłącz **Confirm email** w Supabase (Authentication → Providers → Email). Usuń stare testowe konto w Users i zarejestruj się ponownie. |
| Stare dane tylko na jednym telefonie | Zaloguj się na tym urządzeniu — lokalne dane wysyłają się przy pierwszym logowaniu, jeśli chmura jest pusta. |

---

## Co dalej (opcjonalnie)

- Avatary w **Storage** zamiast base64 w JSON (lżejsza synchronizacja).
- Wspólna „liga” dla wielu osób (inny model niż „tylko moje urządzenia”).
- Automatyczny deploy `config.js` przez GitHub Actions (na później).

Jeśli utkniesz na którymś kroku — napisz na którym numerze, pomogę.
