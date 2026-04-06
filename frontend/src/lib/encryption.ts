/**
 * ReceiptChain Encryption — Privacy-first design
 *
 * Encrypts ALL expense data (merchant, amount, date, category, image)
 * into a single encrypted payload before uploading to IPFS.
 * Only the wallet owner can decrypt.
 *
 * Uses AES-GCM via Web Crypto API, key derived from wallet signature.
 */

let cachedKey: CryptoKey | null = null;
let cachedAddress: string | null = null;

const SIGN_MESSAGE = 'ReceiptChain: Authorize encryption for your receipts';
const SALT = new TextEncoder().encode('ReceiptChain-v1');

/**
 * The payload that gets encrypted and stored on IPFS
 */
export interface ExpensePayload {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  imageBase64: string;  // full base64 image data
}

/**
 * Get or create an AES-256 encryption key from wallet signature
 */
export async function getEncryptionKey(
  signFn: (message: string) => Promise<string>,
  address: string
): Promise<CryptoKey> {
  if (cachedKey && cachedAddress === address) {
    return cachedKey;
  }

  const signature = await signFn(SIGN_MESSAGE);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signature),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: SALT,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedKey = key;
  cachedAddress = address;
  return key;
}

/**
 * Encrypt a full expense payload (text + image) → base64 encrypted blob
 */
export async function encryptPayload(
  payload: ExpensePayload,
  key: CryptoKey
): Promise<string> {
  const jsonString = JSON.stringify(payload);
  const data = new TextEncoder().encode(jsonString);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Combine IV + ciphertext
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Decrypt a base64 encrypted blob → full expense payload
 */
export async function decryptPayload(
  encryptedBase64: string,
  key: CryptoKey
): Promise<ExpensePayload> {
  const combined = new Uint8Array(base64ToArrayBuffer(encryptedBase64));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const jsonString = new TextDecoder().decode(decrypted);
  return JSON.parse(jsonString) as ExpensePayload;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function clearEncryptionCache(): void {
  cachedKey = null;
  cachedAddress = null;
}
