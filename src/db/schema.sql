-- =====================================================================
-- ศูนย์ข้อมูลการฟื้นฟูเหมือง — MySQL schema
-- InnoDB + utf8mb4 throughout so Thai text and emoji are safe.
-- =====================================================================
CREATE DATABASE IF NOT EXISTS mine_rehab
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mine_rehab;

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- sites: one row per mine site. Everything else hangs off this so the
-- schema is ready for more than one site without any redesign later.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sites (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  company_name    VARCHAR(255) NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- users: staff accounts (the "สำหรับ กพร." login). Public visitors are
-- never rows here — they simply call the GET endpoints without a token.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id         INT UNSIGNED NULL,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- bench_levels: one row per terrace (+210 ... +270). status is the
-- single source of truth for "ปลูกแล้ว / ยังไม่ได้ปลูก" — plantings
-- records the detail, this column is what the summary table filters on.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bench_levels (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id         INT UNSIGNED NOT NULL,
  elevation_m     SMALLINT NOT NULL,
  area_sqm        DECIMAL(10,2) NOT NULL,
  status          ENUM('planted', 'not_planted') NOT NULL DEFAULT 'not_planted',
  sequence_order  SMALLINT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bench_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE KEY uq_bench_site_elevation (site_id, elevation_m)
) ENGINE=InnoDB;

CREATE INDEX idx_bench_site ON bench_levels(site_id);

-- ---------------------------------------------------------------------
-- species: ground-cover plants, reusable across every bench.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS species (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name_th         VARCHAR(255) NOT NULL,
  color_hex       CHAR(7) NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- plantings: the many-to-many between bench_levels and species, with
-- the actual tree count. This is what drives every "จำนวนต้นไม้" figure
-- on the site — nothing is hardcoded, it's always summed from here.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plantings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bench_level_id  INT UNSIGNED NOT NULL,
  species_id      INT UNSIGNED NOT NULL,
  tree_count      INT UNSIGNED NOT NULL DEFAULT 0,
  planted_date    DATE NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_plantings_bench FOREIGN KEY (bench_level_id) REFERENCES bench_levels(id) ON DELETE CASCADE,
  CONSTRAINT fk_plantings_species FOREIGN KEY (species_id) REFERENCES species(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_plantings_bench_species (bench_level_id, species_id)
) ENGINE=InnoDB;

CREATE INDEX idx_plantings_species ON plantings(species_id);

-- ---------------------------------------------------------------------
-- activities: the "กิจกรรมล่าสุด" feed. bench_level_id is nullable
-- because activities like "สำรวจภาพรวมพื้นที่ฟื้นฟู" aren't tied to one.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id         INT UNSIGNED NOT NULL,
  bench_level_id  INT UNSIGNED NULL,
  activity_type   VARCHAR(50) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT NULL,
  activity_date   DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activities_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  CONSTRAINT fk_activities_bench FOREIGN KEY (bench_level_id) REFERENCES bench_levels(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_activities_site_date ON activities(site_id, activity_date DESC);

-- ---------------------------------------------------------------------
-- documents: the "ดาวน์โหลดเอกสาร" list. file_url points at wherever the
-- actual file lives (S3 / R2 / local /uploads) — this table never stores
-- file bytes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id         INT UNSIGNED NOT NULL,
  title           VARCHAR(255) NOT NULL,
  file_url        VARCHAR(500) NOT NULL,
  file_size_kb    INT UNSIGNED NOT NULL,
  category        VARCHAR(100) NOT NULL,
  uploaded_date   DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_documents_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_documents_site_date ON documents(site_id, uploaded_date DESC);

-- ---------------------------------------------------------------------
-- news_posts: the "ข่าวสารและประกาศ" list.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news_posts (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id         INT UNSIGNED NOT NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT NULL,
  published_date  DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_news_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_news_site_date ON news_posts(site_id, published_date DESC);

-- ---------------------------------------------------------------------
-- progress_snapshots: historical record for "ข้อมูล ณ วันที่ ..." and any
-- month-over-month chart. Without this table you can only ever ask
-- "what's the state right now?" — this is what lets you ask "what was
-- it in March?". Written by a monthly job (see scripts/, or an
-- application-level cron), never edited by hand.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress_snapshots (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id           INT UNSIGNED NOT NULL,
  snapshot_date     DATE NOT NULL,
  total_benches     SMALLINT UNSIGNED NOT NULL,
  planted_benches   SMALLINT UNSIGNED NOT NULL,
  total_trees       INT UNSIGNED NOT NULL,
  coverage_pct      DECIMAL(5,2) NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_snapshots_site FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  UNIQUE KEY uq_snapshot_site_date (site_id, snapshot_date)
) ENGINE=InnoDB;

-- =====================================================================
-- Views: the numbers on the landing page are always computed live from
-- the tables above, never duplicated into a column that can go stale.
-- =====================================================================

CREATE OR REPLACE VIEW v_site_overview AS
SELECT
  s.id                                                            AS site_id,
  s.name                                                          AS site_name,
  COUNT(bl.id)                                                    AS total_benches,
  SUM(CASE WHEN bl.status = 'planted' THEN 1 ELSE 0 END)          AS planted_benches,
  SUM(CASE WHEN bl.status <> 'planted' THEN 1 ELSE 0 END)         AS not_planted_benches,
  COALESCE(SUM(bl.area_sqm), 0)                                   AS total_area_sqm,
  COALESCE((
    SELECT SUM(p.tree_count)
    FROM plantings p
    JOIN bench_levels bl2 ON bl2.id = p.bench_level_id
    WHERE bl2.site_id = s.id
  ), 0)                                                           AS total_trees,
  ROUND(
    SUM(CASE WHEN bl.status = 'planted' THEN 1 ELSE 0 END) / NULLIF(COUNT(bl.id), 0) * 100,
    1
  )                                                                AS coverage_pct
FROM sites s
LEFT JOIN bench_levels bl ON bl.site_id = s.id
GROUP BY s.id, s.name;

CREATE OR REPLACE VIEW v_species_totals AS
SELECT
  sp.id           AS species_id,
  sp.name_th,
  sp.color_hex,
  s.id            AS site_id,
  COALESCE(SUM(p.tree_count), 0) AS total_trees
FROM species sp
JOIN plantings p     ON p.species_id = sp.id
JOIN bench_levels bl ON bl.id = p.bench_level_id
JOIN sites s         ON s.id = bl.site_id
GROUP BY sp.id, sp.name_th, sp.color_hex, s.id;
