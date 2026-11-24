import React, { useState, useRef } from 'react';
import { Task, TaskStatus, User } from '../types';
import { TaskCard } from './TaskCard';
import { Plus, ListTodo, PlayCircle, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  currentUser: User | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
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
  borderHover: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'todo',
    title: 'À faire',
    icon: <ListTodo className="w-4 h-4 text-slate-500" />,
    headerColor: 'text-slate-700',
    badgeBg: 'bg-slate-200 text-slate-700',
    borderHover: 'hover:border-slate-400'
  },
  {
    id: 'in_progress',
    title: '🚧 En cours',
    icon: <PlayCircle className="w-4 h-4 text-amber-500" />,
    headerColor: 'text-amber-800',
    badgeBg: 'bg-amber-100 text-amber-800',
    borderHover: 'hover:border-amber-400'
  },
  {
    id: 'blocked',
    title: '❌ Bloqué / Litige',
    icon: <AlertOctagon className="w-4 h-4 text-red-500" />,
    headerColor: 'text-red-800',
    badgeBg: 'bg-red-100 text-red-800',
    borderHover: 'hover:border-red-400'
  },
  {
    id: 'done',
    title: '✅ Fait (Terminé)',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    headerColor: 'text-emerald-800',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    borderHover: 'hover:border-emerald-400'
  }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  currentUser,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onToggleStar,
  onAddNewTask,
  isReadOnly
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<TaskStatus | null>(null);
  const [activeMobileColumn, setActiveMobileColumn] = useState<TaskStatus>('todo');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(task.id);
  };

  const handleDragOver = (e: React.DragEvent, colId: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropColumn !== colId) {
      setActiveDropColumn(colId);
    }
  };

  const handleDragLeave = () => {
    setActiveDropColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setActiveDropColumn(null);
    const idStr = e.dataTransfer.getData('text/plain');
    const taskId = Number(idStr) || draggedTaskId;
    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== targetStatus) {
        onUpdateStatus(taskId, targetStatus);
      }
    }
    setDraggedTaskId(null);
  };

  const scrollToColumn = (status: TaskStatus) => {
    setActiveMobileColumn(status);
    const element = document.getElementById(`kanban-col-${status}`);
    if (element && scrollContainerRef.current) {
      const offset = element.offsetLeft - scrollContainerRef.current.offsetLeft;
      scrollContainerRef.current.scrollTo({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-3">
      
      {/* Pills de sélection rapide de colonne sur mobile (< md) */}
      <div className="flex md:hidden items-center justify-between gap-1 overflow-x-auto pb-1 px-1">
        {COLUMNS.map(col => {
          const count = tasks.filter(t => t.status === col.id).length;
          const isActive = activeMobileColumn === col.id;

          return (
            <button
              key={col.id}
              onClick={() => scrollToColumn(col.id)}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200'
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

      {/* Colonnes : Swipe horizontal avec snap sur mobile, Grille 4 colonnes sur desktop */}
      <div
        ref={scrollContainerRef}
        className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 items-start overflow-x-auto snap-x snap-mandatory pb-4 -mx-3 px-3 sm:mx-0 sm:px-0"
      >
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          const isHovered = activeDropColumn === col.id;

          return (
            <div
              key={col.id}
              id={`kanban-col-${col.id}`}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`flex flex-col bg-slate-200/70 rounded-2xl p-3 sm:p-3.5 border min-h-[480px] w-[86vw] xs:w-[320px] md:w-auto shrink-0 snap-center md:shrink transition-all duration-200 ${
                isHovered
                  ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-400/30'
                  : 'border-slate-300/80'
              }`}
            >
              {/* Header Colonne */}
              <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-300/60 mb-3">
                <div className="flex items-center gap-2">
                  {col.icon}
                  <span className={`font-bold text-xs sm:text-sm ${col.headerColor}`}>
                    {col.title}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>

                {!isReadOnly && currentUser?.role !== 'read' && (
                  <button
                    onClick={() => onAddNewTask(col.id)}
                    className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-300/60 rounded-lg transition-colors cursor-pointer"
                    title={`Ajouter dans "${col.title}"`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Liste des cartes */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-270px)] pr-1">
                {colTasks.length > 0 ? (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      currentUser={currentUser}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onToggleSubtask={onToggleSubtask}
                      onAddSubtask={onAddSubtask}
                      onUpdateStatus={onUpdateStatus}
                      onToggleStar={onToggleStar}
                      onDragStart={handleDragStart}
                    />
                  ))
                ) : (
                  <div className="h-28 border-2 border-dashed border-slate-300/70 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium select-none">
                    Déposer une tâche ici
                  </div>
                )}
              </div>

              {/* Bouton rapide bas de colonne */}
              {!isReadOnly && currentUser?.role !== 'read' && (
                <button
                  onClick={() => onAddNewTask(col.id)}
                  className="mt-2.5 w-full py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-300/70 flex items-center justify-center gap-1.5 transition-colors border border-transparent hover:border-slate-300 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
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
