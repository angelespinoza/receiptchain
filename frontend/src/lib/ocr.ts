/**
 * ReceiptChain OCR Processing
 * Receipt image processing with Tesseract.js
 */

import { createWorker, type Worker } from 'tesseract.js';

/**
 * Parsed receipt data from OCR
 */
export interface ReceiptData {
  merchant: string;
  date: string;
  amount: number;
  items: string[];
  rawText: string;
  confidence: number;
}

/**
 * Process a receipt image using Tesseract.js
 * Recognizes text in Spanish and extracts merchant, date, amount, and items
 */
export async function processReceipt(imageData: string): Promise<ReceiptData> {
  let worker: Worker | null = null;

  try {
    // Create Tesseract worker with Spanish language
    worker = await createWorker('spa');

    // Convert base64 to ImageLike format if needed
    const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;

    // Recognize text from the image
    const {
      data: { text, confidence },
    } = await worker.recognize(imageUrl);

    // Parse the raw text
    const rawText = text.trim();
    const merchant = extractMerchant(rawText);
    const date = extractDate(rawText);
    const amount = extractAmount(rawText);
    const items = extractItems(rawText);

    return {
      merchant,
      date,
      amount,
      items,
      rawText,
      confidence: Math.round(confidence),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('OCR processing error:', errorMessage);

    // Return partial data with error indication
    return {
      merchant: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      items: [],
      rawText: '',
      confidence: 0,
    };
  } finally {
    // Terminate worker to free resources
    if (worker) {
      await worker.terminate();
    }
  }
}

/**
 * Extract merchant name from receipt text
 * Usually in the first few lines
 */
function extractMerchant(text: string): string {
  const lines = text.split('\n').filter((line) => line.trim());

  if (lines.length === 0) return '';

  // First non-empty line is typically the merchant
  let merchant = lines[0];

  // Clean up common patterns
  merchant = merchant
    .replace(/^\d+/, '') // Remove leading numbers
    .trim();

  // Keep only first 50 chars for merchant name
  return merchant.substring(0, 50).trim();
}

/**
 * Extract date from receipt text
 * Looks for DD/MM/YYYY or DD-MM-YYYY patterns
 */
function extractDate(text: string): string {
  // Pattern for DD/MM/YYYY or DD-MM-YYYY
  const datePattern = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/;
  const match = text.match(datePattern);

  if (match) {
    // Return in ISO format YYYY-MM-DD
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }

  // Pattern for YYYY-MM-DD
  const isoPattern = /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/;
  const isoMatch = text.match(isoPattern);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  // Default to today if no date found
  return new Date().toISOString().split('T')[0];
}

/**
 * Extract total amount from receipt text
 * Looks for total, subtotal, amount patterns with currency symbols
 */
function extractAmount(text: string): number {
  // Patterns for amounts with $ or other currency symbols
  const patterns = [
    /total\s*a\s*pagar[:\s]*[$]?\s*([\d,\.]+)/i, // "total a pagar: $123.45"
    /total[:\s]*[$]?\s*([\d,\.]+)/i, // "total: $123.45"
    /subtotal[:\s]*[$]?\s*([\d,\.]+)/i, // "subtotal: $123.45"
    /\$\s*([\d,\.]+)(?=\s*$)/m, // "$123.45" at end of line
    /[$]?\s*([\d,\.]+)\s*$(?=.*pagar)/m, // Amount at end before pagar
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Parse the amount, handling comma and dot as decimal separators
      let amountStr = match[1].replace(/\s/g, '');

      // Determine if comma or dot is decimal separator
      const lastCommaIndex = amountStr.lastIndexOf(',');
      const lastDotIndex = amountStr.lastIndexOf('.');

      if (lastCommaIndex > lastDotIndex) {
        // Comma is decimal separator
        amountStr = amountStr.replace(/\./g, '').replace(',', '.');
      } else {
        // Dot is decimal separator
        amountStr = amountStr.replace(/,/g, '');
      }

      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        return parseFloat(amount.toFixed(2));
      }
    }
  }

  return 0;
}

/**
 * Extract individual items from receipt
 * Looks for lines with prices or item-like content
 */
function extractItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split('\n');

  // Pattern to identify item lines (usually contains some text and a price)
  const itemPattern = /^(.+?)\s+[\d,\.]+\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, headers, and total lines
    if (!trimmed || trimmed.length < 3) continue;
    if (/^(total|subtotal|cantidad|item|producto|descripcion)/i.test(trimmed)) continue;
    if (/^[\s\d\-=]+$/.test(trimmed)) continue;

    const match = trimmed.match(itemPattern);
    if (match) {
      const item = match[1].trim();
      if (item.length > 2 && item.length < 100) {
        items.push(item);
      }
    }
  }

  return items.slice(0, 20); // Limit to 20 items
}

/**
 * Suggest expense category based on merchant name and items
 */
export function suggestCategory(merchant: string, items: string[]): string {
  const text = `${merchant} ${items.join(' ')}`.toLowerCase();

  // Salud (Health) keywords
  if (/farmaci|medical|doctor|hospital|salud|medicina|receta|farmacéutic/i.test(text)) {
    return 'salud';
  }

  // Transporte (Transport) keywords
  if (/uber|taxi|gas|gasolina|transport|bus|metro|colectivo|viaje|vuelo|tren|avion/i.test(text)) {
    return 'transporte';
  }

  // Entretenimiento (Entertainment) keywords
  if (/netflix|cine|cinema|movie|spotify|game|juego|disney|hbo|película|streaming|entretenimiento|bar|club|pub|discoteca/i.test(text)) {
    return 'entretenimiento';
  }

  // Educación (Education) keywords
  if (/escuela|colegio|universidad|educación|libro|curso|clase|maestro|profesor|school|academy|estudio/i.test(text)) {
    return 'educacion';
  }

  // Ropa (Clothing) keywords
  if (/ropa|clothing|tienda|shop|zapatos|shoes|bolsa|pantalon|camisa|dress|fashion|vestuario/i.test(text)) {
    return 'ropa';
  }

  // Hogar (Home) keywords
  if (/hogar|casa|home|furniture|mueble|decoración|cocina|baño|limpieza|construcción|ferretería|hardware/i.test(text)) {
    return 'hogar';
  }

  // Alimentos (Food) keywords
  if (/alimento|comida|restaurante|food|café|coffee|pizza|burger|restaurant|supermercado|market|carnicería|bakery|panadería|grocery/i.test(text)) {
    return 'alimentos';
  }

  // Default to otros (Other)
  return 'otros';
}
