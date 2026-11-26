import React, { useState } from 'react';
import { Task } from '../types';

export interface DropTarget<ContainerId> {
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
  onDropReorder
}: UseCardDragAndDropOptions<ContainerId>) {
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [activeDropContainer, setActiveDropContainer] = useState<ContainerId | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget<ContainerId> | null>(null);

  const resetDragState = () => {
    setDraggedTaskId(null);
    setActiveDropContainer(null);
    setDropTarget(null);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (isReadOnly || !task.can_edit) return;
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(task.id);
  };

  const handleDragOverContainer = (e: React.DragEvent, containerId: ContainerId) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (activeDropContainer !== containerId) {
      setActiveDropContainer(containerId);
    }
  };

  const handleDragLeaveContainer = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setActiveDropContainer(null);
      setDropTarget(null);
    }
  };

  const handleDragOverCard = (
    e: React.DragEvent,
    targetTask: Task,
    containerId: ContainerId
  ) => {
    if (isReadOnly || !draggedTaskId || draggedTaskId === targetTask.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' =
      e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

    if (activeDropContainer !== containerId) {
      setActiveDropContainer(containerId);
    }
    if (
      dropTarget?.containerId !== containerId ||
      dropTarget?.taskId !== targetTask.id ||
      dropTarget?.position !== position
    ) {
      setDropTarget({ containerId, taskId: targetTask.id, position });
    }
  };

  const handleDropOnCard = (
    e: React.DragEvent,
    targetTask: Task,
    containerId: ContainerId
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const idStr = e.dataTransfer.getData('text/plain');
    const taskId = Number(idStr) || draggedTaskId;
    const draggedTask = tasks.find(t => t.id === taskId);

    if (isReadOnly || !draggedTask || !draggedTask.can_edit || draggedTask.id === targetTask.id) {
      resetDragState();
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' =
      e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

    const containerTaskIds = tasks
      .filter(t => getContainerId(t) === containerId && t.id !== draggedTask.id)
      .map(t => t.id);

    const targetIndex = containerTaskIds.indexOf(targetTask.id);
    const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
    containerTaskIds.splice(
      insertIndex < 0 ? containerTaskIds.length : insertIndex,
      0,
      draggedTask.id
    );

    onDropReorder(draggedTask, containerId, containerTaskIds);
    resetDragState();
  };

  const handleDropOnContainer = (e: React.DragEvent, containerId: ContainerId) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData('text/plain');
    const taskId = Number(idStr) || draggedTaskId;
    const draggedTask = tasks.find(t => t.id === taskId);

    if (isReadOnly || !draggedTask || !draggedTask.can_edit) {
      resetDragState();
      return;
    }

    const containerTaskIds = tasks
      .filter(t => getContainerId(t) === containerId && t.id !== draggedTask.id)
      .map(t => t.id);
    containerTaskIds.push(draggedTask.id);

    onDropReorder(draggedTask, containerId, containerTaskIds);
    resetDragState();
  };

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
    handleDropOnContainer
  };
}
