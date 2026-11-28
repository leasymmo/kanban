import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PaginationMeta,
  Question,
  QuestionAnswersFilter,
  QuestionDecisionFilter,
  QuestionFacets,
  QuestionSortKey,
  User,
} from '../types';
import { QuestionModal } from './QuestionModal';
import { QuestionsToolbar } from './QuestionsToolbar';
import { Avatar, Badge, Button, InfiniteScrollSentinel } from './ui';
import { formatQuestionDate } from '../utils/questions';
import { ensureWhiteTextContrast } from '../utils/color';
import {
  HelpCircle,
  Edit3,
  Trash2,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface QuestionsViewProps {
  questions: Question[];
  pagination: PaginationMeta;
  facets: QuestionFacets;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  userFilter: 'me' | 'all' | number;
  onChangeUserFilter: (filter: 'me' | 'all' | number) => void;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  decisionStatus: QuestionDecisionFilter;
  onChangeDecisionStatus: (s: QuestionDecisionFilter) => void;
  hasAnswers: QuestionAnswersFilter;
  onChangeHasAnswers: (v: QuestionAnswersFilter) => void;
  answeredByMe: boolean | null;
  onChangeAnsweredByMe: (v: boolean | null) => void;
  sortBy: QuestionSortKey;
  sortDir: 'asc' | 'desc';
  onSelectSort: (key: QuestionSortKey) => void;
  onToggleSortDir: () => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
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
  showOwnerBadge?: boolean;
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
  showOwnerBadge = false,
}) => {
  const answers = q.answers || [];
  const myAnswer = currentUser ? answers.find((a) => a.user_id === currentUser.id) : undefined;
  const otherAnswers = myAnswer ? answers.filter((a) => a.id !== myAnswer.id) : answers;
  const orderedAnswers = myAnswer ? [myAnswer, ...otherAnswers] : answers;

  const canModifyQuestion = !isReadOnly && !!q.can_edit && currentUser?.role !== 'read';
  const canDeleteQuestion = !isReadOnly && !!q.can_delete && currentUser?.role !== 'read';
  const canReply = canWrite && hasAddAnswerHandler && !myAnswer;
  const hasAnswersSection = orderedAnswers.length > 0 || canReply;
  const hasFinalDecision = Boolean(q.final_answer && q.final_answer.trim() !== '');

  return (
    <article className="cdh-surface-card rounded-[18px] sm:rounded-[20px] p-3.5 sm:p-4 transition-colors space-y-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          {(showOwnerBadge || hasFinalDecision) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {showOwnerBadge && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--cdh-surface-control)] text-[var(--cdh-text-secondary)]">
                  <Avatar
                    initials={q.user_initials || '?'}
                    color={q.user_color || '#64748B'}
                    size="xs"
                  />
                  <span>{q.user_name || 'Ancien associé'}</span>
                </span>
              )}
              {hasFinalDecision && (
                <Badge variant="success" pill>
                  <CheckCircle2 className="w-3 h-3" strokeWidth={2.25} />
                  Décidée
                </Badge>
              )}
            </div>
          )}

          <h4 className="text-sm sm:text-[15px] font-bold leading-snug text-[var(--cdh-text-primary)] break-words">
            {q.title}
          </h4>

          {q.details && (
            <p className="text-xs sm:text-[13px] text-[var(--cdh-text-secondary)] leading-relaxed whitespace-pre-line break-words pl-2.5 border-l-2 border-[var(--cdh-border-subtle)]">
              {q.details}
            </p>
          )}

          {hasFinalDecision && (
            <div className="text-xs px-2.5 py-1.5 rounded-cdh-md bg-[var(--cdh-success-soft)] text-[var(--cdh-text-primary)] border border-[var(--cdh-success)]/25">
              <span className="font-bold text-[var(--cdh-success)]">Décision : </span>
              <span className="whitespace-pre-line break-words">{q.final_answer}</span>
            </div>
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
  pagination,
  facets,
  isLoading,
  isLoadingMore,
  onLoadMore,
  userFilter,
  onChangeUserFilter,
  searchQuery,
  onChangeSearchQuery,
  decisionStatus,
  onChangeDecisionStatus,
  hasAnswers,
  onChangeHasAnswers,
  answeredByMe,
  onChangeAnsweredByMe,
  sortBy,
  sortDir,
  onSelectSort,
  onToggleSortDir,
  hasActiveFilters,
  onResetFilters,
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [presetUserId, setPresetUserId] = useState<number | undefined>(undefined);

  const [newAnswerText, setNewAnswerText] = useState<Record<number, string>>({});
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [editingAnswerText, setEditingAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState<Record<number, boolean>>({});

  const isAdmin = currentUser?.role === 'admin';
  const canWrite = !isReadOnly && currentUser?.role !== 'read';

  useEffect(() => {
    setNewAnswerText({});
    setEditingAnswerId(null);
    setEditingAnswerText('');
  }, [sprintId]);

  useEffect(() => {
    if (typeof userFilter === 'number' && !users.some((u) => u.id === userFilter)) {
      onChangeUserFilter('me');
    }
  }, [users, userFilter, onChangeUserFilter]);

  const singleFilterPersonName = useMemo(() => {
    if (userFilter === 'all') return 'Tous les associés';
    if (userFilter === 'me') return currentUser?.name;
    return users.find((u) => u.id === userFilter)?.name;
  }, [userFilter, currentUser?.name, users]);

  const openCreateModal = useCallback((userId?: number) => {
    setEditingQuestion(null);
    setPresetUserId(userId);
    setIsModalOpen(true);
  }, []);

  const handleCreateFromToolbar = useCallback(
    () => openCreateModal(typeof userFilter === 'number' && isAdmin ? userFilter : undefined),
    [openCreateModal, userFilter, isAdmin]
  );

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
      // Erreur gérée globalement
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
      // Erreur gérée globalement
    }
  }, [editingAnswerText, onUpdateAnswer]);

  return (
    <div className="space-y-3">
      <h2 className="sr-only">Questions pour la réunion</h2>

      <QuestionsToolbar
        currentUser={currentUser}
        users={users}
        facets={facets}
        userFilter={userFilter}
        onChangeUserFilter={onChangeUserFilter}
        searchQuery={searchQuery}
        onChangeSearchQuery={onChangeSearchQuery}
        decisionStatus={decisionStatus}
        onChangeDecisionStatus={onChangeDecisionStatus}
        hasAnswers={hasAnswers}
        onChangeHasAnswers={onChangeHasAnswers}
        answeredByMe={answeredByMe}
        onChangeAnsweredByMe={onChangeAnsweredByMe}
        sortBy={sortBy}
        sortDir={sortDir}
        onSelectSort={onSelectSort}
        onToggleSortDir={onToggleSortDir}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={onResetFilters}
        isLoading={isLoading}
        canWrite={canWrite}
        onAddNewQuestion={handleCreateFromToolbar}
      />

      {/* Liste paginée avec scroll infini */}
      {questions.length > 0 ? (
        <div className="space-y-3">
          <h3 className="sr-only">{singleFilterPersonName || 'Questions'}</h3>
          {questions.map((q) => (
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
              showOwnerBadge={userFilter === 'all'}
            />
          ))}

          <InfiniteScrollSentinel
            hasMore={pagination.has_more}
            isLoadingMore={isLoadingMore}
            onLoadMore={onLoadMore}
            loadedCount={questions.length}
            totalCount={pagination.total}
            itemLabel="questions"
          />
        </div>
      ) : (
        <div className="cdh-glass-column rounded-cdh-2xl p-8 sm:p-10 text-center space-y-2.5">
          <div className="w-10 h-10 bg-[var(--cdh-surface-control)] text-[var(--cdh-text-tertiary)] rounded-full flex items-center justify-center mx-auto">
            <HelpCircle className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <h3 className="font-bold text-[var(--cdh-text-primary)] text-sm sm:text-base">
            {hasActiveFilters
              ? 'Aucune question ne correspond à ces critères'
              : userFilter === 'me'
              ? 'Aucune question posée pour le moment'
              : userFilter === 'all'
              ? 'Aucune question pour ce sprint'
              : `Aucune question pour ${singleFilterPersonName || 'cet associé'}`}
          </h3>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="text-xs font-semibold text-[var(--cdh-accent)] hover:underline cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          ) : (
            canWrite &&
            (userFilter === 'me' || userFilter === 'all' || isAdmin) && (
              <p className="text-xs text-[var(--cdh-text-secondary)] max-w-sm mx-auto">
                Cliquez sur « Poser une question » pour ajouter un sujet à aborder lors de la prochaine réunion.
              </p>
            )
          )}
        </div>
      )}

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
