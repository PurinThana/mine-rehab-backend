import { Router } from 'express'
import { upsertPlanting, deletePlanting } from '../controllers/plantings.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.post('/plantings', requireAuth, requireRole('admin', 'staff'), upsertPlanting)
router.delete('/plantings/:id', requireAuth, requireRole('admin', 'staff'), deletePlanting)

export default router
