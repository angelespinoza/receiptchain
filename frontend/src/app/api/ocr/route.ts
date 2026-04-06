/**
 * OCR API Route - Google Cloud Vision
 * Processes receipt images server-side for accurate text extraction
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Google Cloud Vision API key not configured' },
        { status: 500 }
      );
    }

    // Remove data URI prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

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
      console.error('Google Vision API error:', errorData);
      return NextResponse.json(
        { success: false, error: 'Google Vision API request failed' },
        { status: 500 }
      );
    }

    const data = await response.json();

    const annotations = data.responses?.[0]?.textAnnotations;
    if (!annotations || annotations.length === 0) {
      return NextResponse.json({
        success: true,
        text: '',
        confidence: 0,
      });
    }

    // First annotation contains the full text
    const fullText = annotations[0].description || '';

    // Calculate average confidence from word-level detections
    const wordAnnotations = data.responses?.[0]?.fullTextAnnotation;
    let avgConfidence = 85; // Default high confidence for Cloud Vision

    if (wordAnnotations?.pages?.[0]?.confidence) {
      avgConfidence = Math.round(wordAnnotations.pages[0].confidence * 100);
    }

    return NextResponse.json({
      success: true,
      text: fullText,
      confidence: avgConfidence,
    });
  } catch (error) {
    console.error('OCR API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
