import { Router } from 'express'
import {
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from '../controllers/activities.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/sites/:siteId/activities', listActivities)
router.post('/activities', requireAuth, requireRole('admin', 'staff'), createActivity)
router.put('/activities/:id', requireAuth, requireRole('admin', 'staff'), updateActivity)
router.delete('/activities/:id', requireAuth, requireRole('admin', 'staff'), deleteActivity)

export default router
