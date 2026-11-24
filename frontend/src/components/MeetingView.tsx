import React, { useState } from 'react';
import { Sprint, Task, Question, User, Property } from '../types';
import {
  Users, CheckCircle2, Clock, AlertTriangle, ArrowRight, UserPlus,
  HelpCircle, Shield, CheckSquare, Square, RefreshCw, Calendar, Sparkles
} from 'lucide-react';

interface MeetingViewProps {
  sprint: Sprint;
  tasks: Task[];
  questions: Question[];
  users: User[];
  currentUser: User | null;
  properties: Property[];
  onOpenCloseSprintModal: () => void;
  onUpdateTaskStatus: (taskId: number, status: Task['status']) => void;
  onAssignTask: (taskId: number, userId: number) => void;
  onToggleSubtask: (subtaskId: number) => void;
  onUpdateQuestionStatus: (questionId: number, status: Question['status']) => void;
  onEditTask: (task: Task) => void;
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
  onToggleSubtask,
  onUpdateQuestionStatus,
  onEditTask,
  isReadOnly
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [meetingStep, setMeetingStep] = useState<'retro' | 'questions' | 'unassigned'>('retro');

  // Séparation des tâches
  const unassignedTasks = tasks.filter(t => !t.assigned_to);
  const doneTasks = tasks.filter(t => t.status === 'done');
  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const openQuestions = questions.filter(q => q.status !== 'resolved');

  return (
    <div className="space-y-6">
      
      {/* Header spécial Réunion Hebdomadaire */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-xl border border-indigo-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider mb-2">
              <Users className="w-3.5 h-3.5" />
              Réunion hebdomadaire de l'équipe
            </div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
              {sprint.name}
              {isReadOnly && (
                <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-md font-bold border border-amber-500/30">
                  Sprint clôturé (Archive)
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Support interactif pour animer la réunion, ajuster les statuts en direct, attribuer les tâches orphelines et acter la bascule du sprint.
            </p>
          </div>

          {/* Bouton de Clôture / Bascule */}
          <div className="flex items-center gap-3 shrink-0">
            {isAdmin && !isReadOnly ? (
              <button
                onClick={onOpenCloseSprintModal}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-brand-600 hover:from-indigo-600 hover:to-brand-700 text-white font-bold text-sm shadow-xl shadow-brand-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <CheckCircle2 className="w-5 h-5 text-indigo-200" />
                Valider la réunion & Clôturer le sprint
              </button>
            ) : isReadOnly ? (
              <div className="text-xs text-slate-400 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700">
                🔒 Ce sprint a déjà été validé et archivé
              </div>
            ) : (
              <div className="text-xs text-slate-300 bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-purple-400" />
                Seul un administrateur peut clôturer le sprint
              </div>
            )}
          </div>
        </div>

        {/* Chiffres clés du sprint */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
            <span className="text-slate-400 font-medium">Tâches totales</span>
            <div className="text-lg font-bold text-white mt-0.5">{tasks.length}</div>
          </div>
          <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/40">
            <span className="text-emerald-400 font-medium">Tâches terminées ✅</span>
            <div className="text-lg font-bold text-emerald-300 mt-0.5">{doneTasks.length}</div>
          </div>
          <div className="bg-amber-950/40 p-3 rounded-xl border border-amber-800/40">
            <span className="text-amber-400 font-medium">En cours / À reporter 🚧</span>
            <div className="text-lg font-bold text-amber-300 mt-0.5">{pendingTasks.length}</div>
          </div>
          <div className="bg-purple-950/40 p-3 rounded-xl border border-purple-800/40">
            <span className="text-purple-400 font-medium">À attribuer en réunion</span>
            <div className="text-lg font-bold text-purple-300 mt-0.5">{unassignedTasks.length}</div>
          </div>
        </div>

      </div>

      {/* Barre d'étapes de la réunion */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-xs">
        <button
          onClick={() => setMeetingStep('retro')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            meetingStep === 'retro'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">1</span>
          Rétrospective par Associé
        </button>

        <button
          onClick={() => setMeetingStep('questions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            meetingStep === 'questions'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">2</span>
          Revue des Questions ({openQuestions.length})
        </button>

        <button
          onClick={() => setMeetingStep('unassigned')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            meetingStep === 'unassigned'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px]">3</span>
          Pool Tâches non attribuées ({unassignedTasks.length})
        </button>
      </div>

      {/* Contenu de l'étape active */}

      {/* 1. Rétrospective par associé */}
      {meetingStep === 'retro' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {users.map((user) => {
            const userTasks = tasks.filter(t => t.assigned_to === user.id);
            const userDone = userTasks.filter(t => t.status === 'done');
            const userPending = userTasks.filter(t => t.status !== 'done');

            return (
              <div
                key={user.id}
                className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col space-y-4"
              >
                {/* Entête Associé */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
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

                  <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-700">
                    {userPending.length} en cours
                  </span>
                </div>

                {/* Tâches de l'associé */}
                <div className="space-y-2.5 flex-1 max-h-[420px] overflow-y-auto pr-1">
                  {userTasks.length > 0 ? (
                    userTasks.map((t) => (
                      <div
                        key={t.id}
                        className={`p-3 rounded-xl border text-xs transition-all ${
                          t.status === 'done'
                            ? 'bg-emerald-50/40 border-emerald-200'
                            : t.status === 'blocked'
                            ? 'bg-red-50/40 border-red-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            {/* Toggle rapide statut en séance */}
                            {!isReadOnly && (isAdmin || currentUser?.id === user.id) ? (
                              <button
                                onClick={() => onUpdateTaskStatus(t.id, t.status === 'done' ? 'in_progress' : 'done')}
                                className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors shrink-0"
                                title="Marquer fait / en cours"
                              >
                                {t.status === 'done' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-slate-400" />
                                )}
                              </button>
                            ) : (
                              <span className="mt-0.5 shrink-0">
                                {t.status === 'done' ? '✅' : t.status === 'blocked' ? '❌' : '🚧'}
                              </span>
                            )}

                            <div>
                              <span className={`font-semibold text-slate-800 ${t.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                                {t.title}
                              </span>

                              {t.property_name && (
                                <span
                                  className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                                  style={{ backgroundColor: t.property_color || '#3B82F6' }}
                                >
                                  {t.property_name}
                                </span>
                              )}

                              {t.description && (
                                <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                                  <span className="text-brand-600 font-bold mr-1">→</span>
                                  {t.description}
                                </p>
                              )}

                              {/* Sous-tâches */}
                              {t.subtasks.length > 0 && (
                                <div className="mt-2 space-y-1 pl-1 border-l-2 border-slate-200">
                                  {t.subtasks.map((st) => (
                                    <div
                                      key={st.id}
                                      onClick={() => !isReadOnly && (isAdmin || currentUser?.id === user.id) && onToggleSubtask(st.id)}
                                      className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer hover:text-slate-900"
                                    >
                                      {st.is_done ? (
                                        <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      ) : (
                                        <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                      )}
                                      <span className={st.is_done ? 'line-through text-slate-400' : ''}>
                                        {st.title}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Statut sélecteur rapide pour la réunion */}
                          {!isReadOnly && (isAdmin || currentUser?.id === user.id) && (
                            <select
                              value={t.status}
                              onChange={(e) => onUpdateTaskStatus(t.id, e.target.value as Task['status'])}
                              className="text-[11px] font-semibold border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 cursor-pointer shrink-0"
                            >
                              <option value="todo">À faire</option>
                              <option value="in_progress">🚧 En cours</option>
                              <option value="blocked">❌ Bloqué</option>
                              <option value="done">✅ Fait</option>
                            </select>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-24 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium">
                      Aucune tâche attribuée pour ce sprint
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. Revue des questions */}
      {meetingStep === 'questions' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-800">Sujets stratégiques & Questions à aborder</h3>
              <p className="text-xs text-slate-500">Passez en revue chaque question soulevée par les associés pour la séance.</p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
              {openQuestions.length} restante{openQuestions.length > 1 ? 's' : ''} à traiter
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((q) => {
              const isResolved = q.status === 'resolved';

              return (
                <div
                  key={q.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isResolved ? 'bg-emerald-50/40 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                        style={{ backgroundColor: q.user_color || '#4B5563' }}
                      >
                        {q.user_initials}
                      </div>
                      <span className="text-xs font-bold text-slate-700">{q.user_name}</span>
                    </div>

                    {!isReadOnly && (isAdmin || currentUser?.id === q.user_id) && (
                      <button
                        onClick={() => onUpdateQuestionStatus(q.id, isResolved ? 'open' : 'resolved')}
                        className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                          isResolved
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isResolved ? 'Résolue ✅' : 'Acter / Résoudre'}
                      </button>
                    )}
                  </div>

                  <h4 className={`text-sm font-semibold text-slate-800 ${isResolved ? 'line-through text-slate-400' : ''}`}>
                    {q.title}
                  </h4>

                  {q.details && (
                    <p className="mt-2 text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60 leading-relaxed font-normal">
                      {q.details}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Pool des tâches non-attribuées */}
      {meetingStep === 'unassigned' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-base text-slate-800">Tâches orphelines à attribuer en réunion</h3>
              <p className="text-xs text-slate-500">
                L'administrateur peut attribuer ces tâches en un clic à l'associé qui s'en charge.
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
              {unassignedTasks.length} tâche{unassignedTasks.length > 1 ? 's' : ''} en attente
            </span>
          </div>

          <div className="space-y-3">
            {unassignedTasks.length > 0 ? (
              unassignedTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> À attribuer
                      </span>
                      {t.property_name && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: t.property_color || '#3B82F6' }}
                        >
                          {t.property_name}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm text-slate-800">{t.title}</h4>
                    {t.description && (
                      <p className="text-xs text-slate-600 mt-1">
                        <span className="text-brand-600 font-bold mr-1">→</span>
                        {t.description}
                      </p>
                    )}
                  </div>

                  {/* Boutons d'attribution rapide réservés à l'admin */}
                  {isAdmin && !isReadOnly ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500 mr-1">Attribuer à :</span>
                      {users.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => onAssignTask(t.id, u.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs hover:opacity-90 transition-opacity flex items-center gap-1.5"
                          style={{ backgroundColor: u.avatar_color }}
                        >
                          {u.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">
                      Attribution par l'administrateur
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="h-28 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400 font-medium">
                Aucune tâche orpheline dans le pool. Toutes les tâches ont un responsable !
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
