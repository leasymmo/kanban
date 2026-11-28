import React, { useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import { useAnchoredPopover } from '../hooks/useAnchoredPopover';
import { AssigneeFilterDropdown } from './AssigneeFilterDropdown';
import { FilterAccordionSection, MultiFilterOption, UnifiedFilterDropdown } from './UnifiedFilterDropdown';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
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

const BOARD_SORT_OPTIONS: { id: TaskBoardSortKey; label: string }[] = [
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
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const sortPopoverRef = useRef<HTMLDivElement>(null);
  const handleCloseSort = useCallback(() => setIsSortOpen(false), []);

  const sortPopoverStyle = useAnchoredPopover({
    isOpen: isSortOpen,
    onClose: handleCloseSort,
    triggerRef: sortTriggerRef,
    popoverRef: sortPopoverRef,
    width: 248,
    align: 'right',
  });

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
  const isCustomBoardSort = boardSortBy !== 'position' || boardSortDir !== 'asc';
  const activeBoardSortLabel =
    BOARD_SORT_OPTIONS.find((o) => o.id === boardSortBy)?.label ?? 'Ordre manuel';

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
            <div className="relative flex items-center gap-0.5 shrink-0">
              <button
                ref={sortTriggerRef}
                type="button"
                onClick={() => setIsSortOpen((p) => !p)}
                aria-expanded={isSortOpen}
                aria-haspopup="dialog"
                title={`Tri des colonnes : ${activeBoardSortLabel} (${boardSortDir === 'asc' ? 'croissant' : 'décroissant'})`}
                aria-label={`Tri des colonnes : ${activeBoardSortLabel}`}
                className={`flex items-center gap-1 text-[12px] border rounded-cdh-md px-2 py-1.5 min-h-[38px] sm:min-h-[34px] font-semibold transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap ${
                  isOpenOrCustom(isSortOpen, isCustomBoardSort)
                    ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-info)]'
                    : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span className="hidden sm:inline truncate max-w-[96px]">
                  {boardSortBy === 'position' ? 'Tri' : activeBoardSortLabel}
                </span>
                {boardSortDir === 'asc' ? (
                  <ArrowUp className="w-3 h-3 shrink-0 opacity-75" strokeWidth={2.25} />
                ) : (
                  <ArrowDown className="w-3 h-3 shrink-0 opacity-75" strokeWidth={2.25} />
                )}
              </button>

              {isSortOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    ref={sortPopoverRef}
                    role="dialog"
                    aria-label="Trier les colonnes"
                    style={sortPopoverStyle}
                    className="fixed z-40 cdh-glass-overlay cdh-glass-popover rounded-cdh-xl p-1.5 overflow-y-auto animate-fade-in space-y-0.5"
                  >
                    <div className="px-2.5 py-1 flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                        Trier chaque colonne
                      </span>
                      <button
                        type="button"
                        onClick={onToggleBoardSortDir}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[11px] font-semibold text-[var(--cdh-text-primary)] cursor-pointer"
                      >
                        {boardSortDir === 'asc' ? (
                          <>
                            <ArrowUp className="w-3 h-3" strokeWidth={2.25} /> Asc
                          </>
                        ) : (
                          <>
                            <ArrowDown className="w-3 h-3" strokeWidth={2.25} /> Desc
                          </>
                        )}
                      </button>
                    </div>
                    {BOARD_SORT_OPTIONS.map((opt) => {
                      const isSelected = boardSortBy === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            onSelectBoardSort(opt.id);
                            setIsSortOpen(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-cdh-sm text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                              : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 text-[var(--cdh-info)]">
                              {boardSortDir === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.25} />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.25} />
                              )}
                              <Check className="w-3.5 h-3.5" strokeWidth={2.25} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>,
                  document.body
                )}
            </div>
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

function isOpenOrCustom(isOpen: boolean, isCustom: boolean): boolean {
  return isOpen || isCustom;
}

TasksToolbar.displayName = 'TasksToolbar';
