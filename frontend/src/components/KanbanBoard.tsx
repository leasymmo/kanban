import React, { useState } from 'react';
import { Task, TaskStatus, User } from '../types';
import { TaskCard } from './TaskCard';
import { Plus, ListTodo, PlayCircle, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  currentUser: User | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
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
  onUpdateStatus,
  onAddNewTask,
  isReadOnly
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<TaskStatus | null>(null);

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);
        const isHovered = activeDropColumn === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => handleDragOver(e, col.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`flex flex-col bg-slate-200/70 rounded-2xl p-3 border min-h-[500px] transition-all duration-200 ${
              isHovered
                ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-400/30'
                : 'border-slate-300/80'
            }`}
          >
            {/* Header Colonne */}
            <div className="flex items-center justify-between pb-3 px-1 border-b border-slate-300/60 mb-3">
              <div className="flex items-center gap-2">
                {col.icon}
                <span className={`font-bold text-sm ${col.headerColor}`}>
                  {col.title}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${col.badgeBg}`}>
                  {colTasks.length}
                </span>
              </div>

              {!isReadOnly && currentUser?.role !== 'read' && (
                <button
                  onClick={() => onAddNewTask(col.id)}
                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-300/60 rounded-lg transition-colors"
                  title={`Ajouter dans "${col.title}"`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Liste des cartes */}
            <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-250px)] pr-1">
              {colTasks.length > 0 ? (
                colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUser={currentUser}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onToggleSubtask={onToggleSubtask}
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
                className="mt-2.5 w-full py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-300/70 flex items-center justify-center gap-1.5 transition-colors border border-transparent hover:border-slate-300"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une tâche
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
