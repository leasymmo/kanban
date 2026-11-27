import React, { useState, useRef } from 'react';
import { Task, TaskStatus, User } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import { Plus, EyeOff } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  currentUser: User | null;
  hiddenStatuses?: TaskStatus[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
  onReorderTask?: (taskId: number, targetStatus: TaskStatus, orderedColumnTaskIds: number[]) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask: (initialStatus?: TaskStatus) => void;
  canAddTasks?: boolean;
  isReadOnly: boolean;
}

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  dotColor: string;
}

const COLUMNS: ColumnConfig[] = [
  { id: 'todo', title: 'À faire', dotColor: 'var(--cdh-status-todo-dot)' },
  { id: 'in_progress', title: 'En cours', dotColor: 'var(--cdh-status-progress-dot)' },
  { id: 'blocked', title: 'Bloqué / Litige', dotColor: 'var(--cdh-status-blocked-dot)' },
  { id: 'done', title: 'Terminé', dotColor: 'var(--cdh-status-done-dot)' }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  currentUser,
  hiddenStatuses = [],
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onReorderTask,
  onToggleStar,
  onAddNewTask,
  canAddTasks,
  isReadOnly
}) => {
  const showQuickAddButtons =
    canAddTasks !== undefined ? canAddTasks : (!isReadOnly && currentUser?.role === 'admin');
  const [activeMobileColumn, setActiveMobileColumn] = useState<TaskStatus>('todo');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const visibleColumns = COLUMNS.filter(col => !hiddenStatuses.includes(col.id));
  const effectiveMobileColumn = visibleColumns.some(c => c.id === activeMobileColumn)
    ? activeMobileColumn
    : visibleColumns[0]?.id;

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
    getContainerId: (t) => (t.status === 'pending' ? 'todo' : t.status),
    isReadOnly,
    onDropReorder: (draggedTask, targetStatus, orderedColumnTaskIds) => {
      if (onReorderTask) {
        onReorderTask(draggedTask.id, targetStatus, orderedColumnTaskIds);
      } else if (draggedTask.status !== targetStatus) {
        onUpdateStatus(draggedTask.id, targetStatus);
      }
    }
  });

  const getGridClass = (count: number) => {
    if (count <= 1) return 'md:grid-cols-1';
    if (count === 2) return 'md:grid-cols-2';
    if (count === 3) return 'md:grid-cols-2 lg:grid-cols-3';
    return 'md:grid-cols-2 lg:grid-cols-4';
  };

  const scrollToColumn = (status: TaskStatus) => {
    setActiveMobileColumn(status);
    const element = document.getElementById(`kanban-col-${status}`);
    if (element && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetLeft =
        element.offsetLeft - (container.clientWidth - element.clientWidth) / 2;
      container.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });
    }
  };

  const handleMobileCarouselScroll = () => {
    const container = scrollContainerRef.current;
    if (!container || window.innerWidth >= 768) return;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    let closestId: TaskStatus | null = null;
    let closestDistance = Infinity;

    for (const col of visibleColumns) {
      const el = document.getElementById(`kanban-col-${col.id}`);
      if (!el) continue;
      const elCenter = el.offsetLeft + el.clientWidth / 2;
      const dist = Math.abs(elCenter - containerCenter);
      if (dist < closestDistance) {
        closestDistance = dist;
        closestId = col.id;
      }
    }

    if (closestId && closestId !== effectiveMobileColumn) {
      setActiveMobileColumn(closestId);
    }
  };

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
    <div className="space-y-3">
      {/* Pills de sélection rapide de colonne sur mobile (< md) */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {visibleColumns.map(col => {
          const count = tasks.filter(t => t.status === col.id).length;
          const isActive = effectiveMobileColumn === col.id;

          return (
            <button
              key={col.id}
              type="button"
              onClick={() => scrollToColumn(col.id)}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 min-h-[38px] rounded-full text-xs font-semibold transition-all active:scale-[0.98] shrink-0 cursor-pointer tabular-nums ${
                isActive
                  ? 'bg-[var(--cdh-text-primary)] text-[var(--cdh-text-inverted)] shadow-sm'
                  : 'cdh-glass-chrome text-[var(--cdh-text-primary)]'
              }`}
            >
              <span
                aria-hidden="true"
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: col.dotColor }}
              />
              <span>{col.title}</span>
              <span className="text-[11px] opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Colonnes Liquid Glass (Couche 1) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleMobileCarouselScroll}
        className={`flex md:grid ${getGridClass(visibleColumns.length)} gap-3.5 sm:gap-4 items-start overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory pb-2 md:pb-4 -mx-3 px-3 sm:mx-0 sm:px-0`}
      >
        {visibleColumns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isHovered = activeDropContainer === col.id;

          return (
            <div
              key={col.id}
              id={`kanban-col-${col.id}`}
              onDragOver={(e) => handleDragOverContainer(e, col.id)}
              onDragLeave={handleDragLeaveContainer}
              onDrop={(e) => handleDropOnContainer(e, col.id)}
              className={`cdh-glass-column flex flex-col rounded-cdh-2xl p-3 sm:p-3.5 min-h-[260px] md:min-h-[480px] w-[calc(100vw-2.25rem)] max-w-[360px] md:max-w-none md:w-auto shrink-0 snap-center md:shrink transition-all duration-200 ${
                isHovered
                  ? 'ring-2 ring-[var(--cdh-accent)]/50 border-[var(--cdh-accent)]'
                  : ''
              }`}
            >
              {/* En-tête Colonne épuré */}
              <div className="flex items-center justify-between px-1.5 pb-2.5 mb-2.5 border-b border-[var(--cdh-border-hairline)]">
                <h3 className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: col.dotColor }}
                  />
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

              {/* Liste des cartes */}
              <div className="space-y-2.5 flex-1 md:overflow-y-auto md:max-h-[calc(100dvh-260px)] md:pr-0.5">
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
                        isReadOnly={isReadOnly}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onToggleSubtask={onToggleSubtask}
                        onAddSubtask={onAddSubtask}
                        onUpdateStatus={onUpdateStatus}
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
