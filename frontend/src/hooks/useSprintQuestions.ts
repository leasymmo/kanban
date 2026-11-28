import { useCallback } from 'react';
import { Question, User } from '../types';
import { api, isNetworkError } from '../api/client';
import { useConfirm } from '../components/ui';

export interface QuestionStoreAdapter {
  findQuestion: (questionId: number) => Question | undefined;
  patchQuestion: (questionId: number, updater: (q: Question) => Question) => void;
  insertCreatedQuestion: (created: Question) => void;
  removeQuestion: (questionId: number) => void;
  refreshFacets?: () => Promise<void>;
  refreshSummary?: () => Promise<void>;
  fallbackReload?: () => Promise<void>;
}

interface UseSprintQuestionsOptions {
  currentSprintId: number | null;
  currentUser: User | null;
  allUsers: User[];
  store: QuestionStoreAdapter;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function useSprintQuestions({
  currentSprintId,
  currentUser,
  allUsers,
  store,
  onSuccess,
  onError,
}: UseSprintQuestionsOptions) {
  const confirm = useConfirm();

  const handleAddQuestion = useCallback(
    async (data: any) => {
      try {
        const res = await api.createQuestion(data);
        if (res.question) {
          store.insertCreatedQuestion(res.question);
        } else {
          await store.fallbackReload?.();
        }
        store.refreshSummary?.();
        onSuccess('Question ajoutée avec succès.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          onError(err?.message || "Impossible d'ajouter cette question.");
          throw err;
        }
        const targetUser = allUsers.find((u) => u.id === data.user_id) || currentUser;
        const newQ: Question = {
          id: Date.now(),
          sprint_id: currentSprintId || 1,
          user_id: data.user_id || currentUser?.id || 1,
          user_name: targetUser?.name,
          user_initials: targetUser?.initials,
          user_color: targetUser?.avatar_color,
          created_by: currentUser?.id || 1,
          title: data.title,
          details: data.details,
          final_answer: null,
          answers: [],
          can_edit: true,
          can_delete: true,
          can_decide: true,
        };
        store.insertCreatedQuestion(newQ);
        onSuccess('Question ajoutée localement.');
      }
    },
    [currentSprintId, allUsers, currentUser, store, onSuccess, onError]
  );

  const handleUpdateQuestion = useCallback(
    async (id: number, data: Partial<Question>) => {
      const previous = store.findQuestion(id);
      const reassignedUser =
        data.user_id !== undefined ? allUsers.find((u) => u.id === data.user_id) : undefined;

      store.patchQuestion(id, (q) => ({
        ...q,
        ...data,
        ...(reassignedUser
          ? {
              user_name: reassignedUser.name,
              user_initials: reassignedUser.initials,
              user_color: reassignedUser.avatar_color,
            }
          : {}),
      }));

      try {
        const res = await api.updateQuestion(id, data);
        if (res.question) {
          store.patchQuestion(id, () => res.question!);
        }
        if (data.user_id !== undefined) {
          store.refreshFacets?.();
          store.refreshSummary?.();
        }
        onSuccess('Question mise à jour.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (previous) {
            store.patchQuestion(id, () => previous);
          }
          onError(err?.message || 'Impossible de modifier cette question.');
          throw err;
        }
        onSuccess('Question mise à jour localement.');
      }
    },
    [allUsers, store, onSuccess, onError]
  );

  const handleDeleteQuestion = useCallback(
    async (id: number) => {
      const confirmed = await confirm({
        title: 'Supprimer la question',
        message: 'Voulez-vous vraiment supprimer cette question ?',
        confirmLabel: 'Supprimer',
        variant: 'danger',
      });
      if (!confirmed) return;

      store.removeQuestion(id);
      try {
        await api.deleteQuestion(id);
        store.refreshSummary?.();
        onSuccess('Question supprimée.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          await store.fallbackReload?.();
          onError(err?.message || 'Impossible de supprimer cette question.');
        }
      }
    },
    [confirm, store, onSuccess, onError]
  );

  const handleAddAnswer = useCallback(
    async (questionId: number, content: string) => {
      try {
        const res = await api.addQuestionAnswer(questionId, content);
        if (res.answer) {
          store.patchQuestion(questionId, (q) => ({
            ...q,
            answers: [...(q.answers || []), res.answer],
          }));
        } else {
          await store.fallbackReload?.();
        }
        onSuccess('Proposition de réponse ajoutée.');
      } catch (e: any) {
        if (e?.status === 409) {
          await store.fallbackReload?.();
        }
        onError(e?.message || "Erreur lors de l'envoi de la proposition.");
        throw e;
      }
    },
    [store, onSuccess, onError]
  );

  const handleUpdateAnswer = useCallback(
    async (answerId: number, content: string) => {
      try {
        const res: any = await api.updateQuestionAnswer(answerId, content);
        const qId = res?.question_id;
        if (qId) {
          store.patchQuestion(qId, (q) => ({
            ...q,
            answers: (q.answers || []).map((a) =>
              a.id === answerId ? { ...a, content: res.content ?? content } : a
            ),
          }));
        } else {
          await store.fallbackReload?.();
        }
        onSuccess('Proposition mise à jour.');
      } catch (e: any) {
        onError(e?.message || 'Erreur lors de la modification de la réponse.');
        throw e;
      }
    },
    [store, onSuccess, onError]
  );

  const handleDeleteAnswer = useCallback(
    async (answerId: number) => {
      const confirmed = await confirm({
        title: 'Supprimer la proposition',
        message: 'Supprimer cette proposition de réponse ?',
        confirmLabel: 'Supprimer',
        variant: 'danger',
      });
      if (!confirmed) return;
      try {
        const res: any = await api.deleteQuestionAnswer(answerId);
        const qId = res?.question_id;
        if (qId) {
          store.patchQuestion(qId, (q) => ({
            ...q,
            answers: (q.answers || []).filter((a) => a.id !== answerId),
          }));
        } else {
          await store.fallbackReload?.();
        }
        onSuccess('Proposition supprimée.');
      } catch (e: any) {
        onError(e?.message || 'Erreur lors de la suppression.');
      }
    },
    [confirm, store, onSuccess, onError]
  );

  const handleSetQuestionDecision = useCallback(
    async (questionId: number, finalAnswer: string) => {
      try {
        const res = await api.setQuestionDecision(questionId, finalAnswer);
        store.patchQuestion(questionId, (q) => ({
          ...q,
          final_answer: res.final_answer ?? null,
        }));
        store.refreshFacets?.();
        store.refreshSummary?.();
        onSuccess(
          finalAnswer.trim()
            ? 'Réponse définitive enregistrée.'
            : 'Réponse définitive supprimée.'
        );
      } catch (e: any) {
        onError(e?.message || "Erreur lors de l'enregistrement de la décision.");
        throw e;
      }
    },
    [store, onSuccess, onError]
  );

  return {
    handleAddQuestion,
    handleUpdateQuestion,
    handleDeleteQuestion,
    handleAddAnswer,
    handleUpdateAnswer,
    handleDeleteAnswer,
    handleSetQuestionDecision,
  };
}
