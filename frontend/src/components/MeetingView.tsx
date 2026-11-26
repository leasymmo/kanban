import React, { useState, useEffect } from 'react';
import { Sprint, Task, TaskStatus, Question, User, Property } from '../types';
import { buildSubtaskTree, HierarchicalSubtask } from '../utils/subtasks';
import { BlurredIconSwap } from './BlurredIconSwap';
import {
  Users, CheckCircle2, UserPlus,
  Shield, CheckSquare, Square,
  Sparkles, MessageSquare, Check, Edit3, Trash2, Star,
  ChevronDown, Plus, AlertTriangle
} from 'lucide-react';

interface MeetingViewProps {
  sprint?: Sprint | null;
  tasks: Task[];
  questions: Question[];
  users: User[];
  currentUser: User | null;
  properties: Property[];
  onOpenCloseSprintModal: () => void;
  onUpdateTaskStatus: (taskId: number, status: TaskStatus) => void;
  onAssignTask: (taskId: number, userId: number | null) => void;
  onDeleteTask?: (taskId: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onUpdateQuestionStatus: (questionId: number, status: Question['status']) => void;
  onSetQuestionDecision?: (questionId: number, finalAnswer: string, status?: string) => Promise<void>;
  onEditTask: (task: Task) => void;
  onToggleStar?: (taskId: number) => void;
  onAddNewTask?: (editingPendingTask?: Task | null) => void;
  onAddNewQuestion?: () => void;
  isReadOnly: boolean;
}

export const MeetingView: React.FC<MeetingViewProps> = ({
  sprint,
  tasks,
  questions,
  users,
  currentUser,
  properties,
  onOpenCloseSprintModal,
  onUpdateTaskStatus,
  onAssignTask,
  onDeleteTask,
  onToggleSubtask,
  onUpdateQuestionStatus,
  onSetQuestionDecision,
  onEditTask,
  onToggleStar,
  onAddNewTask,
  onAddNewQuestion,
  isReadOnly
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [meetingStep, setMeetingStep] = useState<'retro' | 'questions' | 'unassigned'>('retro');

  // Rôles de la réunion (Animateur & Rédacteur) - fidélité au process Carré d'Hôtes
  const [animatorId, setAnimatorId] = useState<number>(() => {
    const stored = localStorage.getItem('meeting_animator_id');
    if (stored) return Number(stored);
    const chris = users.find(u => u.name.toLowerCase().includes('chris'));
    return chris ? chris.id : (users[0]?.id || 1);
  });
  const [scribeId, setScribeId] = useState<number>(() => {
    const stored = localStorage.getItem('meeting_scribe_id');
    if (stored) return Number(stored);
    const max = users.find(u => u.name.toLowerCase().includes('max'));
    return max ? max.id : (users[1]?.id || users[0]?.id || 1);
  });

  // Accordéons des tâches non mises en avant (par associé)
  const [expandedAccordions, setExpandedAccordions] = useState<{ [userId: number]: boolean }>({});

  useEffect(() => {
    if (users.length === 0) return;
    if (!users.some(u => u.id === animatorId)) {
      const chris = users.find(u => u.name.toLowerCase().includes('chris'));
      setAnimatorId(chris ? chris.id : users[0].id);
    }
    if (!users.some(u => u.id === scribeId)) {
      const max = users.find(u => u.name.toLowerCase().includes('max'));
      setScribeId(max ? max.id : (users[1]?.id || users[0].id));
    }
  }, [users, animatorId, scribeId]);

  const toggleAccordion = (userId: number) => {
    setExpandedAccordions(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // Gestion des décisions de réunion (par question)
  const [decisionInputs, setDecisionInputs] = useState<{ [questionId: number]: string }>({});
  const [editingDecisionForId, setEditingDecisionForId] = useState<number | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<{ [questionId: number]: boolean }>({});

  // Séparation des tâches :
  // - pendingAllTasks : toutes les tâches au statut 'pending' (jamais visibles dans l'onglet Tâches)
  // - pendingUnassigned : tâches 'pending' non attribuées (Sous-section 1 : Tâches non-attribuées)
  // - pendingAssigned : tâches 'pending' attribuées (Sous-section 2 : Tâches attribuées, regroupées par associé)
  // - activeSprintTasks : tâches actives du sprint en cours (status !== 'pending')
  const pendingAllTasks = tasks.filter(t => t.status === 'pending');
  const pendingUnassigned = pendingAllTasks.filter(t => !t.assigned_to);
  const pendingAssigned = pendingAllTasks.filter(t => !!t.assigned_to);
  const activeSprintTasks = tasks.filter(t => t.status !== 'pending');
  const doneTasks = activeSprintTasks.filter(t => t.status === 'done');
  const unfinishedSprintTasks = activeSprintTasks.filter(t => t.status !== 'done');
  const openQuestions = questions.filter(q => q.status !== 'resolved');

  if (!sprint) {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.12] p-10 text-center text-slate-500 text-sm">
        Aucun sprint disponible.
      </div>
    );
  }

  const handleSelectPropositionAsDecision = (questionId: number, propositionContent: string) => {
    setDecisionInputs(prev => ({ ...prev, [questionId]: propositionContent }));
    setEditingDecisionForId(questionId);
  };

  const handleSaveDecision = async (questionId: number) => {
    const text = decisionInputs[questionId] !== undefined
      ? decisionInputs[questionId].trim()
      : (questions.find(q => q.id === questionId)?.final_answer || '');

    if (!text || !onSetQuestionDecision) return;

    setIsSubmittingDecision(prev => ({ ...prev, [questionId]: true }));
    try {
      await onSetQuestionDecision(questionId, text, 'resolved');
      setEditingDecisionForId(null);
    } finally {
      setIsSubmittingDecision(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Rendu récursif des sous-tâches dans la rétrospective
  const renderRetroSubtasks = (nodes: HierarchicalSubtask[], canEditThis: boolean) => {
    const depthBorders = [
      '',
      'border-l-2 border-indigo-300 ml-2.5 pl-2',
      'border-l-2 border-amber-300 ml-2.5 pl-2',
      'border-l-2 border-emerald-300 ml-2.5 pl-2'
    ];

    return (
      <div className="space-y-1">
        {nodes.map(node => (
          <div key={node.id} className={node.depth > 0 ? depthBorders[node.depth] || 'ml-2 pl-2 border-l' : ''}>
            <div
              onClick={() => canEditThis && onToggleSubtask(node.id)}
              className={`flex items-center gap-1.5 text-[11px] text-slate-600 ${
                canEditThis ? 'cursor-pointer hover:text-slate-900' : 'cursor-default'
              }`}
            >
              <BlurredIconSwap
                active={!!node.is_done}
                activeIcon={<CheckSquare className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.75} />}
                inactiveIcon={<Square className="w-3.5 h-3.5 text-slate-300" strokeWidth={1.75} />}
              />
              <span className={node.is_done ? 'line-through text-slate-400' : 'font-medium'}>
                {node.title}
              </span>
            </div>
            {node.children && node.children.length > 0 && (
              <div className="mt-1">
                {renderRetroSubtasks(node.children, canEditThis)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header spécial Réunion Hebdomadaire (Responsive) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[32px] sm:rounded-[36px] p-5 sm:p-6 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider mb-2">
              <Users className="w-3.5 h-3.5" strokeWidth={2.25} />
              Réunion hebdomadaire de l'équipe
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-3 flex-wrap">
              {sprint.name}
              {isReadOnly && (
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-500/30">
                  Sprint clôturé (Archive)
                </span>
              )}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Support interactif pour animer la réunion, apporter les décisions définitives aux questions, et acter la bascule du sprint.
            </p>
          </div>

          {/* Bouton de Clôture / Bascule */}
          <div className="flex items-center gap-3 shrink-0">
            {sprint.status === 'closed' ? (
              <div className="text-xs text-slate-300 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700">
                🔒 Sprint validé et archivé
              </div>
            ) : isAdmin ? (
              <button
                onClick={onOpenCloseSprintModal}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-brand-600 hover:from-indigo-600 hover:to-brand-700 text-white font-bold text-xs sm:text-sm shadow-xl shadow-brand-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <CheckCircle2 className="w-5 h-5 text-indigo-200" strokeWidth={2.25} />
                Valider la réunion & Clôturer le sprint
              </button>
            ) : (
              <div className="text-xs text-slate-300 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" strokeWidth={1.75} />
                Seul un administrateur peut clôturer le sprint
              </div>
            )}
          </div>
        </div>

        {/* Chiffres clés du sprint (Responsive grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 font-medium">Tâches totales</span>
            <div className="text-lg font-bold text-white mt-0.5">{activeSprintTasks.length}</div>
          </div>
          <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40">
            <span className="text-emerald-400 font-medium">Tâches terminées ✅</span>
            <div className="text-lg font-bold text-emerald-300 mt-0.5">{doneTasks.length}</div>
          </div>
          <div className="bg-amber-950/40 p-3 rounded-xl border border-amber-800/40">
            <span className="text-amber-400 font-medium">En cours / À reporter 🚧</span>
            <div className="text-lg font-bold text-amber-300 mt-0.5">{unfinishedSprintTasks.length}</div>
          </div>
          <div className="bg-purple-950/40 p-3 rounded-xl border border-purple-800/40">
            <span className="text-purple-400 font-medium">À attribuer en réunion</span>
            <div className="text-lg font-bold text-purple-300 mt-0.5">{pendingUnassigned.length}</div>
          </div>
        </div>

        {/* Rôles de la réunion hebdomadaire (Fidélité au rituel du document de réunion) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            {/* Animateur */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/70 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1">
                🎤 Animateur :
              </span>
              <select
                value={animatorId}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAnimatorId(val);
                  localStorage.setItem('meeting_animator_id', String(val));
                }}
                className="bg-slate-700 border border-slate-600 rounded-md px-1.5 py-0.5 text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-800 text-white">
                    {u.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 hidden sm:inline">(Garant du temps & parole)</span>
            </div>

            {/* Rédacteur */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/70 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="text-[11px] text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
                ✍️ Rédacteur :
              </span>
              <select
                value={scribeId}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setScribeId(val);
                  localStorage.setItem('meeting_scribe_id', String(val));
                }}
                className="bg-slate-700 border border-slate-600 rounded-md px-1.5 py-0.5 text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-800 text-white">
                    {u.name}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 hidden sm:inline">(Note décisions & actions)</span>
            </div>
          </div>

          {/* Bouton d'ajout rapide de tâche en direct pendant la réunion */}
          {!isReadOnly && currentUser?.role !== 'read' && onAddNewTask && sprint.status !== 'closed' && (
            <button
              onClick={() => onAddNewTask(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/25 hover:bg-violet-500/35 text-violet-100 border border-violet-400/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ml-auto"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
              <span>Nouvelle tâche en séance</span>
            </button>
          )}
        </div>

      </div>

      {/* Barre d'étapes de la réunion (Responsive horizontal scroll on mobile) */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-black/[0.12] shadow-xs overflow-x-auto">
        <button
          onClick={() => setMeetingStep('retro')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            meetingStep === 'retro'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">1</span>
          <span>Rétrospective par Associé</span>
          <span className="text-[10px] opacity-75 font-normal px-1.5 py-0.5 rounded bg-black/20">15 min</span>
        </button>

        <button
          onClick={() => setMeetingStep('questions')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            meetingStep === 'questions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">2</span>
          <span>Revue des Questions & Décisions</span>
          <span className="text-[10px] opacity-75 font-normal px-1.5 py-0.5 rounded bg-black/20">30 min</span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px]">{openQuestions.length}</span>
        </button>

        <button
          onClick={() => setMeetingStep('unassigned')}
          className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            meetingStep === 'unassigned'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">3</span>
          <span>Plan d'Action & Tâches orphelines</span>
          <span className="text-[10px] opacity-75 font-normal px-1.5 py-0.5 rounded bg-black/20">10 min</span>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
            {pendingUnassigned.length + pendingAssigned.length}
          </span>
        </button>
      </div>

      {/* Contenu de l'étape active */}

      {/* ÉTAPE 1 : Rétrospective par associé */}
      {meetingStep === 'retro' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {users.map((user) => {
            const userTasks = activeSprintTasks.filter(t => t.assigned_to === user.id);
            const userDone = userTasks.filter(t => t.status === 'done');
            const userPending = userTasks.filter(t => t.status !== 'done');
            const userStarred = userTasks.filter(t => !!t.is_starred);
            const userUnstarred = userTasks.filter(t => !t.is_starred);
            const canEditThis = !isReadOnly && (isAdmin || currentUser?.id === user.id);
            const isAccordionOpen = !!expandedAccordions[user.id];

            const renderRetroTask = (t: Task, isHighlighted: boolean) => {
              const hierarchicalSubtasks = buildSubtaskTree(t.subtasks || []);

              return (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    isHighlighted
                      ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-300/60 shadow-2xs'
                      : t.status === 'done'
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : t.status === 'blocked'
                      ? 'bg-red-50/40 border-red-200'
                      : 'bg-slate-50 border-black/[0.12]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {/* Toggle rapide statut en séance */}
                      {canEditThis ? (
                        <button
                          onClick={() => onUpdateTaskStatus(t.id, t.status === 'done' ? 'in_progress' : 'done')}
                          className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0 cursor-pointer"
                          title="Marquer fait / en cours"
                        >
                          <BlurredIconSwap
                            active={t.status === 'done'}
                            activeIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />}
                            inactiveIcon={<Square className="w-4 h-4 text-slate-400" strokeWidth={1.75} />}
                          />
                        </button>
                      ) : (
                        <span className="mt-0.5 shrink-0">
                          {t.status === 'done' ? '✅' : t.status === 'blocked' ? '❌' : '🚧'}
                        </span>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Étoile interactive si autorisé */}
                          {(t.can_star || !!t.is_starred) && (
                            <button
                              type="button"
                              disabled={!t.can_star}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (t.can_star && onToggleStar) {
                                  onToggleStar(t.id);
                                }
                              }}
                              className={`p-0.5 rounded transition-all shrink-0 ${
                                t.is_starred
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : t.can_star
                                  ? 'text-slate-300 hover:text-amber-400 cursor-pointer'
                                  : 'hidden'
                              }`}
                              title={t.is_starred ? 'Mise en avant activée (cliquer pour retirer)' : 'Mettre en avant pour la réunion'}
                            >
                              <Star className={`w-3.5 h-3.5 ${t.is_starred ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} strokeWidth={1.75} />
                            </button>
                          )}

                          <span className={`font-semibold text-slate-800 break-words ${t.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                            {t.title}
                          </span>

                          {t.property_name && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                              style={{ backgroundColor: t.property_color || '#3B82F6' }}
                            >
                              {t.property_name}
                            </span>
                          )}
                        </div>

                        {t.description && (
                          <p className="mt-1 text-slate-600 text-[11px] leading-relaxed break-words">
                            <span className="text-brand-600 font-bold mr-1">→</span>
                            {t.description}
                          </p>
                        )}

                        {/* Sous-tâches hiérarchiques jusqu'à 4 niveaux */}
                        {t.subtasks && t.subtasks.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-black/[0.12]">
                            {renderRetroSubtasks(hierarchicalSubtasks, canEditThis)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Statut sélecteur rapide pour la réunion */}
                    {canEditThis && (
                      <select
                        value={t.status}
                        onChange={(e) => onUpdateTaskStatus(t.id, e.target.value as TaskStatus)}
                        className="text-[11px] font-semibold border border-black/[0.12] rounded px-1.5 py-0.5 bg-white text-slate-700 cursor-pointer shrink-0"
                      >
                        <option value="todo">À faire</option>
                        <option value="in_progress">🚧 En cours</option>
                        <option value="blocked">❌ Bloqué</option>
                        <option value="done">✅ Fait</option>
                      </select>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <div
                key={user.id}
                className="bg-white rounded-[28px] sm:rounded-[32px] p-4 sm:p-5 border border-black/[0.12] shadow-xs flex flex-col space-y-4"
              >
                {/* Entête Associé */}
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.12]">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white shadow-xs"
                      style={{ backgroundColor: user.avatar_color }}
                    >
                      {user.initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-800 leading-tight">{user.name}</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {userDone.length}/{userTasks.length} terminées
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {userStarred.length > 0 && (
                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-600" strokeWidth={2.25} />
                        {userStarred.length} mise{userStarred.length > 1 ? 's' : ''} en avant
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-700">
                      {userPending.length} en cours
                    </span>
                  </div>
                </div>

                {/* Tâches de l'associé : SEULES LES TÂCHES AVEC ÉTOILE SONT AFFICHÉES DIRECTEMENT */}
                <div className="space-y-3 flex-1 max-h-[520px] overflow-y-auto pr-1">
                  {userStarred.length > 0 ? (
                    <div className="space-y-2.5">
                      {userStarred.map(t => renderRetroTask(t, true))}
                    </div>
                  ) : (
                    <div className="p-4 border border-dashed border-amber-200/90 bg-amber-50/20 rounded-xl text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-900">
                        <Star className="w-4 h-4 text-amber-500" strokeWidth={2} />
                        Aucune tâche mise en avant avec l'étoile
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {userUnstarred.length > 0
                          ? `Dépliez l'accordéon ci-dessous pour voir les ${userUnstarred.length} autres tâches de ${user.name}.`
                          : 'Aucune tâche assignée à cet associé pour ce sprint.'}
                      </p>
                    </div>
                  )}

                  {/* ACCORDÉON EN BAS POUR LES AUTRES TÂCHES NON MISES EN AVANT */}
                  {userUnstarred.length > 0 && (
                    <div className="pt-2 border-t border-black/[0.12] mt-3">
                      <button
                        type="button"
                        onClick={() => toggleAccordion(user.id)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/90 text-xs font-semibold text-slate-700 transition-all border border-black/[0.12] cursor-pointer group"
                      >
                        <span className="flex items-center gap-2">
                          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isAccordionOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                          <span>Autres tâches non mises en avant ({userUnstarred.length})</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-700 uppercase tracking-wider">
                          {isAccordionOpen ? 'Masquer' : 'Afficher'}
                        </span>
                      </button>

                      {isAccordionOpen && (
                        <div className="mt-2.5 space-y-2.5 animate-fade-in">
                          {userUnstarred.map(t => renderRetroTask(t, false))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ÉTAPE 2 : Revue des questions avec Décision Définitive */}
      {meetingStep === 'questions' && (
        <div className="bg-white rounded-[32px] sm:rounded-[36px] p-5 sm:p-6 border border-black/[0.12] shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/[0.12]">
            <div>
              <h3 className="font-bold text-base text-slate-800">Sujets stratégiques & Revue des Questions</h3>
              <p className="text-xs text-slate-500">
                Passez en revue les questions et validez la décision définitive en séance (directement ou depuis une proposition).
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                {openQuestions.length} restante{openQuestions.length > 1 ? 's' : ''} à traiter
              </span>
              {!isReadOnly && currentUser?.role !== 'read' && onAddNewQuestion && (
                <button
                  type="button"
                  onClick={onAddNewQuestion}
                  className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                  <span>+ Poser une question</span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((q) => {
              const isResolved = q.status === 'resolved';
              const answers = q.answers || [];
              const hasFinalAnswer = !!q.final_answer;
              const isEditingDecision = editingDecisionForId === q.id || (!hasFinalAnswer && decisionInputs[q.id] !== undefined);
              const currentInput = decisionInputs[q.id] !== undefined ? decisionInputs[q.id] : (q.final_answer || '');
              const canArbitrate = !isReadOnly && (isAdmin || currentUser?.id === q.user_id || currentUser?.role === 'write');

              return (
                <div
                  key={q.id}
                  className={`p-4 sm:p-5 rounded-xl border transition-all ${
                    isResolved ? 'bg-emerald-50/20 border-emerald-200' : 'bg-slate-50 border-black/[0.12]'
                  }`}
                >
                  {/* Top Bar Question */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: q.user_color || '#4B5563' }}
                      >
                        {q.user_initials}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{q.user_name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                        isResolved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isResolved ? 'Résolue / Actée ✅' : 'À aborder'}
                      </span>

                      {!isReadOnly && (isAdmin || currentUser?.id === q.user_id) && (
                        <button
                          onClick={() => onUpdateQuestionStatus(q.id, isResolved ? 'open' : 'resolved')}
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            isResolved
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.25} />
                          {isResolved ? 'Réouvrir' : 'Clore'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Intitulé & détails */}
                  <h4 className={`text-sm sm:text-base font-bold text-slate-800 break-words ${isResolved ? 'text-slate-600' : ''}`}>
                    {q.title}
                  </h4>

                  {q.details && (
                    <p className="mt-2 text-xs sm:text-sm text-slate-600 bg-white p-3 rounded-lg border border-black/[0.12] leading-relaxed font-normal whitespace-pre-line break-words">
                      {q.details}
                    </p>
                  )}

                  {/* SECTION DES PROPOSITIONS DE RÉPONSES DU SPRINT */}
                  {answers.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-black/[0.12] space-y-2">
                      <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-500" strokeWidth={2.25} />
                        Propositions apportées pendant le sprint ({answers.length}) :
                      </span>

                      <div className="space-y-2">
                        {answers.map((ans) => (
                          <div
                            key={ans.id}
                            className="p-2.5 bg-white rounded-lg border border-black/[0.12] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[8px] text-white"
                                  style={{ backgroundColor: ans.user_color || '#4F46E5' }}
                                >
                                  {ans.user_initials}
                                </div>
                                <span className="font-bold text-slate-800 text-[11px]">{ans.user_name}</span>
                              </div>
                              <p className="text-slate-700 font-medium pl-5">{ans.content}</p>
                            </div>

                            {/* Bouton pour sélectionner cette proposition comme décision définitive */}
                            {canArbitrate && (
                              <button
                                type="button"
                                onClick={() => handleSelectPropositionAsDecision(q.id, ans.content)}
                                className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex items-center gap-1 transition-colors self-end sm:self-center shrink-0 cursor-pointer"
                                title="Retenir cette proposition comme décision finale"
                              >
                                <Sparkles className="w-3 h-3 text-indigo-500" strokeWidth={2.25} />
                                <span>Choisir comme décision</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SECTION DÉCISION DÉFINITIVE ACTÉE EN SÉANCE */}
                  <div className="mt-4 pt-3.5 border-t border-black/[0.12]">
                    {hasFinalAnswer && !isEditingDecision ? (
                      // Affichage de la décision actée
                      <div className="p-3.5 rounded-lg bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-300">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 text-xs font-black text-emerald-900 uppercase tracking-wide">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={2.25} />
                            <span>Décision finale actée en séance</span>
                          </div>
                          {canArbitrate && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDecisionForId(q.id);
                                setDecisionInputs(prev => ({ ...prev, [q.id]: q.final_answer || '' }));
                              }}
                              className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" strokeWidth={2} />
                              Modifier
                            </button>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-800 font-semibold pl-6 whitespace-pre-line">
                          {q.final_answer}
                        </p>
                        {q.answered_by_name && (
                          <p className="mt-1.5 text-[11px] text-slate-500 pl-6">
                            Acté par {q.answered_by_name} {q.answered_at ? `le ${new Date(q.answered_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}` : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      // Formulaire de saisie de la décision définitive
                      canArbitrate && (
                        <div className="p-3.5 rounded-lg bg-white border border-indigo-200 shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" strokeWidth={2.25} />
                              Apporter une réponse définitive à la question
                            </label>
                            {hasFinalAnswer && (
                              <button
                                type="button"
                                onClick={() => setEditingDecisionForId(null)}
                                className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                Annuler
                              </button>
                            )}
                          </div>

                          <textarea
                            rows={2}
                            placeholder="Saisissez la décision actée par les associés, ou cliquez sur 'Choisir comme décision' au-dessus..."
                            value={currentInput}
                            onChange={(e) => setDecisionInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                            className="w-full p-2.5 border border-black/[0.12] rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />

                          <div className="flex items-center justify-end gap-2">
                            {hasFinalAnswer && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm('Supprimer la décision finale et réouvrir cette question ?')) {
                                    await onSetQuestionDecision?.(q.id, '', 'open');
                                    setEditingDecisionForId(null);
                                  }
                                }}
                                className="px-3 py-2 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-xl cursor-pointer"
                              >
                                Supprimer la décision
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={!currentInput.trim() || isSubmittingDecision[q.id]}
                              onClick={() => handleSaveDecision(q.id)}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer transition-all"
                            >
                              <Check className="w-4 h-4" strokeWidth={2.25} />
                              <span>{isSubmittingDecision[q.id] ? 'Enregistrement...' : 'Acter la décision finale'}</span>
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ÉTAPE 3 : Plan d'Action & Tâches orphelines (Tâches au statut 'pending') */}
      {meetingStep === 'unassigned' && (
        <div className="space-y-5">
          {/* Sous-section 1 : Tâches non-attribuées (pending sans responsable) */}
          <div className="bg-white rounded-[32px] sm:rounded-[36px] p-5 sm:p-6 border border-amber-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/[0.12]">
              <div>
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-amber-600" strokeWidth={2.25} />
                  <span>Tâches non-attribuées</span>
                </h3>
                <p className="text-xs text-slate-500">
                  En attente d'un responsable (statut pending). Attribuez-les en un clic pour les planifier sur le Point {sprint.number + 1}.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
                  {pendingUnassigned.length} à attribuer
                </span>
                {!isReadOnly && currentUser?.role !== 'read' && onAddNewTask && sprint.status !== 'closed' && (
                  <button
                    type="button"
                    onClick={() => onAddNewTask(null)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                    <span>Nouvelle tâche en séance</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.5} />
              <span>
                <strong>À la clôture du sprint</strong> : si elles restent non attribuées, ces tâches seront déplacées vers le Point {sprint.number + 1} en conservant le statut <strong>pending</strong>.
              </span>
            </div>

            {pendingUnassigned.length > 0 ? (
              <div className="space-y-3">
                {pendingUnassigned.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <UserPlus className="w-3 h-3" strokeWidth={2.25} /> À attribuer
                        </span>

                        {t.property_name && (
                          <span
                            className="text-[11px] font-bold px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: t.property_color || '#3B82F6' }}
                          >
                            {t.property_name}
                          </span>
                        )}

                        {t.priority === 'high' && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            Urgent
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-slate-800 break-words">{t.title}</h4>
                      {t.description && (
                        <p className="text-xs text-slate-600 mt-1 break-words">
                          <span className="text-brand-600 font-bold mr-1">→</span>
                          {t.description}
                        </p>
                      )}
                      {t.subtasks && t.subtasks.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-2 border-l-2 border-amber-200">
                          {t.subtasks.map(st => (
                            <li key={st.id} className="text-[11px] text-slate-600 font-medium">
                              • {st.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                      {isAdmin && !isReadOnly && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-slate-500 mr-0.5">Attribuer :</span>
                          {users.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => onAssignTask(t.id, u.id)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-black/[0.12] text-slate-700 hover:border-black/[0.22] hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer"
                              title={`Attribuer à ${u.name}`}
                            >
                              <span
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                style={{ backgroundColor: u.avatar_color }}
                              >
                                {u.initials}
                              </span>
                              <span>{u.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {!isReadOnly && (t.can_edit || t.can_delete) && (
                        <div className="flex items-center gap-1 self-end sm:self-auto">
                          {t.can_edit && onAddNewTask && (
                            <button
                              type="button"
                              onClick={() => onAddNewTask(t)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                              title="Modifier cette tâche"
                            >
                              <Edit3 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          )}
                          {t.can_delete && onDeleteTask && (
                            <button
                              type="button"
                              onClick={() => onDeleteTask(t.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg cursor-pointer transition-colors"
                              title="Supprimer cette tâche"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-20 border-2 border-dashed border-amber-200/80 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium text-center px-4">
                Aucune tâche non attribuée en attente.
              </div>
            )}
          </div>

          {/* Sous-section 2 : Tâches attribuées (pending avec responsable, regroupées par associé) */}
          <div className="bg-white rounded-[32px] sm:rounded-[36px] p-5 sm:p-6 border border-violet-200/90 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-black/[0.12]">
              <div>
                <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-600" strokeWidth={2.25} />
                  <span>Tâches attribuées (Plan d'action Point {sprint.number + 1})</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Regroupées par associé. Elles passeront automatiquement en statut « À faire » avec le tag « Nouveau » lors de la clôture.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-violet-100 text-violet-800">
                  {pendingAssigned.length} planifiée{pendingAssigned.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {pendingAssigned.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {users.map((u) => {
                  const userPending = pendingAssigned.filter(t => t.assigned_to === u.id);
                  if (userPending.length === 0) return null;

                  return (
                    <div
                      key={u.id}
                      className="rounded-2xl border border-black/[0.12] bg-slate-50/70 p-4 space-y-3"
                    >
                      {/* En-tête du groupe associé */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-black/[0.12]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                            style={{ backgroundColor: u.avatar_color || '#2563EB' }}
                          >
                            {u.initials}
                          </div>
                          <h4 className="font-bold text-sm text-slate-800 truncate">{u.name}</h4>
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 shrink-0">
                          {userPending.length} tâche{userPending.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Liste des tâches attribuées à cet associé */}
                      <div className="space-y-2.5">
                        {userPending.map((t) => (
                          <div
                            key={t.id}
                            className="p-3 rounded-xl bg-white border border-black/[0.12] shadow-2xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5 text-violet-600" strokeWidth={2.25} />
                                  Nouveau (Point {sprint.number + 1})
                                </span>

                                {t.property_name && (
                                  <span
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                                    style={{ backgroundColor: t.property_color || '#3B82F6' }}
                                  >
                                    {t.property_name}
                                  </span>
                                )}

                                {t.priority === 'high' && (
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                    Urgent
                                  </span>
                                )}
                              </div>

                              {!isReadOnly && (t.can_edit || t.can_delete) && (
                                <div className="flex items-center gap-1 shrink-0">
                                  {t.can_edit && onAddNewTask && (
                                    <button
                                      type="button"
                                      onClick={() => onAddNewTask(t)}
                                      className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                                      title="Modifier cette tâche en attente"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                                    </button>
                                  )}
                                  {t.can_delete && onDeleteTask && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteTask(t.id)}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                      title="Supprimer cette tâche en attente"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            <h5 className="font-bold text-sm text-slate-800 break-words leading-snug">{t.title}</h5>

                            {t.description && (
                              <p className="text-xs text-slate-600 break-words">
                                <span className="text-brand-600 font-bold mr-1">→</span>
                                {t.description}
                              </p>
                            )}

                            {t.subtasks && t.subtasks.length > 0 && (
                              <ul className="space-y-1 pl-2 border-l-2 border-violet-200">
                                {t.subtasks.map(st => (
                                  <li key={st.id} className="text-[11px] text-slate-600 font-medium">
                                    • {st.title}
                                  </li>
                                ))}
                              </ul>
                            )}

                            {/* Réattribution / Retrait rapide (Admin) */}
                            {isAdmin && !isReadOnly && (
                              <div className="pt-2 border-t border-black/[0.12] flex items-center justify-between gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {users
                                    .filter(other => other.id !== u.id)
                                    .map(other => (
                                      <button
                                        key={other.id}
                                        type="button"
                                        onClick={() => onAssignTask(t.id, other.id)}
                                        className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-50 border border-black/[0.12] text-slate-700 hover:border-black/[0.22] hover:bg-slate-100 transition-colors cursor-pointer"
                                        title={`Réattribuer à ${other.name}`}
                                      >
                                        → {other.name}
                                      </button>
                                    ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onAssignTask(t.id, null)}
                                  className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                                  title="Retirer le responsable (renvoyer dans Tâches non-attribuées)"
                                >
                                  Retirer
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-20 border-2 border-dashed border-violet-200/80 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium text-center px-4">
                Aucune tâche attribuée en attente pour le prochain sprint.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
