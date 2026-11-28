import { useCallback, useRef, useState } from 'react';
import { Question, User } from '../types';
import { api, isNetworkError } from '../api/client';
import { useConfirm } from '../components/ui';

interface UseSprintQuestionsOptions {
  currentSprintId: number | null;
  currentUser: User | null;
  allUsers: User[];
  reloadSprintDetails: (sprintId: number) => Promise<void>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function useSprintQuestions({
  currentSprintId,
  currentUser,
  allUsers,
  reloadSprintDetails,
  onSuccess,
  onError,
}: UseSprintQuestionsOptions) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const questionsRef = useRef<Question[]>(questions);
  questionsRef.current = questions;
  const confirm = useConfirm();

  const handleAddQuestion = useCallback(
    async (data: any) => {
      try {
        await api.createQuestion(data);
        if (currentSprintId) await reloadSprintDetails(currentSprintId);
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
        setQuestions((prev) => [...prev, newQ]);
        onSuccess('Question ajoutée localement.');
      }
    },
    [currentSprintId, allUsers, currentUser, reloadSprintDetails, onSuccess, onError]
  );

  const handleUpdateQuestion = useCallback(
    async (id: number, data: Partial<Question>) => {
      const previous = questionsRef.current.find((q) => q.id === id);
      const reassignedUser =
        data.user_id !== undefined ? allUsers.find((u) => u.id === data.user_id) : undefined;

      setQuestions((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                ...data,
                ...(reassignedUser
                  ? {
                      user_name: reassignedUser.name,
                      user_initials: reassignedUser.initials,
                      user_color: reassignedUser.avatar_color,
                    }
                  : {}),
              }
            : q
        )
      );

      try {
        await api.updateQuestion(id, data);
        if (data.user_id !== undefined && currentSprintId) {
          await reloadSprintDetails(currentSprintId);
        }
        onSuccess('Question mise à jour.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (previous) {
            setQuestions((prev) => prev.map((q) => (q.id === id ? previous : q)));
          }
          onError(err?.message || 'Impossible de modifier cette question.');
          throw err;
        }
        onSuccess('Question mise à jour localement.');
      }
    },
    [allUsers, currentSprintId, reloadSprintDetails, onSuccess, onError]
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

      const snapshot = questionsRef.current;
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      try {
        await api.deleteQuestion(id);
        onSuccess('Question supprimée.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          setQuestions(snapshot);
          onError(err?.message || 'Impossible de supprimer cette question.');
        }
      }
    },
    [confirm, onSuccess, onError]
  );

  const handleAddAnswer = useCallback(
    async (questionId: number, content: string) => {
      try {
        await api.addQuestionAnswer(questionId, content);
        if (currentSprintId) await reloadSprintDetails(currentSprintId);
        onSuccess('Proposition de réponse ajoutée.');
      } catch (e: any) {
        if (e?.status === 409 && currentSprintId) {
          await reloadSprintDetails(currentSprintId);
        }
        onError(e?.message || "Erreur lors de l'envoi de la proposition.");
        throw e;
      }
    },
    [currentSprintId, reloadSprintDetails, onSuccess, onError]
  );

  const handleUpdateAnswer = useCallback(
    async (answerId: number, content: string) => {
      try {
        await api.updateQuestionAnswer(answerId, content);
        if (currentSprintId) await reloadSprintDetails(currentSprintId);
        onSuccess('Proposition mise à jour.');
      } catch (e: any) {
        onError(e?.message || 'Erreur lors de la modification de la réponse.');
        throw e;
      }
    },
    [currentSprintId, reloadSprintDetails, onSuccess, onError]
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
        await api.deleteQuestionAnswer(answerId);
        if (currentSprintId) await reloadSprintDetails(currentSprintId);
        onSuccess('Proposition supprimée.');
      } catch (e: any) {
        onError(e?.message || 'Erreur lors de la suppression.');
      }
    },
    [confirm, currentSprintId, reloadSprintDetails, onSuccess, onError]
  );

  const handleSetQuestionDecision = useCallback(
    async (questionId: number, finalAnswer: string) => {
      try {
        await api.setQuestionDecision(questionId, finalAnswer);
        if (currentSprintId) await reloadSprintDetails(currentSprintId);
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
    [currentSprintId, reloadSprintDetails, onSuccess, onError]
  );

  return {
    questions,
    setQuestions,
    handleAddQuestion,
    handleUpdateQuestion,
    handleDeleteQuestion,
    handleAddAnswer,
    handleUpdateAnswer,
    handleDeleteAnswer,
    handleSetQuestionDecision,
  };
}
