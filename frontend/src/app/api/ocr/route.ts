/**
 * OCR API Route - Google Cloud Vision
 * Processes receipt images server-side for accurate text extraction
 */

import { NextRequest, NextResponse } from 'next/server';

// Allow larger payloads for images (up to 10MB)
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64 } = body;

    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      console.error('[OCR API] GOOGLE_CLOUD_VISION_API_KEY not set');
      return NextResponse.json(
        { success: false, error: 'Google Cloud Vision API key not configured' },
        { status: 500 }
      );
    }

    // Remove data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');

    console.log(`[OCR API] Sending image to Cloud Vision (${Math.round(base64Data.length / 1024)}KB)`);

    // Call Google Cloud Vision API
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Data },
              features: [
                { type: 'TEXT_DETECTION', maxResults: 1 },
              ],
              imageContext: {
                languageHints: ['es', 'en', 'ja'],
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[OCR API] Google Vision error:', response.status, errorData);
      return NextResponse.json(
        { success: false, error: `Google Vision API error: ${response.status}` },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Check for API-level errors
    if (data.responses?.[0]?.error) {
      const apiError = data.responses[0].error;
      console.error('[OCR API] Vision API returned error:', apiError);
      return NextResponse.json(
        { success: false, error: apiError.message || 'Vision API error' },
        { status: 500 }
      );
    }

    const annotations = data.responses?.[0]?.textAnnotations;
    if (!annotations || annotations.length === 0) {
      console.log('[OCR API] No text detected in image');
      return NextResponse.json({
        success: true,
        text: '',
        confidence: 0,
      });
    }

    // First annotation contains the full text
    const fullText = annotations[0].description || '';
    console.log(`[OCR API] Detected ${fullText.length} chars of text`);

    // Calculate average confidence from word-level detections
    const wordAnnotations = data.responses?.[0]?.fullTextAnnotation;
    let avgConfidence = 85;

    if (wordAnnotations?.pages?.[0]?.confidence) {
      avgConfidence = Math.round(wordAnnotations.pages[0].confidence * 100);
    }

    return NextResponse.json({
      success: true,
      text: fullText,
      confidence: avgConfidence,
    });
  } catch (error) {
    console.error('[OCR API] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
