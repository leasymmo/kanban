import React, { useMemo } from 'react';
import { Calendar, CheckSquare, ChevronDown, ChevronRight, Star } from 'lucide-react';
import { Task, TaskPriority, TaskStatus, User } from '../../types';
import { TaskListColumnId } from '../../utils/cookies';
import { calculateSubtaskStats, isTaskOverdue } from '../../utils/subtasks';
import { formatShortDate } from '../../utils/taskSort';
import { ensureWhiteTextContrast } from '../../utils/color';
import { SprintListColumnConfig } from '../../hooks/useSprintListPrefs';
import {
  Avatar,
  ProgressBar,
  PropertyPill,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TaskOriginBadges,
  TaskPriorityIcon,
} from '../ui';
import { SprintListExpandedDetails } from './SprintListExpandedDetails';

interface SprintListTaskItemProps {
  task: Task;
  isDesktop: boolean;
  isExpanded: boolean;
  mountDetails: boolean;
  visibleColumns: TaskListColumnId[];
  activeColumns: SprintListColumnConfig[];
  desktopGridTemplate: string;
  isAdmin: boolean;
  isReadOnly: boolean;
  assignableUsers: User[];
  onToggleExpand: (taskId: number) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onToggleStar?: (taskId: number) => void;
}

function getPriorityShortLabel(priority: TaskPriority): string {
  return priority === 'high' ? 'Urgent' : priority === 'low' ? 'Basse' : 'Normale';
}

export const SprintListTaskItem: React.FC<SprintListTaskItemProps> = React.memo(
  ({
    task,
    isDesktop,
    isExpanded,
    mountDetails,
    visibleColumns,
    activeColumns,
    desktopGridTemplate,
    isAdmin,
    isReadOnly,
    assignableUsers,
    onToggleExpand,
    onEditTask,
    onDeleteTask,
    onToggleSubtask,
    onAddSubtask,
    onUpdateStatus,
    onAssignTask,
    onQuickUpdateTask,
    onToggleStar,
  }) => {
    const normalizedStatus: TaskStatus = task.status === 'pending' ? 'todo' : task.status;
    const statusMeta = TASK_STATUS_META[normalizedStatus] ?? TASK_STATUS_META.todo;
    const priorityMeta = TASK_PRIORITY_META[task.priority || 'medium'] ?? TASK_PRIORITY_META.medium;
    const overdue = isTaskOverdue(task.due_date, task.status);
    const subtaskStats = useMemo(() => calculateSubtaskStats(task.subtasks), [task.subtasks]);

    const renderDesktopCell = (colId: TaskListColumnId) => {
      switch (colId) {
        case 'status':
          return (
            <span className="min-w-0 flex items-center">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                style={{ backgroundColor: statusMeta.bgSoft, color: statusMeta.color }}
              >
                <span
                  aria-hidden="true"
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusMeta.color }}
                />
                {statusMeta.label}
              </span>
            </span>
          );

        case 'title':
          return (
            <span className="min-w-0 flex items-center gap-2">
              <span
                className={`font-semibold text-[13.5px] leading-snug truncate ${
                  task.status === 'done'
                    ? 'line-through text-[var(--cdh-text-secondary)]'
                    : 'text-[var(--cdh-text-primary)]'
                }`}
              >
                {task.title}
              </span>
              <TaskOriginBadges isNew={task.is_new} isUnplanned={task.is_unplanned} />
            </span>
          );

        case 'property':
          return task.property_name ? (
            <span className="min-w-0 flex items-center">
              <PropertyPill name={task.property_name} color={task.property_color} />
            </span>
          ) : (
            <span className="text-[12px] text-[var(--cdh-text-secondary)] truncate">
              Sans logement
            </span>
          );

        case 'priority':
          return (
            <span className="min-w-0 flex items-center">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                style={{ backgroundColor: priorityMeta.bgSoft, color: priorityMeta.color }}
              >
                <TaskPriorityIcon priority={task.priority || 'medium'} className="w-3 h-3 shrink-0" />
                <span>{getPriorityShortLabel(task.priority || 'medium')}</span>
              </span>
            </span>
          );

        case 'assignee': {
          if (!task.assigned_to || !task.assigned_to_initials) {
            return (
              <span className="text-[11.5px] font-semibold text-[var(--cdh-warning)] truncate">
                À attribuer
              </span>
            );
          }
          const firstName = (task.assigned_to_name || 'Associé').split(' ')[0];
          return (
            <span className="min-w-0 flex items-center gap-2">
              <Avatar
                initials={task.assigned_to_initials}
                name={task.assigned_to_name}
                color={ensureWhiteTextContrast(task.assigned_to_color)}
                size="sm"
              />
              <span className="text-[12px] font-medium text-[var(--cdh-text-primary)] truncate">
                {firstName}
              </span>
            </span>
          );
        }

        case 'due_date':
          return task.due_date ? (
            <span
              className={`inline-flex items-center gap-1 text-[12px] tabular-nums font-mono whitespace-nowrap ${
                overdue ? 'font-bold text-[var(--cdh-danger)]' : 'font-medium text-[var(--cdh-text-secondary)]'
              }`}
            >
              <Calendar className="w-3 h-3 shrink-0" strokeWidth={2} />
              <span>{formatShortDate(task.due_date)}</span>
            </span>
          ) : (
            <span className="text-[12px] text-[var(--cdh-text-secondary)]">—</span>
          );

        case 'subtasks':
          if (subtaskStats.total === 0) {
            return <span className="text-[12px] text-[var(--cdh-text-secondary)]">—</span>;
          }
          return (
            <span className="flex flex-col gap-1 min-w-0">
              <span className="flex items-center justify-between text-[11px] font-semibold tabular-nums text-[var(--cdh-text-secondary)]">
                <span>
                  {subtaskStats.done}/{subtaskStats.total}
                </span>
                <span>{subtaskStats.percent}%</span>
              </span>
              <ProgressBar value={subtaskStats.percent} label="Sous-tâches" />
            </span>
          );

        case 'created_at':
          return (
            <span className="text-[11.5px] tabular-nums font-mono text-[var(--cdh-text-secondary)] whitespace-nowrap">
              {task.created_at ? formatShortDate(task.created_at) : '—'}
            </span>
          );
      }
    };

    const hasMobileChips =
      visibleColumns.includes('status') ||
      (visibleColumns.includes('property') && !!task.property_name) ||
      visibleColumns.includes('priority') ||
      (visibleColumns.includes('due_date') && !!task.due_date) ||
      (visibleColumns.includes('subtasks') && subtaskStats.total > 0) ||
      visibleColumns.includes('created_at') ||
      visibleColumns.includes('assignee');

    return (
      <article
        data-task-card-id={task.id}
        data-expanded={isExpanded}
        className={`cdh-surface-card rounded-cdh-lg overflow-hidden ${
          task.is_starred ? 'cdh-card-starred' : ''
        } ${!task.is_starred && task.status === 'blocked' ? 'cdh-card-blocked' : ''} ${
          isExpanded
            ? 'ring-1 ring-[var(--cdh-accent)]/35 shadow-cdh-card-hover bg-[var(--cdh-surface-card-hover)]'
            : ''
        }`}
      >
        {isDesktop ? (
          <button
            type="button"
            onClick={() => onToggleExpand(task.id)}
            aria-expanded={isExpanded}
            className="w-full text-left px-3.5 py-2.5 min-h-[44px] grid items-center gap-2.5 cursor-pointer transition-colors"
            style={{ gridTemplateColumns: desktopGridTemplate }}
          >
            <span
              className={`flex items-center justify-center transition-transform duration-200 ${
                isExpanded ? 'rotate-90 text-[var(--cdh-info)]' : 'text-[var(--cdh-text-tertiary)]'
              }`}
              aria-hidden="true"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </span>

            {activeColumns.map((col) => (
              <React.Fragment key={col.id}>{renderDesktopCell(col.id)}</React.Fragment>
            ))}

            <span className="flex justify-end">
              {task.is_starred ? (
                <Star
                  className="w-3.5 h-3.5 text-[var(--cdh-warning-accent)] fill-current"
                  strokeWidth={2}
                  aria-label="Mise en avant pour la réunion"
                />
              ) : null}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleExpand(task.id)}
            aria-expanded={isExpanded}
            className="w-full text-left p-3.5 flex flex-col gap-2 cursor-pointer"
          >
            <span className="flex items-start justify-between gap-2 w-full">
              <span
                className={`font-semibold text-[14px] leading-snug break-words ${
                  task.status === 'done'
                    ? 'line-through text-[var(--cdh-text-secondary)]'
                    : 'text-[var(--cdh-text-primary)]'
                }`}
              >
                {task.title}
              </span>
              <span className="flex items-center gap-1 shrink-0 mt-0.5">
                {task.is_starred ? (
                  <Star
                    className="w-3.5 h-3.5 text-[var(--cdh-warning-accent)] fill-current"
                    strokeWidth={2}
                    aria-label="Mise en avant pour la réunion"
                  />
                ) : null}
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180 text-[var(--cdh-info)]' : 'text-[var(--cdh-text-tertiary)]'
                  }`}
                  strokeWidth={2}
                />
              </span>
            </span>

            {hasMobileChips && (
              <span className="flex items-center flex-wrap gap-1.5 w-full">
                {visibleColumns.includes('status') && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
                    style={{ backgroundColor: statusMeta.bgSoft, color: statusMeta.color }}
                  >
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: statusMeta.color }}
                    />
                    {statusMeta.label}
                  </span>
                )}

                {visibleColumns.includes('property') && task.property_name && (
                  <PropertyPill
                    name={task.property_name}
                    color={task.property_color}
                    className="text-[10.5px]"
                  />
                )}

                {visibleColumns.includes('priority') && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
                    style={{ backgroundColor: priorityMeta.bgSoft, color: priorityMeta.color }}
                  >
                    <TaskPriorityIcon priority={task.priority || 'medium'} className="w-3 h-3 shrink-0" />
                    <span>{getPriorityShortLabel(task.priority || 'medium')}</span>
                  </span>
                )}

                {visibleColumns.includes('due_date') && task.due_date && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono tabular-nums ${
                      overdue ? 'font-bold text-[var(--cdh-danger)]' : 'font-medium text-[var(--cdh-text-secondary)]'
                    }`}
                  >
                    <Calendar className="w-3 h-3 shrink-0" strokeWidth={2} />
                    {formatShortDate(task.due_date)}
                  </span>
                )}

                {visibleColumns.includes('subtasks') && subtaskStats.total > 0 && (
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-mono tabular-nums font-semibold ${
                      subtaskStats.percent === 100
                        ? 'text-[var(--cdh-success)]'
                        : 'text-[var(--cdh-text-secondary)]'
                    }`}
                  >
                    <CheckSquare className="w-3 h-3 shrink-0" strokeWidth={2} />
                    {subtaskStats.done}/{subtaskStats.total}
                  </span>
                )}

                {visibleColumns.includes('created_at') && task.created_at && (
                  <span className="text-[10.5px] font-mono tabular-nums text-[var(--cdh-text-secondary)]">
                    Créée {formatShortDate(task.created_at)}
                  </span>
                )}

                {visibleColumns.includes('assignee') && (
                  <span className="ml-auto shrink-0">
                    {task.assigned_to && task.assigned_to_initials ? (
                      <Avatar
                        initials={task.assigned_to_initials}
                        name={task.assigned_to_name}
                        color={ensureWhiteTextContrast(task.assigned_to_color)}
                        size="xs"
                      />
                    ) : (
                      <span className="text-[10.5px] font-semibold text-[var(--cdh-warning)]">
                        À attribuer
                      </span>
                    )}
                  </span>
                )}
              </span>
            )}
          </button>
        )}

        <div
          className="cdh-accordion-panel"
          data-open={isExpanded}
          {...(!isExpanded ? ({ inert: '' } as React.HTMLAttributes<HTMLDivElement>) : {})}
        >
          <div className="cdh-accordion-inner">
            <div
              className={`cdh-accordion-content border-t border-[var(--cdh-border-hairline)] ${
                isDesktop ? 'px-4 pb-3.5 pt-3 pl-[48px]' : 'p-3.5'
              }`}
            >
              {mountDetails && (
                <SprintListExpandedDetails
                  task={task}
                  isMobile={!isDesktop}
                  isAdmin={isAdmin}
                  isReadOnly={isReadOnly}
                  assignableUsers={assignableUsers}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  onToggleSubtask={onToggleSubtask}
                  onAddSubtask={onAddSubtask}
                  onUpdateStatus={onUpdateStatus}
                  onAssignTask={onAssignTask}
                  onQuickUpdateTask={onQuickUpdateTask}
                  onToggleStar={onToggleStar}
                />
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }
);

SprintListTaskItem.displayName = 'SprintListTaskItem';
