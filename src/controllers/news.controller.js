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

export const listNews = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const [rows] = await pool.query(
    `SELECT id, title, body, image_url, published_date
     FROM news_posts
     WHERE site_id = :siteId
     ORDER BY published_date DESC, id DESC
     LIMIT :limit`,
    { siteId: req.params.siteId, limit }
  )

  const imagesById = await fetchImagesForMany('news', rows.map((r) => r.id))
  res.json(rows.map((row) => ({ ...row, images: imagesById.get(row.id) || [] })))
})

// ข่าวเดียวสำหรับหน้ารายละเอียด — เปิดลิงก์ตรง/refresh ได้โดยไม่ต้องโหลดรายการก่อน
export const getNews = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT n.id, n.site_id, n.title, n.body, n.image_url, n.published_date, n.created_at,
            s.name AS site_name
       FROM news_posts n
       LEFT JOIN sites s ON s.id = n.site_id
      WHERE n.id = :id
      LIMIT 1`,
    { id: req.params.id }
  )
  if (!rows[0]) throw ApiError.notFound('ไม่พบข่าว')

  const images = await fetchImages('news', rows[0].id)
  res.json({ ...rows[0], images: images.map((i) => i.image_url) })
})

export const createNews = asyncHandler(async (req, res) => {
  const { siteId, title, body, imageUrl, images, publishedDate } = req.body || {}
  if (!siteId || !title || !publishedDate) {
    throw ApiError.badRequest('ต้องระบุ siteId, title, publishedDate')
  }

  const urls = normalizeImageUrls(images)
  // body เป็น HTML จากตัวแก้ไขในหน้าแอดมิน — ล้างก่อนเก็บเสมอ
  const safeBody = sanitizeRichText(body)

  const id = await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO news_posts (site_id, title, body, image_url, published_date)
       VALUES (:siteId, :title, :body, :imageUrl, :publishedDate)`,
      {
        siteId,
        title,
        body: safeBody,
        imageUrl: urls?.length ? urls[0] : imageUrl || null,
        publishedDate,
      }
    )
    if (urls) await replaceImages(conn, 'news', result.insertId, urls)
    return result.insertId
  })

  res.status(201).json({ id })
})

export const updateNews = asyncHandler(async (req, res) => {
  const { title, body, imageUrl, images, publishedDate } = req.body || {}

  await ensureExists('SELECT id FROM news_posts WHERE id = :id', { id: req.params.id }, 'ไม่พบข่าว')

  const urls = normalizeImageUrls(images)
  const has = (key) => Object.prototype.hasOwnProperty.call(req.body || {}, key)

  await withTransaction(async (conn) => {
    await conn.query(
      `UPDATE news_posts SET
         title = COALESCE(:title, title),
         body = IF(:touchBody, :body, body),
         image_url = IF(:touchImage, :imageUrl, image_url),
         published_date = COALESCE(:publishedDate, published_date)
       WHERE id = :id`,
      {
        id: req.params.id,
        title: title ?? null,
        touchBody: has('body') ? 1 : 0,
        body: sanitizeRichText(body),
        touchImage: has('imageUrl') ? 1 : 0,
        imageUrl: imageUrl || null,
        publishedDate: publishedDate ?? null,
      }
    )
    if (urls) await replaceImages(conn, 'news', req.params.id, urls)
  })

  res.json({ updated: true })
})

export const deleteNews = asyncHandler(async (req, res) => {
  // post_images ผูก FK แบบ ON DELETE CASCADE จึงหายไปพร้อมกันเอง
  const [result] = await pool.query('DELETE FROM news_posts WHERE id = :id', { id: req.params.id })
  if (result.affectedRows === 0) throw ApiError.notFound('ไม่พบข่าว')
  res.status(204).send()
})
