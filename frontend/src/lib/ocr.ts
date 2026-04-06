/**
 * ReceiptChain OCR Processing
 * Receipt image processing with Tesseract.js
 * Supports multiple currencies: PEN (S/), USD ($), JPY (¥), EUR (€), etc.
 */

import { createWorker, type Worker } from 'tesseract.js';

export interface ReceiptData {
  merchant: string;
  date: string;
  amount: number;
  currency: string;
  items: string[];
  rawText: string;
  confidence: number;
}

/**
 * Process a receipt image using Tesseract.js
 */
export async function processReceipt(imageData: string): Promise<ReceiptData> {
  let worker: Worker | null = null;

  try {
    // Create Tesseract worker with Spanish + English
    worker = await createWorker('spa+eng');

    const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;

    const {
      data: { text, confidence },
    } = await worker.recognize(imageUrl);

    const rawText = text.trim();
    const merchant = extractMerchant(rawText);
    const date = extractDate(rawText);
    const { amount, currency } = extractAmountAndCurrency(rawText);
    const items = extractItems(rawText);

    return {
      merchant,
      date,
      amount,
      currency,
      items,
      rawText,
      confidence: Math.round(confidence),
    };
  } catch (error) {
    console.error('OCR processing error:', error);
    return {
      merchant: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      currency: '$',
      items: [],
      rawText: '',
      confidence: 0,
    };
  } finally {
    if (worker) await worker.terminate();
  }
}

/**
 * Extract merchant name from receipt text
 * Looks at the first meaningful lines, skipping noise
 */
function extractMerchant(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Words/patterns to skip (not merchant names)
  const skipPatterns = [
    /^(ruc|r\.u\.c|nit|cuit|rfc|dni|ci|nro|no\.|num|tel|telf|fono|fax|dir|av\.|calle|jr\.|psje)/i,
    /^(factura|boleta|ticket|recibo|nota|comprobante|vale)/i,
    /^\d{6,}/, // Long numbers (like RUC/NIT)
    /^[\d\s\-\.\/]+$/, // Only numbers/punctuation
    /^[\s\*\-=_]+$/, // Only decorative chars
    /^\w{1,2}$/, // Very short (noise)
    /^(fecha|date|hora|time|cajero|caja|vendedor|mesero)/i,
  ];

  for (const line of lines.slice(0, 8)) {
    // Check if this line looks like a merchant name
    const isSkip = skipPatterns.some((p) => p.test(line));
    if (isSkip) continue;

    // Must have at least some letters
    if (!/[a-záéíóúñ]{2,}/i.test(line)) continue;

    // Clean up
    let merchant = line
      .replace(/^\d+[\s\.\-]*/, '') // Remove leading numbers
      .replace(/[*=\-_]{2,}/g, '') // Remove decorative chars
      .trim();

    if (merchant.length >= 3 && merchant.length <= 60) {
      return merchant;
    }
  }

  // Fallback: first line with letters
  for (const line of lines) {
    if (/[a-záéíóúñ]{3,}/i.test(line)) {
      return line.substring(0, 50).trim();
    }
  }

  return '';
}

/**
 * Extract date from receipt text
 * Supports: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD, and more
 */
function extractDate(text: string): string {
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) {
    const [, day, month, year] = dmy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Spanish month names: "15 de marzo de 2024", "marzo 15, 2024"
  const months: Record<string, string> = {
    enero: '01', febrero: '02', marzo: '03', abril: '04',
    mayo: '05', junio: '06', julio: '07', agosto: '08',
    septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  const spanishDate = text.match(/(\d{1,2})\s*(?:de\s+)?(\w+)\s*(?:de\s+)?(\d{4})/i);
  if (spanishDate) {
    const monthStr = spanishDate[2].toLowerCase();
    const monthNum = months[monthStr];
    if (monthNum) {
      return `${spanishDate[3]}-${monthNum}-${spanishDate[1].padStart(2, '0')}`;
    }
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Currency symbols and patterns for multiple currencies
 */
const CURRENCY_PATTERNS = [
  // Soles peruanos (S/, S/., PEN)
  { regex: /(?:S\/\.?|PEN)\s*([\d.,\s]+)/gi, symbol: 'S/', name: 'PEN' },
  // Dólares (US$, USD, $)
  { regex: /(?:US\$|USD)\s*([\d.,\s]+)/gi, symbol: 'US$', name: 'USD' },
  // Yenes (¥, JPY, ￥)
  { regex: /(?:¥|￥|JPY)\s*([\d.,\s]+)/gi, symbol: '¥', name: 'JPY' },
  // Euros (€, EUR)
  { regex: /(?:€|EUR)\s*([\d.,\s]+)/gi, symbol: '€', name: 'EUR' },
  // Pesos mexicanos (MXN, MX$)
  { regex: /(?:MXN|MX\$)\s*([\d.,\s]+)/gi, symbol: 'MX$', name: 'MXN' },
  // Pesos colombianos (COP, COL$)
  { regex: /(?:COP|COL\$)\s*([\d.,\s]+)/gi, symbol: 'COP', name: 'COP' },
  // Reales (R$, BRL)
  { regex: /(?:R\$|BRL)\s*([\d.,\s]+)/gi, symbol: 'R$', name: 'BRL' },
  // Dólar genérico ($) — last priority
  { regex: /\$\s*([\d.,\s]+)/gi, symbol: '$', name: 'USD' },
];

/**
 * Extract amount and currency from receipt text
 */
function extractAmountAndCurrency(text: string): { amount: number; currency: string } {
  // First try to find "TOTAL" line with amount (most reliable)
  const totalPatterns = [
    /total\s*(?:a\s*pagar)?[:\s]*(?:S\/\.?|PEN)\s*([\d.,\s]+)/i,
    /total\s*(?:a\s*pagar)?[:\s]*(?:US\$|USD)\s*([\d.,\s]+)/i,
    /total\s*(?:a\s*pagar)?[:\s]*(?:¥|￥|JPY)\s*([\d.,\s]+)/i,
    /total\s*(?:a\s*pagar)?[:\s]*(?:€|EUR)\s*([\d.,\s]+)/i,
    /total\s*(?:a\s*pagar)?[:\s]*(?:R\$|BRL)\s*([\d.,\s]+)/i,
    /total\s*(?:a\s*pagar)?[:\s]*\$\s*([\d.,\s]+)/i,
    /total\s*(?:a\s*pagar)?[:\s]*([\d.,\s]+)/i,
  ];

  const totalCurrencyMap = ['S/', 'US$', '¥', '€', 'R$', '$', '$'];

  for (let i = 0; i < totalPatterns.length; i++) {
    const match = text.match(totalPatterns[i]);
    if (match && match[1]) {
      const amount = parseAmountStr(match[1]);
      if (amount > 0) {
        return { amount, currency: totalCurrencyMap[i] };
      }
    }
  }

  // Try to detect currency from anywhere in the text, then find amounts
  for (const cp of CURRENCY_PATTERNS) {
    const regex = new RegExp(cp.regex.source, cp.regex.flags);
    const matches: { amount: number }[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      const amount = parseAmountStr(match[1]);
      if (amount > 0) matches.push({ amount });
    }

    if (matches.length > 0) {
      // Return the largest amount (likely the total)
      const largest = matches.reduce((max, m) => m.amount > max.amount ? m : max);
      return { amount: largest.amount, currency: cp.symbol };
    }
  }

  // Last resort: find any number that looks like a price
  const genericAmount = text.match(/([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2}))/);
  if (genericAmount) {
    const amount = parseAmountStr(genericAmount[1]);
    if (amount > 0) return { amount, currency: '$' };
  }

  return { amount: 0, currency: '$' };
}

/**
 * Parse an amount string handling different decimal/thousands separators
 */
function parseAmountStr(str: string): number {
  let amountStr = str.replace(/\s/g, '').trim();
  if (!amountStr) return 0;

  const lastComma = amountStr.lastIndexOf(',');
  const lastDot = amountStr.lastIndexOf('.');

  if (lastComma > lastDot) {
    // Comma is decimal: 1.234,56 → 1234.56
    amountStr = amountStr.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Dot is decimal: 1,234.56 → 1234.56
    amountStr = amountStr.replace(/,/g, '');
  } else {
    // Only one separator
    if (lastComma !== -1) {
      // Check if comma is decimal (e.g., "123,45") or thousands (e.g., "1,234")
      const afterComma = amountStr.substring(lastComma + 1);
      if (afterComma.length <= 2) {
        amountStr = amountStr.replace(',', '.');
      } else {
        amountStr = amountStr.replace(',', '');
      }
    }
  }

  const amount = parseFloat(amountStr);
  return !isNaN(amount) && amount > 0 ? parseFloat(amount.toFixed(2)) : 0;
}

/**
 * Extract individual items from receipt
 */
function extractItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split('\n');

  const itemPattern = /^(.+?)\s+(?:S\/\.?|US?\$|¥|€|R\$|\$)?\s*[\d,\.]+\s*$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    if (/^(total|subtotal|cantidad|item|producto|descripcion|iva|igv|impuesto|descuento|vuelto|cambio|efectivo|tarjeta|gravad)/i.test(trimmed)) continue;
    if (/^[\s\d\-=\*_]+$/.test(trimmed)) continue;

    const match = trimmed.match(itemPattern);
    if (match) {
      const item = match[1].trim();
      if (item.length > 2 && item.length < 100) {
        items.push(item);
      }
    }
  }

  return items.slice(0, 20);
}

/**
 * Suggest expense category based on merchant name and items
 */
export function suggestCategory(merchant: string, items: string[]): string {
  const text = `${merchant} ${items.join(' ')}`.toLowerCase();

  if (/farmaci|medical|doctor|hospital|salud|medicina|receta|botica|clínica|laboratorio|óptica/i.test(text)) {
    return 'salud';
  }
  if (/uber|taxi|gas|gasolina|transport|bus|metro|colectivo|viaje|vuelo|tren|avion|peaje|estacion|grifo|petrol/i.test(text)) {
    return 'transporte';
  }
  if (/netflix|cine|cinema|movie|spotify|game|juego|disney|hbo|película|streaming|bar|club|pub|discoteca|karaoke/i.test(text)) {
    return 'entretenimiento';
  }
  if (/escuela|colegio|universidad|educación|libro|curso|clase|maestro|profesor|school|academy|librería/i.test(text)) {
    return 'educacion';
  }
  if (/ropa|clothing|tienda|shop|zapatos|shoes|bolsa|pantalon|camisa|dress|fashion|vestuario|zapatería|boutique/i.test(text)) {
    return 'ropa';
  }
  if (/hogar|casa|home|furniture|mueble|decoración|cocina|baño|limpieza|construcción|ferretería|hardware|sodimac|promart/i.test(text)) {
    return 'hogar';
  }
  if (/alimento|comida|restaurante|food|café|coffee|pizza|burger|restaurant|supermercado|market|carnicería|bakery|panadería|grocery|pollo|ceviche|chifa|pollería|bodega|minimarket|wong|metro|tottus|plaza vea/i.test(text)) {
    return 'alimentos';
  }

  return 'otros';
}
