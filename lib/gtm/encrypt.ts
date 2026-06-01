import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_HEX = process.env.GTM_ENCRYPTION_KEY!

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('GTM_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32')
  }
  return Buffer.from(KEY_HEX, 'hex')
}

// Returns "iv:authTag:ciphertext" (all hex)
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(encoded: string): string {
  const [ivHex, tagHex, dataHex] = encoded.split(':')
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted value')
  const key = getKey()
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8')
}
