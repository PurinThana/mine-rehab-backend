import { Router } from 'express'
import {
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../controllers/documents.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.get('/sites/:siteId/documents', listDocuments)
router.post('/documents', requireAuth, requireRole('admin', 'staff'), createDocument)
router.put('/documents/:id', requireAuth, requireRole('admin', 'staff'), updateDocument)
router.delete('/documents/:id', requireAuth, requireRole('admin', 'staff'), deleteDocument)

export default router
