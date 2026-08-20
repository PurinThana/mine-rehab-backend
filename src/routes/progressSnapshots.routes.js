import { Router } from 'express'
import {
  listSnapshots,
  createSnapshotFromCurrentState,
} from '../controllers/progressSnapshots.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/sites/:siteId/progress-snapshots', listSnapshots)
router.post(
  '/sites/:siteId/progress-snapshots',
  requireAuth,
  requireRole('admin', 'staff'),
  createSnapshotFromCurrentState
)

export default router
