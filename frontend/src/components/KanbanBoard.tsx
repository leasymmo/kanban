import React, { useState, useRef } from 'react';
import { Task, TaskStatus, User } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import { Plus, ListTodo, PlayCircle, AlertOctagon, CheckCircle2, EyeOff } from 'lucide-react';

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
  icon: React.ReactNode;
  headerColor: string;
  badgeBg: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'todo',
    title: 'À faire',
    icon: <ListTodo className="w-4 h-4 text-slate-400" strokeWidth={2.25} />,
    headerColor: 'text-slate-200',
    badgeBg: 'bg-white/10 text-slate-300 border border-white/10'
  },
  {
    id: 'in_progress',
    title: 'En cours',
    icon: <PlayCircle className="w-4 h-4 text-cyan-400" strokeWidth={2.25} />,
    headerColor: 'text-cyan-300',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
  },
  {
    id: 'blocked',
    title: 'Bloqué / Litige',
    icon: <AlertOctagon className="w-4 h-4 text-rose-400" strokeWidth={2.25} />,
    headerColor: 'text-rose-300',
    badgeBg: 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
  },
  {
    id: 'done',
    title: 'Terminé',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={2.25} />,
    headerColor: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
  }
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
      <div className="bg-white rounded-2xl border border-black/[0.12] p-10 text-center text-slate-500">
        <EyeOff className="w-8 h-8 mx-auto mb-2 text-slate-300" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-slate-700">Tous les statuts sont actuellement masqués.</p>
        <p className="text-xs text-slate-500 mt-1">Sélectionnez au moins un statut dans le filtre « Statuts » ci-dessus.</p>
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
              className={`flex items-center justify-center gap-1.5 py-2 px-3 min-h-[40px] rounded-xl text-xs font-bold transition-all active:scale-[0.98] shrink-0 cursor-pointer tabular-nums ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-black/[0.12]'
              }`}
            >
              {col.icon}
              <span>{col.title}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Colonnes adaptatives selon les statuts visibles */}
      <div
        ref={scrollContainerRef}
        onScroll={handleMobileCarouselScroll}
        className={`flex md:grid ${getGridClass(visibleColumns.length)} gap-3 sm:gap-4 items-start overflow-x-auto no-scrollbar md:overflow-visible snap-x snap-mandatory pb-2 md:pb-4 -mx-3 px-3 sm:mx-0 sm:px-0`}
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
              className={`flex flex-col glass-panel rounded-2xl sm:rounded-[26px] p-3 sm:p-3.5 border min-h-[260px] md:min-h-[480px] w-[calc(100vw-2.25rem)] max-w-[360px] md:max-w-none md:w-auto shrink-0 snap-center md:shrink transition-all duration-200 shadow-glass ${
                isHovered
                  ? 'border-cyan-400 bg-cyan-950/30 ring-2 ring-cyan-400/40'
                  : 'border-white/[0.08]'
              }`}
            >
              {/* Header Colonne */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-white/[0.08] mb-3">
                <h3 className="flex items-center gap-2">
                  {col.icon}
                  <span className={`font-bold text-xs sm:text-sm ${col.headerColor}`}>
                    {col.title}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold tabular-nums ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </h3>

                {showQuickAddButtons && (
                  <button
                    type="button"
                    onClick={() => onAddNewTask(col.id)}
                    aria-label={`Ajouter dans ${col.title}`}
                    className="p-2 sm:p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    title={`Ajouter dans "${col.title}"`}
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
              </div>

              {/* Liste des cartes */}
              <div className="space-y-2.5 flex-1 md:overflow-y-auto md:max-h-[calc(100dvh-270px)] md:pr-1">
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
                  <p className={`py-10 px-3 text-center text-xs text-slate-400 font-medium select-none transition-colors ${
                    isHovered ? 'border-2 border-dashed border-cyan-400 rounded-xl bg-cyan-500/10' : ''
                  }`}>
                    {isReadOnly || currentUser?.role === 'read' ? 'Aucune tâche' : 'Déposer une tâche ici'}
                  </p>
                )}
              </div>

              {/* Bouton rapide bas de colonne */}
              {showQuickAddButtons && (
                <button
                  onClick={() => onAddNewTask(col.id)}
                  className="mt-2.5 w-full py-2 px-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/[0.06]"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  Ajouter une tâche
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
