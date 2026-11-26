import React, { useState, useEffect, useRef } from 'react';
import { Question, QuestionStatus, User } from '../types';
import { QuestionModal } from './QuestionModal';
import { QUESTION_STATUS_META, formatQuestionDate } from '../utils/questions';
import {
  HelpCircle, Plus, Edit3, Trash2, CheckCircle2, Circle, MessageSquare,
  Send, UserCheck, ChevronDown, Search, X, ChevronsDownUp, ChevronsUpDown
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

type StatusFilter = 'active' | 'to_answer' | 'discussed' | 'resolved' | 'all';

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [presetUserId, setPresetUserId] = useState<number | undefined>(undefined);

  // Tiroirs de détails & réponses ouverts à la demande
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<{ [questionId: number]: boolean }>({});
  const [showResolvedSection, setShowResolvedSection] = useState(false);
  const [showResolvedInColumns, setShowResolvedInColumns] = useState<{ [key: string]: boolean }>({});

  // Brouillons de réponses collaboratives
  const [newAnswerText, setNewAnswerText] = useState<{ [questionId: number]: string }>({});
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [editingAnswerText, setEditingAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<{ [questionId: number]: boolean }>({});
  const answerInputRefs = useRef<{ [questionId: number]: HTMLInputElement | null }>({});

  const isAdmin = currentUser?.role === 'admin';
  const canWrite = !isReadOnly && currentUser?.role !== 'read';

  // Réinitialiser les brouillons et tiroirs lors d'un changement de sprint
  useEffect(() => {
    setExpandedQuestionIds({});
    setNewAnswerText({});
    setEditingAnswerId(null);
    setEditingAnswerText('');
    setSearchQuery('');
    setShowResolvedSection(false);
    setShowResolvedInColumns({});
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

  const toggleQuestionDrawer = (questionId: number, focusReplyInput: boolean = false) => {
    setExpandedQuestionIds(prev => {
      const nextOpen = !prev[questionId];
      if (nextOpen && focusReplyInput) {
        window.setTimeout(() => {
          answerInputRefs.current[questionId]?.focus();
        }, 40);
      }
      return { ...prev, [questionId]: nextOpen };
    });
  };

  const handleSendAnswer = async (questionId: number) => {
    const content = newAnswerText[questionId]?.trim();
    if (!content || !onAddAnswer) return;

    setIsSubmittingAnswer(prev => ({ ...prev, [questionId]: true }));
    try {
      await onAddAnswer(questionId, content);
      setNewAnswerText(prev => ({ ...prev, [questionId]: '' }));
      setExpandedQuestionIds(prev => ({ ...prev, [questionId]: true }));
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

  const needsMyOrAnyResponse = (q: Question) => {
    if (q.status === 'resolved') return false;
    const answers = q.answers || [];
    if (answers.length === 0) return true;
    return !!currentUser && !answers.some(a => a.user_id === currentUser.id) && q.user_id !== currentUser.id;
  };

  const matchesSearch = (q: Question, query: string) => {
    if (!query) return true;
    const needle = query.toLowerCase();
    return (
      q.title.toLowerCase().includes(needle) ||
      (q.details || '').toLowerCase().includes(needle) ||
      (q.final_answer || '').toLowerCase().includes(needle) ||
      (q.answers || []).some(a => a.content.toLowerCase().includes(needle))
    );
  };

  const matchesStatusFilter = (q: Question, filter: StatusFilter) => {
    switch (filter) {
      case 'active':
        return q.status !== 'resolved';
      case 'to_answer':
        return needsMyOrAnyResponse(q);
      case 'discussed':
        return q.status === 'discussed';
      case 'resolved':
        return q.status === 'resolved';
      default:
        return true;
    }
  };

  const cleanSearch = searchQuery.trim();

  // Questions filtrées par personne + recherche (avant filtre statut, pour calculer des compteurs cohérents)
  const personAndSearchQuestions = questions.filter(q => {
    const matchesAuthor =
      selectedFilter === 'all'
        ? true
        : selectedFilter === 'me'
        ? q.user_id === currentUser?.id
        : q.user_id === selectedFilter;
    return matchesAuthor && matchesSearch(q, cleanSearch);
  });

  const statusCounts = {
    active: personAndSearchQuestions.filter(q => q.status !== 'resolved').length,
    to_answer: personAndSearchQuestions.filter(needsMyOrAnyResponse).length,
    discussed: personAndSearchQuestions.filter(q => q.status === 'discussed').length,
    resolved: personAndSearchQuestions.filter(q => q.status === 'resolved').length,
    all: personAndSearchQuestions.length
  };

  const filteredQuestions = personAndSearchQuestions.filter(q => matchesStatusFilter(q, statusFilter));
  const activeListQuestions = filteredQuestions.filter(q => q.status !== 'resolved');
  const resolvedListQuestions = filteredQuestions.filter(q => q.status === 'resolved');

  const isSinglePersonFilter = selectedFilter === 'me' || typeof selectedFilter === 'number';
  const areAllExpanded =
    filteredQuestions.length > 0 && filteredQuestions.every(q => !!expandedQuestionIds[q.id]);

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedQuestionIds({});
    } else {
      const next: { [id: number]: boolean } = {};
      filteredQuestions.forEach(q => {
        next[q.id] = true;
      });
      setExpandedQuestionIds(next);
    }
  };

  // Groupes pour la vue « Toutes » (avec prise en charge d'éventuels anciens participants orphelins)
  const knownUserIds = new Set(users.map(u => u.id));
  const orphanAllQuestions = questions.filter(q => !knownUserIds.has(q.user_id));

  // Ligne/carte question ultra-compacte + tiroir dépliable à la demande
  const renderQuestionRow = (q: Question, isFullWidth: boolean) => {
    const isDone = q.status === 'resolved';
    const statusMeta = QUESTION_STATUS_META[q.status] || QUESTION_STATUS_META.open;
    const answers = q.answers || [];
    const isExpanded = !!expandedQuestionIds[q.id];
    const canModifyQuestion = !isReadOnly && !!q.can_edit && currentUser?.role !== 'read';
    const canDeleteQuestion = !isReadOnly && !!q.can_delete && currentUser?.role !== 'read';
    const canReply = canWrite && !!onAddAnswer;

    // Avatars uniques des répondants pour aperçu rapide même lorsque le tiroir est fermé
    const uniqueRespondents = Array.from(
      new Map(
        answers.map(a => [
          a.user_id ?? a.user_name ?? a.id,
          {
            initials: a.user_initials || '?',
            color: a.user_color || '#4F46E5',
            name: a.user_name || 'Associé'
          }
        ])
      ).values()
    ).slice(0, 3);

    const rowWrapperClass = isFullWidth
      ? `transition-colors ${isDone ? 'bg-emerald-50/15 hover:bg-emerald-50/30' : 'bg-white hover:bg-slate-50/70'}`
      : `rounded-[14px] border transition-colors overflow-hidden ${
          isDone
            ? 'bg-emerald-50/35 border-emerald-200/80'
            : 'bg-white border-black/[0.12] hover:border-black/[0.20]'
        }`;

    return (
      <article key={q.id} className={rowWrapperClass}>
        {/* Ligne compacte principale */}
        <div className="px-3 py-2.5 sm:px-3.5 sm:py-2.5 flex items-start gap-2">
          {/* Bouton bascule rapide résolue / à aborder */}
          {canModifyQuestion ? (
            <button
              type="button"
              aria-pressed={isDone}
              aria-label={isDone ? `Réouvrir : ${q.title}` : `Marquer comme résolue : ${q.title}`}
              title={isDone ? 'Réouvrir cette question' : 'Marquer comme résolue'}
              onClick={() => onUpdateQuestion(q.id, { status: isDone ? 'open' : 'resolved' })}
              className="-m-2 p-2.5 sm:-m-1 sm:p-1.5 min-w-[44px] min-h-[44px] sm:min-w-[30px] sm:min-h-[30px] flex items-center justify-center rounded-lg transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {isDone ? (
                <CheckCircle2 className="w-[18px] h-[18px] text-emerald-600" strokeWidth={2.25} />
              ) : (
                <Circle className="w-[18px] h-[18px] text-slate-400 hover:text-emerald-600" strokeWidth={1.85} />
              )}
            </button>
          ) : (
            <span className="mt-0.5 shrink-0" aria-hidden="true">
              {isDone ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={2.25} />
              ) : (
                <Circle className="w-4 h-4 text-slate-300" strokeWidth={1.75} />
              )}
            </span>
          )}

          {/* Contenu texte + actions */}
          <div className="flex-1 min-w-0">
            <div
              className={`flex ${
                isFullWidth
                  ? 'flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-3'
                  : 'flex-col gap-1.5'
              }`}
            >
              {/* Titre + aperçu ultra-compact lorsque fermé */}
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => toggleQuestionDrawer(q.id, answers.length === 0 && canReply)}
                  aria-expanded={isExpanded}
                  aria-controls={`question-drawer-${q.id}`}
                  className="text-left w-full group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md"
                >
                  <h4
                    className={`text-sm font-semibold leading-snug break-words ${
                      isDone
                        ? 'line-through text-slate-500'
                        : 'text-slate-800 group-hover:text-brand-700'
                    }`}
                  >
                    {q.title}
                  </h4>
                </button>

                {!isExpanded && q.details && (
                  <p className="mt-0.5 text-xs text-slate-600 line-clamp-1 break-words">
                    {q.details}
                  </p>
                )}

                {!isExpanded && q.final_answer && (
                  <p className="mt-1 inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-900 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" strokeWidth={2.25} />
                    <span className="truncate">
                      {!isDone ? 'Décision précédente : ' : ''}
                      {q.final_answer}
                    </span>
                  </p>
                )}
              </div>

              {/* Cluster droit compact : Statut (3 états) + Tiroir réponses + Modifier/Supprimer */}
              <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-1.5 shrink-0 flex-wrap">
                {canModifyQuestion ? (
                  <select
                    value={q.status}
                    aria-label={`Statut de la question : ${q.title}`}
                    onChange={(e) => onUpdateQuestion(q.id, { status: e.target.value as QuestionStatus })}
                    className={`text-[11px] font-bold px-1.5 sm:px-2 py-1 min-h-[30px] sm:min-h-[26px] rounded-lg border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${statusMeta.selectClass}`}
                  >
                    <option value="open">À aborder</option>
                    <option value="discussed">En discussion</option>
                    <option value="resolved">Résolue</option>
                  </select>
                ) : (
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md ${statusMeta.badgeClass}`}
                  >
                    {statusMeta.shortLabel}
                  </span>
                )}

                {/* Pilule Accordéon Réponses & Saisie */}
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`question-drawer-${q.id}`}
                  aria-label={`${isExpanded ? 'Masquer' : 'Afficher'} les détails et réponses (${answers.length}) pour : ${q.title}`}
                  onClick={() => toggleQuestionDrawer(q.id, answers.length === 0 && canReply)}
                  className={`inline-flex items-center gap-1 sm:gap-1.5 min-h-[30px] sm:min-h-[28px] px-2 py-1 rounded-lg text-[11px] sm:text-xs font-semibold border transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isExpanded
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : answers.length > 0
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-200/90 hover:bg-indigo-100'
                      : 'bg-slate-50 text-slate-600 border-black/[0.12] hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {uniqueRespondents.length > 0 && !isExpanded && (
                    <span className="hidden sm:inline-flex items-center -space-x-1 mr-0.5" aria-hidden="true">
                      {uniqueRespondents.map((r, i) => (
                        <span
                          key={`${r.name}-${i}`}
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-1 ring-white"
                          style={{ backgroundColor: r.color }}
                        >
                          {r.initials}
                        </span>
                      ))}
                    </span>
                  )}
                  <MessageSquare className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                  <span>{answers.length > 0 ? answers.length : canReply ? 'Répondre' : '0'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                    strokeWidth={2}
                  />
                </button>

                {/* Modifier / Supprimer */}
                {(canModifyQuestion || canDeleteQuestion) && (
                  <div className="flex items-center gap-0.5">
                    {canModifyQuestion && (
                      <button
                        type="button"
                        onClick={() => openEditModal(q)}
                        aria-label={`Modifier la question : ${q.title}`}
                        title="Modifier la question"
                        className="min-w-[30px] min-h-[30px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
                        className="min-w-[30px] min-h-[30px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tiroir dépliable à la demande (Détails, Décision, Propositions & Formulaire) */}
        {isExpanded && (
          <div
            id={`question-drawer-${q.id}`}
            className="mx-2.5 mb-2.5 sm:mx-3.5 sm:mb-3 p-2.5 sm:p-3 rounded-[10px] bg-slate-50/90 border border-black/[0.10] space-y-2.5"
          >
            {q.details && (
              <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed whitespace-pre-line break-words">
                {q.details}
              </p>
            )}

            {q.final_answer && (
              <div className="p-2.5 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900 flex-wrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" strokeWidth={2.25} />
                  <span>{isDone ? 'Décision actée en séance' : 'Décision précédente (à réaborder)'}</span>
                  {q.answered_by_name && (
                    <span className="font-normal text-[11px] text-emerald-800">
                      • {q.answered_by_name}
                      {q.answered_at ? ` (${formatQuestionDate(q.answered_at)})` : ''}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-slate-800 font-medium pl-5 whitespace-pre-line break-words">
                  {q.final_answer}
                </p>
              </div>
            )}

            {/* Liste compacte des propositions de réponses */}
            {answers.length > 0 && (
              <div className="space-y-1.5">
                {answers.map((ans) => {
                  const isEditingThis = editingAnswerId === ans.id;
                  const canEditAns = !isReadOnly && currentUser?.role !== 'read' && !!ans.can_edit;
                  const canDeleteAns = !isReadOnly && currentUser?.role !== 'read' && !!ans.can_delete;
                  const ansDate = formatQuestionDate(ans.created_at, true);

                  return (
                    <div
                      key={ans.id}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-black/[0.10] text-xs text-slate-700"
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
                            <p className="mt-0.5 pl-5 text-slate-700 leading-snug whitespace-pre-line break-words">
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
                                aria-label="Modifier ma proposition"
                                title="Modifier ma proposition"
                                className="min-w-[32px] min-h-[32px] sm:min-w-[26px] sm:min-h-[26px] flex items-center justify-center text-slate-500 hover:text-brand-700 hover:bg-slate-100 rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                              >
                                <Edit3 className="w-3 h-3" strokeWidth={1.75} />
                              </button>
                            )}
                            {canDeleteAns && onDeleteAnswer && (
                              <button
                                type="button"
                                onClick={() => onDeleteAnswer(ans.id)}
                                aria-label="Supprimer ma proposition"
                                title="Supprimer ma proposition"
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

            {/* Formulaire d'ajout de proposition (affiché uniquement lorsque le tiroir est déplié) */}
            {canReply && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  ref={(el) => {
                    answerInputRefs.current[q.id] = el;
                  }}
                  type="text"
                  aria-label={`Proposer une réponse à : ${q.title}`}
                  placeholder="Proposer une réponse..."
                  value={newAnswerText[q.id] || ''}
                  onChange={(e) => setNewAnswerText(prev => ({ ...prev, [q.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSendAnswer(q.id);
                    }
                  }}
                  className="flex-1 min-w-0 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 border border-black/[0.12] rounded-lg text-xs text-slate-800 placeholder:text-slate-500 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                />
                <button
                  type="button"
                  disabled={!newAnswerText[q.id]?.trim() || isSubmittingAnswer[q.id]}
                  onClick={() => handleSendAnswer(q.id)}
                  aria-label="Envoyer la proposition"
                  className="min-h-[40px] min-w-[40px] sm:min-h-[34px] px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-xs inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                  {isFullWidth && <span className="hidden sm:inline">Proposer</span>}
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  // Helper pour le rendu d'un groupe associé dans la vue « Toutes »
  const renderAssociateColumn = (
    groupKey: string,
    person: { id: number | string; name: string; initials: string; color: string; canQuickCreate: boolean; presetId?: number },
    rawQuestions: Question[]
  ) => {
    const visibleGroupQuestions = rawQuestions
      .filter(q => matchesSearch(q, cleanSearch))
      .filter(q => matchesStatusFilter(q, statusFilter));
    const groupActive = visibleGroupQuestions.filter(q => q.status !== 'resolved');
    const groupResolved = visibleGroupQuestions.filter(q => q.status === 'resolved');
    const showGroupResolved = statusFilter === 'resolved' || !!showResolvedInColumns[groupKey];

    return (
      <section
        key={groupKey}
        className="bg-slate-200/70 rounded-[24px] p-2.5 sm:p-3 border border-black/[0.12] flex flex-col space-y-2.5"
      >
        {/* Header associé compact */}
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
                {groupActive.length} à traiter
                {groupResolved.length > 0 ? ` · ${groupResolved.length} résolue${groupResolved.length > 1 ? 's' : ''}` : ''}
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

        {/* Liste des questions actives (ou résolues si filtre Résolues actif) */}
        {visibleGroupQuestions.length === 0 ? (
          <div className="py-2.5 px-3 border border-dashed border-black/[0.12] rounded-[14px] text-center text-xs text-slate-500 font-medium bg-white/40">
            {cleanSearch || statusFilter !== 'active'
              ? 'Aucune question pour ce filtre.'
              : 'Aucune question à traiter.'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {(statusFilter === 'resolved' ? groupResolved : groupActive).map(q =>
              renderQuestionRow(q, false)
            )}

            {statusFilter !== 'resolved' && groupResolved.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() =>
                    setShowResolvedInColumns(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
                  }
                  aria-expanded={showGroupResolved}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-[12px] bg-white/70 hover:bg-white border border-black/[0.10] text-xs font-semibold text-slate-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
                    <span>Résolues ({groupResolved.length})</span>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${showGroupResolved ? 'rotate-180' : ''}`}
                    strokeWidth={2}
                  />
                </button>

                {showGroupResolved && (
                  <div className="mt-1.5 space-y-1.5">
                    {groupResolved.map(q => renderQuestionRow(q, false))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    );
  };

  const singleFilterPersonName =
    selectedFilter === 'me'
      ? currentUser?.name
      : users.find(u => u.id === selectedFilter)?.name;

  return (
    <div className="space-y-4">
      {/* Barre d'outils & Filtres (compacte, tactile & responsive) */}
      <div className="bg-white p-2.5 sm:p-3.5 rounded-[22px] sm:rounded-[26px] border border-black/[0.12] shadow-xs space-y-2.5">
        {/* Ligne 1 : Filtres par personne + Bouton Poser une question */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div
            role="group"
            aria-label="Filtrer les questions par associé"
            className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-0.5 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span className="hidden md:inline text-[11px] font-bold text-slate-600 uppercase tracking-wider mr-1 shrink-0">
              Filtres :
            </span>

            {currentUser && (
              <button
                type="button"
                aria-pressed={selectedFilter === 'me'}
                onClick={() => setSelectedFilter('me')}
                className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
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
              className={`shrink-0 inline-flex items-center min-h-[40px] sm:min-h-[32px] px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
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
                    className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] sm:min-h-[32px] px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
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
              className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 min-h-[42px] sm:min-h-[34px] px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            >
              <Plus className="w-4 h-4 shrink-0" strokeWidth={2.25} />
              <span>Poser une question</span>
            </button>
          )}
        </div>

        {/* Ligne 2 : Filtres par statut + Recherche instantanée + Tout déplier/replier */}
        <div className="pt-2.5 border-t border-black/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div
            role="group"
            aria-label="Filtrer par avancement"
            className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap pb-0.5 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {(
              [
                { id: 'active', label: 'À traiter', count: statusCounts.active },
                { id: 'to_answer', label: 'Sans réponse', count: statusCounts.to_answer },
                { id: 'discussed', label: 'En discussion', count: statusCounts.discussed },
                { id: 'resolved', label: 'Résolues', count: statusCounts.resolved },
                { id: 'all', label: 'Toutes', count: statusCounts.all }
              ] as { id: StatusFilter; label: string; count: number }[]
            ).map((pill) => {
              const isSelected = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setStatusFilter(pill.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 min-h-[34px] sm:min-h-[28px] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
              <input
                type="text"
                aria-label="Rechercher une question ou réponse"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full min-h-[36px] sm:min-h-[30px] pl-8 pr-7 py-1 text-xs bg-slate-50 border border-black/[0.12] rounded-lg text-slate-800 placeholder:text-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3 h-3" strokeWidth={2} />
                </button>
              )}
            </div>

            {filteredQuestions.length > 1 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="inline-flex items-center gap-1 min-h-[36px] sm:min-h-[30px] px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                title={areAllExpanded ? 'Tout replier' : 'Tout déplier'}
              >
                {areAllExpanded ? (
                  <ChevronsDownUp className="w-3.5 h-3.5" strokeWidth={2} />
                ) : (
                  <ChevronsUpDown className="w-3.5 h-3.5" strokeWidth={2} />
                )}
                <span className="hidden sm:inline">{areAllExpanded ? 'Replier' : 'Déplier'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Contenu principal : Vue liste dense (1 personne) ou Grille 2 colonnes sans double scroll (« Toutes ») */}
      {isSinglePersonFilter ? (
        <div className="space-y-3">
          {filteredQuestions.length > 0 ? (
            <>
              {activeListQuestions.length > 0 && (
                <section aria-label="Questions à traiter" className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      {selectedFilter === 'me'
                        ? `Mes questions (${activeListQuestions.length})`
                        : `Questions de ${singleFilterPersonName || 'l’associé'} (${activeListQuestions.length})`}
                    </h3>
                  </div>

                  <div className="bg-white rounded-[22px] sm:rounded-[24px] border border-black/[0.12] shadow-xs overflow-hidden divide-y divide-black/[0.08]">
                    {activeListQuestions.map(q => renderQuestionRow(q, true))}
                  </div>
                </section>
              )}

              {resolvedListQuestions.length > 0 && (
                statusFilter === 'resolved' ? (
                  <section aria-label="Questions résolues" className="space-y-1.5">
                    <h3 className="px-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Résolues / Actées ({resolvedListQuestions.length})
                    </h3>
                    <div className="bg-white rounded-[22px] sm:rounded-[24px] border border-emerald-200 shadow-xs overflow-hidden divide-y divide-black/[0.08]">
                      {resolvedListQuestions.map(q => renderQuestionRow(q, true))}
                    </div>
                  </section>
                ) : (
                  <section aria-label="Questions résolues" className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setShowResolvedSection(prev => !prev)}
                      aria-expanded={showResolvedSection || activeListQuestions.length === 0}
                      className="w-full flex items-center justify-between px-4 py-2.5 rounded-[18px] bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200/90 text-xs font-bold text-emerald-900 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={2.25} />
                        <span>Résolues / Actées ({resolvedListQuestions.length})</span>
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-emerald-700 transition-transform duration-150 ${
                          showResolvedSection || activeListQuestions.length === 0 ? 'rotate-180' : ''
                        }`}
                        strokeWidth={2}
                      />
                    </button>

                    {(showResolvedSection || activeListQuestions.length === 0) && (
                      <div className="bg-white rounded-[22px] sm:rounded-[24px] border border-black/[0.12] shadow-xs overflow-hidden divide-y divide-black/[0.08]">
                        {resolvedListQuestions.map(q => renderQuestionRow(q, true))}
                      </div>
                    )}
                  </section>
                )
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl p-8 sm:p-10 text-center border border-black/[0.12] shadow-xs space-y-2.5">
              <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center mx-auto">
                <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                {cleanSearch || statusFilter !== 'active'
                  ? 'Aucune question correspondante'
                  : selectedFilter === 'me'
                  ? 'Aucune question à traiter'
                  : `Aucune question ouverte pour ${singleFilterPersonName || 'cet associé'}`}
              </h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                {cleanSearch || statusFilter !== 'active'
                  ? 'Modifiez les filtres ou la recherche pour afficher d’autres questions.'
                  : canWrite && (selectedFilter === 'me' || isAdmin)
                  ? 'Cliquez sur « Poser une question » pour ajouter un sujet pour la prochaine réunion.'
                  : 'Aucune question enregistrée sur ce sprint.'}
              </p>
              {(cleanSearch || statusFilter !== 'active') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Afficher toutes les questions
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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

      {/* Modal Créer / Modifier Question */}
      <QuestionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
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
