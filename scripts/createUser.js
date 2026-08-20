// Usage:
//   npm run create-user -- --name="สมชาย ใจดี" --email=somchai@example.com --password="Str0ng!Pass" --role=admin --site=1
//
// role defaults to "staff", --site is optional (site_id a staff member is scoped to).

import 'dotenv/config'
import { pool } from '../src/config/db.js'
import { hashPassword } from '../src/utils/password.js'

function parseArgs(argv) {
  const args = {}
  for (const raw of argv) {
    const match = raw.match(/^--([^=]+)=(.*)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

async function main() {
  const { name, email, password, role = 'staff', site } = parseArgs(process.argv.slice(2))

  if (!name || !email || !password) {
    console.error('ต้องระบุ --name --email --password (ดูตัวอย่างการใช้งานที่ต้นไฟล์นี้)')
    process.exit(1)
  }
  if (!['admin', 'staff'].includes(role)) {
    console.error("--role ต้องเป็น 'admin' หรือ 'staff'")
    process.exit(1)
  }

  const passwordHash = hashPassword(password)

  await pool.query(
    `INSERT INTO users (site_id, name, email, password_hash, role)
     VALUES (:siteId, :name, :email, :passwordHash, :role)`,
    { siteId: site ? Number(site) : null, name, email, passwordHash, role }
  )

  console.log(`สร้างผู้ใช้สำเร็จ: ${email} (role: ${role})`)
  await pool.end()
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err.message)
  process.exit(1)
})
