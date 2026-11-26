import React, { useState, useEffect, useCallback } from 'react';
import { Task, Property, User, TaskStatus } from '../types';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { getUserPreferences, saveUserPreferences } from '../utils/cookies';
import { TasksToolbar } from './TasksToolbar';
import { KanbanBoard } from './KanbanBoard';
import { PropertyBoard } from './PropertyBoard';

interface TasksTabProps {
  tasks: Task[];
  properties: Property[];
  allUsers: User[];
  currentUser: User | null;
  isReadOnly: boolean;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
  onReorderKanbanTask: (taskId: number, targetStatus: TaskStatus, orderedColumnTaskIds: number[]) => void;
  onMoveTaskProperty: (taskId: number, targetPropertyId: number | null, orderedSectionTaskIds: number[]) => void;
  onToggleStar: (taskId: number) => void;
  onOpenCreateTask: (options?: { status?: TaskStatus; propertyId?: number | null; source?: 'tasks' | 'meeting' }) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({
  tasks,
  properties,
  allUsers,
  currentUser,
  isReadOnly,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onReorderKanbanTask,
  onMoveTaskProperty,
  onToggleStar,
  onOpenCreateTask
}) => {
  const [taskViewMode, setTaskViewModeState] = useState<'kanban' | 'property'>(() => {
    if (!currentUser) return 'kanban';
    return getUserPreferences(currentUser.id).taskViewMode ?? 'kanban';
  });

  useEffect(() => {
    if (!currentUser) return;
    const prefs = getUserPreferences(currentUser.id);
    setTaskViewModeState(prefs.taskViewMode ?? 'kanban');
  }, [currentUser?.id]);

  const handleChangeViewMode = useCallback(
    (mode: 'kanban' | 'property') => {
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
    allPropertyFilterIds,
    togglePropertyVisibility,
    toggleStatusVisibility,
    resetFilters,
    hasActiveFilters,
    facetFilteredTasks,
    filteredTasks
  } = useTaskFilters(tasks, properties, currentUser);

  return (
    <div className="space-y-4 sm:space-y-5">
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
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        taskViewMode={taskViewMode}
        onChangeViewMode={handleChangeViewMode}
        isReadOnly={isReadOnly}
        onAddNewTask={() => onOpenCreateTask({ status: 'todo', propertyId: null, source: 'tasks' })}
      />

      {taskViewMode === 'kanban' ? (
        <KanbanBoard
          tasks={filteredTasks}
          currentUser={currentUser}
          hiddenStatuses={hiddenStatuses}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onToggleSubtask={onToggleSubtask}
          onAddSubtask={onAddSubtask}
          onUpdateStatus={onUpdateStatus}
          onReorderTask={onReorderKanbanTask}
          onToggleStar={onToggleStar}
          onAddNewTask={(initialStatus) =>
            onOpenCreateTask({ status: initialStatus || 'todo', propertyId: null, source: 'tasks' })
          }
          isReadOnly={isReadOnly}
        />
      ) : (
        <PropertyBoard
          tasks={filteredTasks}
          properties={properties}
          hiddenPropertyIds={hiddenPropertyIds}
          currentUser={currentUser}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onToggleSubtask={onToggleSubtask}
          onAddSubtask={onAddSubtask}
          onUpdateStatus={onUpdateStatus}
          onMoveTaskProperty={onMoveTaskProperty}
          onToggleStar={onToggleStar}
          onAddNewTask={(propertyId) =>
            onOpenCreateTask({ status: 'todo', propertyId: propertyId ?? null, source: 'tasks' })
          }
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
};
