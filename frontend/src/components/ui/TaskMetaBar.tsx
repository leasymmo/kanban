import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Star, UserPlus } from 'lucide-react';
import { TaskPriority, TaskStatus, User } from '../../types';
import { useAnchoredPopover } from '../../hooks/useAnchoredPopover';
import { Avatar } from './Avatar';
import { DatePicker } from './DatePicker';
import { StatusIconPicker } from './StatusIconPicker';
import {
  TASK_PRIORITY_META,
  TaskPriorityIcon,
} from './TaskIcons';

type ActivePopover = 'assignee' | 'priority' | null;

export interface TaskMetaBarProps {
  users: User[];
  assignedTo: number | '';
  onChangeAssignee: (userId: number | '') => void;
  showAssignee?: boolean;
  assigneeEditable?: boolean;
  allowUnassign?: boolean;
  fallbackAssignee?: {
    name?: string | null;
    initials?: string | null;
    color?: string | null;
  };
  status: TaskStatus;
  onChangeStatus: (status: TaskStatus) => void;
  showStatus?: boolean;
  priority: TaskPriority;
  onChangePriority: (priority: TaskPriority) => void;
  dueDate: string;
  onChangeDueDate: (date: string) => void;
  markOverdue?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
  showStar?: boolean;
  isStarred?: boolean;
  canToggleStar?: boolean;
  onToggleStar?: () => void;
}

/**
 * Barre d'icônes unifiée Apple Liquid Glass pour piloter les métadonnées d'une tâche
 * (Responsable, Statut, Priorité, Échéance et mise en avant étoile optionnelle)
 * utilisée dans les footers de modale et de carte de tâche.
 */
export const TaskMetaBar = React.memo<TaskMetaBarProps>(({
  users,
  assignedTo,
  onChangeAssignee,
  showAssignee = true,
  assigneeEditable = true,
  allowUnassign = false,
  fallbackAssignee,
  status,
  onChangeStatus,
  showStatus = true,
  priority,
  onChangePriority,
  dueDate,
  onChangeDueDate,
  markOverdue = status !== 'done',
  size = 'md',
  disabled = false,
  showStar = false,
  isStarred = false,
  canToggleStar = false,
  onToggleStar,
}) => {
  const [openMenu, setOpenMenu] = useState<ActivePopover>(null);
  const assigneeBtnRef = useRef<HTMLButtonElement>(null);
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const activeTriggerRef = openMenu === 'assignee' ? assigneeBtnRef : priorityBtnRef;
  const popoverRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => setOpenMenu(null), []);

  const popoverStyle = useAnchoredPopover({
    isOpen: openMenu !== null,
    onClose: handleClose,
    triggerRef: activeTriggerRef,
    popoverRef,
    width: 220,
    preferredPlacement: 'above',
    minSpaceNeeded: 200,
    gap: 8,
    viewportPadding: 8,
  });

  const selectedUser = users.find((u) => u.id === assignedTo) || null;
  const resolvedAssignee = selectedUser
    ? {
        name: selectedUser.name,
        initials: selectedUser.initials,
        color: selectedUser.avatar_color,
      }
    : assignedTo && fallbackAssignee?.initials
      ? {
          name: fallbackAssignee.name || 'Associé',
          initials: fallbackAssignee.initials,
          color: fallbackAssignee.color || '#4B5563',
        }
      : null;

  const priorityMeta = TASK_PRIORITY_META[priority] ?? TASK_PRIORITY_META.medium;
  const pillSizeClass = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const canEditAssigneeBtn = assigneeEditable && !disabled;

  const toggleMenu = (type: Exclude<ActivePopover, null>) => {
    setOpenMenu((prev) => (prev === type ? null : type));
  };

  return (
    <div
      className="flex items-center gap-1.5 flex-wrap"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Responsable */}
      {showAssignee && (
        <button
          ref={assigneeBtnRef}
          type="button"
          disabled={!canEditAssigneeBtn}
          aria-haspopup="listbox"
          aria-expanded={canEditAssigneeBtn ? openMenu === 'assignee' : undefined}
          aria-label={resolvedAssignee ? `Responsable : ${resolvedAssignee.name}` : 'À attribuer'}
          title={resolvedAssignee ? `Responsable : ${resolvedAssignee.name}` : (canEditAssigneeBtn ? 'Choisir un responsable' : 'À attribuer')}
          onClick={() => canEditAssigneeBtn && toggleMenu('assignee')}
          className={`${pillSizeClass} rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
            canEditAssigneeBtn
              ? 'active:scale-95 cursor-pointer hover:ring-2 hover:ring-[var(--cdh-accent-soft)]'
              : 'cursor-default'
          } ${
            !resolvedAssignee
              ? 'bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)]'
              : 'bg-[var(--cdh-surface-control)]'
          }`}
        >
          {resolvedAssignee ? (
            <Avatar
              initials={resolvedAssignee.initials}
              name={resolvedAssignee.name}
              color={resolvedAssignee.color}
              size={size === 'sm' ? 'xs' : 'sm'}
            />
          ) : (
            <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
          )}
        </button>
      )}

      {/* 2. Statut */}
      {showStatus && (
        <StatusIconPicker
          status={status}
          onChange={onChangeStatus}
          size={size}
          disabled={disabled}
        />
      )}

      {/* 3. Priorité */}
      <button
        ref={priorityBtnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={!disabled ? openMenu === 'priority' : undefined}
        aria-label={`Priorité : ${priorityMeta.label}`}
        title={`Priorité : ${priorityMeta.label}`}
        onClick={() => !disabled && toggleMenu('priority')}
        className={`${pillSizeClass} rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
          disabled ? 'cursor-default' : 'active:scale-95 cursor-pointer hover:opacity-85'
        }`}
        style={{ backgroundColor: priorityMeta.bgSoft }}
      >
        <TaskPriorityIcon priority={priority} className="w-3.5 h-3.5" />
      </button>

      {/* 4. Échéance */}
      <DatePicker
        variant="icon-pill"
        size={size}
        markOverdue={markOverdue}
        disabled={disabled}
        value={dueDate}
        onChange={onChangeDueDate}
        ariaLabel="Date d'échéance"
      />

      {/* 5. Mise en avant réunion */}
      {showStar && (
        <button
          type="button"
          disabled={!canToggleStar}
          aria-pressed={isStarred}
          aria-label={
            isStarred
              ? canToggleStar
                ? 'Retirer la mise en avant'
                : 'Mise en avant pour la réunion'
              : 'Mettre en avant pour la réunion'
          }
          title={
            isStarred
              ? canToggleStar
                ? 'Mise en avant activée (cliquer pour retirer)'
                : 'Mise en avant pour la réunion'
              : 'Mettre en avant pour la réunion'
          }
          onClick={(e) => {
            e.stopPropagation();
            if (canToggleStar && onToggleStar) {
              onToggleStar();
            }
          }}
          className={`${pillSizeClass} rounded-full flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
            isStarred
              ? `bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning-accent)] ${
                  canToggleStar ? 'cursor-pointer active:scale-95 hover:opacity-85' : 'cursor-default'
                }`
              : 'bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-warning-accent)] cursor-pointer active:scale-95'
          }`}
        >
          <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-current' : ''}`} strokeWidth={2} />
        </button>
      )}

      {/* Popover Liquid Glass portaled dans document.body */}
      {openMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="fixed z-[80] cdh-glass-overlay rounded-cdh-xl p-1.5 animate-fade-in overflow-y-auto"
          >
            {openMenu === 'assignee' && (
              <>
                <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                  Responsable
                </div>
                <div role="listbox" aria-label="Responsable" className="max-h-52 overflow-y-auto space-y-0.5">
                  {allowUnassign && (
                    <button
                      type="button"
                      role="option"
                      aria-selected={assignedTo === ''}
                      onClick={() => {
                        onChangeAssignee('');
                        setOpenMenu(null);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-cdh-sm text-[12.5px] transition-colors cursor-pointer ${
                        assignedTo === ''
                          ? 'bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)] font-semibold'
                          : 'text-[var(--cdh-text-secondary)] hover:bg-[var(--cdh-surface-control)]'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <UserPlus className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                        <span className="truncate">À attribuer</span>
                      </span>
                      {assignedTo === '' && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />}
                    </button>
                  )}
                  {users.map((u) => {
                    const isSelected = assignedTo === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChangeAssignee(u.id);
                          setOpenMenu(null);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-cdh-sm text-[12.5px] transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] font-semibold'
                            : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)]'
                        }`}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Avatar initials={u.initials} color={u.avatar_color} size="xs" />
                          <span className="truncate">{u.name}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {openMenu === 'priority' && (
              <>
                <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                  Priorité
                </div>
                <div role="listbox" aria-label="Priorité" className="space-y-0.5">
                  {(['low', 'medium', 'high'] as TaskPriority[]).map((pr) => {
                    const meta = TASK_PRIORITY_META[pr];
                    const isSelected = priority === pr;
                    return (
                      <button
                        key={pr}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChangePriority(pr);
                          setOpenMenu(null);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-cdh-sm text-[12.5px] transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] font-semibold'
                            : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <TaskPriorityIcon priority={pr} className="w-3.5 h-3.5 shrink-0" />
                          <span>{meta.label}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />}
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
});
