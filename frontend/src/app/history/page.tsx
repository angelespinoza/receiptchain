'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ExpenseCard from '@/components/ExpenseCard';
import BottomNav from '@/components/BottomNav';
import { getReceipts } from '@/lib/storage';
import { getAccount, isMiniPay, hasExternalWallet } from '@/lib/wallet';
import { getEncryptionKey, decryptPayload, type ExpensePayload } from '@/lib/encryption';
import { downloadFromIPFS } from '@/lib/ipfs';
import { getOnChainExpenses, type OnChainExpense } from '@/lib/blockchain';
import { CELO_CHAIN } from '@/lib/constants';
import type { ReceiptRecord } from '@/lib/storage';

type FilterType = 'todos' | 'semana' | 'mes';

interface UnifiedExpense {
  id?: number;
  merchant: string;
  amount: number;
  currency?: string;
  date: string;
  category: string;
  txHash: string;
  dataHash: string;
  imageData?: string;
  dataCID?: string;
  timestamp: number;
  source: 'local' | 'blockchain';
}

export default function HistoryPage() {
  const [expenses, setExpenses] = useState<UnifiedExpense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<UnifiedExpense[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [loading, setLoading] = useState(true);
  const [selectedExpense, setSelectedExpense] = useState<UnifiedExpense | null>(null);
  const [decryptedImage, setDecryptedImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      setLoading(true);

      // Load from IndexedDB
      const localExpenses = await getReceipts();
      const unified: UnifiedExpense[] = localExpenses.map((exp) => ({
        ...exp,
        source: 'local' as const,
      }));

      // Try loading from blockchain
      try {
        const account = await getAccount();
        const onChainExpenses = await getOnChainExpenses(account);

        // For blockchain expenses not in local, try to decrypt them
        for (const bExp of onChainExpenses) {
          const alreadyLocal = unified.some((u) => u.dataHash === bExp.dataHash);
          if (!alreadyLocal && bExp.dataCID) {
            unified.push({
              merchant: '🔒 Encriptado',
              amount: 0,
              date: new Date(bExp.timestamp * 1000).toISOString().split('T')[0],
              category: 'otros',
              txHash: '',
              dataHash: bExp.dataHash,
              dataCID: bExp.dataCID,
              timestamp: bExp.timestamp * 1000,
              source: 'blockchain',
            });
          }
        }
      } catch {
        // No wallet — show local only
      }

      unified.sort((a, b) => b.timestamp - a.timestamp);
      setExpenses(unified);
      applyFilter('todos', unified);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = (filterType: FilterType, allExpenses?: UnifiedExpense[]) => {
    const expensesToFilter = allExpenses || expenses;
    const now = new Date();
    let startDate: Date;

    switch (filterType) {
      case 'semana':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'mes':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate = new Date(1970, 0, 1);
    }

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = now.toISOString().split('T')[0];
    setFilteredExpenses(expensesToFilter.filter((e) => e.date >= startStr && e.date <= endStr));
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    applyFilter(filter);
    setSelectedExpense(null);
    setDecryptedImage(null);
  };

  const signMessage = async (message: string): Promise<string> => {
    const provider = isMiniPay()
      ? (window as any).provider
      : hasExternalWallet()
        ? (window as any).ethereum
        : null;
    if (!provider) throw new Error('No wallet');
    const account = await getAccount();
    return await provider.request({
      method: 'personal_sign',
      params: [
        `0x${Array.from(new TextEncoder().encode(message))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')}`,
        account,
      ],
    });
  };

  const handleExpenseClick = async (expense: UnifiedExpense) => {
    setSelectedExpense(expense);
    setDecryptedImage(null);

    // If local image available
    if (expense.imageData) {
      setDecryptedImage(expense.imageData);
      return;
    }

    // If blockchain expense with CID, decrypt from IPFS
    if (expense.dataCID && expense.source === 'blockchain') {
      setLoadingImage(true);
      try {
        const account = await getAccount();
        const encKey = await getEncryptionKey(signMessage, account);
        const encryptedData = await downloadFromIPFS(expense.dataCID);
        const payload: ExpensePayload = await decryptPayload(encryptedData, encKey);

        // Update the expense with decrypted data
        expense.merchant = payload.merchant;
        expense.amount = payload.amount;
        expense.date = payload.date;
        expense.category = payload.category;
        setDecryptedImage(payload.imageBase64);

        // Force re-render
        setSelectedExpense({ ...expense });
        setExpenses([...expenses]);
      } catch (err) {
        console.warn('Failed to decrypt:', err);
      } finally {
        setLoadingImage(false);
      }
    }
  };

  const explorerBaseUrl = CELO_CHAIN.blockExplorers?.default.url || 'https://celo-sepolia.celoscan.io';

  return (
    <div className="min-h-screen">
      <Header title="Historial" subtitle="Todos tus gastos registrados" />

      <div className="px-5 py-4 overflow-x-auto">
        <div className="flex gap-2">
          {(['todos', 'semana', 'mes'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                activeFilter === filter ? 'bg-[#35D07F] text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {filter === 'todos' ? 'Todos' : filter === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Cargando historial...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No hay gastos en este período</p>
            <Link href="/scan" className="inline-block bg-[#35D07F] text-white px-6 py-2 rounded-lg font-medium text-sm">
              Escanear recibo
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExpenses.map((expense, index) => (
              <div key={expense.id || `bc-${index}`}>
                <ExpenseCard
                  merchant={expense.merchant}
                  amount={expense.amount}
                  currency={expense.currency}
                  date={expense.date}
                  category={expense.category}
                  txHash={expense.txHash}
                  onClick={() => handleExpenseClick(expense)}
                />

                {selectedExpense === expense && (
                  <div className="bg-white rounded-2xl p-4 mb-3 border-2 border-[#35D07F] shadow-lg">
                    <button onClick={() => { setSelectedExpense(null); setDecryptedImage(null); }} className="float-right text-gray-400 hover:text-gray-600 text-lg">✕</button>

                    <div className="space-y-3 mt-2">
                      {loadingImage && (
                        <div className="text-center py-4">
                          <div className="text-2xl animate-spin mb-2">🔓</div>
                          <p className="text-sm text-gray-500">Desencriptando datos...</p>
                        </div>
                      )}

                      {!loadingImage && (
                        <>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Comercio</p>
                            <p className="font-bold text-[#1E3A2F]">{expense.merchant}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Fecha</p>
                            <p className="text-sm text-[#1E3A2F]">{expense.date}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Monto</p>
                            <p className="text-lg font-bold text-[#35D07F]">{expense.currency || '$'}{expense.amount.toFixed(2)}</p>
                          </div>

                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            expense.source === 'blockchain' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {expense.source === 'blockchain' ? '⛓ Recuperado de blockchain' : '📱 Datos locales'}
                          </span>

                          {expense.txHash && (
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Hash de Transacción</p>
                              <a href={`${explorerBaseUrl}/tx/${expense.txHash}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#35D07F] font-mono break-all hover:underline">
                                {expense.txHash}
                              </a>
                            </div>
                          )}

                          {decryptedImage && (
                            <div>
                              <p className="text-xs text-gray-500 mb-2">Imagen del Recibo</p>
                              <img src={decryptedImage} alt="Receipt" className="w-full rounded-lg max-h-48 object-cover" />
                            </div>
                          )}

                          {expense.txHash && (
                            <a href={`${explorerBaseUrl}/tx/${expense.txHash}`} target="_blank" rel="noopener noreferrer" className="block w-full bg-[#1E3A2F] text-white text-center py-2 rounded-lg font-medium text-sm mt-4">
                              Verificar en Blockchain
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav activeTab="history" />
    </div>
  );
}
