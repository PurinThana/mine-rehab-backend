import { pool } from '../config/db.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../utils/ApiError.js'
import { verifyPassword, hashPassword } from '../utils/password.js'
import { signToken, decodeToken } from '../utils/jwt.js'

const publicUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  siteId: row.site_id,
})

export const login = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = req.body?.password

  if (!email || !password) {
    throw ApiError.badRequest('ต้องระบุ email และ password')
  }

  const [rows] = await pool.query(
    'SELECT id, site_id, name, email, password_hash, role FROM users WHERE email = :email LIMIT 1',
    { email }
  )
  const user = rows[0]

  // Same generic error whether the email doesn't exist or the password is
  // wrong, so the response never leaks which emails are registered.
  if (!user || !verifyPassword(password, user.password_hash)) {
    req.loginAttempt?.fail()
    throw ApiError.unauthorized('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  }

  req.loginAttempt?.reset()

  const token = signToken({ sub: user.id, role: user.role, siteId: user.site_id })

  res.json({
    token,
    // Unix seconds — lets the client drop the session before the API 401s.
    expiresAt: decodeToken(token)?.exp ?? null,
    user: publicUser(user),
  })
})

export const me = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, site_id, name, email, role FROM users WHERE id = :id LIMIT 1',
    { id: req.user.sub }
  )
  const user = rows[0]
  if (!user) throw ApiError.notFound('ไม่พบผู้ใช้')
  res.json(publicUser(user))
})

// Tokens are stateless, so there is nothing to revoke server-side — the
// client discards it. The endpoint exists so the frontend has one clear
// "end the session" call, and so adding a denylist later needs no API change.
export const logout = asyncHandler(async (req, res) => {
  res.json({ message: 'ออกจากระบบแล้ว' })
})

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}

  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('ต้องระบุ currentPassword และ newPassword')
  }
  if (String(newPassword).length < 8) {
    throw ApiError.badRequest('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร')
  }

  const [rows] = await pool.query(
    'SELECT id, password_hash FROM users WHERE id = :id LIMIT 1',
    { id: req.user.sub }
  )
  const user = rows[0]
  if (!user) throw ApiError.notFound('ไม่พบผู้ใช้')

  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw ApiError.unauthorized('รหัสผ่านปัจจุบันไม่ถูกต้อง')
  }

  await pool.query('UPDATE users SET password_hash = :hash WHERE id = :id', {
    hash: hashPassword(newPassword),
    id: user.id,
  })

  res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
})
