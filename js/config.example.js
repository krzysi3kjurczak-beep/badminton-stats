// Skopiuj ten plik jako js/config.js i wklej dane z Supabase (Project Settings → API).
// Klucz „anon public” jest bezpieczny w aplikacji — chroni go baza (RLS), nie ukrywanie w kodzie.
window.APP_CONFIG = {
  supabaseUrl: 'https://TWOJ-PROJEKT.supabase.co',
  supabaseAnonKey: 'TWOJ-ANON-KEY',
  // Klucz publiczny VAPID (Web Push) — wygeneruj: npx web-push generate-vapid-keys
  vapidPublicKey: 'TWOJ-VAPID-PUBLIC-KEY',
};
