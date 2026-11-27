import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { computePopoverPosition, PopoverStylePosition, toPopoverStyle } from './popoverPosition';

export interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  variant?: 'default' | 'icon-pill';
  size?: 'sm' | 'md';
  markOverdue?: boolean;
  className?: string;
}

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

function parseIsoDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Sélecteur de date avec calendrier interactif Apple Liquid Glass (sans fenêtre native navigateur).
 */
export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Choisir une date…',
  disabled = false,
  ariaLabel = 'Sélectionner une date',
  variant = 'default',
  size = 'md',
  markOverdue = true,
  className = ''
}) => {
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => selectedDate || new Date());
  const [popoverPos, setPopoverPos] = useState<PopoverStylePosition>({ bottom: 0, left: 0, maxHeight: 360 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDate) {
      setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [value]);

  const computePosition = (): PopoverStylePosition =>
    computePopoverPosition(triggerRef.current, {
      width: 280,
      preferredPlacement: variant === 'icon-pill' ? 'above' : 'below',
      minSpaceNeeded: variant === 'icon-pill' ? 240 : 320,
      gap: 8,
      viewportPadding: 8
    });

  const toggleCalendar = () => {
    if (disabled) return;
    if (!isOpen) {
      setPopoverPos(computePosition());
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => setPopoverPos(computePosition());

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, variant]);

  const daysGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Lundi = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<Date | null> = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [viewDate]);

  const todayIso = toIsoDate(new Date());

  const formattedLabel = selectedDate
    ? selectedDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : placeholder;

  const shortFormattedLabel = selectedDate
    ? selectedDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short'
      })
    : '';

  const isOverdue = markOverdue && !!selectedDate && value < todayIso;

  return (
    <div className={`relative ${className}`.trim()}>
      {variant === 'icon-pill' ? (
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-label={selectedDate ? `Échéance : ${formattedLabel}` : ariaLabel}
          title={selectedDate ? `Échéance : ${formattedLabel}` : 'Définir une échéance'}
          aria-expanded={isOpen}
          onClick={(e) => {
            e.stopPropagation();
            toggleCalendar();
          }}
          className={`${size === 'sm' ? 'h-7 text-[11px]' : 'h-8 text-[11.5px]'} flex items-center justify-center gap-1 rounded-full font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
            disabled ? 'cursor-default' : 'active:scale-95 cursor-pointer'
          } ${
            selectedDate
              ? isOverdue
                ? `${size === 'sm' ? 'px-2' : 'px-2.5'} bg-[var(--cdh-danger-soft)] text-[var(--cdh-danger)]`
                : `${size === 'sm' ? 'px-2' : 'px-2.5'} bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]`
              : `${size === 'sm' ? 'w-7' : 'w-8'} bg-[var(--cdh-surface-control)] ${
                  disabled ? 'opacity-55' : 'hover:bg-[var(--cdh-surface-control-hover)]'
                } text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]`
          }`}
        >
          {selectedDate ? (
            <span className="tabular-nums whitespace-nowrap">{shortFormattedLabel}</span>
          ) : (
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
          )}
        </button>
      ) : (
        <div className="relative flex items-center">
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            aria-label={ariaLabel}
            aria-expanded={isOpen}
            onClick={toggleCalendar}
            className={`w-full flex items-center gap-2 px-3 py-2 min-h-[38px] rounded-cdh-md bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] text-left text-[13px] transition-all cursor-pointer focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-[3px] focus:ring-[var(--cdh-accent-soft)] disabled:opacity-45 disabled:cursor-not-allowed ${
              selectedDate ? 'text-[var(--cdh-text-primary)] font-medium pr-8' : 'text-[var(--cdh-text-tertiary)]'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[var(--cdh-accent)] shrink-0" strokeWidth={2} />
            <span className="truncate">{formattedLabel}</span>
          </button>

          {selectedDate && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              aria-label="Effacer la date"
              className="absolute right-1.5 p-1 rounded-full text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={toPopoverStyle(popoverPos, 280)}
          className="fixed z-[80] cdh-glass-overlay rounded-cdh-xl p-3 animate-fade-in select-none overflow-y-auto"
        >
          {/* En-tête Mois / Année */}
          <div className="flex items-center justify-between mb-2.5 px-1">
            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
              }
              aria-label="Mois précédent"
              className="p-1.5 rounded-full text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>

            <span className="text-[13px] font-semibold text-[var(--cdh-text-primary)]">
              {MONTHS_FR[viewDate.getMonth()]} {viewDate.getFullYear()}
            </span>

            <button
              type="button"
              onClick={() =>
                setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
              }
              aria-label="Mois suivant"
              className="p-1.5 rounded-full text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-center">
            {WEEKDAYS.map((day, idx) => (
              <span
                key={idx}
                className="text-[10.5px] font-semibold text-[var(--cdh-text-tertiary)] py-1"
              >
                {day}
              </span>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((cell, idx) => {
              if (!cell) {
                return <span key={`empty-${idx}`} className="h-8" />;
              }
              const iso = toIsoDate(cell);
              const isSelected = iso === value;
              const isToday = iso === todayIso;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    onChange(iso);
                    setIsOpen(false);
                  }}
                  className={`h-8 w-full rounded-full text-[12px] font-medium tabular-nums flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--cdh-accent)] text-white font-semibold shadow-sm'
                      : isToday
                      ? 'border border-[var(--cdh-accent)] text-[var(--cdh-accent)] font-semibold hover:bg-[var(--cdh-accent-soft)]'
                      : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)]'
                  }`}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>

          {/* Pied : Aujourd'hui / Effacer */}
          <div className="mt-2.5 pt-2 border-t border-[var(--cdh-border-hairline)] flex items-center justify-between text-[11.5px] font-semibold">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso);
                setIsOpen(false);
              }}
              className="text-[var(--cdh-accent)] hover:underline cursor-pointer px-1.5 py-0.5 rounded"
            >
              Aujourd'hui
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-danger)] cursor-pointer px-1.5 py-0.5 rounded"
              >
                Effacer
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
