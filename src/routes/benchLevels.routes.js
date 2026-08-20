import { Router } from 'express'
import {
  listBenchLevels,
  getBenchLevel,
  createBenchLevel,
  updateBenchLevel,
  deleteBenchLevel,
} from '../controllers/benchLevels.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// --- public reads ---
router.get('/sites/:siteId/bench-levels', listBenchLevels)
router.get('/bench-levels/:id', getBenchLevel)

// --- staff writes ---
router.post('/bench-levels', requireAuth, requireRole('admin', 'staff'), createBenchLevel)
router.put('/bench-levels/:id', requireAuth, requireRole('admin', 'staff'), updateBenchLevel)
router.delete('/bench-levels/:id', requireAuth, requireRole('admin'), deleteBenchLevel)

export default router
