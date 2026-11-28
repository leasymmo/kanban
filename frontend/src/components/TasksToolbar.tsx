import React from 'react';
import { User, Property, Task, TaskPriority, TaskStatus } from '../types';
import { AssigneeFilter, TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '../hooks/useTaskFilters';
import { MultiFilterOption, UnifiedFilterDropdown } from './UnifiedFilterDropdown';
import { Avatar, Button, SearchInput } from './ui';
import { ensureWhiteTextContrast } from '../utils/color';
import {
  Plus, LayoutGrid, Home, UserCheck,
  SlidersHorizontal, RotateCcw, Flag
} from 'lucide-react';

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
  taskViewMode: 'kanban' | 'property';
  onChangeViewMode: (mode: 'kanban' | 'property') => void;
  isReadOnly: boolean;
  onAddNewTask: () => void;
}

export const TasksToolbar: React.FC<TasksToolbarProps> = ({
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
  const propertyOptions: MultiFilterOption<number>[] = [
    {
      id: 0,
      label: 'Sans logement',
      dotClass: 'bg-slate-500'
    },
    ...properties.map(p => ({
      id: p.id,
      label: Number(p.is_active) === 0 ? `${p.name} (désactivé)` : p.name,
      dotColor: p.color || '#007AFF'
    }))
  ];

  const statusOptions: MultiFilterOption<TaskStatus>[] = TASK_STATUS_OPTIONS.map(s => ({
    id: s.id,
    label: s.label,
    dotClass: s.dotClass
  }));

  const priorityOptions: MultiFilterOption<TaskPriority>[] = TASK_PRIORITY_OPTIONS.map(p => ({
    id: p.id,
    label: p.label,
    dotClass: p.dotClass
  }));

  return (
    <div className="relative z-20 shrink-0 cdh-glass-chrome px-2.5 py-2 sm:px-3 sm:py-2 rounded-cdh-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
      {/* Zone 1 : Filtres par associé + CTA mobile */}
      <div className="flex items-center justify-between gap-1.5 min-w-0 lg:flex-1">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0">
          {currentUser && (
            <button
              type="button"
              aria-pressed={taskFilter === 'me'}
              onClick={() => onChangeTaskFilter('me')}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 min-h-[34px] lg:min-h-[30px] rounded-full text-[12px] font-semibold transition-all active:scale-[0.98] cursor-pointer tabular-nums ${
                taskFilter === 'me'
                  ? 'bg-[var(--cdh-accent)] text-white shadow-sm'
                  : 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] hover:opacity-85'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
              <span>Mes tâches ({facetFilteredTasks.filter(t => t.assigned_to === currentUser.id).length})</span>
            </button>
          )}

          {allUsers
            .filter(u => u.id !== currentUser?.id)
            .map(u => {
              const count = facetFilteredTasks.filter(t => t.assigned_to === u.id).length;
              const isSelected = taskFilter === u.id;
              const avatarBg = ensureWhiteTextContrast(u.avatar_color);
              const firstName = u.name.split(' ')[0];

              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChangeTaskFilter(u.id)}
                  title={`${u.name} (${count})`}
                  className={`shrink-0 flex items-center gap-1.5 pl-1 pr-2.5 py-1 min-h-[34px] lg:min-h-[30px] rounded-full text-[12px] font-medium transition-all active:scale-[0.98] cursor-pointer tabular-nums ${
                    isSelected
                      ? 'text-white shadow-sm'
                      : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
                  }`}
                  style={isSelected ? { backgroundColor: avatarBg } : undefined}
                >
                  <Avatar
                    initials={u.initials}
                    color={avatarBg}
                    size="xs"
                    className={isSelected ? 'ring-white/40' : ''}
                  />
                  <span>{firstName} ({count})</span>
                </button>
              );
            })}
        </div>

        {/* Bouton "+ Tâche" visible en haut à droite sur mobile (< lg) */}
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

      {/* Zone 2 : Recherche, multi-filtres, switch de vue & bouton création (1 ligne sur lg+) */}
      <div className="flex items-center justify-between lg:justify-end gap-1.5 sm:gap-2 shrink-0 flex-wrap sm:flex-nowrap">
        <SearchInput
          value={taskSearchQuery}
          onChange={(e) => onChangeSearchQuery(e.target.value)}
          onClear={() => onChangeSearchQuery('')}
          placeholder="Rechercher…"
          className="flex-1 min-w-[120px] sm:flex-none sm:w-40 xl:w-48"
        />

        <div className="flex items-center gap-1.5 shrink-0">
          <UnifiedFilterDropdown
            label="Filtres"
            align="right"
            title="Filtrer par statut, priorité ou logement"
            sections={[
              {
                id: 'statuses',
                title: 'Statuts',
                icon: <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
                options: statusOptions,
                hiddenIds: hiddenStatuses,
                onToggle: onToggleStatus,
                onSelectAll: () => onSetHiddenStatuses([]),
                onSelectNone: () => onSetHiddenStatuses(TASK_STATUS_OPTIONS.map(s => s.id))
              },
              {
                id: 'priorities',
                title: 'Priorités',
                icon: <Flag className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
                options: priorityOptions,
                hiddenIds: hiddenPriorities,
                onToggle: onTogglePriority,
                onSelectAll: () => onSetHiddenPriorities([]),
                onSelectNone: () => onSetHiddenPriorities(TASK_PRIORITY_OPTIONS.map(p => p.id))
              },
              {
                id: 'properties',
                title: 'Logements',
                icon: <Home className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />,
                options: propertyOptions,
                hiddenIds: hiddenPropertyIds,
                onToggle: onToggleProperty,
                onSelectAll: () => onSetHiddenProperties([]),
                onSelectNone: () => onSetHiddenProperties(allPropertyFilterIds)
              }
            ]}
          />

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Réinitialiser les filtres"
              title="Réinitialiser les filtres"
              className="p-2 min-h-[34px] min-w-[34px] rounded-cdh-md flex items-center justify-center text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Segmented Control vue Kanban / Logement */}
        <div className="flex items-center p-0.5 bg-[var(--cdh-surface-control)] rounded-cdh-md shrink-0">
          <button
            type="button"
            aria-pressed={taskViewMode === 'kanban'}
            onClick={() => onChangeViewMode('kanban')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 min-h-[30px] rounded-cdh-sm text-[12px] font-semibold transition-all cursor-pointer ${
              taskViewMode === 'kanban'
                ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card'
                : 'text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
            }`}
            title="Vue Kanban par statut"
          >
            <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Statut</span>
          </button>

          <button
            type="button"
            aria-pressed={taskViewMode === 'property'}
            onClick={() => onChangeViewMode('property')}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 min-h-[30px] rounded-cdh-sm text-[12px] font-semibold transition-all cursor-pointer ${
              taskViewMode === 'property'
                ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card'
                : 'text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
            }`}
            title="Vue groupée par logement"
          >
            <Home className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Logement</span>
          </button>
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
};
