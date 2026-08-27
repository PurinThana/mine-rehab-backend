// ปรับโครงฐานข้อมูลที่สร้างไว้แล้วให้ตรงกับ schema.sql ปัจจุบัน
//
// ทำไมต้องมีไฟล์นี้: schema.sql ใช้ CREATE TABLE IF NOT EXISTS ซึ่งจะ "ข้าม"
// ตารางที่มีอยู่แล้วทั้งตาราง — รันซ้ำจึงไม่เพิ่มคอลัมน์ใหม่ให้
//
// รันซ้ำได้เสมอ (idempotent) — ของที่มีอยู่แล้วจะถูกข้าม
//
// วิธีใช้: npm run db:migrate

import "dotenv/config";
import mysql from "mysql2/promise";

// [ตาราง, คอลัมน์, นิยามคอลัมน์]
const COLUMNS = [
  ["activities", "image_url", "VARCHAR(500) NULL AFTER description"],
  ["news_posts", "image_url", "VARCHAR(500) NULL AFTER body"],
  ["sites", "hero_image_url", "VARCHAR(500) NULL AFTER end_date"],
  ["sites", "location", "VARCHAR(500) NULL AFTER company_name"],
  ["bench_levels", "planned_tree_count", "INT UNSIGNED NULL AFTER area_sqm"],
];

// คอลัมน์ที่ต้อง "เปลี่ยนชนิด" ไม่ใช่เพิ่มใหม่
// [ตาราง, คอลัมน์, ชนิดที่ต้องการ, ข้อความที่ใช้ตรวจว่าแก้ไปแล้ว]
const COLUMN_TYPES = [
  [
    "bench_levels",
    "status",
    "ENUM('planted','planted_repair','not_planted','preparing') NOT NULL DEFAULT 'not_planted'",
    "planted_repair",
  ],
];

// view ที่ต้องสร้างทับเมื่อสูตรเปลี่ยน — CREATE OR REPLACE รันซ้ำได้อยู่แล้ว
const VIEWS = [
  {
    name: "v_site_overview",
    // "ปลูกแล้วรอซ่อม" ถือว่าปลูกแล้ว (ต้นไม้ลงดินไปแล้ว รอซ่อมเฉพาะจุดที่ตาย)
    // ส่วน "เตรียมพื้นที่" ยังไม่ได้ปลูก — ความคืบหน้าจึงนับสองสถานะแรกเป็นปลูกแล้ว
    sql: `CREATE OR REPLACE VIEW v_site_overview AS
      SELECT
        s.id                                                            AS site_id,
        s.name                                                          AS site_name,
        COUNT(bl.id)                                                    AS total_benches,
        SUM(CASE WHEN bl.status IN ('planted','planted_repair') THEN 1 ELSE 0 END)     AS planted_benches,
        SUM(CASE WHEN bl.status NOT IN ('planted','planted_repair') THEN 1 ELSE 0 END) AS not_planted_benches,
        COALESCE(SUM(bl.area_sqm), 0)                                   AS total_area_sqm,
        COALESCE((
          SELECT SUM(p.tree_count)
          FROM plantings p
          JOIN bench_levels bl2 ON bl2.id = p.bench_level_id
          WHERE bl2.site_id = s.id
        ), 0)                                                           AS total_trees,
        ROUND(
          SUM(CASE WHEN bl.status IN ('planted','planted_repair') THEN 1 ELSE 0 END)
            / NULLIF(COUNT(bl.id), 0) * 100,
          1
        )                                                                AS coverage_pct
      FROM sites s
      LEFT JOIN bench_levels bl ON bl.site_id = s.id
      GROUP BY s.id, s.name`,
  },
];

// ตารางใหม่ที่เพิ่มหลังจากติดตั้งครั้งแรก — SQL ต้องเหมือนใน schema.sql
const TABLES = [
  {
    name: "post_images",
    sql: `CREATE TABLE post_images (
      id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      activity_id   INT UNSIGNED NULL,
      news_post_id  INT UNSIGNED NULL,
      image_url     VARCHAR(500) NOT NULL,
      sort_order    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_post_images_activity FOREIGN KEY (activity_id)
        REFERENCES activities(id) ON DELETE CASCADE,
      CONSTRAINT fk_post_images_news FOREIGN KEY (news_post_id)
        REFERENCES news_posts(id) ON DELETE CASCADE,
      -- ต้องมีเจ้าของเพียงหนึ่งเดียว ไม่ใช่ทั้งคู่และไม่ใช่ไม่มีเลย
      CONSTRAINT chk_post_images_owner CHECK (
        (activity_id IS NULL) <> (news_post_id IS NULL)
      )
    ) ENGINE=InnoDB`,
    indexes: [
      "CREATE INDEX idx_post_images_activity ON post_images(activity_id, sort_order)",
      "CREATE INDEX idx_post_images_news ON post_images(news_post_id, sort_order)",
    ],
  },
];

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table AND COLUMN_NAME = :column
      LIMIT 1`,
    { db: process.env.DB_NAME, table, column },
  );
  return rows.length > 0;
}

async function columnType(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table AND COLUMN_NAME = :column
      LIMIT 1`,
    { db: process.env.DB_NAME, table, column },
  );
  return rows[0]?.t || null;
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table LIMIT 1`,
    { db: process.env.DB_NAME, table },
  );
  return rows.length > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    namedPlaceholders: true,
  });

  let changes = 0;

  for (const table of TABLES) {
    if (await tableExists(conn, table.name)) {
      console.log(`- ข้ามตาราง ${table.name} (มีอยู่แล้ว)`);
      continue;
    }
    await conn.query(table.sql);
    for (const index of table.indexes || []) await conn.query(index);
    console.log(`+ สร้างตาราง ${table.name}`);
    changes += 1;
  }

  for (const [table, column, definition] of COLUMNS) {
    if (await columnExists(conn, table, column)) {
      console.log(`- ข้าม ${table}.${column} (มีอยู่แล้ว)`);
      continue;
    }
    // ชื่อตาราง/คอลัมน์เป็นค่าคงที่ในไฟล์นี้เท่านั้น ไม่ได้มาจาก input ภายนอก
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`+ เพิ่ม ${table}.${column}`);
    changes += 1;
  }

  for (const [table, column, wantedType, marker] of COLUMN_TYPES) {
    const current = await columnType(conn, table, column);
    if (current && current.includes(marker)) {
      console.log(`- ข้าม ${table}.${column} (ชนิดถูกต้องแล้ว)`);
      continue;
    }
    await conn.query(`ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${wantedType}`);
    console.log(`~ เปลี่ยนชนิด ${table}.${column}`);
    changes += 1;
  }

  // view สร้างทับได้เสมอ ไม่ต้องเช็คก่อน
  for (const view of VIEWS) {
    await conn.query(view.sql);
    console.log(`~ อัปเดต view ${view.name}`);
  }

  console.log(changes ? `\nปรับโครงฐานข้อมูล ${changes} รายการ ✔` : "\nฐานข้อมูลเป็นเวอร์ชันล่าสุดแล้ว ✔");
  await conn.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาด:", err.message);
  process.exit(1);
});
