import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface MultiFilterOption<T extends string | number> {
  id: T;
  label: string;
  dotColor?: string;
  dotClass?: string;
}

interface MultiFilterDropdownProps<T extends string | number> {
  defaultLabel: string;
  filteredLabel: (visibleCount: number, totalCount: number) => string;
  headerTitle: string;
  icon: React.ReactNode;
  options: MultiFilterOption<T>[];
  hiddenIds: T[];
  onToggle: (id: T) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  activeButtonClass?: string;
  activeCheckClass?: string;
  align?: 'left' | 'right';
  title?: string;
}

export function MultiFilterDropdown<T extends string | number>({
  defaultLabel,
  filteredLabel,
  headerTitle,
  icon,
  options,
  hiddenIds,
  onToggle,
  onSelectAll,
  onSelectNone,
  activeButtonClass = 'bg-brand-50 border-brand-300 text-brand-800',
  activeCheckClass = 'bg-brand-600 border-brand-600 text-white',
  align = 'left',
  title
}: MultiFilterDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const totalCount = options.length;
  const visibleCount = options.filter(opt => !hiddenIds.includes(opt.id)).length;
  const isFiltered = visibleCount < totalCount;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`flex items-center gap-1.5 text-xs border rounded-xl px-2.5 py-1.5 min-h-[40px] sm:min-h-[36px] font-semibold transition-all active:scale-[0.98] cursor-pointer ${
          isFiltered
            ? activeButtonClass
            : 'bg-slate-50 border-black/[0.12] text-slate-700 hover:bg-slate-100'
        }`}
        title={title}
      >
        {icon}
        <span className="truncate">{isFiltered ? filteredLabel(visibleCount, totalCount) : defaultLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={headerTitle}
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0 sm:left-auto sm:right-0'
          } mt-1.5 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-black/[0.12] py-2 z-40 animate-fade-in`}
        >
          <div className="px-3 pb-2 mb-1.5 border-b border-black/[0.12] flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {headerTitle}
            </span>
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <button
                type="button"
                onClick={onSelectAll}
                className="text-brand-600 hover:text-brand-800 cursor-pointer"
              >
                Tous
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={onSelectNone}
                className="text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                Aucun
              </button>
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto px-1.5 space-y-0.5">
            {options.map(opt => {
              const isVisible = !hiddenIds.includes(opt.id);
              return (
                <button
                  key={String(opt.id)}
                  type="button"
                  role="option"
                  aria-selected={isVisible}
                  onClick={() => onToggle(opt.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 sm:py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                    isVisible
                      ? 'bg-slate-50/80 text-slate-800 font-semibold'
                      : 'text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotClass || ''}`}
                      style={opt.dotColor ? { backgroundColor: opt.dotColor } : undefined}
                    />
                    <span className="truncate">{opt.label}</span>
                  </span>
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                      isVisible ? activeCheckClass : 'border-black/[0.12] bg-white'
                    }`}
                  >
                    <Check
                      className={`w-3 h-3 transition-all duration-200 ${
                        isVisible ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-[4px] scale-90'
                      }`}
                      strokeWidth={2}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
