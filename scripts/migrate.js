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

  console.log(changes ? `\nปรับโครงฐานข้อมูล ${changes} รายการ ✔` : "\nฐานข้อมูลเป็นเวอร์ชันล่าสุดแล้ว ✔");
  await conn.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาด:", err.message);
  process.exit(1);
});
