/**
 * Encryption utility for sensitive data storage
 * Uses Web Crypto API for secure encryption/decryption
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derive encryption key from user credentials
 * Uses PBKDF2 to derive a key from user ID and a stored salt
 */
async function deriveKey(userId: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Ensure salt is a proper Uint8Array backed by ArrayBuffer, not SharedArrayBuffer
  // Always copy to a new Uint8Array backed by a true ArrayBuffer (not SharedArrayBuffer or ArrayBufferLike)
  const saltArray = Uint8Array.from(salt);
  const saltBuffer = new Uint8Array(Array.prototype.slice.call(saltArray));
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create salt for key derivation
 */
function getOrCreateSalt(): Uint8Array {
  const saltKey = 'encryption_salt';
  const stored = localStorage.getItem(saltKey);
  
  if (stored) {
    const saltArray = JSON.parse(stored);
    return new Uint8Array(saltArray);
  }
  
  // Generate new salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(saltKey, JSON.stringify(Array.from(salt)));
  return salt;
}

/**
 * Encrypt sensitive data
 */
export async function encryptData(data: string, userId: string): Promise<string> {
  try {
    const salt = getOrCreateSalt();
    const key = await deriveKey(userId, salt);
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    // Encrypt
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      encoder.encode(data)
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export async function decryptData(encryptedData: string, userId: string): Promise<string> {
  try {
    const salt = getOrCreateSalt();
    const key = await deriveKey(userId, salt);
    
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, IV_LENGTH);
    const encrypted = combined.slice(IV_LENGTH);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: iv,
      },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Clear encryption salt (call on logout)
 */
export function clearEncryptionSalt(): void {
  localStorage.removeItem('encryption_salt');
}

