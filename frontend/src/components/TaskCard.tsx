import React, { useCallback, useMemo, useState } from 'react';
import { Task, TaskPriority, TaskStatus, User } from '../types';
import { BlurredIconSwap } from './BlurredIconSwap';
import {
  Badge,
  ProgressBar,
  PropertyPill,
  TaskMetaBar,
  TaskOriginBadges,
  TaskSubtaskTree,
} from './ui';
import { buildSubtaskTree, calculateSubtaskStats } from '../utils/subtasks';
import { CheckSquare, ChevronDown, ChevronUp, Edit3, Trash2 } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  allUsers?: User[];
  currentUser?: User | null;
  isReadOnly?: boolean;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onToggleStar?: (taskId: number) => void;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: () => void;
  onDragOverCard?: (e: React.DragEvent, task: Task) => void;
  onDropOnCard?: (e: React.DragEvent, task: Task) => void;
  dropIndicator?: 'before' | 'after' | null;
  isDragging?: boolean;
}

const TaskCardComponent: React.FC<TaskCardProps> = ({
  task,
  allUsers = [],
  currentUser = null,
  isReadOnly = false,
  onEdit,
  onDelete,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onAssignTask,
  onQuickUpdateTask,
  onToggleStar,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
  dropIndicator,
  isDragging,
}) => {
  const [showSubtasks, setShowSubtasks] = useState(false);

  const canModify = !isReadOnly && !!task.can_edit;
  const canDelete = !isReadOnly && !!task.can_delete;
  const canStar = !isReadOnly && !!task.can_star;
  const isAdmin = currentUser?.role === 'admin';

  const assignableUsers = useMemo(
    () => allUsers.filter((u) => u.role !== 'read'),
    [allUsers]
  );

  const { total: totalSubtasks, done: doneSubtasksCount, percent: progressPercent } = useMemo(
    () => calculateSubtaskStats(task.subtasks),
    [task.subtasks]
  );

  const hierarchicalSubtasks = useMemo(
    () => (showSubtasks ? buildSubtaskTree(task.subtasks) : []),
    [showSubtasks, task.subtasks]
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
    (nextStatus: TaskStatus) => onUpdateStatus?.(task.id, nextStatus),
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
    <div
      className="relative cdh-card-slot"
      data-dragging-slot={isDragging ? 'true' : undefined}
    >
      {dropIndicator === 'before' && (
        <div className="pointer-events-none h-0.5 bg-[var(--cdh-accent)] rounded-full mb-1.5 shadow-sm animate-pulse motion-reduce:animate-none" />
      )}
      <div
        data-task-card-id={task.id}
        data-dragging={isDragging ? 'true' : undefined}
        draggable={canModify && !!onDragStart}
        onDragStart={(e) => canModify && onDragStart && onDragStart(e, task)}
        onDragEnd={() => onDragEnd && onDragEnd()}
        onDragOver={(e) => onDragOverCard && onDragOverCard(e, task)}
        onDrop={(e) => onDropOnCard && onDropOnCard(e, task)}
        className={`cdh-surface-card cdh-surface-card--lift rounded-cdh-lg p-3.5 group ${
          canModify && onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${isDragging ? 'opacity-45 scale-[0.98]' : ''} ${
          task.is_starred ? 'cdh-card-starred' : ''
        } ${!task.is_starred && task.status === 'blocked' ? 'cdh-card-blocked' : ''}`}
      >
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {task.property_name && (
              <PropertyPill name={task.property_name} color={task.property_color} />
            )}

            {task.status === 'blocked' && !!task.is_starred && (
              <Badge variant="danger" pill>
                Bloqué
              </Badge>
            )}

            {task.priority === 'high' && (
              <Badge variant="danger" pill>
                Urgent
              </Badge>
            )}
            {task.priority === 'low' && (
              <Badge variant="neutral" pill>
                Basse
              </Badge>
            )}

            <TaskOriginBadges isNew={task.is_new} isUnplanned={task.is_unplanned} />
          </div>

          {(canModify || canDelete) && (
            <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 sm:transition-opacity">
              {canModify && (
                <button
                  type="button"
                  onClick={() => onEdit(task)}
                  aria-label="Modifier la tâche"
                  className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 sm:p-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] rounded-cdh-sm hover:bg-[var(--cdh-surface-control)] active:scale-95 cursor-pointer transition-colors"
                  title="Modifier la tâche"
                >
                  <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" strokeWidth={1.75} />
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(task.id)}
                  aria-label="Supprimer la tâche"
                  className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 sm:p-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-danger)] rounded-cdh-sm hover:bg-[var(--cdh-danger-soft)] active:scale-95 cursor-pointer transition-colors"
                  title="Supprimer la tâche"
                >
                  <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Titre de la tâche */}
        {canModify ? (
          <h4 className="m-0">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className={`w-full text-left font-semibold text-[13.5px] leading-snug [text-wrap:balance] transition-colors break-words hover:text-[var(--cdh-accent)] cursor-pointer ${
                task.status === 'done'
                  ? 'line-through text-[var(--cdh-text-secondary)]'
                  : 'text-[var(--cdh-text-primary)]'
              }`}
            >
              {task.title}
            </button>
          </h4>
        ) : (
          <h4
            className={`font-semibold text-[13.5px] leading-snug [text-wrap:balance] break-words ${
              task.status === 'done'
                ? 'line-through text-[var(--cdh-text-secondary)]'
                : 'text-[var(--cdh-text-primary)]'
            }`}
          >
            {task.title}
          </h4>
        )}

        {/* Description / Remarques */}
        {task.description && (
          <p className="mt-2 pt-2 border-t border-[var(--cdh-border-hairline)] text-[12px] text-[var(--cdh-text-secondary)] leading-relaxed break-words">
            <span className="text-[var(--cdh-accent)] font-semibold mr-1">→</span>
            {task.description}
          </p>
        )}

        {/* Sous-tâches Checklist hiérarchique */}
        {totalSubtasks > 0 && (
          <div className="mt-3 pt-2.5 border-t border-[var(--cdh-border-hairline)]">
            <button
              type="button"
              aria-expanded={showSubtasks}
              onClick={() => setShowSubtasks(!showSubtasks)}
              className="w-full flex items-center justify-between text-xs text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] font-medium cursor-pointer"
            >
              <span className="flex items-center gap-1.5 tabular-nums">
                <CheckSquare className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
                Sous-tâches ({doneSubtasksCount}/{totalSubtasks})
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold tabular-nums">{progressPercent}%</span>
                <BlurredIconSwap
                  active={showSubtasks}
                  activeIcon={<ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} />}
                  inactiveIcon={<ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />}
                />
              </div>
            </button>

            <ProgressBar value={progressPercent} label="Sous-tâches" className="mt-1.5" />

            {showSubtasks && (
              <div className="mt-2.5 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                <TaskSubtaskTree
                  taskId={task.id}
                  nodes={hierarchicalSubtasks}
                  canModify={canModify}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  compact
                />
              </div>
            )}
          </div>
        )}

        {/* Footer : Barre d'icônes unifiée */}
        <div
          className="mt-3 pt-2.5 border-t border-[var(--cdh-border-hairline)] flex items-center justify-between gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <TaskMetaBar
            size="sm"
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
        </div>
      </div>
      {dropIndicator === 'after' && (
        <div className="pointer-events-none h-0.5 bg-[var(--cdh-accent)] rounded-full mt-1.5 shadow-sm animate-pulse motion-reduce:animate-none" />
      )}
    </div>
  );
};

export const TaskCard = React.memo(TaskCardComponent);
