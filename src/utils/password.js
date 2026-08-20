import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64

// Stored format: "<saltHex>:<hashHex>" — self-contained, no separate column needed.
export function hashPassword(plainPassword) {
  const salt = randomBytes(16)
  const derivedKey = scryptSync(plainPassword, salt, KEY_LENGTH)
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`
}

export function verifyPassword(plainPassword, stored) {
  const [saltHex, hashHex] = String(stored).split(':')
  if (!saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, 'hex')
  const storedHash = Buffer.from(hashHex, 'hex')
  const candidateHash = scryptSync(plainPassword, salt, KEY_LENGTH)

  // Lengths must match before timingSafeEqual, or it throws.
  if (storedHash.length !== candidateHash.length) return false
  return timingSafeEqual(storedHash, candidateHash)
}
