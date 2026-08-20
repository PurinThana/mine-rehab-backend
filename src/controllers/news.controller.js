import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'

export const listNews = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const [rows] = await pool.query(
    `SELECT id, title, body, published_date
     FROM news_posts
     WHERE site_id = :siteId
     ORDER BY published_date DESC
     LIMIT :limit`,
    { siteId: req.params.siteId, limit }
  )
  res.json(rows)
})

export const createNews = asyncHandler(async (req, res) => {
  const { siteId, title, body, publishedDate } = req.body || {}
  if (!siteId || !title || !publishedDate) {
    throw ApiError.badRequest('ต้องระบุ siteId, title, publishedDate')
  }

  const [result] = await pool.query(
    `INSERT INTO news_posts (site_id, title, body, published_date)
     VALUES (:siteId, :title, :body, :publishedDate)`,
    { siteId, title, body: body || null, publishedDate }
  )
  res.status(201).json({ id: result.insertId })
})

export const deleteNews = asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM news_posts WHERE id = :id', {
    id: req.params.id,
  })
  if (result.affectedRows === 0) throw ApiError.notFound('ไม่พบข่าว')
  res.status(204).send()
})

export const updateNews = asyncHandler(async (req, res) => {
  const { title, body, publishedDate } = req.body || {}

  await ensureExists('SELECT id FROM news_posts WHERE id = :id', { id: req.params.id }, 'ไม่พบข่าว')

  await pool.query(
    `UPDATE news_posts SET
       title = COALESCE(:title, title),
       body = IF(:touchBody, :body, body),
       published_date = COALESCE(:publishedDate, published_date)
     WHERE id = :id`,
    {
      id: req.params.id,
      title: title ?? null,
      touchBody: Object.prototype.hasOwnProperty.call(req.body || {}, 'body') ? 1 : 0,
      body: body || null,
      publishedDate: publishedDate ?? null,
    }
  )
  res.json({ updated: true })
})
