import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Task, TaskPriority, TaskStatus, User } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import {
  CreatedTaskBatch,
  getScrollBehavior,
  scrollContainersAndHighlightTasks,
} from '../utils/taskMotion';
import { TaskStatusIcon } from './ui';
import { Plus, EyeOff } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  allUsers?: User[];
  currentUser: User | null;
  hiddenStatuses?: TaskStatus[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onReorderTask?: (taskId: number, targetStatus: TaskStatus, orderedColumnTaskIds: number[]) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask: (initialStatus?: TaskStatus) => void;
  canAddTasks?: boolean;
  isReadOnly: boolean;
  lastCreatedBatch?: CreatedTaskBatch | null;
  isModalOpen?: boolean;
  onConsumeCreatedBatch?: () => void;
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'À faire' },
  { id: 'in_progress', title: 'En cours' },
  { id: 'blocked', title: 'Bloqué' },
  { id: 'done', title: 'Terminé' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  allUsers = [],
  currentUser,
  hiddenStatuses = [],
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onAssignTask,
  onQuickUpdateTask,
  onReorderTask,
  onToggleStar,
  onAddNewTask,
  canAddTasks,
  isReadOnly,
  lastCreatedBatch,
  isModalOpen = false,
  onConsumeCreatedBatch
}) => {
  const showQuickAddButtons =
    canAddTasks !== undefined ? canAddTasks : (!isReadOnly && currentUser?.role === 'admin');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const visibleColumns = useMemo(
    () => COLUMNS.filter(col => !hiddenStatuses.includes(col.id)),
    [hiddenStatuses]
  );

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const t of tasks) {
      const normalized: TaskStatus = t.status === 'pending' ? 'todo' : t.status;
      grouped[normalized].push(t);
    }
    return grouped;
  }, [tasks]);

  const getContainerId = useCallback(
    (t: Task): TaskStatus => (t.status === 'pending' ? 'todo' : t.status),
    []
  );

  const handleDropReorder = useCallback(
    (draggedTask: Task, targetStatus: TaskStatus, orderedColumnTaskIds: number[]) => {
      if (onReorderTask) {
        onReorderTask(draggedTask.id, targetStatus, orderedColumnTaskIds);
      } else if (draggedTask.status !== targetStatus) {
        onUpdateStatus(draggedTask.id, targetStatus);
      }
    },
    [onReorderTask, onUpdateStatus]
  );

  const {
    draggedTaskId,
    activeDropContainer,
    dropTarget,
    resetDragState,
    handleDragStart,
    handleDragOverContainer,
    handleDragLeaveContainer,
    handleDragOverCard,
    handleDropOnCard,
    handleDropOnContainer
  } = useCardDragAndDrop<TaskStatus>({
    tasks,
    getContainerId,
    isReadOnly,
    onDropReorder: handleDropReorder,
  });

  const getGridClass = (count: number) => {
    if (count <= 1) return 'md:grid-cols-1';
    if (count === 2) return 'md:grid-cols-2';
    if (count === 3) return 'md:grid-cols-2 lg:grid-cols-3';
    return 'md:grid-cols-2 lg:grid-cols-4';
  };

  useEffect(() => {
    if (!lastCreatedBatch || isModalOpen) return;

    const targetStatus: TaskStatus =
      lastCreatedBatch.status === 'pending' ? 'todo' : lastCreatedBatch.status;
    const colIdx = visibleColumns.findIndex((c) => c.id === targetStatus);
    const hasVisibleTask = tasks.some((t) => lastCreatedBatch.ids.includes(t.id));
    const batchIds = lastCreatedBatch.ids;

    onConsumeCreatedBatch?.();
    if (colIdx === -1 || !hasVisibleTask) return;

    const isMobile = window.innerWidth < 768;
    const container = scrollContainerRef.current;
    if (isMobile && container) {
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      const targetLeft =
        visibleColumns.length > 1
          ? Math.round((colIdx / (visibleColumns.length - 1)) * maxScroll)
          : 0;
      container.scrollTo({ left: targetLeft, behavior: getScrollBehavior() });
    }

    const rafId = window.requestAnimationFrame(() => {
      const colScrollEl = document.querySelector<HTMLElement>(
        `[data-kanban-col-scroll="${targetStatus}"]`
      );
      scrollContainersAndHighlightTasks({
        horizontalEl: isMobile ? container : null,
        verticalEl: colScrollEl,
        taskIds: batchIds,
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [lastCreatedBatch, isModalOpen, tasks, visibleColumns, onConsumeCreatedBatch]);

  if (visibleColumns.length === 0) {
    return (
      <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center">
        <EyeOff className="w-8 h-8 mx-auto mb-2.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-[var(--cdh-text-primary)]">
          Tous les statuts sont actuellement masqués.
        </p>
        <p className="text-xs text-[var(--cdh-text-secondary)] mt-1">
          Sélectionnez au moins un statut dans le filtre « Statuts » ci-dessus.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollContainerRef}
        className={`flex-1 min-h-0 flex md:grid ${getGridClass(visibleColumns.length)} gap-3.5 sm:gap-4 items-stretch overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory -mx-3 px-3 sm:mx-0 sm:px-0`}
      >
        {visibleColumns.map((col) => {
          const colTasks = tasksByStatus[col.id];
          const isHovered = activeDropContainer === col.id;

          return (
            <div
              key={col.id}
              id={`kanban-col-${col.id}`}
              onDragOver={(e) => handleDragOverContainer(e, col.id)}
              onDragLeave={handleDragLeaveContainer}
              onDrop={(e) => handleDropOnContainer(e, col.id)}
              className={`cdh-glass-column flex flex-col rounded-cdh-2xl p-3 sm:p-3.5 h-full min-h-0 w-[calc(100vw-2.25rem)] max-w-[360px] md:max-w-none md:w-auto shrink-0 snap-center md:shrink transition-[border-color,box-shadow] duration-200 ${
                isHovered
                  ? 'ring-2 ring-[var(--cdh-accent)]/50 border-[var(--cdh-accent)]'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between px-1.5 pb-2.5 mb-1 border-b border-[var(--cdh-border-hairline)] shrink-0">
                <h3 className="flex items-center gap-2 min-w-0">
                  <TaskStatusIcon status={col.id} className="w-4 h-4 shrink-0" />
                  <span className="font-semibold text-[13px] tracking-[-0.01em] text-[var(--cdh-text-primary)] truncate">
                    {col.title}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold tabular-nums bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]">
                    {colTasks.length}
                  </span>
                </h3>

                {showQuickAddButtons && (
                  <button
                    type="button"
                    onClick={() => onAddNewTask(col.id)}
                    aria-label={`Ajouter dans ${col.title}`}
                    className="p-1.5 text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] rounded-full transition-colors cursor-pointer"
                    title={`Ajouter dans "${col.title}"`}
                  >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                  </button>
                )}
              </div>

              <div
                data-kanban-col-scroll={col.id}
                className="space-y-2.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2.5 -mx-2.5 pt-2.5 pb-4"
              >
                {colTasks.length > 0 ? (
                  colTasks.map((task) => {
                    const indicator =
                      dropTarget?.containerId === col.id && dropTarget?.taskId === task.id
                        ? dropTarget.position
                        : null;
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        allUsers={allUsers}
                        currentUser={currentUser}
                        isReadOnly={isReadOnly}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onToggleSubtask={onToggleSubtask}
                        onAddSubtask={onAddSubtask}
                        onUpdateStatus={onUpdateStatus}
                        onAssignTask={onAssignTask}
                        onQuickUpdateTask={onQuickUpdateTask}
                        onToggleStar={onToggleStar}
                        onDragStart={handleDragStart}
                        onDragEnd={resetDragState}
                        onDragOverCard={(e, t) => handleDragOverCard(e, t, col.id)}
                        onDropOnCard={(e, t) => handleDropOnCard(e, t, col.id)}
                        dropIndicator={indicator}
                        isDragging={draggedTaskId === task.id}
                      />
                    );
                  })
                ) : (
                  <p
                    className={`py-10 px-3 text-center text-xs text-[var(--cdh-text-tertiary)] font-medium select-none transition-colors rounded-cdh-lg ${
                      isHovered
                        ? 'border-2 border-dashed border-[var(--cdh-accent)] bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
                        : 'border border-dashed border-[var(--cdh-border-hairline)]'
                    }`}
                  >
                    {isReadOnly || currentUser?.role === 'read' ? 'Aucune tâche' : 'Déposer une tâche ici'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
