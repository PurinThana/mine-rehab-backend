import { Router } from 'express'
import {
  listSites,
  getSite,
  getSiteOverview,
  createSite,
  updateSite,
} from '../controllers/sites.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// --- public reads ---
router.get('/', listSites)
router.get('/:id', getSite)
router.get('/:id/overview', getSiteOverview)

// --- staff writes ---
router.post('/', requireAuth, requireRole('admin'), createSite)
router.put('/:id', requireAuth, requireRole('admin', 'staff'), updateSite)

export default router
