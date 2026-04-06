'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import ExpenseCard from '@/components/ExpenseCard';
import ConnectWallet from '@/components/ConnectWallet';
import { getAccount, isMiniPay } from '@/lib/wallet';
import { getReceipts, getMonthlyExpenseSummary } from '@/lib/storage';
import { CATEGORIES } from '@/lib/constants';
import type { ReceiptRecord } from '@/lib/storage';

export default function Dashboard() {
  const [account, setAccount] = useState<string>('');
  const [expenses, setExpenses] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function initializeDashboard() {
      try {
        setLoading(true);

        // Try to connect wallet
        try {
          const connectedAccount = await getAccount();
          setAccount(connectedAccount);
        } catch (err) {
          console.log('Wallet not connected - continue without connection');
        }

        // Load expenses from IndexedDB
        const allExpenses = await getReceipts();
        setExpenses(allExpenses);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error loading data';
        setError(errorMsg);
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }

    initializeDashboard();
  }, []);

  // Calculate monthly summary
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const monthlyExpenses = expenses.filter((exp) => {
    const [expYear, expMonth] = exp.date.split('-').map(Number);
    return expYear === currentYear && expMonth === currentMonth;
  });

  const totalAmount = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Group expenses by category
  const categoryBreakdown: Record<string, { total: number; icon: string; name: string }> = {};
  monthlyExpenses.forEach((exp) => {
    const category = CATEGORIES.find((cat) => cat.id === exp.category);
    if (category) {
      if (!categoryBreakdown[exp.category]) {
        categoryBreakdown[exp.category] = { total: 0, icon: category.icon, name: category.name };
      }
      categoryBreakdown[exp.category].total += exp.amount;
    }
  });

  const recentExpenses = expenses.slice(0, 3);
  const maxCategoryAmount = Math.max(...Object.values(categoryBreakdown).map((c) => c.total), 1);

  return (
    <div className="min-h-screen">
      {/* Header Section */}
      <div className="bg-[#1E3A2F] text-white rounded-b-3xl px-5 py-6 pb-8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm">Hola, Angel 👋</p>
          <ConnectWallet onConnected={(addr) => setAccount(addr)} />
        </div>
        <h1 className="text-3xl font-bold mb-6">ReceiptChain</h1>

        {/* Monthly Total Card */}
        <div className="bg-gradient-to-br from-[#35D07F] to-[#2DB86E] rounded-2xl p-4 shadow-md">
          <p className="text-white text-opacity-90 text-xs mb-1">Gasto del mes</p>
          <p className="text-2xl font-bold text-white mb-2">${totalAmount.toFixed(2)}</p>
          <p className="text-xs text-white text-opacity-80">
            {monthlyExpenses.length} gastos en blockchain
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-5 py-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Cargando datos...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* Category Breakdown */}
            {Object.keys(categoryBreakdown).length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-bold text-[#1E3A2F] mb-4">Gastos por Categoría</h2>
                <div className="space-y-3">
                  {Object.entries(categoryBreakdown).map(([categoryId, data]) => {
                    const percentage =
                      maxCategoryAmount > 0 ? (data.total / maxCategoryAmount) * 100 : 0;
                    const category = CATEGORIES.find((cat) => cat.id === categoryId);
                    const categoryColor = category?.color || '#95A5A6';

                    return (
                      <div key={categoryId}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{data.icon}</span>
                            <span className="text-sm font-medium text-[#1E3A2F]">{data.name}</span>
                          </div>
                          <span className="text-sm font-bold text-[#1E3A2F]">
                            ${data.total.toFixed(2)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: categoryColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Expenses */}
            {recentExpenses.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-[#1E3A2F] mb-4">Recientes</h2>
                <div className="space-y-2">
                  {recentExpenses.map((expense) => (
                    <ExpenseCard
                      key={expense.id}
                      merchant={expense.merchant}
                      amount={expense.amount}
                      date={expense.date}
                      category={expense.category}
                      txHash={expense.txHash}
                    />
                  ))}
                </div>
              </div>
            )}

            {expenses.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No hay gastos registrados</p>
                <Link
                  href="/scan"
                  className="inline-block bg-[#35D07F] text-white px-6 py-2 rounded-lg font-medium text-sm"
                >
                  Escanear primer recibo
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="dashboard" />
    </div>
  );
}
