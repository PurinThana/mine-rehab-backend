import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'

export const listSnapshots = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 12, 60)
  const [rows] = await pool.query(
    `SELECT snapshot_date, total_benches, planted_benches, total_trees, coverage_pct
     FROM progress_snapshots
     WHERE site_id = :siteId
     ORDER BY snapshot_date DESC
     LIMIT :limit`,
    { siteId: req.params.siteId, limit }
  )
  res.json(rows.reverse()) // oldest -> newest, ready to feed straight into a chart
})

// Takes the CURRENT state from v_site_overview and freezes it as a
// snapshot row. Call this from a monthly cron job (or manually) rather
// than writing snapshot numbers by hand.
export const createSnapshotFromCurrentState = asyncHandler(async (req, res) => {
  const { snapshotDate } = req.body || {}
  if (!snapshotDate) throw ApiError.badRequest('ต้องระบุ snapshotDate (YYYY-MM-DD)')

  const [[overview]] = await pool.query('SELECT * FROM v_site_overview WHERE site_id = :siteId', {
    siteId: req.params.siteId,
  })
  if (!overview) throw ApiError.notFound('ไม่พบไซต์')

  await pool.query(
    `INSERT INTO progress_snapshots
       (site_id, snapshot_date, total_benches, planted_benches, total_trees, coverage_pct)
     VALUES (:siteId, :snapshotDate, :totalBenches, :plantedBenches, :totalTrees, :coveragePct)
     ON DUPLICATE KEY UPDATE
       total_benches = VALUES(total_benches),
       planted_benches = VALUES(planted_benches),
       total_trees = VALUES(total_trees),
       coverage_pct = VALUES(coverage_pct)`,
    {
      siteId: req.params.siteId,
      snapshotDate,
      totalBenches: overview.total_benches,
      plantedBenches: overview.planted_benches,
      totalTrees: overview.total_trees,
      coveragePct: overview.coverage_pct,
    }
  )

  res.status(201).json({ recorded: true })
})
