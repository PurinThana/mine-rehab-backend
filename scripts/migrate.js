// เพิ่มคอลัมน์ที่ยังไม่มีให้ฐานข้อมูลที่สร้างไว้แล้ว โดยไม่ต้อง drop/สร้างใหม่
//
// ทำไมต้องมีไฟล์นี้: schema.sql ใช้ CREATE TABLE IF NOT EXISTS ซึ่งจะ "ข้าม"
// ตารางที่มีอยู่แล้วทั้งตาราง — รันซ้ำจึงไม่เพิ่มคอลัมน์ใหม่ให้ และ MySQL ก็ไม่มี
// ADD COLUMN IF NOT EXISTS จึงต้องเช็ค information_schema เองก่อนสั่ง ALTER
//
// รันซ้ำได้เสมอ (idempotent) — คอลัมน์ที่มีอยู่แล้วจะถูกข้าม
//
// วิธีใช้: npm run db:migrate

import "dotenv/config";
import mysql from "mysql2/promise";

// [ตาราง, คอลัมน์, นิยามคอลัมน์]
const COLUMNS = [
  ["activities", "image_url", "VARCHAR(500) NULL AFTER description"],
  ["news_posts", "image_url", "VARCHAR(500) NULL AFTER body"],
];

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :table AND COLUMN_NAME = :column
      LIMIT 1`,
    { db: process.env.DB_NAME, table, column },
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

  let added = 0;
  for (const [table, column, definition] of COLUMNS) {
    if (await columnExists(conn, table, column)) {
      console.log(`- ข้าม ${table}.${column} (มีอยู่แล้ว)`);
      continue;
    }
    // ชื่อตาราง/คอลัมน์เป็นค่าคงที่ในไฟล์นี้เท่านั้น ไม่ได้มาจาก input ภายนอก
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`+ เพิ่ม ${table}.${column}`);
    added += 1;
  }

  console.log(added ? `\nเพิ่มคอลัมน์ใหม่ ${added} รายการ ✔` : "\nฐานข้อมูลเป็นเวอร์ชันล่าสุดแล้ว ✔");
  await conn.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาด:", err.message);
  process.exit(1);
});
