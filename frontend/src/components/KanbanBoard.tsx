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
    icon: <ListTodo className="w-4 h-4 text-slate-500" strokeWidth={2.25} />,
    headerColor: 'text-slate-700',
    badgeBg: 'bg-slate-200 text-slate-700'
  },
  {
    id: 'in_progress',
    title: '🚧 En cours',
    icon: <PlayCircle className="w-4 h-4 text-amber-500" strokeWidth={2.25} />,
    headerColor: 'text-amber-800',
    badgeBg: 'bg-amber-100 text-amber-800'
  },
  {
    id: 'blocked',
    title: '❌ Bloqué / Litige',
    icon: <AlertOctagon className="w-4 h-4 text-red-500" strokeWidth={2.25} />,
    headerColor: 'text-red-800',
    badgeBg: 'bg-red-100 text-red-800'
  },
  {
    id: 'done',
    title: '✅ Fait (Terminé)',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={2.25} />,
    headerColor: 'text-emerald-800',
    badgeBg: 'bg-emerald-100 text-emerald-800'
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
  isReadOnly
}) => {
  const isAdmin = currentUser?.role === 'admin';
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
      const offset = element.offsetLeft - scrollContainerRef.current.offsetLeft;
      scrollContainerRef.current.scrollTo({ left: offset, behavior: 'smooth' });
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
      <div className="flex md:hidden items-center justify-between gap-1 overflow-x-auto pb-1 px-1">
        {visibleColumns.map(col => {
          const count = tasks.filter(t => t.status === col.id).length;
          const isActive = effectiveMobileColumn === col.id;

          return (
            <button
              key={col.id}
              onClick={() => scrollToColumn(col.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-black/[0.12]'
              }`}
            >
              <span>{col.title.split(' ')[0]}</span>
              <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Colonnes adaptatives selon les statuts visibles */}
      <div
        ref={scrollContainerRef}
        className={`flex md:grid ${getGridClass(visibleColumns.length)} gap-4 items-start overflow-x-auto snap-x snap-mandatory pb-4 -mx-3 px-4 sm:mx-0 sm:px-0 kanban-carousel-fade`}
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
              className={`flex flex-col bg-slate-200/70 rounded-3xl sm:rounded-[26px] p-3 sm:p-3.5 border min-h-[480px] w-[86vw] xs:w-[320px] md:w-auto shrink-0 snap-center md:shrink transition-all duration-200 ${
                isHovered
                  ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-400/30'
                  : 'border-black/[0.12]'
              }`}
            >
              {/* Header Colonne */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-black/[0.12] mb-3">
                <div className="flex items-center gap-2">
                  {col.icon}
                  <span className={`font-bold text-xs sm:text-sm ${col.headerColor}`}>
                    {col.title}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>

                {!isReadOnly && isAdmin && (
                  <button
                    onClick={() => onAddNewTask(col.id)}
                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-300/60 rounded-lg transition-colors cursor-pointer"
                    title={`Ajouter dans "${col.title}"`}
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
              </div>

              {/* Liste des cartes */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100dvh-270px)] pr-1">
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
                  <div className="h-28 border-2 border-dashed border-black/[0.12] rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium select-none">
                    {isReadOnly || currentUser?.role === 'read' ? 'Aucune tâche' : 'Déposer une tâche ici'}
                  </div>
                )}
              </div>

              {/* Bouton rapide bas de colonne (Admin uniquement) */}
              {!isReadOnly && isAdmin && (
                <button
                  onClick={() => onAddNewTask(col.id)}
                  className="mt-2.5 w-full py-1.5 px-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-300/70 flex items-center justify-center gap-1.5 transition-colors border border-transparent hover:border-black/[0.12] cursor-pointer"
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
