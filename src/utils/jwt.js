import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h'

if (!SECRET) {
  // Fail loudly at boot rather than silently signing tokens with `undefined`.
  throw new Error('JWT_SECRET is not set — copy .env.example to .env and fill it in')
}

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN })
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET)
}

// Reads the payload without verifying — only for inspecting claims on a
// token we just signed ourselves (e.g. to report `exp` to the client).
export function decodeToken(token) {
  return jwt.decode(token)
}
