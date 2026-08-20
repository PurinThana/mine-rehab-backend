import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'

export const listSpecies = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM species ORDER BY name_th')
  res.json(rows)
})

// Powers FlowerTypes.jsx: total trees per species for one site.
export const listSpeciesTotalsForSite = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM v_species_totals WHERE site_id = :siteId ORDER BY total_trees DESC',
    { siteId: req.params.siteId }
  )
  res.json(rows)
})

export const createSpecies = asyncHandler(async (req, res) => {
  const { nameTh, colorHex } = req.body || {}
  if (!nameTh || !colorHex) throw ApiError.badRequest('ต้องระบุ nameTh และ colorHex')
  if (!/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
    throw ApiError.badRequest('colorHex ต้องอยู่ในรูปแบบ #RRGGBB')
  }

  const [result] = await pool.query(
    'INSERT INTO species (name_th, color_hex) VALUES (:nameTh, :colorHex)',
    { nameTh, colorHex }
  )
  res.status(201).json({ id: result.insertId })
})

export const updateSpecies = asyncHandler(async (req, res) => {
  const { nameTh, colorHex } = req.body || {}
  if (colorHex && !/^#[0-9A-Fa-f]{6}$/.test(colorHex)) {
    throw ApiError.badRequest('colorHex ต้องอยู่ในรูปแบบ #RRGGBB')
  }

  await ensureExists('SELECT id FROM species WHERE id = :id', { id: req.params.id }, 'ไม่พบพันธุ์พืช')

  await pool.query(
    `UPDATE species SET
       name_th = COALESCE(:nameTh, name_th),
       color_hex = COALESCE(:colorHex, color_hex)
     WHERE id = :id`,
    { id: req.params.id, nameTh: nameTh ?? null, colorHex: colorHex ?? null }
  )
  res.json({ updated: true })
})

// plantings.species_id เป็น FK แบบ ON DELETE RESTRICT — ถ้ามีการปลูกอ้างอยู่
// MySQL จะปฏิเสธ แล้ว errorHandler แปลงเป็น 409 พร้อมข้อความไทยให้แล้ว
export const deleteSpecies = asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM species WHERE id = :id', { id: req.params.id })
  if (result.affectedRows === 0) throw ApiError.notFound('ไม่พบพันธุ์พืช')
  res.status(204).send()
})
