import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'

export const listActivities = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const [rows] = await pool.query(
    `SELECT id, bench_level_id, activity_type, title, description, image_url, activity_date
     FROM activities
     WHERE site_id = :siteId
     ORDER BY activity_date DESC, id DESC
     LIMIT :limit`,
    { siteId: req.params.siteId, limit }
  )
  res.json(rows)
})

export const createActivity = asyncHandler(async (req, res) => {
  const { siteId, benchLevelId, activityType, title, description, imageUrl, activityDate } =
    req.body || {}
  if (!siteId || !activityType || !title || !activityDate) {
    throw ApiError.badRequest('ต้องระบุ siteId, activityType, title, activityDate')
  }

  const [result] = await pool.query(
    `INSERT INTO activities
       (site_id, bench_level_id, activity_type, title, description, image_url, activity_date)
     VALUES (:siteId, :benchLevelId, :activityType, :title, :description, :imageUrl, :activityDate)`,
    {
      siteId,
      benchLevelId: benchLevelId || null,
      activityType,
      title,
      description: description || null,
      imageUrl: imageUrl || null,
      activityDate,
    }
  )
  res.status(201).json({ id: result.insertId })
})

export const updateActivity = asyncHandler(async (req, res) => {
  const { benchLevelId, activityType, title, description, imageUrl, activityDate } = req.body || {}

  await ensureExists('SELECT id FROM activities WHERE id = :id', { id: req.params.id }, 'ไม่พบกิจกรรม')

  // benchLevelId ต้องแยกจาก COALESCE เพราะ null คือค่าที่ตั้งใจได้
  // ("ไม่ผูกกับระดับชั้นไหน") ไม่ใช่ "ไม่ได้ส่งมา" — ใช้ธงบอกว่าจะแตะฟิลด์นี้ไหม
  const touchBench = Object.prototype.hasOwnProperty.call(req.body || {}, 'benchLevelId')

  await pool.query(
    `UPDATE activities SET
       bench_level_id = IF(:touchBench, :benchLevelId, bench_level_id),
       activity_type = COALESCE(:activityType, activity_type),
       title = COALESCE(:title, title),
       description = IF(:touchDescription, :description, description),
       image_url = IF(:touchImage, :imageUrl, image_url),
       activity_date = COALESCE(:activityDate, activity_date)
     WHERE id = :id`,
    {
      id: req.params.id,
      touchBench: touchBench ? 1 : 0,
      benchLevelId: benchLevelId || null,
      activityType: activityType ?? null,
      title: title ?? null,
      touchDescription: Object.prototype.hasOwnProperty.call(req.body || {}, 'description') ? 1 : 0,
      description: description || null,
      // ส่ง imageUrl: null มาคือ "ลบรูปออก" ไม่ส่งมาเลยคือ "ไม่แตะรูปเดิม"
      touchImage: Object.prototype.hasOwnProperty.call(req.body || {}, 'imageUrl') ? 1 : 0,
      imageUrl: imageUrl || null,
      activityDate: activityDate ?? null,
    }
  )
  res.json({ updated: true })
})

export const deleteActivity = asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM activities WHERE id = :id', { id: req.params.id })
  if (result.affectedRows === 0) throw ApiError.notFound('ไม่พบกิจกรรม')
  res.status(204).send()
})
