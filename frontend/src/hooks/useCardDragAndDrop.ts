import React, { useCallback, useRef, useState } from 'react';
import { Task } from '../types';

interface DropTarget<ContainerId> {
  containerId: ContainerId;
  taskId: number;
  position: 'before' | 'after';
}

interface UseCardDragAndDropOptions<ContainerId> {
  tasks: Task[];
  getContainerId: (task: Task) => ContainerId;
  isReadOnly: boolean;
  onDropReorder: (
    draggedTask: Task,
    targetContainerId: ContainerId,
    orderedTaskIds: number[]
  ) => void;
}

export function useCardDragAndDrop<ContainerId>({
  tasks,
  getContainerId,
  isReadOnly,
  onDropReorder,
}: UseCardDragAndDropOptions<ContainerId>) {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [activeDropContainer, setActiveDropContainer] = useState<ContainerId | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget<ContainerId> | null>(null);

  const draggedTaskIdRef = useRef<number | null>(null);
  const dropTargetRef = useRef<DropTarget<ContainerId> | null>(null);
  const activeContainerRef = useRef<ContainerId | null>(null);
  draggedTaskIdRef.current = draggedTaskId;
  dropTargetRef.current = dropTarget;
  activeContainerRef.current = activeDropContainer;

  const resetDragState = useCallback(() => {
    setDraggedTaskId(null);
    setActiveDropContainer(null);
    setDropTarget(null);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, task: Task) => {
      if (isReadOnly || !task.can_edit) return;
      e.dataTransfer.setData('text/plain', String(task.id));
      e.dataTransfer.effectAllowed = 'move';
      setDraggedTaskId(task.id);
    },
    [isReadOnly]
  );

  const handleDragOverContainer = useCallback(
    (e: React.DragEvent, containerId: ContainerId) => {
      if (isReadOnly) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (activeContainerRef.current !== containerId) {
        setActiveDropContainer(containerId);
      }
      if (dropTargetRef.current && dropTargetRef.current.containerId !== containerId) {
        setDropTarget(null);
      }
    },
    [isReadOnly]
  );

  const handleDragLeaveContainer = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    if (!related) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (
        e.clientX > rect.left &&
        e.clientX < rect.right &&
        e.clientY > rect.top &&
        e.clientY < rect.bottom
      ) {
        return;
      }
    }
    setActiveDropContainer(null);
    setDropTarget(null);
  }, []);

  const handleDragOverCard = useCallback(
    (e: React.DragEvent, targetTask: Task, containerId?: ContainerId) => {
      const currentDraggedId = draggedTaskIdRef.current;
      if (isReadOnly || !currentDraggedId || currentDraggedId === targetTask.id) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';

      const resolvedContainerId = containerId !== undefined ? containerId : getContainerId(targetTask);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const position: 'before' | 'after' =
        e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

      if (activeContainerRef.current !== resolvedContainerId) {
        setActiveDropContainer(resolvedContainerId);
      }
      const curTarget = dropTargetRef.current;
      if (
        curTarget?.containerId !== resolvedContainerId ||
        curTarget?.taskId !== targetTask.id ||
        curTarget?.position !== position
      ) {
        setDropTarget({ containerId: resolvedContainerId, taskId: targetTask.id, position });
      }
    },
    [isReadOnly, getContainerId]
  );

  const handleDropOnCard = useCallback(
    (e: React.DragEvent, targetTask: Task, containerId?: ContainerId) => {
      e.preventDefault();
      e.stopPropagation();

      const idStr = e.dataTransfer.getData('text/plain');
      const taskId = Number(idStr) || draggedTaskIdRef.current;
      const draggedTask = tasks.find((t) => t.id === taskId);

      if (isReadOnly || !draggedTask || !draggedTask.can_edit || draggedTask.id === targetTask.id) {
        resetDragState();
        return;
      }

      const resolvedContainerId = containerId !== undefined ? containerId : getContainerId(targetTask);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const position: 'before' | 'after' =
        e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

      const containerTaskIds = tasks
        .filter((t) => getContainerId(t) === resolvedContainerId && t.id !== draggedTask.id)
        .map((t) => t.id);

      const targetIndex = containerTaskIds.indexOf(targetTask.id);
      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
      containerTaskIds.splice(
        insertIndex < 0 ? containerTaskIds.length : insertIndex,
        0,
        draggedTask.id
      );

      onDropReorder(draggedTask, resolvedContainerId, containerTaskIds);
      resetDragState();
    },
    [tasks, getContainerId, isReadOnly, onDropReorder, resetDragState]
  );

  const handleDropOnContainer = useCallback(
    (e: React.DragEvent, containerId: ContainerId) => {
      e.preventDefault();
      const idStr = e.dataTransfer.getData('text/plain');
      const taskId = Number(idStr) || draggedTaskIdRef.current;
      const draggedTask = tasks.find((t) => t.id === taskId);

      if (isReadOnly || !draggedTask || !draggedTask.can_edit) {
        resetDragState();
        return;
      }

      const containerTaskIds = tasks
        .filter((t) => getContainerId(t) === containerId && t.id !== draggedTask.id)
        .map((t) => t.id);

      const curTarget = dropTargetRef.current;
      if (curTarget && curTarget.containerId === containerId) {
        const targetIndex = containerTaskIds.indexOf(curTarget.taskId);
        if (targetIndex !== -1) {
          const insertIndex = curTarget.position === 'after' ? targetIndex + 1 : targetIndex;
          containerTaskIds.splice(insertIndex, 0, draggedTask.id);
          onDropReorder(draggedTask, containerId, containerTaskIds);
          resetDragState();
          return;
        }
      }

      const cardEls = Array.from(
        (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-task-card-id]')
      ).filter((el) => Number(el.dataset.taskCardId) !== draggedTask.id);

      let insertIndex = containerTaskIds.length;
      for (const el of cardEls) {
        const cardId = Number(el.dataset.taskCardId);
        const rect = el.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          const idx = containerTaskIds.indexOf(cardId);
          if (idx !== -1) {
            insertIndex = idx;
            break;
          }
        }
      }
      containerTaskIds.splice(insertIndex, 0, draggedTask.id);

      onDropReorder(draggedTask, containerId, containerTaskIds);
      resetDragState();
    },
    [tasks, getContainerId, isReadOnly, onDropReorder, resetDragState]
  );

  return {
    draggedTaskId,
    activeDropContainer,
    dropTarget,
    resetDragState,
    handleDragStart,
    handleDragOverContainer,
    handleDragLeaveContainer,
    handleDragOverCard,
    handleDropOnCard,
    handleDropOnContainer,
  };
}
