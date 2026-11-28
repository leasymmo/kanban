import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task, TaskPriority, TaskStatus, User } from '../types';
import { sortTasks } from '../utils/taskSort';
import {
  CreatedTaskBatch,
  findVisibleTaskCard,
  getScrollBehavior,
  prefersReducedMotion,
  scrollContainersAndHighlightTasks,
} from '../utils/taskMotion';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useProgressiveRenderLimit } from '../hooks/useProgressiveRenderLimit';
import { SPRINT_LIST_COLUMNS_CONFIG, useSprintListPrefs } from '../hooks/useSprintListPrefs';
import { ColumnsPopoverButton, MobileSortControls } from './sprint-list/SprintListControls';
import { SprintListTaskItem } from './sprint-list/SprintListTaskItem';
import { Button } from './ui';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from 'lucide-react';

interface SprintListBoardProps {
  tasks: Task[];
  allUsers?: User[];
  currentUser: User | null;
  isFilteredByAssignee?: boolean;
  onShowAllSprint?: () => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onAddSubtask?: (taskId: number, title: string, parentId?: number | null) => Promise<void>;
  onUpdateStatus: (taskId: number, newStatus: TaskStatus) => void;
  onAssignTask?: (taskId: number, userId: number | null) => void;
  onQuickUpdateTask?: (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask: () => void;
  canAddTasks?: boolean;
  isReadOnly: boolean;
  lastCreatedBatch?: CreatedTaskBatch | null;
  isModalOpen?: boolean;
  onConsumeCreatedBatch?: () => void;
}

/**
 * Vue globale « Cartes-Lignes Aérées » listant toutes les tâches du sprint :
 * - Tri multi-critères & colonnes configurables sauvegardés localement par utilisateur
 * - Accordéon exclusif animé sur chaque carte (détails montés uniquement à l'ouverture)
 * - Rendu unique responsive (desktop OU mobile via useMediaQuery)
 */
export const SprintListBoard: React.FC<SprintListBoardProps> = ({
  tasks,
  allUsers = [],
  currentUser,
  isFilteredByAssignee = false,
  onShowAllSprint,
  onEditTask,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onUpdateStatus,
  onAssignTask,
  onQuickUpdateTask,
  onToggleStar,
  onAddNewTask,
  canAddTasks,
  isReadOnly,
  lastCreatedBatch,
  isModalOpen = false,
  onConsumeCreatedBatch,
}) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const showQuickAddButton =
    canAddTasks !== undefined ? canAddTasks : !isReadOnly && currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';
  const assignableUsers = useMemo(() => allUsers.filter((u) => u.role !== 'read'), [allUsers]);

  const {
    sortBy,
    sortDir,
    visibleColumns,
    handleSelectSort,
    handleToggleSortDir,
    handleToggleColumn,
    handleResetColumns,
  } = useSprintListPrefs(currentUser);

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [closingTaskId, setClosingTaskId] = useState<number | null>(null);
  const prevExpandedIdRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);

  // Garder l'ancien panneau monté uniquement pendant l'animation de fermeture (280ms)
  useEffect(() => {
    const prevId = prevExpandedIdRef.current;
    if (prevId !== null && prevId !== expandedTaskId) {
      setClosingTaskId(prevId);
      const timer = window.setTimeout(() => {
        setClosingTaskId((cur) => (cur === prevId ? null : cur));
      }, prefersReducedMotion() ? 20 : 290);
      return () => window.clearTimeout(timer);
    }
  }, [expandedTaskId]);

  useEffect(() => {
    if (!lastCreatedBatch || isModalOpen) return;

    const hasVisibleTask = tasks.some((t) => lastCreatedBatch.ids.includes(t.id));
    onConsumeCreatedBatch?.();
    if (!hasVisibleTask) return;

    const taskIds = lastCreatedBatch.ids;
    const rafId = window.requestAnimationFrame(() => {
      scrollContainersAndHighlightTasks({
        verticalEl: boardRef.current,
        taskIds,
        targetMode: 'first-task',
        stickyTopOffset: window.innerWidth >= 768 ? 56 : 12,
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [lastCreatedBatch, isModalOpen, tasks, onConsumeCreatedBatch]);

  const handleToggleExpand = useCallback((taskId: number) => {
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  // Auto-scroll lors de l'ouverture d'un accordéon
  useEffect(() => {
    const prevId = prevExpandedIdRef.current;
    prevExpandedIdRef.current = expandedTaskId;

    if (expandedTaskId === null) return;

    const ensureExpandedCardVisible = (usePrediction: boolean) => {
      const board = boardRef.current;
      const cardEl = findVisibleTaskCard(expandedTaskId);
      if (!board || !cardEl) return;

      const boardRect = board.getBoundingClientRect();
      const headerClearance =
        stickyHeaderRef.current && window.innerWidth >= 768
          ? stickyHeaderRef.current.getBoundingClientRect().height + 6
          : 8;
      const visibleTop = boardRect.top + headerClearance;
      const visibleBottom = boardRect.bottom - 8;
      const availableHeight = Math.max(0, visibleBottom - visibleTop);

      const cardRect = cardEl.getBoundingClientRect();
      let targetTopEdge = cardRect.top;
      let targetBottomEdge = cardRect.bottom;

      if (usePrediction) {
        let collapsedAboveOffset = 0;
        if (prevId !== null && prevId !== expandedTaskId) {
          const prevEl = findVisibleTaskCard(prevId);
          if (
            prevEl &&
            Boolean(prevEl.compareDocumentPosition(cardEl) & Node.DOCUMENT_POSITION_FOLLOWING)
          ) {
            collapsedAboveOffset =
              prevEl.querySelector<HTMLElement>('.cdh-accordion-panel')?.getBoundingClientRect()
                .height ?? 0;
          }
        }

        const panelEl = cardEl.querySelector<HTMLElement>('.cdh-accordion-panel');
        const contentEl = cardEl.querySelector<HTMLElement>('.cdh-accordion-content');
        const currentPanelH = panelEl?.getBoundingClientRect().height ?? 0;
        const fullContentH = contentEl?.offsetHeight ?? currentPanelH;

        targetTopEdge = cardRect.top - collapsedAboveOffset;
        targetBottomEdge = targetTopEdge + (cardRect.height - currentPanelH) + fullContentH;
      }

      const cardHeight = targetBottomEdge - targetTopEdge;
      let delta = 0;

      if (targetTopEdge < visibleTop - 1 || cardHeight > availableHeight) {
        delta = targetTopEdge - visibleTop;
      } else if (targetBottomEdge > visibleBottom + 1) {
        delta = targetBottomEdge - visibleBottom;
      }

      if (Math.abs(delta) > 2) {
        const maxScroll = Math.max(0, board.scrollHeight - board.clientHeight);
        const nextTop = Math.max(0, Math.min(maxScroll, board.scrollTop + delta));
        if (Math.abs(nextTop - board.scrollTop) > 2) {
          board.scrollTo({ top: nextTop, behavior: getScrollBehavior() });
        }
      }
    };

    const rafId = window.requestAnimationFrame(() => ensureExpandedCardVisible(true));
    const settleDelay = prefersReducedMotion() ? 25 : 300;
    const settleTimer = window.setTimeout(() => ensureExpandedCardVisible(false), settleDelay);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
    };
  }, [expandedTaskId]);

  const sortedTasks = useMemo(
    () => sortTasks(tasks, sortBy, sortDir),
    [tasks, sortBy, sortDir]
  );

  const renderLimit = useProgressiveRenderLimit(
    sortedTasks.length,
    16,
    20,
    !!lastCreatedBatch || expandedTaskId !== null
  );

  const visibleSortedTasks = useMemo(
    () => (Number.isFinite(renderLimit) ? sortedTasks.slice(0, renderLimit) : sortedTasks),
    [sortedTasks, renderLimit]
  );

  useEffect(() => {
    if (expandedTaskId !== null && !sortedTasks.some((t) => t.id === expandedTaskId)) {
      setExpandedTaskId(null);
    }
  }, [sortedTasks, expandedTaskId]);

  const activeColumns = useMemo(
    () => SPRINT_LIST_COLUMNS_CONFIG.filter((c) => visibleColumns.includes(c.id)),
    [visibleColumns]
  );

  const desktopGridTemplate = useMemo(
    () => `24px ${activeColumns.map((c) => c.width).join(' ')} 28px`,
    [activeColumns]
  );

  return (
    <div
      ref={boardRef}
      className="flex-1 min-h-0 flex flex-col cdh-glass-column rounded-cdh-2xl p-2 sm:p-3 gap-2 overflow-y-auto overflow-x-hidden md:overflow-x-auto"
    >
      {!isDesktop && (
        <div className="flex items-center gap-1.5">
          <MobileSortControls
            sortBy={sortBy}
            sortDir={sortDir}
            onSelectSort={handleSelectSort}
            onToggleSortDir={handleToggleSortDir}
          />
          <ColumnsPopoverButton
            visibleColumns={visibleColumns}
            onToggleColumn={handleToggleColumn}
            onResetColumns={handleResetColumns}
            isMobile
          />
        </div>
      )}

      {sortedTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 gap-3">
          <p className="text-sm font-semibold text-[var(--cdh-text-primary)]">
            Aucune tâche dans cette vue
          </p>
          <p className="text-xs text-[var(--cdh-text-secondary)] max-w-md">
            {isFilteredByAssignee
              ? 'Aucune tâche ne correspond au filtre actif. Vous pouvez afficher toutes les tâches du sprint en cours.'
              : 'Ajustez vos filtres ou créez une nouvelle tâche pour démarrer le sprint.'}
          </p>
          <div className="flex items-center gap-2">
            {isFilteredByAssignee && onShowAllSprint && (
              <Button variant="secondary" size="sm" onClick={onShowAllSprint}>
                Tout le sprint
              </Button>
            )}
            {showQuickAddButton && (
              <Button
                variant="primary"
                size="sm"
                onClick={onAddNewTask}
                leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2.25} />}
              >
                Nouvelle tâche
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className={isDesktop ? 'flex flex-col gap-1.5 min-w-[780px]' : 'flex flex-col gap-2'}>
          {isDesktop && (
            <div
              ref={stickyHeaderRef}
              className="sticky top-0 z-20 cdh-glass-chrome rounded-cdh-lg px-3.5 py-2 grid items-center gap-2.5"
              style={{ gridTemplateColumns: desktopGridTemplate }}
            >
              <span aria-hidden="true" />
              {activeColumns.map((col) => {
                const isSorted = sortBy === col.sortKey;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => handleSelectSort(col.sortKey)}
                    className={`justify-self-start inline-flex items-center gap-1 px-1.5 py-1 -mx-1.5 -my-1 rounded-cdh-xs text-[11.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      isSorted
                        ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)]'
                        : 'text-[var(--cdh-text-secondary)] hover:bg-[var(--cdh-surface-control)] hover:text-[var(--cdh-text-primary)]'
                    }`}
                  >
                    <span>{col.label}</span>
                    {isSorted ? (
                      sortDir === 'asc' ? (
                        <ArrowUp className="w-3 h-3 shrink-0" strokeWidth={2.25} />
                      ) : (
                        <ArrowDown className="w-3 h-3 shrink-0" strokeWidth={2.25} />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 shrink-0 opacity-40" strokeWidth={2} />
                    )}
                  </button>
                );
              })}
              <div className="flex justify-end">
                <ColumnsPopoverButton
                  visibleColumns={visibleColumns}
                  onToggleColumn={handleToggleColumn}
                  onResetColumns={handleResetColumns}
                />
              </div>
            </div>
          )}

          {visibleSortedTasks.map((task) => {
            const isExpanded = expandedTaskId === task.id;
            const mountDetails = isExpanded || closingTaskId === task.id;
            return (
              <SprintListTaskItem
                key={task.id}
                task={task}
                isDesktop={isDesktop}
                isExpanded={isExpanded}
                mountDetails={mountDetails}
                visibleColumns={visibleColumns}
                activeColumns={activeColumns}
                desktopGridTemplate={desktopGridTemplate}
                isAdmin={isAdmin}
                isReadOnly={isReadOnly}
                assignableUsers={assignableUsers}
                onToggleExpand={handleToggleExpand}
                onEditTask={onEditTask}
                onDeleteTask={onDeleteTask}
                onToggleSubtask={onToggleSubtask}
                onAddSubtask={onAddSubtask}
                onUpdateStatus={onUpdateStatus}
                onAssignTask={onAssignTask}
                onQuickUpdateTask={onQuickUpdateTask}
                onToggleStar={onToggleStar}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
