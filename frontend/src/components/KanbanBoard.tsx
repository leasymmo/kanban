import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Task, TaskStatus, User } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import { TaskStatusIcon } from './ui';
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
  const statusPillBarRef = useRef<HTMLDivElement>(null);
  const rafMobileScrollRef = useRef<number | null>(null);
  const programmaticTargetLeftRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!effectiveMobileColumn) return;
    const bar = statusPillBarRef.current;
    const pill = document.getElementById(`kanban-status-pill-${effectiveMobileColumn}`);
    if (!bar || !pill) return;

    const pillLeft = pill.offsetLeft - bar.offsetLeft;
    const pillRight = pillLeft + pill.offsetWidth;
    const viewLeft = bar.scrollLeft;
    const viewRight = viewLeft + bar.clientWidth;

    if (pillLeft < viewLeft + 8) {
      bar.scrollTo({ left: Math.max(0, pillLeft - 12), behavior: 'smooth' });
    } else if (pillRight > viewRight - 8) {
      bar.scrollTo({ left: pillRight - bar.clientWidth + 12, behavior: 'smooth' });
    }
  }, [effectiveMobileColumn]);

  const syncMobileColumnFromScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || window.innerWidth >= 768 || visibleColumns.length === 0) return;

    const targetLeft = programmaticTargetLeftRef.current;
    if (targetLeft !== null) {
      if (Math.abs(container.scrollLeft - targetLeft) <= 2) {
        programmaticTargetLeftRef.current = null;
      } else {
        return;
      }
    }

    const maxScroll = container.scrollWidth - container.clientWidth;
    if (maxScroll <= 1 || visibleColumns.length === 1) {
      const firstId = visibleColumns[0].id;
      setActiveMobileColumn(prev => (prev === firstId ? prev : firstId));
      return;
    }

    const progress = Math.max(0, Math.min(1, container.scrollLeft / maxScroll));
    const idx = Math.round(progress * (visibleColumns.length - 1));
    const nextId = visibleColumns[idx]?.id ?? visibleColumns[0].id;
    setActiveMobileColumn(prev => (prev === nextId ? prev : nextId));
  }, [visibleColumns]);

  const handleMobileCarouselScroll = useCallback(() => {
    if (rafMobileScrollRef.current !== null) return;
    rafMobileScrollRef.current = window.requestAnimationFrame(() => {
      rafMobileScrollRef.current = null;
      syncMobileColumnFromScroll();
    });
  }, [syncMobileColumnFromScroll]);

  useEffect(() => {
    return () => {
      if (rafMobileScrollRef.current !== null) {
        window.cancelAnimationFrame(rafMobileScrollRef.current);
      }
    };
  }, []);

  const scrollToColumn = (status: TaskStatus) => {
    const idx = visibleColumns.findIndex(c => c.id === status);
    if (idx === -1) return;
    setActiveMobileColumn(status);

    const container = scrollContainerRef.current;
    if (!container) return;

    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    const targetLeft =
      visibleColumns.length > 1
        ? Math.round((idx / (visibleColumns.length - 1)) * maxScroll)
        : 0;

    programmaticTargetLeftRef.current = targetLeft;
    container.scrollTo({ left: targetLeft, behavior: 'smooth' });
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
    <div className="flex-1 min-h-0 flex flex-col gap-2.5">
      {/* Pills de sélection rapide de colonne sur mobile (< md) */}
      <div
        ref={statusPillBarRef}
        className="flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 py-0.5"
      >
        {visibleColumns.map(col => {
          const count = tasks.filter(t => t.status === col.id).length;
          const isActive = effectiveMobileColumn === col.id;

          return (
            <button
              key={col.id}
              id={`kanban-status-pill-${col.id}`}
              type="button"
              aria-current={isActive ? 'location' : undefined}
              onClick={() => scrollToColumn(col.id)}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 min-h-[34px] rounded-full text-[11.5px] font-semibold transition-colors duration-150 shrink-0 cursor-pointer tabular-nums ${
                isActive
                  ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card ring-1 ring-[var(--cdh-accent)]/35'
                  : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
              }`}
            >
              <TaskStatusIcon status={col.id} className="w-3.5 h-3.5 shrink-0" />
              <span>{col.title}</span>
              <span className="text-[11px] opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Colonnes Liquid Glass à hauteur fixe plein écran (sans scroll de page) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleMobileCarouselScroll}
        onTouchStart={() => {
          programmaticTargetLeftRef.current = null;
        }}
        className={`flex-1 min-h-0 flex md:grid ${getGridClass(visibleColumns.length)} gap-3.5 sm:gap-4 items-stretch overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory -mx-3 px-3 sm:mx-0 sm:px-0`}
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
              className={`cdh-glass-column flex flex-col rounded-cdh-2xl p-3 sm:p-3.5 h-full min-h-0 w-[calc(100vw-2.25rem)] max-w-[360px] md:max-w-none md:w-auto shrink-0 snap-center md:shrink transition-all duration-200 ${
                isHovered
                  ? 'ring-2 ring-[var(--cdh-accent)]/50 border-[var(--cdh-accent)]'
                  : ''
              }`}
            >
              {/* En-tête Colonne fixe */}
              <div className="flex items-center justify-between px-1.5 pb-2.5 mb-2.5 border-b border-[var(--cdh-border-hairline)] shrink-0">
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

              {/* Liste des cartes avec scroll interne unique */}
              <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5">
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
