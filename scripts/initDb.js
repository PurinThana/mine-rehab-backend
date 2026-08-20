import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// โหลด .env จาก Root folder ของ backend เสมอ
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  // ตรวจสอบค่าที่อ่านได้ก่อนเริ่มทำงาน
  console.log(
    `🔌 กำลังเชื่อมต่อ MySQL (${process.env.DB_HOST}:${process.env.DB_PORT}) ด้วย User: [${process.env.DB_USER}]...`,
  );

  const sql = await readFile(
    path.join(__dirname, "../src/db/schema.sql"),
    "utf8",
  );

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  console.log("🚀 กำลังสร้างฐานข้อมูลและตาราง...");
  await connection.query(sql);
  console.log("✅ สร้างฐานข้อมูลสำเร็จ!");

  await connection.end();
}

main().catch((err) => {
  console.error("❌ เกิดข้อผิดพลาด:", err.message);
  process.exit(1);
});
