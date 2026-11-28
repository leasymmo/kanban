import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Task, Property, User, TaskPriority, TaskStatus } from '../types';
import { CreatedTaskBatch } from '../utils/taskMotion';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { getUserPreferences, saveUserPreferences, TaskViewMode } from '../utils/cookies';
import { TasksToolbar } from './TasksToolbar';
import { KanbanBoard } from './KanbanBoard';
import { PropertyBoard } from './PropertyBoard';
import { SprintListBoard } from './SprintListBoard';

interface TasksTabProps {
  tasks: Task[];
  properties: Property[];
  allUsers: User[];
  currentUser: User | null;
  isReadOnly: boolean;
  lastCreatedBatch?: CreatedTaskBatch | null;
  isTaskModalOpen?: boolean;
  onConsumeCreatedBatch?: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onReorderKanbanTask: (taskId: number, targetStatus: TaskStatus, orderedColumnTaskIds: number[]) => void;
  onMoveTaskProperty: (taskId: number, targetPropertyId: number | null, orderedSectionTaskIds: number[]) => void;
  onToggleStar: (taskId: number) => void;
  onOpenCreateTask: (options?: {
    status?: TaskStatus;
    propertyId?: number | null;
    assignedTo?: number | null;
    source?: 'tasks' | 'meeting';
  }) => void;
}

export const TasksTab: React.FC<TasksTabProps> = React.memo(({
  tasks,
  properties,
  allUsers,
  currentUser,
  isReadOnly,
  lastCreatedBatch,
  isTaskModalOpen = false,
  onConsumeCreatedBatch,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onAssignTask,
  onQuickUpdateTask,
  onReorderKanbanTask,
  onMoveTaskProperty,
  onToggleStar,
  onOpenCreateTask
}) => {
  const userId = currentUser?.id ?? null;
  const loadedUserIdRef = useRef<number | null>(userId);

  const [taskViewMode, setTaskViewModeState] = useState<TaskViewMode>(() => {
    if (!userId) return 'kanban';
    return getUserPreferences(userId).taskViewMode ?? 'kanban';
  });

  useEffect(() => {
    if (!userId || loadedUserIdRef.current === userId) return;
    loadedUserIdRef.current = userId;
    const prefs = getUserPreferences(userId);
    setTaskViewModeState(prefs.taskViewMode ?? 'kanban');
  }, [userId]);

  const handleChangeViewMode = useCallback(
    (mode: TaskViewMode) => {
      setTaskViewModeState(mode);
      if (userId) {
        saveUserPreferences(userId, { taskViewMode: mode });
      }
    },
    [userId]
  );

  const {
    taskFilter,
    setTaskFilter,
    taskSearchQuery,
    setTaskSearchQuery,
    hiddenPropertyIds,
    setHiddenPropertyIds,
    hiddenStatuses,
    setHiddenStatuses,
    hiddenPriorities,
    setHiddenPriorities,
    allPropertyFilterIds,
    togglePropertyVisibility,
    toggleStatusVisibility,
    togglePriorityVisibility,
    resetFilters,
    hasActiveFilters,
    facetFilteredTasks,
    filteredTasks
  } = useTaskFilters(tasks, properties, currentUser);

  const isViewingOwnTasks =
    !!currentUser && (taskFilter === 'me' || taskFilter === currentUser.id);

  const canUseBoardQuickAdd =
    !isReadOnly &&
    (currentUser?.role === 'admin' || (currentUser?.role === 'write' && isViewingOwnTasks));

  const contextualAssignedTo: number | null =
    taskFilter === 'me'
      ? (currentUser?.id ?? null)
      : typeof taskFilter === 'number' && allUsers.some(u => u.id === taskFilter)
      ? taskFilter
      : currentUser?.role === 'write'
      ? currentUser.id
      : null;

  const handleCreateDefault = useCallback(
    () =>
      onOpenCreateTask({
        status: 'todo',
        propertyId: null,
        assignedTo: contextualAssignedTo,
        source: 'tasks',
      }),
    [onOpenCreateTask, contextualAssignedTo]
  );

  const handleCreateForStatus = useCallback(
    (initialStatus?: TaskStatus) =>
      onOpenCreateTask({
        status: initialStatus || 'todo',
        propertyId: null,
        assignedTo: contextualAssignedTo,
        source: 'tasks',
      }),
    [onOpenCreateTask, contextualAssignedTo]
  );

  const handleCreateForProperty = useCallback(
    (propertyId?: number) =>
      onOpenCreateTask({
        status: 'todo',
        propertyId: propertyId ?? null,
        assignedTo: contextualAssignedTo,
        source: 'tasks',
      }),
    [onOpenCreateTask, contextualAssignedTo]
  );

  const handleShowAllSprint = useCallback(() => setTaskFilter('all'), [setTaskFilter]);

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-2.5 sm:gap-3">
      <h2 className="sr-only">Gestion des tâches du sprint</h2>
      <TasksToolbar
        currentUser={currentUser}
        allUsers={allUsers}
        properties={properties}
        facetFilteredTasks={facetFilteredTasks}
        taskFilter={taskFilter}
        onChangeTaskFilter={setTaskFilter}
        taskSearchQuery={taskSearchQuery}
        onChangeSearchQuery={setTaskSearchQuery}
        hiddenPropertyIds={hiddenPropertyIds}
        allPropertyFilterIds={allPropertyFilterIds}
        onToggleProperty={togglePropertyVisibility}
        onSetHiddenProperties={setHiddenPropertyIds}
        hiddenStatuses={hiddenStatuses}
        onToggleStatus={toggleStatusVisibility}
        onSetHiddenStatuses={setHiddenStatuses}
        hiddenPriorities={hiddenPriorities}
        onTogglePriority={togglePriorityVisibility}
        onSetHiddenPriorities={setHiddenPriorities}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        taskViewMode={taskViewMode}
        onChangeViewMode={handleChangeViewMode}
        isReadOnly={isReadOnly}
        onAddNewTask={handleCreateDefault}
      />

      {taskViewMode === 'kanban' ? (
        <KanbanBoard
          tasks={filteredTasks}
          allUsers={allUsers}
          currentUser={currentUser}
          hiddenStatuses={hiddenStatuses}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onToggleSubtask={onToggleSubtask}
          onAddSubtask={onAddSubtask}
          onUpdateStatus={onUpdateStatus}
          onAssignTask={onAssignTask}
          onQuickUpdateTask={onQuickUpdateTask}
          onReorderTask={onReorderKanbanTask}
          onToggleStar={onToggleStar}
          onAddNewTask={handleCreateForStatus}
          canAddTasks={canUseBoardQuickAdd}
          isReadOnly={isReadOnly}
          lastCreatedBatch={lastCreatedBatch}
          isModalOpen={isTaskModalOpen}
          onConsumeCreatedBatch={onConsumeCreatedBatch}
        />
      ) : taskViewMode === 'property' ? (
        <PropertyBoard
          tasks={filteredTasks}
          properties={properties}
          allUsers={allUsers}
          hiddenPropertyIds={hiddenPropertyIds}
          currentUser={currentUser}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onToggleSubtask={onToggleSubtask}
          onAddSubtask={onAddSubtask}
          onUpdateStatus={onUpdateStatus}
          onAssignTask={onAssignTask}
          onQuickUpdateTask={onQuickUpdateTask}
          onMoveTaskProperty={onMoveTaskProperty}
          onToggleStar={onToggleStar}
          onAddNewTask={handleCreateForProperty}
          canAddTasks={canUseBoardQuickAdd}
          isReadOnly={isReadOnly}
          lastCreatedBatch={lastCreatedBatch}
          isModalOpen={isTaskModalOpen}
          onConsumeCreatedBatch={onConsumeCreatedBatch}
        />
      ) : (
        <SprintListBoard
          tasks={filteredTasks}
          allUsers={allUsers}
          currentUser={currentUser}
          isFilteredByAssignee={taskFilter !== 'all'}
          onShowAllSprint={handleShowAllSprint}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onToggleSubtask={onToggleSubtask}
          onAddSubtask={onAddSubtask}
          onUpdateStatus={onUpdateStatus}
          onAssignTask={onAssignTask}
          onQuickUpdateTask={onQuickUpdateTask}
          onToggleStar={onToggleStar}
          onAddNewTask={handleCreateDefault}
          canAddTasks={canUseBoardQuickAdd}
          isReadOnly={isReadOnly}
          lastCreatedBatch={lastCreatedBatch}
          isModalOpen={isTaskModalOpen}
          onConsumeCreatedBatch={onConsumeCreatedBatch}
        />
      )}
    </div>
  );
});

TasksTab.displayName = 'TasksTab';
