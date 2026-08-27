import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'

// Create or update the tree_count for a (bench_level, species) pair in
// one call. Staff shouldn't have to know whether a row exists yet —
// this is what the "ปลูกเฟื้องฟ้าระดับชั้น +246" activity ends up calling.
export const upsertPlanting = asyncHandler(async (req, res) => {
  const { benchLevelId, speciesId, treeCount, plantedDate } = req.body || {}
  if (!benchLevelId || !speciesId || treeCount == null) {
    throw ApiError.badRequest('ต้องระบุ benchLevelId, speciesId, treeCount')
  }

  await pool.query(
    `INSERT INTO plantings (bench_level_id, species_id, tree_count, planted_date)
     VALUES (:benchLevelId, :speciesId, :treeCount, :plantedDate)
     ON DUPLICATE KEY UPDATE
       tree_count = VALUES(tree_count),
       planted_date = COALESCE(VALUES(planted_date), planted_date)`,
    { benchLevelId, speciesId, treeCount, plantedDate: plantedDate || null }
  )

  // มีข้อมูลการปลูกแล้ว = ระดับชั้นนั้นถือว่าปลูกแล้ว
  //
  // เลื่อนสถานะเฉพาะระดับชั้นที่ยังไม่ได้ปลูกเท่านั้น — ถ้าเขียนทับทุกกรณี
  // ระดับชั้นที่เป็น "ปลูกแล้วรอซ่อม" จะถูกลดเหลือ "ปลูกแล้ว" ทันทีที่แก้จำนวนต้น
  // ทำให้ข้อมูลที่เจ้าหน้าที่ตั้งไว้หายไปเงียบๆ
  await pool.query(
    `UPDATE bench_levels SET status = 'planted'
      WHERE id = :benchLevelId AND status IN ('not_planted', 'preparing')`,
    { benchLevelId }
  )

  res.status(200).json({ upserted: true })
})

export const deletePlanting = asyncHandler(async (req, res) => {
  // ต้องรู้ว่าอยู่ระดับชั้นไหนก่อนลบ เพราะหลังลบแล้วสืบย้อนไม่ได้
  const [[planting]] = await pool.query(
    'SELECT bench_level_id FROM plantings WHERE id = :id',
    { id: req.params.id }
  )
  if (!planting) throw ApiError.notFound('ไม่พบข้อมูลการปลูก')

  await pool.query('DELETE FROM plantings WHERE id = :id', { id: req.params.id })

  // upsertPlanting ตั้ง status = 'planted' ตอนเพิ่ม จึงต้องคืนค่าตอนลบด้วย
  // ไม่งั้นระดับชั้นที่ลบการปลูกออกหมดแล้วจะยังนับเป็น 'ปลูกแล้ว' ใน coverage_pct
  const [[remaining]] = await pool.query(
    'SELECT COUNT(*) AS n FROM plantings WHERE bench_level_id = :benchLevelId',
    { benchLevelId: planting.bench_level_id }
  )
  if (Number(remaining.n) === 0) {
    await pool.query(
      `UPDATE bench_levels SET status = 'not_planted' WHERE id = :benchLevelId`,
      { benchLevelId: planting.bench_level_id }
    )
  }

  res.status(204).send()
})
