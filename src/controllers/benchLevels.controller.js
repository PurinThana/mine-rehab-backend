import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'

export const listBenchLevels = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, site_id, elevation_m, area_sqm, status, sequence_order
     FROM bench_levels
     WHERE site_id = :siteId
     ORDER BY sequence_order`,
    { siteId: req.params.siteId }
  )
  res.json(rows)
})

// Bench level + its planting breakdown by species in one call —
// convenient for a detail drawer/page per level.
export const getBenchLevel = asyncHandler(async (req, res) => {
  const [[bench]] = await pool.query('SELECT * FROM bench_levels WHERE id = :id', {
    id: req.params.id,
  })
  if (!bench) throw ApiError.notFound('ไม่พบระดับชั้น')

  const [plantings] = await pool.query(
    `SELECT p.id, p.species_id, sp.name_th, sp.color_hex, p.tree_count, p.planted_date
     FROM plantings p
     JOIN species sp ON sp.id = p.species_id
     WHERE p.bench_level_id = :id
     ORDER BY sp.name_th`,
    { id: req.params.id }
  )

  res.json({ ...bench, plantings })
})

export const createBenchLevel = asyncHandler(async (req, res) => {
  const { siteId, elevationM, areaSqm, sequenceOrder, status } = req.body || {}
  if (!siteId || elevationM == null || areaSqm == null || sequenceOrder == null) {
    throw ApiError.badRequest('ต้องระบุ siteId, elevationM, areaSqm, sequenceOrder')
  }

  const [result] = await pool.query(
    `INSERT INTO bench_levels (site_id, elevation_m, area_sqm, status, sequence_order)
     VALUES (:siteId, :elevationM, :areaSqm, :status, :sequenceOrder)`,
    { siteId, elevationM, areaSqm, status: status || 'not_planted', sequenceOrder }
  )
  res.status(201).json({ id: result.insertId })
})

export const updateBenchLevel = asyncHandler(async (req, res) => {
  const { elevationM, areaSqm, status, sequenceOrder } = req.body || {}
  if (status && !['planted', 'not_planted'].includes(status)) {
    throw ApiError.badRequest("status ต้องเป็น 'planted' หรือ 'not_planted'")
  }

  await ensureExists(
    'SELECT id FROM bench_levels WHERE id = :id',
    { id: req.params.id },
    'ไม่พบระดับชั้น'
  )

  await pool.query(
    `UPDATE bench_levels SET
       elevation_m = COALESCE(:elevationM, elevation_m),
       area_sqm = COALESCE(:areaSqm, area_sqm),
       status = COALESCE(:status, status),
       sequence_order = COALESCE(:sequenceOrder, sequence_order)
     WHERE id = :id`,
    {
      id: req.params.id,
      elevationM: elevationM ?? null,
      areaSqm: areaSqm ?? null,
      status: status ?? null,
      sequenceOrder: sequenceOrder ?? null,
    }
  )
  res.json({ updated: true })
})

export const deleteBenchLevel = asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM bench_levels WHERE id = :id', {
    id: req.params.id,
  })
  if (result.affectedRows === 0) throw ApiError.notFound('ไม่พบระดับชั้น')
  res.status(204).send()
})
