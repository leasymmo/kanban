import React, { useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, TaskFacets } from '../types';
import { AssigneeFilter } from '../hooks/useTaskFilters';
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import { Avatar } from './ui';
import { ensureWhiteTextContrast } from '../utils/color';
import { ChevronDown, Check, UserCheck, Users } from 'lucide-react';

interface AssigneeFilterDropdownProps {
  value: AssigneeFilter;
  onChange: (filter: AssigneeFilter) => void;
  currentUser: User | null;
  allUsers: User[];
  assigneeCounts: TaskFacets['assignee_counts'];
}

/**
 * Sélecteur compact Liquid Glass pour le filtre des responsables :
 * utilise les compteurs réels calculés côté serveur, indépendamment des pages chargées.
 */
export const AssigneeFilterDropdown: React.FC<AssigneeFilterDropdownProps> = React.memo(
  ({ value, onChange, currentUser, allUsers, assigneeCounts }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const handleClose = useCallback(() => setIsOpen(false), []);

    const popoverStyle = useAnchoredPopover({
      isOpen,
      onClose: handleClose,
      triggerRef,
      popoverRef,
      width: 256,
      align: 'lg-right',
    });

    const effectiveValue: AssigneeFilter =
      currentUser && value === currentUser.id ? 'me' : value;

    const getUserCount = useCallback(
      (uid: number) => Number(assigneeCounts.by_user?.[String(uid)] ?? 0),
      [assigneeCounts.by_user]
    );

    const otherUsers = useMemo(
      () => allUsers.filter((u) => u.id !== currentUser?.id),
      [allUsers, currentUser?.id]
    );

    const myTasksCount = currentUser ? getUserCount(currentUser.id) : 0;
    const totalTasksCount = assigneeCounts.all ?? 0;

    const selectedOther =
      typeof effectiveValue === 'number'
        ? otherUsers.find((u) => u.id === effectiveValue) ?? null
        : null;

    const activeCount =
      effectiveValue === 'all'
        ? totalTasksCount
        : effectiveValue === 'me'
        ? myTasksCount
        : selectedOther
        ? getUserCount(selectedOther.id)
        : totalTasksCount;

    const isNonDefault = effectiveValue !== 'me';

    const renderButtonLeading = () => {
      if (selectedOther) {
        return (
          <Avatar
            initials={selectedOther.initials}
            color={ensureWhiteTextContrast(selectedOther.avatar_color)}
            size="xs"
          />
        );
      }
      if (effectiveValue === 'all') {
        return <Users className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2} />;
      }
      return <UserCheck className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2} />;
    };

    const renderButtonLabel = () => {
      if (selectedOther) {
        return <span className="truncate">{selectedOther.name.split(' ')[0]}</span>;
      }
      if (effectiveValue === 'all') {
        return (
          <>
            <span className="sm:hidden truncate">Toutes</span>
            <span className="hidden sm:inline truncate">Toutes les tâches</span>
          </>
        );
      }
      return <span className="truncate">Mes tâches</span>;
    };

    const activeDescription = selectedOther
      ? selectedOther.name
      : effectiveValue === 'all'
      ? 'Toutes les tâches'
      : 'Mes tâches';

    return (
      <div className="relative min-w-0 flex-1 sm:flex-initial">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={`Responsable : ${activeDescription} (${activeCount}). Changer le filtre`}
          title={`Responsable : ${activeDescription} (${activeCount})`}
          className={`flex items-center gap-1 sm:gap-1.5 text-[12px] border rounded-cdh-md px-2 sm:px-2.5 py-1.5 min-h-[38px] sm:min-h-[34px] font-semibold transition-all active:scale-[0.98] cursor-pointer max-w-full ${
            isOpen || isNonDefault
              ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-info)]'
              : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
          }`}
        >
          {renderButtonLeading()}
          {renderButtonLabel()}
          <span className="text-[11px] font-mono tabular-nums opacity-75 shrink-0">
            ({activeCount})
          </span>
          <ChevronDown
            className={`hidden xs:block w-3.5 h-3.5 shrink-0 text-[var(--cdh-text-tertiary)] transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
          />
        </button>

        {isOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={popoverRef}
              role="dialog"
              aria-label="Filtrer par responsable"
              style={popoverStyle}
              className="fixed z-40 cdh-glass-overlay cdh-glass-popover rounded-cdh-xl p-1.5 overflow-y-auto animate-fade-in space-y-0.5"
            >
              <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                Responsable
              </div>

              {currentUser && (
                <button
                  type="button"
                  aria-pressed={effectiveValue === 'me'}
                  onClick={() => {
                    onChange('me');
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-cdh-md text-xs transition-colors cursor-pointer ${
                    effectiveValue === 'me'
                      ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                      : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-cdh-sm flex items-center justify-center shrink-0 ${
                        effectiveValue === 'me'
                          ? 'bg-[var(--cdh-accent)] text-white'
                          : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" strokeWidth={2} />
                    </span>
                    <span className="truncate">Mes tâches</span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]">
                      {myTasksCount}
                    </span>
                    {effectiveValue === 'me' && (
                      <Check className="w-3.5 h-3.5 text-[var(--cdh-info)]" strokeWidth={2.25} />
                    )}
                  </span>
                </button>
              )}

              <button
                type="button"
                aria-pressed={effectiveValue === 'all'}
                onClick={() => {
                  onChange('all');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-cdh-md text-xs transition-colors cursor-pointer ${
                  effectiveValue === 'all'
                    ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                    : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-cdh-sm flex items-center justify-center shrink-0 ${
                      effectiveValue === 'all'
                        ? 'bg-[var(--cdh-accent)] text-white'
                        : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" strokeWidth={2} />
                  </span>
                  <span className="truncate">Toutes les tâches</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]">
                    {totalTasksCount}
                  </span>
                  {effectiveValue === 'all' && (
                    <Check className="w-3.5 h-3.5 text-[var(--cdh-info)]" strokeWidth={2.25} />
                  )}
                </span>
              </button>

              {otherUsers.length > 0 && (
                <>
                  <div className="my-1 border-t border-[var(--cdh-border-hairline)]" />
                  <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                    Autres associés
                  </div>
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {otherUsers.map((u) => {
                      const count = getUserCount(u.id);
                      const isSelected = effectiveValue === u.id;
                      const avatarBg = ensureWhiteTextContrast(u.avatar_color);

                      return (
                        <button
                          key={u.id}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            onChange(u.id);
                            setIsOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-cdh-md text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                              : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Avatar initials={u.initials} color={avatarBg} size="sm" />
                            <span className="truncate">{u.name}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-full bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]">
                              {count}
                            </span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-[var(--cdh-info)]" strokeWidth={2.25} />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>,
            document.body
          )}
      </div>
    );
  }
);

AssigneeFilterDropdown.displayName = 'AssigneeFilterDropdown';
