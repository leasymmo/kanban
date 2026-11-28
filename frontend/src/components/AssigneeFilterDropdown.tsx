import React, { useState, useRef, useEffect } from 'react';
import { User, Task } from '../types';
import { AssigneeFilter } from '../hooks/useTaskFilters';
import { Avatar } from './ui';
import { ensureWhiteTextContrast } from '../utils/color';
import { ChevronDown, Check, UserCheck, Users } from 'lucide-react';

interface AssigneeFilterDropdownProps {
  value: AssigneeFilter;
  onChange: (filter: AssigneeFilter) => void;
  currentUser: User | null;
  allUsers: User[];
  facetFilteredTasks: Task[];
}

/**
 * Sélecteur compact Liquid Glass pour le filtre des responsables :
 * par défaut sur « Mes tâches », avec menu ordonné :
 * Mes tâches -> Toutes les tâches -> Autres associés.
 */
export const AssigneeFilterDropdown: React.FC<AssigneeFilterDropdownProps> = ({
  value,
  onChange,
  currentUser,
  allUsers,
  facetFilteredTasks,
}) => {
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

  const otherUsers = allUsers.filter((u) => u.id !== currentUser?.id);
  const myTasksCount = currentUser
    ? facetFilteredTasks.filter((t) => t.assigned_to === currentUser.id).length
    : 0;
  const totalTasksCount = facetFilteredTasks.length;

  const selectedOther =
    typeof value === 'number'
      ? otherUsers.find((u) => u.id === value) ??
        allUsers.find((u) => u.id === value) ??
        null
      : null;

  const activeCount =
    value === 'all'
      ? totalTasksCount
      : value === 'me'
      ? myTasksCount
      : selectedOther
      ? facetFilteredTasks.filter((t) => t.assigned_to === selectedOther.id).length
      : totalTasksCount;

  const isNonDefault = value !== 'me';

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
    if (value === 'all') {
      return <Users className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2} />;
    }
    return <UserCheck className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2} />;
  };

  const renderButtonLabel = () => {
    if (selectedOther) {
      return <span className="truncate">{selectedOther.name.split(' ')[0]}</span>;
    }
    if (value === 'all') {
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
    : value === 'all'
    ? 'Toutes les tâches'
    : 'Mes tâches';

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Responsable : ${activeDescription} (${activeCount}). Changer le filtre`}
        title={`Responsable : ${activeDescription} (${activeCount})`}
        className={`flex items-center gap-1.5 text-[12px] border rounded-cdh-md px-2 sm:px-2.5 py-1.5 min-h-[38px] sm:min-h-[34px] font-semibold transition-all active:scale-[0.98] cursor-pointer max-w-full ${
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
          className={`w-3.5 h-3.5 shrink-0 text-[var(--cdh-text-tertiary)] transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Filtrer par responsable"
          className="absolute left-0 lg:left-auto lg:right-0 mt-1.5 w-64 max-w-[calc(100vw-2rem)] cdh-glass-overlay rounded-cdh-xl p-1.5 z-40 animate-fade-in space-y-0.5"
        >
          <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
            Responsable
          </div>

          {/* 1. Mes tâches (par défaut) */}
          {currentUser && (
            <button
              type="button"
              aria-pressed={value === 'me'}
              onClick={() => {
                onChange('me');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-cdh-md text-xs transition-colors cursor-pointer ${
                value === 'me'
                  ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                  : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`w-6 h-6 rounded-cdh-sm flex items-center justify-center shrink-0 ${
                    value === 'me'
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
                {value === 'me' && <Check className="w-3.5 h-3.5 text-[var(--cdh-info)]" strokeWidth={2.25} />}
              </span>
            </button>
          )}

          {/* 2. Toutes les tâches */}
          <button
            type="button"
            aria-pressed={value === 'all'}
            onClick={() => {
              onChange('all');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-cdh-md text-xs transition-colors cursor-pointer ${
              value === 'all'
                ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-6 h-6 rounded-cdh-sm flex items-center justify-center shrink-0 ${
                  value === 'all'
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
              {value === 'all' && <Check className="w-3.5 h-3.5 text-[var(--cdh-info)]" strokeWidth={2.25} />}
            </span>
          </button>

          {/* 3. Autres associés */}
          {otherUsers.length > 0 && (
            <>
              <div className="my-1 border-t border-[var(--cdh-border-hairline)]" />
              <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                Autres associés
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5">
                {otherUsers.map((u) => {
                  const count = facetFilteredTasks.filter((t) => t.assigned_to === u.id).length;
                  const isSelected = value === u.id;
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
        </div>
      )}
    </div>
  );
};
