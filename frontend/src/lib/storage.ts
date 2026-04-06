/**
 * ReceiptChain Local Storage
 * IndexedDB storage for receipts and expense tracking
 */

import { openDB, type IDBPDatabase } from 'idb';

/**
 * Receipt record stored in IndexedDB
 */
export interface ReceiptRecord {
  id?: number;
  imageData: string; // Base64 encoded image
  merchant: string;
  date: string; // ISO format YYYY-MM-DD
  amount: number;
  currency?: string; // Currency symbol (S/, $, ¥, €, etc.)
  category: string;
  txHash: string; // Blockchain transaction hash
  dataHash: string; // Expense data hash
  timestamp: number; // Unix timestamp for sorting
}

const DB_NAME = 'receiptchain-db';
const DB_VERSION = 1;
const STORE_NAME = 'receipts';

let dbInstance: IDBPDatabase<unknown> | null = null;

/**
 * Initialize the database connection
 * Creates object store if it doesn't exist
 */
export async function initDB(): Promise<IDBPDatabase<unknown>> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });

          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('txHash', 'txHash', { unique: true });
        }
      },
    });

    return dbInstance;
  } catch (error) {
    throw new Error(
      `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Save a receipt to IndexedDB
 */
export async function saveReceipt(record: ReceiptRecord): Promise<number> {
  try {
    const db = await initDB();

    // Ensure timestamp is set
    if (!record.timestamp) {
      record.timestamp = Date.now();
    }

    const id = await db.add(STORE_NAME, record);
    return id as number;
  } catch (error) {
    throw new Error(
      `Failed to save receipt: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Update an existing receipt
 */
export async function updateReceipt(record: ReceiptRecord): Promise<void> {
  try {
    if (!record.id) {
      throw new Error('Receipt ID is required for update');
    }

    const db = await initDB();
    await db.put(STORE_NAME, record);
  } catch (error) {
    throw new Error(
      `Failed to update receipt: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get all receipts ordered by timestamp (newest first)
 */
export async function getReceipts(): Promise<ReceiptRecord[]> {
  try {
    const db = await initDB();
    const allRecords = await db.getAllFromIndex(STORE_NAME, 'timestamp');

    // Sort by timestamp descending (newest first)
    return allRecords.reverse() as ReceiptRecord[];
  } catch (error) {
    throw new Error(
      `Failed to get receipts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get a single receipt by ID
 */
export async function getReceiptById(id: number): Promise<ReceiptRecord | undefined> {
  try {
    const db = await initDB();
    const record = await db.get(STORE_NAME, id);
    return record as ReceiptRecord | undefined;
  } catch (error) {
    throw new Error(
      `Failed to get receipt: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get receipts by category
 */
export async function getReceiptsByCategory(category: string): Promise<ReceiptRecord[]> {
  try {
    const db = await initDB();
    const records = await db.getAllFromIndex(STORE_NAME, 'category', category);

    // Sort by timestamp descending
    return (records as ReceiptRecord[]).sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    throw new Error(
      `Failed to get receipts by category: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get receipts for a specific month
 */
export async function getMonthlyExpenses(
  year: number,
  month: number
): Promise<ReceiptRecord[]> {
  try {
    const db = await initDB();
    const allRecords = await db.getAll(STORE_NAME);

    // Filter for the specified month
    const receipts = (allRecords as ReceiptRecord[]).filter((record) => {
      const [recordYear, recordMonth] = record.date.split('-').map(Number);
      return recordYear === year && recordMonth === month;
    });

    // Sort by timestamp descending
    return receipts.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    throw new Error(
      `Failed to get monthly expenses: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get receipts for a date range
 */
export async function getReceiptsByDateRange(
  startDate: string,
  endDate: string
): Promise<ReceiptRecord[]> {
  try {
    const db = await initDB();
    const allRecords = await db.getAll(STORE_NAME);

    // Filter for the date range
    const receipts = (allRecords as ReceiptRecord[]).filter((record) => {
      return record.date >= startDate && record.date <= endDate;
    });

    // Sort by timestamp descending
    return receipts.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    throw new Error(
      `Failed to get receipts by date range: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete a receipt by ID
 */
export async function deleteReceipt(id: number): Promise<void> {
  try {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
  } catch (error) {
    throw new Error(
      `Failed to delete receipt: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete all receipts (use with caution)
 */
export async function deleteAllReceipts(): Promise<void> {
  try {
    const db = await initDB();
    await db.clear(STORE_NAME);
  } catch (error) {
    throw new Error(
      `Failed to delete all receipts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get receipt by transaction hash
 */
export async function getReceiptByTxHash(txHash: string): Promise<ReceiptRecord | undefined> {
  try {
    const db = await initDB();
    const record = await db.getFromIndex(STORE_NAME, 'txHash', txHash);
    return record as ReceiptRecord | undefined;
  } catch (error) {
    throw new Error(
      `Failed to get receipt by tx hash: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get monthly summary of expenses
 */
export async function getMonthlyExpenseSummary(
  year: number,
  month: number
): Promise<{
  totalAmount: number;
  receiptCount: number;
  byCategory: Record<string, { count: number; total: number }>;
}> {
  try {
    const receipts = await getMonthlyExpenses(year, month);

    const summary = {
      totalAmount: 0,
      receiptCount: receipts.length,
      byCategory: {} as Record<string, { count: number; total: number }>,
    };

    for (const receipt of receipts) {
      summary.totalAmount += receipt.amount;

      if (!summary.byCategory[receipt.category]) {
        summary.byCategory[receipt.category] = { count: 0, total: 0 };
      }

      summary.byCategory[receipt.category].count += 1;
      summary.byCategory[receipt.category].total += receipt.amount;
    }

    return summary;
  } catch (error) {
    throw new Error(
      `Failed to get expense summary: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Export all receipts as JSON
 */
export async function exportReceiptsAsJSON(): Promise<string> {
  try {
    const receipts = await getReceipts();
    return JSON.stringify(receipts, null, 2);
  } catch (error) {
    throw new Error(
      `Failed to export receipts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalReceipts: number;
  totalExpenses: number;
  oldestReceipt: string | null;
  newestReceipt: string | null;
}> {
  try {
    const receipts = await getReceipts();

    return {
      totalReceipts: receipts.length,
      totalExpenses: receipts.reduce((sum, r) => sum + r.amount, 0),
      oldestReceipt: receipts.length > 0 ? receipts[receipts.length - 1].date : null,
      newestReceipt: receipts.length > 0 ? receipts[0].date : null,
    };
  } catch (error) {
    throw new Error(
      `Failed to get database stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
