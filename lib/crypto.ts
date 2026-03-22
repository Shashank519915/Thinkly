import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // For GCM
const AUTH_TAG_LENGTH = 16

/**
 * Encrypts a plain-text string (e.g., API Key) using the server's ENCRYPTION_SECRET.
 * The output is a colon-separated string: iv:authTag:encryptedData
 */
export function encrypt(text: string): string {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_SECRET must be at least 32 characters long.")
  }

  // Use only first 32 chars for the key
  const key = Buffer.from(secret).subarray(0, 32)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag().toString("hex")

  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

/**
 * Decrypts a string previously encrypted with the 'encrypt' function.
 */
export function decrypt(encryptedText: string): string {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_SECRET must be at least 32 characters long.")
  }

  const [ivHex, authTagHex, dataHex] = encryptedText.split(":")
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Invalid encrypted text format.")
  }

  const key = Buffer.from(secret).subarray(0, 32)
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as any

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(dataHex, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Decrypts a stored secret and intelligently extracts the active token.
 * Handles both legacy raw strings and the modern JSON token objects.
 */
export function getSecretToken(encryptedSecret: string): string {
  try {
    const decrypted = decrypt(encryptedSecret)
    
    // Check if it's a JSON object (OAuth or Manual Sync)
    if (decrypted.trim().startsWith('{')) {
      const data = JSON.parse(decrypted)
      return data.access_token || data.api_key || decrypted
    }
    
    return decrypted
  } catch (err) {
    console.error("Token extraction failed:", err)
    return ""
  }
}
