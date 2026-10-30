-- TAIWAN ELECTION WATCH 2026 — initial schema
-- 朋友看好度 / 支持度觀測平台。所有資料皆為朋友間的非正式選擇，不是民調、不是選舉結果。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE counties (
  id            text PRIMARY KEY,               -- 內政部縣市代碼 COUNTYCODE，例：63000
  name          text NOT NULL UNIQUE,           -- 臺北市
  name_en       text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('municipality','county','city')),
  region        text NOT NULL CHECK (region IN ('north','central','south','east','islands')),
  election_title text NOT NULL,                 -- 臺北市長選舉
  sort_order    int  NOT NULL
);

CREATE TABLE parties (
  id         text PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  short_name text NOT NULL,
  color      text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order int  NOT NULL DEFAULT 100
);

-- 候選人資料（與投票資料分離）
CREATE TABLE candidates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  county_id       text NOT NULL REFERENCES counties(id),
  name            text NOT NULL,
  party_id        text REFERENCES parties(id) ON UPDATE CASCADE,
  ballot_number   int  CHECK (ballot_number BETWEEN 1 AND 30),
  color           text CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  photo_url       text,
  photo_source    text,
  bio             text NOT NULL DEFAULT '',
  status          text NOT NULL DEFAULT 'unconfirmed'
                  CHECK (status IN ('official','registered','potential','unconfirmed','withdrawn')),
  is_incumbent    boolean NOT NULL DEFAULT false,
  source_name     text,
  source_url      text,
  data_updated_at date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, county_id),
  UNIQUE (county_id, name)
);
CREATE UNIQUE INDEX candidates_ballot_uq ON candidates (county_id, ballot_number) WHERE ballot_number IS NOT NULL;

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname          text NOT NULL CHECK (char_length(nickname) BETWEEN 1 AND 24),
  nickname_key      text NOT NULL UNIQUE,      -- lower(trim(nickname))，防止重複暱稱
  token_hash        text NOT NULL UNIQUE,      -- sha256(session token)，原始 token 只存在 httpOnly cookie
  recovery_hash     text NOT NULL,             -- sha256(recovery code)，跨裝置找回身份用
  show_predictions  boolean NOT NULL DEFAULT true,
  show_support      boolean NOT NULL DEFAULT false,  -- 支持度預設不公開
  is_demo           boolean NOT NULL DEFAULT false,
  is_banned         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now()
);

-- 每位使用者在每個縣市、每個維度最多一筆：predict = 我看好誰當選；support = 我希望誰當選
CREATE TABLE picks (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  county_id    text NOT NULL REFERENCES counties(id),
  kind         text NOT NULL CHECK (kind IN ('predict','support')),
  candidate_id uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, county_id, kind),
  FOREIGN KEY (candidate_id, county_id) REFERENCES candidates(id, county_id) ON DELETE CASCADE
);
CREATE INDEX picks_county_kind ON picks (county_id, kind);

-- 選擇異動紀錄：用於趨勢圖、每日新增、選情快訊
CREATE TABLE pick_events (
  id               bigserial PRIMARY KEY,
  user_id          uuid REFERENCES users(id) ON DELETE CASCADE,
  county_id        text NOT NULL REFERENCES counties(id),
  kind             text NOT NULL CHECK (kind IN ('predict','support')),
  action           text NOT NULL CHECK (action IN ('create','change','cancel')),
  old_candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL,
  new_candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pick_events_created ON pick_events (created_at);

-- 選情快訊（例如看好度排名出現變動）
CREATE TABLE news_events (
  id         bigserial PRIMARY KEY,
  type       text NOT NULL,
  county_id  text REFERENCES counties(id),
  message    text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 官方開票結果（由管理員依中選會公告輸入，與朋友預測完全分開）
CREATE TABLE official_results (
  county_id           text PRIMARY KEY REFERENCES counties(id),
  winner_candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL,
  is_final            boolean NOT NULL DEFAULT false,
  source              text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE official_votes (
  candidate_id uuid PRIMARY KEY REFERENCES candidates(id) ON DELETE CASCADE,
  votes        int NOT NULL CHECK (votes >= 0),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessions (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE audit_logs (
  id         bigserial PRIMARY KEY,
  actor      text NOT NULL,
  action     text NOT NULL,
  target     text,
  detail     jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created ON audit_logs (created_at DESC);
