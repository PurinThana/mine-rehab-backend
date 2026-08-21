import { Router } from 'express'
import {
  listNews,
  getNews,
  createNews,
  updateNews,
  deleteNews,
} from '../controllers/news.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// --- public reads ---
router.get('/sites/:siteId/news', listNews)
router.get('/news/:id', getNews)

// --- staff writes ---
router.post('/news', requireAuth, requireRole('admin', 'staff'), createNews)
router.put('/news/:id', requireAuth, requireRole('admin', 'staff'), updateNews)
router.delete('/news/:id', requireAuth, requireRole('admin', 'staff'), deleteNews)

export default router
