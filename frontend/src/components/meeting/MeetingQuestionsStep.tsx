import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Question, Sprint, User } from '../../types';
import { hasFinalDecision } from '../../utils/questions';
import { ensureWhiteTextContrast } from '../../utils/color';
import { getScrollBehavior } from '../../utils/taskMotion';
import { Avatar, Badge, useConfirm } from '../ui';
import { MeetingSectionShell } from './MeetingSectionShell';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Info,
  Sparkles,
} from 'lucide-react';

interface MeetingQuestionsStepProps {
  sprint: Sprint;
  users: User[];
  questions: Question[];
  currentUser: User | null;
  isAdmin: boolean;
  isReadOnly: boolean;
  onSetQuestionDecision?: (questionId: number, finalAnswer: string) => Promise<void>;
  onEditQuestion?: (question: Question) => void;
}

interface MeetingQuestionCardProps {
  question: Question;
  currentUser: User | null;
  isAdmin: boolean;
  isReadOnly: boolean;
  decisionInputDraft: string | undefined;
  isSubmitting: boolean;
  isProposalDrawerOpen: boolean;
  registerInputRef: (questionId: number, el: HTMLInputElement | null) => void;
  onChangeDecisionInput: (questionId: number, val: string) => void;
  onResetDecisionInput: (questionId: number) => void;
  onToggleProposals: (questionId: number) => void;
  onSelectProposition: (questionId: number, content: string) => void;
  onSaveDecision: (questionId: number, advanceToNext?: boolean) => Promise<void>;
  onClearDecision: (questionId: number) => Promise<void>;
  onEditQuestion?: (question: Question) => void;
}

const MeetingQuestionCard: React.FC<MeetingQuestionCardProps> = React.memo(({
  question: q,
  currentUser,
  isAdmin,
  isReadOnly,
  decisionInputDraft,
  isSubmitting,
  isProposalDrawerOpen,
  registerInputRef,
  onChangeDecisionInput,
  onResetDecisionInput,
  onToggleProposals,
  onSelectProposition,
  onSaveDecision,
  onClearDecision,
  onEditQuestion,
}) => {
  const answers = q.answers || [];
  const hasFinalAnswer = hasFinalDecision(q);
  const savedAnswer = (q.final_answer || '').trim();
  const currentInput = decisionInputDraft !== undefined ? decisionInputDraft : (q.final_answer || '');
  const trimmedInput = currentInput.trim();
  const isDirty = decisionInputDraft !== undefined && trimmedInput !== savedAnswer;
  const canArbitrate =
    !isReadOnly &&
    (q.can_decide ?? (currentUser?.role !== 'read' && (isAdmin || currentUser?.role === 'write')));
  const canModifyQuestion =
    !isReadOnly &&
    (q.can_edit !== undefined
      ? !!q.can_edit
      : isAdmin || (currentUser?.role === 'write' && currentUser?.id === q.user_id));
  const showProposals = !hasFinalAnswer || isProposalDrawerOpen;

  return (
    <article
      className={`cdh-surface-card rounded-cdh-lg p-3.5 sm:p-4 space-y-3 transition-all ${
        hasFinalAnswer ? 'border-[var(--cdh-success)]/35' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={hasFinalAnswer ? 'success' : 'warning'} pill>
              {hasFinalAnswer ? 'Décidée' : 'À trancher'}
            </Badge>
            <h4 className="text-[14.5px] sm:text-[15px] font-bold text-[var(--cdh-text-primary)] leading-snug break-words">
              {q.title}
            </h4>
          </div>
          {q.details && (
            <p className="text-[13px] text-[var(--cdh-text-secondary)] leading-relaxed whitespace-pre-line break-words">
              {q.details}
            </p>
          )}
        </div>

        {canModifyQuestion && onEditQuestion && (
          <button
            type="button"
            onClick={() => onEditQuestion(q)}
            className="w-8 h-8 flex items-center justify-center text-[var(--cdh-text-tertiary)] hover:text-[var(--cdh-accent)] bg-[var(--cdh-surface-control)] hover:bg-[var(--cdh-surface-control-hover)] rounded-cdh-md transition-colors cursor-pointer shrink-0"
            title="Modifier la question"
            aria-label={`Modifier la question : ${q.title}`}
          >
            <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Zone directe de réponse définitive */}
      {canArbitrate ? (
        <div className="p-2.5 sm:p-3 rounded-cdh-md bg-[var(--cdh-surface-control)] border border-[var(--cdh-border-hairline)] focus-within:border-[var(--cdh-border-focus)] focus-within:ring-2 focus-within:ring-[var(--cdh-accent-soft)] space-y-2 transition-all">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label
              htmlFor={`meeting-decision-${q.id}`}
              className="text-[11.5px] font-bold text-[var(--cdh-text-secondary)] flex items-center gap-1.5"
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 shrink-0 ${
                  hasFinalAnswer ? 'text-[var(--cdh-success)]' : 'text-[var(--cdh-text-tertiary)]'
                }`}
                strokeWidth={2.25}
              />
              <span>Réponse définitive</span>
              <span className="hidden sm:inline font-normal text-[11px] text-[var(--cdh-text-tertiary)]">
                (Entrée ↵ pour valider &amp; passer à la suivante)
              </span>
            </label>

            <div className="flex items-center gap-2">
              {hasFinalAnswer && !isDirty && (
                <Badge variant="success">Enregistrée ✓</Badge>
              )}
              {isDirty && hasFinalAnswer && (
                <button
                  type="button"
                  onClick={() => onResetDecisionInput(q.id)}
                  className="text-[11px] font-semibold text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] cursor-pointer"
                >
                  Annuler
                </button>
              )}
              {hasFinalAnswer && (
                <button
                  type="button"
                  onClick={() => onClearDecision(q.id)}
                  className="text-[11px] font-semibold text-[var(--cdh-danger)] hover:underline cursor-pointer"
                >
                  Effacer
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id={`meeting-decision-${q.id}`}
              ref={(el) => registerInputRef(q.id, el)}
              type="text"
              aria-label={`Réponse définitive pour : ${q.title}`}
              placeholder="Saisissez la décision et appuyez sur Entrée…"
              value={currentInput}
              onChange={(e) => onChangeDecisionInput(q.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSaveDecision(q.id, true);
                }
              }}
              className="flex-1 min-w-0 min-h-[38px] px-3 py-1.5 bg-[var(--cdh-surface-input)] border border-[var(--cdh-border-subtle)] rounded-cdh-md text-[13px] text-[var(--cdh-text-primary)] placeholder:text-[var(--cdh-text-tertiary)] focus:outline-none focus:border-[var(--cdh-border-focus)]"
            />

            {(!hasFinalAnswer || isDirty) && (
              <button
                type="button"
                disabled={!trimmedInput || isSubmitting}
                onClick={() => onSaveDecision(q.id, true)}
                className="min-h-[38px] px-3.5 bg-[var(--cdh-success)] hover:opacity-90 disabled:opacity-45 text-white rounded-cdh-md text-[12px] font-bold shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-opacity"
              >
                <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.25} />
                <span>
                  {isSubmitting
                    ? '...'
                    : hasFinalAnswer
                    ? 'Mettre à jour'
                    : 'Acter'}
                </span>
              </button>
            )}
          </div>
        </div>
      ) : hasFinalAnswer ? (
        <div className="px-3.5 py-2.5 rounded-cdh-md bg-[var(--cdh-success-soft)] text-[13px]">
          <div className="flex items-center gap-1.5 font-bold text-[var(--cdh-success)] text-[12px]">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2.25} />
            <span>Réponse définitive</span>
          </div>
          <p className="mt-1 text-[var(--cdh-text-primary)] font-semibold whitespace-pre-line break-words pl-5 leading-relaxed">
            {q.final_answer}
          </p>
        </div>
      ) : (
        <p className="text-xs italic text-[var(--cdh-text-tertiary)]">
          Aucune réponse définitive saisie.
        </p>
      )}

      {/* Propositions indicatives */}
      {answers.length > 0 && (
        <div className="pt-2 border-t border-[var(--cdh-border-hairline)] space-y-2">
          {hasFinalAnswer ? (
            <button
              type="button"
              aria-expanded={showProposals}
              onClick={() => onToggleProposals(q.id)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--cdh-text-secondary)] hover:text-[var(--cdh-text-primary)] cursor-pointer"
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-150 ${
                  showProposals ? 'rotate-180' : ''
                }`}
                strokeWidth={2}
              />
              <span>Propositions indicatives ({answers.length})</span>
            </button>
          ) : (
            <p className="text-[11px] font-bold text-[var(--cdh-text-tertiary)] uppercase tracking-wider">
              Propositions indicatives ({answers.length})
            </p>
          )}

          {showProposals && (
            <div className="space-y-1.5">
              {answers.map((ans) => (
                <div
                  key={ans.id}
                  className="px-3 py-2 bg-[var(--cdh-surface-control)] rounded-cdh-md text-[12.5px] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cdh-text-primary)] shrink-0">
                      <Avatar
                        initials={ans.user_initials || '?'}
                        color={ensureWhiteTextContrast(ans.user_color, '#4F46E5')}
                        size="xs"
                      />
                      <span>{ans.user_name} :</span>
                    </span>
                    <span className="text-[var(--cdh-text-secondary)] break-words">
                      {ans.content}
                    </span>
                  </div>

                  {canArbitrate && (
                    <button
                      type="button"
                      onClick={() => onSelectProposition(q.id, ans.content)}
                      aria-label={`Retenir la proposition de ${ans.user_name} comme décision finale pour : ${q.title}`}
                      className="self-end sm:self-auto px-2.5 py-1 text-[11.5px] font-bold bg-[var(--cdh-accent-soft)] hover:opacity-85 text-[var(--cdh-accent)] rounded-cdh-sm flex items-center gap-1 transition-opacity shrink-0 cursor-pointer"
                      title="Retenir cette proposition comme réponse définitive"
                    >
                      <Sparkles className="w-3 h-3" strokeWidth={2} />
                      <span>Retenir</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
});

/**
 * Étape 2 de la Vue Réunion : Revue des Questions & Décisions par intervenant,
 * optimisée pour la lecture à distance en partage d'écran Teams / Google Meet.
 */
export const MeetingQuestionsStep: React.FC<MeetingQuestionsStepProps> = ({
  sprint,
  users,
  questions,
  currentUser,
  isAdmin,
  isReadOnly,
  onSetQuestionDecision,
  onEditQuestion,
}) => {
  const confirm = useConfirm();
  const [decisionInputs, setDecisionInputs] = useState<Record<number, string>>({});
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<Record<number, boolean>>({});
  const [openProposalDrawers, setOpenProposalDrawers] = useState<Record<number, boolean>>({});
  const decisionInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  useEffect(() => {
    setDecisionInputs({});
    setOpenProposalDrawers({});
  }, [sprint.id]);

  const { questionsByUserId, orphanQuestions, orderedMeetingQuestions } = useMemo(() => {
    const byUser = new Map<number, Question[]>();
    const userIdsSet = new Set(users.map((u) => u.id));
    const orphans: Question[] = [];

    for (const q of questions) {
      if (userIdsSet.has(q.user_id)) {
        const list = byUser.get(q.user_id);
        if (list) list.push(q);
        else byUser.set(q.user_id, [q]);
      } else {
        orphans.push(q);
      }
    }

    const ordered = [
      ...users.flatMap((u) => byUser.get(u.id) || []),
      ...orphans,
    ];

    return {
      questionsByUserId: byUser,
      orphanQuestions: orphans,
      orderedMeetingQuestions: ordered,
    };
  }, [users, questions]);

  const registerInputRef = useCallback((questionId: number, el: HTMLInputElement | null) => {
    decisionInputRefs.current[questionId] = el;
  }, []);

  const focusNextDecisionInput = useCallback((currentQuestionId: number) => {
    const idx = orderedMeetingQuestions.findIndex((q) => q.id === currentQuestionId);
    if (idx === -1) return;
    const nextQ = orderedMeetingQuestions[idx + 1];
    if (!nextQ) return;
    window.setTimeout(() => {
      const nextEl = decisionInputRefs.current[nextQ.id];
      if (nextEl) {
        nextEl.focus();
        nextEl.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' });
      }
    }, 50);
  }, [orderedMeetingQuestions]);

  const handleChangeDecisionInput = useCallback((questionId: number, val: string) => {
    setDecisionInputs((prev) => ({ ...prev, [questionId]: val }));
  }, []);

  const handleResetDecisionInput = useCallback((questionId: number) => {
    setDecisionInputs((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }, []);

  const handleToggleProposals = useCallback((questionId: number) => {
    setOpenProposalDrawers((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }, []);

  const handleSelectProposition = useCallback((questionId: number, content: string) => {
    setDecisionInputs((prev) => ({ ...prev, [questionId]: content }));
    window.setTimeout(() => decisionInputRefs.current[questionId]?.focus(), 30);
  }, []);

  const handleSaveDecision = useCallback(async (questionId: number, advanceToNext: boolean = false) => {
    const existingQuestion = questions.find((q) => q.id === questionId);
    const savedAnswer = (existingQuestion?.final_answer || '').trim();
    const text =
      decisionInputs[questionId] !== undefined ? decisionInputs[questionId].trim() : savedAnswer;
    if (!text) return;

    if (text === savedAnswer) {
      if (advanceToNext) focusNextDecisionInput(questionId);
      return;
    }
    if (!onSetQuestionDecision) return;

    setIsSubmittingDecision((prev) => ({ ...prev, [questionId]: true }));
    try {
      await onSetQuestionDecision(questionId, text);
      setDecisionInputs((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      if (advanceToNext) focusNextDecisionInput(questionId);
    } catch {
      // Notification gérée globalement
    } finally {
      setIsSubmittingDecision((prev) => ({ ...prev, [questionId]: false }));
    }
  }, [questions, decisionInputs, onSetQuestionDecision, focusNextDecisionInput]);

  const handleClearDecision = useCallback(async (questionId: number) => {
    const confirmed = await confirm({
      title: 'Effacer la décision',
      message: 'Effacer la réponse définitive pour remettre cette question à trancher ?',
      confirmLabel: 'Effacer',
      variant: 'warning',
    });
    if (!confirmed) return;
    try {
      await onSetQuestionDecision?.(questionId, '');
      setDecisionInputs((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch {
      // Notification gérée globalement
    }
  }, [confirm, onSetQuestionDecision]);

  const renderCard = (q: Question) => (
    <MeetingQuestionCard
      key={q.id}
      question={q}
      currentUser={currentUser}
      isAdmin={isAdmin}
      isReadOnly={isReadOnly}
      decisionInputDraft={decisionInputs[q.id]}
      isSubmitting={!!isSubmittingDecision[q.id]}
      isProposalDrawerOpen={!!openProposalDrawers[q.id]}
      registerInputRef={registerInputRef}
      onChangeDecisionInput={handleChangeDecisionInput}
      onResetDecisionInput={handleResetDecisionInput}
      onToggleProposals={handleToggleProposals}
      onSelectProposition={handleSelectProposition}
      onSaveDecision={handleSaveDecision}
      onClearDecision={handleClearDecision}
      onEditQuestion={onEditQuestion}
    />
  );

  const orphanUndecidedCount = orphanQuestions.filter((q) => !hasFinalDecision(q)).length;
  const orphanDecidedCount = orphanQuestions.length - orphanUndecidedCount;

  return (
    <div className="space-y-4">
      {(sprint.status === 'closed' || isReadOnly) && (
        <div className="px-3.5 py-2.5 rounded-cdh-lg cdh-glass-column flex items-center gap-2 text-xs text-[var(--cdh-text-secondary)] font-medium">
          <Info className="w-4 h-4 text-[var(--cdh-accent)] shrink-0" strokeWidth={2} />
          <span>
            Sprint clôturé : les propositions indicatives préparatoires ne sont pas conservées ; seules les réponses définitives sont archivées.
          </span>
        </div>
      )}

      {users.map((user) => {
        const userQuestions = questionsByUserId.get(user.id) || [];
        const userDecidedCount = userQuestions.filter(hasFinalDecision).length;
        const userUndecidedCount = userQuestions.length - userDecidedCount;

        return (
          <MeetingSectionShell
            key={user.id}
            sectionId={`meeting-section-questions-${user.id}`}
            dataAnchor={String(user.id)}
            avatar={{ name: user.name, initials: user.initials, color: user.avatar_color }}
            title={user.name}
            subtitle={
              userQuestions.length === 0
                ? 'Aucune question posée'
                : `${userQuestions.length} question${userQuestions.length > 1 ? 's' : ''} · ${userDecidedCount} décidée${userDecidedCount > 1 ? 's' : ''}`
            }
            badges={
              <>
                {userUndecidedCount > 0 && (
                  <Badge variant="warning" pill>
                    {userUndecidedCount} à trancher
                  </Badge>
                )}
                {userDecidedCount > 0 && (
                  <Badge variant="success" pill>
                    {userDecidedCount} décidée{userDecidedCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {userQuestions.length === 0 && (
                  <Badge variant="neutral" pill>0 question</Badge>
                )}
              </>
            }
          >
            {userQuestions.length > 0 ? (
              <div className="space-y-2.5">{userQuestions.map(renderCard)}</div>
            ) : (
              <p className="py-4 text-center text-xs text-[var(--cdh-text-tertiary)] font-medium">
                Aucune question à aborder pour {user.name}.
              </p>
            )}
          </MeetingSectionShell>
        );
      })}

      {orphanQuestions.length > 0 && (
        <MeetingSectionShell
          avatar={{ name: 'Autres participants', initials: '?', color: '#64748B' }}
          title="Autres participants"
          subtitle={`${orphanQuestions.length} question${orphanQuestions.length > 1 ? 's' : ''}`}
          badges={
            <>
              {orphanUndecidedCount > 0 && (
                <Badge variant="warning" pill>
                  {orphanUndecidedCount} à trancher
                </Badge>
              )}
              {orphanDecidedCount > 0 && (
                <Badge variant="success" pill>
                  {orphanDecidedCount} décidée(s)
                </Badge>
              )}
            </>
          }
        >
          <div className="space-y-2.5">{orphanQuestions.map(renderCard)}</div>
        </MeetingSectionShell>
      )}
    </div>
  );
};
