import 'dotenv/config'
import mysql from 'mysql2/promise'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const sql = await readFile(path.join(__dirname, '../src/db/seed.sql'), 'utf8')

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  })

  console.log('กำลังเพิ่มข้อมูลตัวอย่าง...')
  await connection.query(sql)
  console.log('เพิ่มข้อมูลตัวอย่างสำเร็จ ✔')

  await connection.end()
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err)
  process.exit(1)
})
