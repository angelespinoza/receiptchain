/**
 * ReceiptChain Export — Excel export for expense history
 */

import * as XLSX from 'xlsx';
import type { ReceiptRecord } from './storage';
import { CATEGORIES } from './constants';

/**
 * Category label mapping for readable export
 */
const categoryLabels: Record<string, string> = {};
for (const cat of CATEGORIES) {
  categoryLabels[cat.id] = cat.name;
}

/**
 * Export receipts to an Excel (.xlsx) file and trigger download
 */
export function exportToExcel(receipts: ReceiptRecord[], filename?: string): void {
  const rows = receipts.map((r) => ({
    Fecha: r.date,
    Comercio: r.merchant,
    Monto: r.amount,
    Moneda: r.currency || '$',
    Categoría: categoryLabels[r.category] || r.category,
    'Hash Transacción': r.txHash || '',
    'Registrado': new Date(r.timestamp).toLocaleString('es-PE'),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 },  // Fecha
    { wch: 25 },  // Comercio
    { wch: 12 },  // Monto
    { wch: 8 },   // Moneda
    { wch: 16 },  // Categoría
    { wch: 68 },  // Hash
    { wch: 20 },  // Registrado
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos');

  // Add summary sheet
  const summaryByCategory: Record<string, { count: number; total: number }> = {};
  let grandTotal = 0;

  for (const r of receipts) {
    const label = categoryLabels[r.category] || r.category;
    if (!summaryByCategory[label]) {
      summaryByCategory[label] = { count: 0, total: 0 };
    }
    summaryByCategory[label].count += 1;
    summaryByCategory[label].total += r.amount;
    grandTotal += r.amount;
  }

  const summaryRows = Object.entries(summaryByCategory).map(([cat, data]) => ({
    Categoría: cat,
    'Cantidad': data.count,
    'Total': data.total,
  }));

  summaryRows.push({
    Categoría: 'TOTAL',
    'Cantidad': receipts.length,
    'Total': grandTotal,
  });

  const summaryWs = XLSX.utils.json_to_sheet(summaryRows);
  summaryWs['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

  // Generate and download
  const defaultName = `receiptchain-gastos-${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename || defaultName);
}
