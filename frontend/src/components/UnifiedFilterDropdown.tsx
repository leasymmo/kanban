import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, SlidersHorizontal } from 'lucide-react';

export interface MultiFilterOption<T extends string | number = string | number> {
  id: T;
  label: string;
  dotColor?: string;
  dotClass?: string;
}

export interface FilterAccordionSection<T extends string | number = string | number> {
  id: string;
  title: string;
  icon?: React.ReactNode;
  options: MultiFilterOption<T>[];
  hiddenIds: T[];
  onToggle: (id: T) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

interface UnifiedFilterDropdownProps {
  sections: FilterAccordionSection<any>[];
  label?: string;
  align?: 'left' | 'right';
  title?: string;
}

/**
 * Bouton de filtre unifié ouvrant un popover Liquid Glass avec sections en accordéon exclusif :
 * la première section est ouverte par défaut et les suivantes fermées ; ouvrir une section ferme la précédente.
 */
export const UnifiedFilterDropdown: React.FC<UnifiedFilterDropdownProps> = ({
  sections,
  label = 'Filtres',
  align = 'right',
  title = 'Filtrer les tâches'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openSectionId, setOpenSectionId] = useState<string | null>(() => sections[0]?.id ?? null);
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

  const activeSectionsCount = sections.filter((section) => {
    const visibleCount = section.options.filter((opt) => !section.hiddenIds.includes(opt.id)).length;
    return visibleCount < section.options.length;
  }).length;
  const isFiltered = activeSectionsCount > 0;

  const handleTogglePopover = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setOpenSectionId(sections[0]?.id ?? null);
      }
      return next;
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleTogglePopover}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`flex items-center gap-1 sm:gap-1.5 text-[12px] border rounded-cdh-md px-2 sm:px-2.5 py-1.5 min-h-[38px] sm:min-h-[34px] font-semibold transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap ${
          isFiltered
            ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-accent)]'
            : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
        }`}
        title={title}
      >
        <SlidersHorizontal
          className={`w-3.5 h-3.5 shrink-0 ${
            isFiltered ? 'text-[var(--cdh-accent)]' : 'text-[var(--cdh-text-tertiary)]'
          }`}
          strokeWidth={2}
        />
        <span className="truncate">{label}</span>
        {isFiltered && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--cdh-accent)] text-white text-[10.5px] font-bold tabular-nums leading-none">
            {activeSectionsCount}
          </span>
        )}
        <ChevronDown
          className={`hidden xs:block w-3.5 h-3.5 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={2}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0 sm:left-auto sm:right-0'
          } mt-1.5 w-72 max-w-[calc(100vw-2rem)] cdh-glass-overlay rounded-cdh-xl p-1.5 z-40 animate-fade-in space-y-1`}
        >
          {sections.map((section, idx) => {
            const isSectionOpen = openSectionId === section.id;
            const totalCount = section.options.length;
            const visibleCount = section.options.filter((opt) => !section.hiddenIds.includes(opt.id)).length;
            const isSectionFiltered = visibleCount < totalCount;

            return (
              <div
                key={section.id}
                className={idx > 0 ? 'pt-1 border-t border-[var(--cdh-border-hairline)]' : ''}
              >
                <button
                  type="button"
                  aria-expanded={isSectionOpen}
                  onClick={() =>
                    setOpenSectionId((prev) => (prev === section.id ? null : section.id))
                  }
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-cdh-md text-left hover:bg-[var(--cdh-surface-control)] transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {section.icon}
                    <span className="text-[12px] font-semibold text-[var(--cdh-text-primary)] truncate">
                      {section.title}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-full ${
                        isSectionFiltered
                          ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
                          : 'text-[var(--cdh-text-tertiary)]'
                      }`}
                    >
                      {visibleCount}/{totalCount}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] transition-transform duration-150 ${
                        isSectionOpen ? 'rotate-180' : ''
                      }`}
                      strokeWidth={2}
                    />
                  </span>
                </button>

                {isSectionOpen && (
                  <div className="pt-1 pb-1 space-y-1 animate-fade-in">
                    <div className="px-2.5 pb-1 flex items-center justify-between">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                        Sélection
                      </span>
                      <div className="flex items-center gap-2 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={section.onSelectAll}
                          className="text-[var(--cdh-accent)] hover:underline cursor-pointer"
                        >
                          Tous
                        </button>
                        <span className="text-[var(--cdh-border-subtle)]">|</span>
                        <button
                          type="button"
                          onClick={section.onSelectNone}
                          className="text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] cursor-pointer"
                        >
                          Aucun
                        </button>
                      </div>
                    </div>

                    <div
                      role="listbox"
                      aria-label={section.title}
                      className="max-h-56 overflow-y-auto px-1 space-y-0.5"
                    >
                      {section.options.map((opt) => {
                        const isVisible = !section.hiddenIds.includes(opt.id);
                        return (
                          <button
                            key={String(opt.id)}
                            type="button"
                            role="option"
                            aria-selected={isVisible}
                            onClick={() => section.onToggle(opt.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 sm:py-1.5 rounded-cdh-sm text-xs transition-colors cursor-pointer ${
                              isVisible
                                ? 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)] font-semibold'
                                : 'text-[var(--cdh-text-tertiary)] hover:bg-[var(--cdh-surface-control)]'
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
                                isVisible
                                  ? 'bg-[var(--cdh-accent)] border-[var(--cdh-accent)] text-white'
                                  : 'border-black/[0.12] bg-white'
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
          })}
        </div>
      )}
    </div>
  );
};
