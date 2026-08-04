CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(80) NOT NULL DEFAULT '',
  nickname VARCHAR(40) NOT NULL DEFAULT '',
  avatar_data_url TEXT NOT NULL DEFAULT '',
  public_profile_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  username VARCHAR(30) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_username_normalized_unique ON users (LOWER(username));
CREATE UNIQUE INDEX users_email_normalized_unique ON users (LOWER(email));

CREATE TABLE timer_states (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(8) NOT NULL DEFAULT 'focus' CHECK (mode IN ('focus', 'break')),
  is_running BOOLEAN NOT NULL DEFAULT FALSE,
  remaining_sec INTEGER NOT NULL DEFAULT 1500,
  started_at TIMESTAMPTZ,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  consecutive_sessions INTEGER NOT NULL DEFAULT 0,
  is_long_break BOOLEAN NOT NULL DEFAULT FALSE,
  segment_started_at TIMESTAMPTZ,
  paused_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
  paused_at TIMESTAMPTZ,
  current_label VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE timer_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  focus_sec INTEGER NOT NULL DEFAULT 1500 CHECK (focus_sec BETWEEN 60 AND 14400),
  short_break_sec INTEGER NOT NULL DEFAULT 300 CHECK (short_break_sec BETWEEN 30 AND 3600),
  long_break_sec INTEGER NOT NULL DEFAULT 900 CHECK (long_break_sec BETWEEN 60 AND 7200),
  long_break_every INTEGER NOT NULL DEFAULT 4 CHECK (long_break_every BETWEEN 2 AND 12),
  auto_start_next BOOLEAN NOT NULL DEFAULT TRUE,
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sound_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ambient_sound VARCHAR(8) NOT NULL DEFAULT 'none' CHECK (ambient_sound IN ('none', 'white', 'pink', 'brown')),
  ambient_volume INTEGER NOT NULL DEFAULT 40 CHECK (ambient_volume BETWEEN 0 AND 100),
  daily_focus_goal_min INTEGER NOT NULL DEFAULT 120 CHECK (daily_focus_goal_min BETWEEN 5 AND 1440),
  streak_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(8) NOT NULL CHECK (mode IN ('focus', 'break')),
  is_long_break BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  duration_sec INTEGER NOT NULL CHECK (duration_sec > 0),
  paused_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT TRUE,
  label VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sessions_user_ended_at_idx ON sessions (user_id, ended_at DESC);

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  jti TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_tokens_jti_idx ON refresh_tokens (jti);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);

CREATE TABLE friendships (
  id UUID PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pair_key TEXT NOT NULL UNIQUE,
  status VARCHAR(8) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (requester_id <> recipient_id)
);

CREATE INDEX friendships_requester_idx ON friendships (requester_id);
CREATE INDEX friendships_recipient_idx ON friendships (recipient_id);
CREATE INDEX friendships_status_idx ON friendships (status);

CREATE TABLE focus_rooms (
  id UUID PRIMARY KEY,
  code VARCHAR(16) NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL DEFAULT '',
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX focus_rooms_active_code_idx ON focus_rooms (code, active);

CREATE TABLE focus_room_members (
  room_id UUID NOT NULL REFERENCES focus_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX rate_limits_expires_idx ON rate_limits (expires_at);
