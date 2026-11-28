import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Task, TaskPriority, TaskStatus, User } from '../types';
import {
  DEFAULT_TASK_LIST_COLUMNS,
  getUserPreferences,
  sanitizeTaskListColumns,
  saveUserPreferences,
  TaskListColumnId,
  TaskListSortDir,
  TaskListSortKey,
} from '../utils/cookies';
import {
  buildSubtaskTree,
  calculateSubtaskStats,
  HierarchicalSubtask,
  isTaskOverdue,
  parseLocalDate,
  SUBTASK_DEPTH_THEME,
} from '../utils/subtasks';
import { hexToSoftTint, ensureWhiteTextContrast } from '../utils/color';
import { CreatedTaskBatch, scrollContainersAndHighlightTasks } from '../utils/taskMotion';
import { BlurredIconSwap } from './BlurredIconSwap';
import { computePopoverPosition, PopoverStylePosition, toPopoverStyle } from './ui/popoverPosition';
import {
  Avatar,
  Badge,
  Button,
  ProgressBar,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TaskMetaBar,
  TaskPriorityIcon,
} from './ui';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Columns3,
  CornerDownRight,
  Edit3,
  Plus,
  Sparkles,
  Square,
  Star,
  Trash2,
  X,
  Zap,
} from 'lucide-react';

interface SprintListBoardProps {
  tasks: Task[];
  allUsers?: User[];
  currentUser: User | null;
  totalSprintTasksCount?: number;
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

interface ColumnConfig {
  id: TaskListColumnId;
  label: string;
  sortKey: TaskListSortKey;
  width: string;
  locked?: boolean;
}

const COLUMNS_CONFIG: ColumnConfig[] = [
  { id: 'status', label: 'Statut', sortKey: 'status', width: '98px' },
  { id: 'title', label: 'Tâche', sortKey: 'alpha', width: 'minmax(200px, 2.2fr)', locked: true },
  { id: 'property', label: 'Logement', sortKey: 'property', width: '136px' },
  { id: 'priority', label: 'Priorité', sortKey: 'priority', width: '96px' },
  { id: 'assignee', label: 'Responsable', sortKey: 'assignee', width: '116px' },
  { id: 'due_date', label: 'Échéance', sortKey: 'due_date', width: '96px' },
  { id: 'subtasks', label: 'Sous-tâches', sortKey: 'subtasks', width: '98px' },
  { id: 'created_at', label: 'Créée le', sortKey: 'created_at', width: '94px' },
];

const SORT_OPTIONS: { id: TaskListSortKey; label: string }[] = [
  { id: 'alpha', label: 'Alphabétique (A→Z)' },
  { id: 'status', label: 'Statut' },
  { id: 'priority', label: 'Priorité' },
  { id: 'due_date', label: "Date d'échéance" },
  { id: 'created_at', label: 'Date de création' },
  { id: 'property', label: 'Logement' },
  { id: 'assignee', label: 'Responsable' },
  { id: 'subtasks', label: 'Sous-tâches' },
];

const STATUS_ORDER: Record<string, number> = {
  blocked: 1,
  in_progress: 2,
  todo: 3,
  pending: 3,
  done: 4,
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 1,
  medium: 2,
  low: 3,
};

const SHORT_MONTHS = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function formatShortDate(dateStr?: string | null): string {
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return '—';
  return `${parsed.getDate()} ${SHORT_MONTHS[parsed.getMonth()]}`;
}

/**
 * Vue globale « Cartes-Lignes Aérées » listant toutes les tâches du sprint :
 * - Tri multi-critères & colonnes configurables sauvegardés dans les cookies utilisateur
 * - Accordéon exclusif animé sur chaque carte (un seul détail ouvert à la fois)
 * - Barre d'actions rapides identique au footer de TaskModal/TaskCard (TaskMetaBar + Modifier/Supprimer)
 */
export const SprintListBoard: React.FC<SprintListBoardProps> = ({
  tasks,
  allUsers = [],
  currentUser,
  totalSprintTasksCount,
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
  const showQuickAddButton =
    canAddTasks !== undefined ? canAddTasks : !isReadOnly && currentUser?.role === 'admin';
  const isAdmin = currentUser?.role === 'admin';
  const assignableUsers = useMemo(() => allUsers.filter((u) => u.role !== 'read'), [allUsers]);

  // Préférences de tri et de colonnes persistées en cookie par utilisateur
  const [sortBy, setSortBy] = useState<TaskListSortKey>(() => {
    if (!currentUser) return 'priority';
    return getUserPreferences(currentUser.id).taskListSortBy ?? 'priority';
  });
  const [sortDir, setSortDir] = useState<TaskListSortDir>(() => {
    if (!currentUser) return 'asc';
    return getUserPreferences(currentUser.id).taskListSortDir ?? 'asc';
  });
  const [visibleColumns, setVisibleColumns] = useState<TaskListColumnId[]>(() => {
    if (!currentUser) return [...DEFAULT_TASK_LIST_COLUMNS];
    return sanitizeTaskListColumns(getUserPreferences(currentUser.id).taskListVisibleColumns);
  });

  // Recharger les préférences si l'utilisateur change
  useEffect(() => {
    if (!currentUser) return;
    const prefs = getUserPreferences(currentUser.id);
    setSortBy(prefs.taskListSortBy ?? 'priority');
    setSortDir(prefs.taskListSortDir ?? 'asc');
    setVisibleColumns(sanitizeTaskListColumns(prefs.taskListVisibleColumns));
  }, [currentUser?.id]);

  // Accordéon exclusif (un seul id ouvert à la fois)
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);

  // État d'ajout de sous-étape imbriquée dans la carte ouverte
  const [addingChildToId, setAddingChildToId] = useState<number | null>(null);
  const [childTitle, setChildTitle] = useState('');
  const [isSubmittingChild, setIsSubmittingChild] = useState(false);

  // Popovers (Tri & Colonnes) portaled pour éviter tout clipping
  const [openMenu, setOpenMenu] = useState<'sort-desktop' | 'cols-desktop' | 'sort-mobile' | 'cols-mobile' | null>(null);
  const [menuPos, setMenuPos] = useState<PopoverStylePosition>({ top: 0, left: 0, maxHeight: 320 });
  const [menuWidth, setMenuWidth] = useState<number>(256);
  const boardRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const openPopoverFor = useCallback(
    (key: 'sort-desktop' | 'cols-desktop' | 'sort-mobile' | 'cols-mobile', width: number) => {
      if (openMenu === key) {
        setOpenMenu(null);
        return;
      }
      const btn = triggerRefs.current[key] ?? null;
      const computed = computePopoverPosition(btn, {
        width,
        preferredPlacement: 'below',
        minSpaceNeeded: 220,
        gap: 6,
        viewportPadding: 8,
      });
      // Aligner à droite du déclencheur quand le menu est à droite (colonnes / sort desktop)
      if (btn && key !== 'sort-mobile') {
        const rect = btn.getBoundingClientRect();
        const rightAlignedLeft = Math.round(
          Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
        );
        computed.left = rightAlignedLeft;
      }
      setMenuPos(computed);
      setMenuWidth(width);
      setOpenMenu(key);
    },
    [openMenu]
  );

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      const activeTrigger = triggerRefs.current[openMenu];
      if (activeTrigger?.contains(target)) return;
      setOpenMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    const handleResize = () => setOpenMenu(null);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [openMenu]);

  // Retour visuel lors de la création de nouvelles tâches
  useEffect(() => {
    if (!lastCreatedBatch || lastCreatedBatch.ids.length === 0 || isModalOpen) return;
    const cancel = scrollContainersAndHighlightTasks({
      taskIds: lastCreatedBatch.ids,
      tone: 'accent',
    });
    onConsumeCreatedBatch?.();
    return cancel;
  }, [lastCreatedBatch, isModalOpen, onConsumeCreatedBatch]);

  const handleSelectSort = useCallback(
    (nextKey: TaskListSortKey) => {
      let nextDir: TaskListSortDir = 'asc';
      if (sortBy === nextKey) {
        nextDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else if (nextKey === 'created_at') {
        nextDir = 'desc';
      }
      setSortBy(nextKey);
      setSortDir(nextDir);
      setOpenMenu(null);
      if (currentUser) {
        saveUserPreferences(currentUser.id, {
          taskListSortBy: nextKey,
          taskListSortDir: nextDir,
        });
      }
    },
    [sortBy, sortDir, currentUser]
  );

  const handleToggleSortDir = useCallback(() => {
    const nextDir: TaskListSortDir = sortDir === 'asc' ? 'desc' : 'asc';
    setSortDir(nextDir);
    if (currentUser) {
      saveUserPreferences(currentUser.id, { taskListSortDir: nextDir });
    }
  }, [sortDir, currentUser]);

  const handleToggleColumn = useCallback(
    (colId: TaskListColumnId) => {
      if (colId === 'title') return;
      setVisibleColumns((prev) => {
        const next = prev.includes(colId)
          ? prev.filter((id) => id !== colId)
          : [...prev, colId];
        const sanitized = sanitizeTaskListColumns(next);
        if (currentUser) {
          saveUserPreferences(currentUser.id, { taskListVisibleColumns: sanitized });
        }
        return sanitized;
      });
    },
    [currentUser]
  );

  const handleResetColumns = useCallback(() => {
    const defaults = [...DEFAULT_TASK_LIST_COLUMNS];
    setVisibleColumns(defaults);
    if (currentUser) {
      saveUserPreferences(currentUser.id, { taskListVisibleColumns: defaults });
    }
  }, [currentUser]);

  const handleToggleExpand = useCallback((taskId: number) => {
    setAddingChildToId(null);
    setChildTitle('');
    setExpandedTaskId((prev) => (prev === taskId ? null : taskId));
  }, []);

  const handleCreateChildSubtask = async (taskId: number, parentId: number) => {
    if (!childTitle.trim() || !onAddSubtask) return;
    setIsSubmittingChild(true);
    try {
      await onAddSubtask(taskId, childTitle.trim(), parentId);
      setChildTitle('');
      setAddingChildToId(null);
    } catch {
      // Erreur gérée par la notification globale
    } finally {
      setIsSubmittingChild(false);
    }
  };

  // Tri calculé des tâches
  const sortedTasks = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...tasks].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'alpha':
          cmp = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
          break;
        case 'status':
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case 'priority':
          cmp =
            (PRIORITY_ORDER[a.priority || 'medium'] ?? 2) -
            (PRIORITY_ORDER[b.priority || 'medium'] ?? 2);
          break;
        case 'due_date': {
          const da = a.due_date ? a.due_date.substring(0, 10) : '9999-12-31';
          const db = b.due_date ? b.due_date.substring(0, 10) : '9999-12-31';
          cmp = da.localeCompare(db);
          break;
        }
        case 'created_at': {
          const ca = a.created_at || '';
          const cb = b.created_at || '';
          cmp = ca.localeCompare(cb) || a.id - b.id;
          break;
        }
        case 'property':
          cmp = (a.property_name || 'zzz').localeCompare(b.property_name || 'zzz', 'fr', {
            sensitivity: 'base',
          });
          break;
        case 'assignee':
          cmp = (a.assigned_to_name || 'zzz').localeCompare(b.assigned_to_name || 'zzz', 'fr', {
            sensitivity: 'base',
          });
          break;
        case 'subtasks': {
          const sa = calculateSubtaskStats(a.subtasks);
          const sb = calculateSubtaskStats(b.subtasks);
          const ra = sa.total > 0 ? sa.done / sa.total : -1;
          const rb = sb.total > 0 ? sb.done / sb.total : -1;
          cmp = ra - rb;
          break;
        }
      }
      if (cmp === 0) {
        cmp = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
      }
      return cmp * dir;
    });
  }, [tasks, sortBy, sortDir]);

  // Si la tâche ouverte disparaît suite à un filtre/suppression, fermer proprement
  useEffect(() => {
    if (expandedTaskId !== null && !sortedTasks.some((t) => t.id === expandedTaskId)) {
      setExpandedTaskId(null);
    }
  }, [sortedTasks, expandedTaskId]);

  const activeColumns = useMemo(
    () => COLUMNS_CONFIG.filter((c) => visibleColumns.includes(c.id)),
    [visibleColumns]
  );

  const desktopGridTemplate = useMemo(
    () => `24px ${activeColumns.map((c) => c.width).join(' ')} 28px`,
    [activeColumns]
  );

  const activeSortOption = SORT_OPTIONS.find((s) => s.id === sortBy) ?? SORT_OPTIONS[0];

  const renderSubtaskNode = (task: Task, canModify: boolean, node: HierarchicalSubtask) => {
    const isDone = !!node.is_done;
    const canHaveChildren = node.depth < 3;
    const depthTheme = SUBTASK_DEPTH_THEME[node.depth] || SUBTASK_DEPTH_THEME[3];

    return (
      <div
        key={node.id}
        className={`space-y-1 ${node.depth > 0 ? `border-l-2 ${depthTheme.borderClass}` : ''}`}
      >
        <div className="flex items-start justify-between gap-1.5 py-0.5 group/item hover:bg-[var(--cdh-surface-control)] rounded-cdh-xs px-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (canModify) onToggleSubtask(node.id);
            }}
            className={`flex items-start gap-2 flex-1 text-left text-xs min-h-[28px] sm:min-h-0 py-0.5 ${
              canModify ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <BlurredIconSwap
              active={isDone}
              className="mt-0.5"
              activeIcon={<CheckSquare className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />}
              inactiveIcon={
                <Square className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
              }
            />
            <span
              className={`${
                isDone
                  ? 'line-through text-[var(--cdh-text-tertiary)]'
                  : 'text-[var(--cdh-text-primary)] font-medium'
              } leading-snug break-words`}
            >
              {node.title}
            </span>
          </button>

          {canModify && canHaveChildren && onAddSubtask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setAddingChildToId(addingChildToId === node.id ? null : node.id);
                setChildTitle('');
              }}
              aria-label={`Ajouter une sous-étape à ${node.title}`}
              className="opacity-100 sm:opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 focus-visible:opacity-100 p-1 sm:p-0.5 text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-info)] hover:bg-[var(--cdh-accent-soft)] rounded transition-opacity cursor-pointer shrink-0"
              title="Ajouter une sous-étape imbriquée"
            >
              <CornerDownRight className="w-3 h-3" strokeWidth={1.75} />
            </button>
          )}
        </div>

        {addingChildToId === node.id && (
          <div
            className="ml-4 pl-2 border-l-2 border-brand-400 py-1 flex items-center gap-1.5 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              autoFocus
              placeholder="Ajouter une sous-étape..."
              value={childTitle}
              onChange={(e) => setChildTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateChildSubtask(task.id, node.id);
                } else if (e.key === 'Escape') {
                  setAddingChildToId(null);
                }
              }}
              className="flex-1 px-2 py-1 text-xs border border-black/[0.12] rounded focus:ring-1 focus:ring-brand-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={isSubmittingChild || !childTitle.trim()}
              onClick={() => handleCreateChildSubtask(task.id, node.id)}
              aria-label="Valider la sous-étape"
              className="p-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3 h-3" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setAddingChildToId(null)}
              aria-label="Annuler"
              className="p-1.5 text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] rounded text-[11px] cursor-pointer"
            >
              <X className="w-3 h-3" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {node.children && node.children.length > 0 && (
          <div className="space-y-1 mt-0.5">
            {node.children.map((child) => renderSubtaskNode(task, canModify, child))}
          </div>
        )}
      </div>
    );
  };

  const renderColumnsPopover = (menuKey: 'cols-desktop' | 'cols-mobile', isMobile: boolean) => {
    const isOpen = openMenu === menuKey;
    return (
      <div className="relative shrink-0">
        <button
          ref={(el) => {
            triggerRefs.current[menuKey] = el;
          }}
          type="button"
          onClick={() => openPopoverFor(menuKey, 252)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label="Afficher ou masquer des colonnes"
          title={`Colonnes visibles (${visibleColumns.length}/${COLUMNS_CONFIG.length})`}
          className={`flex items-center justify-center rounded-cdh-md border transition-all active:scale-95 cursor-pointer ${
            isMobile ? 'w-[44px] h-[44px]' : 'w-8 h-8'
          } ${
            isOpen
              ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-info)]'
              : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-secondary)] hover:bg-[var(--cdh-surface-control-hover)] hover:text-[var(--cdh-text-primary)]'
          }`}
        >
          <Columns3 className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    );
  };

  const renderSortControl = (menuKey: 'sort-desktop' | 'sort-mobile', isMobile: boolean) => {
    const isOpen = openMenu === menuKey;
    return (
      <div className={`relative flex items-center gap-1.5 ${isMobile ? 'flex-1 min-w-0' : 'shrink-0'}`}>
        <button
          ref={(el) => {
            triggerRefs.current[menuKey] = el;
          }}
          type="button"
          onClick={() => openPopoverFor(menuKey, 240)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={`flex items-center justify-between gap-2 text-[12px] border rounded-cdh-md px-2.5 font-semibold transition-all active:scale-[0.98] cursor-pointer ${
            isMobile ? 'flex-1 min-w-0 min-h-[44px]' : 'h-8'
          } ${
            isOpen
              ? 'bg-[var(--cdh-accent-soft)] border-[var(--cdh-accent)]/30 text-[var(--cdh-info)]'
              : 'bg-[var(--cdh-surface-control)] border-[var(--cdh-border-hairline)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
          }`}
          title="Ordonner les tâches"
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <ArrowUpDown className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]" strokeWidth={2} />
            <span className="truncate">Tri : {activeSortOption.label}</span>
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-[var(--cdh-text-tertiary)] transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
          />
        </button>

        <button
          type="button"
          onClick={handleToggleSortDir}
          aria-label={sortDir === 'asc' ? 'Ordre croissant (inverser)' : 'Ordre décroissant (inverser)'}
          title={sortDir === 'asc' ? 'Ordre croissant — cliquer pour inverser' : 'Ordre décroissant — cliquer pour inverser'}
          className={`flex items-center justify-center rounded-cdh-md border border-[var(--cdh-border-hairline)] bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] transition-all active:scale-95 cursor-pointer shrink-0 ${
            isMobile ? 'w-[44px] h-[44px]' : 'w-8 h-8'
          }`}
        >
          {sortDir === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5" strokeWidth={2.25} />
          ) : (
            <ArrowDown className="w-3.5 h-3.5" strokeWidth={2.25} />
          )}
        </button>
      </div>
    );
  };

  const renderDesktopCell = (colId: TaskListColumnId, task: Task) => {
    const normalizedStatus: TaskStatus = task.status === 'pending' ? 'todo' : task.status;
    const statusMeta = TASK_STATUS_META[normalizedStatus] ?? TASK_STATUS_META.todo;
    const priorityMeta = TASK_PRIORITY_META[task.priority || 'medium'] ?? TASK_PRIORITY_META.medium;
    const overdue = isTaskOverdue(task.due_date, task.status);
    const { total, done, percent } = calculateSubtaskStats(task.subtasks);

    switch (colId) {
      case 'status':
        return (
          <span className="min-w-0 flex items-center">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{ backgroundColor: statusMeta.bgSoft, color: statusMeta.color }}
            >
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: statusMeta.color }}
              />
              {statusMeta.label}
            </span>
          </span>
        );

      case 'title':
        return (
          <span className="min-w-0 flex items-center gap-2">
            <span
              className={`font-semibold text-[13.5px] leading-snug truncate ${
                task.status === 'done'
                  ? 'line-through text-[var(--cdh-text-secondary)]'
                  : 'text-[var(--cdh-text-primary)]'
              }`}
            >
              {task.title}
            </span>
            {task.is_new ? (
              <Badge variant="accent" className="shrink-0">
                <Sparkles className="w-3 h-3" strokeWidth={2} />
                Nouveau
              </Badge>
            ) : null}
            {task.is_unplanned ? (
              <Badge variant="success" className="shrink-0 hidden xl:inline-flex">
                <Zap className="w-3 h-3" strokeWidth={2} />
                Complémentaire
              </Badge>
            ) : null}
          </span>
        );

      case 'property':
        return task.property_name ? (
          <span className="min-w-0 flex items-center">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-cdh-xs text-[var(--cdh-text-primary)] max-w-full"
              style={{ backgroundColor: hexToSoftTint(task.property_color, 0.14) }}
            >
              <span
                aria-hidden="true"
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: task.property_color || '#007AFF' }}
              />
              <span className="truncate">{task.property_name}</span>
            </span>
          </span>
        ) : (
          <span className="text-[12px] text-[var(--cdh-text-secondary)] truncate">Sans logement</span>
        );

      case 'priority':
        return (
          <span className="min-w-0 flex items-center">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
              style={{ backgroundColor: priorityMeta.bgSoft, color: priorityMeta.color }}
            >
              <TaskPriorityIcon priority={task.priority || 'medium'} className="w-3 h-3 shrink-0" />
              <span>
                {task.priority === 'high' ? 'Urgent' : task.priority === 'low' ? 'Basse' : 'Normale'}
              </span>
            </span>
          </span>
        );

      case 'assignee': {
        if (!task.assigned_to || !task.assigned_to_initials) {
          return (
            <span className="text-[11.5px] font-semibold text-[var(--cdh-warning)] truncate">
              À attribuer
            </span>
          );
        }
        const firstName = (task.assigned_to_name || 'Associé').split(' ')[0];
        return (
          <span className="min-w-0 flex items-center gap-2">
            <Avatar
              initials={task.assigned_to_initials}
              name={task.assigned_to_name}
              color={ensureWhiteTextContrast(task.assigned_to_color)}
              size="sm"
            />
            <span className="text-[12px] font-medium text-[var(--cdh-text-primary)] truncate">
              {firstName}
            </span>
          </span>
        );
      }

      case 'due_date':
        return task.due_date ? (
          <span
            className={`inline-flex items-center gap-1 text-[12px] tabular-nums font-mono whitespace-nowrap ${
              overdue ? 'font-bold text-[var(--cdh-danger)]' : 'font-medium text-[var(--cdh-text-secondary)]'
            }`}
          >
            <Calendar className="w-3 h-3 shrink-0" strokeWidth={2} />
            <span>{formatShortDate(task.due_date)}</span>
          </span>
        ) : (
          <span className="text-[12px] text-[var(--cdh-text-secondary)]">—</span>
        );

      case 'subtasks':
        if (total === 0) {
          return <span className="text-[12px] text-[var(--cdh-text-secondary)]">—</span>;
        }
        return (
          <span className="flex flex-col gap-1 min-w-0">
            <span className="flex items-center justify-between text-[11px] font-semibold tabular-nums text-[var(--cdh-text-secondary)]">
              <span>
                {done}/{total}
              </span>
              <span>{percent}%</span>
            </span>
            <ProgressBar value={percent} label="Sous-tâches" />
          </span>
        );

      case 'created_at':
        return (
          <span className="text-[11.5px] tabular-nums font-mono text-[var(--cdh-text-secondary)] whitespace-nowrap">
            {formatShortDate(task.created_at)}
          </span>
        );
    }
  };

  const renderMobileFieldChips = (task: Task) => {
    const normalizedStatus: TaskStatus = task.status === 'pending' ? 'todo' : task.status;
    const statusMeta = TASK_STATUS_META[normalizedStatus] ?? TASK_STATUS_META.todo;
    const priorityMeta = TASK_PRIORITY_META[task.priority || 'medium'] ?? TASK_PRIORITY_META.medium;
    const overdue = isTaskOverdue(task.due_date, task.status);
    const { total, done, percent } = calculateSubtaskStats(task.subtasks);

    const hasAnyChip =
      visibleColumns.includes('status') ||
      (visibleColumns.includes('property') && !!task.property_name) ||
      visibleColumns.includes('priority') ||
      (visibleColumns.includes('due_date') && !!task.due_date) ||
      (visibleColumns.includes('subtasks') && total > 0) ||
      visibleColumns.includes('created_at') ||
      visibleColumns.includes('assignee');

    if (!hasAnyChip) return null;

    return (
      <span className="flex items-center flex-wrap gap-1.5 w-full">
        {visibleColumns.includes('status') && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
            style={{ backgroundColor: statusMeta.bgSoft, color: statusMeta.color }}
          >
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: statusMeta.color }}
            />
            {statusMeta.label}
          </span>
        )}

        {visibleColumns.includes('property') && task.property_name && (
          <span
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-cdh-xs text-[var(--cdh-text-primary)]"
            style={{ backgroundColor: hexToSoftTint(task.property_color, 0.14) }}
          >
            <span
              aria-hidden="true"
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: task.property_color || '#007AFF' }}
            />
            {task.property_name}
          </span>
        )}

        {visibleColumns.includes('priority') && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
            style={{ backgroundColor: priorityMeta.bgSoft, color: priorityMeta.color }}
          >
            <TaskPriorityIcon priority={task.priority || 'medium'} className="w-3 h-3 shrink-0" />
            <span>
              {task.priority === 'high' ? 'Urgent' : task.priority === 'low' ? 'Basse' : 'Normale'}
            </span>
          </span>
        )}

        {visibleColumns.includes('due_date') && task.due_date && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-mono tabular-nums ${
              overdue ? 'font-bold text-[var(--cdh-danger)]' : 'font-medium text-[var(--cdh-text-secondary)]'
            }`}
          >
            <Calendar className="w-3 h-3 shrink-0" strokeWidth={2} />
            {formatShortDate(task.due_date)}
          </span>
        )}

        {visibleColumns.includes('subtasks') && total > 0 && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-mono tabular-nums font-semibold ${
              percent === 100 ? 'text-[var(--cdh-success)]' : 'text-[var(--cdh-text-secondary)]'
            }`}
          >
            <CheckSquare className="w-3 h-3 shrink-0" strokeWidth={2} />
            {done}/{total}
          </span>
        )}

        {visibleColumns.includes('created_at') && task.created_at && (
          <span className="text-[10.5px] font-mono tabular-nums text-[var(--cdh-text-secondary)]">
            Créée {formatShortDate(task.created_at)}
          </span>
        )}

        {visibleColumns.includes('assignee') && (
          <span className="ml-auto shrink-0">
            {task.assigned_to && task.assigned_to_initials ? (
              <Avatar
                initials={task.assigned_to_initials}
                name={task.assigned_to_name}
                color={ensureWhiteTextContrast(task.assigned_to_color)}
                size="xs"
              />
            ) : (
              <span className="text-[10.5px] font-semibold text-[var(--cdh-warning)]">
                À attribuer
              </span>
            )}
          </span>
        )}
      </span>
    );
  };

  /**
   * Contenu de la carte déployée (description, sous-tâches interactives,
   * et barre d'actions rapides identique au footer de création/modification de tâches).
   */
  const renderExpandedDetails = (task: Task, isMobile: boolean) => {
    const canModify = !isReadOnly && !!task.can_edit;
    const canDelete = !isReadOnly && !!task.can_delete;
    const canStar = !isReadOnly && !!task.can_star;
    const { total, done, percent } = calculateSubtaskStats(task.subtasks);
    const hierarchicalSubtasks = buildSubtaskTree(task.subtasks);

    return (
      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'}`}>
          {/* Colonne 1 : Description + méta création */}
          <div className="space-y-2.5 min-w-0">
            {task.description ? (
              <p className="text-[12.5px] text-[var(--cdh-text-secondary)] leading-relaxed break-words">
                <span className="text-[var(--cdh-accent)] font-semibold mr-1.5">→</span>
                {task.description}
              </p>
            ) : (
              <p className="text-[12px] italic text-[var(--cdh-text-tertiary)]">
                Aucune description renseignée pour cette tâche.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--cdh-text-secondary)]">
              {task.created_at && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)]" strokeWidth={2} />
                  <span>
                    Créée le{' '}
                    <strong className="font-mono font-semibold text-[var(--cdh-text-primary)]">
                      {formatShortDate(task.created_at)}
                    </strong>
                    {task.created_by_name ? ` par ${task.created_by_name}` : ''}
                  </span>
                </span>
              )}

              {isMobile && task.assigned_to_name && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar
                    initials={task.assigned_to_initials || '?'}
                    name={task.assigned_to_name}
                    color={ensureWhiteTextContrast(task.assigned_to_color)}
                    size="xs"
                  />
                  <span>{task.assigned_to_name}</span>
                </span>
              )}
            </div>
          </div>

          {/* Colonne 2 : Sous-tâches hiérarchiques */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs font-medium text-[var(--cdh-text-secondary)]">
              <span className="flex items-center gap-1.5 tabular-nums">
                <CheckSquare className="w-3.5 h-3.5 text-[var(--cdh-text-tertiary)]" strokeWidth={1.75} />
                Sous-tâches ({done}/{total})
              </span>
              {total > 0 && <span className="text-[11px] font-semibold tabular-nums">{percent}%</span>}
            </div>

            {total > 0 ? (
              <>
                <ProgressBar value={percent} label="Sous-tâches" />
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1 pt-0.5">
                  {hierarchicalSubtasks.map((node) => renderSubtaskNode(task, canModify, node))}
                </div>
              </>
            ) : (
              <p className="text-xs text-[var(--cdh-text-tertiary)]">
                Aucune sous-étape pour cette tâche.
              </p>
            )}
          </div>
        </div>

        {/* Footer unifié : mêmes boutons d'action rapide que le footer création/modification (TaskMetaBar) + Modifier/Supprimer */}
        <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] flex flex-wrap items-center justify-between gap-2.5">
          <TaskMetaBar
            size={isMobile ? 'md' : 'sm'}
            users={assignableUsers}
            assignedTo={task.assigned_to ?? ''}
            onChangeAssignee={(userId) => onAssignTask?.(task.id, userId === '' ? null : userId)}
            showAssignee={true}
            assigneeEditable={isAdmin && canModify && !!onAssignTask}
            allowUnassign={true}
            fallbackAssignee={{
              name: task.assigned_to_name,
              initials: task.assigned_to_initials,
              color: task.assigned_to_color,
            }}
            status={task.status === 'pending' ? 'todo' : task.status}
            onChangeStatus={(nextStatus) => onUpdateStatus(task.id, nextStatus)}
            priority={task.priority || 'medium'}
            onChangePriority={(nextPriority) =>
              onQuickUpdateTask?.(task.id, { priority: nextPriority })
            }
            dueDate={task.due_date || ''}
            onChangeDueDate={(nextDate) =>
              onQuickUpdateTask?.(task.id, { due_date: nextDate || null })
            }
            markOverdue={task.status !== 'done'}
            disabled={!canModify}
            showStar={canStar || !!task.is_starred}
            isStarred={!!task.is_starred}
            canToggleStar={canStar && !!onToggleStar}
            onToggleStar={() => onToggleStar?.(task.id)}
          />

          {(canModify || canDelete) && (
            <div className="flex items-center gap-1.5 shrink-0">
              {canModify && (
                <button
                  type="button"
                  onClick={() => onEditTask(task)}
                  aria-label="Modifier la tâche"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[32px] rounded-cdh-md text-xs font-semibold bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] text-[var(--cdh-text-primary)] hover:text-[var(--cdh-info)] transition-all active:scale-95 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Modifier</span>
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDeleteTask(task.id)}
                  aria-label="Supprimer la tâche"
                  title="Supprimer la tâche"
                  className="inline-flex items-center justify-center p-2 min-w-[38px] min-h-[38px] sm:min-w-[32px] sm:min-h-[32px] sm:p-1.5 rounded-cdh-md bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-danger-soft)] text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-danger)] transition-all active:scale-95 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={boardRef}
      className="flex-1 min-h-0 flex flex-col cdh-glass-column rounded-cdh-2xl p-2 sm:p-3 gap-2 overflow-y-auto"
    >
      {/* Barre supérieure du plateau : compteur + accès tout le sprint + tri rapide (desktop) / tri + colonnes (mobile) */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-1">
        <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-[var(--cdh-text-secondary)]">
          <span>
            <strong className="font-semibold text-[var(--cdh-text-primary)] tabular-nums">
              {sortedTasks.length}
            </strong>{' '}
            {sortedTasks.length > 1 ? 'tâches' : 'tâche'} affichée
            {sortedTasks.length > 1 ? 's' : ''}
          </span>

          {isFilteredByAssignee && onShowAllSprint && totalSprintTasksCount !== undefined && (
            <button
              type="button"
              onClick={onShowAllSprint}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] hover:opacity-85 transition-opacity cursor-pointer"
            >
              Voir tout le sprint ({totalSprintTasksCount})
            </button>
          )}

          <span className="hidden lg:inline text-[var(--cdh-text-tertiary)]">
            · Cliquer sur une carte pour ouvrir ses détails
          </span>
        </div>

        {/* Contrôles Desktop : Tri rapide (inclut Date de création même si colonne masquée) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {renderSortControl('sort-desktop', false)}
        </div>

        {/* Contrôles Mobile : Tri + Bouton Colonnes en haut à droite */}
        <div className="flex md:hidden items-center gap-1.5">
          {renderSortControl('sort-mobile', true)}
          {renderColumnsPopover('cols-mobile', true)}
        </div>
      </div>

      {/* État vide */}
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
        <>
          {/* ==================== VUE DESKTOP (Cartes-Lignes alignées en colonnes) ==================== */}
          <div className="hidden md:flex flex-col gap-1.5 min-w-0">
            <div className="overflow-x-auto no-scrollbar pb-0.5">
              <div className="min-w-[780px] flex flex-col gap-1.5">
                {/* En-tête de colonnes sticky avec icône Colonnes en haut à droite */}
                <div
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
                    {renderColumnsPopover('cols-desktop', false)}
                  </div>
                </div>

                {/* Cartes-lignes */}
                {sortedTasks.map((task) => {
                  const isExpanded = expandedTaskId === task.id;
                  return (
                    <article
                      key={task.id}
                      data-task-card-id={task.id}
                      data-expanded={isExpanded}
                      className={`cdh-surface-card rounded-cdh-lg overflow-hidden ${
                        task.is_starred ? 'cdh-card-starred' : ''
                      } ${!task.is_starred && task.status === 'blocked' ? 'cdh-card-blocked' : ''} ${
                        isExpanded
                          ? 'ring-1 ring-[var(--cdh-accent)]/35 shadow-cdh-card-hover bg-[var(--cdh-surface-card-hover)]'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(task.id)}
                        aria-expanded={isExpanded}
                        className="w-full text-left px-3.5 py-2.5 min-h-[44px] grid items-center gap-2.5 cursor-pointer transition-colors"
                        style={{ gridTemplateColumns: desktopGridTemplate }}
                      >
                        <span
                          className={`flex items-center justify-center transition-transform duration-200 ${
                            isExpanded
                              ? 'rotate-90 text-[var(--cdh-info)]'
                              : 'text-[var(--cdh-text-tertiary)]'
                          }`}
                          aria-hidden="true"
                        >
                          <ChevronRight className="w-4 h-4" strokeWidth={2} />
                        </span>

                        {activeColumns.map((col) => (
                          <React.Fragment key={col.id}>
                            {renderDesktopCell(col.id, task)}
                          </React.Fragment>
                        ))}

                        <span className="flex justify-end">
                          {task.is_starred ? (
                            <Star
                              className="w-3.5 h-3.5 text-[var(--cdh-warning-accent)] fill-current"
                              strokeWidth={2}
                              aria-label="Mise en avant pour la réunion"
                            />
                          ) : null}
                        </span>
                      </button>

                      <div
                        className="cdh-accordion-panel"
                        data-open={isExpanded}
                        {...(!isExpanded ? ({ inert: '' } as React.HTMLAttributes<HTMLDivElement>) : {})}
                      >
                        <div className="cdh-accordion-inner">
                          <div className="cdh-accordion-content px-4 pb-3.5 pt-3 pl-[48px] border-t border-[var(--cdh-border-hairline)]">
                            {renderExpandedDetails(task, false)}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ==================== VUE MOBILE PWA (Cards empilées sans scroll horizontal) ==================== */}
          <div className="flex md:hidden flex-col gap-2">
            {sortedTasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              const chipsNode = renderMobileFieldChips(task);
              return (
                <article
                  key={task.id}
                  data-task-card-id={task.id}
                  data-expanded={isExpanded}
                  className={`cdh-surface-card rounded-cdh-lg overflow-hidden ${
                    task.is_starred ? 'cdh-card-starred' : ''
                  } ${!task.is_starred && task.status === 'blocked' ? 'cdh-card-blocked' : ''} ${
                    isExpanded ? 'ring-1 ring-[var(--cdh-accent)]/35 shadow-cdh-card-hover' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleExpand(task.id)}
                    aria-expanded={isExpanded}
                    className="w-full text-left p-3.5 flex flex-col gap-2 cursor-pointer"
                  >
                    <span className="flex items-start justify-between gap-2 w-full">
                      <span
                        className={`font-semibold text-[14px] leading-snug break-words ${
                          task.status === 'done'
                            ? 'line-through text-[var(--cdh-text-secondary)]'
                            : 'text-[var(--cdh-text-primary)]'
                        }`}
                      >
                        {task.title}
                      </span>
                      <span className="flex items-center gap-1 shrink-0 mt-0.5">
                        {task.is_starred ? (
                          <Star
                            className="w-3.5 h-3.5 text-[var(--cdh-warning-accent)] fill-current"
                            strokeWidth={2}
                          />
                        ) : null}
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isExpanded
                              ? 'rotate-180 text-[var(--cdh-info)]'
                              : 'text-[var(--cdh-text-tertiary)]'
                          }`}
                          strokeWidth={2}
                        />
                      </span>
                    </span>

                    {chipsNode}
                  </button>

                  <div
                    className="cdh-accordion-panel"
                    data-open={isExpanded}
                    {...(!isExpanded ? ({ inert: '' } as React.HTMLAttributes<HTMLDivElement>) : {})}
                  >
                    <div className="cdh-accordion-inner">
                      <div className="cdh-accordion-content p-3.5 border-t border-[var(--cdh-border-hairline)]">
                        {renderExpandedDetails(task, true)}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Popovers Liquid Glass portaled dans document.body (jamais clippés par overflow) */}
      {openMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={
              openMenu.startsWith('cols') ? 'Colonnes visibles' : 'Ordonner les tâches'
            }
            style={toPopoverStyle(menuPos, menuWidth)}
            className="fixed z-[80] cdh-glass-overlay rounded-cdh-xl p-1.5 animate-fade-in space-y-0.5 overflow-y-auto"
          >
            {openMenu.startsWith('cols') ? (
              <>
                <div className="px-2.5 py-1 flex items-center justify-between">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                    {openMenu === 'cols-mobile' ? 'Champs visibles' : 'Colonnes visibles'}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetColumns}
                    className="text-[11px] font-semibold text-[var(--cdh-info)] hover:underline cursor-pointer"
                  >
                    Par défaut
                  </button>
                </div>

                {COLUMNS_CONFIG.map((col) => {
                  const isVisible = visibleColumns.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      disabled={col.locked}
                      onClick={() => handleToggleColumn(col.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 sm:py-1.5 rounded-cdh-sm text-xs transition-colors ${
                        col.locked
                          ? 'opacity-55 cursor-not-allowed text-[var(--cdh-text-secondary)]'
                          : 'cursor-pointer hover:bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)] font-semibold'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <span>{col.label}</span>
                        {col.locked && (
                          <span className="text-[10px] font-normal text-[var(--cdh-text-tertiary)]">
                            (fixe)
                          </span>
                        )}
                      </span>
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                          isVisible
                            ? 'bg-[var(--cdh-accent)] border-[var(--cdh-accent)] text-white'
                            : 'border-black/[0.15] bg-white dark:bg-transparent'
                        }`}
                      >
                        <Check
                          className={`w-3 h-3 transition-all duration-150 ${
                            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                          }`}
                          strokeWidth={2.25}
                        />
                      </span>
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                <div className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--cdh-text-tertiary)]">
                  Ordonner par
                </div>
                {SORT_OPTIONS.map((opt) => {
                  const isSelected = sortBy === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectSort(opt.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 sm:py-1.5 rounded-cdh-sm text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-info)] font-semibold'
                          : 'text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control)] font-medium'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected &&
                        (sortDir === 'asc' ? (
                          <ArrowUp
                            className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]"
                            strokeWidth={2.25}
                          />
                        ) : (
                          <ArrowDown
                            className="w-3.5 h-3.5 shrink-0 text-[var(--cdh-info)]"
                            strokeWidth={2.25}
                          />
                        ))}
                    </button>
                  );
                })}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
