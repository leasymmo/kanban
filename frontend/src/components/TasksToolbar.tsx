import React, { useMemo } from 'react';
import { User, Property, Task, TaskPriority, TaskStatus } from '../types';
import { AssigneeFilter, TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '../hooks/useTaskFilters';
import { TaskViewMode } from '../utils/cookies';
import { AssigneeFilterDropdown } from './AssigneeFilterDropdown';
import { FilterAccordionSection, MultiFilterOption, UnifiedFilterDropdown } from './UnifiedFilterDropdown';
import { ViewModeDropdown } from './ViewModeDropdown';
import { Button, SearchInput } from './ui';
import { Plus, Home, SlidersHorizontal, RotateCcw, Flag } from 'lucide-react';

interface TasksToolbarProps {
  currentUser: User | null;
  allUsers: User[];
  properties: Property[];
  facetFilteredTasks: Task[];
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
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  taskViewMode: TaskViewMode;
  onChangeViewMode: (mode: TaskViewMode) => void;
  isReadOnly: boolean;
  onAddNewTask: () => void;
}

const STATUS_OPTIONS: MultiFilterOption<TaskStatus>[] = TASK_STATUS_OPTIONS.map((s) => ({
  id: s.id,
  label: s.label,
  dotClass: s.dotClass,
}));

const PRIORITY_OPTIONS: MultiFilterOption<TaskPriority>[] = TASK_PRIORITY_OPTIONS.map((p) => ({
  id: p.id,
  label: p.label,
  dotClass: p.dotClass,
}));

const ALL_STATUS_IDS = TASK_STATUS_OPTIONS.map((s) => s.id);
const ALL_PRIORITY_IDS = TASK_PRIORITY_OPTIONS.map((p) => p.id);

export const TasksToolbar: React.FC<TasksToolbarProps> = React.memo(({
  currentUser,
  allUsers,
  properties,
  facetFilteredTasks,
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
  hasActiveFilters,
  onResetFilters,
  taskViewMode,
  onChangeViewMode,
  isReadOnly,
  onAddNewTask
}) => {
  const propertyOptions = useMemo<MultiFilterOption<number>[]>(
    () => [
      { id: 0, label: 'Sans logement', dotClass: 'bg-slate-500' },
      ...properties.map((p) => ({
        id: p.id,
        label: Number(p.is_active) === 0 ? `${p.name} (désactivé)` : p.name,
        dotColor: p.color || '#007AFF',
      })),
    ],
    [properties]
  );

  const filterSections = useMemo<FilterAccordionSection<any>[]>(
    () => [
      {
        id: 'statuses',
        title: 'Statuts',
        icon: <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
        options: STATUS_OPTIONS,
        hiddenIds: hiddenStatuses,
        onToggle: onToggleStatus,
        onSelectAll: () => onSetHiddenStatuses([]),
        onSelectNone: () => onSetHiddenStatuses(ALL_STATUS_IDS),
      },
      {
        id: 'priorities',
        title: 'Priorités',
        icon: <Flag className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
        options: PRIORITY_OPTIONS,
        hiddenIds: hiddenPriorities,
        onToggle: onTogglePriority,
        onSelectAll: () => onSetHiddenPriorities([]),
        onSelectNone: () => onSetHiddenPriorities(ALL_PRIORITY_IDS),
      },
      {
        id: 'properties',
        title: 'Logements',
        icon: <Home className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
        options: propertyOptions,
        hiddenIds: hiddenPropertyIds,
        onToggle: onToggleProperty,
        onSelectAll: () => onSetHiddenProperties([]),
        onSelectNone: () => onSetHiddenProperties(allPropertyFilterIds),
      },
    ],
    [
      hiddenStatuses,
      onToggleStatus,
      onSetHiddenStatuses,
      hiddenPriorities,
      onTogglePriority,
      onSetHiddenPriorities,
      propertyOptions,
      hiddenPropertyIds,
      onToggleProperty,
      onSetHiddenProperties,
      allPropertyFilterIds,
    ]
  );

  return (
    <div className="relative z-20 shrink-0 cdh-glass-chrome px-2.5 py-2 sm:px-3 sm:py-2 rounded-cdh-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 lg:flex-1 lg:max-w-xs xl:max-w-sm">
        <SearchInput
          value={taskSearchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
          onClear={() => onChangeSearchQuery('')}
          placeholder="Rechercher…"
          className="flex-1 min-w-0"
        />

        {!isReadOnly && currentUser?.role !== 'read' && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewTask}
            leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2.25} />}
            className="lg:hidden shrink-0"
          >
            Tâche
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between lg:justify-end gap-1 sm:gap-2 shrink-0 flex-nowrap min-w-0">
        <AssigneeFilterDropdown
          value={taskFilter}
          onChange={onChangeTaskFilter}
          currentUser={currentUser}
          allUsers={allUsers}
          facetFilteredTasks={facetFilteredTasks}
        />

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <UnifiedFilterDropdown
            label="Filtres"
            align="right"
            title="Filtrer par statut, priorité ou logement"
            sections={filterSections}
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Réinitialiser les filtres"
              title="Réinitialiser les filtres"
              className="p-1.5 sm:p-2 min-h-[38px] sm:min-h-[34px] min-w-[32px] sm:min-w-[34px] rounded-cdh-md flex items-center justify-center text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}

          <ViewModeDropdown
            value={taskViewMode}
            onChange={onChangeViewMode}
            align="right"
          />
        </div>

        {!isReadOnly && currentUser?.role !== 'read' && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddNewTask}
            leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2.25} />}
            className="hidden lg:inline-flex shrink-0"
          >
            <span className="hidden xl:inline">Nouvelle tâche</span>
            <span className="xl:hidden">Tâche</span>
          </Button>
        )}
      </div>
    </div>
  );
});

TasksToolbar.displayName = 'TasksToolbar';
