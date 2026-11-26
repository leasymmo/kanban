import React from 'react';
import { User, Property, Task, TaskStatus } from '../types';
import { AssigneeFilter, TASK_STATUS_OPTIONS } from '../hooks/useTaskFilters';
import { MultiFilterDropdown, MultiFilterOption } from './MultiFilterDropdown';
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
    <div className="bg-white p-3 sm:p-4 rounded-3xl sm:rounded-[28px] border border-black/[0.12] shadow-xs space-y-3">
      {/* Ligne 1 : Filtres par associé / pool */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            Filtres :
          </span>

          {currentUser && (
            <button
              onClick={() => onChangeTaskFilter('me')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                taskFilter === 'me'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" strokeWidth={2.25} />
              Mes tâches ({facetFilteredTasks.filter(t => t.assigned_to === currentUser.id).length})
            </button>
          )}

          <button
            onClick={() => onChangeTaskFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              taskFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Toutes ({facetFilteredTasks.length})
          </button>

          {allUsers
            .filter(u => u.id !== currentUser?.id)
            .map(u => {
              const count = facetFilteredTasks.filter(t => t.assigned_to === u.id).length;
              const isSelected = taskFilter === u.id;

              return (
                <button
                  key={u.id}
                  onClick={() => onChangeTaskFilter(u.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  style={isSelected ? { backgroundColor: u.avatar_color } : {}}
                >
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: u.avatar_color }}
                  >
                    {u.initials}
                  </div>
                  {u.name} ({count})
                </button>
              );
            })}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Réinitialiser la recherche et les filtres logements/statuts"
          >
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Réinitialiser les filtres</span>
          </button>
        )}
      </div>

      {/* Ligne 2 : Recherche, multi-filtres, switch de vue & bouton création */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap pt-2.5 border-t border-black/[0.12]">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[220px]">
          {/* Recherche instantanée */}
          <div className="relative flex-1 sm:flex-none sm:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
            <input
              type="text"
              value={taskSearchQuery}
              onChange={(e) => onChangeSearchQuery(e.target.value)}
              placeholder="Rechercher une tâche..."
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-black/[0.12] rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {taskSearchQuery && (
              <button
                type="button"
                onClick={() => onChangeSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Multi-filtre Logements */}
          <MultiFilterDropdown
            defaultLabel="Tous les logements"
            filteredLabel={(vis, total) => `Logements (${vis}/${total})`}
            headerTitle="Logements affichés"
            icon={<Home className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />}
            options={propertyOptions}
            hiddenIds={hiddenPropertyIds}
            onToggle={onToggleProperty}
            onSelectAll={() => onSetHiddenProperties([])}
            onSelectNone={() => onSetHiddenProperties(allPropertyFilterIds)}
            title="Afficher ou masquer des logements"
          />

          {/* Multi-filtre Statuts */}
          <MultiFilterDropdown
            defaultLabel="Tous les statuts"
            filteredLabel={(vis, total) => `Statuts (${vis}/${total})`}
            headerTitle="Statuts affichés"
            icon={<SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" strokeWidth={2} />}
            options={statusOptions}
            hiddenIds={hiddenStatuses}
            onToggle={onToggleStatus}
            onSelectAll={() => onSetHiddenStatuses([])}
            onSelectNone={() => onSetHiddenStatuses(TASK_STATUS_OPTIONS.map(s => s.id))}
            activeButtonClass="bg-indigo-50 border-indigo-300 text-indigo-800"
            activeCheckClass="bg-indigo-600 border-indigo-600 text-white"
            title="Afficher ou masquer des statuts"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Switch vue Kanban / Logement */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-black/[0.12]">
            <button
              onClick={() => onChangeViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                taskViewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Vue Kanban par statut"
            >
              <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2} />
              Par Statut
            </button>

            <button
              onClick={() => onChangeViewMode('property')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                taskViewMode === 'property'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Vue groupée par logement"
            >
              <Home className="w-3.5 h-3.5" strokeWidth={2} />
              Par Logement
            </button>
          </div>

          {!isReadOnly && currentUser?.role !== 'read' && (
            <button
              onClick={onAddNewTask}
              className="flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
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
