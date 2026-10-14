-- Point accounting ledger and contribution idempotency.
-- This migration does not rewrite member balances and creates no opening
-- ledger entries. Existing unexplained balances therefore remain untouched.

CREATE TABLE IF NOT EXISTS point_transactions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name varchar NOT NULL,
  member_id varchar NOT NULL,
  delta_total_earned integer NOT NULL DEFAULT 0,
  delta_total_points integer NOT NULL DEFAULT 0,
  delta_weekly_points integer NOT NULL DEFAULT 0,
  delta_monthly_points integer NOT NULL DEFAULT 0,
  before_total_earned integer NOT NULL,
  after_total_earned integer NOT NULL,
  before_total_points integer NOT NULL,
  after_total_points integer NOT NULL,
  before_weekly_points integer NOT NULL,
  after_weekly_points integer NOT NULL,
  before_monthly_points integer NOT NULL,
  after_monthly_points integer NOT NULL,
  source_type varchar(64) NOT NULL,
  source_id varchar,
  reason text NOT NULL,
  actor_member_id varchar,
  idempotency_key varchar,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS point_transactions_member_created_idx
  ON point_transactions (member_id, created_at);
CREATE INDEX IF NOT EXISTS point_transactions_family_created_idx
  ON point_transactions (family_name, created_at);
CREATE INDEX IF NOT EXISTS point_transactions_source_idx
  ON point_transactions (source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS point_transactions_idempotency_unique
  ON point_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Record the cutover state without changing a single balance. Future journal
-- entries can therefore be reconciled from this immutable opening snapshot.
INSERT INTO point_transactions (
  family_name, member_id,
  before_total_earned, after_total_earned,
  before_total_points, after_total_points,
  before_weekly_points, after_weekly_points,
  before_monthly_points, after_monthly_points,
  source_type, source_id, reason, idempotency_key
)
SELECT
  family_name, id,
  total_earned, total_earned,
  total_points, total_points,
  weekly_points, weekly_points,
  monthly_points, monthly_points,
  'legacy_opening_balance', id, 'Opening balance at points-ledger rollout',
  'legacy-opening-balance:' || id
FROM family_members
ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM goal_contributions
    GROUP BY goal_id, member_id, period
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate goal contributions must be reviewed before adding the unique index';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS goal_contributions_goal_member_period_unique
  ON goal_contributions (goal_id, member_id, period);
CREATE INDEX IF NOT EXISTS goal_contributions_goal_idx
  ON goal_contributions (goal_id, contributed_at);