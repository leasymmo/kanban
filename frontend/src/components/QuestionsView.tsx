import React, { useState, useEffect } from 'react';
import { Question, User } from '../types';
import { QuestionModal } from './QuestionModal';
import { formatQuestionDate, hasFinalDecision } from '../utils/questions';
import {
  HelpCircle, Plus, Edit3, Trash2, CheckCircle2, Send, UserCheck
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
  const [selectedFilter, setSelectedFilter] = useState<'me' | 'all' | number>('me');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [presetUserId, setPresetUserId] = useState<number | undefined>(undefined);

  // Brouillons de réponse (1 réponse max par associé et par question, facultative)
  const [newAnswerText, setNewAnswerText] = useState<{ [questionId: number]: string }>({});
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [editingAnswerText, setEditingAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<{ [questionId: number]: boolean }>({});

  const isAdmin = currentUser?.role === 'admin';
  const canWrite = !isReadOnly && currentUser?.role !== 'read';

  // Réinitialiser les brouillons lors d'un changement de sprint
  useEffect(() => {
    setNewAnswerText({});
    setEditingAnswerId(null);
    setEditingAnswerText('');
  }, [sprintId]);

  // Revenir sur "Mes questions" si l'associé filtré a été supprimé
  useEffect(() => {
    if (typeof selectedFilter === 'number' && !users.some(u => u.id === selectedFilter)) {
      setSelectedFilter('me');
    }
  }, [users, selectedFilter]);

  const openCreateModal = (userId?: number) => {
    setEditingQuestion(null);
    setPresetUserId(userId);
    setIsModalOpen(true);
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setPresetUserId(undefined);
    setIsModalOpen(true);
  };

  const handleSendAnswer = async (questionId: number) => {
    const content = newAnswerText[questionId]?.trim();
    if (!content || !onAddAnswer) return;

    setIsSubmittingAnswer(prev => ({ ...prev, [questionId]: true }));
    try {
      await onAddAnswer(questionId, content);
      setNewAnswerText(prev => ({ ...prev, [questionId]: '' }));
    } catch {
      // Erreur gérée par la notification globale ; le brouillon est conservé
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
    } catch {
      // Erreur gérée par la notification globale ; l'édition reste ouverte
    }
  };

  const isSinglePersonFilter = selectedFilter === 'me' || typeof selectedFilter === 'number';

  const visibleListQuestions = questions.filter(q => {
    if (selectedFilter === 'me') return q.user_id === currentUser?.id;
    if (typeof selectedFilter === 'number') return q.user_id === selectedFilter;
    return true;
  });

  const knownUserIds = new Set(users.map(u => u.id));
  const orphanAllQuestions = questions.filter(q => !knownUserIds.has(q.user_id));

  const renderQuestionCard = (q: Question, isFullWidth: boolean) => {
    const hasDecision = hasFinalDecision(q);
    const answers = q.answers || [];
    const myAnswer = currentUser ? answers.find(a => a.user_id === currentUser.id) : undefined;
    const otherAnswers = myAnswer ? answers.filter(a => a.id !== myAnswer.id) : answers;
    const orderedAnswers = myAnswer ? [myAnswer, ...otherAnswers] : answers;

    const canModifyQuestion = !isReadOnly && !!q.can_edit && currentUser?.role !== 'read';
    const canDeleteQuestion = !isReadOnly && !!q.can_delete && currentUser?.role !== 'read';
    const canReply = canWrite && !!onAddAnswer && !myAnswer;
    const hasAnswersSection = orderedAnswers.length > 0 || canReply;

    return (
      <article
        key={q.id}
        className={`bg-white border border-black/[0.12] shadow-xs transition-colors space-y-2.5 ${
          isFullWidth
            ? 'rounded-[18px] sm:rounded-[20px] p-3.5 sm:p-4'
            : 'rounded-[14px] p-3'
        } ${hasDecision ? 'border-emerald-300/80 bg-emerald-50/20' : ''}`}
      >
        {/* Question + Détail de la question */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <h4 className="text-sm sm:text-[15px] font-bold leading-snug text-slate-900 break-words">
              {q.title}
            </h4>

            {q.details && (
              <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed whitespace-pre-line break-words pl-2.5 border-l-2 border-slate-200">
                {q.details}
              </p>
            )}
          </div>

          {(canModifyQuestion || canDeleteQuestion) && (
            <div className="flex items-center gap-0.5 shrink-0">
              {canModifyQuestion && (
                <button
                  type="button"
                  onClick={() => openEditModal(q)}
                  aria-label={`Modifier la question : ${q.title}`}
                  title="Modifier la question"
                  className="min-w-[34px] min-h-[34px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
              {canDeleteQuestion && (
                <button
                  type="button"
                  onClick={() => onDeleteQuestion(q.id)}
                  aria-label={`Supprimer la question : ${q.title}`}
                  title="Supprimer la question"
                  className="min-w-[34px] min-h-[34px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Réponse définitive actée en réunion (si présente) */}
        {hasDecision && (
          <div className="px-3 py-2 rounded-[10px] bg-emerald-50/90 border border-emerald-200 border-l-4 border-l-emerald-600 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-emerald-950">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" strokeWidth={2.25} />
              <span>Réponse définitive</span>
            </div>
            <p className="mt-0.5 text-slate-900 font-medium pl-5 whitespace-pre-line break-words leading-relaxed">
              {q.final_answer}
            </p>
          </div>
        )}

        {/* Réponses éventuelles + saisie facultative (toujours visible) */}
        {hasAnswersSection && (
          <div className="pt-2.5 border-t border-black/[0.08] space-y-2">
            {orderedAnswers.length > 0 && (
              <div className="space-y-1.5">
                {orderedAnswers.map((ans) => {
                  const isMine = !!currentUser && ans.user_id === currentUser.id;
                  const isEditingThis = editingAnswerId === ans.id;
                  const canEditAns = !isReadOnly && currentUser?.role !== 'read' && !!ans.can_edit;
                  const canDeleteAns = !isReadOnly && currentUser?.role !== 'read' && !!ans.can_delete;
                  const ansDate = formatQuestionDate(ans.created_at, true);

                  return (
                    <div
                      key={ans.id}
                      className={`px-2.5 py-2 rounded-[10px] border text-xs ${
                        isMine
                          ? 'bg-indigo-50/50 border-indigo-200/90 text-slate-800'
                          : 'bg-slate-50/80 border-black/[0.08] text-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="w-4 h-4 rounded-full inline-flex items-center justify-center font-bold text-[8px] text-white shrink-0"
                              style={{ backgroundColor: ans.user_color || '#4F46E5' }}
                            >
                              {ans.user_initials || '?'}
                            </span>
                            <span className="font-bold text-slate-800">{ans.user_name || 'Ancien associé'}</span>
                            {ansDate && <span className="text-[10px] text-slate-500">{ansDate}</span>}
                          </div>

                          {isEditingThis ? (
                            <div className="mt-1.5 space-y-1.5">
                              <textarea
                                rows={2}
                                autoFocus
                                value={editingAnswerText}
                                onChange={(e) => setEditingAnswerText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    setEditingAnswerId(null);
                                  } else if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSaveEditedAnswer(ans.id);
                                  }
                                }}
                                className="w-full p-2 border border-brand-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingAnswerId(null)}
                                  className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  disabled={!editingAnswerText.trim()}
                                  onClick={() => handleSaveEditedAnswer(ans.id)}
                                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-md text-[11px] font-semibold cursor-pointer"
                                >
                                  Enregistrer
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 pl-5 text-slate-700 leading-snug whitespace-pre-line break-words">
                              {ans.content}
                            </p>
                          )}
                        </div>

                        {!isEditingThis && (canEditAns || canDeleteAns) && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            {canEditAns && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAnswerId(ans.id);
                                  setEditingAnswerText(ans.content);
                                }}
                                aria-label="Modifier la réponse"
                                title="Modifier la réponse"
                                className="min-w-[32px] min-h-[32px] sm:min-w-[26px] sm:min-h-[26px] flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-white rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                              >
                                <Edit3 className="w-3 h-3" strokeWidth={1.75} />
                              </button>
                            )}
                            {canDeleteAns && onDeleteAnswer && (
                              <button
                                type="button"
                                onClick={() => onDeleteAnswer(ans.id)}
                                aria-label="Supprimer la réponse"
                                title="Supprimer la réponse"
                                className="min-w-[32px] min-h-[32px] sm:min-w-[26px] sm:min-h-[26px] flex items-center justify-center text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                              >
                                <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canReply && (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label={`Répondre à : ${q.title}`}
                  placeholder="Ajouter une réponse (facultatif)..."
                  value={newAnswerText[q.id] || ''}
                  onChange={(e) => setNewAnswerText(prev => ({ ...prev, [q.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendAnswer(q.id);
                    }
                  }}
                  className="flex-1 min-w-0 min-h-[38px] sm:min-h-[34px] px-3 py-1.5 border border-black/[0.12] rounded-lg text-xs text-slate-800 placeholder:text-slate-500 bg-slate-50/70 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                />
                <button
                  type="button"
                  disabled={!newAnswerText[q.id]?.trim() || isSubmittingAnswer[q.id]}
                  onClick={() => handleSendAnswer(q.id)}
                  aria-label="Envoyer la réponse"
                  className="min-h-[38px] min-w-[38px] sm:min-h-[34px] px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                  {isFullWidth && <span className="hidden sm:inline">Répondre</span>}
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  const renderAssociateColumn = (
    groupKey: string,
    person: { id: number | string; name: string; initials: string; color: string; canQuickCreate: boolean; presetId?: number },
    groupQuestions: Question[]
  ) => (
    <section
      key={groupKey}
      className="bg-slate-200/70 rounded-[24px] p-2.5 sm:p-3 border border-black/[0.12] flex flex-col gap-2.5"
    >
      <div className="flex items-center justify-between gap-2 pb-2 px-1 border-b border-black/[0.12]">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
            style={{ backgroundColor: person.color }}
          >
            {person.initials}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-800 leading-tight truncate">{person.name}</h3>
            <p className="text-[11px] text-slate-600 font-medium">
              {groupQuestions.length} question{groupQuestions.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {person.canQuickCreate && (
          <button
            type="button"
            onClick={() => openCreateModal(person.presetId)}
            aria-label={`Ajouter une question pour ${person.name}`}
            title={`Ajouter une question pour ${person.name}`}
            className="min-w-[36px] min-h-[36px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-300/60 rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>

      {groupQuestions.length === 0 ? (
        <div className="py-2.5 px-3 border border-dashed border-black/[0.12] rounded-[14px] text-center text-xs text-slate-500 font-medium bg-white/40">
          Aucune question.
        </div>
      ) : (
        <div className="space-y-2.5">
          {groupQuestions.map(q => renderQuestionCard(q, true))}
        </div>
      )}
    </section>
  );

  const singleFilterPersonName =
    selectedFilter === 'me'
      ? currentUser?.name
      : users.find(u => u.id === selectedFilter)?.name;

  return (
    <div className="space-y-4">
      {/* Barre supérieure épurée : Filtres par associé + Ajout de question */}
      <div className="bg-white p-2.5 sm:p-3.5 rounded-[22px] sm:rounded-[26px] border border-black/[0.12] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div
          role="group"
          aria-label="Filtrer les questions par associé"
          className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-0.5 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {currentUser && (
            <button
              type="button"
              aria-pressed={selectedFilter === 'me'}
              onClick={() => setSelectedFilter('me')}
              className={`shrink-0 inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                selectedFilter === 'me'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-brand-50 text-brand-800 hover:bg-brand-100'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
              <span>Mes questions ({questions.filter(q => q.user_id === currentUser.id).length})</span>
            </button>
          )}

          <button
            type="button"
            aria-pressed={selectedFilter === 'all'}
            onClick={() => setSelectedFilter('all')}
            className={`shrink-0 inline-flex items-center min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              selectedFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Toutes ({questions.length})
          </button>

          {users
            .filter(u => u.id !== currentUser?.id)
            .map(u => {
              const count = questions.filter(q => q.user_id === u.id).length;
              const isSelected = selectedFilter === u.id;

              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedFilter(u.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isSelected
                      ? 'text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  style={isSelected ? { backgroundColor: u.avatar_color } : undefined}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: u.avatar_color }}
                  >
                    {u.initials}
                  </span>
                  <span>{u.name} ({count})</span>
                </button>
              );
            })}
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() =>
              openCreateModal(typeof selectedFilter === 'number' && isAdmin ? selectedFilter : undefined)
            }
            className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
          >
            <Plus className="w-4 h-4 shrink-0" strokeWidth={2.25} />
            <span>Poser une question</span>
          </button>
        )}
      </div>

      {/* Liste des questions (toujours dépliées) ou grille 2 colonnes (« Toutes ») */}
      {isSinglePersonFilter ? (
        visibleListQuestions.length > 0 ? (
          <div className="space-y-3">
            {visibleListQuestions.map(q => renderQuestionCard(q, true))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border border-black/[0.12] shadow-xs space-y-2.5">
            <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
              <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <h4 className="font-bold text-slate-800 text-sm sm:text-base">
              {selectedFilter === 'me'
                ? 'Aucune question posée pour le moment'
                : `Aucune question pour ${singleFilterPersonName || 'cet associé'}`}
            </h4>
            {canWrite && (selectedFilter === 'me' || isAdmin) && (
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Cliquez sur « Poser une question » pour ajouter un sujet à aborder lors de la prochaine réunion.
              </p>
            )}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {users.map((user) =>
            renderAssociateColumn(
              `user-${user.id}`,
              {
                id: user.id,
                name: user.name,
                initials: user.initials,
                color: user.avatar_color,
                canQuickCreate: canWrite && (isAdmin || currentUser?.id === user.id),
                presetId: user.id
              },
              questions.filter(q => q.user_id === user.id)
            )
          )}

          {orphanAllQuestions.length > 0 &&
            renderAssociateColumn(
              'orphans',
              {
                id: 'orphans',
                name: 'Anciens participants',
                initials: '?',
                color: '#64748B',
                canQuickCreate: false
              },
              orphanAllQuestions
            )}
        </div>
      )}

      {/* Modale d'ajout / édition de question */}
      <QuestionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingQuestion(null);
        }}
        sprintId={sprintId}
        users={users}
        currentUser={currentUser}
        editingQuestion={editingQuestion}
        initialUserId={presetUserId}
        onAddQuestion={onAddQuestion}
        onUpdateQuestion={onUpdateQuestion}
      />
    </div>
  );
};
