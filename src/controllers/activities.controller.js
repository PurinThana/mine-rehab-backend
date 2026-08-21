import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'
import { sanitizeRichText } from '../utils/richText.js'
import {
  fetchImages,
  fetchImagesForMany,
  normalizeImageUrls,
  replaceImages,
  withTransaction,
} from '../utils/postImages.js'

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

  // แนบรายการรูปมาด้วยในคำขอเดียว (สองคิวรี ไม่ใช่ N+1) เพื่อให้การ์ดบอกได้ว่า
  // มีรูปกี่รูป โดยไม่ต้องยิงถามรายตัว
  const imagesById = await fetchImagesForMany('activity', rows.map((r) => r.id))
  res.json(rows.map((row) => ({ ...row, images: imagesById.get(row.id) || [] })))
})

// กิจกรรมเดียวสำหรับหน้ารายละเอียด — join ระดับชั้นและชื่อไซต์มาให้ในคำขอเดียว
// เพื่อให้เปิดลิงก์ตรง (หรือกด refresh) ได้โดยไม่ต้องโหลดรายการทั้งหมดมาก่อน
export const getActivity = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.site_id, a.bench_level_id, a.activity_type, a.title, a.description,
            a.image_url, a.activity_date, a.created_at,
            bl.elevation_m AS bench_elevation_m,
            s.name AS site_name
       FROM activities a
       LEFT JOIN bench_levels bl ON bl.id = a.bench_level_id
       LEFT JOIN sites s ON s.id = a.site_id
      WHERE a.id = :id
      LIMIT 1`,
    { id: req.params.id }
  )
  if (!rows[0]) throw ApiError.notFound('ไม่พบกิจกรรม')

  const images = await fetchImages('activity', rows[0].id)
  res.json({ ...rows[0], images: images.map((i) => i.image_url) })
})

export const createActivity = asyncHandler(async (req, res) => {
  const { siteId, benchLevelId, activityType, title, description, imageUrl, images, activityDate } =
    req.body || {}
  if (!siteId || !activityType || !title || !activityDate) {
    throw ApiError.badRequest('ต้องระบุ siteId, activityType, title, activityDate')
  }

  const urls = normalizeImageUrls(images)
  // description เป็น HTML จากตัวแก้ไขในหน้าแอดมิน — ล้างก่อนเก็บเสมอ
  const safeDescription = sanitizeRichText(description)

  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO activities
         (site_id, bench_level_id, activity_type, title, description, image_url, activity_date)
       VALUES (:siteId, :benchLevelId, :activityType, :title, :description, :imageUrl, :activityDate)`,
      {
        siteId,
        benchLevelId: benchLevelId || null,
        activityType,
        title,
        description: safeDescription,
        // ถ้าส่ง images มา รูปปกจะถูกตั้งจากรูปแรกใน replaceImages
        imageUrl: urls?.length ? urls[0] : imageUrl || null,
        activityDate,
      }
    )
    if (urls) await replaceImages(conn, 'activity', result.insertId, urls)
    return result.insertId
  })

  res.status(201).json({ id })
})

export const updateActivity = asyncHandler(async (req, res) => {
  const { benchLevelId, activityType, title, description, imageUrl, images, activityDate } =
    req.body || {}

  await ensureExists('SELECT id FROM activities WHERE id = :id', { id: req.params.id }, 'ไม่พบกิจกรรม')

  const urls = normalizeImageUrls(images)
  const has = (key) => Object.prototype.hasOwnProperty.call(req.body || {}, key)

  await withTransaction(async (conn) => {
    await conn.query(
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
        // benchLevelId ต้องแยกจาก COALESCE เพราะ null คือค่าที่ตั้งใจได้
        // ("ไม่ผูกกับระดับชั้นไหน") ไม่ใช่ "ไม่ได้ส่งมา"
        touchBench: has('benchLevelId') ? 1 : 0,
        benchLevelId: benchLevelId || null,
        activityType: activityType ?? null,
        title: title ?? null,
        touchDescription: has('description') ? 1 : 0,
        description: sanitizeRichText(description),
        touchImage: has('imageUrl') ? 1 : 0,
        imageUrl: imageUrl || null,
        activityDate: activityDate ?? null,
      }
    )
    // replaceImages ตั้ง image_url ให้เป็นรูปแรกเสมอ จึงทำหลัง UPDATE ด้านบน
    if (urls) await replaceImages(conn, 'activity', req.params.id, urls)
  })

  res.json({ updated: true })
})

export const deleteActivity = asyncHandler(async (req, res) => {
  // post_images ผูก FK แบบ ON DELETE CASCADE จึงหายไปพร้อมกันเอง
  const [result] = await pool.query('DELETE FROM activities WHERE id = :id', { id: req.params.id })
  if (result.affectedRows === 0) throw ApiError.notFound('ไม่พบกิจกรรม')
  res.status(204).send()
})
