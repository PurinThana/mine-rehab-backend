import { ApiError } from '../utils/ApiError.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `ไม่พบเส้นทาง ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: err.message, details: err.details })
  }

  // MySQL duplicate key / FK violations -> readable 409/400 instead of a raw 500.
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'ข้อมูลนี้มีอยู่แล้ว (duplicate entry)' })
  }
  if (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ error: 'อ้างอิงถึงข้อมูลที่ไม่มีอยู่จริง (invalid foreign key)' })
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ error: 'ไม่สามารถลบได้ เนื่องจากมีข้อมูลอื่นอ้างอิงอยู่' })
  }

  console.error(err)
  res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ (internal server error)' })
}
