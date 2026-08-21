import { Router } from 'express'
import {
  listDocuments,
  getDocumentFile,
  createDocument,
  updateDocument,
  deleteDocument,
} from '../controllers/documents.controller.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// --- public reads ---
router.get('/sites/:siteId/documents', listDocuments)
// ส่งตัวไฟล์ออกพร้อม Content-Type ที่ถูกต้อง (ดูเหตุผลใน controller)
router.get('/documents/:id/file', getDocumentFile)

// --- staff writes ---
router.post('/documents', requireAuth, requireRole('admin', 'staff'), createDocument)
router.put('/documents/:id', requireAuth, requireRole('admin', 'staff'), updateDocument)
router.delete('/documents/:id', requireAuth, requireRole('admin', 'staff'), deleteDocument)

export default router
