import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { User, Sprint, Task, Question, Property, TaskStatus } from './types';
import { api } from './api/client';
import { useSprintTasks } from './hooks/useSprintTasks';
import { getUserPreferences, saveUserPreferences } from './utils/cookies';
import { Navbar } from './components/Navbar';
import { TasksTab } from './components/TasksTab';
import { QuestionsView } from './components/QuestionsView';
import { MeetingView } from './components/MeetingView';
import { TaskModal } from './components/TaskModal';
import { QuestionModal } from './components/QuestionModal';
import { MeetingQuickTaskModal } from './components/MeetingQuickTaskModal';
import { CloseSprintModal } from './components/CloseSprintModal';
import { LoginPage } from './components/LoginPage';
import { AdminPanelModal } from './components/AdminPanelModal';
import { ToastContainer, ToastItem, ToastType } from './components/ToastContainer';
import { useConfirm } from './components/ui';
import { RefreshCw, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const confirm = useConfirm();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [currentSprintId, setCurrentSprintId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<number, number>>(new Map());

  // Onglets
  const [activeTab, setActiveTab] = useState<'tasks' | 'questions' | 'meeting'>('tasks');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('cdh-theme') === 'dark' ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem('cdh-theme', theme);
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#0B0F17' : '#F2F4F8');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

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

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev.slice(-3), { id, type, message }]);
    const duration = type === 'error' ? 5500 : 3200;
    const timer = window.setTimeout(() => {
      toastTimersRef.current.delete(id);
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    toastTimersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  const showSuccessToast = useCallback((msg: string) => showToast(msg, 'success'), [showToast]);
  const showErrorToast = useCallback((msg: string) => showToast(msg, 'error'), [showToast]);

  const loadSprintDetails = useCallback(async (sprintId: number) => {
    try {
      const details = await api.getSprintDetails(sprintId);
      if (details.success) {
        setTasks(details.tasks);
        setQuestions(details.questions);
        setIsReadOnly(details.is_read_only);
      }
    } catch (err: any) {
      console.error('Erreur chargement sprint :', err);
      const sprint = sprints.find(s => s.id === sprintId);
      setIsReadOnly(sprint?.status === 'closed' && currentUser?.role !== 'admin');
      if (!(err instanceof TypeError)) {
        showErrorToast(err?.message || 'Impossible de charger les détails du sprint.');
      }
    }
  }, [sprints, currentUser, showErrorToast]);

  const {
    tasks,
    setTasks,
    saveTask,
    updateTaskStatus,
    quickUpdateTask,
    reorderKanbanTask,
    moveTaskProperty,
    assignTask,
    deleteTask,
    toggleSubtask,
    addSubtask,
    toggleStar
  } = useSprintTasks({
    currentSprintId,
    currentUser,
    allUsers,
    properties,
    reloadSprintDetails: loadSprintDetails,
    onSuccess: showSuccessToast,
    onError: showErrorToast
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadWorkspaceData = async () => {
    const [propsRes, sprintsRes] = await Promise.all([
      api.getProperties(true).catch(() => ({ success: false, properties: [] as Property[] })),
      api.getSprints().catch(() => ({ success: false, sprints: [] as Sprint[] }))
    ]);

    if (propsRes?.properties) {
      setProperties(propsRes.properties);
    }

    if (sprintsRes?.sprints && sprintsRes.sprints.length > 0) {
      setSprints(sprintsRes.sprints);
      const active = sprintsRes.sprints.find(s => s.status === 'active') || sprintsRes.sprints[0];
      setCurrentSprintId(active.id);
      const details = await api.getSprintDetails(active.id);
      if (details.success) {
        setTasks(details.tasks);
        setQuestions(details.questions);
        setIsReadOnly(details.is_read_only);
      }
    } else {
      setSprints([]);
      setTasks([]);
      setQuestions([]);
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const usersRes = await api.getUsers().catch(() => ({ success: false, users: [] as User[] }));
      if (usersRes?.users && usersRes.users.length > 0) {
        setAllUsers(usersRes.users);
      }

      let meRes: { success: boolean; user: User } | null = null;
      try {
        meRes = await api.getMe();
      } catch {
        meRes = null;
      }

      if (!meRes?.user) {
        setCurrentUser(null);
        setIsLoading(false);
        return;
      }

      setCurrentUser(meRes.user);
      const userPrefs = getUserPreferences(meRes.user.id);
      setActiveTab(userPrefs.activeTab ?? 'tasks');

      await loadWorkspaceData();
    } catch (e: any) {
      console.error('Erreur de chargement API :', e);
      setApiError(e?.message || "Impossible de joindre l'API REST.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async (user: User) => {
    setIsLoading(true);
    setApiError(null);
    setCurrentUser(user);
    const userPrefs = getUserPreferences(user.id);
    setActiveTab(userPrefs.activeTab ?? 'tasks');
    try {
      const usersRes = await api.getUsers().catch(() => ({ success: false, users: [] as User[] }));
      if (usersRes?.users && usersRes.users.length > 0) {
        setAllUsers(usersRes.users);
      }
      await loadWorkspaceData();
      showToast(`Bienvenue, ${user.name} !`, 'success');
    } catch (e: any) {
      console.error('Erreur de chargement API :', e);
      setApiError(e?.message || "Impossible de joindre l'API REST.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeTab = (tab: 'tasks' | 'questions' | 'meeting') => {
    setActiveTab(tab);
    if (currentUser) {
      saveUserPreferences(currentUser.id, { activeTab: tab });
    }
  };

  const handleLoginSubmit = async (emailOrId: string | number, password: string) => {
    return api.login(emailOrId, password);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn('Erreur déconnexion :', err);
    } finally {
      setCurrentUser(null);
      localStorage.removeItem('kanban_token');
      showToast('Session déconnectée.', 'info');
    }
  };

  const handleSelectSprint = (id: number) => {
    setCurrentSprintId(id);
    loadSprintDetails(id);
  };

  const openCreateTaskModal = (options?: {
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
  };

  // Questions : Ajout / Modif / Suppr
  const handleAddQuestion = async (data: any) => {
    try {
      await api.createQuestion(data);
      if (currentSprintId) await loadSprintDetails(currentSprintId);
      showSuccessToast('Question ajoutée avec succès.');
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        showErrorToast(err?.message || "Impossible d'ajouter cette question.");
        throw err;
      }
      const targetUser = allUsers.find(u => u.id === data.user_id) || currentUser;
      const newQ: Question = {
        id: Date.now(),
        sprint_id: currentSprintId || 1,
        user_id: data.user_id || currentUser?.id || 1,
        user_name: targetUser?.name,
        user_initials: targetUser?.initials,
        user_color: targetUser?.avatar_color,
        created_by: currentUser?.id || 1,
        title: data.title,
        details: data.details,
        final_answer: null,
        answers: [],
        can_edit: true,
        can_delete: true,
        can_decide: true
      };
      setQuestions(prev => [...prev, newQ]);
      showSuccessToast('Question ajoutée localement.');
    }
  };

  const handleUpdateQuestion = async (id: number, data: Partial<Question>) => {
    let previousQuestions: Question[] = [];
    const reassignedUser = data.user_id !== undefined
      ? allUsers.find(u => u.id === data.user_id)
      : undefined;
    setQuestions(prev => {
      previousQuestions = prev;
      return prev.map(q =>
        q.id === id
          ? {
              ...q,
              ...data,
              ...(reassignedUser
                ? {
                    user_name: reassignedUser.name,
                    user_initials: reassignedUser.initials,
                    user_color: reassignedUser.avatar_color
                  }
                : {})
            }
          : q
      );
    });
    try {
      await api.updateQuestion(id, data);
      if (data.user_id !== undefined && currentSprintId) {
        await loadSprintDetails(currentSprintId);
      }
      showSuccessToast('Question mise à jour.');
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        setQuestions(previousQuestions);
        showErrorToast(err?.message || 'Impossible de modifier cette question.');
        throw err;
      }
      showSuccessToast('Question mise à jour localement.');
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    const confirmed = await confirm({
      title: 'Supprimer la question',
      message: 'Voulez-vous vraiment supprimer cette question ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    let previousQuestions: Question[] = [];
    setQuestions(prev => {
      previousQuestions = prev;
      return prev.filter(q => q.id !== id);
    });
    try {
      await api.deleteQuestion(id);
      showSuccessToast('Question supprimée.');
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        setQuestions(previousQuestions);
        showErrorToast(err?.message || 'Impossible de supprimer cette question.');
      }
    }
  };

  const handleAddAnswer = async (questionId: number, content: string) => {
    try {
      await api.addQuestionAnswer(questionId, content);
      if (currentSprintId) await loadSprintDetails(currentSprintId);
      showSuccessToast('Proposition de réponse ajoutée.');
    } catch (e: any) {
      if (e?.status === 409 && currentSprintId) {
        await loadSprintDetails(currentSprintId);
      }
      showErrorToast(e?.message || "Erreur lors de l'envoi de la proposition.");
      throw e;
    }
  };

  const handleUpdateAnswer = async (answerId: number, content: string) => {
    try {
      await api.updateQuestionAnswer(answerId, content);
      if (currentSprintId) await loadSprintDetails(currentSprintId);
      showSuccessToast('Proposition mise à jour.');
    } catch (e: any) {
      showErrorToast(e?.message || 'Erreur lors de la modification de la réponse.');
      throw e;
    }
  };

  const handleDeleteAnswer = async (answerId: number) => {
    const confirmed = await confirm({
      title: 'Supprimer la proposition',
      message: 'Supprimer cette proposition de réponse ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await api.deleteQuestionAnswer(answerId);
      if (currentSprintId) await loadSprintDetails(currentSprintId);
      showSuccessToast('Proposition supprimée.');
    } catch (e: any) {
      showErrorToast(e?.message || 'Erreur lors de la suppression.');
    }
  };

  const handleSetQuestionDecision = async (questionId: number, finalAnswer: string) => {
    try {
      await api.setQuestionDecision(questionId, finalAnswer);
      if (currentSprintId) await loadSprintDetails(currentSprintId);
      showSuccessToast(
        finalAnswer.trim()
          ? 'Réponse définitive enregistrée.'
          : 'Réponse définitive supprimée.'
      );
    } catch (e: any) {
      showErrorToast(e?.message || "Erreur lors de l'enregistrement de la décision.");
      throw e;
    }
  };

  const handleConfirmCloseSprint = async (nextName: string, notes: string) => {
    const current = sprints.find(s => s.id === currentSprintId);
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
      if (!(err instanceof TypeError)) {
        showErrorToast(err?.message || 'Impossible de clôturer ce sprint.');
        throw err;
      }
      const nextNumber = current.number + 1;
      const newSprintId = Date.now();
      const newSprint: Sprint = {
        id: newSprintId,
        number: nextNumber,
        name: nextName || `Point ${nextNumber}`,
        status: 'active',
        started_at: new Date().toISOString()
      };

      const updatedSprints = sprints.map(s => (s.id === current.id ? { ...s, status: 'closed' as const } : s));
      setSprints([newSprint, ...updatedSprints]);

      const pendingTasks = tasks.filter(t => t.status !== 'done');
      const rolledOverTasks: Task[] = pendingTasks.map((t, idx) => {
        const wasPending = t.status === 'pending';
        if (wasPending && !t.assigned_to) {
          return {
            ...t,
            sprint_id: newSprintId,
            status: 'pending',
            is_unplanned: false,
            is_starred: false,
            is_new: false,
            position: idx + 1,
            subtasks: (t.subtasks || []).map(st => ({ ...st }))
          };
        }
        return {
          ...t,
          sprint_id: newSprintId,
          status: wasPending ? 'todo' : t.status,
          is_unplanned: false,
          is_starred: false,
          is_new: wasPending,
          position: idx + 1,
          subtasks: (t.subtasks || []).map(st => ({ ...st }))
        };
      });

      setCurrentSprintId(newSprintId);
      setTasks(rolledOverTasks);
      setQuestions([]);
      showSuccessToast(`Le sprint ${current.name} a été clôturé localement (${rolledOverTasks.length} tâches transférées).`);
    }
  };

  // Administration des sprints
  const handleSprintReopened = async (sprintId: number) => {
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
  };

  const handleSprintUpdated = async (sprintId: number, data: Partial<Sprint>) => {
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
  };

  const handleSprintDeleted = async (sprintId: number) => {
    try {
      await api.deleteSprint(sprintId);
      const sprintsRes = await api.getSprints();
      if (sprintsRes?.sprints && sprintsRes.sprints.length > 0) {
        setSprints(sprintsRes.sprints);
        const nextSprint = sprintsRes.sprints.find(s => s.status === 'active') || sprintsRes.sprints[0];
        setCurrentSprintId(nextSprint.id);
        await loadSprintDetails(nextSprint.id);
      }
      showSuccessToast('Sprint supprimé.');
    } catch (err: any) {
      showErrorToast(err?.message || 'Impossible de supprimer ce sprint.');
      throw err;
    }
  };

  const activeSprint = sprints.find(s => s.id === currentSprintId) || sprints[0];

  const sortProperties = (list: Property[]) =>
    [...list].sort(
      (a, b) =>
        Number(b.is_active) - Number(a.is_active) ||
        (a.position ?? 0) - (b.position ?? 0) ||
        a.name.localeCompare(b.name)
    );

  // Les tâches au statut 'pending' ou sans responsable ne sont jamais visibles dans l'onglet Tâches
  const boardTasks = useMemo(
    () => tasks.filter(t => t.status !== 'pending' && !!t.assigned_to),
    [tasks]
  );

  // Logements visibles selon le sprint affiché :
  // - Sprint ouvert : uniquement les logements actifs
  // - Sprint archivé : logements actifs + logements désactivés contenant des tâches sur ce sprint
  const sprintProperties = useMemo(() => {
    const ordered = sortProperties(properties);
    if (!activeSprint || activeSprint.status !== 'closed') {
      return ordered.filter(p => Number(p.is_active) === 1);
    }
    const usedPropIds = new Set(
      boardTasks.map(t => t.property_id).filter((id): id is number => id !== null && id !== undefined)
    );
    return ordered
      .filter(p => Number(p.is_active) === 1 || usedPropIds.has(p.id))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));
  }, [properties, activeSprint, boardTasks]);

  if (isLoading && !currentUser) {
    return (
      <div className="min-h-dvh cdh-canvas-bg flex flex-col items-center justify-center p-4">
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
      <>
        <ToastContainer
          toasts={toasts}
          onDismiss={dismissToast}
          hasBottomDock={activeTab === 'meeting' && !!activeSprint}
        />
        <LoginPage
          users={allUsers}
          onLoginSuccess={handleLoginSuccess}
          onLoginSubmit={handleLoginSubmit}
        />
      </>
    );
  }

  const isFixedViewportTab = activeTab === 'tasks' && !isLoading && !apiError;

  return (
    <div className={`${isFixedViewportTab ? 'h-dvh overflow-hidden' : 'min-h-dvh'} cdh-canvas-bg text-[var(--cdh-text-primary)] flex flex-col`}>
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
        className={`flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 ${
          isFixedViewportTab ? 'min-h-0 flex flex-col py-2.5 sm:py-3.5' : 'py-4 sm:py-6'
        }`}
      >
        <ToastContainer
          toasts={toasts}
          onDismiss={dismissToast}
          hasBottomDock={activeTab === 'meeting' && !!activeSprint}
        />

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
                tasks={boardTasks}
                properties={sprintProperties}
                allUsers={allUsers}
                currentUser={currentUser}
                isReadOnly={isReadOnly}
                onEditTask={(t) => {
                  setEditingTask(t);
                  setIsTaskModalOpen(true);
                }}
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
                <QuestionsView
                  questions={questions}
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
              ) : (
                <div className="bg-white rounded-2xl border border-black/[0.12] p-10 text-center text-slate-500 text-sm">
                  Aucun sprint configuré pour l'onglet Questions.
                </div>
              )
            )}

            {activeTab === 'meeting' && (
              activeSprint ? (
                <MeetingView
                  sprint={activeSprint}
                  tasks={tasks}
                  questions={questions}
                  users={allUsers}
                  currentUser={currentUser}
                  properties={sprintProperties}
                  onOpenCloseSprintModal={() => setIsCloseSprintModalOpen(true)}
                  onUpdateTaskStatus={updateTaskStatus}
                  onAssignTask={assignTask}
                  onDeleteTask={deleteTask}
                  onToggleSubtask={toggleSubtask}
                  onSetQuestionDecision={handleSetQuestionDecision}
                  onEditTask={(t) => {
                    setEditingTask(t);
                    setIsTaskModalOpen(true);
                  }}
                  onToggleStar={toggleStar}
                  onAddNewTask={(pendingTaskToEdit) => {
                    setEditingPendingTask(pendingTaskToEdit || null);
                    setIsMeetingQuickModalOpen(true);
                  }}
                  onAddNewQuestion={() => {
                    setEditingMeetingQuestion(null);
                    setIsQuestionModalOpen(true);
                  }}
                  onEditQuestion={(question) => {
                    setEditingMeetingQuestion(question);
                    setIsQuestionModalOpen(true);
                  }}
                  hasOpenModal={
                    isTaskModalOpen ||
                    isCloseSprintModalOpen ||
                    isMeetingQuickModalOpen ||
                    (isAdminPanelOpen && currentUser?.role === 'admin') ||
                    isQuestionModalOpen
                  }
                  isReadOnly={isReadOnly}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-black/[0.12] p-10 text-center text-slate-500 text-sm">
                  Aucun sprint configuré pour la vue réunion.
                </div>
              )
            )}
          </>
        )}
      </main>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={editingTask}
        sprintId={currentSprintId || 1}
        currentUser={currentUser}
        users={allUsers}
        properties={sprintProperties}
        initialStatus={taskModalInitialStatus}
        initialPropertyId={taskModalInitialPropertyId}
        initialAssignedTo={taskModalInitialAssignedTo}
        creationSource={taskModalCreationSource}
        onSave={saveTask}
      />

      <CloseSprintModal
        isOpen={isCloseSprintModalOpen}
        onClose={() => setIsCloseSprintModalOpen(false)}
        currentSprint={activeSprint}
        tasks={tasks}
        questions={questions}
        onConfirmClose={handleConfirmCloseSprint}
      />

      <MeetingQuickTaskModal
        isOpen={isMeetingQuickModalOpen}
        onClose={() => {
          setIsMeetingQuickModalOpen(false);
          setEditingPendingTask(null);
        }}
        sprintId={currentSprintId || 1}
        nextSprintNumber={(activeSprint?.number ?? 0) + 1}
        currentUser={currentUser}
        users={allUsers}
        properties={sprintProperties}
        editingTask={editingPendingTask}
        onSave={saveTask}
      />

      <QuestionModal
        isOpen={isQuestionModalOpen}
        onClose={() => {
          setIsQuestionModalOpen(false);
          setEditingMeetingQuestion(null);
        }}
        sprintId={currentSprintId || 1}
        users={allUsers}
        currentUser={currentUser}
        editingQuestion={editingMeetingQuestion}
        onAddQuestion={handleAddQuestion}
        onUpdateQuestion={handleUpdateQuestion}
      />

      <AdminPanelModal
        isOpen={isAdminPanelOpen && currentUser?.role === 'admin'}
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
          setAllUsers([...allUsers, newUser]);
          showSuccessToast(`Associé « ${newUser.name} » créé.`);
        }}
        onUserUpdated={(updatedUser) => {
          setAllUsers(allUsers.map(u => (u.id === updatedUser.id ? updatedUser : u)));
          if (currentUser?.id === updatedUser.id) {
            setCurrentUser(updatedUser);
          }
          showSuccessToast(`Associé « ${updatedUser.name} » mis à jour.`);
        }}
        onUserDeleted={async (deletedId) => {
          setAllUsers(prev => prev.filter(u => u.id !== deletedId));
          if (currentSprintId) {
            await loadSprintDetails(currentSprintId);
          }
          showSuccessToast('Associé supprimé.');
        }}
        onPropertyCreated={(newProp) => {
          setProperties(prev => sortProperties([...prev, newProp]));
          showSuccessToast(`Hébergement « ${newProp.name} » ajouté.`);
        }}
        onPropertyUpdated={(updatedProp) => {
          setProperties(prev => sortProperties(prev.map(p => (p.id === updatedProp.id ? updatedProp : p))));
          if (currentSprintId) {
            loadSprintDetails(currentSprintId);
          }
          showSuccessToast(`Hébergement « ${updatedProp.name} » mis à jour.`);
        }}
        onPropertyStatusChanged={async (updatedProp) => {
          setProperties(prev => sortProperties(prev.map(p => (p.id === updatedProp.id ? updatedProp : p))));
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
    </div>
  );
};
