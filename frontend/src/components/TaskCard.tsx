import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus, User } from '../types';
import { BlurredIconSwap } from './BlurredIconSwap';
import { Badge, ProgressBar, TaskMetaBar } from './ui';
import { hexToSoftTint } from '../utils/color';
import {
  buildSubtaskTree,
  calculateSubtaskStats,
  HierarchicalSubtask,
  SUBTASK_DEPTH_THEME,
} from '../utils/subtasks';
import {
  CheckSquare, Square, ChevronDown, ChevronUp,
  Trash2, Edit3, CornerDownRight, Check, X,
  Sparkles, Zap
} from 'lucide-react';

interface TaskCardProps {
  task: Task;
  allUsers?: User[];
  currentUser?: User | null;
  isReadOnly?: boolean;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
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
  allUsers = [],
  currentUser = null,
  isReadOnly = false,
  onEdit,
  onDelete,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onAssignTask,
  onQuickUpdateTask,
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
  const isAdmin = currentUser?.role === 'admin';
  const assignableUsers = allUsers.filter((u) => u.role !== 'read');

  const { total: totalSubtasks, done: doneSubtasksCount, percent: progressPercent } = calculateSubtaskStats(task.subtasks);
  const hierarchicalSubtasks = buildSubtaskTree(task.subtasks);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="danger" pill>Urgent</Badge>;
      case 'low':
        return <Badge variant="neutral" pill>Basse</Badge>;
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
    } catch {
      // Erreur gérée par la notification globale ; la saisie reste conservée
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
            <span className={`${isDone ? 'line-through text-slate-500' : 'text-slate-800 font-medium'} leading-tight break-words`}>
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
              aria-label={`Ajouter une sous-étape à ${node.title}`}
              className="opacity-100 sm:opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 focus-visible:opacity-100 p-1 sm:p-0.5 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] hover:bg-[var(--cdh-accent-soft)] rounded transition-opacity cursor-pointer shrink-0"
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
              className="flex-1 px-2 py-1 text-xs border border-black/[0.12] rounded focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={isSubmittingChild || !childTitle.trim()}
              onClick={() => handleCreateChildSubtask(node.id)}
              aria-label="Valider la sous-étape"
              className="p-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3 h-3" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setAddingChildToId(null)}
              aria-label="Annuler"
              className="p-1.5 text-slate-500 hover:text-slate-700 rounded text-[11px] cursor-pointer"
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
    <div className="relative cdh-card-slot">
      {dropIndicator === 'before' && (
        <div className="pointer-events-none h-0.5 bg-[var(--cdh-accent)] rounded-full mb-1.5 shadow-sm animate-pulse motion-reduce:animate-none" />
      )}
      <div
        data-task-card-id={task.id}
        data-dragging={isDragging ? 'true' : undefined}
        draggable={canModify && !!onDragStart}
        onDragStart={(e) => canModify && onDragStart && onDragStart(e, task)}
        onDragEnd={() => onDragEnd && onDragEnd()}
        onDragOver={(e) => onDragOverCard && onDragOverCard(e, task)}
        onDrop={(e) => onDropOnCard && onDropOnCard(e, task)}
        className={`cdh-surface-card cdh-surface-card--lift rounded-cdh-lg p-3.5 group ${
          canModify && onDragStart ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        } ${
          isDragging ? 'opacity-45 scale-[0.98]' : ''
        } ${
          task.is_starred ? 'cdh-card-starred' : ''
        } ${
          !task.is_starred && task.status === 'blocked' ? 'cdh-card-blocked' : ''
        }`}
      >
      {/* Top Badges (Logement & Priorité) */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.property_name && (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-cdh-xs text-[var(--cdh-text-primary)]"
              style={{
                backgroundColor: hexToSoftTint(task.property_color, 0.14),
              }}
            >
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: task.property_color || '#007AFF' }}
              />
              {task.property_name}
            </span>
          )}

          {task.status === 'blocked' && !!task.is_starred && (
            <Badge variant="danger" pill>Bloqué</Badge>
          )}

          {getPriorityBadge(task.priority)}

          {task.is_new ? (
            <Badge variant="accent">
              <Sparkles className="w-3 h-3" strokeWidth={2} />
              Nouveau
            </Badge>
          ) : null}

          {task.is_unplanned ? (
            <Badge variant="success">
              <Zap className="w-3 h-3" strokeWidth={2} />
              Complémentaire
            </Badge>
          ) : null}
        </div>

        {/* Actions (Modifier / Supprimer) */}
        {(canModify || canDelete) && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 sm:transition-opacity">
            {canModify && (
              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label="Modifier la tâche"
                className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 sm:p-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] rounded-cdh-sm hover:bg-[var(--cdh-surface-control)] active:scale-95 cursor-pointer transition-colors"
                title="Modifier la tâche"
              >
                <Edit3 className="w-4 h-4 sm:w-3.5 sm:h-3.5" strokeWidth={1.75} />
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                aria-label="Supprimer la tâche"
                className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 flex items-center justify-center p-1.5 sm:p-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-danger)] rounded-cdh-sm hover:bg-[var(--cdh-danger-soft)] active:scale-95 cursor-pointer transition-colors"
                title="Supprimer la tâche"
              >
                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Titre de la tâche */}
      <h4
        onClick={() => canModify && onEdit(task)}
        className={`font-semibold text-[13.5px] leading-snug [text-wrap:balance] transition-colors break-words ${
          canModify ? 'hover:text-[var(--cdh-accent)] cursor-pointer' : ''
        } ${
          task.status === 'done'
            ? 'line-through text-[var(--cdh-text-secondary)]'
            : 'text-[var(--cdh-text-primary)]'
        }`}
      >
        {task.title}
      </h4>

      {/* Description / Remarques */}
      {task.description && (
        <p className="mt-2 pt-2 border-t border-[var(--cdh-border-hairline)] text-[12px] text-[var(--cdh-text-secondary)] leading-relaxed break-words">
          <span className="text-[var(--cdh-accent)] font-semibold mr-1">→</span>
          {task.description}
        </p>
      )}

      {/* Sous-tâches Checklist hiérarchique */}
      {totalSubtasks > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[var(--cdh-border-hairline)]">
          <button
            type="button"
            aria-expanded={showSubtasks}
            onClick={() => setShowSubtasks(!showSubtasks)}
            className="w-full flex items-center justify-between text-xs text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] font-medium cursor-pointer"
          >
            <span className="flex items-center gap-1.5 tabular-nums">
              <CheckSquare className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
              Sous-tâches ({doneSubtasksCount}/{totalSubtasks})
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold tabular-nums">{progressPercent}%</span>
              <BlurredIconSwap
                active={showSubtasks}
                activeIcon={<ChevronUp className="w-3.5 h-3.5" strokeWidth={1.75} />}
                inactiveIcon={<ChevronDown className="w-3.5 h-3.5" strokeWidth={1.75} />}
              />
            </div>
          </button>

          <ProgressBar value={progressPercent} label="Sous-tâches" className="mt-1.5" />

          {showSubtasks && (
            <div className="mt-2.5 space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {hierarchicalSubtasks.map(renderSubtaskNode)}
            </div>
          )}
        </div>
      )}

      {/* Footer : Barre d'icônes unifiée (Responsable, Statut, Priorité, Échéance, Étoile) */}
      <div
        className="mt-3 pt-2.5 border-t border-[var(--cdh-border-hairline)] flex items-center justify-between gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <TaskMetaBar
          size="sm"
          users={assignableUsers}
          assignedTo={task.assigned_to ?? ''}
          onChangeAssignee={(userId) => onAssignTask?.(task.id, userId === '' ? null : userId)}
          showAssignee={true}
          assigneeEditable={isAdmin && canModify && !!onAssignTask}
          allowUnassign={true}
          fallbackAssignee={{
            name: task.assigned_to_name,
            initials: task.assigned_to_initials,
            color: task.assigned_to_color
          }}
          status={task.status === 'pending' ? 'todo' : task.status}
          onChangeStatus={(nextStatus) => onUpdateStatus?.(task.id, nextStatus)}
          priority={task.priority || 'medium'}
          onChangePriority={(nextPriority) => onQuickUpdateTask?.(task.id, { priority: nextPriority })}
          dueDate={task.due_date || ''}
          onChangeDueDate={(nextDate) => onQuickUpdateTask?.(task.id, { due_date: nextDate || null })}
          markOverdue={task.status !== 'done'}
          disabled={!canModify}
          showStar={canStar || !!task.is_starred}
          isStarred={!!task.is_starred}
          canToggleStar={canStar && !!onToggleStar}
          onToggleStar={() => onToggleStar?.(task.id)}
        />
      </div>
      </div>
      {dropIndicator === 'after' && (
        <div className="pointer-events-none h-0.5 bg-[var(--cdh-accent)] rounded-full mt-1.5 shadow-sm animate-pulse motion-reduce:animate-none" />
      )}
    </div>
  );
};
