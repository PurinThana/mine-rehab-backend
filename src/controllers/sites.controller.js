import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'
import { sanitizeRichText } from '../utils/richText.js'

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
  const { name, companyName, startDate, endDate, heroImageUrl, location, storyTitle, storyIntro } =
    req.body || {}

  await ensureExists('SELECT id FROM sites WHERE id = :id', { id: req.params.id }, 'ไม่พบไซต์')

  const has = (key) => Object.prototype.hasOwnProperty.call(req.body || {}, key)

  await pool.query(
    `UPDATE sites SET
       name = COALESCE(:name, name),
       company_name = COALESCE(:companyName, company_name),
       start_date = COALESCE(:startDate, start_date),
       end_date = COALESCE(:endDate, end_date),
       hero_image_url = IF(:touchHero, :heroImageUrl, hero_image_url),
       location = IF(:touchLocation, :location, location),
       story_title = IF(:touchStoryTitle, :storyTitle, story_title),
       story_intro = IF(:touchStoryIntro, :storyIntro, story_intro)
     WHERE id = :id`,
    {
      id: req.params.id,
      name: name ?? null,
      companyName: companyName ?? null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      // ส่ง heroImageUrl: null คือ "เอารูปพื้นหลังออก" ไม่ส่งมาเลยคือ "ไม่แตะ"
      touchHero: has('heroImageUrl') ? 1 : 0,
      heroImageUrl: heroImageUrl || null,
      touchLocation: has('location') ? 1 : 0,
      location: location || null,
      touchStoryTitle: has('storyTitle') ? 1 : 0,
      storyTitle: storyTitle || null,
      // คำนำเป็น HTML จากตัวแก้ไข — ล้างก่อนเก็บเหมือนเนื้อหาอื่น
      touchStoryIntro: has('storyIntro') ? 1 : 0,
      storyIntro: sanitizeRichText(storyIntro),
    }
  )
  res.json({ updated: true })
})
