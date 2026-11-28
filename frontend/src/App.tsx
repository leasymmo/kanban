import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  User,
  Sprint,
  Task,
  Question,
  Property,
  TaskStatus,
  SprintDetailsPayload,
} from './types';
import { api, isAbortError, isNetworkError, setUnauthorizedHandler } from './api/client';
import { useTheme } from './contexts/ThemeContext';
import { useToast } from './contexts/ToastContext';
import { useTaskFilters } from './hooks/useTaskFilters';
import { useSprintListPrefs } from './hooks/useSprintListPrefs';
import { usePaginatedTasks } from './hooks/usePaginatedTasks';
import { usePaginatedQuestions } from './hooks/usePaginatedQuestions';
import { EMPTY_MEETING_SUMMARY, useMeetingData } from './hooks/useMeetingData';
import { QuestionStoreAdapter, useSprintQuestions } from './hooks/useSprintQuestions';
import { TaskStoreAdapter, useSprintTasks } from './hooks/useSprintTasks';
import {
  getLastUserId,
  getUserPreferences,
  saveLastUserId,
  saveUserPreferences,
  TaskViewMode,
} from './utils/cookies';
import {
  buildSprintDetailsRequestParams,
  QuestionQueryCriteria,
  TaskQueryCriteria,
} from './utils/paginationParams';
import { CreatedTaskBatch, scheduleTaskMotionFeedback } from './utils/taskMotion';
import { Navbar } from './components/Navbar';
import { TasksTab } from './components/TasksTab';
import { RefreshCw, AlertCircle } from 'lucide-react';

const LoginPage = React.lazy(() =>
  import('./components/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const QuestionsView = React.lazy(() =>
  import('./components/QuestionsView').then((m) => ({ default: m.QuestionsView }))
);
const MeetingView = React.lazy(() =>
  import('./components/MeetingView').then((m) => ({ default: m.MeetingView }))
);
const TaskModal = React.lazy(() =>
  import('./components/TaskModal').then((m) => ({ default: m.TaskModal }))
);
const CloseSprintModal = React.lazy(() =>
  import('./components/CloseSprintModal').then((m) => ({ default: m.CloseSprintModal }))
);
const MeetingQuickTaskModal = React.lazy(() =>
  import('./components/MeetingQuickTaskModal').then((m) => ({ default: m.MeetingQuickTaskModal }))
);
const QuestionModal = React.lazy(() =>
  import('./components/QuestionModal').then((m) => ({ default: m.QuestionModal }))
);
const AdminPanelModal = React.lazy(() =>
  import('./components/AdminPanelModal').then((m) => ({ default: m.AdminPanelModal }))
);

function sortProperties(list: Property[]): Property[] {
  return [...list].sort(
    (a, b) =>
      Number(b.is_active) - Number(a.is_active) ||
      (a.position ?? 0) - (b.position ?? 0) ||
      a.name.localeCompare(b.name)
  );
}

const ViewLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24">
    <RefreshCw className="w-7 h-7 animate-spin text-[var(--cdh-accent)] mb-2.5" strokeWidth={1.75} />
    <p className="text-xs font-medium text-[var(--cdh-text-secondary)]">Chargement…</p>
  </div>
);

export const App: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { showToast, showSuccessToast, showErrorToast, setHasBottomDock } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [currentSprintId, setCurrentSprintId] = useState<number | null>(null);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tasks' | 'questions' | 'meeting'>('tasks');
  const [lastCreatedBatch, setLastCreatedBatch] = useState<CreatedTaskBatch | null>(null);

  const initialHintUserId = useMemo(() => getLastUserId(), []);
  const [taskViewMode, setTaskViewModeState] = useState<TaskViewMode>(() => {
    if (!initialHintUserId) return 'kanban';
    return getUserPreferences(initialHintUserId).taskViewMode ?? 'kanban';
  });
  const [hideEmptyProperties, setHideEmptyProperties] = useState<boolean>(() => {
    if (!initialHintUserId) return true;
    return getUserPreferences(initialHintUserId).hideEmptyProperties ?? true;
  });

  const loadedPrefsUserIdRef = useRef<number | null>(initialHintUserId);
  useEffect(() => {
    const uid = currentUser?.id ?? null;
    if (!uid || loadedPrefsUserIdRef.current === uid) return;
    loadedPrefsUserIdRef.current = uid;
    const prefs = getUserPreferences(uid);
    setTaskViewModeState(prefs.taskViewMode ?? 'kanban');
    setHideEmptyProperties(prefs.hideEmptyProperties ?? true);
  }, [currentUser?.id]);

  const handleChangeViewMode = useCallback(
    (mode: TaskViewMode) => {
      setTaskViewModeState(mode);
      if (currentUser?.id) {
        saveUserPreferences(currentUser.id, { taskViewMode: mode });
      }
    },
    [currentUser?.id]
  );

  const handleToggleHideEmptyProperties = useCallback(() => {
    setHideEmptyProperties((prev) => {
      const next = !prev;
      if (currentUser?.id) {
        saveUserPreferences(currentUser.id, { hideEmptyProperties: next });
      }
      return next;
    });
  }, [currentUser?.id]);

  const currentUserRef = useRef<User | null>(currentUser);
  currentUserRef.current = currentUser;
  const sprintsRef = useRef<Sprint[]>(sprints);
  sprintsRef.current = sprints;
  const currentSprintIdRef = useRef<number | null>(currentSprintId);
  currentSprintIdRef.current = currentSprintId;
  const sprintReqIdRef = useRef(0);
  const sprintAbortRef = useRef<AbortController | null>(null);
  const crossTabModalTimerRef = useRef<number | null>(null);

  // Modales
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskModalInitialStatus, setTaskModalInitialStatus] = useState<TaskStatus>('todo');
  const [taskModalInitialPropertyId, setTaskModalInitialPropertyId] = useState<number | null>(null);
  const [taskModalInitialAssignedTo, setTaskModalInitialAssignedTo] = useState<number | null | undefined>(undefined);
  const [taskModalCreationSource, setTaskModalCreationSource] = useState<'tasks' | 'meeting'>('tasks');
  const [isCloseSprintModalOpen, setIsCloseSprintModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isMeetingQuickModalOpen, setIsMeetingQuickModalOpen] = useState(false);
  const [editingPendingTask, setEditingPendingTask] = useState<Task | null>(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingMeetingQuestion, setEditingMeetingQuestion] = useState<Question | null>(null);

  // Filtres & préférences de tri des tâches
  const taskFilters = useTaskFilters(properties, currentUser);
  const listPrefs = useSprintListPrefs(currentUser);

  const taskCriteria = useMemo(
    () => ({
      taskFilter: taskFilters.taskFilter,
      search: taskFilters.taskSearchQuery,
      hiddenStatuses: taskFilters.hiddenStatuses,
      hiddenPriorities: taskFilters.hiddenPriorities,
      hiddenPropertyIds: taskFilters.hiddenPropertyIds,
      dueState: taskFilters.taskDueState,
      starredOnly: taskFilters.taskStarredOnly,
      unplannedOnly: taskFilters.taskUnplannedOnly,
      hideEmptyProperties,
      listSortBy: listPrefs.sortBy,
      listSortDir: listPrefs.sortDir,
      boardSortBy: listPrefs.boardSortBy,
      boardSortDir: listPrefs.boardSortDir,
    }),
    [
      taskFilters.taskFilter,
      taskFilters.taskSearchQuery,
      taskFilters.hiddenStatuses,
      taskFilters.hiddenPriorities,
      taskFilters.hiddenPropertyIds,
      taskFilters.taskDueState,
      taskFilters.taskStarredOnly,
      taskFilters.taskUnplannedOnly,
      hideEmptyProperties,
      listPrefs.sortBy,
      listPrefs.sortDir,
      listPrefs.boardSortBy,
      listPrefs.boardSortDir,
    ]
  );

  // Store paginé des tâches (Vue Kanban / Logements / Tableau)
  const paginatedTasks = usePaginatedTasks({
    sprintId: currentSprintId,
    viewMode: taskViewMode,
    criteria: taskCriteria,
    enabled: !!currentUser && !!currentSprintId && activeTab === 'tasks',
    onError: showErrorToast,
  });

  // Store paginé des questions (Onglet Questions)
  const paginatedQuestions = usePaginatedQuestions({
    sprintId: currentSprintId,
    enabled: !!currentUser && !!currentSprintId && activeTab === 'questions',
    onError: showErrorToast,
  });

  // Store paginé de la vue Réunion (chargé uniquement quand l'onglet Réunion est actif)
  const meetingData = useMeetingData({
    sprintId: currentSprintId,
    enabled: !!currentUser && !!currentSprintId && activeTab === 'meeting',
    onError: showErrorToast,
  });

  // Refs vers les stores paginés afin de garder des callbacks de cycle de vie strictement stables
  const paginatedTasksRef = useRef(paginatedTasks);
  paginatedTasksRef.current = paginatedTasks;
  const paginatedQuestionsRef = useRef(paginatedQuestions);
  paginatedQuestionsRef.current = paginatedQuestions;
  const meetingDataRef = useRef(meetingData);
  meetingDataRef.current = meetingData;

  const buildCurrentTaskCriteria = useCallback(
    (sprintId: number, userId: number | null): TaskQueryCriteria => {
      const prefs = userId ? getUserPreferences(userId) : {};
      return {
        sprintId,
        viewMode: prefs.taskViewMode ?? 'kanban',
        taskFilter: prefs.taskFilter ?? 'me',
        search: prefs.taskSearchQuery ?? '',
        hiddenStatuses: prefs.hiddenStatuses ?? [],
        hiddenPriorities: prefs.hiddenPriorities ?? [],
        hiddenPropertyIds: prefs.hiddenPropertyIds ?? [],
        dueState: prefs.taskDueState ?? 'all',
        starredOnly: prefs.taskStarredOnly ?? false,
        unplannedOnly: prefs.taskUnplannedOnly ?? false,
        hideEmptyProperties: prefs.hideEmptyProperties ?? true,
        listSortBy: prefs.taskListSortBy ?? 'priority',
        listSortDir: prefs.taskListSortDir ?? 'asc',
        boardSortBy: prefs.taskBoardSortBy ?? 'position',
        boardSortDir: prefs.taskBoardSortDir ?? 'asc',
      };
    },
    []
  );

  const buildDefaultQuestionCriteria = useCallback(
    (sprintId: number): QuestionQueryCriteria => ({
      sprintId,
      userFilter: 'me',
      search: '',
      decisionStatus: 'all',
      hasAnswers: 'all',
      answeredByMe: null,
      sortBy: 'created_at',
      sortDir: 'asc',
    }),
    []
  );

  const applySprintDetailsPayload = useCallback(
    (details: SprintDetailsPayload, prefUserId: number | null, matchedHintUser: boolean) => {
      setIsReadOnly(details.is_read_only);
      meetingDataRef.current.setMeetingSummary(details.meeting_summary || EMPTY_MEETING_SUMMARY);
      meetingDataRef.current.reloadIfActive();

      if (matchedHintUser) {
        paginatedTasksRef.current.hydrateFromServerPayload(
          details.tasks_page,
          buildCurrentTaskCriteria(details.sprint.id, prefUserId)
        );
        paginatedQuestionsRef.current.hydrateFromServerPayload(
          details.questions_page,
          buildDefaultQuestionCriteria(details.sprint.id)
        );
      } else {
        paginatedTasksRef.current.resetStore();
        paginatedQuestionsRef.current.resetStore();
      }
    },
    [buildCurrentTaskCriteria, buildDefaultQuestionCriteria]
  );

  const loadSprintDetails = useCallback(
    async (sprintId: number) => {
      sprintAbortRef.current?.abort();
      const controller = new AbortController();
      sprintAbortRef.current = controller;
      const reqId = ++sprintReqIdRef.current;

      try {
        const uid = currentUserRef.current?.id ?? null;
        const reqParams = buildSprintDetailsRequestParams(uid, sprintId);
        const details = await api.getSprintDetails(sprintId, reqParams, controller.signal);
        if (reqId !== sprintReqIdRef.current || !details.success) return;
        applySprintDetailsPayload(details, uid, true);
      } catch (err: any) {
        if (isAbortError(err) || reqId !== sprintReqIdRef.current) return;
        console.error('Erreur chargement sprint :', err);
        const sprint = sprintsRef.current.find((s) => s.id === sprintId);
        setIsReadOnly(sprint?.status === 'closed' && currentUserRef.current?.role !== 'admin');
        if (!isNetworkError(err)) {
          showErrorToast(err?.message || 'Impossible de charger les détails du sprint.');
        }
      }
    },
    [applySprintDetailsPayload, showErrorToast]
  );

  const taskStoreAdapter = useMemo<TaskStoreAdapter>(
    () => ({
      findTask: (taskId) =>
        paginatedTasksRef.current.findLoadedTask(taskId) ??
        meetingDataRef.current.allMeetingTasks.find((t) => t.id === taskId),
      findTaskBySubtaskId: (subtaskId) =>
        paginatedTasksRef.current.loadedTasks.find((t) =>
          (t.subtasks || []).some((st) => st.id === subtaskId)
        ) ??
        meetingDataRef.current.allMeetingTasks.find((t) =>
          (t.subtasks || []).some((st) => st.id === subtaskId)
        ),
      patchTask: (taskId, updater) => {
        paginatedTasksRef.current.patchTaskInStore(taskId, updater);
        meetingDataRef.current.patchMeetingTask(taskId, updater);
      },
      moveTask: (opts) => {
        paginatedTasksRef.current.moveTaskOptimistic(opts);
        meetingDataRef.current.patchMeetingTask(opts.taskId, (t) => ({
          ...t,
          ...(opts.targetStatus !== undefined ? { status: opts.targetStatus } : {}),
          ...(opts.targetPropertyId !== undefined
            ? { property_id: opts.targetPropertyId, ...opts.propertyPatch }
            : {}),
        }));
      },
      insertCreatedTasks: (createdTasks) => {
        paginatedTasksRef.current.insertCreatedTasks(createdTasks);
        meetingDataRef.current.insertMeetingTasks(createdTasks);
      },
      removeTask: (taskId) => {
        paginatedTasksRef.current.removeTaskFromStore(taskId);
        meetingDataRef.current.removeMeetingTask(taskId);
      },
      refreshFacets: () => paginatedTasksRef.current.refreshFacetsSilently(),
      refreshSummary: () => meetingDataRef.current.refreshSummary(currentSprintIdRef.current ?? undefined),
      onCreatedBatch: (batch) => setLastCreatedBatch(batch),
      fallbackReload: async () => {
        await Promise.all([
          paginatedTasksRef.current.reloadCurrentView(),
          meetingDataRef.current.refreshSummary(currentSprintIdRef.current ?? undefined),
        ]);
        meetingDataRef.current.reloadIfActive();
      },
    }),
    []
  );

  const {
    saveTask,
    updateTaskStatus,
    quickUpdateTask,
    reorderKanbanTask,
    moveTaskProperty,
    assignTask,
    deleteTask,
    toggleSubtask,
    addSubtask,
    toggleStar,
  } = useSprintTasks({
    currentSprintId,
    currentUser,
    allUsers,
    properties,
    store: taskStoreAdapter,
    onSuccess: showSuccessToast,
    onError: showErrorToast,
  });

  const questionStoreAdapter = useMemo<QuestionStoreAdapter>(
    () => ({
      findQuestion: (qId) =>
        paginatedQuestionsRef.current.questions.find((q) => q.id === qId) ??
        meetingDataRef.current.meetingQuestions.find((q) => q.id === qId),
      patchQuestion: (qId, updater) => {
        paginatedQuestionsRef.current.patchQuestionInStore(qId, updater);
        meetingDataRef.current.patchMeetingQuestion(qId, updater);
      },
      insertCreatedQuestion: (created) => {
        paginatedQuestionsRef.current.insertCreatedQuestion(created, currentUserRef.current?.id);
        meetingDataRef.current.insertMeetingQuestion(created);
      },
      removeQuestion: (qId) => {
        paginatedQuestionsRef.current.removeQuestionFromStore(qId);
        meetingDataRef.current.removeMeetingQuestion(qId);
      },
      refreshFacets: () => paginatedQuestionsRef.current.refreshFacetsSilently(),
      refreshSummary: () => meetingDataRef.current.refreshSummary(currentSprintIdRef.current ?? undefined),
      fallbackReload: async () => {
        await Promise.all([
          paginatedQuestionsRef.current.reloadCurrent(),
          meetingDataRef.current.refreshSummary(currentSprintIdRef.current ?? undefined),
        ]);
        meetingDataRef.current.reloadIfActive();
      },
    }),
    []
  );

  const {
    handleAddQuestion,
    handleUpdateQuestion,
    handleDeleteQuestion,
    handleAddAnswer,
    handleUpdateAnswer,
    handleDeleteAnswer,
    handleSetQuestionDecision,
  } = useSprintQuestions({
    currentSprintId,
    currentUser,
    allUsers,
    store: questionStoreAdapter,
    onSuccess: showSuccessToast,
    onError: showErrorToast,
  });

  const clearCrossTabTimer = useCallback(() => {
    if (crossTabModalTimerRef.current !== null) {
      window.clearTimeout(crossTabModalTimerRef.current);
      crossTabModalTimerRef.current = null;
    }
  }, []);

  const resetWorkspaceState = useCallback(() => {
    clearCrossTabTimer();
    sprintAbortRef.current?.abort();
    sprintReqIdRef.current += 1;
    setCurrentUser(null);
    setProperties([]);
    setSprints([]);
    setCurrentSprintId(null);
    setIsReadOnly(false);
    setApiError(null);
    setLastCreatedBatch(null);
    setIsTaskModalOpen(false);
    setEditingTask(null);
    setIsCloseSprintModalOpen(false);
    setIsAdminPanelOpen(false);
    setIsMeetingQuickModalOpen(false);
    setEditingPendingTask(null);
    setIsQuestionModalOpen(false);
    setEditingMeetingQuestion(null);
    paginatedTasksRef.current.resetStore();
    paginatedQuestionsRef.current.resetStore();
    meetingDataRef.current.resetStore();
  }, [clearCrossTabTimer]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (currentUserRef.current) {
        saveLastUserId(null);
        resetWorkspaceState();
        showErrorToast('Session expirée. Veuillez vous reconnecter.');
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [resetWorkspaceState, showErrorToast]);

  useEffect(() => {
    return () => clearCrossTabTimer();
  }, [clearCrossTabTimer]);

  const applyBootstrapPayload = useCallback(
    (boot: Awaited<ReturnType<typeof api.bootstrap>>, hintUserIdUsed: number | null) => {
      if (boot.users && boot.users.length > 0) {
        setAllUsers(boot.users);
      }

      if (!boot.authenticated || !boot.user) {
        setCurrentUser(null);
        return false;
      }

      saveLastUserId(boot.user.id);
      setCurrentUser(boot.user);
      const userPrefs = getUserPreferences(boot.user.id);
      setActiveTab(userPrefs.activeTab ?? 'tasks');
      setProperties(boot.properties ?? []);
      setSprints(boot.sprints ?? []);

      if (boot.sprint_details) {
        setCurrentSprintId(boot.sprint_details.sprint.id);
        applySprintDetailsPayload(
          boot.sprint_details,
          boot.user.id,
          hintUserIdUsed === boot.user.id
        );
      } else {
        setCurrentSprintId(null);
        setIsReadOnly(false);
        paginatedTasksRef.current.resetStore();
        paginatedQuestionsRef.current.resetStore();
        meetingDataRef.current.resetStore();
      }
      return true;
    },
    [applySprintDetailsPayload]
  );

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setApiError(null);
    const hintUserId = getLastUserId();
    try {
      const bootParams = hintUserId ? buildSprintDetailsRequestParams(hintUserId) : buildSprintDetailsRequestParams(null);
      const boot = await api.bootstrap(bootParams);
      applyBootstrapPayload(boot, hintUserId);
    } catch (e: any) {
      console.error('Erreur de chargement API :', e);
      setApiError(e?.message || "Impossible de joindre l'API REST.");
    } finally {
      setIsLoading(false);
    }
  }, [applyBootstrapPayload]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleLoginSuccess = useCallback(
    async (user: User) => {
      setIsLoading(true);
      setApiError(null);
      saveLastUserId(user.id);
      setCurrentUser(user);
      const userPrefs = getUserPreferences(user.id);
      setActiveTab(userPrefs.activeTab ?? 'tasks');
      try {
        const bootParams = buildSprintDetailsRequestParams(user.id);
        const boot = await api.bootstrap(bootParams);
        applyBootstrapPayload(boot, user.id);
        showToast(`Bienvenue, ${user.name} !`, 'success');
      } catch (e: any) {
        console.error('Erreur de chargement API :', e);
        setApiError(e?.message || "Impossible de joindre l'API REST.");
      } finally {
        setIsLoading(false);
      }
    },
    [applyBootstrapPayload, showToast]
  );

  const handleChangeTab = useCallback(
    (tab: 'tasks' | 'questions' | 'meeting') => {
      clearCrossTabTimer();
      setActiveTab(tab);
      if (currentUserRef.current) {
        saveUserPreferences(currentUserRef.current.id, { activeTab: tab });
      }
    },
    [clearCrossTabTimer]
  );

  const handleLoginSubmit = useCallback(async (emailOrId: string | number, password: string) => {
    return api.login(emailOrId, password);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Erreur déconnexion :', err);
    } finally {
      localStorage.removeItem('kanban_token');
      saveLastUserId(null);
      resetWorkspaceState();
      showToast('Session déconnectée.', 'info');
    }
  }, [resetWorkspaceState, showToast]);

  const handleSelectSprint = useCallback(
    (id: number) => {
      setCurrentSprintId(id);
      loadSprintDetails(id);
    },
    [loadSprintDetails]
  );

  const openCreateTaskModal = useCallback(
    (options?: {
      status?: TaskStatus;
      propertyId?: number | null;
      assignedTo?: number | null;
      source?: 'tasks' | 'meeting';
    }) => {
      setEditingTask(null);
      setTaskModalInitialStatus(options?.status || 'todo');
      setTaskModalInitialPropertyId(options?.propertyId ?? null);
      setTaskModalInitialAssignedTo(options?.assignedTo);
      setTaskModalCreationSource(options?.source || (activeTab === 'meeting' ? 'meeting' : 'tasks'));
      setIsTaskModalOpen(true);
    },
    [activeTab]
  );

  const handleConfirmCloseSprint = useCallback(
    async (nextName: string, notes: string) => {
      const current = sprints.find((s) => s.id === currentSprintId);
      if (!current) return;

      try {
        const res = await api.closeSprint(current.id, nextName, notes);
        if (res.success) {
          showSuccessToast(res.message || 'Sprint clôturé avec succès.');
          const sprintsRes = await api.getSprints();
          setSprints(sprintsRes.sprints);
          setCurrentSprintId(res.new_sprint_id);
          await loadSprintDetails(res.new_sprint_id);
          return;
        }
      } catch (err: any) {
        if (!isNetworkError(err)) {
          showErrorToast(err?.message || 'Impossible de clôturer ce sprint.');
          throw err;
        }
        showErrorToast('Impossible de clôturer un sprint sans connexion API.');
      }
    },
    [sprints, currentSprintId, showSuccessToast, showErrorToast, loadSprintDetails]
  );

  // Administration des sprints
  const handleSprintReopened = useCallback(
    async (sprintId: number) => {
      try {
        await api.reopenSprint(sprintId);
        const sprintsRes = await api.getSprints();
        if (sprintsRes?.sprints) {
          setSprints(sprintsRes.sprints);
          setCurrentSprintId(sprintId);
          await loadSprintDetails(sprintId);
        }
        showSuccessToast('Sprint réouvert avec succès.');
      } catch (err: any) {
        showErrorToast(err?.message || 'Impossible de réouvrir ce sprint.');
        throw err;
      }
    },
    [loadSprintDetails, showSuccessToast, showErrorToast]
  );

  const handleSprintUpdated = useCallback(
    async (sprintId: number, data: Partial<Sprint>) => {
      try {
        await api.updateSprint(sprintId, data);
        const sprintsRes = await api.getSprints();
        if (sprintsRes?.sprints) {
          setSprints(sprintsRes.sprints);
          if (currentSprintId === sprintId) {
            await loadSprintDetails(sprintId);
          }
        }
        showSuccessToast('Sprint mis à jour.');
      } catch (err: any) {
        showErrorToast(err?.message || 'Impossible de modifier ce sprint.');
        throw err;
      }
    },
    [currentSprintId, loadSprintDetails, showSuccessToast, showErrorToast]
  );

  const handleSprintDeleted = useCallback(
    async (_sprintId: number) => {
      try {
        await api.deleteSprint(_sprintId);
        const sprintsRes = await api.getSprints();
        if (sprintsRes?.sprints && sprintsRes.sprints.length > 0) {
          setSprints(sprintsRes.sprints);
          const nextSprint =
            sprintsRes.sprints.find((s) => s.status === 'active') || sprintsRes.sprints[0];
          setCurrentSprintId(nextSprint.id);
          await loadSprintDetails(nextSprint.id);
        } else {
          setSprints([]);
          setCurrentSprintId(null);
          paginatedTasksRef.current.resetStore();
          paginatedQuestionsRef.current.resetStore();
          meetingDataRef.current.resetStore();
        }
        showSuccessToast('Sprint supprimé.');
      } catch (err: any) {
        showErrorToast(err?.message || 'Impossible de supprimer ce sprint.');
        throw err;
      }
    },
    [
      loadSprintDetails,
      showSuccessToast,
      showErrorToast,
    ]
  );

  const activeSprint = useMemo(
    () => sprints.find((s) => s.id === currentSprintId) || sprints[0] || null,
    [sprints, currentSprintId]
  );

  useEffect(() => {
    setHasBottomDock(!!currentUser && activeTab === 'meeting' && !!activeSprint);
  }, [currentUser, activeTab, activeSprint, setHasBottomDock]);

  const consumeLastCreatedBatch = useCallback(() => setLastCreatedBatch(null), []);

  // Si une tâche est créée hors de l'onglet Tâches, consommer le batch pour jouer le halo sur la vue active
  useEffect(() => {
    if (!lastCreatedBatch || isTaskModalOpen || activeTab === 'tasks') return;
    consumeLastCreatedBatch();
    lastCreatedBatch.ids.forEach((createdId, idx) => {
      scheduleTaskMotionFeedback({
        taskId: createdId,
        tone: 'accent',
        mode: 'appear',
        scrollIfOffscreen: idx === 0,
      });
    });
  }, [lastCreatedBatch, isTaskModalOpen, activeTab, consumeLastCreatedBatch]);

  // Raccourcis clavier globaux pour les onglets Tâches & Questions (N / + / = et Q)
  useEffect(() => {
    if (!currentUser || isLoading || apiError || activeTab === 'meeting') return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;

      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }

      const hasModalOpen =
        isTaskModalOpen ||
        isCloseSprintModalOpen ||
        isMeetingQuickModalOpen ||
        (isAdminPanelOpen && currentUser.role === 'admin') ||
        isQuestionModalOpen ||
        !!document.querySelector('[role="dialog"], [role="alertdialog"]');
      if (hasModalOpen) return;

      if (isReadOnly || currentUser.role === 'read') return;

      const keyLower = e.key.toLowerCase();

      if ((keyLower === 'n' || e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') && activeSprint) {
        e.preventDefault();
        if (activeTab === 'questions') {
          clearCrossTabTimer();
          saveUserPreferences(currentUser.id, { taskFilter: 'me' });
          setActiveTab('tasks');
          saveUserPreferences(currentUser.id, { activeTab: 'tasks' });
          crossTabModalTimerRef.current = window.setTimeout(() => {
            crossTabModalTimerRef.current = null;
            openCreateTaskModal({
              status: 'todo',
              propertyId: null,
              assignedTo: currentUser.id,
              source: 'tasks',
            });
          }, 220);
          return;
        }

        const currentFilter = taskFilters.taskFilter;
        const contextualAssignedTo: number | null =
          currentFilter === 'me'
            ? currentUser.id
            : typeof currentFilter === 'number' && allUsers.some((u) => u.id === currentFilter)
            ? currentFilter
            : currentUser.role === 'write'
            ? currentUser.id
            : null;

        openCreateTaskModal({
          status: 'todo',
          propertyId: null,
          assignedTo: contextualAssignedTo,
          source: 'tasks',
        });
        return;
      }

      if (keyLower === 'q' && activeSprint) {
        e.preventDefault();
        if (activeTab === 'tasks') {
          clearCrossTabTimer();
          setActiveTab('questions');
          saveUserPreferences(currentUser.id, { activeTab: 'questions' });
          crossTabModalTimerRef.current = window.setTimeout(() => {
            crossTabModalTimerRef.current = null;
            setEditingMeetingQuestion(null);
            setIsQuestionModalOpen(true);
          }, 220);
          return;
        }
        setEditingMeetingQuestion(null);
        setIsQuestionModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    currentUser,
    isLoading,
    apiError,
    activeTab,
    activeSprint,
    allUsers,
    taskFilters.taskFilter,
    isReadOnly,
    isTaskModalOpen,
    isCloseSprintModalOpen,
    isMeetingQuickModalOpen,
    isAdminPanelOpen,
    isQuestionModalOpen,
    clearCrossTabTimer,
    openCreateTaskModal,
  ]);

  // Logements visibles selon le sprint affiché (basé sur les agrégats serveur pour ne manquer aucun bien)
  const sprintProperties = useMemo(() => {
    const ordered = sortProperties(properties);
    if (!activeSprint || activeSprint.status !== 'closed') {
      return ordered.filter((p) => Number(p.is_active) === 1);
    }
    const propCounts = paginatedTasks.facets.property_counts || {};
    return ordered
      .filter((p) => Number(p.is_active) === 1 || (propCounts[String(p.id)]?.total ?? 0) > 0)
      .sort(
        (a, b) =>
          (a.position ?? 0) - (b.position ?? 0) ||
          Number(b.is_active) - Number(a.is_active) ||
          a.name.localeCompare(b.name)
      );
  }, [properties, activeSprint, paginatedTasks.facets.property_counts]);

  const handleEditTask = useCallback((t: Task) => {
    setEditingTask(t);
    setIsTaskModalOpen(true);
  }, []);

  const handleOpenCloseSprintModal = useCallback(() => {
    if (currentSprintIdRef.current) {
      meetingData.refreshSummary(currentSprintIdRef.current);
    }
    setIsCloseSprintModalOpen(true);
  }, [meetingData]);

  const handleMeetingAddNewTask = useCallback((pendingTaskToEdit?: Task | null) => {
    setEditingPendingTask(pendingTaskToEdit || null);
    setIsMeetingQuickModalOpen(true);
  }, []);

  const handleMeetingAddNewQuestion = useCallback(() => {
    setEditingMeetingQuestion(null);
    setIsQuestionModalOpen(true);
  }, []);

  const handleMeetingEditQuestion = useCallback((question: Question) => {
    setEditingMeetingQuestion(question);
    setIsQuestionModalOpen(true);
  }, []);

  const hasAnyModalOpen =
    isTaskModalOpen ||
    isCloseSprintModalOpen ||
    isMeetingQuickModalOpen ||
    (isAdminPanelOpen && currentUser?.role === 'admin') ||
    isQuestionModalOpen;

  if (isLoading && !currentUser) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4">
        <div className="cdh-glass-overlay rounded-cdh-2xl px-8 py-7 flex flex-col items-center">
          <div className="w-10 h-10 border-[3px] border-[var(--cdh-accent-soft)] border-t-[var(--cdh-accent)] rounded-full animate-spin mb-3.5" />
          <p className="text-[13.5px] font-semibold text-[var(--cdh-text-primary)]">
            Vérification de la session Carré d'Hôtes…
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <LoginPage
          users={allUsers}
          onLoginSuccess={handleLoginSuccess}
          onLoginSubmit={handleLoginSubmit}
        />
      </Suspense>
    );
  }

  const isFixedViewportTab = activeTab === 'tasks' && !isLoading && !apiError;

  return (
    <div className={`${isFixedViewportTab ? 'h-dvh overflow-hidden' : 'min-h-dvh'} text-[var(--cdh-text-primary)] flex flex-col`}>
      <Navbar
        currentUser={currentUser}
        sprints={sprints}
        currentSprintId={currentSprintId}
        onSelectSprint={handleSelectSprint}
        isReadOnly={isReadOnly}
        activeTab={activeTab}
        onChangeTab={handleChangeTab}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setIsAdminPanelOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main
        className={`flex-1 w-full mx-auto px-3 sm:px-6 lg:px-8 ${
          activeTab === 'meeting' ? 'max-w-[1440px]' : 'max-w-7xl'
        } ${
          isFixedViewportTab
            ? 'min-h-0 flex flex-col py-2.5 sm:py-3.5'
            : activeTab === 'questions'
            ? 'py-2.5 sm:py-3.5'
            : activeTab === 'meeting'
            ? 'py-2.5 sm:py-4'
            : 'py-4 sm:py-6'
        }`}
      >
        {apiError && (
          <div className="mb-6 p-4 rounded-cdh-xl cdh-glass-overlay border-[var(--cdh-danger-accent)]/30 text-[var(--cdh-danger)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={2} />
              <div>
                <p className="font-semibold text-sm">Erreur de communication avec l'API :</p>
                <p className="text-xs opacity-90">{apiError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => loadInitialData()}
              className="px-3.5 py-1.5 text-xs font-semibold bg-[var(--cdh-danger-accent)] hover:opacity-90 text-white rounded-cdh-sm transition-all cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 animate-spin text-[var(--cdh-accent)] mb-3" strokeWidth={1.75} />
            <p className="text-sm font-medium text-[var(--cdh-text-secondary)]">
              Chargement du tableau de bord Carré d'Hôtes…
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'tasks' && (
              <TasksTab
                properties={sprintProperties}
                allUsers={allUsers}
                currentUser={currentUser}
                isReadOnly={isReadOnly}
                taskViewMode={taskViewMode}
                onChangeViewMode={handleChangeViewMode}
                hideEmptyProperties={hideEmptyProperties}
                onToggleHideEmptyProperties={handleToggleHideEmptyProperties}
                taskFilter={taskFilters.taskFilter}
                onChangeTaskFilter={taskFilters.setTaskFilter}
                taskSearchQuery={taskFilters.taskSearchQuery}
                onChangeSearchQuery={taskFilters.setTaskSearchQuery}
                hiddenPropertyIds={taskFilters.hiddenPropertyIds}
                allPropertyFilterIds={taskFilters.allPropertyFilterIds}
                onToggleProperty={taskFilters.togglePropertyVisibility}
                onSetHiddenProperties={taskFilters.setHiddenPropertyIds}
                hiddenStatuses={taskFilters.hiddenStatuses}
                onToggleStatus={taskFilters.toggleStatusVisibility}
                onSetHiddenStatuses={taskFilters.setHiddenStatuses}
                hiddenPriorities={taskFilters.hiddenPriorities}
                onTogglePriority={taskFilters.togglePriorityVisibility}
                onSetHiddenPriorities={taskFilters.setHiddenPriorities}
                taskDueState={taskFilters.taskDueState}
                onChangeDueState={taskFilters.setTaskDueState}
                taskStarredOnly={taskFilters.taskStarredOnly}
                onToggleStarredOnly={() =>
                  taskFilters.setTaskStarredOnly(!taskFilters.taskStarredOnly)
                }
                taskUnplannedOnly={taskFilters.taskUnplannedOnly}
                onToggleUnplannedOnly={() =>
                  taskFilters.setTaskUnplannedOnly(!taskFilters.taskUnplannedOnly)
                }
                hasActiveFilters={taskFilters.hasActiveFilters}
                onResetFilters={taskFilters.resetFilters}
                listSortBy={listPrefs.sortBy}
                listSortDir={listPrefs.sortDir}
                visibleColumns={listPrefs.visibleColumns}
                onSelectListSort={listPrefs.handleSelectSort}
                onToggleListSortDir={listPrefs.handleToggleSortDir}
                onToggleColumn={listPrefs.handleToggleColumn}
                onResetColumns={listPrefs.handleResetColumns}
                boardSortBy={listPrefs.boardSortBy}
                boardSortDir={listPrefs.boardSortDir}
                onSelectBoardSort={listPrefs.handleSelectBoardSort}
                onToggleBoardSortDir={listPrefs.handleToggleBoardSortDir}
                groups={paginatedTasks.groups}
                listItems={paginatedTasks.listItems}
                listPagination={paginatedTasks.listPagination}
                loadedTasks={paginatedTasks.loadedTasks}
                facets={paginatedTasks.facets}
                isRefreshing={paginatedTasks.isRefreshing || paginatedTasks.isLoadingInitial}
                isLoadingMoreList={paginatedTasks.isLoadingMoreList}
                loadingMoreColumns={paginatedTasks.loadingMoreColumns}
                onLoadMoreColumn={paginatedTasks.loadMoreColumn}
                onLoadMoreList={paginatedTasks.loadMoreList}
                lastCreatedBatch={lastCreatedBatch}
                isTaskModalOpen={isTaskModalOpen}
                onConsumeCreatedBatch={consumeLastCreatedBatch}
                onEditTask={handleEditTask}
                onDeleteTask={deleteTask}
                onToggleSubtask={toggleSubtask}
                onAddSubtask={addSubtask}
                onUpdateStatus={updateTaskStatus}
                onAssignTask={assignTask}
                onQuickUpdateTask={quickUpdateTask}
                onReorderKanbanTask={reorderKanbanTask}
                onMoveTaskProperty={moveTaskProperty}
                onToggleStar={toggleStar}
                onOpenCreateTask={openCreateTaskModal}
              />
            )}

            {activeTab === 'questions' && (
              activeSprint ? (
                <Suspense fallback={<ViewLoadingFallback />}>
                  <QuestionsView
                    questions={paginatedQuestions.questions}
                    pagination={paginatedQuestions.pagination}
                    facets={paginatedQuestions.facets}
                    isLoading={paginatedQuestions.isLoading}
                    isLoadingMore={paginatedQuestions.isLoadingMore}
                    onLoadMore={paginatedQuestions.loadMore}
                    userFilter={paginatedQuestions.userFilter}
                    onChangeUserFilter={paginatedQuestions.setUserFilter}
                    searchQuery={paginatedQuestions.searchQuery}
                    onChangeSearchQuery={paginatedQuestions.setSearchQuery}
                    decisionStatus={paginatedQuestions.decisionStatus}
                    onChangeDecisionStatus={paginatedQuestions.setDecisionStatus}
                    hasAnswers={paginatedQuestions.hasAnswers}
                    onChangeHasAnswers={paginatedQuestions.setHasAnswers}
                    answeredByMe={paginatedQuestions.answeredByMe}
                    onChangeAnsweredByMe={paginatedQuestions.setAnsweredByMe}
                    sortBy={paginatedQuestions.sortBy}
                    sortDir={paginatedQuestions.sortDir}
                    onSelectSort={paginatedQuestions.handleSelectSort}
                    onToggleSortDir={paginatedQuestions.handleToggleSortDir}
                    hasActiveFilters={paginatedQuestions.hasActiveFilters}
                    onResetFilters={paginatedQuestions.resetFilters}
                    users={allUsers}
                    currentUser={currentUser}
                    sprintId={activeSprint.id}
                    onAddQuestion={handleAddQuestion}
                    onUpdateQuestion={handleUpdateQuestion}
                    onDeleteQuestion={handleDeleteQuestion}
                    onAddAnswer={handleAddAnswer}
                    onUpdateAnswer={handleUpdateAnswer}
                    onDeleteAnswer={handleDeleteAnswer}
                    isReadOnly={isReadOnly}
                  />
                </Suspense>
              ) : (
                <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center text-[var(--cdh-text-secondary)] text-sm">
                  Aucun sprint configuré pour l'onglet Questions.
                </div>
              )
            )}

            {activeTab === 'meeting' && (
              activeSprint ? (
                <Suspense fallback={<ViewLoadingFallback />}>
                  <MeetingView
                    sprint={activeSprint}
                    tasks={meetingData.allMeetingTasks}
                    questions={meetingData.meetingQuestions}
                    meetingSummary={meetingData.meetingSummary}
                    retroGroups={meetingData.retroGroups}
                    loadingRetroUsers={meetingData.loadingRetroUsers}
                    onLoadMoreRetroForUser={meetingData.loadMoreRetroForUser}
                    pendingPagination={meetingData.pendingPagination}
                    isLoadingMorePending={meetingData.isLoadingMorePending}
                    onLoadMorePending={meetingData.loadMorePending}
                    questionsPagination={meetingData.questionsPagination}
                    isLoadingMoreQuestions={meetingData.isLoadingMoreQuestions}
                    onLoadMoreMeetingQuestions={meetingData.loadMoreMeetingQuestions}
                    users={allUsers}
                    currentUser={currentUser}
                    onOpenCloseSprintModal={handleOpenCloseSprintModal}
                    onUpdateTaskStatus={updateTaskStatus}
                    onAssignTask={assignTask}
                    onDeleteTask={deleteTask}
                    onToggleSubtask={toggleSubtask}
                    onSetQuestionDecision={handleSetQuestionDecision}
                    onEditTask={handleEditTask}
                    onToggleStar={toggleStar}
                    onAddNewTask={handleMeetingAddNewTask}
                    onAddNewQuestion={handleMeetingAddNewQuestion}
                    onEditQuestion={handleMeetingEditQuestion}
                    hasOpenModal={hasAnyModalOpen}
                    isReadOnly={isReadOnly}
                  />
                </Suspense>
              ) : (
                <div className="cdh-glass-column rounded-cdh-2xl p-10 text-center text-[var(--cdh-text-secondary)] text-sm">
                  Aucun sprint configuré pour la vue réunion.
                </div>
              )
            )}
          </>
        )}
      </main>

      {isTaskModalOpen && activeSprint && (
        <Suspense fallback={null}>
          <TaskModal
            isOpen
            onClose={() => setIsTaskModalOpen(false)}
            task={editingTask}
            sprintId={activeSprint.id}
            currentUser={currentUser}
            users={allUsers}
            properties={sprintProperties}
            initialStatus={taskModalInitialStatus}
            initialPropertyId={taskModalInitialPropertyId}
            initialAssignedTo={taskModalInitialAssignedTo}
            creationSource={taskModalCreationSource}
            onSave={saveTask}
          />
        </Suspense>
      )}

      {isCloseSprintModalOpen && activeSprint && (
        <Suspense fallback={null}>
          <CloseSprintModal
            isOpen
            onClose={() => setIsCloseSprintModalOpen(false)}
            currentSprint={activeSprint}
            meetingSummary={meetingData.meetingSummary}
            onConfirmClose={handleConfirmCloseSprint}
          />
        </Suspense>
      )}

      {isMeetingQuickModalOpen && activeSprint && (
        <Suspense fallback={null}>
          <MeetingQuickTaskModal
            isOpen
            onClose={() => {
              setIsMeetingQuickModalOpen(false);
              setEditingPendingTask(null);
            }}
            sprintId={activeSprint.id}
            nextSprintNumber={activeSprint.number + 1}
            currentUser={currentUser}
            users={allUsers}
            properties={sprintProperties}
            editingTask={editingPendingTask}
            onSave={saveTask}
          />
        </Suspense>
      )}

      {isQuestionModalOpen && activeSprint && (
        <Suspense fallback={null}>
          <QuestionModal
            isOpen
            onClose={() => {
              setIsQuestionModalOpen(false);
              setEditingMeetingQuestion(null);
            }}
            sprintId={activeSprint.id}
            users={allUsers}
            currentUser={currentUser}
            editingQuestion={editingMeetingQuestion}
            onAddQuestion={handleAddQuestion}
            onUpdateQuestion={handleUpdateQuestion}
          />
        </Suspense>
      )}

      {isAdminPanelOpen && currentUser?.role === 'admin' && (
        <Suspense fallback={null}>
          <AdminPanelModal
            isOpen
            onClose={() => setIsAdminPanelOpen(false)}
            currentUser={currentUser}
            users={allUsers}
            sprints={sprints}
            properties={properties}
            currentSprintId={currentSprintId}
            onSprintReopened={handleSprintReopened}
            onSprintUpdated={handleSprintUpdated}
            onSprintDeleted={handleSprintDeleted}
            onUserCreated={(newUser) => {
              setAllUsers((prev) => [...prev, newUser]);
              showSuccessToast(`Associé « ${newUser.name} » créé.`);
            }}
            onUserUpdated={(updatedUser) => {
              setAllUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
              if (currentUser?.id === updatedUser.id) {
                setCurrentUser(updatedUser);
              }
              showSuccessToast(`Associé « ${updatedUser.name} » mis à jour.`);
            }}
            onUserDeleted={async (deletedId) => {
              setAllUsers((prev) => prev.filter((u) => u.id !== deletedId));
              if (currentSprintId) {
                await loadSprintDetails(currentSprintId);
              }
              showSuccessToast('Associé supprimé.');
            }}
            onPropertyCreated={(newProp) => {
              setProperties((prev) => sortProperties([...prev, newProp]));
              showSuccessToast(`Hébergement « ${newProp.name} » ajouté.`);
            }}
            onPropertyUpdated={(updatedProp) => {
              setProperties((prev) =>
                sortProperties(prev.map((p) => (p.id === updatedProp.id ? updatedProp : p)))
              );
              if (currentSprintId) {
                loadSprintDetails(currentSprintId);
              }
              showSuccessToast(`Hébergement « ${updatedProp.name} » mis à jour.`);
            }}
            onPropertyStatusChanged={async (updatedProp) => {
              setProperties((prev) =>
                sortProperties(prev.map((p) => (p.id === updatedProp.id ? updatedProp : p)))
              );
              if (currentSprintId) {
                await loadSprintDetails(currentSprintId);
              }
              showSuccessToast(
                Number(updatedProp.is_active) === 1
                  ? `Hébergement « ${updatedProp.name} » réactivé.`
                  : `Hébergement « ${updatedProp.name} » archivé.`
              );
            }}
            onPropertiesReordered={(orderedProps) => {
              setProperties(orderedProps);
              showSuccessToast('Ordre des hébergements mis à jour.');
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
