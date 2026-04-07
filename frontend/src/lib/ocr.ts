/**
 * ReceiptChain OCR Processing
 * Primary: Google Cloud Vision API (server-side, accurate)
 * Fallback: Tesseract.js (client-side, free)
 *
 * Global receipt parsing: works with receipts from any country/currency.
 * Strategy: extract raw text → smart heuristic parsing
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

// ─── Main Entry Point ───────────────────────────────────────────────

/**
 * Process a receipt image — tries Cloud Vision first, falls back to Tesseract
 */
export async function processReceipt(imageData: string): Promise<ReceiptData> {
  const resizedImage = await resizeImage(imageData, 1400);

  try {
    console.log('[OCR] Trying Google Cloud Vision...');
    const cloudResult = await processWithCloudVision(resizedImage);
    if (cloudResult && cloudResult.rawText.length > 10) {
      console.log('[OCR] ✅ Cloud Vision succeeded:', {
        merchant: cloudResult.merchant,
        amount: cloudResult.amount,
        currency: cloudResult.currency,
        textLength: cloudResult.rawText.length,
      });
      return cloudResult;
    }
    console.warn('[OCR] Cloud Vision returned insufficient text');
  } catch (err) {
    console.warn('[OCR] Cloud Vision failed:', err);
  }

  console.log('[OCR] ⚠️ Falling back to Tesseract.js...');
  return processWithTesseract(resizedImage);
}

// ─── Cloud Vision ───────────────────────────────────────────────────

async function processWithCloudVision(imageData: string): Promise<ReceiptData | null> {
  const response = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: imageData }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[OCR] API response not OK:', response.status, errText);
    return null;
  }

  const data = await response.json();
  if (!data.success || !data.text) {
    console.error('[OCR] API returned:', data);
    return null;
  }

  return parseReceiptText(data.text.trim(), data.confidence || 85);
}

// ─── Tesseract Fallback ─────────────────────────────────────────────

async function processWithTesseract(imageData: string): Promise<ReceiptData> {
  let worker: Worker | null = null;
  try {
    worker = await createWorker('spa+eng');
    const imageUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
    const { data: { text, confidence } } = await worker.recognize(imageUrl);
    return parseReceiptText(text.trim(), Math.round(confidence));
  } catch (error) {
    console.error('Tesseract OCR error:', error);
    return emptyResult();
  } finally {
    if (worker) await worker.terminate();
  }
}

// ─── Unified Parser ─────────────────────────────────────────────────

function parseReceiptText(rawText: string, confidence: number): ReceiptData {
  const merchant = extractMerchant(rawText);
  const date = extractDate(rawText);
  const { amount, currency } = extractAmountAndCurrency(rawText);
  const items = extractItems(rawText);

  return { merchant, date, amount, currency, items, rawText, confidence };
}

function emptyResult(): ReceiptData {
  return {
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    currency: '$',
    items: [],
    rawText: '',
    confidence: 0,
  };
}

// ─── Merchant Extraction ────────────────────────────────────────────

/**
 * Smart merchant extraction:
 * 1. Look for business name indicators (S.A.C., LLC, RESTAURANTE, etc.)
 * 2. Fall back to first meaningful line in the receipt header
 */
function extractMerchant(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Patterns that indicate a business name line
  const businessIndicators = /(?:s\.?a\.?c\.?|s\.?a\.?|e\.?i\.?r\.?l\.?|s\.?r\.?l\.?|llc|inc|corp|ltd|ltda|cia|gmbh|co\.?\s*$)/i;
  const businessPrefixes = /^(?:restaurante|restaurant|hotel|farmacia|botica|bodega|minimarket|supermercado|tienda|café|cafetería|mercado|panadería|pollería|chifa|cevichería|grifo|estación)/i;

  // First pass: look for lines with business indicators
  for (const line of lines.slice(0, 12)) {
    if (businessIndicators.test(line) || businessPrefixes.test(line)) {
      const cleaned = cleanMerchantName(line);
      if (cleaned.length >= 3) return cleaned;
    }
  }

  // Second pass: first meaningful line that's not noise
  const noisePatterns = [
    /^(ruc|r\.?u\.?c\.?|nit|cuit|rfc|dni|ci)[:\s]/i,
    /^(nro|no\.|num|n°|n º)/i,
    /^(tel[eéf]|fono|fax|cel|whatsapp)/i,
    /^(dir|av\.|avenida|calle|jr\.|jirón|psje|pasaje|carretera|km)/i,
    /^(factura|boleta|ticket|recibo|nota|comprobante|vale|invoice|receipt)/i,
    /^(fecha|date|hora|time|cajero|caja|vendedor|mesero|turno)/i,
    /^(cant\.?|cantidad|descripcion|precio|total|subtotal)/i,
    /^(forma\s+de\s+pago|metodo|payment|efectivo|tarjeta|visa|cash)/i,
    /^(op\.?\s*gravada|i\.?g\.?v|i\.?v\.?a|impuesto|tax|igv)/i,
    /^(son\s*:|son\s+\w)/i,
    /^(cliente|customer|dni|documento)/i,
    /^(representaci[oó]n|autorizado|esta\s+puede)/i,
    /^\d{6,}/, // Long numbers (RUC, NIT, etc.)
    /^[\d\s\-\.\/,:]+$/, // Only numbers/punctuation
    /^[\s\*\-=_#]{2,}$/, // Decorative lines
    /^\w{1,2}$/, // Very short noise
    /^https?:\/\//i, // URLs
    /^www\./i,
    /^\S+@\S+\.\S+$/, // Emails
    /^(central|website|correo|email|e-?mail)/i,
  ];

  for (const line of lines.slice(0, 10)) {
    if (noisePatterns.some((p) => p.test(line))) continue;
    if (!/[a-záéíóúñàèìòùäëïöüâêîôû]{2,}/i.test(line)) continue;

    const cleaned = cleanMerchantName(line);
    if (cleaned.length >= 3 && cleaned.length <= 60) {
      return cleaned;
    }
  }

  // Last resort: any line with letters
  for (const line of lines) {
    if (/[a-záéíóúñ]{3,}/i.test(line)) {
      return cleanMerchantName(line).substring(0, 50);
    }
  }

  return '';
}

function cleanMerchantName(name: string): string {
  return name
    .replace(/^[\d\s\.\-\*#]+/, '') // Leading numbers/symbols
    .replace(/[*=\-_#]{2,}/g, '')   // Decorative chars
    .replace(/["'""'']/g, '')       // Quotes
    .replace(/\s{2,}/g, ' ')        // Multiple spaces
    .trim();
}

// ─── Date Extraction ────────────────────────────────────────────────

/**
 * Smart date extraction:
 * 1. Look for labeled dates (Fecha, Fecha Emisión, Date, etc.)
 * 2. Fall back to first date-like pattern found
 */
function extractDate(text: string): string {
  // Labeled dates take priority (Peruvian, Latin American, generic)
  const labeledPatterns = [
    // "Fecha Emisión: 2026-02-26" or "Fecha: 2026-02-26"
    /fecha\s*(?:de\s*)?(?:emisi[oó]n|venta|compra)?[:\s]+(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/i,
    // "Fecha Emisión: 09/01/2026" or "Fecha: 09/01/2026"
    /fecha\s*(?:de\s*)?(?:emisi[oó]n|venta|compra)?[:\s]+(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i,
    // "Date: 2026-01-09"
    /date[:\s]+(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/i,
    // "Date: 01/09/2026"
    /date[:\s]+(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i,
  ];

  for (const pattern of labeledPatterns) {
    const match = text.match(pattern);
    if (match) {
      const parts = match.slice(1).map(Number);
      // Determine if YYYY-MM-DD or DD/MM/YYYY based on first number
      if (parts[0] > 1000) {
        // YYYY-MM-DD
        return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
      } else {
        // DD/MM/YYYY
        return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
      }
    }
  }

  // Unlabeled: YYYY-MM-DD (ISO)
  const ymd = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // Unlabeled: DD/MM/YYYY
  const dmy = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  // Spanish/English month names: "15 de marzo de 2024", "March 15, 2024"
  const monthNames: Record<string, string> = {
    enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
    julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    ene: '01',
  };

  // "15 de marzo de 2024" or "15 marzo 2024"
  const textDate1 = text.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóúñ]+)\s*(?:de\s+)?(\d{4})/i);
  if (textDate1) {
    const m = monthNames[textDate1[2].toLowerCase()];
    if (m) return `${textDate1[3]}-${m}-${textDate1[1].padStart(2, '0')}`;
  }

  // "March 15, 2024"
  const textDate2 = text.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (textDate2) {
    const m = monthNames[textDate2[1].toLowerCase()];
    if (m) return `${textDate2[3]}-${m}-${textDate2[2].padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

// ─── Amount & Currency Extraction ───────────────────────────────────

/**
 * Known currency definitions
 */
const CURRENCIES = [
  { symbols: ['S/', 'S/.', 'PEN'], display: 'S/', name: 'PEN' },
  { symbols: ['US$', 'USD'], display: 'US$', name: 'USD' },
  { symbols: ['¥', '￥', 'JPY'], display: '¥', name: 'JPY' },
  { symbols: ['€', 'EUR'], display: '€', name: 'EUR' },
  { symbols: ['MX$', 'MXN'], display: 'MX$', name: 'MXN' },
  { symbols: ['COP', 'COL$'], display: 'COP', name: 'COP' },
  { symbols: ['R$', 'BRL'], display: 'R$', name: 'BRL' },
  { symbols: ['£', 'GBP'], display: '£', name: 'GBP' },
  { symbols: ['₩', 'KRW'], display: '₩', name: 'KRW' },
  { symbols: ['₹', 'INR'], display: '₹', name: 'INR' },
  { symbols: ['$'], display: '$', name: 'USD' }, // Generic $ last
];

/**
 * Smart amount + currency extraction:
 * 1. Find TOTAL/total labeled lines and extract amount + currency
 * 2. Detect the dominant currency in the receipt
 * 3. Find the largest amount associated with that currency
 */
function extractAmountAndCurrency(text: string): { amount: number; currency: string } {
  // ─── Step 1: Look for explicit TOTAL lines ───
  const totalResult = findTotalLine(text);
  if (totalResult && totalResult.amount > 0) {
    return totalResult;
  }

  // ─── Step 2: Detect dominant currency and find largest amount ───
  const currencyResult = findLargestAmountByCurrency(text);
  if (currencyResult && currencyResult.amount > 0) {
    return currencyResult;
  }

  // ─── Step 3: Last resort — find any number that looks like a price ───
  const amounts = findAllAmounts(text);
  if (amounts.length > 0) {
    const largest = amounts.reduce((max, a) => (a > max ? a : max), 0);
    return { amount: largest, currency: '$' };
  }

  return { amount: 0, currency: '$' };
}

/**
 * Find a TOTAL-labeled line and extract amount + currency
 */
function findTotalLine(text: string): { amount: number; currency: string } | null {
  const lines = text.split('\n');

  // Total keywords in multiple languages
  const totalKeywords = /\b(total|total\s*a\s*pagar|grand\s*total|amount\s*due|monto\s*total|合計|합계)\b/i;

  for (const line of lines) {
    if (!totalKeywords.test(line)) continue;

    // Skip subtotal, total items count, etc.
    if (/\b(sub\s*total|total\s*(?:items?|productos?|cantidad|cant))\b/i.test(line)) continue;

    // Try to extract currency + amount from this line
    const result = extractCurrencyAndAmount(line);
    if (result && result.amount > 0) return result;

    // Try just extracting a number from the line
    const nums = findAllAmounts(line);
    if (nums.length > 0) {
      const currency = detectCurrencyInText(line) || detectCurrencyInText(text) || '$';
      return { amount: nums[nums.length - 1], currency }; // Last number on TOTAL line
    }
  }

  return null;
}

/**
 * Extract a currency symbol + amount from a string
 * Handles: "S/ : 155.00", "$ 42.50", "155.00 €", "¥1,200"
 */
function extractCurrencyAndAmount(text: string): { amount: number; currency: string } | null {
  for (const curr of CURRENCIES) {
    for (const sym of curr.symbols) {
      // Escape special regex chars in symbol
      const escaped = sym.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');

      // Currency BEFORE amount: "S/ : 155.00", "$ 42.50"
      const beforeRegex = new RegExp(escaped + '[:\\s]*(\\d[\\d.,]*\\d|\\d+)', 'i');
      const beforeMatch = text.match(beforeRegex);
      if (beforeMatch) {
        const amount = parseAmountStr(beforeMatch[1]);
        if (amount > 0) return { amount, currency: curr.display };
      }

      // Currency AFTER amount: "155.00 €", "1200 JPY"
      const afterRegex = new RegExp('(\\d[\\d.,]*\\d|\\d+)\\s*' + escaped, 'i');
      const afterMatch = text.match(afterRegex);
      if (afterMatch) {
        const amount = parseAmountStr(afterMatch[1]);
        if (amount > 0) return { amount, currency: curr.display };
      }
    }
  }
  return null;
}

/**
 * Detect which currency symbol appears in a text
 */
function detectCurrencyInText(text: string): string | null {
  for (const curr of CURRENCIES) {
    for (const sym of curr.symbols) {
      if (sym === '$') continue; // Skip generic $ to avoid false positives
      if (text.includes(sym)) return curr.display;
    }
  }
  if (text.includes('$')) return '$';
  return null;
}

/**
 * Find the largest amount for the most common currency in the text
 */
function findLargestAmountByCurrency(text: string): { amount: number; currency: string } | null {
  let bestResult: { amount: number; currency: string } | null = null;

  for (const curr of CURRENCIES) {
    for (const sym of curr.symbols) {
      const escaped = sym.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');

      // Find all amounts with this currency
      const regex = new RegExp(escaped + '[:\\s]*(\\d[\\d.,]*\\d|\\d+)', 'gi');
      let match;
      let maxAmount = 0;

      while ((match = regex.exec(text)) !== null) {
        const amount = parseAmountStr(match[1]);
        if (amount > maxAmount) maxAmount = amount;
      }

      // Also check currency after amount
      const regexAfter = new RegExp('(\\d[\\d.,]*\\d|\\d+)\\s*' + escaped, 'gi');
      while ((match = regexAfter.exec(text)) !== null) {
        const amount = parseAmountStr(match[1]);
        if (amount > maxAmount) maxAmount = amount;
      }

      if (maxAmount > 0) {
        if (!bestResult || (sym !== '$' && bestResult.currency === '$')) {
          // Prefer specific currency over generic $
          bestResult = { amount: maxAmount, currency: curr.display };
        } else if (maxAmount > bestResult.amount && curr.display === bestResult.currency) {
          bestResult = { amount: maxAmount, currency: curr.display };
        }
      }
    }
  }

  return bestResult;
}

/**
 * Find all numbers in text that look like prices
 */
function findAllAmounts(text: string): number[] {
  const amounts: number[] = [];
  // Match numbers like: 155.00, 1,234.56, 1.234,56, 1200
  const regex = /\d[\d.,]*\d|\d+\.\d{1,2}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const amount = parseAmountStr(match[0]);
    if (amount > 0 && amount < 1000000) amounts.push(amount);
  }
  return amounts;
}

/**
 * Parse amount string handling international decimal/thousands separators
 * "155.00" → 155, "1.234,56" → 1234.56, "1,234.56" → 1234.56
 */
function parseAmountStr(str: string): number {
  let s = str.replace(/\s/g, '').trim();
  if (!s) return 0;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > lastDot) {
    // European: 1.234,56 → comma is decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // US/International: 1,234.56 → dot is decimal
    s = s.replace(/,/g, '');
  } else if (lastComma !== -1 && lastDot === -1) {
    // Only commas: "1,234" (thousands) or "123,45" (decimal)
    const afterComma = s.substring(lastComma + 1);
    if (afterComma.length <= 2) {
      s = s.replace(',', '.'); // Decimal
    } else {
      s = s.replace(/,/g, ''); // Thousands
    }
  }

  const amount = parseFloat(s);
  return !isNaN(amount) && amount > 0 ? parseFloat(amount.toFixed(2)) : 0;
}

// ─── Items Extraction ───────────────────────────────────────────────

function extractItems(text: string): string[] {
  const items: string[] = [];
  const lines = text.split('\n');

  const skipKeywords = /^(total|subtotal|sub-total|cantidad|item|producto|descripcion|iva|igv|i\.g\.v|impuesto|tax|descuento|discount|vuelto|cambio|efectivo|tarjeta|visa|cash|gravad|exoner|son\s*:|cliente|customer|forma|payment|representaci|administrad|fecha|date|hora|ruc|nit|boleta|factura|ticket|nro|cant\.|precio|vendedor)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 4) continue;
    if (skipKeywords.test(trimmed)) continue;
    if (/^[\s\d\-=\*_#.\/]+$/.test(trimmed)) continue;

    // Lines with a description followed by a price
    const itemMatch = trimmed.match(/^(.+?)\s{2,}(?:[\d.,]+\s+)?[\d.,]+\s*$/);
    if (itemMatch) {
      const item = itemMatch[1].replace(/^\d+\s+/, '').trim(); // Remove leading quantity
      if (item.length > 2 && item.length < 100 && /[a-záéíóúñ]{2,}/i.test(item)) {
        items.push(item);
      }
    }
  }

  return items.slice(0, 20);
}

// ─── Category Suggestion ────────────────────────────────────────────

/**
 * Suggest expense category based on merchant name and items
 * Works internationally with keywords in Spanish, English, and common brand names
 */
export function suggestCategory(merchant: string, items: string[]): string {
  const text = `${merchant} ${items.join(' ')}`.toLowerCase();

  const categories: { id: string; patterns: RegExp }[] = [
    {
      id: 'salud',
      patterns: /farmaci|pharmacy|medical|doctor|hospital|salud|health|medicina|receta|botica|clínica|clinic|laboratorio|lab|óptica|optic|dental|dentist/i,
    },
    {
      id: 'transporte',
      patterns: /uber|lyft|didi|taxi|cab|gas\b|gasolina|fuel|transport|bus\b|metro\b|subway|colectivo|viaje|travel|vuelo|flight|tren|train|avion|plane|peaje|toll|estacion|station|grifo|petrol|shalom|cruz del sur|oltursa|tepsa|movil tours|civa|flores|latam|avianca|parking|estacionamiento/i,
    },
    {
      id: 'entretenimiento',
      patterns: /netflix|cine|cinema|movie|spotify|apple music|game|juego|disney|hbo|max|película|film|streaming|bar\b|club\b|pub\b|discoteca|karaoke|teatro|theater|concert|concierto|museo|museum|parque|park|zoo/i,
    },
    {
      id: 'educacion',
      patterns: /escuela|school|colegio|universidad|university|college|educación|education|libro|book|curso|course|clase|class|maestro|profesor|teacher|academy|academia|librería|bookstore|udemy|coursera/i,
    },
    {
      id: 'ropa',
      patterns: /ropa|clothing|tienda\s+de\s+ropa|shop|zapatos|shoes|bolsa|bag|pantalon|pants|camisa|shirt|dress|vestido|fashion|moda|vestuario|zapatería|boutique|zara|h&m|nike|adidas|uniqlo/i,
    },
    {
      id: 'hogar',
      patterns: /hogar|home|casa|house|furniture|mueble|decoración|decor|cocina|kitchen|baño|bath|limpieza|cleaning|construcción|construction|ferretería|hardware|sodimac|promart|home\s*depot|ikea|lowes/i,
    },
    {
      id: 'alimentos',
      patterns: /alimento|comida|food|restaurante|restaurant|café|coffee|starbucks|pizza|burger|hamburgues|sushi|bakery|panadería|grocery|supermercado|supermarket|market|mercado|carnicería|meat|pollo|chicken|ceviche|chifa|pollería|bodega|minimarket|wong|tottus|plaza\s*vea|metro\b|walmart|costco|trader|whole\s*foods|lomo|arroz|rice|menu|menú|almuerzo|lunch|cena|dinner|desayuno|breakfast/i,
    },
  ];

  for (const cat of categories) {
    if (cat.patterns.test(text)) return cat.id;
  }

  return 'otros';
}

// ─── Image Utilities ────────────────────────────────────────────────

/**
 * Resize image to reduce payload size for API calls
 */
function resizeImage(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.width <= maxWidth) {
        resolve(dataUrl);
        return;
      }
      const scale = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
