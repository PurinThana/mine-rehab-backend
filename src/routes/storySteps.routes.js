import { Router } from 'express'
import {
  listStorySteps,
  createStoryStep,
  updateStoryStep,
  deleteStoryStep,
} from '../controllers/storySteps.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// --- public reads ---
router.get('/sites/:siteId/story-steps', listStorySteps)

// --- staff writes ---
router.post('/story-steps', requireAuth, requireRole('admin', 'staff'), createStoryStep)
router.put('/story-steps/:id', requireAuth, requireRole('admin', 'staff'), updateStoryStep)
router.delete('/story-steps/:id', requireAuth, requireRole('admin', 'staff'), deleteStoryStep)

export default router
