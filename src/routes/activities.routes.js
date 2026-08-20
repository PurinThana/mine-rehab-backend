import { Router } from 'express'
import {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} from '../controllers/activities.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// --- public reads ---
router.get('/sites/:siteId/activities', listActivities)
router.get('/activities/:id', getActivity)

// --- staff writes ---
router.post('/activities', requireAuth, requireRole('admin', 'staff'), createActivity)
router.put('/activities/:id', requireAuth, requireRole('admin', 'staff'), updateActivity)
router.delete('/activities/:id', requireAuth, requireRole('admin', 'staff'), deleteActivity)

export default router
