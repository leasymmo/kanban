import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Sprint, Task, Question, Property, TaskStatus } from './types';
import { api } from './api/client';
import { useSprintTasks } from './hooks/useSprintTasks';
import { getUserPreferences, saveUserPreferences } from './utils/cookies';
import { Navbar } from './components/Navbar';
import { TasksTab } from './components/TasksTab';
import { QuestionsView } from './components/QuestionsView';
import { MeetingView } from './components/MeetingView';
import { TaskModal } from './components/TaskModal';
import { MeetingQuickTaskModal } from './components/MeetingQuickTaskModal';
import { CloseSprintModal } from './components/CloseSprintModal';
import { LoginPage } from './components/LoginPage';
import { AdminPanelModal } from './components/AdminPanelModal';
import { RefreshCw, AlertCircle, X } from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [currentSprintId, setCurrentSprintId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Onglets
  const [activeTab, setActiveTab] = useState<'tasks' | 'questions' | 'meeting'>('tasks');

  // Modales
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskModalInitialStatus, setTaskModalInitialStatus] = useState<TaskStatus>('todo');
  const [taskModalInitialPropertyId, setTaskModalInitialPropertyId] = useState<number | null>(null);
  const [taskModalCreationSource, setTaskModalCreationSource] = useState<'tasks' | 'meeting'>('tasks');
  const [isCloseSprintModalOpen, setIsCloseSprintModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isMeetingQuickModalOpen, setIsMeetingQuickModalOpen] = useState(false);
  const [editingPendingTask, setEditingPendingTask] = useState<Task | null>(null);

  const showToast = useCallback((msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast(prev => (prev === msg ? null : prev));
    }, 5000);
  }, []);

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
    }
  }, [sprints, currentUser]);

  const {
    tasks,
    setTasks,
    saveTask,
    updateTaskStatus,
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
    onError: showToast
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
    }
  };

  const handleSelectSprint = (id: number) => {
    setCurrentSprintId(id);
    loadSprintDetails(id);
  };

  const openCreateTaskModal = (options?: {
    status?: TaskStatus;
    propertyId?: number | null;
    source?: 'tasks' | 'meeting';
  }) => {
    setEditingTask(null);
    setTaskModalInitialStatus(options?.status || 'todo');
    setTaskModalInitialPropertyId(options?.propertyId ?? null);
    setTaskModalCreationSource(options?.source || (activeTab === 'meeting' ? 'meeting' : 'tasks'));
    setIsTaskModalOpen(true);
  };

  // Questions : Ajout / Modif / Suppr
  const handleAddQuestion = async (data: any) => {
    try {
      await api.createQuestion(data);
      if (currentSprintId) await loadSprintDetails(currentSprintId);
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        showToast(err?.message || "Impossible d'ajouter cette question.");
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
        status: 'open',
        can_edit: true,
        can_delete: true
      };
      setQuestions([...questions, newQ]);
    }
  };

  const handleUpdateQuestion = async (id: number, data: Partial<Question>) => {
    const previousQuestions = questions;
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...data } : q)));
    try {
      await api.updateQuestion(id, data);
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        setQuestions(previousQuestions);
        showToast(err?.message || 'Impossible de modifier cette question.');
      }
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette question ?')) return;
    const previousQuestions = questions;
    setQuestions(questions.filter(q => q.id !== id));
    try {
      await api.deleteQuestion(id);
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        setQuestions(previousQuestions);
        showToast(err?.message || 'Impossible de supprimer cette question.');
      }
    }
  };

  const handleAddAnswer = async (questionId: number, content: string) => {
    try {
      await api.addQuestionAnswer(questionId, content);
      if (currentSprintId) loadSprintDetails(currentSprintId);
    } catch (e: any) {
      showToast(e.message || "Erreur lors de l'envoi de la proposition");
    }
  };

  const handleUpdateAnswer = async (answerId: number, content: string) => {
    try {
      await api.updateQuestionAnswer(answerId, content);
      if (currentSprintId) loadSprintDetails(currentSprintId);
    } catch (e: any) {
      showToast(e.message || 'Erreur lors de la modification de la réponse');
    }
  };

  const handleDeleteAnswer = async (answerId: number) => {
    if (!window.confirm('Supprimer cette proposition de réponse ?')) return;
    try {
      await api.deleteQuestionAnswer(answerId);
      if (currentSprintId) loadSprintDetails(currentSprintId);
    } catch (e: any) {
      showToast(e.message || 'Erreur lors de la suppression');
    }
  };

  const handleSetQuestionDecision = async (questionId: number, finalAnswer: string, status: string = 'resolved') => {
    try {
      await api.setQuestionDecision(questionId, finalAnswer, status);
      if (currentSprintId) loadSprintDetails(currentSprintId);
    } catch (e: any) {
      showToast(e.message || "Erreur lors de l'enregistrement de la décision");
    }
  };

  const handleConfirmCloseSprint = async (nextName: string, notes: string) => {
    const current = sprints.find(s => s.id === currentSprintId);
    if (!current) return;

    try {
      const res = await api.closeSprint(current.id, nextName, notes);
      if (res.success) {
        showToast(res.message);
        const sprintsRes = await api.getSprints();
        setSprints(sprintsRes.sprints);
        setCurrentSprintId(res.new_sprint_id);
        await loadSprintDetails(res.new_sprint_id);
        return;
      }
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        showToast(err?.message || 'Impossible de clôturer ce sprint.');
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
      showToast(`Le sprint ${current.name} a été clôturé localement (${rolledOverTasks.length} tâches transférées).`);
    }
  };

  // Administration des sprints
  const handleSprintReopened = async (sprintId: number) => {
    await api.reopenSprint(sprintId);
    const sprintsRes = await api.getSprints();
    if (sprintsRes?.sprints) {
      setSprints(sprintsRes.sprints);
      setCurrentSprintId(sprintId);
      await loadSprintDetails(sprintId);
    }
  };

  const handleSprintUpdated = async (sprintId: number, data: Partial<Sprint>) => {
    await api.updateSprint(sprintId, data);
    const sprintsRes = await api.getSprints();
    if (sprintsRes?.sprints) {
      setSprints(sprintsRes.sprints);
      if (currentSprintId === sprintId) {
        await loadSprintDetails(sprintId);
      }
    }
  };

  const handleSprintDeleted = async (sprintId: number) => {
    await api.deleteSprint(sprintId);
    const sprintsRes = await api.getSprints();
    if (sprintsRes?.sprints && sprintsRes.sprints.length > 0) {
      setSprints(sprintsRes.sprints);
      const nextSprint = sprintsRes.sprints.find(s => s.status === 'active') || sprintsRes.sprints[0];
      setCurrentSprintId(nextSprint.id);
      await loadSprintDetails(nextSprint.id);
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
      <div className="min-h-dvh bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Vérification de la session Carré d'Hôtes...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        users={allUsers}
        onLoginSuccess={handleLoginSuccess}
        onLoginSubmit={handleLoginSubmit}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-slate-100 flex flex-col">
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
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {actionToast && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center justify-between gap-3 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={2} />
              <span>{actionToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionToast(null)}
              className="p-1 text-red-500 hover:text-red-700 cursor-pointer"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {apiError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" strokeWidth={2} />
              <div>
                <p className="font-semibold text-sm">Erreur de communication avec l'API :</p>
                <p className="text-xs text-red-700">{apiError}</p>
              </div>
            </div>
            <button
              onClick={() => loadInitialData()}
              className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mb-3" strokeWidth={1.75} />
            <p className="text-sm font-medium text-slate-600">Chargement du tableau de bord Carré d'Hôtes...</p>
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
                onReorderKanbanTask={reorderKanbanTask}
                onMoveTaskProperty={moveTaskProperty}
                onToggleStar={toggleStar}
                onOpenCreateTask={openCreateTaskModal}
              />
            )}

            {activeTab === 'questions' && (
              <QuestionsView
                questions={questions}
                users={allUsers}
                currentUser={currentUser}
                sprintId={currentSprintId || 1}
                onAddQuestion={handleAddQuestion}
                onUpdateQuestion={handleUpdateQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                onAddAnswer={handleAddAnswer}
                onUpdateAnswer={handleUpdateAnswer}
                onDeleteAnswer={handleDeleteAnswer}
                isReadOnly={isReadOnly}
              />
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
                  onUpdateQuestionStatus={(qId, st) => handleUpdateQuestion(qId, { status: st })}
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
                  onAddNewQuestion={() => handleChangeTab('questions')}
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
        creationSource={taskModalCreationSource}
        onSave={saveTask}
      />

      <CloseSprintModal
        isOpen={isCloseSprintModalOpen}
        onClose={() => setIsCloseSprintModalOpen(false)}
        currentSprint={activeSprint}
        tasks={tasks}
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
        }}
        onUserUpdated={(updatedUser) => {
          setAllUsers(allUsers.map(u => (u.id === updatedUser.id ? updatedUser : u)));
          if (currentUser?.id === updatedUser.id) {
            setCurrentUser(updatedUser);
          }
        }}
        onUserDeleted={(deletedId) => {
          setAllUsers(allUsers.filter(u => u.id !== deletedId));
        }}
        onPropertyCreated={(newProp) => {
          setProperties(prev => sortProperties([...prev, newProp]));
        }}
        onPropertyUpdated={(updatedProp) => {
          setProperties(prev => sortProperties(prev.map(p => (p.id === updatedProp.id ? updatedProp : p))));
          if (currentSprintId) {
            loadSprintDetails(currentSprintId);
          }
        }}
        onPropertyStatusChanged={async (updatedProp) => {
          setProperties(prev => sortProperties(prev.map(p => (p.id === updatedProp.id ? updatedProp : p))));
          if (currentSprintId) {
            await loadSprintDetails(currentSprintId);
          }
        }}
        onPropertiesReordered={(orderedProps) => {
          setProperties(orderedProps);
        }}
      />
    </div>
  );
};
