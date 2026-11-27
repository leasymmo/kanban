import React from 'react';
import { User, Property, Task, TaskStatus } from '../types';
import { AssigneeFilter, TASK_STATUS_OPTIONS } from '../hooks/useTaskFilters';
import { MultiFilterDropdown, MultiFilterOption } from './MultiFilterDropdown';
import { Avatar, Button, SearchInput } from './ui';
import { ensureWhiteTextContrast } from '../utils/color';
import {
  Plus, LayoutGrid, Home, UserCheck,
  SlidersHorizontal, RotateCcw
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
  hasActiveFilters,
  onResetFilters,
  taskViewMode,
  onChangeViewMode,
  isReadOnly,
  onAddNewTask
}) => {
  const propertyOptions: MultiFilterOption<number>[] = [
    ...properties.map(p => ({
      id: p.id,
      label: Number(p.is_active) === 0 ? `${p.name} (désactivé)` : p.name,
      dotColor: p.color || '#007AFF'
    })),
    {
      id: 0,
      label: 'Général / Sans logement',
      dotClass: 'bg-slate-500'
    }
  ];

  const statusOptions: MultiFilterOption<TaskStatus>[] = TASK_STATUS_OPTIONS.map(s => ({
    id: s.id,
    label: s.label,
    dotClass: s.dotClass
  }));

  return (
    <div className="cdh-glass-chrome p-3 sm:p-4 rounded-cdh-xl space-y-3">
      {/* Ligne 1 : Filtres par associé / pool */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar sm:overflow-visible pb-0.5 sm:pb-0 flex-1 min-w-0">
          {currentUser && (
            <button
              type="button"
              aria-pressed={taskFilter === 'me'}
              onClick={() => onChangeTaskFilter('me')}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] sm:min-h-[32px] rounded-full text-[12px] font-semibold transition-all active:scale-[0.98] cursor-pointer tabular-nums ${
                taskFilter === 'me'
                  ? 'bg-[var(--cdh-accent)] text-white shadow-sm'
                  : 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] hover:opacity-85'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
              <span>Mes tâches ({facetFilteredTasks.filter(t => t.assigned_to === currentUser.id).length})</span>
            </button>
          )}

          <button
            type="button"
            aria-pressed={taskFilter === 'all'}
            onClick={() => onChangeTaskFilter('all')}
            className={`shrink-0 px-3 py-1.5 min-h-[38px] sm:min-h-[32px] rounded-full text-[12px] font-semibold transition-all active:scale-[0.98] cursor-pointer tabular-nums ${
              taskFilter === 'all'
                ? 'bg-[var(--cdh-text-primary)] text-[var(--cdh-text-inverted)] shadow-sm'
                : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
            }`}
          >
            Toutes ({facetFilteredTasks.length})
          </button>

          {allUsers
            .filter(u => u.id !== currentUser?.id)
            .map(u => {
              const count = facetFilteredTasks.filter(t => t.assigned_to === u.id).length;
              const isSelected = taskFilter === u.id;
              const avatarBg = ensureWhiteTextContrast(u.avatar_color);

              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onChangeTaskFilter(u.id)}
                  className={`shrink-0 flex items-center gap-1.5 pl-1.5 pr-3 py-1 min-h-[38px] sm:min-h-[32px] rounded-full text-[12px] font-medium transition-all active:scale-[0.98] cursor-pointer tabular-nums ${
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
                  <span>{u.name} ({count})</span>
                </button>
              );
            })}
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />}
            title="Réinitialiser la recherche et les filtres logements/statuts"
            className="shrink-0"
          >
            <span className="hidden sm:inline">Réinitialiser</span>
          </Button>
        )}
      </div>

      {/* Ligne 2 : Recherche, multi-filtres, switch de vue & bouton création */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-[var(--cdh-border-hairline)]">
        <div className="flex flex-col xs:flex-row xs:items-center gap-2 flex-1 min-w-0">
          <SearchInput
            value={taskSearchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            onClear={() => onChangeSearchQuery('')}
            placeholder="Rechercher une tâche…"
            className="flex-1 sm:flex-none sm:w-60"
          />

          <div className="flex items-center gap-2 flex-wrap">
            <MultiFilterDropdown
              defaultLabel="Logements"
              filteredLabel={(vis, total) => `Logements (${vis}/${total})`}
              headerTitle="Logements affichés"
              icon={<Home className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />}
              options={propertyOptions}
              hiddenIds={hiddenPropertyIds}
              onToggle={onToggleProperty}
              onSelectAll={() => onSetHiddenProperties([])}
              onSelectNone={() => onSetHiddenProperties(allPropertyFilterIds)}
              align="left"
              title="Afficher ou masquer des logements"
            />

            <MultiFilterDropdown
              defaultLabel="Statuts"
              filteredLabel={(vis, total) => `Statuts (${vis}/${total})`}
              headerTitle="Statuts affichés"
              icon={<SlidersHorizontal className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)] shrink-0" strokeWidth={2} />}
              options={statusOptions}
              hiddenIds={hiddenStatuses}
              onToggle={onToggleStatus}
              onSelectAll={() => onSetHiddenStatuses([])}
              onSelectNone={() => onSetHiddenStatuses(TASK_STATUS_OPTIONS.map(s => s.id))}
              align="right"
              title="Afficher ou masquer des statuts"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:ml-auto justify-between sm:justify-end">
          {/* Segmented Control vue Kanban / Logement */}
          <div className="flex items-center p-0.5 bg-[var(--cdh-surface-control)] rounded-cdh-md">
            <button
              type="button"
              aria-pressed={taskViewMode === 'kanban'}
              onClick={() => onChangeViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 min-h-[34px] sm:min-h-[30px] rounded-cdh-sm text-[12px] font-semibold transition-all cursor-pointer ${
                taskViewMode === 'kanban'
                  ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card'
                  : 'text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
              }`}
              title="Vue Kanban par statut"
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Par Statut</span>
            </button>

            <button
              type="button"
              aria-pressed={taskViewMode === 'property'}
              onClick={() => onChangeViewMode('property')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 min-h-[34px] sm:min-h-[30px] rounded-cdh-sm text-[12px] font-semibold transition-all cursor-pointer ${
                taskViewMode === 'property'
                  ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card'
                  : 'text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
              }`}
              title="Vue groupée par logement"
            >
              <Home className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Par Logement</span>
            </button>
          </div>

          {!isReadOnly && currentUser?.role !== 'read' && (
            <Button
              variant="primary"
              size="md"
              onClick={onAddNewTask}
              leftIcon={<Plus className="w-4 h-4" strokeWidth={2.25} />}
            >
              Nouvelle tâche
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
