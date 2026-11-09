-- 日本制覇スタンプ（Japan Conquest）— D1 のテーブル
-- 1. このファイルを D1 の Console で実行
-- 2. 続けて seed.sql（地方・県・都市・体験の初期データ）を実行

-- ===== カタログ（運営が用意するデータ） =====
CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,                 -- 例: kansai
  name_en TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prefectures (
  id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 47),   -- JIS コード（地図と対応）
  slug TEXT NOT NULL UNIQUE,           -- 例: osaka
  name_en TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  region_id TEXT NOT NULL REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,                 -- 例: osaka-city（公開後は変えない）
  prefecture_id INTEGER NOT NULL REFERENCES prefectures(id),
  name_en TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cities_pref ON cities (prefecture_id, sort_order);

CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,                 -- 例: osaka-city.takoyaki（公開後は変えない）
  city_id TEXT NOT NULL REFERENCES cities(id),
  category TEXT NOT NULL CHECK (category IN ('food', 'activity')),
  name_en TEXT NOT NULL,
  name_ja TEXT NOT NULL,
  desc_en TEXT NOT NULL DEFAULT '',
  desc_ja TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))   -- 0 にすると非表示（スタンプ記録は残る）
);
CREATE INDEX IF NOT EXISTS idx_exp_city ON experiences (city_id, sort_order);

-- ===== ユーザーと記録 =====
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  country TEXT,                        -- 任意（ISO 国コード 例: US）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 行った都市（白地図に色が付く元）
CREATE TABLE IF NOT EXISTS visits (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id),
  visited_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, city_id)
);

-- 押したスタンプ（食・アクティビティ）
CREATE TABLE IF NOT EXISTS stamps (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experience_id TEXT NOT NULL REFERENCES experiences(id),
  stamped_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, experience_id)
);
CREATE INDEX IF NOT EXISTS idx_stamps_exp ON stamps (experience_id);
