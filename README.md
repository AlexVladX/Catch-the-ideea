# Atelier de idei

Aplicație web pentru telefon și laptop care prinde ideile pe loc, le analizează și le transformă în pași cu termene. Fiecare utilizator are cont propriu, iar ideile lui sunt private.

Nu are pas de build: fișierele din acest depozit se publică exact așa cum sunt.

## Configurare

1. Creează un proiect pe [Supabase](https://supabase.com).
2. La **SQL Editor**, rulează conținutul din `supabase/schema.sql`.
3. La setările de API ale proiectului, copiază **Project URL** și cheia publică (`anon` sau `publishable`). Nu folosi cheia `service_role` sau `secret`.
4. Pune cele două valori în `config.js`.
5. La **Authentication > URL Configuration**, setează adresa aplicației ca **Site URL** și adaug-o la **Redirect URLs**.
6. În GitHub, la **Settings > Pages**, alege **Deploy from a branch**, ramura `main` și folderul `/ (root)`.

## Analiza AI cu Groq

1. Creează o cheie API pe [console.groq.com](https://console.groq.com). Nu o pune în acest depozit.
2. În Supabase, la **SQL Editor**, rulează conținutul din `supabase/ai.sql`.
3. La **Edge Functions**, creează o funcție numită exact `analyze` și lipește conținutul din `supabase/functions/analyze/index.ts`.
4. La **Edge Functions > Secrets**, adaugă secretul `GROQ_API_KEY` cu valoarea cheii.
5. Opțional, schimbă modelul cu `GROQ_MODEL` sau limita zilnică pe cont cu `AI_DAILY_LIMIT`. Implicit sunt 10 analize pe zi.

Pentru confidențialitate, verifică la Groq, în **Data Controls**, setările de păstrare a datelor și activează Zero Data Retention.

## Cum instalezi aplicația pe telefon

Deschide adresa aplicației și alege **Adaugă pe ecranul principal** din meniul browserului.

## Copie de siguranță

În **Revizuire > Setări** găsești **Exportă ideile** și **Importă idei**. Nu pune fișierele exportate în acest depozit, pentru că pot conține idei private.

## Date și securitate

Accesul este controlat de regulile Row Level Security din `supabase/schema.sql`. Cheia publică din `config.js` poate fi vizibilă, dar cheia `service_role` nu trebuie pusă niciodată în acest depozit.
