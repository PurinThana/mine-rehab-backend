import { Router } from 'express'
import {
  listSpecies,
  listSpeciesTotalsForSite,
  createSpecies,
  updateSpecies,
  deleteSpecies,
} from '../controllers/species.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/species', listSpecies)
router.get('/sites/:siteId/species-totals', listSpeciesTotalsForSite)
router.post('/species', requireAuth, requireRole('admin', 'staff'), createSpecies)
router.put('/species/:id', requireAuth, requireRole('admin', 'staff'), updateSpecies)
router.delete('/species/:id', requireAuth, requireRole('admin'), deleteSpecies)

export default router
