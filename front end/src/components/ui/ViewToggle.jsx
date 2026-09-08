import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

export default function ViewToggle({
  value,
  onChange,
  boardValue = 'board',
  tableValue = 'table',
  boardLabel = 'Board',
  tableLabel = 'Table',
  className = '',
}) {
  const options = [
    { value: boardValue, label: boardLabel, icon: LayoutGrid, title: `${boardLabel} View` },
    { value: tableValue, label: tableLabel, icon: List, title: `${tableLabel} View` },
  ];

  return (
    <div className={`flex items-center gap-2 rounded-2xl border border-purple-100 bg-purple-50/50 p-1 ${className}`}>
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            title={option.title}
            className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black transition-all ${
              isActive
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-500 hover:bg-white/70 hover:text-purple-700'
            }`}
          >
            <Icon size={16} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
