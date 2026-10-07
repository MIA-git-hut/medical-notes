CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  login text NOT NULL,
  avatar_url text NOT NULL DEFAULT '',
  daily_new_limit integer NOT NULL DEFAULT 10 CHECK (daily_new_limit BETWEEN 0 AND 100),
  timezone text NOT NULL DEFAULT 'Asia/Shanghai',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS identities (
  provider text NOT NULL,
  provider_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id),
  PRIMARY KEY (provider, provider_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  csrf_token text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS login_events (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  provider text NOT NULL,
  logged_in_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_events_user_time ON login_events(user_id, logged_in_at DESC);
CREATE INDEX IF NOT EXISTS login_events_time ON login_events(logged_in_at DESC);
CREATE TABLE IF NOT EXISTS oauth_attempts (
  state_hash text PRIMARY KEY,
  provider_id text NOT NULL,
  verifier text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS card_progress (
  user_id uuid NOT NULL REFERENCES users(id),
  card_id text NOT NULL,
  schedule jsonb NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  PRIMARY KEY (user_id, card_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id),
  card_id text NOT NULL,
  request_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 4),
  expected_version integer NOT NULL,
  reviewed_at timestamptz NOT NULL,
  due timestamptz NOT NULL,
  was_new boolean NOT NULL,
  algorithm text NOT NULL,
  before_schedule jsonb,
  after_schedule jsonb NOT NULL,
  result_version integer NOT NULL,
  UNIQUE (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS reviews_user_time ON reviews(user_id, reviewed_at DESC);
CREATE TABLE IF NOT EXISTS study_notes (
  user_id uuid NOT NULL REFERENCES users(id),
  card_id text NOT NULL,
  text text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, card_id)
);
INSERT INTO schema_migrations (version) VALUES (1) ON CONFLICT DO NOTHING;
