import { verifyToken } from '../utils/jwt.js'
import { ApiError } from '../utils/ApiError.js'

// Attaches req.user = { id, email, role, siteId } when a valid Bearer
// token is present. GET endpoints stay public (no auth call needed) —
// only mutating routes use this.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('ต้องแนบ Bearer token ใน Authorization header'))
  }

  try {
    const payload = verifyToken(token)
    req.user = payload
    next()
  } catch {
    next(ApiError.unauthorized('token ไม่ถูกต้องหรือหมดอายุ'))
  }
}

// requireRole('admin') or requireRole('admin', 'staff')
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized())
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden(`ต้องมีสิทธิ์: ${allowedRoles.join(' หรือ ')}`))
    }
    next()
  }
}
