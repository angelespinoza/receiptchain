/**
 * ReceiptChain Encryption — Privacy-first design v2
 *
 * Encrypts ALL expense data (merchant, amount, date, category, image)
 * into a single encrypted payload before uploading to IPFS.
 *
 * Key management:
 * - AES-256-GCM key auto-generated on first use
 * - Stored locally in IndexedDB (transparent to user)
 * - Backed up to IPFS encrypted with user's PIN (for recovery)
 * - No wallet signatures required for daily use
 */

import { getKeyStore } from './storage';

let cachedKey: CryptoKey | null = null;
let cachedAddress: string | null = null;

/**
 * The payload that gets encrypted and stored on IPFS
 */
export interface ExpensePayload {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  imageBase64: string;
}

/**
 * Encrypted key backup stored on IPFS
 */
interface KeyBackup {
  encryptedKey: string;  // AES key encrypted with PIN-derived key
  salt: string;          // Salt used for PIN key derivation
  iv: string;            // IV used for key encryption
  version: number;
}

// ─── Key Management ──────────────────────────────────────────────

/**
 * Get the encryption key for the given address.
 * Auto-generates a new key if none exists (zero friction).
 */
export async function getEncryptionKey(address: string): Promise<CryptoKey> {
  if (cachedKey && cachedAddress === address) {
    return cachedKey;
  }

  const store = await getKeyStore();

  // Try loading existing key from IndexedDB
  const stored = await store.get(address);
  if (stored?.rawKey) {
    const key = await crypto.subtle.importKey(
      'raw',
      base64ToArrayBuffer(stored.rawKey),
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    cachedKey = key;
    cachedAddress = address;
    return key;
  }

  // No key exists — generate a new one
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true, // extractable so we can backup
    ['encrypt', 'decrypt']
  );

  // Export and save to IndexedDB
  const rawKey = await crypto.subtle.exportKey('raw', key);
  await store.put(address, {
    rawKey: arrayBufferToBase64(rawKey),
    createdAt: Date.now(),
  });

  cachedKey = key;
  cachedAddress = address;
  return key;
}

/**
 * Check if a key exists for the given address (without generating one)
 */
export async function hasEncryptionKey(address: string): Promise<boolean> {
  const store = await getKeyStore();
  const stored = await store.get(address);
  return !!stored?.rawKey;
}

/**
 * Check if PIN backup has been configured for the given address
 */
export async function hasPinBackup(address: string): Promise<boolean> {
  const store = await getKeyStore();
  const stored = await store.get(address);
  return !!stored?.backupCID;
}

// ─── PIN Backup & Recovery ───────────────────────────────────────

/**
 * Create an encrypted backup of the key using a PIN.
 * Returns the encrypted backup as a string (to be uploaded to IPFS).
 */
export async function createPinBackup(
  address: string,
  pin: string
): Promise<string> {
  const store = await getKeyStore();
  const stored = await store.get(address);
  if (!stored?.rawKey) {
    throw new Error('No encryption key found for this address');
  }

  // Derive a key from the PIN
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const pinKey = await derivePinKey(pin, salt);

  // Encrypt the raw AES key with the PIN-derived key
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const rawKeyData = base64ToArrayBuffer(stored.rawKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    pinKey,
    rawKeyData
  );

  const backup: KeyBackup = {
    encryptedKey: arrayBufferToBase64(encrypted),
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    version: 1,
  };

  return JSON.stringify(backup);
}

/**
 * Save the backup CID reference for this address
 */
export async function saveBackupCID(address: string, cid: string): Promise<void> {
  const store = await getKeyStore();
  const stored = await store.get(address);
  if (stored) {
    await store.put(address, { ...stored, backupCID: cid });
  }
}

/**
 * Get the backup CID for an address (if configured)
 */
export async function getBackupCID(address: string): Promise<string | null> {
  const store = await getKeyStore();
  const stored = await store.get(address);
  return stored?.backupCID || null;
}

/**
 * Recover the encryption key from an encrypted backup using a PIN.
 * Restores the key to IndexedDB.
 */
export async function recoverKeyFromBackup(
  address: string,
  pin: string,
  backupData: string
): Promise<CryptoKey> {
  const backup: KeyBackup = JSON.parse(backupData);

  if (backup.version !== 1) {
    throw new Error('Unsupported backup version');
  }

  // Derive PIN key with same salt
  const salt = new Uint8Array(base64ToArrayBuffer(backup.salt));
  const pinKey = await derivePinKey(pin, salt);

  // Decrypt the AES key
  const iv = new Uint8Array(base64ToArrayBuffer(backup.iv));
  const encryptedKey = base64ToArrayBuffer(backup.encryptedKey);

  let rawKeyData: ArrayBuffer;
  try {
    rawKeyData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      pinKey,
      encryptedKey
    );
  } catch {
    throw new Error('PIN incorrecto. Intenta de nuevo.');
  }

  // Import and save
  const key = await crypto.subtle.importKey(
    'raw',
    rawKeyData,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const store = await getKeyStore();
  const existing = await store.get(address);
  await store.put(address, {
    rawKey: arrayBufferToBase64(rawKeyData),
    createdAt: Date.now(),
    backupCID: existing?.backupCID || undefined,
  });

  cachedKey = key;
  cachedAddress = address;
  return key;
}

// ─── Encrypt / Decrypt Payloads ──────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Derive an AES-256 key from a PIN using PBKDF2
 */
async function derivePinKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
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
