-- =====================================================================
-- Seed data — mirrors the content already shown in the landing page
-- mock (src/components/BenchSummary.jsx, FlowerTypes.jsx,
-- RecentActivities.jsx, NewsDownloads.jsx). Areas and tree totals are
-- now *computed* from these rows via the views in schema.sql, so a
-- couple of figures here won't match the old hardcoded frontend
-- numbers exactly — that's expected, the views are the source of truth
-- from here on.
-- =====================================================================

USE mine_rehab;
SET NAMES utf8mb4;

INSERT INTO sites (id, name, company_name, start_date, end_date) VALUES
  (1, 'เหมืองตัวอย่าง', 'บริษัท ตัวอย่างเหมือง จำกัด', '2025-02-01', '2029-01-31');

INSERT INTO species (id, name_th, color_hex) VALUES
  (1, 'เฟื้องฟ้าสีส้ม', '#C1723C'),
  (2, 'เฟื้องฟ้าสีชมพู', '#C4557A'),
  (3, 'เฟื้องฟ้าสีขาวปลายชมพู', '#D9A9BE'),
  (4, 'เฟื้องฟ้าสีแดง', '#B03A3A');

-- 11 bench levels, +270 (summit) down to +210 (base), 6 m apart.
-- sequence_order 1 = summit, 11 = base, matching the side-view stack
-- in BenchSummary.jsx.
INSERT INTO bench_levels (id, site_id, elevation_m, area_sqm, status, sequence_order) VALUES
  (1,  1, 270, 489.00, 'planted',     1),
  (2,  1, 264, 489.00, 'planted',     2),
  (3,  1, 258, 489.00, 'planted',     3),
  (4,  1, 252, 489.00, 'planted',     4),
  (5,  1, 246, 489.00, 'planted',     5),
  (6,  1, 240, 489.00, 'planted',     6),
  (7,  1, 234, 489.00, 'planted',     7),
  (8,  1, 228, 489.00, 'not_planted', 8),
  (9,  1, 222, 489.00, 'not_planted', 9),
  (10, 1, 216, 489.00, 'not_planted', 10),
  (11, 1, 210, 489.00, 'not_planted', 11);

-- Plantings: 4 species x 7 planted benches = 28 rows.
-- (bench_level_id, species_id, tree_count, planted_date)
INSERT INTO plantings (bench_level_id, species_id, tree_count, planted_date) VALUES
  -- +270
  (1, 1, 140, '2026-02-10'), (1, 2, 160, '2026-02-10'), (1, 3, 220, '2026-02-12'), (1, 4, 260, '2026-02-12'),
  -- +264
  (2, 1, 120, '2026-02-18'), (2, 2, 150, '2026-02-18'), (2, 3, 210, '2026-02-20'), (2, 4, 250, '2026-02-20'),
  -- +258
  (3, 1, 110, '2026-03-02'), (3, 2, 140, '2026-03-02'), (3, 3, 200, '2026-03-05'), (3, 4, 240, '2026-03-05'),
  -- +252
  (4, 1, 100, '2026-03-16'), (4, 2, 130, '2026-03-16'), (4, 3, 190, '2026-03-19'), (4, 4, 230, '2026-03-19'),
  -- +246
  (5, 1, 90,  '2026-04-02'), (5, 2, 120, '2026-04-02'), (5, 3, 175, '2026-05-18'), (5, 4, 215, '2026-05-18'),
  -- +240
  (6, 1, 80,  '2026-04-20'), (6, 2, 110, '2026-04-20'), (6, 3, 160, '2026-04-23'), (6, 4, 200, '2026-04-23'),
  -- +234
  (7, 1, 70,  '2026-05-08'), (7, 2, 100, '2026-05-08'), (7, 3, 150, '2026-05-11'), (7, 4, 190, '2026-05-11');

-- Activities (matches RecentActivities.jsx)
INSERT INTO activities (site_id, bench_level_id, activity_type, title, activity_date) VALUES
  (1, NULL, 'sow',     'เพาะกล้าเฟื้องฟ้า',              '2026-05-23'),
  (1, NULL, 'prepare', 'เตรียมดินและปรับพื้นที่',         '2026-05-20'),
  (1, 5,    'plant',   'ปลูกเฟื้องฟ้าระดับชั้น +246',     '2026-05-18'),
  (1, NULL, 'water',   'ให้น้ำและบำรุงรักษา',             '2026-05-16'),
  (1, NULL, 'survey',  'สำรวจภาพรวมพื้นที่ฟื้นฟู',        '2026-05-15');

-- Documents (matches NewsDownloads.jsx FILES)
INSERT INTO documents (site_id, title, file_url, file_size_kb, category, uploaded_date) VALUES
  (1, 'แผนฟื้นฟูพื้นที่เหมือง (ฉบับสมบูรณ์)',        '/files/rehab-plan-full.pdf',     4200, 'plan',   '2026-02-01'),
  (1, 'รายงานความก้าวหน้าการฟื้นฟู (รายเดือน)',      '/files/progress-2026-05.pdf',    2100, 'report', '2026-05-24'),
  (1, 'แผนการปลูกต้นไม้ตามระดับชั้น (Bench)',        '/files/planting-plan-bench.pdf', 1800, 'plan',   '2026-02-01'),
  (1, 'คู่มือการปลูกและบำรุงรักษาเฟื้องฟ้า',          '/files/care-manual.pdf',         3600, 'manual', '2026-02-15');

-- News posts (matches NewsDownloads.jsx NEWS)
INSERT INTO news_posts (site_id, title, published_date) VALUES
  (1, 'รายงานความก้าวหน้าการฟื้นฟู ประจำเดือนพฤษภาคม 2569', '2026-05-24'),
  (1, 'การปลูกเฟื้องฟ้าระดับชั้น +246 และแผนดูแลช่วงหน้าฝน', '2026-05-18'),
  (1, 'จัดอบรมทีมดูแลและบำรุงรักษาต้นเฟื้องฟ้า ครั้งที่ 2/2569', '2026-05-10');

-- One historical snapshot as an example; a monthly job should insert
-- one row per site per month going forward (see README).
INSERT INTO progress_snapshots (site_id, snapshot_date, total_benches, planted_benches, total_trees, coverage_pct) VALUES
  (1, '2026-05-24', 11, 7, 4510, 63.6);
