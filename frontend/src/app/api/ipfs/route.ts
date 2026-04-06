/**
 * ReceiptChain IPFS Upload API
 * Uploads encrypted receipt images to Pinata/IPFS
 * Returns the CID for storage on the blockchain
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataSecret = process.env.PINATA_SECRET_KEY;

    if (!pinataApiKey || !pinataSecret) {
      return NextResponse.json(
        { error: 'IPFS storage not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { encryptedData, fileName } = body;

    if (!encryptedData) {
      return NextResponse.json(
        { error: 'Missing encryptedData' },
        { status: 400 }
      );
    }

    // Convert base64 to binary for upload
    const binaryData = Buffer.from(encryptedData, 'base64');

    // Create form data for Pinata
    const formData = new FormData();
    const blob = new Blob([binaryData], { type: 'application/octet-stream' });
    formData.append('file', blob, fileName || 'receipt.enc');

    // Add metadata
    const metadata = JSON.stringify({
      name: fileName || 'receipt.enc',
      keyvalues: {
        app: 'ReceiptChain',
        encrypted: 'true',
      },
    });
    formData.append('pinataMetadata', metadata);

    // Upload to Pinata
    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecret,
      },
      body: formData,
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      throw new Error(`Pinata upload failed: ${errorText}`);
    }

    const result = await pinataResponse.json();

    return NextResponse.json({
      success: true,
      cid: result.IpfsHash,
      size: result.PinSize,
    });
  } catch (error) {
    console.error('IPFS upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to upload to IPFS: ${errorMessage}` },
      { status: 500 }
    );
  }
}
