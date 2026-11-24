import React, { useState } from 'react';
import { Task, User } from '../types';
import { CheckSquare, Square, ChevronDown, ChevronUp, AlertCircle, Clock, Home, Trash2, Edit3, UserPlus } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  currentUser: User | null;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  currentUser,
  onEdit,
  onDelete,
  onToggleSubtask,
  onDragStart
}) => {
  const [showSubtasks, setShowSubtasks] = useState(false);

  const doneSubtasksCount = task.subtasks.filter(s => s.is_done).length;
  const totalSubtasks = task.subtasks.length;
  const progressPercent = totalSubtasks > 0 ? Math.round((doneSubtasksCount / totalSubtasks) * 100) : 0;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-red-100 text-red-700">Urgent</span>;
      case 'low':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">Basse</span>;
      default:
        return null;
    }
  };

  return (
    <div
      draggable={task.can_edit}
      onDragStart={(e) => onDragStart && onDragStart(e, task)}
      className={`bg-white rounded-xl p-3.5 shadow-sm border transition-all duration-150 group hover:shadow-md ${
        task.can_edit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      } ${
        task.status === 'blocked' ? 'border-red-300 bg-red-50/20' : 'border-slate-200/90 hover:border-slate-300'
      }`}
    >
      {/* Top Badges (Logement & Priorité) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.property_name && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md text-white shadow-xs"
              style={{ backgroundColor: task.property_color || '#3B82F6' }}
            >
              <Home className="w-3 h-3" />
              {task.property_name}
            </span>
          )}

          {getPriorityBadge(task.priority)}

          {task.is_unplanned ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              ⚡ Complémentaire
            </span>
          ) : null}
        </div>

        {/* Actions (Modifier / Supprimer) si l'utilisateur a les droits */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.can_edit && (
            <button
              onClick={() => onEdit(task)}
              className="p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100"
              title="Modifier la tâche"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {task.can_delete && (
            <button
              onClick={() => onDelete(task.id)}
              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100"
              title="Supprimer la tâche"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Titre de la tâche */}
      <h3
        onClick={() => task.can_edit && onEdit(task)}
        className={`font-medium text-sm text-slate-800 leading-snug hover:text-brand-600 transition-colors ${
          task.status === 'done' ? 'line-through text-slate-400' : ''
        }`}
      >
        {task.title}
      </h3>

      {/* Description / Remarques (style flèche '→ ...' du document) */}
      {task.description && (
        <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed font-normal">
          <span className="text-brand-600 font-bold mr-1">→</span>
          {task.description}
        </div>
      )}

      {/* Sous-tâches Checklist */}
      {totalSubtasks > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <button
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 font-medium"
          >
            <span className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
              Sous-tâches ({doneSubtasksCount}/{totalSubtasks})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">{progressPercent}%</span>
              {showSubtasks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {/* Barre de progression */}
          <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Liste déroulante des sous-tâches */}
          {showSubtasks && (
            <div className="mt-2 space-y-1.5 pl-1">
              {task.subtasks.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => task.can_edit && onToggleSubtask(sub.id)}
                  className={`flex items-start gap-2 text-xs py-1 px-1 rounded transition-colors ${
                    task.can_edit ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
                  }`}
                >
                  {sub.is_done ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                  )}
                  <span className={sub.is_done ? 'line-through text-slate-400' : 'text-slate-700'}>
                    {sub.title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer : Assigné & Échéance */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
        {/* Responsable */}
        {task.assigned_to ? (
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-xs"
              style={{ backgroundColor: task.assigned_to_color || '#4B5563' }}
              title={`Assignée à ${task.assigned_to_name}`}
            >
              {task.assigned_to_initials}
            </div>
            <span className="text-slate-600 font-medium text-xs truncate max-w-[110px]">
              {task.assigned_to_name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium text-[11px] border border-amber-200">
            <UserPlus className="w-3 h-3 text-amber-600" />
            <span>À attribuer</span>
          </div>
        )}

        {/* Échéance */}
        {task.due_date && (
          <div className="flex items-center gap-1 text-slate-500 text-[11px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
          </div>
        )}
      </div>
    </div>
  );
};
