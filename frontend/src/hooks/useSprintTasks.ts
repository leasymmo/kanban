import { useCallback, useRef, useState } from 'react';
import { Task, TaskPriority, TaskStatus, Property, User } from '../types';
import { api, isNetworkError } from '../api/client';
import { reorderTasksInSubset } from '../utils/subtasks';
import {
  captureTaskSnapshot,
  CreatedTaskBatch,
  scheduleTaskMotionFeedback,
} from '../utils/taskMotion';
import { useConfirm } from '../components/ui';

interface UseSprintTasksOptions {
  currentSprintId: number | null;
  currentUser: User | null;
  allUsers: User[];
  properties: Property[];
  reloadSprintDetails: (sprintId: number) => Promise<void>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  blocked: 'Bloqué',
  done: 'Terminé',
};

export function useSprintTasks({
  currentSprintId,
  currentUser,
  allUsers,
  properties,
  reloadSprintDetails,
  onSuccess,
  onError,
}: UseSprintTasksOptions) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [lastCreatedBatch, setLastCreatedBatch] = useState<CreatedTaskBatch | null>(null);
  const confirm = useConfirm();

  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

  const notifySuccess = useCallback(
    (msg: string) => {
      onSuccess?.(msg);
    },
    [onSuccess]
  );

  const notifyError = useCallback(
    (err: any, fallbackMsg: string) => {
      const msg = err?.message || fallbackMsg;
      if (onError) onError(msg);
      else console.error(msg);
    },
    [onError]
  );

  const saveTask = useCallback(
    async (taskData: any) => {
      const isUpdate = !!taskData.id;
      try {
        const res: any = isUpdate
          ? await api.updateTask(taskData.id, {
              sprint_id: currentSprintId || undefined,
              ...taskData,
            })
          : await api.createTask(taskData);

        const snapshot = isUpdate ? captureTaskSnapshot(taskData.id) : null;
        if (currentSprintId) {
          await reloadSprintDetails(currentSprintId);
        }

        if (isUpdate) {
          scheduleTaskMotionFeedback({
            taskId: taskData.id,
            tone: 'accent',
            mode: 'move',
            snapshot,
          });
        } else {
          const createdIds: number[] =
            Array.isArray(res?.task_ids) && res.task_ids.length > 0
              ? res.task_ids
              : res?.task_id
              ? [res.task_id]
              : [];
          const targetStatus = (res?.status || taskData.status || 'todo') as TaskStatus | 'pending';
          const firstPropId: number | null =
            Array.isArray(taskData.property_ids) && taskData.property_ids.length > 0
              ? taskData.property_ids[0] ?? null
              : taskData.property_id ?? null;

          if (createdIds.length > 0) {
            if (targetStatus === 'pending') {
              createdIds.forEach((createdId, idx) => {
                scheduleTaskMotionFeedback({
                  taskId: createdId,
                  tone: 'accent',
                  mode: 'appear',
                  scrollIfOffscreen: idx === 0,
                });
              });
            } else {
              setLastCreatedBatch({
                ids: createdIds,
                status: targetStatus,
                propertyId: firstPropId,
                seq: Date.now(),
              });
            }
          }
        }

        notifySuccess(res?.message || (isUpdate ? 'Tâche mise à jour.' : 'Tâche créée avec succès.'));
      } catch (err: any) {
        if (!isNetworkError(err)) {
          notifyError(err, isUpdate ? 'Impossible de modifier cette tâche.' : 'Impossible de créer cette tâche.');
          throw err;
        }
        const snapshot = isUpdate ? captureTaskSnapshot(taskData.id) : null;
        const isPendingMeeting =
          taskData.created_from === 'meeting_pending' || taskData.status === 'pending';

        if (taskData.id) {
          const { property_ids: _ignoredPropIds, ...safeTaskData } = taskData;
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskData.id) return t;
              const nextAssigned =
                safeTaskData.assigned_to !== undefined ? safeTaskData.assigned_to : t.assigned_to;
              const nextPropId =
                safeTaskData.property_id !== undefined ? safeTaskData.property_id : t.property_id;
              const nextStatus = t.status === 'pending' ? 'pending' : safeTaskData.status || t.status;
              const assignee = nextAssigned ? allUsers.find((u) => u.id === nextAssigned) : undefined;
              const prop = nextPropId ? properties.find((p) => p.id === nextPropId) : undefined;

              return {
                ...t,
                ...safeTaskData,
                assigned_to: nextAssigned,
                assigned_to_name: nextAssigned ? assignee?.name ?? t.assigned_to_name : undefined,
                assigned_to_initials: nextAssigned
                  ? assignee?.initials ?? t.assigned_to_initials
                  : undefined,
                assigned_to_color: nextAssigned
                  ? assignee?.avatar_color ?? t.assigned_to_color
                  : undefined,
                property_id: nextPropId,
                property_name: nextPropId ? prop?.name ?? t.property_name : undefined,
                property_color: nextPropId ? prop?.color ?? t.property_color : undefined,
                property_code: nextPropId ? prop?.code ?? t.property_code : undefined,
                status: nextStatus,
                is_starred: nextStatus === 'pending' ? 0 : safeTaskData.is_starred ?? t.is_starred,
              };
            })
          );
          scheduleTaskMotionFeedback({
            taskId: taskData.id,
            tone: 'accent',
            mode: 'move',
            snapshot,
          });
          notifySuccess('Tâche mise à jour localement.');
        } else {
          const targetProps: (number | null)[] =
            Array.isArray(taskData.property_ids) && taskData.property_ids.length > 0
              ? taskData.property_ids
              : [taskData.property_id ?? null];

          const basePos = tasksRef.current.length;
          const createdTasks: Task[] = targetProps.map((propId, pIdx) => {
            const prop = properties.find((p) => p.id === propId);
            const assignee = allUsers.find((u) => u.id === taskData.assigned_to);
            const effectiveStatus = isPendingMeeting ? 'pending' : taskData.status || 'todo';
            return {
              id: Date.now() + pIdx,
              sprint_id: currentSprintId || 1,
              title: taskData.title,
              description: taskData.description,
              status: effectiveStatus,
              priority: taskData.priority || 'medium',
              assigned_to: taskData.assigned_to ?? null,
              assigned_to_name: assignee?.name,
              assigned_to_initials: assignee?.initials,
              assigned_to_color: assignee?.avatar_color,
              created_by: currentUser?.id || 1,
              property_id: propId,
              property_name: prop?.name,
              property_color: prop?.color,
              position: basePos + pIdx + 1,
              is_unplanned: taskData.created_from === 'tasks' ? 1 : 0,
              is_starred: effectiveStatus === 'pending' ? 0 : taskData.is_starred ? 1 : 0,
              is_new: 0,
              subtasks: Array.isArray(taskData.subtasks) ? taskData.subtasks : [],
              can_edit: true,
              can_delete: true,
            };
          });
          setTasks((prev) => [...prev, ...createdTasks]);
          if (isPendingMeeting) {
            createdTasks.forEach((created, idx) => {
              scheduleTaskMotionFeedback({
                taskId: created.id,
                tone: 'accent',
                mode: 'appear',
                scrollIfOffscreen: idx === 0,
              });
            });
          } else if (createdTasks.length > 0) {
            setLastCreatedBatch({
              ids: createdTasks.map((c) => c.id),
              status: createdTasks[0].status,
              propertyId: createdTasks[0].property_id ?? null,
              seq: Date.now(),
            });
          }
          notifySuccess(
            createdTasks.length > 1
              ? `${createdTasks.length} tâches créées localement.`
              : 'Tâche créée localement.'
          );
        }
      }
    },
    [currentSprintId, currentUser, allUsers, properties, reloadSprintDetails, notifySuccess, notifyError]
  );

  const updateTaskStatus = useCallback(
    async (taskId: number, newStatus: TaskStatus) => {
      const prevTask = tasksRef.current.find((t) => t.id === taskId);
      const snapshot = captureTaskSnapshot(taskId);
      const fallbackSelector = prevTask?.assigned_to
        ? `[data-retro-accordion-trigger="${prevTask.assigned_to}"]`
        : null;

      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'move',
        snapshot,
        fallbackSelector,
      });

      try {
        await api.updateTaskStatus(taskId, newStatus, currentSprintId || undefined);
        notifySuccess(`Statut mis à jour : ${STATUS_LABELS[newStatus]}`);
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (prevTask) {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: prevTask.status } : t)));
          }
          notifyError(err, 'Impossible de modifier le statut de cette tâche.');
        }
      }
    },
    [currentSprintId, notifySuccess, notifyError]
  );

  const reorderKanbanTask = useCallback(
    async (taskId: number, targetStatus: TaskStatus, orderedColumnTaskIds: number[]) => {
      const previousTasks = tasksRef.current;
      const previousTask = previousTasks.find((t) => t.id === taskId);
      const statusChanged = previousTask && previousTask.status !== targetStatus;
      const snapshot = captureTaskSnapshot(taskId);

      setTasks((prev) => {
        const updated = prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t));
        return reorderTasksInSubset(updated, orderedColumnTaskIds);
      });
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'move',
        snapshot,
      });

      if (currentSprintId) {
        try {
          await api.reorderTasks({
            sprint_id: currentSprintId,
            task_id: taskId,
            status: targetStatus,
            ordered_task_ids: orderedColumnTaskIds,
          });
          notifySuccess(
            statusChanged
              ? `Tâche déplacée vers ${STATUS_LABELS[targetStatus]}.`
              : 'Ordre des tâches mis à jour.'
          );
        } catch (err: any) {
          if (!isNetworkError(err)) {
            setTasks(previousTasks);
            notifyError(err, 'Impossible de déplacer cette tâche.');
          }
        }
      }
    },
    [currentSprintId, notifySuccess, notifyError]
  );

  const moveTaskProperty = useCallback(
    async (taskId: number, targetPropertyId: number | null, orderedSectionTaskIds: number[]) => {
      const previousTasks = tasksRef.current;
      const previousTask = previousTasks.find((t) => t.id === taskId);
      const propertyChanged = (previousTask?.property_id ?? null) !== targetPropertyId;
      const targetProp = targetPropertyId ? properties.find((p) => p.id === targetPropertyId) : null;
      const snapshot = captureTaskSnapshot(taskId);

      setTasks((prev) => {
        const updated = prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                property_id: targetPropertyId,
                property_name: targetProp?.name || undefined,
                property_color: targetProp?.color || undefined,
                property_code: targetProp?.code || undefined,
              }
            : t
        );
        return reorderTasksInSubset(updated, orderedSectionTaskIds);
      });
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'move',
        snapshot,
      });

      if (currentSprintId) {
        try {
          await api.reorderTasks({
            sprint_id: currentSprintId,
            task_id: taskId,
            property_id: targetPropertyId,
            ordered_task_ids: orderedSectionTaskIds,
          });
          notifySuccess(
            propertyChanged
              ? targetProp
                ? `Tâche déplacée vers « ${targetProp.name} ».`
                : 'Tâche déplacée vers « Sans logement ».'
              : 'Ordre des tâches mis à jour.'
          );
        } catch (err: any) {
          if (!isNetworkError(err)) {
            setTasks(previousTasks);
            notifyError(err, 'Impossible de changer le logement de cette tâche.');
          }
        }
      }
    },
    [currentSprintId, properties, notifySuccess, notifyError]
  );

  const assignTask = useCallback(
    async (taskId: number, userId: number | null) => {
      const prevTask = tasksRef.current.find((t) => t.id === taskId);
      const targetUser = userId ? allUsers.find((u) => u.id === userId) : undefined;
      const snapshot = captureTaskSnapshot(taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                assigned_to: userId,
                assigned_to_name: targetUser?.name,
                assigned_to_initials: targetUser?.initials,
                assigned_to_color: targetUser?.avatar_color,
              }
            : t
        )
      );
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'move',
        snapshot,
      });

      try {
        await api.updateTask(taskId, {
          assigned_to: userId,
          sprint_id: currentSprintId || undefined,
        });
        notifySuccess(
          targetUser
            ? `Tâche attribuée à ${targetUser.name}.`
            : 'Responsable retiré (tâche à attribuer).'
        );
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (prevTask) {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? prevTask : t)));
          }
          notifyError(err, "Impossible d'attribuer cette tâche.");
        }
      }
    },
    [currentSprintId, allUsers, notifySuccess, notifyError]
  );

  const quickUpdateTask = useCallback(
    async (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => {
      const prevTask = tasksRef.current.find((t) => t.id === taskId);
      const snapshot = captureTaskSnapshot(taskId);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'update',
        snapshot,
      });

      try {
        await api.updateTask(taskId, {
          sprint_id: currentSprintId || undefined,
          ...patch,
        });
        if (patch.priority !== undefined) {
          notifySuccess('Priorité mise à jour.');
        } else if (patch.due_date !== undefined) {
          notifySuccess(patch.due_date ? 'Échéance mise à jour.' : 'Échéance retirée.');
        }
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (prevTask) {
            setTasks((prev) => prev.map((t) => (t.id === taskId ? prevTask : t)));
          }
          notifyError(err, 'Impossible de mettre à jour cette tâche.');
        }
      }
    },
    [currentSprintId, notifySuccess, notifyError]
  );

  const deleteTask = useCallback(
    async (id: number) => {
      const confirmed = await confirm({
        title: 'Supprimer la tâche',
        message: 'Voulez-vous vraiment supprimer cette tâche ? Cette action est irréversible.',
        confirmLabel: 'Supprimer',
        variant: 'danger',
      });
      if (!confirmed) return;

      const previousTasks = tasksRef.current;
      const snapshot = captureTaskSnapshot(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      scheduleTaskMotionFeedback({
        taskId: id,
        tone: 'accent',
        mode: 'disappear',
        snapshot,
      });

      try {
        await api.deleteTask(id, currentSprintId || undefined);
        notifySuccess('Tâche supprimée.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          setTasks(previousTasks);
          notifyError(err, 'Impossible de supprimer cette tâche.');
        }
      }
    },
    [confirm, currentSprintId, notifySuccess, notifyError]
  );

  const toggleSubtask = useCallback(
    async (subtaskId: number) => {
      const previousSubtask = tasksRef.current
        .flatMap((t) => t.subtasks || [])
        .find((st) => st.id === subtaskId);
      const wasDone = !!previousSubtask?.is_done;

      setTasks((prev) =>
        prev.map((t) => ({
          ...t,
          subtasks: (t.subtasks || []).map((st) =>
            st.id === subtaskId ? { ...st, is_done: !st.is_done } : st
          ),
        }))
      );

      try {
        await api.toggleSubtask(subtaskId, currentSprintId || undefined);
        notifySuccess(wasDone ? 'Sous-étape réouverte.' : 'Sous-étape validée.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          setTasks((prev) =>
            prev.map((t) => ({
              ...t,
              subtasks: (t.subtasks || []).map((st) =>
                st.id === subtaskId ? { ...st, is_done: wasDone } : st
              ),
            }))
          );
          notifyError(err, 'Impossible de modifier cette sous-tâche.');
        }
      }
    },
    [currentSprintId, notifySuccess, notifyError]
  );

  const addSubtask = useCallback(
    async (taskId: number, title: string, parentId?: number | null) => {
      const trimmed = title.trim();
      if (!trimmed) {
        const err = new Error('Le titre de la sous-étape est obligatoire.');
        notifyError(err, err.message);
        throw err;
      }
      try {
        await api.addSubtask(taskId, trimmed, parentId, currentSprintId || undefined);
        if (currentSprintId) {
          await reloadSprintDetails(currentSprintId);
        }
        notifySuccess('Sous-étape ajoutée.');
      } catch (err: any) {
        notifyError(err, "Erreur lors de l'ajout de la sous-tâche.");
        throw err;
      }
    },
    [currentSprintId, reloadSprintDetails, notifySuccess, notifyError]
  );

  const toggleStar = useCallback(
    async (taskId: number) => {
      const prevTask = tasksRef.current.find((t) => t.id === taskId);
      const wasStarred = !!prevTask?.is_starred;
      const snapshot = captureTaskSnapshot(taskId);
      const fallbackSelector =
        wasStarred && prevTask?.assigned_to
          ? `[data-retro-accordion-trigger="${prevTask.assigned_to}"]`
          : null;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, is_starred: !t.is_starred } : t))
      );
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'move',
        snapshot,
        fallbackSelector,
      });

      try {
        await api.toggleTaskStar(taskId, currentSprintId || undefined);
        notifySuccess(wasStarred ? 'Mise en avant retirée.' : 'Tâche mise en avant pour la réunion.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, is_starred: wasStarred } : t))
          );
          notifyError(err, 'Impossible de modifier la mise en avant.');
        }
      }
    },
    [currentSprintId, notifySuccess, notifyError]
  );

  const consumeLastCreatedBatch = useCallback(() => setLastCreatedBatch(null), []);

  return {
    tasks,
    setTasks,
    lastCreatedBatch,
    consumeLastCreatedBatch,
    saveTask,
    updateTaskStatus,
    quickUpdateTask,
    reorderKanbanTask,
    moveTaskProperty,
    assignTask,
    deleteTask,
    toggleSubtask,
    addSubtask,
    toggleStar,
  };
}
