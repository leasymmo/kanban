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
import {
  Plus, LayoutGrid, Home, Filter, UserCheck, UserPlus,
  RefreshCw, CheckCircle2, AlertCircle, ShieldAlert
} from 'lucide-react';

// Données de secours démo (utilisées uniquement si le backend PHP n'est pas démarré)
const DEFAULT_USERS: User[] = [
  { id: 1, name: 'Alexandre', email: 'alexandre@example.com', role: 'admin', avatar_color: '#2563EB', initials: 'AL' },
  { id: 2, name: 'Béatrice', email: 'beatrice@example.com', role: 'admin', avatar_color: '#7C3AED', initials: 'BE' },
  { id: 3, name: 'Camille', email: 'camille@example.com', role: 'write', avatar_color: '#059669', initials: 'CA' },
  { id: 4, name: 'Damien', email: 'damien@example.com', role: 'write', avatar_color: '#D97706', initials: 'DA' }
];

const DEFAULT_PROPERTIES: Property[] = [
  { id: 1, name: 'Résidence Centre', code: 'RC', color: '#3B82F6', is_active: 1 },
  { id: 2, name: 'Studio Sud', code: 'SS', color: '#EC4899', is_active: 1 },
  { id: 3, name: 'Villa Colline', code: 'VC', color: '#10B981', is_active: 1 },
  { id: 4, name: 'Loft Urbain', code: 'LU', color: '#8B5CF6', is_active: 1 },
  { id: 5, name: 'Appartement Panorama', code: 'AP', color: '#F59E0B', is_active: 1 }
];

const DEFAULT_SPRINTS: Sprint[] = [
  { id: 1, number: 1, name: 'Sprint 1 — Lancement', status: 'active', started_at: '2026-11-24 10:00:00' }
];

const DEFAULT_TASKS: Task[] = [
  {
    id: 1,
    sprint_id: 1,
    title: "Préparation des modèles de contrats pour les nouveaux clients",
    description: "Mettre en forme le document avec les clauses standards.",
    status: 'todo',
    assigned_to: null,
    created_by: 1,
    created_by_name: 'Alexandre',
    property_id: null,
    priority: 'medium',
    position: 1,
    subtasks: []
  },
  {
    id: 2,
    sprint_id: 1,
    title: "Mise à jour du site web et vérification des coordonnées",
    description: "Vérifier le formulaire de contact.",
    status: 'todo',
    assigned_to: null,
    created_by: 2,
    created_by_name: 'Béatrice',
    property_id: null,
    priority: 'low',
    position: 2,
    subtasks: []
  },
  {
    id: 3,
    sprint_id: 1,
    title: "Contrôle des stocks de consommables et fournitures",
    description: "Faire l'inventaire général de fin de mois.",
    status: 'in_progress',
    assigned_to: 4,
    assigned_to_name: 'Damien',
    assigned_to_initials: 'DA',
    assigned_to_color: '#D97706',
    created_by: 4,
    created_by_name: 'Damien',
    property_id: 1,
    property_name: 'Résidence Centre',
    property_color: '#3B82F6',
    priority: 'high',
    position: 1,
    subtasks: [
      { id: 101, task_id: 3, title: "Compter les produits d'accueil restants", is_done: 1, position: 1 },
      { id: 102, task_id: 3, title: "Passer la commande auprès du fournisseur", is_done: 0, position: 2 }
    ]
  },
  {
    id: 4,
    sprint_id: 1,
    title: "Remplacement des serrures connectées",
    description: "Installation et test d'ouverture par smartphone.",
    status: 'in_progress',
    assigned_to: 4,
    assigned_to_name: 'Damien',
    assigned_to_initials: 'DA',
    assigned_to_color: '#D97706',
    created_by: 4,
    created_by_name: 'Damien',
    property_id: 2,
    property_name: 'Studio Sud',
    property_color: '#EC4899',
    priority: 'high',
    position: 2,
    subtasks: [
      { id: 103, task_id: 4, title: "Acheter les nouveaux boîtiers", is_done: 1, position: 1 },
      { id: 104, task_id: 4, title: "Programmer les codes d'accès temporaires", is_done: 0, position: 2 }
    ]
  },
  {
    id: 5,
    sprint_id: 1,
    title: "Répondre aux demandes et avis clients de la semaine",
    description: "Traitement des messages en attente.",
    status: 'in_progress',
    assigned_to: 3,
    assigned_to_name: 'Camille',
    assigned_to_initials: 'CA',
    assigned_to_color: '#059669',
    created_by: 3,
    created_by_name: 'Camille',
    property_id: null,
    priority: 'medium',
    position: 1,
    subtasks: []
  },
  {
    id: 6,
    sprint_id: 1,
    title: "Finaliser le tableau de bord prévisionnel trimestriel",
    description: "Point comptable avant validation finale.",
    status: 'in_progress',
    assigned_to: 2,
    assigned_to_name: 'Béatrice',
    assigned_to_initials: 'BE',
    assigned_to_color: '#7C3AED',
    created_by: 2,
    created_by_name: 'Béatrice',
    property_id: null,
    priority: 'high',
    position: 1,
    subtasks: []
  },
  {
    id: 7,
    sprint_id: 1,
    title: "Configuration et déploiement du tableau Kanban",
    description: "Vérifier la bonne synchronisation avec la base de données.",
    status: 'done',
    assigned_to: 1,
    assigned_to_name: 'Alexandre',
    assigned_to_initials: 'AL',
    assigned_to_color: '#2563EB',
    created_by: 1,
    created_by_name: 'Alexandre',
    property_id: null,
    priority: 'high',
    position: 1,
    subtasks: [
      { id: 105, task_id: 7, title: "Créer la structure des tables MySQL", is_done: 1, position: 1 },
      { id: 106, task_id: 7, title: "Tester l'API REST", is_done: 1, position: 2 }
    ]
  }
];

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 1,
    sprint_id: 1,
    user_id: 4,
    user_name: 'Damien',
    user_initials: 'DA',
    user_color: '#D97706',
    created_by: 4,
    title: "Organisation des plannings d'intervention pour le mois prochain",
    details: "Définir les créneaux prioritaires avec les prestataires.",
    status: 'open'
  },
  {
    id: 2,
    sprint_id: 1,
    user_id: 3,
    user_name: 'Camille',
    user_initials: 'CA',
    user_color: '#059669',
    created_by: 3,
    title: "Optimisation des messages automatiques d'accueil",
    details: "Harmoniser les consignes d'arrivée envoyées aux voyageurs.",
    status: 'open'
  },
  {
    id: 3,
    sprint_id: 1,
    user_id: 2,
    user_name: 'Béatrice',
    user_initials: 'BE',
    user_color: '#7C3AED',
    created_by: 2,
    title: "Validation des devis pour les travaux de rénovation",
    details: "Arbitrage sur les deux propositions reçues.",
    status: 'open'
  },
  {
    id: 4,
    sprint_id: 1,
    user_id: 1,
    user_name: 'Alexandre',
    user_initials: 'AL',
    user_color: '#2563EB',
    created_by: 1,
    title: "Point sur les nouvelles fonctionnalités souhaitées pour le tableau",
    details: "Recueillir les retours des utilisateurs après la première semaine.",
    status: 'open'
  }
];

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(DEFAULT_USERS[0]);
  const [allUsers, setAllUsers] = useState<User[]>(DEFAULT_USERS);
  const [properties, setProperties] = useState<Property[]>(DEFAULT_PROPERTIES);
  const [sprints, setSprints] = useState<Sprint[]>(DEFAULT_SPRINTS);
  const [currentSprintId, setCurrentSprintId] = useState<number>(1);
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_TASKS);
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [isReadOnly, setIsReadOnly] = useState<boolean>(false);

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<'tasks' | 'questions' | 'meeting'>('tasks');
  const [taskViewMode, setTaskViewMode] = useState<'kanban' | 'property'>('kanban');
  const [taskFilter, setTaskFilter] = useState<'all' | 'me' | 'unassigned' | number>('all');

  // Modales
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCloseSprintModalOpen, setIsCloseSprintModalOpen] = useState(false);

  // Synchronisation avec l'API
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [usersRes, propsRes, sprintsRes] = await Promise.all([
        api.getUsers().catch(() => null),
        api.getProperties().catch(() => null),
        api.getSprints().catch(() => null)
      ]);

      if (usersRes?.users) setAllUsers(usersRes.users);
      if (propsRes?.properties) setProperties(propsRes.properties);
      if (sprintsRes?.sprints?.length) {
        setSprints(sprintsRes.sprints);
        const active = sprintsRes.sprints.find(s => s.status === 'active') || sprintsRes.sprints[0];
        setCurrentSprintId(active.id);
        loadSprintDetails(active.id);
      } else {
        enrichLocalTasks(DEFAULT_TASKS, DEFAULT_USERS[0]);
      }
    } catch (e) {
      console.warn("API indisponible, fonctionnement en mode local réactif :", e);
      enrichLocalTasks(DEFAULT_TASKS, DEFAULT_USERS[0]);
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
    } catch {
      // Fallback
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
    enrichLocalTasks(tasks, user);
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
          sprint_id: currentSprintId,
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
        sprint_id: currentSprintId,
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
        onSwitchUser={handleSwitchUser}
        onLogout={() => {}}
      />

      {/* Conteneur Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

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
            sprintId={currentSprintId}
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

      </main>

      {/* Modale d'Édition / Création de Tâche */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        task={editingTask}
        sprintId={currentSprintId}
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

    </div>
  );
};
