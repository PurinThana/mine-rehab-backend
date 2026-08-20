import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'

export const listDocuments = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, title, file_url, file_size_kb, category, uploaded_date
     FROM documents
     WHERE site_id = :siteId
     ORDER BY uploaded_date DESC`,
    { siteId: req.params.siteId }
  )
  res.json(rows)
})

// NOTE: this records document metadata only. Actual file upload (to S3 /
// R2 / local disk) should happen in front of this call — file_url is
// wherever that upload landed. Keeping upload and metadata separate
// keeps this endpoint fast and storage-provider-agnostic.
export const createDocument = asyncHandler(async (req, res) => {
  const { siteId, title, fileUrl, fileSizeKb, category, uploadedDate } = req.body || {}
  if (!siteId || !title || !fileUrl || fileSizeKb == null || !category || !uploadedDate) {
    throw ApiError.badRequest('ต้องระบุ siteId, title, fileUrl, fileSizeKb, category, uploadedDate')
  }

  const [result] = await pool.query(
    `INSERT INTO documents (site_id, title, file_url, file_size_kb, category, uploaded_date)
     VALUES (:siteId, :title, :fileUrl, :fileSizeKb, :category, :uploadedDate)`,
    { siteId, title, fileUrl, fileSizeKb, category, uploadedDate }
  )
  res.status(201).json({ id: result.insertId })
})

export const deleteDocument = asyncHandler(async (req, res) => {
  const [result] = await pool.query('DELETE FROM documents WHERE id = :id', {
    id: req.params.id,
  })
  if (result.affectedRows === 0) throw ApiError.notFound('ไม่พบเอกสาร')
  res.status(204).send()
})

export const updateDocument = asyncHandler(async (req, res) => {
  const { title, fileUrl, fileSizeKb, category, uploadedDate } = req.body || {}

  await ensureExists('SELECT id FROM documents WHERE id = :id', { id: req.params.id }, 'ไม่พบเอกสาร')

  await pool.query(
    `UPDATE documents SET
       title = COALESCE(:title, title),
       file_url = COALESCE(:fileUrl, file_url),
       file_size_kb = COALESCE(:fileSizeKb, file_size_kb),
       category = COALESCE(:category, category),
       uploaded_date = COALESCE(:uploadedDate, uploaded_date)
     WHERE id = :id`,
    {
      id: req.params.id,
      title: title ?? null,
      fileUrl: fileUrl ?? null,
      fileSizeKb: fileSizeKb ?? null,
      category: category ?? null,
      uploadedDate: uploadedDate ?? null,
    }
  )
  res.json({ updated: true })
})
