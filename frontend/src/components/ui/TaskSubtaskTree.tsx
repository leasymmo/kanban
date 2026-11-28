import React, { useState } from 'react';
import { Check, CheckSquare, CornerDownRight, Square, X } from 'lucide-react';
import { BlurredIconSwap } from '../BlurredIconSwap';
import { HierarchicalSubtask, SUBTASK_DEPTH_THEME } from '../../utils/subtasks';

export interface TaskSubtaskTreeProps {
  taskId: number;
  nodes: HierarchicalSubtask[];
  canModify: boolean;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  compact?: boolean;
}

/**
 * Arbre récursif interactif de sous-tâches (jusqu'à 4 niveaux) avec ajout imbriqué inline.
 * Partagé entre TaskCard et SprintListBoard.
 */
export const TaskSubtaskTree: React.FC<TaskSubtaskTreeProps> = ({
  taskId,
  nodes,
  canModify,
  onToggleSubtask,
  onAddSubtask,
  compact = false,
}) => {
  const [addingChildToId, setAddingChildToId] = useState<number | null>(null);
  const [childTitle, setChildTitle] = useState('');
  const [isSubmittingChild, setIsSubmittingChild] = useState(false);

  const handleCreateChild = async (parentId: number) => {
    if (!childTitle.trim() || !onAddSubtask) return;
    setIsSubmittingChild(true);
    try {
      await onAddSubtask(taskId, childTitle.trim(), parentId);
      setChildTitle('');
      setAddingChildToId(null);
    } catch {
      // Erreur notifiée globalement ; la saisie reste intacte
    } finally {
      setIsSubmittingChild(false);
    }
  };

  const renderNode = (node: HierarchicalSubtask) => {
    const isDone = !!node.is_done;
    const canHaveChildren = node.depth < 3;
    const depthTheme = SUBTASK_DEPTH_THEME[node.depth] || SUBTASK_DEPTH_THEME[3];

    return (
      <div
        key={node.id}
        className={`space-y-1 ${node.depth > 0 ? `border-l-2 ${depthTheme.borderClass}` : ''}`}
      >
        <div
          className={`flex items-start justify-between gap-1.5 group/item hover:bg-[var(--cdh-surface-control)] rounded-cdh-xs px-1.5 ${
            compact ? 'py-0.5' : 'py-1'
          }`}
        >
          <button
            type="button"
            disabled={!canModify}
            aria-pressed={isDone}
            onClick={(e) => {
              e.stopPropagation();
              if (canModify) onToggleSubtask(node.id);
            }}
            className={`flex items-start gap-2 flex-1 min-w-0 text-left min-h-[28px] py-0.5 ${
              compact ? 'text-xs' : 'text-[12.5px]'
            } ${canModify ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <BlurredIconSwap
              active={isDone}
              className="mt-0.5 shrink-0"
              activeIcon={
                <CheckSquare
                  className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-[var(--cdh-success)]`}
                  strokeWidth={1.75}
                />
              }
              inactiveIcon={
                <Square
                  className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-[var(--cdh-text-tertiary)]`}
                  strokeWidth={1.75}
                />
              }
            />
            <span
              className={`${
                isDone
                  ? 'line-through text-[var(--cdh-text-tertiary)]'
                  : 'text-[var(--cdh-text-primary)] font-medium'
              } leading-snug break-words`}
            >
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
              className="opacity-100 sm:opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 focus-visible:opacity-100 p-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] hover:bg-[var(--cdh-accent-soft)] rounded transition-opacity cursor-pointer shrink-0"
              title="Ajouter une sous-étape imbriquée"
            >
              <CornerDownRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {addingChildToId === node.id && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="ml-4 pl-2 border-l-2 border-[var(--cdh-accent)] py-1 flex items-center gap-1.5 animate-fade-in"
          >
            <input
              type="text"
              autoFocus
              placeholder="Ajouter une sous-étape..."
              value={childTitle}
              onChange={(e) => setChildTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateChild(node.id);
                } else if (e.key === 'Escape') {
                  setAddingChildToId(null);
                }
              }}
              className="flex-1 min-w-0 px-2.5 py-1 text-xs bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] text-[var(--cdh-text-primary)] rounded-cdh-sm focus:ring-1 focus:ring-[var(--cdh-border-focus)] focus:outline-none"
            />
            <button
              type="button"
              disabled={isSubmittingChild || !childTitle.trim()}
              onClick={() => handleCreateChild(node.id)}
              aria-label="Valider la sous-étape"
              className="p-1.5 bg-[var(--cdh-accent)] hover:bg-[var(--cdh-accent-hover)] text-white rounded-cdh-sm disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Check className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setAddingChildToId(null)}
              aria-label="Annuler"
              className="p-1.5 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] rounded-cdh-sm cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {node.children && node.children.length > 0 && (
          <div className="space-y-1 mt-0.5">{node.children.map(renderNode)}</div>
        )}
      </div>
    );
  };

  return <>{nodes.map(renderNode)}</>;
};
