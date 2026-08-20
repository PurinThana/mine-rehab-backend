import { ApiError } from '../utils/ApiError.js'

// In-memory brute-force guard for POST /auth/login. Enough for a single
// API process; move to Redis if this ever runs behind more than one.
const attempts = new Map() // key -> { count, firstAt }

const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS) || 8
const WINDOW_MS = (Number(process.env.LOGIN_WINDOW_MINUTES) || 15) * 60 * 1000

// Keyed by IP *and* email so one attacker cannot lock out a real user by
// hammering their address from elsewhere, and one IP cannot spray many emails.
function keyFor(req) {
  const email = String(req.body?.email || '').toLowerCase()
  return `${req.ip}|${email}`
}

function prune(now) {
  for (const [key, entry] of attempts) {
    if (now - entry.firstAt > WINDOW_MS) attempts.delete(key)
  }
}

export function loginRateLimit(req, res, next) {
  const now = Date.now()
  if (attempts.size > 5000) prune(now) // keep the map from growing unbounded

  const key = keyFor(req)
  const entry = attempts.get(key)

  if (entry && now - entry.firstAt > WINDOW_MS) {
    attempts.delete(key)
  } else if (entry && entry.count >= MAX_ATTEMPTS) {
    const waitMinutes = Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 60000)
    res.set('Retry-After', String(waitMinutes * 60))
    return next(
      new ApiError(429, `พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${waitMinutes} นาที`)
    )
  }

  // The controller calls these once it knows whether the credentials were good.
  req.loginAttempt = {
    fail() {
      const current = attempts.get(key)
      if (current) current.count += 1
      else attempts.set(key, { count: 1, firstAt: Date.now() })
    },
    reset() {
      attempts.delete(key)
    },
  }

  next()
}
