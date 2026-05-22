-- prisma migration
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_pubkey varchar(44) UNIQUE NOT NULL,
  token_mint varchar(44) NOT NULL,
  price_feed varchar(44),
  token_name text,
  token_symbol text,
  token_image_url text,
  duration smallint NOT NULL,
  opening_price bigint NOT NULL,
  expiry timestamptz NOT NULL,
  status varchar(10) NOT NULL DEFAULT 'active',
  winner varchar(5),
  final_price bigint,
  total_pool bigint NOT NULL DEFAULT 0,
  platform_fee bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_pubkey varchar(44) NOT NULL,
  user_pubkey varchar(44) NOT NULL,
  side varchar(5) NOT NULL,
  amount bigint NOT NULL,
  claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_bets_room FOREIGN KEY (room_pubkey) REFERENCES rooms(room_pubkey) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bets_room_pubkey ON bets(room_pubkey);
CREATE INDEX IF NOT EXISTS idx_bets_user_pubkey ON bets(user_pubkey);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_pubkey varchar(44) PRIMARY KEY,
  total_bets integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  profit bigint NOT NULL DEFAULT 0,
  trench_score char(1) NOT NULL DEFAULT 'D',
  achievements jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processed_txs (
  signature varchar(88) PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_pubkey varchar(44) NOT NULL,
  user_pubkey varchar(44) NOT NULL,
  amount bigint NOT NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payouts_room_pubkey ON payouts(room_pubkey);
CREATE INDEX IF NOT EXISTS idx_payouts_user_pubkey ON payouts(user_pubkey);
