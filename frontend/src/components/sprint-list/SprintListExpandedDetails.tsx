import React, { useCallback, useMemo } from 'react';
import { CheckSquare, Clock, Edit3, Trash2 } from 'lucide-react';
import { Task, TaskPriority, TaskStatus, User } from '../../types';
import { buildSubtaskTree, calculateSubtaskStats } from '../../utils/subtasks';
import { formatShortDate } from '../../utils/taskSort';
import { ProgressBar, TaskMetaBar, TaskSubtaskTree } from '../ui';

interface SprintListExpandedDetailsProps {
  task: Task;
  isMobile: boolean;
  isAdmin: boolean;
  isReadOnly: boolean;
  assignableUsers: User[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onToggleStar?: (taskId: number) => void;
}

/**
 * Contenu dépliable d'une tâche dans la vue Tableau (monté uniquement quand la carte est ouverte).
 */
export const SprintListExpandedDetails: React.FC<SprintListExpandedDetailsProps> = React.memo(
  ({
    task,
    isMobile,
    isAdmin,
    isReadOnly,
    assignableUsers,
    onEditTask,
    onDeleteTask,
    onToggleSubtask,
    onAddSubtask,
    onUpdateStatus,
    onAssignTask,
    onQuickUpdateTask,
    onToggleStar,
  }) => {
    const canModify = !isReadOnly && !!task.can_edit;
    const canDelete = !isReadOnly && !!task.can_delete;
    const canStar = !isReadOnly && !!task.can_star;

    const { total, done, percent } = useMemo(
      () => calculateSubtaskStats(task.subtasks),
      [task.subtasks]
    );
    const hierarchicalSubtasks = useMemo(
      () => (total > 0 ? buildSubtaskTree(task.subtasks) : []),
      [total, task.subtasks]
    );

    const fallbackAssignee = useMemo(
      () => ({
        name: task.assigned_to_name,
        initials: task.assigned_to_initials,
        color: task.assigned_to_color,
      }),
      [task.assigned_to_name, task.assigned_to_initials, task.assigned_to_color]
    );

    const handleChangeAssignee = useCallback(
      (userId: number | '') => onAssignTask?.(task.id, userId === '' ? null : userId),
      [onAssignTask, task.id]
    );
    const handleChangeStatus = useCallback(
      (nextStatus: TaskStatus) => onUpdateStatus(task.id, nextStatus),
      [onUpdateStatus, task.id]
    );
    const handleChangePriority = useCallback(
      (nextPriority: TaskPriority) => onQuickUpdateTask?.(task.id, { priority: nextPriority }),
      [onQuickUpdateTask, task.id]
    );
    const handleChangeDueDate = useCallback(
      (nextDate: string) => onQuickUpdateTask?.(task.id, { due_date: nextDate || null }),
      [onQuickUpdateTask, task.id]
    );
    const handleToggleStar = useCallback(() => onToggleStar?.(task.id), [onToggleStar, task.id]);

    return (
      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        <div
          className={`grid gap-4 ${
            isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'
          }`}
        >
          {/* Colonne 1 : Description + méta création */}
          <div className="space-y-2.5 min-w-0">
            {task.description ? (
              <p className="text-[12.5px] text-[var(--cdh-text-secondary)] leading-relaxed break-words">
                <span className="text-[var(--cdh-accent)] font-semibold mr-1.5">→</span>
                {task.description}
              </p>
            ) : (
              <p className="text-[12px] italic text-[var(--cdh-text-tertiary)]">
                Aucune description renseignée pour cette tâche.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--cdh-text-secondary)]">
              {task.created_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)]" strokeWidth={2} />
                  <span>
                    Créée le{' '}
                    <strong className="font-mono font-semibold text-[var(--cdh-text-primary)]">
                      {formatShortDate(task.created_at)}
                    </strong>
                    {task.created_by_name ? ` par ${task.created_by_name}` : ''}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Colonne 2 : Sous-tâches hiérarchiques */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--cdh-text-secondary)]">
              <span className="flex items-center gap-1.5 tabular-nums">
                <CheckSquare className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
                Sous-tâches ({done}/{total})
              </span>
              {total > 0 && <span className="text-[11px] font-semibold tabular-nums">{percent}%</span>}
            </div>

            {total > 0 ? (
              <>
                <ProgressBar value={percent} label="Sous-tâches" />
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1 pt-0.5">
                  <TaskSubtaskTree
                    taskId={task.id}
                    nodes={hierarchicalSubtasks}
                    canModify={canModify}
                    onToggleSubtask={onToggleSubtask}
                    onAddSubtask={onAddSubtask}
                    compact
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--cdh-text-tertiary)]">
                Aucune sous-étape pour cette tâche.
              </p>
            )}
          </div>
        </div>

        {/* Footer unifié : TaskMetaBar + Modifier / Supprimer */}
        <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] flex flex-wrap items-center justify-between gap-2.5">
          <TaskMetaBar
            size={isMobile ? 'md' : 'sm'}
            users={assignableUsers}
            assignedTo={task.assigned_to ?? ''}
            onChangeAssignee={handleChangeAssignee}
            showAssignee={true}
            assigneeEditable={isAdmin && canModify && !!onAssignTask}
            allowUnassign={true}
            fallbackAssignee={fallbackAssignee}
            status={task.status === 'pending' ? 'todo' : task.status}
            onChangeStatus={handleChangeStatus}
            priority={task.priority || 'medium'}
            onChangePriority={handleChangePriority}
            dueDate={task.due_date || ''}
            onChangeDueDate={handleChangeDueDate}
            markOverdue={task.status !== 'done'}
            disabled={!canModify}
            showStar={canStar || !!task.is_starred}
            isStarred={!!task.is_starred}
            canToggleStar={canStar && !!onToggleStar}
            onToggleStar={handleToggleStar}
          />

          {(canModify || canDelete) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {canModify && (
                <button
                  type="button"
                  onClick={() => onEditTask(task)}
                  aria-label="Modifier la tâche"
                  title="Modifier la tâche"
                  className="inline-flex items-center justify-center p-2 min-w-[38px] min-h-[38px] sm:min-w-[32px] sm:min-h-[32px] sm:p-1.5 rounded-cdh-md bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-info)] transition-all active:scale-95 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                  aria-label="Supprimer la tâche"
                  title="Supprimer la tâche"
                  className="inline-flex items-center justify-center p-2 min-w-[38px] min-h-[38px] sm:min-w-[32px] sm:min-h-[32px] sm:p-1.5 rounded-cdh-md bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-danger-soft)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-danger)] transition-all active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

SprintListExpandedDetails.displayName = 'SprintListExpandedDetails';
