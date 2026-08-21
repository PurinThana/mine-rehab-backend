import { Readable } from 'node:stream'

import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { ensureExists } from '../utils/ensureExists.js'
import { cloudinary, isCloudinaryConfigured } from '../config/cloudinary.js'

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

// ดึง public_id และ resource_type ออกจาก URL ของ Cloudinary
// รูปแบบ: https://res.cloudinary.com/<cloud>/<raw|image>/upload/[v123/]<public_id>
function parseCloudinaryUrl(url) {
  const match = String(url).match(
    /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload\/(?:v\d+\/)?(.+)$/
  )
  if (!match) return null
  return { resourceType: match[1], publicId: match[2] }
}

/**
 * ส่งไฟล์เอกสารให้เบราว์เซอร์เปิดดู
 *
 * ปัญหาที่แก้: บัญชี Cloudinary แบบฟรีบล็อกการส่ง PDF ผ่าน URL สาธารณะ
 * (ตอบ 401 พร้อม X-Cld-Error: deny or ACL failure) ลิงก์ตรงจึงเปิดไม่ได้
 * และการเปลี่ยนชื่อไฟล์ให้ไม่มีนามสกุลก็ไม่ช่วย เพราะไฟล์ที่เคยอัปโหลดด้วย
 * .pdf ถูกจำสถานะไว้แล้ว
 *
 * ทางออก: ไม่ลิงก์ไป Cloudinary ตรงๆ เลย แต่ให้เซิร์ฟเวอร์สร้าง signed URL
 * ของ Admin API (ใช้ API secret ที่อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น) แล้ว stream
 * ไฟล์ต่อออกไปพร้อม Content-Type และชื่อไฟล์ที่ถูกต้อง
 *
 * ได้ผลกับไฟล์ทั้งเก่าและใหม่ ไม่ต้องอัปโหลดซ้ำ และไม่ต้องไปเปิดการตั้งค่า
 * ในบัญชี Cloudinary
 *
 * ลิงก์ที่ไม่ได้อยู่บน Cloudinary (เอกสารที่กรอก URL ภายนอกไว้) จะ redirect
 * ไปตรงๆ ไม่ดึงผ่านเซิร์ฟเวอร์เพื่อไม่เปลืองแบนด์วิดท์
 */
export const getDocumentFile = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, title, file_url FROM documents WHERE id = :id LIMIT 1',
    { id: req.params.id }
  )
  const doc = rows[0]
  if (!doc) throw ApiError.notFound('ไม่พบเอกสาร')

  const parsed = parseCloudinaryUrl(doc.file_url)
  if (!parsed) return res.redirect(302, doc.file_url)

  if (!isCloudinaryConfigured) {
    throw new ApiError(503, 'ยังไม่ได้ตั้งค่า Cloudinary ในไฟล์ .env จึงดึงไฟล์ไม่ได้')
  }

  // อายุสั้นๆ พอสำหรับดึงไฟล์รอบนี้ ไม่ได้ส่ง URL นี้ออกไปให้ client
  const signedUrl = cloudinary.utils.private_download_url(parsed.publicId, '', {
    resource_type: parsed.resourceType,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + 300,
  })

  let upstream
  try {
    upstream = await fetch(signedUrl)
  } catch (err) {
    throw new ApiError(502, `ดึงไฟล์จากที่เก็บไม่สำเร็จ: ${err.message}`)
  }
  if (!upstream.ok) {
    throw new ApiError(502, `ที่เก็บไฟล์ตอบกลับ ${upstream.status}`)
  }

  // ชื่อไฟล์เอาจาก title ที่ผู้ใช้ตั้ง ไม่ใช่ public_id ที่มีตัวสุ่มต่อท้าย
  const safeTitle = String(doc.title || 'document').replace(/[\/:*?"<>|]+/g, '_').slice(0, 100)
  const ext = /\.pdf$/i.test(parsed.publicId) ? '' : '.pdf'
  const filename = `${safeTitle}${ext || '.pdf'}`

  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/pdf')
  // filename* ตาม RFC 5987 เพื่อให้ชื่อไฟล์ภาษาไทยไม่กลายเป็นตัวขยะ
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(filename)}`
  )
  const length = upstream.headers.get('content-length')
  if (length) res.setHeader('Content-Length', length)
  res.setHeader('Cache-Control', 'public, max-age=3600')

  // stream ต่อออกไปเลย ไม่อ่านทั้งไฟล์เข้า memory ก่อน
  Readable.fromWeb(upstream.body).pipe(res)
})
