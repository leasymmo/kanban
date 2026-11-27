import React from 'react';
import { User, Property, Task, TaskStatus } from '../types';
import { AssigneeFilter, TASK_STATUS_OPTIONS } from '../hooks/useTaskFilters';
import { MultiFilterDropdown, MultiFilterOption } from './MultiFilterDropdown';
import { ensureWhiteTextContrast } from '../utils/color';
import {
  Plus, LayoutGrid, Home, UserCheck,
  Search, X, SlidersHorizontal, RotateCcw
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
      dotColor: p.color || '#3B82F6'
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
    <div className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-white/[0.1] shadow-glass space-y-3">
      {/* Ligne 1 : Filtres par associé / pool (scroll horizontal sur mobile, wrap sur desktop) */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-nowrap sm:flex-wrap overflow-x-auto no-scrollbar sm:overflow-visible pb-0.5 sm:pb-0 flex-1 min-w-0">
          <span className="hidden sm:inline text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
            Filtres :
          </span>

          {currentUser && (
            <button
              type="button"
              aria-pressed={taskFilter === 'me'}
              onClick={() => onChangeTaskFilter('me')}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] sm:min-h-[34px] rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer tabular-nums border ${
                taskFilter === 'me'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/25 border-cyan-400/50'
                  : 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.1] border-white/[0.08]'
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
            className={`shrink-0 px-3 py-1.5 min-h-[38px] sm:min-h-[34px] rounded-xl text-xs font-bold transition-all active:scale-[0.98] cursor-pointer tabular-nums border ${
              taskFilter === 'all'
                ? 'bg-slate-100 text-slate-900 border-white shadow-md'
                : 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.1] border-white/[0.08]'
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
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] sm:min-h-[34px] rounded-xl text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer tabular-nums border ${
                    isSelected
                      ? 'text-white shadow-md border-white/30'
                      : 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.1] border-white/[0.08]'
                  }`}
                  style={isSelected ? { backgroundColor: avatarBg } : {}}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 leading-none shadow-xs"
                    style={{ backgroundColor: avatarBg }}
                  >
                    {u.initials}
                  </span>
                  <span>{u.name} ({count})</span>
                </button>
              );
            })}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[34px] rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] transition-colors cursor-pointer"
            title="Réinitialiser la recherche et les filtres logements/statuts"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">Réinitialiser</span>
          </button>
        )}
      </div>

      {/* Ligne 2 : Recherche, multi-filtres, switch de vue & bouton création */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 border-t border-white/[0.08]">
        <div className="flex flex-col xs:flex-row xs:items-center gap-2 flex-1 min-w-0">
          {/* Recherche instantanée */}
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
            <input
              type="search"
              value={taskSearchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              placeholder="Rechercher une tâche..."
              className="w-full pl-9 sm:pl-8 pr-8 py-2 sm:py-1.5 min-h-[38px] sm:min-h-0 text-xs bg-slate-900/60 text-slate-100 placeholder:text-slate-400 border border-white/[0.12] rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400"
            />
            {taskSearchQuery && (
              <button
                type="button"
                aria-label="Effacer la recherche"
                onClick={() => onChangeSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Multi-filtre Logements */}
            <MultiFilterDropdown
              defaultLabel="Logements"
              filteredLabel={(vis, total) => `Logements (${vis}/${total})`}
              headerTitle="Logements affichés"
              icon={<Home className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />}
              options={propertyOptions}
              hiddenIds={hiddenPropertyIds}
              onToggle={onToggleProperty}
              onSelectAll={() => onSetHiddenProperties([])}
              onSelectNone={() => onSetHiddenProperties(allPropertyFilterIds)}
              align="left"
              title="Afficher ou masquer des logements"
            />

            {/* Multi-filtre Statuts */}
            <MultiFilterDropdown
              defaultLabel="Statuts"
              filteredLabel={(vis, total) => `Statuts (${vis}/${total})`}
              headerTitle="Statuts affichés"
              icon={<SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" strokeWidth={2} />}
              options={statusOptions}
              hiddenIds={hiddenStatuses}
              onToggle={onToggleStatus}
              onSelectAll={() => onSetHiddenStatuses([])}
              onSelectNone={() => onSetHiddenStatuses(TASK_STATUS_OPTIONS.map(s => s.id))}
              activeButtonClass="bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
              activeCheckClass="bg-cyan-500 border-cyan-500 text-white"
              align="right"
              title="Afficher ou masquer des statuts"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:ml-auto justify-between sm:justify-end">
          {/* Switch vue Kanban / Logement */}
          <div className="flex items-center p-1 bg-slate-950/60 rounded-xl border border-white/[0.1] shadow-inner">
            <button
              type="button"
              aria-pressed={taskViewMode === 'kanban'}
              onClick={() => onChangeViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 min-h-[34px] sm:min-h-0 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                taskViewMode === 'kanban'
                  ? 'bg-white/[0.15] text-white shadow-sm border border-white/20'
                  : 'text-slate-400 hover:text-white'
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-1 min-h-[34px] sm:min-h-0 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                taskViewMode === 'property'
                  ? 'bg-white/[0.15] text-white shadow-sm border border-white/20'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vue groupée par logement"
            >
              <Home className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Par Logement</span>
            </button>
          </div>

          {!isReadOnly && currentUser?.role !== 'read' && (
            <button
              type="button"
              onClick={onAddNewTask}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[40px] sm:min-h-[36px] bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/25 border border-white/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} />
              <span>Nouvelle tâche</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
