import React, { useState } from 'react';
import { Question, User, QuestionStatus } from '../types';
import {
  HelpCircle, Plus, Edit3, Trash2, CheckCircle2, MessageSquare,
  X, Send, UserCheck
} from 'lucide-react';

interface QuestionsViewProps {
  questions: Question[];
  users: User[];
  currentUser: User | null;
  sprintId: number;
  onAddQuestion: (data: { sprint_id: number; title: string; details?: string; user_id?: number }) => Promise<void>;
  onUpdateQuestion: (id: number, data: Partial<Question>) => Promise<void>;
  onDeleteQuestion: (id: number) => Promise<void>;
  onAddAnswer?: (questionId: number, content: string) => Promise<void>;
  onUpdateAnswer?: (answerId: number, content: string) => Promise<void>;
  onDeleteAnswer?: (answerId: number) => Promise<void>;
  isReadOnly: boolean;
}

export const QuestionsView: React.FC<QuestionsViewProps> = ({
  questions,
  users,
  currentUser,
  sprintId,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onAddAnswer,
  onUpdateAnswer,
  onDeleteAnswer,
  isReadOnly
}) => {
  // Par défaut, le filtre est sélectionné sur "Mes questions" ('me')
  const [selectedFilter, setSelectedFilter] = useState<'me' | 'all' | number>('me');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Form states pour la question
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [targetUserId, setTargetUserId] = useState<number>(currentUser?.id || 1);
  const [status, setStatus] = useState<QuestionStatus>('open');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State pour les réponses collaboratives (par question)
  const [newAnswerText, setNewAnswerText] = useState<{ [questionId: number]: string }>({});
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [editingAnswerText, setEditingAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<{ [questionId: number]: boolean }>({});

  const isAdmin = currentUser?.role === 'admin';

  const openCreateModal = (presetUserId?: number) => {
    setEditingQuestion(null);
    setTitle('');
    setDetails('');
    setTargetUserId(presetUserId || currentUser?.id || 1);
    setStatus('open');
    setIsModalOpen(true);
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setTitle(q.title);
    setDetails(q.details || '');
    setTargetUserId(q.user_id);
    setStatus(q.status);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingQuestion) {
        await onUpdateQuestion(editingQuestion.id, {
          title: title.trim(),
          details: details.trim(),
          status,
          user_id: isAdmin ? targetUserId : editingQuestion.user_id
        });
      } else {
        await onAddQuestion({
          sprint_id: sprintId,
          title: title.trim(),
          details: details.trim(),
          user_id: isAdmin ? targetUserId : currentUser?.id
        });
      }
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendAnswer = async (questionId: number) => {
    const content = newAnswerText[questionId]?.trim();
    if (!content || !onAddAnswer) return;

    setIsSubmittingAnswer(prev => ({ ...prev, [questionId]: true }));
    try {
      await onAddAnswer(questionId, content);
      setNewAnswerText(prev => ({ ...prev, [questionId]: '' }));
    } finally {
      setIsSubmittingAnswer(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSaveEditedAnswer = async (answerId: number) => {
    if (!editingAnswerText.trim() || !onUpdateAnswer) return;
    try {
      await onUpdateAnswer(answerId, editingAnswerText.trim());
      setEditingAnswerId(null);
      setEditingAnswerText('');
    } catch (e) {
      console.error(e);
    }
  };

  // Filtrage des questions
  const filteredQuestions = questions.filter(q => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'me') return q.user_id === currentUser?.id;
    if (typeof selectedFilter === 'number') return q.user_id === selectedFilter;
    return true;
  });

  // Est-ce un filtre sur une seule personne ? (« Mes questions » ou un utilisateur unique)
  const isSinglePersonFilter = selectedFilter === 'me' || typeof selectedFilter === 'number';

  // Regroupement par associé pour la vue en colonnes (quand "Toutes" est sélectionné)
  const usersWithQuestions = users.map(user => ({
    user,
    questions: questions.filter(q => q.user_id === user.id)
  }));

  // Composant Carte Question (partagé entre vue pleine largeur et vue colonnes)
  const renderQuestionCard = (q: Question, isFullWidth: boolean = false) => {
    const isDone = q.status === 'resolved';
    const answers = q.answers || [];
    const questionAuthor = users.find(u => u.id === q.user_id);

    return (
      <div
        key={q.id}
        className={`bg-white rounded-xl p-4 sm:p-5 shadow-xs border transition-all ${
          isDone ? 'border-emerald-200/90 bg-emerald-50/15' : 'border-black/[0.12]'
        } ${isFullWidth ? 'w-full' : ''}`}
      >
        {/* Entête Carte */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Statut Badge */}
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${
              q.status === 'resolved'
                ? 'bg-emerald-100 text-emerald-800'
                : q.status === 'discussed'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {q.status === 'resolved' ? 'Résolue / Actée' : q.status === 'discussed' ? 'En discussion' : 'À aborder'}
            </span>

            {/* Auteur si affichage pleine largeur */}
            {isFullWidth && questionAuthor && (
              <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md text-xs font-semibold text-slate-700">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ backgroundColor: questionAuthor.avatar_color }}
                >
                  {questionAuthor.initials}
                </div>
                <span>{questionAuthor.name}</span>
              </div>
            )}
          </div>

          {/* Boutons modifier / supprimer si l'utilisateur a les droits */}
          {!isReadOnly && (
            <div className="flex items-center gap-1">
              {q.can_edit && (
                <button
                  onClick={() => openEditModal(q)}
                  className="p-1.5 text-slate-400 hover:text-brand-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Modifier la question"
                >
                  <Edit3 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
              {q.can_delete && (
                <button
                  onClick={() => onDeleteQuestion(q.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                  title="Supprimer la question"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Titre */}
        <h4 className={`text-sm sm:text-base font-bold text-slate-800 leading-snug break-words ${isDone ? 'line-through text-slate-400' : ''}`}>
          {q.title}
        </h4>

        {/* Détails */}
        {q.details && (
          <p className="mt-2 text-xs sm:text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-black/[0.12] leading-relaxed font-normal whitespace-pre-line break-words">
            {q.details}
          </p>
        )}

        {/* Décision définitive actée en séance si présente */}
        {q.final_answer && (
          <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2.25} />
              <span>Décision actée en séance :</span>
            </div>
            <p className="text-slate-800 font-medium pl-5 whitespace-pre-line">
              {q.final_answer}
            </p>
            {q.answered_by_name && (
              <p className="mt-1.5 text-[11px] text-emerald-700/80 pl-5">
                Validé par {q.answered_by_name} {q.answered_at ? `le ${new Date(q.answered_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}` : ''}
              </p>
            )}
          </div>
        )}

        {/* Réponses collaboratives apportées pendant le sprint */}
        <div className="mt-4 pt-3 border-t border-black/[0.12] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" strokeWidth={2.25} />
              Propositions de réponses ({answers.length})
            </span>
          </div>

          {/* Liste des propositions */}
          {answers.length > 0 && (
            <div className="space-y-2">
              {answers.map(ans => {
                const isEditingThis = editingAnswerId === ans.id;

                return (
                  <div
                    key={ans.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-black/[0.12] text-xs text-slate-700 space-y-1.5 group/ans"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] text-white shadow-xs shrink-0"
                          style={{ backgroundColor: ans.user_color || '#4F46E5' }}
                        >
                          {ans.user_initials}
                        </div>
                        <span className="font-bold text-slate-800">{ans.user_name}</span>
                        {ans.created_at && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(ans.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Actions sur sa propre proposition */}
                      {ans.can_edit && !isEditingThis && !isReadOnly && (
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/ans:opacity-100 sm:transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAnswerId(ans.id);
                              setEditingAnswerText(ans.content);
                            }}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded cursor-pointer"
                            title="Modifier ma proposition"
                          >
                            <Edit3 className="w-3 h-3" strokeWidth={1.75} />
                          </button>
                          {ans.can_delete && onDeleteAnswer && (
                            <button
                              type="button"
                              onClick={() => onDeleteAnswer(ans.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              title="Supprimer ma proposition"
                            >
                              <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditingThis ? (
                      <div className="mt-1 space-y-2">
                        <textarea
                          rows={2}
                          value={editingAnswerText}
                          onChange={(e) => setEditingAnswerText(e.target.value)}
                          className="w-full p-2 border border-brand-300 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 bg-white"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingAnswerId(null)}
                            className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700 cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditedAnswer(ans.id)}
                            className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                          >
                            Enregistrer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="leading-relaxed whitespace-pre-line pl-7 text-slate-700 font-medium break-words">
                        {ans.content}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Formulaire pour apporter une proposition de réponse (tout associé) */}
          {!isReadOnly && currentUser?.role !== 'read' && onAddAnswer && (
            <div className="pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Proposer une réponse..."
                  value={newAnswerText[q.id] || ''}
                  onChange={(e) => setNewAnswerText({ ...newAnswerText, [q.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendAnswer(q.id);
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-black/[0.12] rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none bg-slate-50/50 hover:bg-white focus:bg-white transition-all"
                />
                <button
                  type="button"
                  disabled={!newAnswerText[q.id]?.trim() || isSubmittingAnswer[q.id]}
                  onClick={() => handleSendAnswer(q.id)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-3.5 h-3.5" strokeWidth={2.25} />
                  <span>Proposer</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bouton rapide de passage à résolu en réunion */}
        {q.can_edit && !isReadOnly && (
          <div className="mt-3 pt-2.5 border-t border-black/[0.12] flex items-center justify-between text-[11px]">
            <button
              onClick={() => onUpdateQuestion(q.id, {
                status: q.status === 'resolved' ? 'open' : 'resolved'
              })}
              className={`flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
                q.status === 'resolved'
                  ? 'text-emerald-700 hover:text-emerald-900'
                  : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
              {q.status === 'resolved' ? 'Marquer à réaborder' : 'Marquer comme résolu'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Barre d'outils et Filtres */}
      <div className="bg-white p-3.5 sm:p-4 rounded-[26px] sm:rounded-[28px] border border-black/[0.12] shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Filtres par personne */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            Filtres :
          </span>

          {/* 1. Mes questions (DEFAULT) */}
          {currentUser && (
            <button
              onClick={() => setSelectedFilter('me')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedFilter === 'me'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" strokeWidth={2.25} />
              Mes questions ({questions.filter(q => q.user_id === currentUser.id).length})
            </button>
          )}

          {/* 2. Toutes */}
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Toutes ({questions.length})
          </button>

          {/* 3. Filtre par les autres associés */}
          {users
            .filter(u => u.id !== currentUser?.id)
            .map(u => {
              const count = questions.filter(q => q.user_id === u.id).length;
              const isSelected = selectedFilter === u.id;

              return (
                <button
                  key={u.id}
                  onClick={() => setSelectedFilter(u.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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

        {/* Bouton d'ajout */}
        {!isReadOnly && currentUser?.role !== 'read' && (
          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Poser une question
          </button>
        )}
      </div>

      {/* AFFICHAGE DES QUESTIONS :
          - Si filtre sélectionné sur 1 personne (« Mes questions » ou 1 associé) => PLEINE LARGEUR pour visibilité optimale
          - Si filtre sélectionné sur « Toutes » => GRILLE multi-colonnes par associé
      */}
      {isSinglePersonFilter ? (
        // VUE PLEINE LARGEUR (Visibilité maximale)
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              {selectedFilter === 'me'
                ? `Mes questions posées (${filteredQuestions.length})`
                : `Questions de ${users.find(u => u.id === selectedFilter)?.name} (${filteredQuestions.length})`}
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Format élargi pour lecture & propositions
            </span>
          </div>

          {filteredQuestions.length > 0 ? (
            <div className="space-y-4">
              {filteredQuestions.map(q => renderQuestionCard(q, true))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-12 text-center border border-black/[0.12] shadow-xs space-y-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                <HelpCircle className="w-6 h-6" strokeWidth={1.75} />
              </div>
              <h4 className="font-bold text-slate-800 text-base">Aucune question inscrite</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Vous n'avez pas encore posé de question pour ce sprint. Cliquez sur « Poser une question » pour lancer une discussion.
              </p>
              {!isReadOnly && currentUser?.role !== 'read' && (
                <button
                  onClick={() => openCreateModal()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" strokeWidth={2.25} />
                  Poser une question
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        // VUE EN COLONNES PAR ASSOCIÉ (« Toutes »)
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {usersWithQuestions.map(({ user, questions: userQuestions }) => (
            <div
              key={user.id}
              className="bg-slate-200/70 rounded-[28px] p-4 border border-black/[0.12] flex flex-col min-h-[380px]"
            >
              {/* Header associé */}
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.12] mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs"
                    style={{ backgroundColor: user.avatar_color }}
                  >
                    {user.initials}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 leading-none">{user.name}</h3>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {userQuestions.length} question{userQuestions.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {!isReadOnly && currentUser?.role !== 'read' && (isAdmin || currentUser?.id === user.id) && (
                  <button
                    onClick={() => openCreateModal(user.id)}
                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-300/60 rounded-lg cursor-pointer"
                    title={`Ajouter une question pour ${user.name}`}
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                )}
              </div>

              {/* Liste des questions */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1">
                {userQuestions.length > 0 ? (
                  userQuestions.map(q => renderQuestionCard(q, false))
                ) : (
                  <div className="h-24 border-2 border-dashed border-black/[0.12] rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium text-center p-2">
                    Aucune question inscrite
                  </div>
                )}
              </div>

              {/* Bouton rapide bas */}
              {!isReadOnly && currentUser?.role !== 'read' && (isAdmin || currentUser?.id === user.id) && (
                <button
                  onClick={() => openCreateModal(user.id)}
                  className="mt-3 w-full py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-300/70 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  Ajouter une question
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Créer / Modifier Question */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-black/[0.12] overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                  Sujet stratégique de réunion
                </span>
                <h3 className="text-lg font-bold">
                  {editingQuestion ? 'Modifier la question' : 'Nouvelle question'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {isAdmin && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Associé concerné
                  </label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-black/[0.12] rounded-lg text-sm text-slate-800 bg-white cursor-pointer"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Intitulé de la question *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Choix du prestataire serrurerie, point avec Asma..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Détails & arguments à aborder
                </label>
                <textarea
                  rows={3}
                  placeholder="Précisions pour la discussion en séance..."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full p-2.5 border border-black/[0.12] rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Statut
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QuestionStatus)}
                  className="w-full px-3 py-2 border border-black/[0.12] rounded-lg text-sm text-slate-800 bg-white cursor-pointer"
                >
                  <option value="open">À aborder</option>
                  <option value="discussed">En discussion</option>
                  <option value="resolved">Résolue / Actée</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-black/[0.12]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold shadow-md shadow-brand-600/30 cursor-pointer"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
