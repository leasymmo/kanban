import React, { useState } from 'react';
import { Task, User, Subtask, TaskStatus } from '../types';
import { buildSubtaskTree, calculateSubtaskStats, HierarchicalSubtask } from '../utils/subtasks';
import {
  CheckSquare, Square, ChevronDown, ChevronUp, Clock, Home,
  Trash2, Edit3, UserPlus, Plus, CornerDownRight, Check, X
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  currentUser: User | null;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  currentUser,
  onEdit,
  onDelete,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onDragStart
}) => {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [addingChildToId, setAddingChildToId] = useState<number | null>(null);
  const [childTitle, setChildTitle] = useState('');
  const [isSubmittingChild, setIsSubmittingChild] = useState(false);

  const { total: totalSubtasks, done: doneSubtasksCount, percent: progressPercent } = calculateSubtaskStats(task.subtasks);
  const hierarchicalSubtasks = buildSubtaskTree(task.subtasks);

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

  const handleCreateChildSubtask = async (parentId: number) => {
    if (!childTitle.trim() || !onAddSubtask) return;
    setIsSubmittingChild(true);
    try {
      await onAddSubtask(task.id, childTitle.trim(), parentId);
      setChildTitle('');
      setAddingChildToId(null);
    } finally {
      setIsSubmittingChild(false);
    }
  };

  // Rendu récursif jusqu'à 4 niveaux
  const renderSubtaskNode = (node: HierarchicalSubtask) => {
    const isDone = !!node.is_done;
    const canHaveChildren = node.depth < 3; // Niveaux 0, 1, 2 peuvent avoir des enfants => total 4 niveaux (0, 1, 2, 3)

    const depthBorderColors = [
      'border-slate-200',
      'border-indigo-300 ml-2.5 pl-2',
      'border-amber-300 ml-2.5 pl-2',
      'border-emerald-300 ml-2.5 pl-2'
    ];

    return (
      <div key={node.id} className={`space-y-1 ${node.depth > 0 ? `border-l-2 ${depthBorderColors[node.depth] || 'border-slate-300 ml-2 pl-2'}` : ''}`}>
        <div className="flex items-start justify-between gap-1.5 py-0.5 group/item hover:bg-slate-50/80 rounded px-1">
          <button
            type="button"
            onClick={() => task.can_edit && onToggleSubtask(node.id)}
            className={`flex items-start gap-1.5 flex-1 text-left text-xs ${
              task.can_edit ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            {isDone ? (
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <Square className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" />
            )}
            <span className={`${isDone ? 'line-through text-slate-400' : 'text-slate-700 font-medium'} leading-tight break-words`}>
              {node.title}
            </span>
          </button>

          {/* Bouton pour ajouter un niveau enfant directement */}
          {task.can_edit && canHaveChildren && onAddSubtask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAddingChildToId(addingChildToId === node.id ? null : node.id);
                setChildTitle('');
              }}
              className="opacity-100 sm:opacity-0 group-hover/item:opacity-100 p-0.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-opacity cursor-pointer shrink-0"
              title={`Ajouter une sous-tâche de niveau ${node.depth + 2}`}
            >
              <CornerDownRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Input inline pour ajouter une sous-tâche enfant */}
        {addingChildToId === node.id && (
          <div className="ml-4 pl-2 border-l-2 border-brand-400 py-1 flex items-center gap-1.5 animate-fade-in">
            <input
              type="text"
              autoFocus
              placeholder={`Sous-tâche (Niv. ${node.depth + 2})...`}
              value={childTitle}
              onChange={(e) => setChildTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateChildSubtask(node.id);
                } else if (e.key === 'Escape') {
                  setAddingChildToId(null);
                }
              }}
              className="flex-1 px-2 py-0.5 text-[11px] border border-slate-300 rounded focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={isSubmittingChild || !childTitle.trim()}
              onClick={() => handleCreateChildSubtask(node.id)}
              className="p-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[10px] disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setAddingChildToId(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded text-[10px] cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Rendu des enfants */}
        {node.children && node.children.length > 0 && (
          <div className="space-y-1 mt-0.5">
            {node.children.map(renderSubtaskNode)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      draggable={task.can_edit}
      onDragStart={(e) => onDragStart && onDragStart(e, task)}
      className={`bg-white rounded-xl p-3.5 shadow-xs border transition-all duration-150 group hover:shadow-md ${
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

        {/* Actions (Modifier / Supprimer) : toujours visibles sur mobile, hover sur desktop */}
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 sm:transition-opacity shrink-0">
          {task.can_edit && (
            <button
              onClick={() => onEdit(task)}
              className="p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 cursor-pointer"
              title="Modifier la tâche"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {task.can_delete && (
            <button
              onClick={() => onDelete(task.id)}
              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 cursor-pointer"
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
        className={`font-semibold text-sm text-slate-800 leading-snug hover:text-brand-600 transition-colors break-words ${
          task.status === 'done' ? 'line-through text-slate-400' : ''
        }`}
      >
        {task.title}
      </h3>

      {/* Description / Remarques (style flèche '→ ...' du document) */}
      {task.description && (
        <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed font-normal break-words">
          <span className="text-brand-600 font-bold mr-1">→</span>
          {task.description}
        </div>
      )}

      {/* Sous-tâches Checklist hiérarchique */}
      {totalSubtasks > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-100">
          <button
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
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
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Arborescence des sous-tâches jusqu'à 4 niveaux */}
          {showSubtasks && (
            <div className="mt-2.5 space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {hierarchicalSubtasks.map(renderSubtaskNode)}
            </div>
          )}
        </div>
      )}

      {/* Footer : Assigné, Échéance & Changement rapide de statut (Touch/Mobile & Desktop) */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
        
        {/* Responsable */}
        {task.assigned_to ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white shadow-xs shrink-0"
              style={{ backgroundColor: task.assigned_to_color || '#4B5563' }}
              title={`Assignée à ${task.assigned_to_name}`}
            >
              {task.assigned_to_initials}
            </div>
            <span className="text-slate-600 font-medium text-xs truncate max-w-[100px] sm:max-w-[120px]">
              {task.assigned_to_name}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium text-[11px] border border-amber-200">
            <UserPlus className="w-3 h-3 text-amber-600" />
            <span>À attribuer</span>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {/* Échéance */}
          {task.due_date && (
            <div className="flex items-center gap-1 text-slate-500 text-[11px]">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{new Date(task.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
            </div>
          )}

          {/* Sélecteur de statut rapide (essentiel sur mobile tactile sans drag-and-drop) */}
          {onUpdateStatus && task.can_edit && (
            <select
              value={task.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onUpdateStatus(task.id, e.target.value as TaskStatus);
              }}
              className="text-[10px] font-semibold border border-slate-200 rounded-md px-1 py-0.5 bg-slate-50 hover:bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
              title="Changer rapidement de statut"
            >
              <option value="todo">À faire</option>
              <option value="in_progress">🚧 En cours</option>
              <option value="blocked">❌ Bloqué</option>
              <option value="done">✅ Fait</option>
            </select>
          )}
        </div>

      </div>
    </div>
  );
};
