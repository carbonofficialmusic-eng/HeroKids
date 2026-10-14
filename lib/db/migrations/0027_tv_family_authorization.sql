CREATE TABLE IF NOT EXISTS tv_pairings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_hash varchar(64) NOT NULL,
  code varchar(8) NOT NULL UNIQUE,
  status varchar(16) NOT NULL DEFAULT 'pending',
  family_name varchar REFERENCES families(family_name) ON DELETE CASCADE,
  expires_at timestamp NOT NULL,
  token_issued_at timestamp,
  tv_session_id varchar,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE tv_pairings
  ADD COLUMN IF NOT EXISTS tv_session_id varchar;

CREATE INDEX IF NOT EXISTS tv_pairings_expires_idx
  ON tv_pairings (expires_at);
CREATE INDEX IF NOT EXISTS tv_pairings_session_idx
  ON tv_pairings (tv_session_id);

CREATE TABLE IF NOT EXISTS tv_sessions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name varchar NOT NULL REFERENCES families(family_name) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  selected_member_id varchar REFERENCES family_members(id) ON DELETE SET NULL,
  revoked_at timestamp,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE tv_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamp;
UPDATE tv_sessions
  SET expires_at = COALESCE(created_at, now()) + interval '180 days'
  WHERE expires_at IS NULL;
ALTER TABLE tv_sessions
  ALTER COLUMN expires_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS tv_sessions_family_idx
  ON tv_sessions (family_name);
CREATE INDEX IF NOT EXISTS tv_sessions_family_expiry_idx
  ON tv_sessions (family_name, expires_at);
CREATE INDEX IF NOT EXISTS tv_sessions_selected_member_idx
  ON tv_sessions (selected_member_id);