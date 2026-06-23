# Logowanie przez Google — krok po kroku

Potrzebujesz **dwóch stron w przeglądarce** (otwórz w osobnych kartach):

1. **Google Cloud Console** — żeby Google wiedziało, że Twoja aplikacja może prosić o logowanie  
2. **Supabase** — żeby połączyć Google z Twoją bazą  

Kod w aplikacji **już jest** — po konfiguracji wystarczy kliknąć „Zaloguj się przez Google” w profilu.

**Twój adres Supabase** (z `config.js`):

```
https://prmmnqcjyvghphvnmhkh.supabase.co
```

**Adres aplikacji na GitHub Pages:**

```
https://krzysi3kjurczak-beep.github.io/badminton-stats/
```

---

## CZĘŚĆ 1 — Google Cloud (ok. 15 min)

### 1. Wejdź na stronę

[https://console.cloud.google.com](https://console.cloud.google.com)

Zaloguj się tym samym kontem Google, którego chcesz używać do testów.

### 2. Nowy projekt

1. U góry kliknij nazwę projektu → **New project**
2. Nazwa: np. `badminton-app`
3. **Create**
4. Poczekaj chwilę i **upewnij się**, że ten projekt jest wybrany u góry

### 3. Ekran zgody OAuth (consent screen)

1. Menu ☰ → **APIs & Services** → **OAuth consent screen**
2. **External** → **Create**
3. Wypełnij minimum:
   - **App name:** `Badminton App`
   - **User support email:** Twój email
   - **Developer contact:** Twój email
4. **Save and Continue** → dalej (Scopes) → **Save and Continue** → (Test users) → **Save and Continue** → **Back to Dashboard**

> Na start aplikacja jest w trybie „Testing” — wystarczy, żebyś Ty i znajomi (max kilka osób) mogli się logować. Później można opublikować.

### 4. Utwórz Client ID

1. **APIs & Services** → **Credentials**
2. **+ Create Credentials** → **OAuth client ID**
3. **Application type:** Web application
4. **Name:** np. `badminton-web`

**Authorized JavaScript origins** — kliknij **+ Add URI** i dodaj **dokładnie**:

```
https://krzysi3kjurczak-beep.github.io
```

(Jeśli testujesz lokalnie, dodaj też `http://localhost` — opcjonalnie.)

**Authorized redirect URIs** — kliknij **+ Add URI** i wklej **dokładnie** (skopiuj całość):

```
https://prmmnqcjyvghphvnmhkh.supabase.co/auth/v1/callback
```

5. **Create**
6. Pojawi się okienko z **Client ID** i **Client secret** — **skopiuj oba** (np. do notatnika). Secret później znowu pokażesz w Google, ale łatwiej od razu zapisać.

---

## CZĘŚĆ 2 — Supabase (ok. 5 min)

### 5. Włącz Google

1. [supabase.com](https://supabase.com) → Twój projekt
2. **Authentication** → **Providers**
3. Znajdź **Google** → rozwiń → **Enable** (włącz)
4. Wklej:
   - **Client ID** (z Google)
   - **Client Secret** (z Google)
5. **Save**

### 6. Adresy powrotu

1. **Authentication** → **URL Configuration**
2. **Site URL** — wklej:

```
https://krzysi3kjurczak-beep.github.io/badminton-stats/
```

3. **Redirect URLs** — kliknij **Add URL** i dodaj tę samą linię:

```
https://krzysi3kjurczak-beep.github.io/badminton-stats/
```

4. **Save**

---

## CZĘŚĆ 3 — Test

1. Otwórz aplikację:  
   [https://krzysi3kjurczak-beep.github.io/badminton-stats/](https://krzysi3kjurczak-beep.github.io/badminton-stats/)
2. **Ctrl+F5** (twarde odświeżenie)
3. Kliknij **avatar** (profil, góra prawo)
4. **Zaloguj się przez Google**
5. Wybierz konto Google → zatwierdź
6. Powinieneś wrócić do aplikacji i być zalogowany (email Google w profilu, status synchronizacji)

---

## Gdy coś nie działa

| Objaw | Co sprawdzić |
|--------|----------------|
| `redirect_uri_mismatch` | W Google → Credentials → redirect URI musi być **dokładnie** `https://prmmnqcjyvghphvnmhkh.supabase.co/auth/v1/callback` (bez spacji, bez `/` na końcu) |
| Wraca do aplikacji, ale nie jesteś zalogowany | Supabase → URL Configuration → Site URL i Redirect URLs jak wyżej |
| „Access blocked” / aplikacja nie zweryfikowana | Normalne w trybie Testing — dodaj swój email w OAuth consent screen → **Test users** |
| Przycisk Google nic nie robi | `js/config.js` uzupełniony? Odśwież Ctrl+F5 |

---

## Co dalej (kolejne etapy)

Po działającym Google:

- **Etap B** — powiązanie konta Google z zawodnikiem w aplikacji  
- **Etap C** — wspólna liga (wszyscy widzą te same mecze)  
- **Etap D** — edycja tylko własnych meczów  

Jak Google zadziała, napisz **„google działa”** — przejdziemy do etapu B.
