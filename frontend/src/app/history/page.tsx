'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ExpenseCard from '@/components/ExpenseCard';
import BottomNav from '@/components/BottomNav';
import { getReceipts, getReceiptsByDateRange } from '@/lib/storage';
import type { ReceiptRecord } from '@/lib/storage';

type FilterType = 'todos' | 'semana' | 'mes';

export default function HistoryPage() {
  const [expenses, setExpenses] = useState<ReceiptRecord[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<ReceiptRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('todos');
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ReceiptRecord | null>(null);

  useEffect(() => {
    async function loadExpenses() {
      try {
        setLoading(true);
        const allExpenses = await getReceipts();
        setExpenses(allExpenses);
        applyFilter('todos', allExpenses);
      } catch (err) {
        console.error('Error loading expenses:', err);
      } finally {
        setLoading(false);
      }
    }

    loadExpenses();
  }, []);

  const applyFilter = (filterType: FilterType, allExpenses?: ReceiptRecord[]) => {
    const expensesToFilter = allExpenses || expenses;
    const now = new Date();
    let startDate: Date;

    switch (filterType) {
      case 'semana': {
        // Get date 7 days ago
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      }
      case 'mes': {
        // Get date 30 days ago
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      }
      case 'todos':
      default: {
        startDate = new Date(1970, 0, 1); // Very old date to include all
      }
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = now.toISOString().split('T')[0];

    const filtered = expensesToFilter.filter((exp) => {
      return exp.date >= startDateStr && exp.date <= endDateStr;
    });

    setFilteredExpenses(filtered);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    applyFilter(filter);
    setExpandedId(null);
    setSelectedExpense(null);
  };

  const handleExpenseClick = (expense: ReceiptRecord) => {
    setSelectedExpense(expense);
    setExpandedId(expense.id ?? null);
  };

  const handleCloseDetail = () => {
    setSelectedExpense(null);
    setExpandedId(null);
  };

  return (
    <div className="min-h-screen">
      <Header title="Historial" subtitle="Todos tus gastos registrados" />

      {/* Filter Pills */}
      <div className="px-5 py-4 overflow-x-auto">
        <div className="flex gap-2">
          {(['todos', 'semana', 'mes'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => handleFilterChange(filter)}
              className={`px-4 py-2 rounded-full font-medium text-sm whitespace-nowrap transition-all ${
                activeFilter === filter
                  ? 'bg-[#35D07F] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter === 'todos' && 'Todos'}
              {filter === 'semana' && 'Semana'}
              {filter === 'mes' && 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses List */}
      <div className="px-5 py-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Cargando historial...</p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No hay gastos en este período</p>
            <Link
              href="/scan"
              className="inline-block bg-[#35D07F] text-white px-6 py-2 rounded-lg font-medium text-sm"
            >
              Escanear recibo
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredExpenses.map((expense) => (
              <div key={expense.id}>
                <ExpenseCard
                  merchant={expense.merchant}
                  amount={expense.amount}
                  date={expense.date}
                  category={expense.category}
                  txHash={expense.txHash}
                  onClick={() => handleExpenseClick(expense)}
                />

                {/* Detail Modal/Expandable */}
                {expandedId === expense.id && selectedExpense && (
                  <div className="bg-white rounded-2xl p-4 mb-3 border-2 border-[#35D07F] shadow-lg">
                    {/* Close button */}
                    <button
                      onClick={handleCloseDetail}
                      className="float-right text-gray-400 hover:text-gray-600 text-lg"
                    >
                      ✕
                    </button>

                    {/* Detail Content */}
                    <div className="space-y-3 mt-2">
                      {/* Merchant */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Comercio</p>
                        <p className="font-bold text-[#1E3A2F]">{selectedExpense.merchant}</p>
                      </div>

                      {/* Date */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Fecha</p>
                        <p className="text-sm text-[#1E3A2F]">{selectedExpense.date}</p>
                      </div>

                      {/* Amount */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Monto</p>
                        <p className="text-lg font-bold text-[#35D07F]">
                          ${selectedExpense.amount.toFixed(2)}
                        </p>
                      </div>

                      {/* Transaction Hash */}
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Hash de Transacción</p>
                        <a
                          href={`https://alfajores.celoscan.io/tx/${selectedExpense.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#35D07F] font-mono break-all hover:underline"
                        >
                          {selectedExpense.txHash}
                        </a>
                      </div>

                      {/* Receipt Image */}
                      {selectedExpense.imageData && (
                        <div>
                          <p className="text-xs text-gray-500 mb-2">Imagen del Recibo</p>
                          <img
                            src={selectedExpense.imageData}
                            alt="Receipt"
                            className="w-full rounded-lg max-h-48 object-cover"
                          />
                        </div>
                      )}

                      {/* Verify Button */}
                      <a
                        href={`https://alfajores.celoscan.io/tx/${selectedExpense.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full bg-[#1E3A2F] text-white text-center py-2 rounded-lg font-medium text-sm mt-4 hover:bg-[#263d3a] transition-colors"
                      >
                        Verificar en Blockchain ⛓
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav activeTab="history" />
    </div>
  );
}
