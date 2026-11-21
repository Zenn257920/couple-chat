-- Chat tables for the private 2-person chat app (ကိုကို & ကလေးလေး).
-- Lives in the existing kaung-portfolio Neon database (neondb).
-- Does NOT touch the portfolio tables (profile, skills, experience,
-- projects, services, education, socials).
-- Sender values are internal ids only: 'kaung' and 'love'.
-- Display names are mapped in the app (src/lib/names.ts):
--   kaung -> ကိုကို,  love -> ကလေးလေး

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  sender TEXT NOT NULL CHECK (sender IN ('kaung', 'love')),
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS chat_typing (
  sender TEXT PRIMARY KEY CHECK (sender IN ('kaung', 'love')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
