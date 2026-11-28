import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import { TaskListSortDir } from '../utils/cookies';
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react';

export interface SortOptionItem<K extends string> {
  id: K;
  label: string;
}

interface SortDropdownProps<K extends string> {
  value: K;
  direction: TaskListSortDir;
  options: SortOptionItem<K>[];
  defaultSortBy: K;
  defaultSortDir?: TaskListSortDir;
  onSelectSort: (key: K) => void;
  onToggleDir: () => void;
  popoverTitle?: string;
  popoverAriaLabel?: string;
  ariaLabelPrefix?: string;
}

/**
 * Sélecteur de tri Liquid Glass réutilisable (Tâches & Questions) :
 * bouton compact avec indicateur de direction + popover portal avec inversion Asc/Desc.
 */
function SortDropdownInner<K extends string>({
  value,
  direction,
  options,
  defaultSortBy,
  defaultSortDir = 'asc',
  onSelectSort,
  onToggleDir,
  popoverTitle = 'Trier les éléments',
  popoverAriaLabel = 'Options de tri',
  ariaLabelPrefix = 'Tri',
}: SortDropdownProps<K>) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => setIsOpen(false), []);

  const popoverStyle = useAnchoredPopover({
    isOpen,
    onClose: handleClose,
    triggerRef,
    popoverRef,
    width: 248,
    align: 'right',
  });

  const isCustomSort = value !== defaultSortBy || direction !== defaultSortDir;
  const activeOption = options.find((o) => o.id === value) ?? options[0];
  const activeLabel = activeOption?.label ?? 'Tri';

  return (
    <div className="relative flex items-center gap-0.5 shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={`${ariaLabelPrefix} : ${activeLabel} (${direction === 'asc' ? 'croissant' : 'décroissant'})`}
        aria-label={`${ariaLabelPrefix} : ${activeLabel}`}
        className={`flex items-center gap-1 text-[12px] border rounded-cdh-md px-2 py-1.5 min-h-[38px] sm:min-h-[34px] font-semibold transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap ${
          isOpen || isCustomSort
            ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-info)]'
            : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
        }`}
      >
        <ArrowUpDown className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
        <span className="hidden sm:inline truncate max-w-[96px]">
          {value === defaultSortBy ? 'Tri' : activeLabel}
        </span>
        {direction === 'asc' ? (
          <ArrowUp className="w-3 h-3 shrink-0 opacity-75" strokeWidth={2.25} />
        ) : (
          <ArrowDown className="w-3 h-3 shrink-0 opacity-75" strokeWidth={2.25} />
        )}
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={popoverAriaLabel}
            style={popoverStyle}
            className="fixed z-40 cdh-glass-overlay cdh-glass-popover rounded-cdh-xl p-1.5 overflow-y-auto animate-fade-in space-y-0.5"
          >
            <div className="px-2.5 py-1 flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                {popoverTitle}
              </span>
              <button
                type="button"
                onClick={onToggleDir}
                aria-label={
                  direction === 'asc' ? 'Ordre croissant (inverser)' : 'Ordre décroissant (inverser)'
                }
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[11px] font-semibold text-[var(--cdh-text-primary)] cursor-pointer"
              >
                {direction === 'asc' ? (
                  <>
                    <ArrowUp className="w-3 h-3" strokeWidth={2.25} /> Asc
                  </>
                ) : (
                  <>
                    <ArrowDown className="w-3 h-3" strokeWidth={2.25} /> Desc
                  </>
                )}
              </button>
            </div>

            {options.map((opt) => {
              const isSelected = value === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelectSort(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-cdh-sm text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                      : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[var(--cdh-info)]">
                      {direction === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.25} />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.25} />
                      )}
                      <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}

export const SortDropdown = React.memo(SortDropdownInner) as <K extends string>(
  props: SortDropdownProps<K>
) => React.ReactElement;
