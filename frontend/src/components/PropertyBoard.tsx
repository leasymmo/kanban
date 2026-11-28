import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Task, Property, User, TaskPriority, TaskStatus } from '../types';
import { TaskCard } from './TaskCard';
import { useCardDragAndDrop } from '../hooks/useCardDragAndDrop';
import {
  CreatedTaskBatch,
  getScrollBehavior,
  scrollContainersAndHighlightTasks,
} from '../utils/taskMotion';
import { ensureWhiteTextContrast } from '../utils/color';
import { getUserPreferences, saveUserPreferences } from '../utils/cookies';
import { Badge, ProgressBar } from './ui';
import { Home, Plus, EyeOff, Eye } from 'lucide-react';

interface PropertyBoardProps {
  tasks: Task[];
  properties: Property[];
  allUsers?: User[];
  hiddenPropertyIds?: number[];
  currentUser: User | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus?: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onMoveTaskProperty?: (taskId: number, targetPropertyId: number | null, orderedSectionTaskIds: number[]) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask: (propertyId?: number) => void;
  canAddTasks?: boolean;
  isReadOnly: boolean;
  lastCreatedBatch?: CreatedTaskBatch | null;
  isModalOpen?: boolean;
  onConsumeCreatedBatch?: () => void;
}

export const PropertyBoard: React.FC<PropertyBoardProps> = ({
  tasks,
  properties,
  allUsers = [],
  hiddenPropertyIds = [],
  currentUser,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onAssignTask,
  onQuickUpdateTask,
  onMoveTaskProperty,
  onToggleStar,
  onAddNewTask,
  canAddTasks,
  isReadOnly,
  lastCreatedBatch,
  isModalOpen = false,
  onConsumeCreatedBatch
}) => {
  const showQuickAddButtons =
    canAddTasks !== undefined ? canAddTasks : (!isReadOnly && currentUser?.role === 'admin');
  const userId = currentUser?.id ?? null;
  const loadedUserIdRef = useRef<number | null>(userId);

  const [hideEmptyProperties, setHideEmptyProperties] = useState<boolean>(() => {
    if (!userId) return true;
    return getUserPreferences(userId).hideEmptyProperties ?? true;
  });

  const [activePropertyId, setActivePropertyId] = useState<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const pillBarRef = useRef<HTMLDivElement>(null);
  const rafScrollRef = useRef<number | null>(null);
  const programmaticTargetLeftRef = useRef<number | null>(null);
  const programmaticTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) {
      loadedUserIdRef.current = null;
      setHideEmptyProperties(true);
      return;
    }
    if (loadedUserIdRef.current === userId) return;
    loadedUserIdRef.current = userId;
    const prefs = getUserPreferences(userId);
    setHideEmptyProperties(prefs.hideEmptyProperties ?? true);
  }, [userId]);

  // Groupement O(T + P) en un seul passage avec comptage done/remaining
  const allSections = useMemo(() => {
    const tasksByPropId = new Map<number, Task[]>();
    for (const t of tasks) {
      const key = t.property_id || 0;
      const bucket = tasksByPropId.get(key);
      if (bucket) bucket.push(t);
      else tasksByPropId.set(key, [t]);
    }

    const hiddenSet = new Set(hiddenPropertyIds);
    const buildSection = (
      id: number,
      name: string,
      color: string,
      isDeactivated: boolean
    ) => {
      const list = tasksByPropId.get(id) ?? [];
      let doneCount = 0;
      for (const t of list) {
        if (t.status === 'done') doneCount++;
      }
      return {
        id,
        name,
        color,
        isDeactivated,
        tasks: list,
        doneCount,
        remainingCount: list.length - doneCount,
      };
    };

    const raw = [
      buildSection(0, 'Sans logement', '#64748B', false),
      ...properties.map((p) => buildSection(p.id, p.name, p.color, Number(p.is_active) === 0)),
    ];
    return raw.filter((section) => !hiddenSet.has(section.id));
  }, [properties, tasks, hiddenPropertyIds]);

  const sections = useMemo(
    () => (hideEmptyProperties ? allSections.filter((s) => s.tasks.length > 0) : allSections),
    [hideEmptyProperties, allSections]
  );

  const effectiveActiveId = useMemo(() => {
    if (sections.length === 0) return null;
    if (activePropertyId !== null && sections.some((s) => s.id === activePropertyId)) {
      return activePropertyId;
    }
    return sections[0].id;
  }, [sections, activePropertyId]);

  useEffect(() => {
    if (effectiveActiveId === null) return;
    const bar = pillBarRef.current;
    const pill = document.getElementById(`property-pill-${effectiveActiveId}`);
    if (!bar || !pill) return;

    // bar possède position: relative, pill.offsetLeft est donc déjà relatif à bar
    const pillLeft = pill.offsetLeft;
    const pillRight = pillLeft + pill.offsetWidth;
    const viewLeft = bar.scrollLeft;
    const viewRight = viewLeft + bar.clientWidth;

    const behavior = getScrollBehavior();
    if (pillLeft < viewLeft + 8) {
      bar.scrollTo({ left: Math.max(0, pillLeft - 12), behavior });
    } else if (pillRight > viewRight - 8) {
      bar.scrollTo({ left: pillRight - bar.clientWidth + 12, behavior });
    }
  }, [effectiveActiveId]);

  const syncActiveFromRail = useCallback(() => {
    const rail = railRef.current;
    if (!rail || sections.length === 0) return;

    const targetLeft = programmaticTargetLeftRef.current;
    if (targetLeft !== null) {
      if (Math.abs(rail.scrollLeft - targetLeft) <= 2) {
        programmaticTargetLeftRef.current = null;
      } else {
        return;
      }
    }

    const maxScroll = rail.scrollWidth - rail.clientWidth;
    if (maxScroll <= 1 || sections.length === 1) {
      setActivePropertyId((prev) => (prev === sections[0].id ? prev : sections[0].id));
      return;
    }

    const progress = Math.max(0, Math.min(1, rail.scrollLeft / maxScroll));
    const idx = Math.round(progress * (sections.length - 1));
    const nextId = sections[idx]?.id ?? sections[0].id;
    setActivePropertyId((prev) => (prev === nextId ? prev : nextId));
  }, [sections]);

  const handleRailScroll = useCallback(() => {
    if (rafScrollRef.current !== null) return;
    rafScrollRef.current = window.requestAnimationFrame(() => {
      rafScrollRef.current = null;
      syncActiveFromRail();
    });
  }, [syncActiveFromRail]);

  useEffect(() => {
    return () => {
      if (rafScrollRef.current !== null) {
        window.cancelAnimationFrame(rafScrollRef.current);
      }
      if (programmaticTimerRef.current !== null) {
        window.clearTimeout(programmaticTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleWheel = (e: WheelEvent) => {
      programmaticTargetLeftRef.current = null;
      const absX = Math.abs(e.deltaX);
      const absY = Math.abs(e.deltaY);

      if (absX > absY && absX > 0) {
        rail.scrollLeft += e.deltaX;
        e.preventDefault();
        return;
      }

      if (e.shiftKey && absY > 0) {
        rail.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };

    const handleTouchStart = () => {
      programmaticTargetLeftRef.current = null;
    };

    rail.addEventListener('wheel', handleWheel, { passive: false });
    rail.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      rail.removeEventListener('wheel', handleWheel);
      rail.removeEventListener('touchstart', handleTouchStart);
    };
  }, [sections.length]);

  const handleToggleHideEmpty = useCallback(() => {
    setHideEmptyProperties((prev) => {
      const next = !prev;
      if (userId) {
        saveUserPreferences(userId, { hideEmptyProperties: next });
      }
      return next;
    });
  }, [userId]);

  const getContainerId = useCallback((t: Task) => t.property_id || 0, []);
  const handleDropReorder = useCallback(
    (draggedTask: Task, targetSectionId: number, orderedSectionTaskIds: number[]) => {
      if (onMoveTaskProperty) {
        const targetPropertyId = targetSectionId > 0 ? targetSectionId : null;
        onMoveTaskProperty(draggedTask.id, targetPropertyId, orderedSectionTaskIds);
      }
    },
    [onMoveTaskProperty]
  );

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
    getContainerId,
    isReadOnly,
    onDropReorder: handleDropReorder,
  });

  const scrollToProperty = useCallback(
    (propertyId: number) => {
      const idx = sections.findIndex((s) => s.id === propertyId);
      if (idx === -1) return;
      setActivePropertyId(propertyId);

      const rail = railRef.current;
      if (!rail) return;

      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const targetLeft =
        sections.length > 1
          ? Math.round((idx / (sections.length - 1)) * maxScroll)
          : 0;

      programmaticTargetLeftRef.current = targetLeft;
      if (programmaticTimerRef.current !== null) {
        window.clearTimeout(programmaticTimerRef.current);
      }
      // Filet de sécurité : libère le verrou même si le scroll-snap mobile décale légèrement la position finale
      programmaticTimerRef.current = window.setTimeout(() => {
        programmaticTargetLeftRef.current = null;
        programmaticTimerRef.current = null;
      }, 650);

      rail.scrollTo({ left: targetLeft, behavior: getScrollBehavior() });
    },
    [sections]
  );

  useEffect(() => {
    if (!lastCreatedBatch || isModalOpen) return;

    const firstSectionId = lastCreatedBatch.propertyId ?? 0;
    const hasSection = sections.some((s) => s.id === firstSectionId);
    const hasVisibleTask = tasks.some((t) => lastCreatedBatch.ids.includes(t.id));
    const batchIds = lastCreatedBatch.ids;

    onConsumeCreatedBatch?.();
    if (!hasSection || !hasVisibleTask) return;

    scrollToProperty(firstSectionId);

    const rafId = window.requestAnimationFrame(() => {
      const propScrollEl = document.querySelector<HTMLElement>(
        `[data-property-scroll="${firstSectionId}"]`
      );
      scrollContainersAndHighlightTasks({
        horizontalEl: railRef.current,
        verticalEl: propScrollEl,
        taskIds: batchIds,
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [lastCreatedBatch, isModalOpen, sections, tasks, scrollToProperty, onConsumeCreatedBatch]);

  if (allSections.length === 0) {
    return (
      <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center">
        <EyeOff className="w-8 h-8 mx-auto mb-2.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-[var(--cdh-text-primary)]">Tous les logements sont actuellement masqués.</p>
        <p className="text-xs text-[var(--cdh-text-secondary)] mt-1">Sélectionnez au moins un logement dans le filtre « Logements » ci-dessus.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 min-w-0 w-full flex flex-col gap-2.5">
      <div className="shrink-0 flex items-center justify-between gap-2">
        <div
          ref={pillBarRef}
          className="relative flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1.5 py-1 flex-1 min-w-0"
        >
          {sections.map((section) => {
            const isActive = effectiveActiveId === section.id;

            return (
              <button
                key={section.id}
                id={`property-pill-${section.id}`}
                type="button"
                aria-current={isActive ? 'location' : undefined}
                onClick={() => scrollToProperty(section.id)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-full text-[11.5px] font-semibold transition-colors duration-150 cursor-pointer tabular-nums ${
                  isActive
                    ? 'bg-[var(--cdh-surface-card-hover)] text-[var(--cdh-text-primary)] shadow-cdh-card ring-1 ring-[var(--cdh-accent)]/35'
                    : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: section.color || '#007AFF' }}
                />
                <span className="truncate max-w-[140px]">{section.name}</span>
                <span className="opacity-70 text-[10.5px]">
                  {section.remainingCount > 0 ? section.remainingCount : section.tasks.length}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-pressed={hideEmptyProperties}
          onClick={handleToggleHideEmpty}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-full text-[11.5px] font-semibold transition-colors duration-150 cursor-pointer ${
            hideEmptyProperties
              ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
              : 'cdh-glass-chrome text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)]'
          }`}
          title="Afficher ou masquer les logements sans tâche"
        >
          {hideEmptyProperties ? (
            <Eye className="w-3.5 h-3.5" strokeWidth={2} />
          ) : (
            <EyeOff className="w-3.5 h-3.5" strokeWidth={2} />
          )}
          <span className="hidden sm:inline">
            {hideEmptyProperties ? 'Tout afficher' : 'Masquer vides'}
          </span>
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center">
          <EyeOff className="w-8 h-8 mx-auto mb-2.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-[var(--cdh-text-primary)]">Aucun logement avec des tâches pour ces filtres.</p>
          <button
            type="button"
            onClick={handleToggleHideEmpty}
            className="mt-2 text-xs font-semibold text-[var(--cdh-accent)] hover:underline cursor-pointer"
          >
            Afficher aussi les logements vides
          </button>
        </div>
      ) : (
        <div
          ref={railRef}
          onScroll={handleRailScroll}
          className="flex-1 min-h-0 min-w-0 flex gap-3.5 sm:gap-4 items-stretch overflow-x-auto overflow-y-hidden overscroll-x-contain snap-x snap-mandatory sm:snap-none pb-2 -mx-3 px-3 sm:mx-0 sm:px-0"
        >
          {sections.map((section) => {
            const total = section.tasks.length;
            const percent = total > 0 ? Math.round((section.doneCount / total) * 100) : 0;
            const isHovered = activeDropContainer === section.id;

            return (
              <div
                key={section.id}
                onDragOver={(e) => handleDragOverContainer(e, section.id)}
                onDragLeave={handleDragLeaveContainer}
                onDrop={(e) => handleDropOnContainer(e, section.id)}
                className={`cdh-glass-column rounded-cdh-2xl p-3 sm:p-3.5 flex flex-col h-full min-h-0 w-[calc(100vw-2.25rem)] max-w-[350px] sm:w-[330px] shrink-0 snap-center sm:snap-start transition-colors duration-150 ${
                  isHovered ? 'ring-2 ring-[var(--cdh-accent)]/50 border-[var(--cdh-accent)]' : ''
                }`}
              >
                <div className="shrink-0">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[var(--cdh-border-hairline)] mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-cdh-sm flex items-center justify-center text-white shadow-xs shrink-0"
                        style={{ backgroundColor: ensureWhiteTextContrast(section.color) }}
                      >
                        <Home className="w-3.5 h-3.5" strokeWidth={2} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-[13px] text-[var(--cdh-text-primary)] leading-tight truncate">
                            {section.name}
                          </h3>
                          {section.isDeactivated && (
                            <Badge variant="neutral">Désactivé</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--cdh-text-secondary)] font-medium tabular-nums">
                          {section.doneCount}/{total} terminées ({percent}%)
                        </p>
                      </div>
                    </div>

                    {showQuickAddButtons && (
                      <button
                        type="button"
                        onClick={() => onAddNewTask(section.id > 0 ? section.id : undefined)}
                        aria-label={`Ajouter une tâche pour ${section.name}`}
                        className="p-1.5 text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] rounded-full transition-colors cursor-pointer shrink-0"
                        title={`Ajouter une tâche pour ${section.name}`}
                      >
                        <Plus className="w-4 h-4" strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  <ProgressBar value={percent} label={`Progression ${section.name}`} className="mb-1" />
                </div>

                <div
                  data-property-scroll={section.id}
                  className="cdh-prop-scroll space-y-2.5 flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2.5 -mx-2.5 pt-2.5 pb-4"
                >
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
                          allUsers={allUsers}
                          currentUser={currentUser}
                          isReadOnly={isReadOnly}
                          onEdit={onEditTask}
                          onDelete={onDeleteTask}
                          onToggleSubtask={onToggleSubtask}
                          onAddSubtask={onAddSubtask}
                          onUpdateStatus={onUpdateStatus}
                          onAssignTask={onAssignTask}
                          onQuickUpdateTask={onQuickUpdateTask}
                          onToggleStar={onToggleStar}
                          onDragStart={handleDragStart}
                          onDragEnd={resetDragState}
                          onDragOverCard={handleDragOverCard}
                          onDropOnCard={handleDropOnCard}
                          dropIndicator={indicator}
                          isDragging={draggedTaskId === task.id}
                        />
                      );
                    })
                  ) : (
                    <p
                      className={`py-8 px-3 text-center text-xs text-[var(--cdh-text-tertiary)] font-medium select-none transition-colors rounded-cdh-lg ${
                        isHovered
                          ? 'border-2 border-dashed border-[var(--cdh-accent)] bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)]'
                          : 'border border-dashed border-[var(--cdh-border-hairline)]'
                      }`}
                    >
                      {isReadOnly || currentUser?.role === 'read' ? 'Aucune tâche' : 'Déposer une tâche ici'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
