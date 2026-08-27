import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'
import { sanitizeRichText } from '../utils/richText.js'
import {
  fetchImagesForMany,
  normalizeImageUrls,
  replaceImages,
  withTransaction,
} from '../utils/postImages.js'

/**
 * "เรื่องราวการฟื้นฟู" — ขั้นตอนที่เล่าภาพรวมตั้งแต่เริ่มจนถึง Final Pit
 * และแผนวางระบบน้ำ
 *
 * เป็นรายการที่เรียงลำดับได้ แต่ละขั้นมีหัวข้อ เนื้อหาแบบจัดรูปแบบได้ และรูปหลายรูป
 * ใช้กลไกรูปและการล้าง HTML ตัวเดียวกับกิจกรรม/ข่าว
 */

export const listStorySteps = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, site_id, eyebrow, title, body, image_url, sort_order
       FROM story_steps
      WHERE site_id = :siteId
      ORDER BY sort_order, id`,
    { siteId: req.params.siteId }
  )

  const imagesById = await fetchImagesForMany('story', rows.map((r) => r.id))
  res.json(rows.map((row) => ({ ...row, images: imagesById.get(row.id) || [] })))
})

export const createStoryStep = asyncHandler(async (req, res) => {
  const { siteId, eyebrow, title, body, images, sortOrder } = req.body || {}
  if (!siteId || !title) throw ApiError.badRequest('ต้องระบุ siteId และ title')

  const urls = normalizeImageUrls(images)

  const id = await withTransaction(async (conn) => {
    // ไม่ส่งลำดับมา = ต่อท้ายรายการเดิม ผู้ใช้จะได้ไม่ต้องเดาเลขเอง
    let order = sortOrder
    if (order == null) {
      const [[last]] = await conn.query(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM story_steps WHERE site_id = :siteId',
        { siteId }
      )
      order = last.next
    }

    const [result] = await conn.query(
      `INSERT INTO story_steps (site_id, eyebrow, title, body, image_url, sort_order)
       VALUES (:siteId, :eyebrow, :title, :body, :imageUrl, :order)`,
      {
        siteId,
        eyebrow: eyebrow || null,
        title,
        body: sanitizeRichText(body),
        imageUrl: urls?.length ? urls[0] : null,
        order,
      }
    )
    if (urls) await replaceImages(conn, 'story', result.insertId, urls)
    return result.insertId
  })

  res.status(201).json({ id })
})

export const updateStoryStep = asyncHandler(async (req, res) => {
  const { eyebrow, title, body, images, sortOrder } = req.body || {}

  await ensureExists('SELECT id FROM story_steps WHERE id = :id', { id: req.params.id }, 'ไม่พบขั้นตอน')

  const urls = normalizeImageUrls(images)
  const has = (key) => Object.prototype.hasOwnProperty.call(req.body || {}, key)

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE story_steps SET
         eyebrow = IF(:touchEyebrow, :eyebrow, eyebrow),
         title = COALESCE(:title, title),
         body = IF(:touchBody, :body, body),
         sort_order = COALESCE(:sortOrder, sort_order)
       WHERE id = :id`,
      {
        id: req.params.id,
        touchEyebrow: has('eyebrow') ? 1 : 0,
        eyebrow: eyebrow || null,
        title: title ?? null,
        touchBody: has('body') ? 1 : 0,
        body: sanitizeRichText(body),
        sortOrder: sortOrder ?? null,
      }
    )
    // replaceImages ตั้ง image_url (รูปปก) ให้เป็นรูปแรกเสมอ จึงทำหลัง UPDATE
    if (urls) await replaceImages(conn, 'story', req.params.id, urls)
  })

  res.json({ updated: true })
})

export const deleteStoryStep = asyncHandler(async (req, res) => {
  // post_images ผูก FK แบบ ON DELETE CASCADE จึงหายไปพร้อมกันเอง
  const [result] = await pool.query('DELETE FROM story_steps WHERE id = :id', { id: req.params.id })
  if (result.affectedRows === 0) throw ApiError.notFound('ไม่พบขั้นตอน')
  res.status(204).send()
})
