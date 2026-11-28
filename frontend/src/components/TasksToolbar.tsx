import React, { useMemo } from 'react';
import {
  User,
  Property,
  TaskFacets,
  TaskPriority,
  TaskStatus,
  TaskDueStateFilter,
} from '../types';
import {
  AssigneeFilter,
  TASK_DUE_STATE_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
} from '../hooks/useTaskFilters';
import {
  TaskBoardSortKey,
  TaskListSortDir,
  TaskViewMode,
} from '../utils/cookies';
import { TASK_LIST_SORT_OPTIONS } from '../utils/taskSort';
import { AssigneeFilterDropdown } from './AssigneeFilterDropdown';
import { FilterAccordionSection, MultiFilterOption, UnifiedFilterDropdown } from './UnifiedFilterDropdown';
import { SortDropdown, SortOptionItem } from './SortDropdown';
import { ViewModeDropdown } from './ViewModeDropdown';
import { Button, SearchInput } from './ui';
import {
  Plus,
  Home,
  SlidersHorizontal,
  RotateCcw,
  Flag,
  CalendarClock,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface TasksToolbarProps {
  currentUser: User | null;
  allUsers: User[];
  properties: Property[];
  assigneeCounts: TaskFacets['assignee_counts'];
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
  taskViewMode: TaskViewMode;
  onChangeViewMode: (mode: TaskViewMode) => void;
  boardSortBy: TaskBoardSortKey;
  boardSortDir: TaskListSortDir;
  onSelectBoardSort: (key: TaskBoardSortKey, forcedDir?: TaskListSortDir) => void;
  onToggleBoardSortDir: () => void;
  isRefreshing?: boolean;
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

const DUE_OPTIONS: MultiFilterOption<TaskDueStateFilter>[] = TASK_DUE_STATE_OPTIONS.map((d) => ({
  id: d.id,
  label: d.label,
}));

const FLAG_OPTIONS: MultiFilterOption<'starred' | 'unplanned'>[] = [
  { id: 'starred', label: 'Prioritaires / étoilées', dotClass: 'bg-amber-500' },
  { id: 'unplanned', label: 'Ajoutées hors réunion', dotClass: 'bg-sky-500' },
];

const BOARD_SORT_OPTIONS: SortOptionItem<TaskBoardSortKey>[] = [
  { id: 'position', label: 'Ordre manuel' },
  ...TASK_LIST_SORT_OPTIONS,
  { id: 'updated_at', label: 'Dernière modification' },
];

const ALL_STATUS_IDS = TASK_STATUS_OPTIONS.map((s) => s.id);
const ALL_PRIORITY_IDS = TASK_PRIORITY_OPTIONS.map((p) => p.id);

export const TasksToolbar: React.FC<TasksToolbarProps> = React.memo(({
  currentUser,
  allUsers,
  properties,
  assigneeCounts,
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
  taskViewMode,
  onChangeViewMode,
  boardSortBy,
  boardSortDir,
  onSelectBoardSort,
  onToggleBoardSortDir,
  isRefreshing = false,
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

  const hiddenFlagIds = useMemo<('starred' | 'unplanned')[]>(() => {
    const hidden: ('starred' | 'unplanned')[] = [];
    if (!taskStarredOnly) hidden.push('starred');
    if (!taskUnplannedOnly) hidden.push('unplanned');
    return hidden;
  }, [taskStarredOnly, taskUnplannedOnly]);

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
      {
        id: 'due_state',
        title: 'Échéance',
        mode: 'single',
        icon: <CalendarClock className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
        options: DUE_OPTIONS,
        selectedValue: taskDueState,
        defaultValue: 'all',
        onSelectSingle: onChangeDueState,
      },
      {
        id: 'markers',
        title: 'Marqueurs uniquement',
        icon: <Sparkles className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
        options: FLAG_OPTIONS,
        hiddenIds: hiddenFlagIds,
        onToggle: (id: 'starred' | 'unplanned') => {
          if (id === 'starred') onToggleStarredOnly();
          else onToggleUnplannedOnly();
        },
        onSelectAll: () => {
          if (!taskStarredOnly) onToggleStarredOnly();
          if (!taskUnplannedOnly) onToggleUnplannedOnly();
        },
        onSelectNone: () => {
          if (taskStarredOnly) onToggleStarredOnly();
          if (taskUnplannedOnly) onToggleUnplannedOnly();
        },
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
      taskDueState,
      onChangeDueState,
      hiddenFlagIds,
      taskStarredOnly,
      taskUnplannedOnly,
      onToggleStarredOnly,
      onToggleUnplannedOnly,
    ]
  );

  const isBoardView = taskViewMode !== 'list';

  return (
    <div className="relative z-20 shrink-0 cdh-glass-chrome px-2.5 py-2 sm:px-3 sm:py-2 rounded-cdh-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 lg:flex-1 lg:max-w-xs xl:max-w-sm">
        <div className="relative flex-1 min-w-0">
          <SearchInput
            value={taskSearchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            onClear={() => onChangeSearchQuery('')}
            placeholder="Rechercher…"
            className="w-full min-w-0"
          />
          {isRefreshing && (
            <Loader2
              className="w-3.5 h-3.5 animate-spin text-[var(--cdh-accent)] absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={2.25}
              aria-hidden="true"
            />
          )}
        </div>

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
          assigneeCounts={assigneeCounts}
        />

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <UnifiedFilterDropdown
            label="Filtres"
            align="right"
            title="Filtrer par statut, priorité, logement ou échéance"
            sections={filterSections}
          />

          {isBoardView && (
            <SortDropdown
              value={boardSortBy}
              direction={boardSortDir}
              options={BOARD_SORT_OPTIONS}
              defaultSortBy="position"
              defaultSortDir="asc"
              onSelectSort={(key) => onSelectBoardSort(key)}
              onToggleDir={onToggleBoardSortDir}
              popoverTitle="Trier chaque colonne"
              popoverAriaLabel="Trier les colonnes"
              ariaLabelPrefix="Tri des colonnes"
            />
          )}

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
