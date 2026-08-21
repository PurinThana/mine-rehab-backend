import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'

export const listSites = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM sites ORDER BY id')
  res.json(rows)
})

export const getSite = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM sites WHERE id = :id', { id: req.params.id })
  if (!rows[0]) throw ApiError.notFound('ไม่พบไซต์')
  res.json(rows[0])
})

// Powers the six-figure StatsOverview.jsx strip on the landing page.
export const getSiteOverview = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM v_site_overview WHERE site_id = :id', {
    id: req.params.id,
  })
  if (!rows[0]) throw ApiError.notFound('ไม่พบไซต์')
  res.json(rows[0])
})

export const createSite = asyncHandler(async (req, res) => {
  const { name, companyName, startDate, endDate, heroImageUrl } = req.body || {}
  if (!name || !companyName || !startDate || !endDate) {
    throw ApiError.badRequest('ต้องระบุ name, companyName, startDate, endDate')
  }

  const [result] = await pool.query(
    `INSERT INTO sites (name, company_name, start_date, end_date, hero_image_url)
     VALUES (:name, :companyName, :startDate, :endDate, :heroImageUrl)`,
    { name, companyName, startDate, endDate, heroImageUrl: heroImageUrl || null }
  )
  res.status(201).json({ id: result.insertId })
})

export const updateSite = asyncHandler(async (req, res) => {
  const { name, companyName, startDate, endDate, heroImageUrl } = req.body || {}

  await ensureExists('SELECT id FROM sites WHERE id = :id', { id: req.params.id }, 'ไม่พบไซต์')

  await pool.query(
    `UPDATE sites SET
       name = COALESCE(:name, name),
       company_name = COALESCE(:companyName, company_name),
       start_date = COALESCE(:startDate, start_date),
       end_date = COALESCE(:endDate, end_date),
       hero_image_url = IF(:touchHero, :heroImageUrl, hero_image_url)
     WHERE id = :id`,
    {
      id: req.params.id,
      name: name ?? null,
      companyName: companyName ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      // ส่ง heroImageUrl: null คือ "เอารูปพื้นหลังออก" ไม่ส่งมาเลยคือ "ไม่แตะ"
      touchHero: Object.prototype.hasOwnProperty.call(req.body || {}, 'heroImageUrl') ? 1 : 0,
      heroImageUrl: heroImageUrl || null,
    }
  )
  res.json({ updated: true })
})
