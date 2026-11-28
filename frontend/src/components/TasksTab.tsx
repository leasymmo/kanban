import React, { Suspense, lazy, useCallback } from 'react';
import {
  Task,
  Property,
  User,
  TaskPriority,
  TaskStatus,
  TaskGroupPage,
  PaginationMeta,
  TaskFacets,
  TaskDueStateFilter,
} from '../types';
import { CreatedTaskBatch } from '../utils/taskMotion';
import { AssigneeFilter } from '../hooks/useTaskFilters';
import {
  TaskBoardSortKey,
  TaskListColumnId,
  TaskListSortDir,
  TaskListSortKey,
  TaskViewMode,
} from '../utils/cookies';
import { TasksToolbar } from './TasksToolbar';
import { KanbanBoard } from './KanbanBoard';

const PropertyBoard = lazy(() =>
  import('./PropertyBoard').then((m) => ({ default: m.PropertyBoard }))
);
const SprintListBoard = lazy(() =>
  import('./SprintListBoard').then((m) => ({ default: m.SprintListBoard }))
);

interface TasksTabProps {
  properties: Property[];
  allUsers: User[];
  currentUser: User | null;
  isReadOnly: boolean;
  taskViewMode: TaskViewMode;
  onChangeViewMode: (mode: TaskViewMode) => void;
  hideEmptyProperties: boolean;
  onToggleHideEmptyProperties: () => void;
  // Filtres pilotés par le backend
  taskFilter: AssigneeFilter;
  onChangeTaskFilter: (filter: AssigneeFilter) => void;
  taskSearchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  hiddenPropertyIds: number[];
  allPropertyFilterIds: number[];
  onToggleProperty: (id: number) => void;
  onSetHiddenProperties: (ids: number[]) => void;
  hiddenStatuses: TaskStatus[];
  onToggleStatus: (status: TaskStatus) => void;
  onSetHiddenStatuses: (statuses: TaskStatus[]) => void;
  hiddenPriorities: TaskPriority[];
  onTogglePriority: (priority: TaskPriority) => void;
  onSetHiddenPriorities: (priorities: TaskPriority[]) => void;
  taskDueState: TaskDueStateFilter;
  onChangeDueState: (state: TaskDueStateFilter) => void;
  taskStarredOnly: boolean;
  onToggleStarredOnly: () => void;
  taskUnplannedOnly: boolean;
  onToggleUnplannedOnly: () => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  // Préférences Tableau & Tri
  listSortBy: TaskListSortKey;
  listSortDir: TaskListSortDir;
  visibleColumns: TaskListColumnId[];
  onSelectListSort: (key: TaskListSortKey) => void;
  onToggleListSortDir: () => void;
  onToggleColumn: (colId: TaskListColumnId) => void;
  onResetColumns: () => void;
  boardSortBy: TaskBoardSortKey;
  boardSortDir: TaskListSortDir;
  onSelectBoardSort: (key: TaskBoardSortKey, forcedDir?: TaskListSortDir) => void;
  onToggleBoardSortDir: () => void;
  // État paginé backend
  groups: Record<string, TaskGroupPage>;
  listItems: Task[];
  listPagination: PaginationMeta;
  loadedTasks: Task[];
  facets: TaskFacets;
  isRefreshing: boolean;
  isLoadingMoreList: boolean;
  loadingMoreColumns: Record<string, boolean>;
  onLoadMoreColumn: (columnKey: string) => void;
  onLoadMoreList: () => void;
  // Mutations & modales
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
  properties,
  allUsers,
  currentUser,
  isReadOnly,
  taskViewMode,
  onChangeViewMode,
  hideEmptyProperties,
  onToggleHideEmptyProperties,
  taskFilter,
  onChangeTaskFilter,
  taskSearchQuery,
  onChangeSearchQuery,
  hiddenPropertyIds,
  allPropertyFilterIds,
  onToggleProperty,
  onSetHiddenProperties,
  hiddenStatuses,
  onToggleStatus,
  onSetHiddenStatuses,
  hiddenPriorities,
  onTogglePriority,
  onSetHiddenPriorities,
  taskDueState,
  onChangeDueState,
  taskStarredOnly,
  onToggleStarredOnly,
  taskUnplannedOnly,
  onToggleUnplannedOnly,
  hasActiveFilters,
  onResetFilters,
  listSortBy,
  listSortDir,
  visibleColumns,
  onSelectListSort,
  onToggleListSortDir,
  onToggleColumn,
  onResetColumns,
  boardSortBy,
  boardSortDir,
  onSelectBoardSort,
  onToggleBoardSortDir,
  groups,
  listItems,
  listPagination,
  loadedTasks,
  facets,
  isRefreshing,
  isLoadingMoreList,
  loadingMoreColumns,
  onLoadMoreColumn,
  onLoadMoreList,
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
  const isViewingOwnTasks =
    !!currentUser && (taskFilter === 'me' || taskFilter === currentUser.id);

  const canUseBoardQuickAdd =
    !isReadOnly &&
    (currentUser?.role === 'admin' || (currentUser?.role === 'write' && isViewingOwnTasks));

  const contextualAssignedTo: number | null =
    taskFilter === 'me'
      ? (currentUser?.id ?? null)
      : typeof taskFilter === 'number' && allUsers.some((u) => u.id === taskFilter)
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

  const handleShowAllSprint = useCallback(() => onChangeTaskFilter('all'), [onChangeTaskFilter]);

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col gap-2.5 sm:gap-3">
      <h2 className="sr-only">Gestion des tâches du sprint</h2>
      <TasksToolbar
        currentUser={currentUser}
        allUsers={allUsers}
        properties={properties}
        assigneeCounts={facets.assignee_counts}
        taskFilter={taskFilter}
        onChangeTaskFilter={onChangeTaskFilter}
        taskSearchQuery={taskSearchQuery}
        onChangeSearchQuery={onChangeSearchQuery}
        hiddenPropertyIds={hiddenPropertyIds}
        allPropertyFilterIds={allPropertyFilterIds}
        onToggleProperty={onToggleProperty}
        onSetHiddenProperties={onSetHiddenProperties}
        hiddenStatuses={hiddenStatuses}
        onToggleStatus={onToggleStatus}
        onSetHiddenStatuses={onSetHiddenStatuses}
        hiddenPriorities={hiddenPriorities}
        onTogglePriority={onTogglePriority}
        onSetHiddenPriorities={onSetHiddenPriorities}
        taskDueState={taskDueState}
        onChangeDueState={onChangeDueState}
        taskStarredOnly={taskStarredOnly}
        onToggleStarredOnly={onToggleStarredOnly}
        taskUnplannedOnly={taskUnplannedOnly}
        onToggleUnplannedOnly={onToggleUnplannedOnly}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
        taskViewMode={taskViewMode}
        onChangeViewMode={onChangeViewMode}
        boardSortBy={boardSortBy}
        boardSortDir={boardSortDir}
        onSelectBoardSort={onSelectBoardSort}
        onToggleBoardSortDir={onToggleBoardSortDir}
        isRefreshing={isRefreshing}
        isReadOnly={isReadOnly}
        onAddNewTask={handleCreateDefault}
      />

      {taskViewMode === 'kanban' ? (
        <KanbanBoard
          groups={groups}
          statusCounts={facets.status_counts}
          allTasks={loadedTasks}
          loadingMoreColumns={loadingMoreColumns}
          onLoadMoreColumn={onLoadMoreColumn}
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
        <Suspense fallback={<div className="flex-1 cdh-glass-column rounded-cdh-2xl animate-pulse" />}>
          <PropertyBoard
            groups={groups}
            propertyCounts={facets.property_counts}
            allTasks={loadedTasks}
            loadingMoreColumns={loadingMoreColumns}
            onLoadMoreColumn={onLoadMoreColumn}
            hideEmptyProperties={hideEmptyProperties}
            onToggleHideEmpty={onToggleHideEmptyProperties}
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
        </Suspense>
      ) : (
        <Suspense fallback={<div className="flex-1 cdh-glass-column rounded-cdh-2xl animate-pulse" />}>
          <SprintListBoard
            tasks={listItems}
            pagination={listPagination}
            isLoadingMore={isLoadingMoreList}
            onLoadMore={onLoadMoreList}
            sortBy={listSortBy}
            sortDir={listSortDir}
            visibleColumns={visibleColumns}
            onSelectSort={onSelectListSort}
            onToggleSortDir={onToggleListSortDir}
            onToggleColumn={onToggleColumn}
            onResetColumns={onResetColumns}
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
        </Suspense>
      )}
    </div>
  );
});

TasksTab.displayName = 'TasksTab';
