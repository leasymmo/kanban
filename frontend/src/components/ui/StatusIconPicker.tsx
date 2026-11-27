import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { TaskStatus } from '../../types';
import { computePopoverPosition, PopoverStylePosition, toPopoverStyle } from './popoverPosition';
import { TASK_STATUS_META, TaskStatusIcon } from './TaskIcons';

export interface StatusIconPickerProps {
  status: TaskStatus;
  onChange: (status: TaskStatus) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Bouton cercle Liquid Glass affichant l'icône du statut actuel et ouvrant un popover
 * pour changer de statut en un clic (partagé entre TaskMetaBar et MeetingRetroStep).
 */
export const StatusIconPicker: React.FC<StatusIconPickerProps> = ({
  status,
  onChange,
  size = 'md',
  disabled = false,
  isOpen: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [menuPos, setMenuPos] = useState<PopoverStylePosition>({ bottom: 0, left: 0, maxHeight: 300 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const statusMeta = TASK_STATUS_META[status] ?? TASK_STATUS_META.todo;
  const pillSizeClass = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';

  const computePos = (): PopoverStylePosition =>
    computePopoverPosition(btnRef.current, {
      width: 220,
      preferredPlacement: 'above',
      minSpaceNeeded: 200,
      gap: 8,
      viewportPadding: 8,
    });

  useEffect(() => {
    if (!isOpen) return;
    setMenuPos(computePos());

    const handleResize = () => setMenuPos(computePos());
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
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
  }, [isOpen]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-expanded={!disabled ? isOpen : undefined}
        aria-label={`Statut : ${statusMeta.label}`}
        title={`Statut : ${statusMeta.label}`}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          if (!isOpen) setMenuPos(computePos());
          setOpen(!isOpen);
        }}
        className={`${pillSizeClass} rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
          disabled ? 'cursor-default' : 'active:scale-95 cursor-pointer hover:opacity-85'
        }`}
        style={{ backgroundColor: statusMeta.bgSoft }}
      >
        <TaskStatusIcon status={status} className="w-3.5 h-3.5" />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            style={toPopoverStyle(menuPos, 220)}
            className="fixed z-[80] cdh-glass-overlay rounded-cdh-xl p-1.5 animate-fade-in space-y-0.5 overflow-y-auto"
          >
            <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
              Statut
            </div>
            {(Object.keys(TASK_STATUS_META) as TaskStatus[]).map((st) => {
              const meta = TASK_STATUS_META[st];
              const isSelected = status === st;
              return (
                <button
                  key={st}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(st);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-cdh-sm text-[12.5px] transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] font-semibold'
                      : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <TaskStatusIcon status={st} className="w-3.5 h-3.5 shrink-0" />
                    <span>{meta.label}</span>
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
};
