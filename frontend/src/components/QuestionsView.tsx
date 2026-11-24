import React, { useState } from 'react';
import { Question, User, QuestionStatus } from '../types';
import { HelpCircle, Plus, Edit3, Trash2, CheckCircle2, MessageCircle, Clock, ShieldAlert, X } from 'lucide-react';

interface QuestionsViewProps {
  questions: Question[];
  users: User[];
  currentUser: User | null;
  sprintId: number;
  onAddQuestion: (data: { sprint_id: number; title: string; details?: string; user_id?: number }) => Promise<void>;
  onUpdateQuestion: (id: number, data: Partial<Question>) => Promise<void>;
  onDeleteQuestion: (id: number) => Promise<void>;
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
  isReadOnly
}) => {
  const [selectedUserFilter, setSelectedUserFilter] = useState<number | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [targetUserId, setTargetUserId] = useState<number>(currentUser?.id || 1);
  const [status, setStatus] = useState<QuestionStatus>('open');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const openCreateModal = () => {
    setEditingQuestion(null);
    setTitle('');
    setDetails('');
    setTargetUserId(currentUser?.id || 1);
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

  // Filtrage des questions
  const filteredQuestions = selectedUserFilter === 'all'
    ? questions
    : questions.filter(q => q.user_id === selectedUserFilter);

  // Regroupement par associé
  const usersWithQuestions = users.map(user => ({
    user,
    questions: filteredQuestions.filter(q => q.user_id === user.id)
  })).filter(group => selectedUserFilter === 'all' || group.user.id === selectedUserFilter);

  return (
    <div className="space-y-6">
      
      {/* Barre d'outils et Filtres par associé */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Filtres par personne */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">
            Filtrer par associé :
          </span>

          <button
            onClick={() => setSelectedUserFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedUserFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Toutes ({questions.length})
          </button>

          {users.map(u => {
            const count = questions.filter(q => q.user_id === u.id).length;
            const isSelected = selectedUserFilter === u.id;

            return (
              <button
                key={u.id}
                onClick={() => setSelectedUserFilter(u.id)}
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

        {/* Bouton d'ajout */}
        {!isReadOnly && currentUser?.role !== 'read' && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Poser une question
          </button>
        )}
      </div>

      {/* Colonnes par associé */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
        {usersWithQuestions.map(({ user, questions: userQuestions }) => (
          <div
            key={user.id}
            className="bg-slate-200/70 rounded-2xl p-4 border border-slate-300/80 flex flex-col min-h-[380px]"
          >
            {/* Header associé */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-300/70 mb-3">
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

              {!isReadOnly && (isAdmin || currentUser?.id === user.id) && (
                <button
                  onClick={() => {
                    setTargetUserId(user.id);
                    openCreateModal();
                  }}
                  className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-300/60 rounded-lg"
                  title={`Ajouter une question pour ${user.name}`}
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Liste des questions */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
              {userQuestions.length > 0 ? (
                userQuestions.map((q) => {
                  const isDone = q.status === 'resolved';

                  return (
                    <div
                      key={q.id}
                      className={`bg-white rounded-xl p-3.5 shadow-sm border transition-all ${
                        isDone ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200/90'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                          q.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : q.status === 'discussed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {q.status === 'resolved' ? 'Résolue' : q.status === 'discussed' ? 'En discussion' : 'À aborder'}
                        </span>

                        <div className="flex items-center gap-1">
                          {q.can_edit && (
                            <button
                              onClick={() => openEditModal(q)}
                              className="p-1 text-slate-400 hover:text-brand-600 rounded"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {q.can_delete && (
                            <button
                              onClick={() => onDeleteQuestion(q.id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h4 className={`text-xs font-semibold text-slate-800 leading-snug ${isDone ? 'line-through text-slate-400' : ''}`}>
                        {q.title}
                      </h4>

                      {q.details && (
                        <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed font-normal">
                          {q.details}
                        </p>
                      )}

                      {/* Bouton rapide de passage à résolu en réunion */}
                      {q.can_edit && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <button
                            onClick={() => onUpdateQuestion(q.id, {
                              status: q.status === 'resolved' ? 'open' : 'resolved'
                            })}
                            className={`flex items-center gap-1 font-medium transition-colors ${
                              q.status === 'resolved'
                                ? 'text-emerald-700 hover:text-emerald-900'
                                : 'text-slate-500 hover:text-emerald-700'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {q.status === 'resolved' ? 'Marquer à réaborder' : 'Marquer comme résolu'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="h-24 border-2 border-dashed border-slate-300/70 rounded-xl flex items-center justify-center text-xs text-slate-500 font-medium text-center p-2">
                  Aucune question inscrite
                </div>
              )}
            </div>

            {/* Bouton rapide bas */}
            {!isReadOnly && (isAdmin || currentUser?.id === user.id) && (
              <button
                onClick={() => {
                  setTargetUserId(user.id);
                  openCreateModal();
                }}
                className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-300/70 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une question
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal Créer / Modifier Question */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">
                  Sujet stratégique de réunion
                </span>
                <h3 className="text-lg font-bold">
                  {editingQuestion ? 'Modifier la question' : 'Nouvelle question'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white"
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
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
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Statut
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QuestionStatus)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white"
                >
                  <option value="open">À aborder</option>
                  <option value="discussed">En discussion</option>
                  <option value="resolved">Résolue / Actée</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-bold shadow-md shadow-brand-600/30"
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
