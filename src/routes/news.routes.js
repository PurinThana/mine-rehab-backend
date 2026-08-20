import { Router } from 'express'
import {
  listNews,
  createNews,
  updateNews,
  deleteNews,
} from '../controllers/news.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/sites/:siteId/news', listNews)
router.post('/news', requireAuth, requireRole('admin', 'staff'), createNews)
router.put('/news/:id', requireAuth, requireRole('admin', 'staff'), updateNews)
router.delete('/news/:id', requireAuth, requireRole('admin', 'staff'), deleteNews)

export default router
