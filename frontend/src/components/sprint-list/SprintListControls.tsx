import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, Columns3 } from 'lucide-react';
import { TaskListColumnId, TaskListSortDir, TaskListSortKey } from '../../utils/cookies';
import { TASK_LIST_SORT_OPTIONS } from '../../utils/taskSort';
import { SPRINT_LIST_COLUMNS_CONFIG } from '../../hooks/useSprintListPrefs';
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover';

interface ColumnsPopoverButtonProps {
  visibleColumns: TaskListColumnId[];
  onToggleColumn: (colId: TaskListColumnId) => void;
  onResetColumns: () => void;
  isMobile?: boolean;
}

export const ColumnsPopoverButton: React.FC<ColumnsPopoverButtonProps> = React.memo(
  ({ visibleColumns, onToggleColumn, onResetColumns, isMobile = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const handleClose = useCallback(() => setIsOpen(false), []);

    const popoverStyle = useAnchoredPopover({
      isOpen,
      onClose: handleClose,
      triggerRef,
      popoverRef,
      width: 252,
      align: 'right',
    });

    return (
      <div className="relative shrink-0">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label="Afficher ou masquer des colonnes"
          title={`Colonnes visibles (${visibleColumns.length}/${SPRINT_LIST_COLUMNS_CONFIG.length})`}
          className={`flex items-center justify-center rounded-cdh-md border transition-all active:scale-95 cursor-pointer ${
            isMobile ? 'w-[44px] h-[44px]' : 'w-8 h-8'
          } ${
            isOpen
              ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-info)]'
              : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-secondary)] hover:bg-[var(--cdh-surface-control-hover)] hover:text-[var(--cdh-text-primary)]'
          }`}
        >
          <Columns3 className="w-4 h-4" strokeWidth={2} />
        </button>

        {isOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Colonnes visibles"
              style={popoverStyle}
              className="fixed z-[80] cdh-glass-overlay cdh-glass-popover rounded-cdh-xl p-1.5 animate-fade-in space-y-0.5 overflow-y-auto"
            >
              <div className="px-2.5 py-1 flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                  {isMobile ? 'Champs visibles' : 'Colonnes visibles'}
                </span>
                <button
                  type="button"
                  onClick={onResetColumns}
                  className="text-[11px] font-semibold text-[var(--cdh-info)] hover:underline cursor-pointer"
                >
                  Par défaut
                </button>
              </div>

              {SPRINT_LIST_COLUMNS_CONFIG.map((col) => {
                const isVisible = visibleColumns.includes(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    disabled={col.locked}
                    onClick={() => onToggleColumn(col.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 sm:py-1.5 rounded-cdh-sm text-xs transition-colors ${
                      col.locked
                        ? 'opacity-55 cursor-not-allowed text-[var(--cdh-text-secondary)]'
                        : 'cursor-pointer hover:bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)] font-semibold'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {col.locked && (
                        <span className="text-[10px] font-normal text-[var(--cdh-text-tertiary)]">
                          (fixe)
                        </span>
                      )}
                    </span>
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                        isVisible
                          ? 'bg-[var(--cdh-accent)] border-[var(--cdh-accent)] text-white'
                          : 'border-[var(--cdh-border-subtle)] bg-[var(--cdh-surface-input)]'
                      }`}
                    >
                      <Check
                        className={`w-3 h-3 transition-opacity duration-150 ${
                          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                        }`}
                        strokeWidth={2.25}
                      />
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body
          )}
      </div>
    );
  }
);

ColumnsPopoverButton.displayName = 'ColumnsPopoverButton';

interface MobileSortControlsProps {
  sortBy: TaskListSortKey;
  sortDir: TaskListSortDir;
  onSelectSort: (key: TaskListSortKey) => void;
  onToggleSortDir: () => void;
}

export const MobileSortControls: React.FC<MobileSortControlsProps> = React.memo(
  ({ sortBy, sortDir, onSelectSort, onToggleSortDir }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const handleClose = useCallback(() => setIsOpen(false), []);

    const popoverStyle = useAnchoredPopover({
      isOpen,
      onClose: handleClose,
      triggerRef,
      popoverRef,
      width: 240,
      align: 'left',
    });

    const activeSortOption =
      TASK_LIST_SORT_OPTIONS.find((s) => s.id === sortBy) ?? TASK_LIST_SORT_OPTIONS[0];

    return (
      <div className="relative flex items-center gap-1.5 flex-1 min-w-0">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={`flex items-center justify-between gap-2 text-[12px] border rounded-cdh-md px-2.5 font-semibold transition-all active:scale-[0.98] cursor-pointer flex-1 min-w-0 min-h-[44px] ${
            isOpen
              ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-info)]'
              : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
          }`}
          title="Ordonner les tâches"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2} />
            <span className="truncate">Tri : {activeSortOption.label}</span>
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-[var(--cdh-text-tertiary)] transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
          />
        </button>

        <button
          type="button"
          onClick={onToggleSortDir}
          aria-label={sortDir === 'asc' ? 'Ordre croissant (inverser)' : 'Ordre décroissant (inverser)'}
          title={
            sortDir === 'asc'
              ? 'Ordre croissant — cliquer pour inverser'
              : 'Ordre décroissant — cliquer pour inverser'
          }
          className="flex items-center justify-center rounded-cdh-md border border-[var(--cdh-border-hairline)] bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] transition-all active:scale-95 cursor-pointer shrink-0 w-[44px] h-[44px]"
        >
          {sortDir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.25} />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.25} />
          )}
        </button>

        {isOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Ordonner les tâches"
              style={popoverStyle}
              className="fixed z-[80] cdh-glass-overlay cdh-glass-popover rounded-cdh-xl p-1.5 animate-fade-in space-y-0.5 overflow-y-auto"
            >
              <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                Ordonner par
              </div>
              {TASK_LIST_SORT_OPTIONS.map((opt) => {
                const isSelected = sortBy === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onSelectSort(opt.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-cdh-sm text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                        : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected &&
                      (sortDir === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2.25} />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2.25} />
                      ))}
                  </button>
                );
              })}
            </div>,
            document.body
          )}
      </div>
    );
  }
);

MobileSortControls.displayName = 'MobileSortControls';
