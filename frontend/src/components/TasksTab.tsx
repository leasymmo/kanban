import React, { useState, useEffect, useCallback } from 'react';
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

export const TasksTab: React.FC<TasksTabProps> = ({
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
  const [taskViewMode, setTaskViewModeState] = useState<TaskViewMode>(() => {
    if (!currentUser) return 'kanban';
    return getUserPreferences(currentUser.id).taskViewMode ?? 'kanban';
  });

  useEffect(() => {
    if (!currentUser) return;
    const prefs = getUserPreferences(currentUser.id);
    setTaskViewModeState(prefs.taskViewMode ?? 'kanban');
  }, [currentUser?.id]);

  const handleChangeViewMode = useCallback(
    (mode: TaskViewMode) => {
      setTaskViewModeState(mode);
      if (currentUser) {
        saveUserPreferences(currentUser.id, { taskViewMode: mode });
      }
    },
    [currentUser]
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
      : null;

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
        onAddNewTask={() =>
          onOpenCreateTask({
            status: 'todo',
            propertyId: null,
            assignedTo: contextualAssignedTo,
            source: 'tasks'
          })
        }
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
          onAddNewTask={(initialStatus) =>
            onOpenCreateTask({
              status: initialStatus || 'todo',
              propertyId: null,
              assignedTo: contextualAssignedTo,
              source: 'tasks'
            })
          }
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
          onAddNewTask={(propertyId) =>
            onOpenCreateTask({
              status: 'todo',
              propertyId: propertyId ?? null,
              assignedTo: contextualAssignedTo,
              source: 'tasks'
            })
          }
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
          onShowAllSprint={() => setTaskFilter('all')}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onToggleSubtask={onToggleSubtask}
          onAddSubtask={onAddSubtask}
          onUpdateStatus={onUpdateStatus}
          onAssignTask={onAssignTask}
          onQuickUpdateTask={onQuickUpdateTask}
          onToggleStar={onToggleStar}
          onAddNewTask={() =>
            onOpenCreateTask({
              status: 'todo',
              propertyId: null,
              assignedTo: contextualAssignedTo,
              source: 'tasks'
            })
          }
          canAddTasks={canUseBoardQuickAdd}
          isReadOnly={isReadOnly}
          lastCreatedBatch={lastCreatedBatch}
          isModalOpen={isTaskModalOpen}
          onConsumeCreatedBatch={onConsumeCreatedBatch}
        />
      )}
    </div>
  );
};
