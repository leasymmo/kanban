import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CheckSquare, CornerDownRight, GripVertical, Plus, Square, Trash2, X } from 'lucide-react';
import { ModalSubtaskNode } from '../../hooks/useSubtaskTreeEditor';
import { SUBTASK_DEPTH_THEME } from '../../utils/subtasks';
import { BlurredIconSwap } from '../BlurredIconSwap';
import { Button } from '../ui';

interface SubtaskTreeEditorProps {
  nodes: ModalSubtaskNode[];
  stats: { total: number; done: number };
  isOpen: boolean;
  onAddRoot: (title: string) => boolean;
  onAddChild: (parentTempId: string, title: string) => boolean;
  onRemove: (tempId: string) => void;
  onToggle: (tempId: string) => void;
  onUpdateTitle: (tempId: string, title: string) => void;
  onReorderSiblings: (
    parentKey: string,
    draggedTempId: string,
    targetTempId: string,
    position: 'before' | 'after'
  ) => void;
}

/**
 * Éditeur hiérarchique de sous-tâches avec glisser-déposer par Pointer Events (jusqu'à 4 niveaux).
 */
export const SubtaskTreeEditor: React.FC<SubtaskTreeEditorProps> = ({
  nodes,
  stats,
  isOpen,
  onAddRoot,
  onAddChild,
  onRemove,
  onToggle,
  onUpdateTitle,
  onReorderSiblings,
}) => {
  const rootInputId = useId();
  const [newRootTitle, setNewRootTitle] = useState('');
  const [activeChildParentTempId, setActiveChildParentTempId] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [draggedSubtask, setDraggedSubtask] = useState<{
    tempId: string;
    parentKey: string;
  } | null>(null);
  const [subtaskDropTarget, setSubtaskDropTarget] = useState<{
    tempId: string;
    parentKey: string;
    position: 'before' | 'after';
  } | null>(null);

  const subtasksContainerRef = useRef<HTMLDivElement>(null);
  const activeDragRef = useRef<{
    tempId: string;
    parentKey: string;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const dropTargetRef = useRef<{
    tempId: string;
    parentKey: string;
    position: 'before' | 'after';
  } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isOpen) {
      dragCleanupRef.current?.();
      setNewRootTitle('');
      setActiveChildParentTempId(null);
      setNewChildTitle('');
      setDraggedSubtask(null);
      setSubtaskDropTarget(null);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const startSubtaskPointerDrag = useCallback(
    (e: React.PointerEvent, tempId: string, parentKey: string) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.stopPropagation();

      dragCleanupRef.current?.();

      activeDragRef.current = {
        tempId,
        parentKey,
        startY: e.clientY,
        isDragging: false,
      };
      dropTargetRef.current = null;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const drag = activeDragRef.current;
        if (!drag) return;

        if (!drag.isDragging) {
          if (Math.abs(moveEvent.clientY - drag.startY) < 4) return;
          drag.isDragging = true;
          document.body.style.userSelect = 'none';
          setDraggedSubtask({ tempId: drag.tempId, parentKey: drag.parentKey });
        }

        const container = subtasksContainerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        if (moveEvent.clientY < containerRect.top + 28) {
          container.scrollTop -= 8;
        } else if (moveEvent.clientY > containerRect.bottom - 28) {
          container.scrollTop += 8;
        }

        const siblingEls = Array.from(
          container.querySelectorAll<HTMLElement>('[data-subtask-node]')
        )
          .filter(
            (el) =>
              el.dataset.subtaskParent === drag.parentKey &&
              el.dataset.subtaskNode !== drag.tempId
          )
          .map((el) => ({
            tempId: el.dataset.subtaskNode || '',
            rect: el.getBoundingClientRect(),
          }))
          .filter((item) => item.tempId !== '')
          .sort((a, b) => a.rect.top - b.rect.top);

        if (siblingEls.length === 0) {
          dropTargetRef.current = null;
          setSubtaskDropTarget(null);
          return;
        }

        let nextTarget: { tempId: string; parentKey: string; position: 'before' | 'after' } = {
          tempId: siblingEls[siblingEls.length - 1].tempId,
          parentKey: drag.parentKey,
          position: 'after',
        };

        for (const item of siblingEls) {
          const midpoint = item.rect.top + item.rect.height / 2;
          if (moveEvent.clientY < midpoint) {
            nextTarget = {
              tempId: item.tempId,
              parentKey: drag.parentKey,
              position: 'before',
            };
            break;
          }
        }

        const prev = dropTargetRef.current;
        if (
          !prev ||
          prev.tempId !== nextTarget.tempId ||
          prev.parentKey !== nextTarget.parentKey ||
          prev.position !== nextTarget.position
        ) {
          dropTargetRef.current = nextTarget;
          setSubtaskDropTarget(nextTarget);
        }
      };

      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        document.body.style.userSelect = '';
        dragCleanupRef.current = null;
      };

      const handlePointerUp = () => {
        const drag = activeDragRef.current;
        const target = dropTargetRef.current;

        if (drag?.isDragging && target) {
          onReorderSiblings(drag.parentKey, drag.tempId, target.tempId, target.position);
        }

        activeDragRef.current = null;
        dropTargetRef.current = null;
        setDraggedSubtask(null);
        setSubtaskDropTarget(null);
        cleanup();
      };

      dragCleanupRef.current = cleanup;
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [onReorderSiblings]
  );

  const handleAddRoot = () => {
    if (onAddRoot(newRootTitle)) {
      setNewRootTitle('');
    }
  };

  const handleAddChild = (parentTempId: string) => {
    if (onAddChild(parentTempId, newChildTitle)) {
      setNewChildTitle('');
      setActiveChildParentTempId(null);
    }
  };

  const renderSubtaskNodes = (
    list: ModalSubtaskNode[],
    parentKey: string,
    depth: number
  ): React.ReactNode => {
    const theme = SUBTASK_DEPTH_THEME[depth] || SUBTASK_DEPTH_THEME[3];
    const childTheme = SUBTASK_DEPTH_THEME[Math.min(depth + 1, 3)];

    return (
      <div className={`space-y-1.5 ${depth > 0 ? theme.branchClass : ''}`}>
        {list.map((sub) => {
          const isAddingChildHere = activeChildParentTempId === sub.tempId;
          const isDragged = draggedSubtask?.tempId === sub.tempId;
          const isDropBefore =
            subtaskDropTarget?.tempId === sub.tempId &&
            subtaskDropTarget?.parentKey === parentKey &&
            subtaskDropTarget?.position === 'before';
          const isDropAfter =
            subtaskDropTarget?.tempId === sub.tempId &&
            subtaskDropTarget?.parentKey === parentKey &&
            subtaskDropTarget?.position === 'after';

          return (
            <div
              key={sub.tempId}
              data-subtask-node={sub.tempId}
              data-subtask-parent={parentKey}
              className={`relative space-y-1.5 transition-opacity ${
                isDragged
                  ? 'opacity-40 ring-2 ring-[var(--cdh-accent)]/60 rounded-cdh-lg bg-[var(--cdh-accent-soft)]'
                  : ''
              }`}
            >
              {isDropBefore && (
                <div className="pointer-events-none absolute -top-1 left-0 right-0 z-10 h-1 rounded-full bg-[var(--cdh-accent)] shadow-xs" />
              )}

              <div
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('input, button, select, textarea, a')) return;
                  startSubtaskPointerDrag(e, sub.tempId, parentKey);
                }}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-cdh-lg border text-xs transition-all group/sub select-none touch-none ${theme.modalCardClass}`}
                title={`${theme.label} — Glisser la poignée pour réordonner`}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <button
                    type="button"
                    aria-label={`Réordonner « ${sub.title || 'sous-tâche'} »`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startSubtaskPointerDrag(e, sub.tempId, parentKey);
                    }}
                    className="p-0.5 -ml-0.5 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] cursor-grab active:cursor-grabbing shrink-0 touch-none rounded hover:bg-[var(--cdh-surface-control)]"
                    title="Maintenir et glisser pour réordonner"
                  >
                    <GripVertical className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>

                  {depth === 0 ? (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dotClass}`} />
                  ) : (
                    <CornerDownRight
                      className={`w-3.5 h-3.5 shrink-0 ${theme.iconColorClass}`}
                      strokeWidth={1.75}
                    />
                  )}

                  <button
                    type="button"
                    aria-pressed={sub.is_done}
                    aria-label={
                      sub.is_done
                        ? `Marquer « ${sub.title} » comme à faire`
                        : `Marquer « ${sub.title} » comme terminée`
                    }
                    onClick={() => onToggle(sub.tempId)}
                    className="flex items-center shrink-0 cursor-pointer"
                  >
                    <BlurredIconSwap
                      active={sub.is_done}
                      activeIcon={
                        <CheckSquare
                          className="w-4 h-4 text-[var(--cdh-success)]"
                          strokeWidth={1.75}
                        />
                      }
                      inactiveIcon={
                        <Square
                          className="w-4 h-4 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-secondary)]"
                          strokeWidth={1.75}
                        />
                      }
                    />
                  </button>

                  <input
                    type="text"
                    aria-label="Intitulé de la sous-étape"
                    value={sub.title}
                    onChange={(e) => onUpdateTitle(sub.tempId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.target as HTMLElement).blur();
                      }
                    }}
                    className={`flex-1 bg-transparent border-0 p-0 text-xs font-medium focus:outline-none focus:ring-0 min-w-0 select-text ${
                      sub.is_done
                        ? 'line-through text-[var(--cdh-text-tertiary)]'
                        : 'text-[var(--cdh-text-primary)]'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {sub.children.length > 0 && (
                    <span className="text-[11px] font-semibold text-[var(--cdh-text-secondary)] bg-[var(--cdh-surface-control)] px-1.5 py-0.5 rounded-full tabular-nums">
                      {sub.children.length}
                    </span>
                  )}

                  {depth < 3 && (
                    <button
                      type="button"
                      aria-label={`Ajouter une sous-étape à ${sub.title}`}
                      onClick={() => {
                        setActiveChildParentTempId(isAddingChildHere ? null : sub.tempId);
                        setNewChildTitle('');
                      }}
                      className="p-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] hover:bg-[var(--cdh-accent-soft)] rounded-lg cursor-pointer transition-colors"
                      title="Ajouter une sous-étape imbriquée"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label={`Supprimer ${sub.title}`}
                    onClick={() => onRemove(sub.tempId)}
                    className="p-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-danger)] hover:bg-[var(--cdh-danger-soft)] rounded-lg cursor-pointer transition-colors"
                    title="Supprimer cette sous-tâche et ses sous-étapes"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {isDropAfter && (
                <div className="pointer-events-none absolute -bottom-1 left-0 right-0 z-10 h-1 rounded-full bg-[var(--cdh-accent)] shadow-xs" />
              )}

              {sub.children.length > 0 && renderSubtaskNodes(sub.children, sub.tempId, depth + 1)}

              {isAddingChildHere && (
                <div className={`${childTheme.branchClass} flex items-center gap-2 py-1`}>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nouvelle sous-étape..."
                    value={newChildTitle}
                    onChange={(e) => setNewChildTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChild(sub.tempId);
                      } else if (e.key === 'Escape') {
                        setActiveChildParentTempId(null);
                      }
                    }}
                    className="flex-1 min-w-0 px-2.5 py-1 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-sm text-xs text-[var(--cdh-text-primary)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:border-[var(--cdh-border-focus)] focus:outline-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={() => handleAddChild(sub.tempId)}
                  >
                    Ajouter
                  </Button>
                  <button
                    type="button"
                    aria-label="Annuler l'ajout"
                    onClick={() => setActiveChildParentTempId(null)}
                    className="p-1 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-text-primary)] cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor={rootInputId}
          className="text-[11px] font-bold text-[var(--cdh-text-secondary)] uppercase tracking-wider"
        >
          Sous-tâches
        </label>
        {stats.total > 0 && (
          <span className="text-[11px] text-[var(--cdh-text-secondary)] font-semibold bg-[var(--cdh-surface-control)] px-2 py-0.5 rounded-full tabular-nums">
            {stats.done}/{stats.total} validées
          </span>
        )}
      </div>

      {nodes.length > 0 && (
        <div ref={subtasksContainerRef} className="max-h-52 overflow-y-auto pr-1 py-0.5">
          {renderSubtaskNodes(nodes, 'root', 0)}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          id={rootInputId}
          type="text"
          placeholder="Ajouter une étape..."
          value={newRootTitle}
          onChange={(e) => setNewRootTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddRoot();
            }
          }}
          className="flex-1 min-w-0 px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-xs text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)] focus:outline-none"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleAddRoot}
          leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2} />}
          className="shrink-0"
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
};
