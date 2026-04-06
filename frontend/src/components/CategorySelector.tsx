'use client';

import { CATEGORIES } from '@/lib/constants';

interface CategorySelectorProps {
  selected: string;
  onSelect: (category: string) => void;
}

export default function CategorySelector({ selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((category) => {
        const isSelected = selected === category.id;

        return (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={`rounded-xl px-3 py-2 text-xs font-medium transition-all flex items-center gap-1 border-2 ${
              isSelected
                ? 'border-[#35D07F] bg-[#E8FFF3] text-[#1E3A2F]'
                : 'border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span>{category.icon}</span>
            <span>{category.name}</span>
          </button>
        );
      })}
    </div>
  );
}
