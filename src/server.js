import 'dotenv/config' // must run before anything that reads process.env (e.g. src/utils/jwt.js)

import app from './app.js'
import { pingDb } from './config/db.js'

const PORT = process.env.PORT || 4000

async function start() {
  try {
    await pingDb()
    console.log('เชื่อมต่อฐานข้อมูล MySQL สำเร็จ')
  } catch (err) {
    console.error('เชื่อมต่อฐานข้อมูลไม่สำเร็จ — ตรวจสอบค่าในไฟล์ .env:', err.message)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`API พร้อมใช้งานที่ http://localhost:${PORT}`)
  })
}

start()
