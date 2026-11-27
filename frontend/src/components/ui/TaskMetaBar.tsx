import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, UserPlus } from 'lucide-react';
import { TaskPriority, TaskStatus, User } from '../../types';
import { Avatar } from './Avatar';
import { DatePicker } from './DatePicker';
import { computePopoverPosition, PopoverStylePosition, toPopoverStyle } from './popoverPosition';
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TaskPriorityIcon,
  TaskStatusIcon,
} from './TaskIcons';

type ActivePopover = 'assignee' | 'status' | 'priority' | null;

export interface TaskMetaBarProps {
  users: User[];
  assignedTo: number | '';
  onChangeAssignee: (userId: number | '') => void;
  showAssignee?: boolean;
  status: TaskStatus;
  onChangeStatus: (status: TaskStatus) => void;
  priority: TaskPriority;
  onChangePriority: (priority: TaskPriority) => void;
  dueDate: string;
  onChangeDueDate: (date: string) => void;
}

/**
 * Barre d'icônes unifiée Apple Liquid Glass pour piloter les métadonnées d'une tâche
 * (Responsable pour admin, Statut, Priorité, Échéance) en un clic depuis le footer de modale.
 */
export const TaskMetaBar: React.FC<TaskMetaBarProps> = ({
  users,
  assignedTo,
  onChangeAssignee,
  showAssignee = true,
  status,
  onChangeStatus,
  priority,
  onChangePriority,
  dueDate,
  onChangeDueDate,
}) => {
  const [openMenu, setOpenMenu] = useState<ActivePopover>(null);
  const [menuPos, setMenuPos] = useState<PopoverStylePosition>({ bottom: 0, left: 0, maxHeight: 300 });

  const assigneeBtnRef = useRef<HTMLButtonElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const selectedUser = users.find((u) => u.id === assignedTo) || null;
  const statusMeta = TASK_STATUS_META[status];
  const priorityMeta = TASK_PRIORITY_META[priority];

  const computeMenuPosition = (btn: HTMLButtonElement | null): PopoverStylePosition =>
    computePopoverPosition(btn, {
      width: 220,
      preferredPlacement: 'above',
      minSpaceNeeded: 200,
      gap: 8,
      viewportPadding: 8
    });

  const openPopoverFor = (type: Exclude<ActivePopover, null>, btn: HTMLButtonElement | null) => {
    if (openMenu === type) {
      setOpenMenu(null);
      return;
    }
    if (btn) {
      setMenuPos(computeMenuPosition(btn));
    }
    setOpenMenu(type);
  };

  useEffect(() => {
    if (!openMenu) return;

    const handleResize = () => {
      const activeBtn =
        openMenu === 'assignee'
          ? assigneeBtnRef.current
          : openMenu === 'status'
            ? statusBtnRef.current
            : priorityBtnRef.current;
      if (activeBtn) {
        setMenuPos(computeMenuPosition(activeBtn));
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current?.contains(target) ||
        assigneeBtnRef.current?.contains(target) ||
        statusBtnRef.current?.contains(target) ||
        priorityBtnRef.current?.contains(target)
      ) {
        return;
      }
      setOpenMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setOpenMenu(null);
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
  }, [openMenu]);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* 1. Responsable (visible uniquement pour les administrateurs) */}
      {showAssignee && (
        <button
          ref={assigneeBtnRef}
          type="button"
          aria-expanded={openMenu === 'assignee'}
          aria-label={selectedUser ? `Responsable : ${selectedUser.name}` : 'Choisir un responsable'}
          title={selectedUser ? `Responsable : ${selectedUser.name}` : 'Choisir un responsable'}
          onClick={() => openPopoverFor('assignee', assigneeBtnRef.current)}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer hover:ring-2 hover:ring-[var(--cdh-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
            !selectedUser
              ? 'bg-[var(--cdh-warning-soft)] text-[var(--cdh-warning)]'
              : 'bg-[var(--cdh-surface-control)]'
          }`}
        >
          {selectedUser ? (
            <Avatar
              initials={selectedUser.initials}
              name={selectedUser.name}
              color={selectedUser.avatar_color}
              size="sm"
            />
          ) : (
            <UserPlus className="w-3.5 h-3.5" strokeWidth={2} />
          )}
        </button>
      )}

      {/* 2. Statut */}
      <button
        ref={statusBtnRef}
        type="button"
        aria-expanded={openMenu === 'status'}
        aria-label={`Statut : ${statusMeta.label}`}
        title={`Statut : ${statusMeta.label}`}
        onClick={() => openPopoverFor('status', statusBtnRef.current)}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)]"
        style={{ backgroundColor: statusMeta.bgSoft }}
      >
        <TaskStatusIcon status={status} className="w-3.5 h-3.5" />
      </button>

      {/* 3. Priorité */}
      <button
        ref={priorityBtnRef}
        type="button"
        aria-expanded={openMenu === 'priority'}
        aria-label={`Priorité : ${priorityMeta.label}`}
        title={`Priorité : ${priorityMeta.label}`}
        onClick={() => openPopoverFor('priority', priorityBtnRef.current)}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)]"
        style={{ backgroundColor: priorityMeta.bgSoft }}
      >
        <TaskPriorityIcon priority={priority} className="w-3.5 h-3.5" />
      </button>

      {/* 4. Échéance (icône calendrier -> pilule date au choix, rouge si dépassée) */}
      <DatePicker
        variant="icon-pill"
        value={dueDate}
        onChange={onChangeDueDate}
        ariaLabel="Date d'échéance"
      />

      {/* Popover Liquid Glass portaled dans document.body */}
      {openMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            style={toPopoverStyle(menuPos, 220)}
            className="fixed z-[80] cdh-glass-overlay rounded-cdh-xl p-1.5 animate-fade-in space-y-0.5 overflow-y-auto"
          >
            {openMenu === 'assignee' && (
              <>
                <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                  Responsable
                </div>
                <div className="max-h-52 overflow-y-auto space-y-0.5">
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

            {openMenu === 'status' && (
              <>
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
                      onClick={() => {
                        onChangeStatus(st);
                        setOpenMenu(null);
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
              </>
            )}

            {openMenu === 'priority' && (
              <>
                <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                  Priorité
                </div>
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
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
