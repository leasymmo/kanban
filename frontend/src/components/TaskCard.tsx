import React, { useState } from 'react';
import { Task, TaskStatus } from '../types';
import { BlurredIconSwap } from './BlurredIconSwap';
import {
  buildSubtaskTree,
  calculateSubtaskStats,
  HierarchicalSubtask,
  SUBTASK_DEPTH_THEME,
  parseLocalDate,
  isTaskOverdue
} from '../utils/subtasks';
import {
  CheckSquare, Square, ChevronDown, ChevronUp, Clock, Home,
  Trash2, Edit3, UserPlus, CornerDownRight, Check, X, Star
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  isReadOnly?: boolean;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onToggleStar?: (taskId: number) => void;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: () => void;
  onDragOverCard?: (e: React.DragEvent, task: Task) => void;
  onDropOnCard?: (e: React.DragEvent, task: Task) => void;
  dropIndicator?: 'before' | 'after' | null;
  isDragging?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  isReadOnly = false,
  onEdit,
  onDelete,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onToggleStar,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropOnCard,
  dropIndicator,
  isDragging
}) => {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [addingChildToId, setAddingChildToId] = useState<number | null>(null);
  const [childTitle, setChildTitle] = useState('');
  const [isSubmittingChild, setIsSubmittingChild] = useState(false);

  const canModify = !isReadOnly && !!task.can_edit;
  const canDelete = !isReadOnly && !!task.can_delete;
  const canStar = !isReadOnly && !!task.can_star;
  const parsedDueDate = parseLocalDate(task.due_date);
  const overdue = isTaskOverdue(task.due_date, task.status);

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
    const canHaveChildren = node.depth < 3;
    const depthTheme = SUBTASK_DEPTH_THEME[node.depth] || SUBTASK_DEPTH_THEME[3];

    return (
      <div key={node.id} className={`space-y-1 ${node.depth > 0 ? `border-l-2 ${depthTheme.borderClass}` : ''}`}>
        <div className="flex items-start justify-between gap-1.5 py-0.5 group/item hover:bg-slate-50/80 rounded px-1">
          <button
            type="button"
            onClick={() => canModify && onToggleSubtask(node.id)}
            className={`flex items-start gap-1.5 flex-1 text-left text-xs ${
              canModify ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <BlurredIconSwap
              active={isDone}
              className="mt-0.5"
              activeIcon={<CheckSquare className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />}
              inactiveIcon={<Square className="w-3.5 h-3.5 text-slate-300" strokeWidth={1.75} />}
            />
            <span className={`${isDone ? 'line-through text-slate-400' : 'text-slate-700 font-medium'} leading-tight break-words`}>
              {node.title}
            </span>
          </button>

          {canModify && canHaveChildren && onAddSubtask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAddingChildToId(addingChildToId === node.id ? null : node.id);
                setChildTitle('');
              }}
              className="opacity-100 sm:opacity-0 group-hover/item:opacity-100 p-0.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-opacity cursor-pointer shrink-0"
              title="Ajouter une sous-étape imbriquée"
            >
              <CornerDownRight className="w-3 h-3" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Input inline pour ajouter une sous-tâche enfant */}
        {addingChildToId === node.id && (
          <div className="ml-4 pl-2 border-l-2 border-brand-400 py-1 flex items-center gap-1.5 animate-fade-in">
            <input
              type="text"
              autoFocus
              placeholder="Ajouter une sous-étape..."
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
              className="flex-1 px-2 py-0.5 text-[11px] border border-black/[0.12] rounded focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={isSubmittingChild || !childTitle.trim()}
              onClick={() => handleCreateChildSubtask(node.id)}
              className="p-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[10px] disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3 h-3" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setAddingChildToId(null)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded text-[10px] cursor-pointer"
            >
              <X className="w-3 h-3" strokeWidth={1.75} />
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
    <div className="relative">
      {dropIndicator === 'before' && (
        <div className="h-1 bg-brand-500 rounded-full mb-1.5 shadow-xs animate-pulse" />
      )}
      <div
        draggable={canModify && !!onDragStart}
        onDragStart={(e) => canModify && onDragStart && onDragStart(e, task)}
        onDragEnd={() => onDragEnd && onDragEnd()}
        onDragOver={(e) => onDragOverCard && onDragOverCard(e, task)}
        onDrop={(e) => onDropOnCard && onDropOnCard(e, task)}
        className={`bg-white rounded-xl p-3.5 shadow-xs border transition-all duration-150 group hover:shadow-md ${
          canModify && onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${
          isDragging ? 'opacity-45 scale-[0.98]' : ''
        } ${
          task.is_starred
            ? 'border-amber-300 ring-1 ring-amber-300/70 bg-amber-50/15'
            : task.status === 'blocked'
            ? 'border-red-300 bg-red-50/20'
            : 'border-black/[0.12] hover:border-black/[0.22]'
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
              <Home className="w-3 h-3" strokeWidth={2} />
              {task.property_name}
            </span>
          )}

          {getPriorityBadge(task.priority)}

          {task.is_new ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200/80">
              ✨ Nouveau
            </span>
          ) : null}

          {task.is_unplanned ? (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              ⚡ Complémentaire
            </span>
          ) : null}
        </div>

        {/* Actions (Étoile / Modifier / Supprimer) */}
        <div className="flex items-center gap-1 shrink-0">
          {(canStar || !!task.is_starred) && (
            <button
              type="button"
              disabled={!canStar}
              onClick={(e) => {
                e.stopPropagation();
                if (canStar && onToggleStar) {
                  onToggleStar(task.id);
                }
              }}
              className={`p-1 rounded transition-all ${
                task.is_starred
                  ? `text-amber-500 bg-amber-50 shadow-2xs ${canStar ? 'hover:text-amber-600 cursor-pointer' : 'cursor-default'}`
                  : canStar
                  ? 'opacity-100 sm:opacity-0 group-hover:opacity-100 text-slate-300 hover:text-amber-400 hover:bg-slate-100 cursor-pointer'
                  : 'text-slate-200 cursor-not-allowed hidden'
              }`}
              title={
                task.is_starred
                  ? (canStar ? 'Mise en avant activée (cliquer pour retirer)' : 'Mise en avant pour la réunion')
                  : 'Mettre en avant pour la réunion'
              }
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  task.is_starred ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                }`}
                strokeWidth={1.75}
              />
            </button>
          )}

          {/* Modifier & Supprimer */}
          {(canModify || canDelete) && (
            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 sm:transition-opacity">
              {canModify && (
                <button
                  onClick={() => onEdit(task)}
                  className="p-1 text-slate-400 hover:text-brand-600 rounded hover:bg-slate-100 cursor-pointer"
                  title="Modifier la tâche"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}

              {canDelete && (
                <button
                  onClick={() => onDelete(task.id)}
                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-100 cursor-pointer"
                  title="Supprimer la tâche"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Titre de la tâche */}
      <h3
        onClick={() => canModify && onEdit(task)}
        className={`font-semibold text-sm text-slate-800 leading-snug transition-colors break-words ${
          canModify ? 'hover:text-brand-600 cursor-pointer' : ''
        } ${
          task.status === 'done' ? 'line-through text-slate-400' : ''
        }`}
      >
        {task.title}
      </h3>

      {/* Description / Remarques (style flèche '→ ...' du document) */}
      {task.description && (
        <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-black/[0.12] leading-relaxed font-normal break-words">
          <span className="text-brand-600 font-bold mr-1">→</span>
          {task.description}
        </div>
      )}

      {/* Sous-tâches Checklist hiérarchique */}
      {totalSubtasks > 0 && (
        <div className="mt-3 pt-2.5 border-t border-black/[0.12]">
          <button
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
              Sous-tâches ({doneSubtasksCount}/{totalSubtasks})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">{progressPercent}%</span>
              <BlurredIconSwap
                active={showSubtasks}
                activeIcon={<ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} />}
                inactiveIcon={<ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />}
              />
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
      <div className="mt-3 pt-2.5 border-t border-black/[0.12] flex items-center justify-between gap-2 flex-wrap text-xs">
        
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
            <UserPlus className="w-3 h-3 text-amber-600" strokeWidth={1.75} />
            <span>À attribuer</span>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {/* Échéance */}
          {parsedDueDate && (
            <div
              className={`flex items-center gap-1 text-[11px] ${
                overdue
                  ? 'text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded font-semibold'
                  : 'text-slate-500'
              }`}
              title={overdue ? 'Échéance dépassée' : 'Date d’échéance'}
            >
              <Clock className={`w-3 h-3 ${overdue ? 'text-red-500' : 'text-slate-400'}`} strokeWidth={overdue ? 2 : 1.5} />
              <span>{parsedDueDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
            </div>
          )}

          {/* Sélecteur de statut rapide (essentiel sur mobile tactile sans drag-and-drop) */}
          {onUpdateStatus && canModify && (
            <select
              value={task.status}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onUpdateStatus(task.id, e.target.value as TaskStatus);
              }}
              className="text-[10px] font-semibold border border-black/[0.12] rounded-md px-1 py-0.5 bg-slate-50 hover:bg-white text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
              title="Changer rapidement de statut"
            >
              <option value="todo">⏳ À faire</option>
              <option value="in_progress">🚧 En cours</option>
              <option value="blocked">❌ Bloqué</option>
              <option value="done">✅ Fait</option>
            </select>
          )}
        </div>

      </div>
      </div>
      {dropIndicator === 'after' && (
        <div className="h-1 bg-brand-500 rounded-full mt-1.5 shadow-xs animate-pulse" />
      )}
    </div>
  );
};
