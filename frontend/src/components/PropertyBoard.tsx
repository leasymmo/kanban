import React from 'react';
import { Task, Property, User } from '../types';
import { TaskCard } from './TaskCard';
import { Home, Plus, CheckCircle2, AlertCircle } from 'lucide-react';

interface PropertyBoardProps {
  tasks: Task[];
  properties: Property[];
  currentUser: User | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddNewTask: (propertyId?: number) => void;
  isReadOnly: boolean;
}

export const PropertyBoard: React.FC<PropertyBoardProps> = ({
  tasks,
  properties,
  currentUser,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddNewTask,
  isReadOnly
}) => {
  // Liste ordonnée incluant les logements existants + la section "Sans logement / Général"
  const sections = [
    ...properties.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      color: p.color,
      tasks: tasks.filter(t => t.property_id === p.id)
    })),
    {
      id: 0,
      name: 'Général / Sans logement',
      code: 'GEN',
      color: '#64748B',
      tasks: tasks.filter(t => !t.property_id)
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {sections.map((section) => {
          const total = section.tasks.length;
          const doneCount = section.tasks.filter(t => t.status === 'done').length;
          const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

          return (
            <div
              key={section.id}
              className="bg-slate-200/70 rounded-2xl p-4 border border-slate-300/80 flex flex-col min-h-[340px]"
            >
              {/* Entête du Logement */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-300/70 mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: section.color }}
                  >
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 leading-tight">
                      {section.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {doneCount}/{total} terminées ({percent}%)
                    </p>
                  </div>
                </div>

                {!isReadOnly && currentUser?.role !== 'read' && (
                  <button
                    onClick={() => onAddNewTask(section.id > 0 ? section.id : undefined)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-300/60 rounded-lg transition-colors"
                    title={`Ajouter une tâche pour ${section.name}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Mini barre de progression */}
              <div className="w-full bg-slate-300/80 h-1 rounded-full mb-3 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    percent === 100 ? 'bg-emerald-500' : 'bg-brand-500'
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              {/* Cartes de tâches du logement */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[400px] pr-1">
                {section.tasks.length > 0 ? (
                  section.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      currentUser={currentUser}
                      onEdit={onEditTask}
                      onDelete={onDeleteTask}
                      onToggleSubtask={onToggleSubtask}
                    />
                  ))
                ) : (
                  <div className="h-24 border-2 border-dashed border-slate-300/70 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium">
                    Aucune tâche pour ce logement
                  </div>
                )}
              </div>

              {/* Bouton rapide d'ajout */}
              {!isReadOnly && currentUser?.role !== 'read' && (
                <button
                  onClick={() => onAddNewTask(section.id > 0 ? section.id : undefined)}
                  className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-300/70 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une tâche pour {section.name}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
