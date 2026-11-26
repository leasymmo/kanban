import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Task, User, Property, TaskPriority, TaskStatus } from '../types';
import { buildSubtaskTree, HierarchicalSubtask, SUBTASK_DEPTH_THEME } from '../utils/subtasks';
import { BlurredIconSwap } from './BlurredIconSwap';
import {
  X, Plus, Trash2, Home, CheckSquare, Square,
  AlertCircle, CornerDownRight, Check, Star,
  GripVertical, Zap, ClipboardList, Layers, Sparkles
} from 'lucide-react';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  sprintId: number;
  currentUser: User | null;
  users: User[];
  properties: Property[];
  initialStatus?: TaskStatus;
  initialPropertyId?: number | null;
  initialAssignedTo?: number | null;
  creationSource?: 'tasks' | 'meeting';
  onSave: (taskData: any) => Promise<void>;
}

interface ModalSubtaskNode {
  id?: number;
  tempId: string;
  title: string;
  is_done: boolean;
  children: ModalSubtaskNode[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  task,
  sprintId,
  currentUser,
  users,
  properties,
  initialStatus = 'todo',
  initialPropertyId = null,
  initialAssignedTo,
  creationSource = 'tasks',
  onSave
}) => {
  const isEdit = !!task;
  const isAdmin = currentUser?.role === 'admin';
  const canEditAssignee = isAdmin || currentUser?.role === 'write';
  const assignableUsers = isAdmin
    ? users
    : users.filter(u => u.id === currentUser?.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [assignedTo, setAssignedTo] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState('');
  const [isStarred, setIsStarred] = useState(false);

  // Arborescence des sous-tâches & Drag-and-Drop par Pointer Events
  const [subtaskTree, setSubtaskTree] = useState<ModalSubtaskNode[]>([]);
  const [newRootTitle, setNewRootTitle] = useState('');
  const [activeChildParentTempId, setActiveChildParentTempId] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [draggedSubtask, setDraggedSubtask] = useState<{ tempId: string; parentKey: string } | null>(null);
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const mapTree = (nodes: HierarchicalSubtask[], depth = 0): ModalSubtaskNode[] => {
      return nodes.map((n, idx) => ({
        id: n.id,
        tempId: `loaded-${n.id}-${idx}-${depth}`,
        title: n.title,
        is_done: !!n.is_done,
        children: depth < 3 && n.children ? mapTree(n.children, depth + 1) : []
      }));
    };

    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status === 'pending' ? 'todo' : task.status);
      setPriority(task.priority);
      setPropertyId(task.property_id || '');
      setSelectedPropertyIds(task.property_id ? [task.property_id] : []);
      setAssignedTo(task.assigned_to || currentUser?.id || assignableUsers[0]?.id || '');
      setDueDate(task.due_date ? task.due_date.substring(0, 10) : '');
      setIsStarred(!!task.is_starred);
      setSubtaskTree(mapTree(buildSubtaskTree(task.subtasks || [])));
    } else {
      setTitle('');
      setDescription('');
      setStatus(initialStatus || 'todo');
      setPriority('medium');
      setPropertyId(initialPropertyId || '');
      setSelectedPropertyIds(initialPropertyId ? [initialPropertyId] : []);
      if (isAdmin) {
        if (initialAssignedTo !== undefined) {
          setAssignedTo(initialAssignedTo || '');
        } else {
          setAssignedTo(currentUser?.id || assignableUsers[0]?.id || '');
        }
      } else {
        setAssignedTo(currentUser?.id || assignableUsers[0]?.id || '');
      }
      setDueDate('');
      setIsStarred(false);
      setSubtaskTree([]);
    }
    setNewRootTitle('');
    setActiveChildParentTempId(null);
    setNewChildTitle('');
    setDraggedSubtask(null);
    setSubtaskDropTarget(null);
    activeDragRef.current = null;
    dropTargetRef.current = null;
    dragCleanupRef.current?.();
    setError(null);
  }, [task, isOpen, initialStatus, initialPropertyId, initialAssignedTo, isAdmin, currentUser?.id]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const reorderSiblingsInTree = useCallback((
    nodes: ModalSubtaskNode[],
    parentKey: string,
    draggedTempId: string,
    targetTempId: string,
    position: 'before' | 'after'
  ): ModalSubtaskNode[] => {
    if (parentKey === 'root') {
      const fromIdx = nodes.findIndex(n => n.tempId === draggedTempId);
      const toIdx = nodes.findIndex(n => n.tempId === targetTempId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return nodes;

      const copy = [...nodes];
      const [moved] = copy.splice(fromIdx, 1);
      const adjustedTargetIdx = copy.findIndex(n => n.tempId === targetTempId);
      const insertIdx = position === 'after' ? adjustedTargetIdx + 1 : adjustedTargetIdx;
      copy.splice(insertIdx, 0, moved);
      return copy;
    }

    return nodes.map(node => {
      if (node.tempId === parentKey) {
        const fromIdx = node.children.findIndex(c => c.tempId === draggedTempId);
        const toIdx = node.children.findIndex(c => c.tempId === targetTempId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return node;

        const copy = [...node.children];
        const [moved] = copy.splice(fromIdx, 1);
        const adjustedTargetIdx = copy.findIndex(c => c.tempId === targetTempId);
        const insertIdx = position === 'after' ? adjustedTargetIdx + 1 : adjustedTargetIdx;
        copy.splice(insertIdx, 0, moved);
        return { ...node, children: copy };
      }

      if (node.children.length > 0) {
        return {
          ...node,
          children: reorderSiblingsInTree(node.children, parentKey, draggedTempId, targetTempId, position)
        };
      }
      return node;
    });
  }, []);

  const startSubtaskPointerDrag = useCallback((
    e: React.PointerEvent,
    tempId: string,
    parentKey: string
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();

    dragCleanupRef.current?.();

    activeDragRef.current = {
      tempId,
      parentKey,
      startY: e.clientY,
      isDragging: false
    };
    dropTargetRef.current = null;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const drag = activeDragRef.current;
      if (!drag) return;

      if (!drag.isDragging) {
        if (Math.abs(moveEvent.clientY - drag.startY) < 4) {
          return;
        }
        drag.isDragging = true;
        document.body.style.userSelect = 'none';
        setDraggedSubtask({ tempId: drag.tempId, parentKey: drag.parentKey });
      }

      const container = subtasksContainerRef.current;
      if (!container) return;

      // Auto-scroll fluide si le pointeur approche les bords haut/bas du conteneur
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
          el =>
            el.dataset.subtaskParent === drag.parentKey &&
            el.dataset.subtaskNode !== drag.tempId
        )
        .map(el => ({
          tempId: el.dataset.subtaskNode || '',
          rect: el.getBoundingClientRect()
        }))
        .filter(item => item.tempId !== '')
        .sort((a, b) => a.rect.top - b.rect.top);

      if (siblingEls.length === 0) {
        dropTargetRef.current = null;
        setSubtaskDropTarget(null);
        return;
      }

      let nextTarget: { tempId: string; parentKey: string; position: 'before' | 'after' } = {
        tempId: siblingEls[siblingEls.length - 1].tempId,
        parentKey: drag.parentKey,
        position: 'after'
      };

      for (const item of siblingEls) {
        const midpoint = item.rect.top + item.rect.height / 2;
        if (moveEvent.clientY < midpoint) {
          nextTarget = {
            tempId: item.tempId,
            parentKey: drag.parentKey,
            position: 'before'
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
        setSubtaskTree(prev =>
          reorderSiblingsInTree(prev, drag.parentKey, drag.tempId, target.tempId, target.position)
        );
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
  }, [reorderSiblingsInTree]);

  if (!isOpen) return null;

  const toggleSelectedProperty = (propId: number) => {
    setSelectedPropertyIds(prev =>
      prev.includes(propId) ? prev.filter(id => id !== propId) : [...prev, propId]
    );
  };

  const updateTreeNodes = (
    nodes: ModalSubtaskNode[],
    updater: (node: ModalSubtaskNode) => ModalSubtaskNode | null
  ): ModalSubtaskNode[] => {
    const result: ModalSubtaskNode[] = [];
    for (const node of nodes) {
      const updated = updater({
        ...node,
        children: updateTreeNodes(node.children, updater)
      });
      if (updated) {
        result.push(updated);
      }
    }
    return result;
  };

  const countSubtasksRecursive = (nodes: ModalSubtaskNode[]): { total: number; done: number } => {
    let total = 0;
    let done = 0;
    for (const n of nodes) {
      total += 1;
      if (n.is_done) done += 1;
      if (n.children.length > 0) {
        const sub = countSubtasksRecursive(n.children);
        total += sub.total;
        done += sub.done;
      }
    }
    return { total, done };
  };

  const handleAddRootSubtask = () => {
    if (!newRootTitle.trim()) return;
    const newNode: ModalSubtaskNode = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      title: newRootTitle.trim(),
      is_done: false,
      children: []
    };
    setSubtaskTree(prev => [...prev, newNode]);
    setNewRootTitle('');
  };

  const handleAddChildSubtask = (parentTempId: string) => {
    if (!newChildTitle.trim()) return;
    const newChild: ModalSubtaskNode = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      title: newChildTitle.trim(),
      is_done: false,
      children: []
    };

    setSubtaskTree(prev =>
      updateTreeNodes(prev, node => {
        if (node.tempId === parentTempId) {
          return { ...node, children: [...node.children, newChild] };
        }
        return node;
      })
    );
    setNewChildTitle('');
    setActiveChildParentTempId(null);
  };

  const handleRemoveSubtask = (tempId: string) => {
    setSubtaskTree(prev => updateTreeNodes(prev, node => (node.tempId === tempId ? null : node)));
  };

  const handleToggleSubtask = (tempId: string) => {
    setSubtaskTree(prev =>
      updateTreeNodes(prev, node => (node.tempId === tempId ? { ...node, is_done: !node.is_done } : node))
    );
  };

  const handleUpdateSubtaskTitle = (tempId: string, newTitle: string) => {
    setSubtaskTree(prev =>
      updateTreeNodes(prev, node => (node.tempId === tempId ? { ...node, title: newTitle } : node))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Le titre de la tâche est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formattedSubtasks: any[] = [];
      let pos = 1;
      const flatten = (
        nodes: ModalSubtaskNode[],
        parentDbId: number | null,
        parentTempId: string | null
      ) => {
        for (const node of nodes) {
          if (!node.title.trim()) continue;
          formattedSubtasks.push({
            id: node.id,
            temp_id: node.tempId,
            parent_id: parentDbId,
            parent_temp_id: parentDbId ? null : parentTempId,
            title: node.title.trim(),
            is_done: node.is_done ? 1 : 0,
            position: pos++
          });
          if (node.children.length > 0) {
            flatten(node.children, node.id || null, node.id ? null : node.tempId);
          }
        }
      };
      flatten(subtaskTree, null, null);

      const effectiveAssignedTo = isAdmin
        ? (assignedTo !== '' ? Number(assignedTo) : null)
        : (currentUser?.id ?? null);

      if (!effectiveAssignedTo) {
        setError('Un associé responsable est obligatoire.');
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        sprint_id: sprintId,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigned_to: effectiveAssignedTo,
        due_date: dueDate || null,
        is_starred: isStarred ? 1 : 0,
        subtasks: formattedSubtasks
      };

      if (isEdit && task) {
        payload.id = task.id;
        payload.property_id = propertyId !== '' ? Number(propertyId) : null;
      } else {
        payload.property_ids = selectedPropertyIds;
        payload.created_from = creationSource;
        payload.is_unplanned = creationSource === 'tasks' ? 1 : 0;
      }

      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors de l’enregistrement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const multiCount = !isEdit ? selectedPropertyIds.length : 1;
  const isMultiCreate = !isEdit && multiCount > 1;
  const { total: totalSubtasksCount, done: doneSubtasksCount } = countSubtasksRecursive(subtaskTree);
  const showUnplannedBadge = isEdit ? !!task?.is_unplanned : creationSource === 'tasks';

  const renderSubtaskNodes = (nodes: ModalSubtaskNode[], parentKey: string, depth: number) => {
    const theme = SUBTASK_DEPTH_THEME[depth] || SUBTASK_DEPTH_THEME[3];
    const childTheme = SUBTASK_DEPTH_THEME[Math.min(depth + 1, 3)];

    return (
      <div className={`space-y-1.5 ${depth > 0 ? theme.branchClass : ''}`}>
        {nodes.map((sub) => {
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
                isDragged ? 'opacity-40 ring-2 ring-brand-400/60 rounded-xl bg-brand-50/30' : ''
              }`}
            >
              {isDropBefore && (
                <div className="pointer-events-none absolute -top-1 left-0 right-0 z-10 h-1 rounded-full bg-brand-500 shadow-xs" />
              )}

              <div
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('input, button, select, textarea, a')) return;
                  startSubtaskPointerDrag(e, sub.tempId, parentKey);
                }}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all group/sub select-none ${theme.modalCardClass}`}
                title={`${theme.label} — Glisser la poignée pour réordonner`}
              >
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      startSubtaskPointerDrag(e, sub.tempId, parentKey);
                    }}
                    className="p-0.5 -ml-0.5 text-slate-400 hover:text-slate-700 group-hover/sub:text-slate-600 cursor-grab active:cursor-grabbing shrink-0 touch-none rounded hover:bg-slate-200/60"
                    title="Maintenir et glisser pour réordonner"
                  >
                    <GripVertical className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>

                  {depth === 0 ? (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dotClass}`} />
                  ) : (
                    <CornerDownRight className={`w-3.5 h-3.5 shrink-0 ${theme.iconColorClass}`} strokeWidth={1.75} />
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(sub.tempId)}
                    className="flex items-center shrink-0 cursor-pointer"
                  >
                    <BlurredIconSwap
                      active={sub.is_done}
                      activeIcon={<CheckSquare className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />}
                      inactiveIcon={<Square className="w-4 h-4 text-slate-300 hover:text-slate-400" strokeWidth={1.75} />}
                    />
                  </button>

                  <input
                    type="text"
                    value={sub.title}
                    onChange={(e) => handleUpdateSubtaskTitle(sub.tempId, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.target as HTMLElement).blur();
                      }
                    }}
                    className={`flex-1 bg-transparent border-0 p-0 text-xs font-medium focus:outline-none focus:ring-0 min-w-0 select-text ${
                      sub.is_done ? 'line-through text-slate-400' : 'text-slate-800'
                    }`}
                  />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {sub.children.length > 0 && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                      {sub.children.length}
                    </span>
                  )}

                  {depth < 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveChildParentTempId(isAddingChildHere ? null : sub.tempId);
                        setNewChildTitle('');
                      }}
                      className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg cursor-pointer transition-colors"
                      title="Ajouter une sous-étape imbriquée"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(sub.tempId)}
                    className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                    title="Supprimer cette sous-tâche et ses sous-étapes"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {isDropAfter && (
                <div className="pointer-events-none absolute -bottom-1 left-0 right-0 z-10 h-1 rounded-full bg-brand-500 shadow-xs" />
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
                        handleAddChildSubtask(sub.tempId);
                      } else if (e.key === 'Escape') {
                        setActiveChildParentTempId(null);
                      }
                    }}
                    className="flex-1 px-2.5 py-1 border border-brand-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddChildSubtask(sub.tempId)}
                    className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveChildParentTempId(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-black/[0.12] overflow-hidden max-h-[92dvh] flex flex-col">

        {/* Header adaptatif */}
        <div className={`text-white p-4 sm:p-5 flex items-center justify-between border-b shrink-0 transition-colors ${
          isMultiCreate
            ? 'bg-gradient-to-r from-indigo-950 via-slate-900 to-brand-950 border-indigo-800/70'
            : 'bg-slate-900 border-slate-800'
        }`}>
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isMultiCreate ? 'text-indigo-300' : 'text-brand-400'
              }`}>
                {isEdit
                  ? 'Détails de la tâche'
                  : isMultiCreate
                  ? `Création simultanée • ${multiCount} logements`
                  : 'Nouvelle tâche'}
              </span>

              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                showUnplannedBadge
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : (isEdit && task?.is_new)
                  ? 'bg-violet-500/20 text-violet-200 border border-violet-400/30'
                  : 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
              }`}>
                {showUnplannedBadge ? (
                  <>
                    <Zap className="w-2.5 h-2.5" strokeWidth={2.25} />
                    Réalisation complémentaire
                  </>
                ) : (isEdit && task?.is_new) ? (
                  <>
                    <Sparkles className="w-2.5 h-2.5" strokeWidth={2.25} />
                    Nouveau (préparé en réunion)
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-2.5 h-2.5" strokeWidth={2.25} />
                    Tâche planifiée
                  </>
                )}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold truncate mt-0.5">
              {isEdit
                ? task.title
                : isMultiCreate
                ? `Créer ${multiCount} tâches similaires pour le sprint`
                : 'Créer une tâche pour le sprint'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Formulaire avec corps scrollable et footer fixe */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">

            {error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                <span>{error}</span>
              </div>
            )}

            {/* Bandeau explicatif si création multiple */}
            {isMultiCreate && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs flex items-start gap-2.5">
                <Layers className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" strokeWidth={2.25} />
                <div>
                  <p className="font-bold">
                    {multiCount} tâches identiques vont être créées simultanément (une par logement sélectionné) :
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {properties
                      .filter(p => selectedPropertyIds.includes(p.id))
                      .map(p => (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
                          style={{ backgroundColor: p.color || '#3B82F6' }}
                        >
                          {p.name}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Titre */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Intitulé {isMultiCreate ? 'des tâches' : 'de la tâche'} *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Vérifier le détecteur de fumée, Changer les piles serrure..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-black/[0.12] rounded-lg text-sm text-slate-800 font-medium focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Description & Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Notes & Commentaires (format « → ... »)
              </label>
              <textarea
                rows={2}
                placeholder="Ex: Dans l'attente du retour devis, contact pris..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Logement concerné (Multi-sélection en création / Simple en édition) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {isEdit ? 'Logement concerné' : 'Logement(s) concerné(s)'}
                </label>
                {!isEdit && properties.length > 0 && (
                  <div className="flex items-center gap-2 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSelectedPropertyIds(properties.map(p => p.id))}
                      className="text-brand-600 hover:text-brand-800 cursor-pointer"
                    >
                      Tout sélectionner
                    </button>
                    {selectedPropertyIds.length > 0 && (
                      <>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedPropertyIds([])}
                          className="text-slate-500 hover:text-slate-700 cursor-pointer"
                        >
                          Aucun (tâche générale)
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {isEdit ? (
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="">Aucun / Tâche générale</option>
                  {task?.property_id && !properties.some(p => p.id === task.property_id) && (
                    <option value={task.property_id}>
                      {task.property_name || `Hébergement #${task.property_id}`} (désactivé)
                    </option>
                  )}
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {Number(p.is_active) === 0 ? `${p.name} (désactivé)` : p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 rounded-[18px] border border-black/[0.12] bg-slate-50/70 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {properties.map((p) => {
                      const isSelected = selectedPropertyIds.includes(p.id);
                      const isDeactivated = Number(p.is_active) === 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleSelectedProperty(p.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'text-white border-transparent shadow-xs'
                              : 'bg-white text-slate-700 border-black/[0.12] hover:border-black/[0.22] hover:bg-slate-50'
                          }`}
                          style={isSelected ? { backgroundColor: p.color || '#3B82F6' } : {}}
                        >
                          <Home className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-slate-400'}`} strokeWidth={2} />
                          <span>{isDeactivated ? `${p.name} (désactivé)` : p.name}</span>
                          {isSelected && <Check className="w-3 h-3 ml-0.5" strokeWidth={2} />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {selectedPropertyIds.length === 0
                      ? 'Aucun logement sélectionné → 1 tâche générale (sans logement) sera créée.'
                      : selectedPropertyIds.length === 1
                      ? '1 logement sélectionné → 1 tâche sera créée pour ce logement.'
                      : `${selectedPropertyIds.length} logements sélectionnés → ${selectedPropertyIds.length} tâches similaires seront créées en simultané.`}
                  </p>
                </div>
              )}
            </div>

            {/* Responsable & Statut */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Responsable *
                </label>
                <select
                  required
                  value={assignedTo}
                  disabled={!canEditAssignee || !isAdmin}
                  onChange={(e) => setAssignedTo(e.target.value === '' ? '' : Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none ${
                    canEditAssignee && isAdmin
                      ? 'border-black/[0.12] bg-white text-slate-800 cursor-pointer'
                      : 'border-black/[0.12] bg-slate-100 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {assignedTo === '' && (
                    <option value="" disabled>
                      Sélectionner un associé...
                    </option>
                  )}
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {isAdmin ? `${u.name} (${u.role})` : u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Statut
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white cursor-pointer font-medium"
                >
                  <option value="todo">⏳ À faire</option>
                  <option value="in_progress">🚧 En cours</option>
                  <option value="blocked">❌ Bloqué / Litige</option>
                  <option value="done">✅ Fait (Terminé)</option>
                </select>
              </div>
            </div>

            {/* Priorité & Échéance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Priorité
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white cursor-pointer"
                >
                  <option value="low">Basse</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute / Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Échéance
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                />
              </div>
            </div>

            {/* Sous-tâches hiérarchiques avec Drag & Drop par niveau */}
            <div className="pt-3 border-t border-black/[0.12]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Sous-tâches hiérarchiques
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Glissez-déposez les poignées pour réordonner au sein de chaque niveau (jusqu'à 4 niveaux)
                  </p>
                </div>
                <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
                  {doneSubtasksCount}/{totalSubtasksCount} validées
                </span>
              </div>

              <div ref={subtasksContainerRef} className="mb-3 max-h-72 overflow-y-auto pr-1 py-1">
                {subtaskTree.length > 0 ? (
                  renderSubtaskNodes(subtaskTree, 'root', 0)
                ) : (
                  <div className="p-3 border-2 border-dashed border-black/[0.12] rounded-xl text-center text-xs text-slate-400">
                    Aucune sous-tâche. Ajoutez une première étape ci-dessous.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ajouter une étape principale..."
                  value={newRootTitle}
                  onChange={(e) => setNewRootTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddRootSubtask();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-black/[0.12] rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddRootSubtask}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  Ajouter
                </button>
              </div>
            </div>

            {/* Option Mise en avant avec Étoile */}
            <div className="pt-2 border-t border-black/[0.12] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_starred"
                  checked={isStarred}
                  onChange={(e) => setIsStarred(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 border-black/[0.12] focus:ring-amber-400 cursor-pointer"
                />
                <label htmlFor="is_starred" className="text-xs text-slate-700 select-none flex items-center gap-1.5 font-medium cursor-pointer">
                  <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400 text-amber-500' : 'text-slate-400'}`} strokeWidth={1.75} />
                  <span><strong>Mettre en avant</strong> pour la prochaine réunion hebdomadaire</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer fixe toujours accessible */}
          <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-t border-black/[0.12] flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 text-white rounded-lg text-sm font-bold shadow-md transition-all cursor-pointer ${
                isMultiCreate
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                  : 'bg-brand-600 hover:bg-brand-700 shadow-brand-600/30'
              }`}
            >
              {isSubmitting
                ? 'Enregistrement...'
                : isEdit
                ? 'Enregistrer les modifications'
                : isMultiCreate
                ? `Créer les ${multiCount} tâches`
                : 'Créer la tâche'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
