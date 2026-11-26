import React from 'react';
import { Task, Property, User, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import { Home, Plus, EyeOff } from 'lucide-react';

interface PropertyBoardProps {
  tasks: Task[];
  properties: Property[];
  hiddenPropertyIds?: number[];
  currentUser: User | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onMoveTaskProperty?: (taskId: number, targetPropertyId: number | null, orderedSectionTaskIds: number[]) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask: (propertyId?: number) => void;
  isReadOnly: boolean;
}

export const PropertyBoard: React.FC<PropertyBoardProps> = ({
  tasks,
  properties,
  hiddenPropertyIds = [],
  currentUser,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onMoveTaskProperty,
  onToggleStar,
  onAddNewTask,
  isReadOnly
}) => {
  const sections = [
    ...properties.map(p => ({
      id: p.id,
      name: p.name,
      code: p.code,
      color: p.color,
      isDeactivated: Number(p.is_active) === 0,
      tasks: tasks.filter(t => t.property_id === p.id)
    })),
    {
      id: 0,
      name: 'Général / Sans logement',
      code: 'GEN',
      color: '#64748B',
      isDeactivated: false,
      tasks: tasks.filter(t => !t.property_id)
    }
  ].filter(section => !hiddenPropertyIds.includes(section.id));

  const {
    draggedTaskId,
    activeDropContainer,
    dropTarget,
    resetDragState,
    handleDragStart,
    handleDragOverContainer,
    handleDragLeaveContainer,
    handleDragOverCard,
    handleDropOnCard,
    handleDropOnContainer
  } = useCardDragAndDrop<number>({
    tasks,
    getContainerId: (t) => t.property_id || 0,
    isReadOnly,
    onDropReorder: (draggedTask, targetSectionId, orderedSectionTaskIds) => {
      if (onMoveTaskProperty) {
        const targetPropertyId = targetSectionId > 0 ? targetSectionId : null;
        onMoveTaskProperty(draggedTask.id, targetPropertyId, orderedSectionTaskIds);
      }
    }
  });

  const getGridClass = (count: number) => {
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  };

  const listMaxHeightClass =
    sections.length <= 2 ? 'max-h-[calc(100dvh-300px)]' : 'max-h-[480px]';

  if (sections.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.12] p-10 text-center text-slate-500">
        <EyeOff className="w-8 h-8 mx-auto mb-2 text-slate-300" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-slate-700">Tous les logements sont actuellement masqués.</p>
        <p className="text-xs text-slate-500 mt-1">Sélectionnez au moins un logement dans le filtre « Logements » ci-dessus.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`grid ${getGridClass(sections.length)} gap-5`}>
        {sections.map((section) => {
          const total = section.tasks.length;
          const doneCount = section.tasks.filter(t => t.status === 'done').length;
          const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
          const isHovered = activeDropContainer === section.id;

          return (
            <div
              key={section.id}
              onDragOver={(e) => handleDragOverContainer(e, section.id)}
              onDragLeave={handleDragLeaveContainer}
              onDrop={(e) => handleDropOnContainer(e, section.id)}
              className={`rounded-[28px] p-4 border flex flex-col min-h-[340px] transition-all duration-200 ${
                isHovered
                  ? 'bg-brand-50/40 border-brand-500 ring-2 ring-brand-400/30'
                  : 'bg-slate-200/70 border-black/[0.12]'
              }`}
            >
              {/* Entête du Logement */}
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.12] mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: section.color }}
                  >
                    <Home className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-800 leading-tight">
                        {section.name}
                      </h3>
                      {section.isDeactivated && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-300/80 text-slate-700">
                          Désactivé
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {doneCount}/{total} terminées ({percent}%)
                    </p>
                  </div>
                </div>

                {!isReadOnly && currentUser?.role !== 'read' && (
                  <button
                    onClick={() => onAddNewTask(section.id > 0 ? section.id : undefined)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-300/60 rounded-lg transition-colors cursor-pointer"
                    title={`Ajouter une tâche pour ${section.name}`}
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
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
              <div className={`space-y-2.5 flex-1 overflow-y-auto ${listMaxHeightClass} pr-1`}>
                {section.tasks.length > 0 ? (
                  section.tasks.map((task) => {
                    const indicator =
                      dropTarget?.containerId === section.id && dropTarget?.taskId === task.id
                        ? dropTarget.position
                        : null;
                    return (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isReadOnly={isReadOnly}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onToggleSubtask={onToggleSubtask}
                        onAddSubtask={onAddSubtask}
                        onUpdateStatus={onUpdateStatus}
                        onToggleStar={onToggleStar}
                        onDragStart={handleDragStart}
                        onDragEnd={resetDragState}
                        onDragOverCard={(e, t) => handleDragOverCard(e, t, section.id)}
                        onDropOnCard={(e, t) => handleDropOnCard(e, t, section.id)}
                        dropIndicator={indicator}
                        isDragging={draggedTaskId === task.id}
                      />
                    );
                  })
                ) : (
                  <div className="h-24 border-2 border-dashed border-black/[0.12] rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium select-none">
                    Déposer une tâche ici
                  </div>
                )}
              </div>

              {/* Bouton rapide d'ajout */}
              {!isReadOnly && currentUser?.role !== 'read' && (
                <button
                  onClick={() => onAddNewTask(section.id > 0 ? section.id : undefined)}
                  className="mt-3 w-full py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-300/70 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
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
