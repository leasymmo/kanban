import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Question, User } from '../types';
import { QuestionModal } from './QuestionModal';
import { Avatar, Button } from './ui';
import { formatQuestionDate } from '../utils/questions';
import { ensureWhiteTextContrast } from '../utils/color';
import {
  HelpCircle, Plus, Edit3, Trash2, Send, UserCheck
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

interface QuestionCardProps {
  question: Question;
  currentUser: User | null;
  canWrite: boolean;
  isReadOnly: boolean;
  newAnswerDraft: string;
  isSubmittingAnswer: boolean;
  editingAnswerId: number | null;
  editingAnswerText: string;
  onEditQuestion: (q: Question) => void;
  onDeleteQuestion: (id: number) => Promise<void>;
  onChangeNewAnswerDraft: (questionId: number, value: string) => void;
  onSendAnswer: (questionId: number) => void;
  onStartEditAnswer: (answerId: number, content: string) => void;
  onChangeEditAnswerText: (value: string) => void;
  onCancelEditAnswer: () => void;
  onSaveEditedAnswer: (answerId: number) => void;
  onDeleteAnswer?: (answerId: number) => Promise<void>;
  hasAddAnswerHandler: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = React.memo(({
  question: q,
  currentUser,
  canWrite,
  isReadOnly,
  newAnswerDraft,
  isSubmittingAnswer,
  editingAnswerId,
  editingAnswerText,
  onEditQuestion,
  onDeleteQuestion,
  onChangeNewAnswerDraft,
  onSendAnswer,
  onStartEditAnswer,
  onChangeEditAnswerText,
  onCancelEditAnswer,
  onSaveEditedAnswer,
  onDeleteAnswer,
  hasAddAnswerHandler,
}) => {
  const answers = q.answers || [];
  const myAnswer = currentUser ? answers.find((a) => a.user_id === currentUser.id) : undefined;
  const otherAnswers = myAnswer ? answers.filter((a) => a.id !== myAnswer.id) : answers;
  const orderedAnswers = myAnswer ? [myAnswer, ...otherAnswers] : answers;

  const canModifyQuestion = !isReadOnly && !!q.can_edit && currentUser?.role !== 'read';
  const canDeleteQuestion = !isReadOnly && !!q.can_delete && currentUser?.role !== 'read';
  const canReply = canWrite && hasAddAnswerHandler && !myAnswer;
  const hasAnswersSection = orderedAnswers.length > 0 || canReply;

  return (
    <article className="cdh-surface-card rounded-[18px] sm:rounded-[20px] p-3.5 sm:p-4 transition-colors space-y-2.5">
      {/* Question + Détail de la question */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h4 className="text-sm sm:text-[15px] font-bold leading-snug text-[var(--cdh-text-primary)] break-words">
            {q.title}
          </h4>

          {q.details && (
            <p className="text-xs sm:text-[13px] text-[var(--cdh-text-secondary)] leading-relaxed whitespace-pre-line break-words pl-2.5 border-l-2 border-[var(--cdh-border-subtle)]">
              {q.details}
            </p>
          )}
        </div>

        {(canModifyQuestion || canDeleteQuestion) && (
          <div className="flex items-center gap-0.5 shrink-0">
            {canModifyQuestion && (
              <button
                type="button"
                onClick={() => onEditQuestion(q)}
                aria-label={`Modifier la question : ${q.title}`}
                title="Modifier la question"
                className="min-w-[34px] min-h-[34px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] hover:bg-[var(--cdh-surface-control)] rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)]"
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
                className="min-w-[34px] min-h-[34px] sm:min-w-[28px] sm:min-h-[28px] flex items-center justify-center text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-danger)] hover:bg-[var(--cdh-danger-soft)] rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-danger-accent)]"
              >
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Réponses éventuelles + saisie facultative (toujours visible) */}
      {hasAnswersSection && (
        <div className="pt-2.5 border-t border-[var(--cdh-border-hairline)] space-y-2">
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
                    className={`px-3 py-2 rounded-cdh-md text-xs ${
                      isMine
                        ? 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-text-primary)]'
                        : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Avatar
                            initials={ans.user_initials || '?'}
                            color={ans.user_color || '#4F46E5'}
                            size="xs"
                          />
                          <span className="font-bold text-[var(--cdh-text-primary)]">
                            {ans.user_name || 'Ancien associé'}
                          </span>
                          {ansDate && (
                            <span className="text-[11px] text-[var(--cdh-text-secondary)] tabular-nums">
                              {ansDate}
                            </span>
                          )}
                        </div>

                        {isEditingThis ? (
                          <div className="mt-1.5 space-y-1.5">
                            <textarea
                              rows={2}
                              autoFocus
                              value={editingAnswerText}
                              onChange={(e) => onChangeEditAnswerText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  onCancelEditAnswer();
                                } else if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  onSaveEditedAnswer(ans.id);
                                }
                              }}
                              className="w-full p-2 border border-[var(--cdh-border-focus)] rounded-cdh-sm text-xs bg-[var(--cdh-surface-input)] text-[var(--cdh-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--cdh-accent-soft)]"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={onCancelEditAnswer}>
                                Annuler
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={!editingAnswerText.trim()}
                                onClick={() => onSaveEditedAnswer(ans.id)}
                              >
                                Enregistrer
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 pl-6 text-[var(--cdh-text-secondary)] leading-snug whitespace-pre-line break-words">
                            {ans.content}
                          </p>
                        )}
                      </div>

                      {!isEditingThis && (canEditAns || canDeleteAns) && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {canEditAns && (
                            <button
                              type="button"
                              onClick={() => onStartEditAnswer(ans.id, ans.content)}
                              aria-label="Modifier la réponse"
                              title="Modifier la réponse"
                              className="min-w-[32px] min-h-[32px] sm:min-w-[26px] sm:min-h-[26px] flex items-center justify-center text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] hover:bg-[var(--cdh-surface-elevated)] rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)]"
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
                              className="min-w-[32px] min-h-[32px] sm:min-w-[26px] sm:min-h-[26px] flex items-center justify-center text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-danger)] hover:bg-[var(--cdh-danger-soft)] rounded-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-danger-accent)]"
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
                value={newAnswerDraft}
                onChange={(e) => onChangeNewAnswerDraft(q.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSendAnswer(q.id);
                  }
                }}
                className="flex-1 min-w-0 min-h-[38px] sm:min-h-[34px] px-3 py-1.5 border border-[var(--cdh-border-subtle)] rounded-cdh-md text-xs text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] bg-[var(--cdh-surface-input)] focus:outline-none focus:border-[var(--cdh-border-focus)] focus:ring-2 focus:ring-[var(--cdh-accent-soft)]"
              />
              <Button
                variant="primary"
                size="sm"
                disabled={!newAnswerDraft.trim() || isSubmittingAnswer}
                isLoading={isSubmittingAnswer}
                onClick={() => onSendAnswer(q.id)}
                aria-label="Envoyer la réponse"
                leftIcon={<Send className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />}
                className="min-h-[38px] sm:min-h-[34px] shrink-0"
              >
                <span className="hidden sm:inline">Répondre</span>
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  );
});

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
  const [selectedFilter, setSelectedFilter] = useState<'me' | number>('me');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [presetUserId, setPresetUserId] = useState<number | undefined>(undefined);

  // Brouillons de réponse (1 réponse max par associé et par question, facultative)
  const [newAnswerText, setNewAnswerText] = useState<Record<number, string>>({});
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [editingAnswerText, setEditingAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<Record<number, boolean>>({});

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
    if (typeof selectedFilter === 'number' && !users.some((u) => u.id === selectedFilter)) {
      setSelectedFilter('me');
    }
  }, [users, selectedFilter]);

  const countsByUserId = useMemo(() => {
    const counts = new Map<number, number>();
    for (const q of questions) {
      counts.set(q.user_id, (counts.get(q.user_id) || 0) + 1);
    }
    return counts;
  }, [questions]);

  const visibleListQuestions = useMemo(() => {
    const targetUserId = selectedFilter === 'me' ? currentUser?.id : selectedFilter;
    if (!targetUserId) return [];
    return questions.filter((q) => q.user_id === targetUserId);
  }, [questions, selectedFilter, currentUser?.id]);

  const singleFilterPersonName = useMemo(() => {
    if (selectedFilter === 'me') return currentUser?.name;
    return users.find((u) => u.id === selectedFilter)?.name;
  }, [selectedFilter, currentUser?.name, users]);

  const openCreateModal = useCallback((userId?: number) => {
    setEditingQuestion(null);
    setPresetUserId(userId);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((q: Question) => {
    setEditingQuestion(q);
    setPresetUserId(undefined);
    setIsModalOpen(true);
  }, []);

  const handleChangeNewAnswerDraft = useCallback((questionId: number, value: string) => {
    setNewAnswerText((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleSendAnswer = useCallback(async (questionId: number) => {
    const content = newAnswerText[questionId]?.trim();
    if (!content || !onAddAnswer) return;

    setIsSubmittingAnswer((prev) => ({ ...prev, [questionId]: true }));
    try {
      await onAddAnswer(questionId, content);
      setNewAnswerText((prev) => ({ ...prev, [questionId]: '' }));
    } catch {
      // Erreur gérée par la notification globale ; le brouillon est conservé
    } finally {
      setIsSubmittingAnswer((prev) => ({ ...prev, [questionId]: false }));
    }
  }, [newAnswerText, onAddAnswer]);

  const handleStartEditAnswer = useCallback((answerId: number, content: string) => {
    setEditingAnswerId(answerId);
    setEditingAnswerText(content);
  }, []);

  const handleCancelEditAnswer = useCallback(() => {
    setEditingAnswerId(null);
    setEditingAnswerText('');
  }, []);

  const handleSaveEditedAnswer = useCallback(async (answerId: number) => {
    const trimmed = editingAnswerText.trim();
    if (!trimmed || !onUpdateAnswer) return;
    try {
      await onUpdateAnswer(answerId, trimmed);
      setEditingAnswerId(null);
      setEditingAnswerText('');
    } catch {
      // Erreur gérée par la notification globale ; l'édition reste ouverte
    }
  }, [editingAnswerText, onUpdateAnswer]);

  return (
    <div className="space-y-4">
      <h2 className="sr-only">Questions pour la réunion</h2>
      {/* Barre supérieure Liquid Glass : Filtres par associé + Ajout de question */}
      <div className="cdh-glass-chrome p-3 sm:p-4 rounded-cdh-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
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
              className={`shrink-0 inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-cdh-md text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
                selectedFilter === 'me'
                  ? 'bg-[var(--cdh-accent)] text-white shadow-xs'
                  : 'bg-[var(--cdh-accent-soft)] text-[var(--cdh-accent)] hover:bg-[var(--cdh-surface-control-hover)]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
              <span>Mes questions ({countsByUserId.get(currentUser.id) || 0})</span>
            </button>
          )}

          {users
            .filter((u) => u.id !== currentUser?.id)
            .map((u) => {
              const count = countsByUserId.get(u.id) || 0;
              const isSelected = selectedFilter === u.id;

              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedFilter(u.id)}
                  className={`shrink-0 inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[32px] px-3 py-1 rounded-cdh-md text-xs font-semibold transition-colors cursor-pointer tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cdh-border-focus)] ${
                    isSelected
                      ? 'text-white shadow-xs'
                      : 'bg-[var(--cdh-surface-control)] text-[var(--cdh-text-primary)] hover:bg-[var(--cdh-surface-control-hover)]'
                  }`}
                  style={isSelected ? { backgroundColor: ensureWhiteTextContrast(u.avatar_color) } : undefined}
                >
                  <Avatar initials={u.initials} color={u.avatar_color} size="xs" />
                  <span>{u.name} ({count})</span>
                </button>
              );
            })}
        </div>

        {canWrite && (
          <Button
            variant="primary"
            size="sm"
            onClick={() =>
              openCreateModal(typeof selectedFilter === 'number' && isAdmin ? selectedFilter : undefined)
            }
            leftIcon={<Plus className="w-4 h-4 shrink-0" strokeWidth={2.25} />}
            className="w-full sm:w-auto min-h-[40px] sm:min-h-[34px] shrink-0"
          >
            Poser une question
          </Button>
        )}
      </div>

      {/* Liste des questions de l'associé sélectionné */}
      {visibleListQuestions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="sr-only">{singleFilterPersonName || 'Questions'}</h3>
          {visibleListQuestions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              currentUser={currentUser}
              canWrite={canWrite}
              isReadOnly={isReadOnly}
              newAnswerDraft={newAnswerText[q.id] || ''}
              isSubmittingAnswer={!!isSubmittingAnswer[q.id]}
              editingAnswerId={editingAnswerId}
              editingAnswerText={editingAnswerText}
              onEditQuestion={openEditModal}
              onDeleteQuestion={onDeleteQuestion}
              onChangeNewAnswerDraft={handleChangeNewAnswerDraft}
              onSendAnswer={handleSendAnswer}
              onStartEditAnswer={handleStartEditAnswer}
              onChangeEditAnswerText={setEditingAnswerText}
              onCancelEditAnswer={handleCancelEditAnswer}
              onSaveEditedAnswer={handleSaveEditedAnswer}
              onDeleteAnswer={onDeleteAnswer}
              hasAddAnswerHandler={!!onAddAnswer}
            />
          ))}
        </div>
      ) : (
        <div className="cdh-glass-column rounded-cdh-2xl p-8 sm:p-10 text-center space-y-2.5">
          <div className="w-10 h-10 bg-[var(--cdh-surface-control)] text-[var(--cdh-text-tertiary)] rounded-full flex items-center justify-center mx-auto">
            <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <h3 className="font-bold text-[var(--cdh-text-primary)] text-sm sm:text-base">
            {selectedFilter === 'me'
              ? 'Aucune question posée pour le moment'
              : `Aucune question pour ${singleFilterPersonName || 'cet associé'}`}
          </h3>
          {canWrite && (selectedFilter === 'me' || isAdmin) && (
            <p className="text-xs text-[var(--cdh-text-secondary)] max-w-sm mx-auto">
              Cliquez sur « Poser une question » pour ajouter un sujet à aborder lors de la prochaine réunion.
            </p>
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
