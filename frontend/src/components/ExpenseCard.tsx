'use client';

import { CATEGORIES } from '@/lib/constants';

interface ExpenseCardProps {
  merchant: string;
  amount: number;
  date: string;
  category: string;
  txHash: string;
  onClick?: () => void;
}

export default function ExpenseCard({
  merchant,
  amount,
  date,
  category,
  txHash,
  onClick,
}: ExpenseCardProps) {
  // Find category details
  const categoryData = CATEGORIES.find((cat) => cat.id === category);
  const categoryIcon = categoryData?.icon || '⚙️';
  const categoryColor = categoryData?.color || '#95A5A6';

  // Format transaction hash - show first 6 and last 4 chars
  const truncatedHash = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`;

  // Format amount as currency
  const formattedAmount = `$${amount.toFixed(2)}`;

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-3 shadow-sm mb-2 flex flex-row items-center gap-3 ${
        onClick ? 'cursor-pointer active:opacity-90' : ''
      }`}
    >
      {/* Category Circle */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg"
        style={{ backgroundColor: `${categoryColor}20` }}
      >
        {categoryIcon}
      </div>

      {/* Middle Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[#1E3A2F] truncate">{merchant}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-xs text-gray-600">{date}</span>
          <span className="text-[#35D07F] text-xs">●</span>
          <span className="font-mono text-xs text-gray-500 truncate">{truncatedHash}</span>
        </div>
      </div>

      {/* Right Content */}
      <div className="flex flex-col items-end flex-shrink-0">
        <p className="font-bold text-sm text-[#1E3A2F]">{formattedAmount}</p>
        <p className="text-xs text-[#35D07F] font-medium mt-0.5">⛓ verificado</p>
      </div>
    </div>
  );
}
