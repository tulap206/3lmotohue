import crypto from 'crypto'

// PBKDF2 Password hashing helper (uses standard Node.js crypto module)
// Safe to import in standard Node.js APIs (pages, routes), but NOT inside Edge Middleware.

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}
