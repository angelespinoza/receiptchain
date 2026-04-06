/**
 * ReceiptChain IPFS Integration
 * Upload encrypted images to IPFS via Pinata, and download/decrypt them
 */

import { IPFS_GATEWAY } from './constants';

/**
 * Upload encrypted image data to IPFS via the relay API
 * Returns the IPFS CID
 */
export async function uploadToIPFS(encryptedBase64: string, fileName?: string): Promise<string> {
  const response = await fetch('/api/ipfs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      encryptedData: encryptedBase64,
      fileName: fileName || `receipt-${Date.now()}.enc`,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to upload to IPFS');
  }

  return result.cid;
}

/**
 * Download encrypted data from IPFS by CID
 * Returns base64-encoded encrypted data
 */
export async function downloadFromIPFS(cid: string): Promise<string> {
  if (!cid) throw new Error('No CID provided');

  const url = `${IPFS_GATEWAY}/${cid}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download from IPFS: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();

  // Convert to base64
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}
