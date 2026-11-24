import React, { useState, useEffect } from 'react';
import { User, Sprint, Task, Question, Property, TaskStatus } from './types';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
import { KanbanBoard } from './components/KanbanBoard';
import { PropertyBoard } from './components/PropertyBoard';
import { QuestionsView } from './components/QuestionsView';
import { MeetingView } from './components/MeetingView';
import { TaskModal } from './components/TaskModal';
import { CloseSprintModal } from './components/CloseSprintModal';
import { LoginPage } from './components/LoginPage';
import { UserManagerModal } from './components/UserManagerModal';
import {
  Plus, LayoutGrid, Home, Filter, UserCheck, UserPlus,
  RefreshCw, CheckCircle2, AlertCircle, ShieldAlert
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [currentSprintId, setCurrentSprintId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<'tasks' | 'questions' | 'meeting'>('tasks');
  const [taskViewMode, setTaskViewMode] = useState<'kanban' | 'property'>('kanban');
  const [taskFilter, setTaskFilter] = useState<'all' | 'me' | 'unassigned' | number>('all');

  // Modales
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCloseSprintModalOpen, setIsCloseSprintModalOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);

  // Synchronisation avec l'API
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      // 1. Charger la liste des utilisateurs (public)
      const usersRes = await api.getUsers().catch(() => ({ success: false, users: [] as User[] }));
      if (usersRes?.users && usersRes.users.length > 0) {
        setAllUsers(usersRes.users);
      }

      // 2. Vérifier si une session active existe
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

      // 3. Utilisateur authentifié !
      setCurrentUser(meRes.user);
      api.setCurrentUserId(meRes.user.id);

      // 4. Charger logements et sprints
      const [propsRes, sprintsRes] = await Promise.all([
        api.getProperties().catch(() => ({ success: false, properties: [] })),
        api.getSprints().catch(() => ({ success: false, sprints: [] }))
      ]);

      if (propsRes?.properties) {
        setProperties(propsRes.properties);
      }

      if (sprintsRes?.sprints && sprintsRes.sprints.length > 0) {
        setSprints(sprintsRes.sprints);
        const active = sprintsRes.sprints.find(s => s.status === 'active') || sprintsRes.sprints[0];
        setCurrentSprintId(active.id);
        await loadSprintDetails(active.id);
      } else {
        setSprints([]);
        setTasks([]);
        setQuestions([]);
      }
    } catch (e: any) {
      console.error("Erreur de chargement API :", e);
      setApiError(e?.message || "Impossible de joindre l'API REST.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSuccess = async (user: User, token: string) => {
    setCurrentUser(user);
    api.setCurrentUserId(user.id);
    await loadInitialData();
  };

  const handleLoginSubmit = async (emailOrId: string | number, password: string) => {
    return api.login(emailOrId, password);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.warn("Erreur déconnexion :", err);
    } finally {
      setCurrentUser(null);
      localStorage.removeItem('kanban_token');
      localStorage.removeItem('kanban_current_user_id');
    }
  };

  const loadSprintDetails = async (sprintId: number) => {
    try {
      const details = await api.getSprintDetails(sprintId);
      if (details.success) {
        setTasks(details.tasks);
        setQuestions(details.questions);
        setIsReadOnly(details.is_read_only);
      }
    } catch (err: any) {
      console.error("Erreur chargement sprint :", err);
      const sprint = sprints.find(s => s.id === sprintId);
      setIsReadOnly(sprint?.status === 'closed' && currentUser?.role !== 'admin');
    }
  };

  const enrichLocalTasks = (rawTasks: Task[], user: User | null) => {
    const enriched = rawTasks.map(t => {
      const canEdit = (user?.role === 'admin')
        || (user?.role === 'write' && (t.assigned_to === user.id || (t.assigned_to === null && t.created_by === user.id)));
      return {
        ...t,
        can_edit: canEdit,
        can_delete: canEdit,
        can_assign: user?.role === 'admin'
      };
    });
    setTasks(enriched);
  };

  // Changement d'associé connecté (switcher)
  const handleSwitchUser = (userId: number) => {
    const user = allUsers.find(u => u.id === userId) || null;
    setCurrentUser(user);
    api.setCurrentUserId(userId);
    enrichLocalTasks(tasks, user);
    if (currentSprintId) {
      loadSprintDetails(currentSprintId);
    }
  };

  // Sélection d'un sprint
  const handleSelectSprint = (id: number) => {
    setCurrentSprintId(id);
    loadSprintDetails(id);
  };

  // Tâches : Création / Édition
  const handleSaveTask = async (taskData: any) => {
    try {
      if (taskData.id) {
        await api.updateTask(taskData.id, taskData);
      } else {
        await api.createTask(taskData);
      }
      if (currentSprintId) loadSprintDetails(currentSprintId);
    } catch (err) {
      // Mise à jour optimiste locale
      if (taskData.id) {
        setTasks(tasks.map(t => t.id === taskData.id ? { ...t, ...taskData } : t));
      } else {
        const newTask: Task = {
          id: Date.now(),
          sprint_id: currentSprintId || 1,
          title: taskData.title,
          description: taskData.description,
          status: taskData.status,
          priority: taskData.priority,
          assigned_to: taskData.assigned_to,
          assigned_to_name: allUsers.find(u => u.id === taskData.assigned_to)?.name,
          assigned_to_initials: allUsers.find(u => u.id === taskData.assigned_to)?.initials,
          assigned_to_color: allUsers.find(u => u.id === taskData.assigned_to)?.avatar_color,
          created_by: currentUser?.id || 1,
          property_id: taskData.property_id,
          property_name: properties.find(p => p.id === taskData.property_id)?.name,
          property_color: properties.find(p => p.id === taskData.property_id)?.color,
          position: tasks.length + 1,
          subtasks: (taskData.subtasks || []).map((st: string, idx: number) => ({
            id: Date.now() + idx,
            task_id: Date.now(),
            title: st,
            is_done: 0,
            position: idx + 1
          })),
          can_edit: true,
          can_delete: true
        };
        setTasks([...tasks, newTask]);
      }
    }
  };

  // Changement rapide de statut (Drag & Drop ou Clic)
  const handleUpdateTaskStatus = async (taskId: number, newStatus: TaskStatus) => {
    // Optimistic UI
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.updateTaskStatus(taskId, newStatus);
    } catch {
      // Ignorer si mode local
    }
  };

  // Attribution rapide d'une tâche orpheline en réunion par l'Admin
  const handleAssignTask = async (taskId: number, userId: number) => {
    const targetUser = allUsers.find(u => u.id === userId);
    setTasks(tasks.map(t => t.id === taskId ? {
      ...t,
      assigned_to: userId,
      assigned_to_name: targetUser?.name,
      assigned_to_initials: targetUser?.initials,
      assigned_to_color: targetUser?.avatar_color
    } : t));

    try {
      await api.updateTask(taskId, { assigned_to: userId });
    } catch {
      // Mode local
    }
  };

  // Suppression d'une tâche
  const handleDeleteTask = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette tâche ?')) return;
    setTasks(tasks.filter(t => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch {
      // Mode local
    }
  };

  // Coche / Décoche sous-tâche
  const handleToggleSubtask = async (subtaskId: number) => {
    setTasks(tasks.map(t => ({
      ...t,
      subtasks: t.subtasks.map(st => st.id === subtaskId ? { ...st, is_done: !st.is_done } : st)
    })));
    try {
      await api.toggleSubtask(subtaskId);
    } catch {
      // Mode local
    }
  };

  // Questions : Ajout / Modif / Suppr
  const handleAddQuestion = async (data: any) => {
    try {
      await api.createQuestion(data);
      if (currentSprintId) loadSprintDetails(currentSprintId);
    } catch {
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
    setQuestions(questions.map(q => q.id === id ? { ...q, ...data } : q));
    try {
      await api.updateQuestion(id, data);
    } catch {
      // Mode local
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette question ?')) return;
    setQuestions(questions.filter(q => q.id !== id));
    try {
      await api.deleteQuestion(id);
    } catch {
      // Mode local
    }
  };

  // Clôture du sprint & Bascule (action clé du lundi)
  const handleConfirmCloseSprint = async (nextName: string, notes: string) => {
    const current = sprints.find(s => s.id === currentSprintId);
    if (!current) return;

    try {
      const res = await api.closeSprint(current.id, nextName, notes);
      if (res.success) {
        alert(res.message);
        const sprintsRes = await api.getSprints();
        setSprints(sprintsRes.sprints);
        setCurrentSprintId(res.new_sprint_id);
        loadSprintDetails(res.new_sprint_id);
        return;
      }
    } catch {
      // Simulation locale fidèle de la bascule de sprint
      const nextNumber = current.number + 1;
      const newSprintId = Date.now();
      const newSprint: Sprint = {
        id: newSprintId,
        number: nextNumber,
        name: nextName || `Point ${nextNumber}`,
        status: 'active',
        started_at: new Date().toISOString()
      };

      // 1. Figer le sprint actuel
      const updatedSprints = sprints.map(s => s.id === current.id ? { ...s, status: 'closed' as const } : s);
      setSprints([newSprint, ...updatedSprints]);

      // 2. Report des tâches non terminées avec 100% de leurs sous-tâches
      const pendingTasks = tasks.filter(t => t.status !== 'done');
      const rolledOverTasks: Task[] = pendingTasks.map((t, idx) => ({
        ...t,
        id: Date.now() + idx + 10,
        sprint_id: newSprintId,
        status: (t.status === 'todo' ? 'in_progress' : t.status),
        // Conservation de toutes les sous-tâches (faites et à faire)
        subtasks: t.subtasks.map(st => ({ ...st, id: Date.now() + Math.random() }))
      }));

      setCurrentSprintId(newSprintId);
      setTasks(rolledOverTasks);
      setQuestions([]); // Les questions sont réinitialisées pour la nouvelle semaine
      alert(`Le sprint ${current.name} a été clôturé. Le nouveau sprint Point ${nextNumber} est maintenant ouvert avec ${rolledOverTasks.length} tâches reportées.`);
    }
  };

  // Filtrage des tâches selon la sélection
  const filteredTasks = tasks.filter(t => {
    if (taskFilter === 'all') return true;
    if (taskFilter === 'me') return t.assigned_to === currentUser?.id;
    if (taskFilter === 'unassigned') return !t.assigned_to;
    if (typeof taskFilter === 'number') return t.assigned_to === taskFilter;
    return true;
  });

  const activeSprint = sprints.find(s => s.id === currentSprintId) || sprints[0];

  // Si non connecté, afficher la page de connexion sécurisée
  if (isLoading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
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
    <div className="min-h-screen bg-slate-100 flex flex-col">
      
      {/* Navbar Principale */}
      <Navbar
        currentUser={currentUser}
        allUsers={allUsers}
        sprints={sprints}
        currentSprintId={currentSprintId}
        onSelectSprint={handleSelectSprint}
        isReadOnly={isReadOnly}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onLogout={handleLogout}
        onOpenUserManager={() => setIsUserManagerOpen(true)}
      />

      {/* Conteneur Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Message d'erreur API si échec */}
        {apiError && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
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

        {/* État de chargement initial */}
        {isLoading && allUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600 mb-3" />
            <p className="text-sm font-medium text-slate-600">Chargement du tableau de bord Carré d'Hôtes...</p>
          </div>
        ) : (
          <>
            {/* TAB 1 : TÂCHES */}
            {activeTab === 'tasks' && (
          <div className="space-y-5">
            
            {/* Barre de contrôles des tâches */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
              
              {/* Filtres par associé / pool */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
                  Filtres :
                </span>

                {/* Toutes */}
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    taskFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Toutes ({tasks.length})
                </button>

                {/* Mes tâches */}
                {currentUser && (
                  <button
                    onClick={() => setTaskFilter('me')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      taskFilter === 'me'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Mes tâches ({tasks.filter(t => t.assigned_to === currentUser.id).length})
                  </button>
                )}

                {/* Tâches non attribuées (pool commun) */}
                <button
                  onClick={() => setTaskFilter('unassigned')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    taskFilter === 'unassigned'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Non attribuées ({tasks.filter(t => !t.assigned_to).length})
                </button>

                {/* Filtre par autres associés (le compte connecté n'apparaît pas car couvert par "Mes tâches" conformément au brief) */}
                {allUsers
                  .filter(u => u.id !== currentUser?.id)
                  .map(u => {
                    const count = tasks.filter(t => t.assigned_to === u.id).length;
                    const isSelected = taskFilter === u.id;

                    return (
                      <button
                        key={u.id}
                        onClick={() => setTaskFilter(u.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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

              {/* Sélecteur de vue (Statut vs Logement) + Bouton Nouvelle Tâche */}
              <div className="flex items-center gap-2">
                
                {/* Switch vue Kanban / Logement */}
                <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    onClick={() => setTaskViewMode('kanban')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      taskViewMode === 'kanban'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Vue Kanban par statut (À faire / En cours / Fait / Bloqué)"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Par Statut
                  </button>

                  <button
                    onClick={() => setTaskViewMode('property')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      taskViewMode === 'property'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                    title="Vue groupée par logement"
                  >
                    <Home className="w-3.5 h-3.5" />
                    Par Logement
                  </button>
                </div>

                {/* Bouton Ajouter Tâche */}
                {!isReadOnly && currentUser?.role !== 'read' && (
                  <button
                    onClick={() => {
                      setEditingTask(null);
                      setIsTaskModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-brand-600/30 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Nouvelle tâche
                  </button>
                )}
              </div>

            </div>

            {/* Vue active : Kanban ou Logement */}
            {taskViewMode === 'kanban' ? (
              <KanbanBoard
                tasks={filteredTasks}
                currentUser={currentUser}
                onEditTask={(t) => {
                  setEditingTask(t);
                  setIsTaskModalOpen(true);
                }}
                onDeleteTask={handleDeleteTask}
                onToggleSubtask={handleToggleSubtask}
                onUpdateStatus={handleUpdateTaskStatus}
                onAddNewTask={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                isReadOnly={isReadOnly}
              />
            ) : (
              <PropertyBoard
                tasks={filteredTasks}
                properties={properties}
                currentUser={currentUser}
                onEditTask={(t) => {
                  setEditingTask(t);
                  setIsTaskModalOpen(true);
                }}
                onDeleteTask={handleDeleteTask}
                onToggleSubtask={handleToggleSubtask}
                onAddNewTask={() => {
                  setEditingTask(null);
                  setIsTaskModalOpen(true);
                }}
                isReadOnly={isReadOnly}
              />
            )}

          </div>
        )}

        {/* TAB 2 : QUESTIONS */}
        {activeTab === 'questions' && (
          <QuestionsView
            questions={questions}
            users={allUsers}
            currentUser={currentUser}
            sprintId={currentSprintId || 1}
            onAddQuestion={handleAddQuestion}
            onUpdateQuestion={handleUpdateQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            isReadOnly={isReadOnly}
          />
        )}

        {/* TAB 3 : VUE RÉUNION */}
        {activeTab === 'meeting' && (
          <MeetingView
            sprint={activeSprint}
            tasks={tasks}
            questions={questions}
            users={allUsers}
            currentUser={currentUser}
            properties={properties}
            onOpenCloseSprintModal={() => setIsCloseSprintModalOpen(true)}
            onUpdateTaskStatus={handleUpdateTaskStatus}
            onAssignTask={handleAssignTask}
            onToggleSubtask={handleToggleSubtask}
            onUpdateQuestionStatus={(qId, st) => handleUpdateQuestion(qId, { status: st })}
            onEditTask={(t) => {
              setEditingTask(t);
              setIsTaskModalOpen(true);
            }}
            isReadOnly={isReadOnly}
          />
        )}

          </>
        )}

      </main>

      {/* Modale d'Édition / Création de Tâche */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={editingTask}
        sprintId={currentSprintId || 1}
        currentUser={currentUser}
        users={allUsers}
        properties={properties}
        onSave={handleSaveTask}
      />

      {/* Modale de Clôture & Bascule du Sprint */}
      <CloseSprintModal
        isOpen={isCloseSprintModalOpen}
        onClose={() => setIsCloseSprintModalOpen(false)}
        currentSprint={activeSprint}
        tasks={tasks}
        onConfirmClose={handleConfirmCloseSprint}
      />

      {/* Modale d'Administration des Utilisateurs (Admins uniquement) */}
      <UserManagerModal
        isOpen={isUserManagerOpen}
        onClose={() => setIsUserManagerOpen(false)}
        users={allUsers}
        currentUser={currentUser}
        onUserCreated={(newUser) => {
          setAllUsers([...allUsers, newUser]);
        }}
        onUserUpdated={(updatedUser) => {
          setAllUsers(allUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
          if (currentUser?.id === updatedUser.id) {
            setCurrentUser(updatedUser);
          }
        }}
        onUserDeleted={(deletedId) => {
          setAllUsers(allUsers.filter(u => u.id !== deletedId));
        }}
        apiCreateUser={api.createUser}
        apiUpdateUser={api.updateUser}
        apiDeleteUser={api.deleteUser}
      />

    </div>
  );
};
