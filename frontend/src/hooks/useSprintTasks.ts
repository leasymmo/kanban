import { useCallback } from 'react';
import { Task, TaskPriority, TaskStatus, Property, User } from '../types';
import { api, isNetworkError } from '../api/client';
import {
  captureTaskSnapshot,
  CreatedTaskBatch,
  scheduleTaskMotionFeedback,
} from '../utils/taskMotion';
import { useConfirm } from '../components/ui';

export interface TaskStoreAdapter {
  findTask: (taskId: number) => Task | undefined;
  findTaskBySubtaskId: (subtaskId: number) => Task | undefined;
  patchTask: (taskId: number, updater: (t: Task) => Task) => void;
  moveTask: (opts: {
    taskId: number;
    targetStatus?: TaskStatus;
    targetPropertyId?: number | null;
    propertyPatch?: { property_name?: string; property_color?: string; property_code?: string };
    orderedColumnIds?: number[];
  }) => void;
  insertCreatedTasks: (createdTasks: Task[]) => void;
  removeTask: (taskId: number) => void;
  refreshFacets?: () => Promise<void>;
  refreshSummary?: () => Promise<void>;
  onCreatedBatch?: (batch: CreatedTaskBatch) => void;
  fallbackReload?: () => Promise<void>;
}

interface UseSprintTasksOptions {
  currentSprintId: number | null;
  currentUser: User | null;
  allUsers: User[];
  properties: Property[];
  store: TaskStoreAdapter;
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
  store,
  onSuccess,
  onError,
}: UseSprintTasksOptions) {
  const confirm = useConfirm();

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

        if (isUpdate) {
          const updatedTask: Task | undefined = res?.task || res?.data;
          if (updatedTask && updatedTask.id) {
            const prev = store.findTask(updatedTask.id);
            if (
              prev &&
              (prev.status !== updatedTask.status ||
                (prev.property_id ?? null) !== (updatedTask.property_id ?? null))
            ) {
              store.moveTask({
                taskId: updatedTask.id,
                targetStatus:
                  updatedTask.status === 'pending' ? undefined : (updatedTask.status as TaskStatus),
                targetPropertyId: updatedTask.property_id ?? null,
                propertyPatch: {
                  property_name: updatedTask.property_name,
                  property_color: updatedTask.property_color,
                  property_code: updatedTask.property_code,
                },
              });
            }
            store.patchTask(updatedTask.id, () => updatedTask);
            store.refreshFacets?.();
          } else {
            await store.fallbackReload?.();
          }
          store.refreshSummary?.();

          scheduleTaskMotionFeedback({
            taskId: taskData.id,
            tone: 'accent',
            mode: 'move',
            snapshot,
          });
        } else {
          const createdTasks: Task[] = Array.isArray(res?.tasks) ? res.tasks : [];
          if (createdTasks.length > 0) {
            store.insertCreatedTasks(createdTasks);
          } else {
            await store.fallbackReload?.();
          }
          store.refreshSummary?.();

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
              store.onCreatedBatch?.({
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
          store.patchTask(taskData.id, (t) => {
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
          });
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
              position: 9999 + pIdx,
              is_unplanned: taskData.created_from === 'tasks' ? 1 : 0,
              is_starred: effectiveStatus === 'pending' ? 0 : taskData.is_starred ? 1 : 0,
              is_new: 0,
              subtasks: Array.isArray(taskData.subtasks) ? taskData.subtasks : [],
              can_edit: true,
              can_delete: true,
            };
          });
          store.insertCreatedTasks(createdTasks);
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
            store.onCreatedBatch?.({
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
    [currentSprintId, currentUser, allUsers, properties, store, notifySuccess, notifyError]
  );

  const updateTaskStatus = useCallback(
    async (taskId: number, newStatus: TaskStatus) => {
      const prevTask = store.findTask(taskId);
      const snapshot = captureTaskSnapshot(taskId);
      const fallbackSelector = prevTask?.assigned_to
        ? `[data-retro-accordion-trigger="${prevTask.assigned_to}"]`
        : null;

      store.moveTask({ taskId, targetStatus: newStatus });
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'move',
        snapshot,
        fallbackSelector,
      });

      try {
        await api.updateTaskStatus(taskId, newStatus, currentSprintId || undefined);
        store.refreshSummary?.();
        notifySuccess(`Statut mis à jour : ${STATUS_LABELS[newStatus]}`);
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (prevTask) {
            store.moveTask({ taskId, targetStatus: prevTask.status as TaskStatus });
          }
          notifyError(err, 'Impossible de modifier le statut de cette tâche.');
        }
      }
    },
    [currentSprintId, store, notifySuccess, notifyError]
  );

  const reorderKanbanTask = useCallback(
    async (taskId: number, targetStatus: TaskStatus, orderedColumnTaskIds: number[]) => {
      const prevTask = store.findTask(taskId);
      const statusChanged = prevTask && prevTask.status !== targetStatus;
      const snapshot = captureTaskSnapshot(taskId);

      store.moveTask({
        taskId,
        targetStatus,
        orderedColumnIds: orderedColumnTaskIds,
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
          if (statusChanged) {
            store.refreshSummary?.();
          }
          notifySuccess(
            statusChanged
              ? `Tâche déplacée vers ${STATUS_LABELS[targetStatus]}.`
              : 'Ordre des tâches mis à jour.'
          );
        } catch (err: any) {
          if (!isNetworkError(err)) {
            await store.fallbackReload?.();
            notifyError(err, 'Impossible de déplacer cette tâche.');
          }
        }
      }
    },
    [currentSprintId, store, notifySuccess, notifyError]
  );

  const moveTaskProperty = useCallback(
    async (taskId: number, targetPropertyId: number | null, orderedSectionTaskIds: number[]) => {
      const prevTask = store.findTask(taskId);
      const propertyChanged = (prevTask?.property_id ?? null) !== targetPropertyId;
      const targetProp = targetPropertyId ? properties.find((p) => p.id === targetPropertyId) : null;
      const snapshot = captureTaskSnapshot(taskId);

      store.moveTask({
        taskId,
        targetPropertyId,
        propertyPatch: {
          property_name: targetProp?.name || undefined,
          property_color: targetProp?.color || undefined,
          property_code: targetProp?.code || undefined,
        },
        orderedColumnIds: orderedSectionTaskIds,
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
            await store.fallbackReload?.();
            notifyError(err, 'Impossible de changer le logement de cette tâche.');
          }
        }
      }
    },
    [currentSprintId, properties, store, notifySuccess, notifyError]
  );

  const assignTask = useCallback(
    async (taskId: number, userId: number | null) => {
      const prevTask = store.findTask(taskId);
      const targetUser = userId ? allUsers.find((u) => u.id === userId) : undefined;
      const snapshot = captureTaskSnapshot(taskId);

      store.patchTask(taskId, (t) => ({
        ...t,
        assigned_to: userId,
        assigned_to_name: targetUser?.name,
        assigned_to_initials: targetUser?.initials,
        assigned_to_color: targetUser?.avatar_color,
      }));
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'move',
        snapshot,
      });

      try {
        const res = await api.updateTask(taskId, {
          assigned_to: userId,
          sprint_id: currentSprintId || undefined,
        });
        if (res.task) {
          store.patchTask(taskId, () => res.task!);
        }
        store.refreshFacets?.();
        store.refreshSummary?.();
        notifySuccess(
          targetUser
            ? `Tâche attribuée à ${targetUser.name}.`
            : 'Responsable retiré (tâche à attribuer).'
        );
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (prevTask) {
            store.patchTask(taskId, () => prevTask);
          }
          notifyError(err, "Impossible d'attribuer cette tâche.");
        }
      }
    },
    [currentSprintId, allUsers, store, notifySuccess, notifyError]
  );

  const quickUpdateTask = useCallback(
    async (taskId: number, patch: { priority?: TaskPriority; due_date?: string | null }) => {
      const prevTask = store.findTask(taskId);
      const snapshot = captureTaskSnapshot(taskId);
      store.patchTask(taskId, (t) => ({ ...t, ...patch }));
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
        store.refreshFacets?.();
        if (patch.priority !== undefined) {
          notifySuccess('Priorité mise à jour.');
        } else if (patch.due_date !== undefined) {
          notifySuccess(patch.due_date ? 'Échéance mise à jour.' : 'Échéance retirée.');
        }
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (prevTask) {
            store.patchTask(taskId, () => prevTask);
          }
          notifyError(err, 'Impossible de mettre à jour cette tâche.');
        }
      }
    },
    [currentSprintId, store, notifySuccess, notifyError]
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

      const snapshot = captureTaskSnapshot(id);
      scheduleTaskMotionFeedback({
        taskId: id,
        tone: 'accent',
        mode: 'disappear',
        snapshot,
      });
      store.removeTask(id);

      try {
        await api.deleteTask(id, currentSprintId || undefined);
        store.refreshSummary?.();
        notifySuccess('Tâche supprimée.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          await store.fallbackReload?.();
          notifyError(err, 'Impossible de supprimer cette tâche.');
        }
      }
    },
    [confirm, currentSprintId, store, notifySuccess, notifyError]
  );

  const toggleSubtask = useCallback(
    async (subtaskId: number) => {
      const parentTask = store.findTaskBySubtaskId(subtaskId);
      const previousSubtask = (parentTask?.subtasks || []).find((st) => st.id === subtaskId);
      const wasDone = !!previousSubtask?.is_done;

      if (parentTask) {
        store.patchTask(parentTask.id, (t) => ({
          ...t,
          subtasks: (t.subtasks || []).map((st) =>
            st.id === subtaskId ? { ...st, is_done: !st.is_done } : st
          ),
        }));
      }

      try {
        const res = await api.toggleSubtask(subtaskId, currentSprintId || undefined);
        if (parentTask) {
          store.patchTask(parentTask.id, (t) => ({
            ...t,
            subtasks: (t.subtasks || []).map((st) =>
              st.id === subtaskId ? { ...st, is_done: res.is_done } : st
            ),
          }));
        }
        notifySuccess(wasDone ? 'Sous-étape réouverte.' : 'Sous-étape validée.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          if (parentTask) {
            store.patchTask(parentTask.id, (t) => ({
              ...t,
              subtasks: (t.subtasks || []).map((st) =>
                st.id === subtaskId ? { ...st, is_done: wasDone } : st
              ),
            }));
          } else {
            await store.fallbackReload?.();
          }
          notifyError(err, 'Impossible de modifier cette sous-tâche.');
        }
      }
    },
    [currentSprintId, store, notifySuccess, notifyError]
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
        const res = await api.addSubtask(taskId, trimmed, parentId, currentSprintId || undefined);
        if (Array.isArray(res.subtasks)) {
          store.patchTask(taskId, (t) => ({ ...t, subtasks: res.subtasks! }));
        } else if (res.subtask) {
          store.patchTask(taskId, (t) => ({ ...t, subtasks: [...(t.subtasks || []), res.subtask] }));
        } else {
          await store.fallbackReload?.();
        }
        notifySuccess('Sous-étape ajoutée.');
      } catch (err: any) {
        notifyError(err, "Erreur lors de l'ajout de la sous-tâche.");
        throw err;
      }
    },
    [currentSprintId, store, notifySuccess, notifyError]
  );

  const toggleStar = useCallback(
    async (taskId: number) => {
      const prevTask = store.findTask(taskId);
      const wasStarred = !!prevTask?.is_starred;
      const snapshot = captureTaskSnapshot(taskId);
      const fallbackSelector =
        wasStarred && prevTask?.assigned_to
          ? `[data-retro-accordion-trigger="${prevTask.assigned_to}"]`
          : null;

      store.patchTask(taskId, (t) => ({ ...t, is_starred: !t.is_starred }));
      scheduleTaskMotionFeedback({
        taskId,
        tone: 'accent',
        mode: 'move',
        snapshot,
        fallbackSelector,
      });

      try {
        await api.toggleTaskStar(taskId, currentSprintId || undefined);
        store.refreshFacets?.();
        notifySuccess(wasStarred ? 'Mise en avant retirée.' : 'Tâche mise en avant pour la réunion.');
      } catch (err: any) {
        if (!isNetworkError(err)) {
          store.patchTask(taskId, (t) => ({ ...t, is_starred: wasStarred }));
          notifyError(err, 'Impossible de modifier la mise en avant.');
        }
      }
    },
    [currentSprintId, store, notifySuccess, notifyError]
  );

  return {
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
