import { pool } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'

// MySQL รายงาน affectedRows = จำนวนแถวที่ "ค่าเปลี่ยนจริง" ไม่ใช่แถวที่ match
// ดังนั้น UPDATE ที่ส่งค่าเดิมมาจะได้ 0 ทั้งที่แถวมีอยู่ — ถ้าเช็คแค่ affectedRows
// หน้าแอดมินจะขึ้น 404 "ไม่พบข้อมูล" ทุกครั้งที่กดบันทึกโดยไม่แก้อะไร
// จึงยืนยันการมีอยู่ของแถวก่อนสั่ง UPDATE (SQL ส่งมาจากผู้เรียกเสมอ ไม่ต่อ string เอง)
export async function ensureExists(selectSql, params, notFoundMessage) {
  const [rows] = await pool.query(selectSql, params)
  if (!rows[0]) throw ApiError.notFound(notFoundMessage)
}
