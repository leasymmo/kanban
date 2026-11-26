import { useState } from 'react';
import { Task, TaskStatus, Property, User } from '../types';
import { api } from '../api/client';
import { reorderTasksInSubset } from '../utils/subtasks';

interface UseSprintTasksOptions {
  currentSprintId: number | null;
  currentUser: User | null;
  allUsers: User[];
  properties: Property[];
  reloadSprintDetails: (sprintId: number) => Promise<void>;
  onError?: (message: string) => void;
}

export function useSprintTasks({
  currentSprintId,
  currentUser,
  allUsers,
  properties,
  reloadSprintDetails,
  onError
}: UseSprintTasksOptions) {
  const [tasks, setTasks] = useState<Task[]>([]);

  const notifyError = (err: any, fallbackMsg: string) => {
    const msg = err?.message || fallbackMsg;
    if (onError) onError(msg);
    else alert(msg);
  };

  const saveTask = async (taskData: any) => {
    try {
      if (taskData.id) {
        await api.updateTask(taskData.id, {
          sprint_id: currentSprintId || undefined,
          ...taskData
        });
      } else {
        await api.createTask(taskData);
      }
      if (currentSprintId) {
        await reloadSprintDetails(currentSprintId);
      }
    } catch (err: any) {
      // Ne basculer en mode optimiste local que si l'API est injoignable (TypeError réseau)
      if (!(err instanceof TypeError)) {
        throw err;
      }
      const isPendingMeeting =
        taskData.created_from === 'meeting_pending' ||
        taskData.status === 'pending';

      if (taskData.id) {
        setTasks(prev =>
          prev.map(t => {
            if (t.id !== taskData.id) return t;
            const nextAssigned = taskData.assigned_to !== undefined ? taskData.assigned_to : t.assigned_to;
            const nextStatus = t.status === 'pending' ? 'pending' : (taskData.status || t.status);
            return {
              ...t,
              ...taskData,
              assigned_to: nextAssigned,
              status: nextStatus,
              is_starred: nextStatus === 'pending' ? 0 : (taskData.is_starred ?? t.is_starred)
            };
          })
        );
      } else {
        const targetProps: (number | null)[] =
          Array.isArray(taskData.property_ids) && taskData.property_ids.length > 0
            ? taskData.property_ids
            : [taskData.property_id ?? null];

        const createdTasks: Task[] = targetProps.map((propId, pIdx) => {
          const prop = properties.find(p => p.id === propId);
          const effectiveStatus = isPendingMeeting ? 'pending' : (taskData.status || 'todo');
          return {
            id: Date.now() + pIdx,
            sprint_id: currentSprintId || 1,
            title: taskData.title,
            description: taskData.description,
            status: effectiveStatus,
            priority: taskData.priority || 'medium',
            assigned_to: taskData.assigned_to ?? null,
            assigned_to_name: allUsers.find(u => u.id === taskData.assigned_to)?.name,
            assigned_to_initials: allUsers.find(u => u.id === taskData.assigned_to)?.initials,
            assigned_to_color: allUsers.find(u => u.id === taskData.assigned_to)?.avatar_color,
            created_by: currentUser?.id || 1,
            property_id: propId,
            property_name: prop?.name,
            property_color: prop?.color,
            position: tasks.length + pIdx + 1,
            is_unplanned: taskData.created_from === 'tasks' ? 1 : 0,
            is_starred: effectiveStatus === 'pending' ? 0 : (taskData.is_starred ? 1 : 0),
            is_new: 0,
            subtasks: Array.isArray(taskData.subtasks) ? taskData.subtasks : [],
            can_edit: true,
            can_delete: true
          };
        });
        setTasks(prev => [...prev, ...createdTasks]);
      }
    }
  };

  const updateTaskStatus = async (taskId: number, newStatus: TaskStatus) => {
    const previousTasks = tasks;
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await api.updateTaskStatus(taskId, newStatus, currentSprintId || undefined);
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        setTasks(previousTasks);
        notifyError(err, 'Impossible de modifier le statut de cette tâche.');
      }
    }
  };

  const reorderKanbanTask = async (
    taskId: number,
    targetStatus: TaskStatus,
    orderedColumnTaskIds: number[]
  ) => {
    const previousTasks = tasks;
    setTasks(prev => {
      const updated = prev.map(t => (t.id === taskId ? { ...t, status: targetStatus } : t));
      return reorderTasksInSubset(updated, orderedColumnTaskIds);
    });

    if (currentSprintId) {
      try {
        await api.reorderTasks({
          sprint_id: currentSprintId,
          task_id: taskId,
          status: targetStatus,
          ordered_task_ids: orderedColumnTaskIds
        });
      } catch (err: any) {
        if (!(err instanceof TypeError)) {
          setTasks(previousTasks);
          notifyError(err, 'Impossible de déplacer cette tâche.');
        }
      }
    }
  };

  const moveTaskProperty = async (
    taskId: number,
    targetPropertyId: number | null,
    orderedSectionTaskIds: number[]
  ) => {
    const previousTasks = tasks;
    const targetProp = targetPropertyId ? properties.find(p => p.id === targetPropertyId) : null;

    setTasks(prev => {
      const updated = prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              property_id: targetPropertyId,
              property_name: targetProp?.name || undefined,
              property_color: targetProp?.color || undefined,
              property_code: targetProp?.code || undefined
            }
          : t
      );
      return reorderTasksInSubset(updated, orderedSectionTaskIds);
    });

    if (currentSprintId) {
      try {
        await api.reorderTasks({
          sprint_id: currentSprintId,
          task_id: taskId,
          property_id: targetPropertyId,
          ordered_task_ids: orderedSectionTaskIds
        });
      } catch (err: any) {
        if (!(err instanceof TypeError)) {
          setTasks(previousTasks);
          notifyError(err, 'Impossible de changer le logement de cette tâche.');
        }
      }
    }
  };

  const assignTask = async (taskId: number, userId: number | null) => {
    const previousTasks = tasks;
    const targetUser = userId ? allUsers.find(u => u.id === userId) : undefined;
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? {
              ...t,
              assigned_to: userId,
              assigned_to_name: targetUser?.name,
              assigned_to_initials: targetUser?.initials,
              assigned_to_color: targetUser?.avatar_color
            }
          : t
      )
    );

    try {
      await api.updateTask(taskId, {
        assigned_to: userId,
        sprint_id: currentSprintId || undefined
      });
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        setTasks(previousTasks);
        notifyError(err, "Impossible d'attribuer cette tâche.");
      }
    }
  };

  const deleteTask = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer cette tâche ?')) return;
    const previousTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));

    try {
      await api.deleteTask(id, currentSprintId || undefined);
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        setTasks(previousTasks);
        notifyError(err, 'Impossible de supprimer cette tâche.');
      }
    }
  };

  const toggleSubtask = async (subtaskId: number) => {
    const previousTasks = tasks;
    setTasks(prev =>
      prev.map(t => ({
        ...t,
        subtasks: t.subtasks.map(st => (st.id === subtaskId ? { ...st, is_done: !st.is_done } : st))
      }))
    );

    try {
      await api.toggleSubtask(subtaskId, currentSprintId || undefined);
    } catch (err: any) {
      if (!(err instanceof TypeError)) {
        setTasks(previousTasks);
        notifyError(err, 'Impossible de modifier cette sous-tâche.');
      }
    }
  };

  const addSubtask = async (taskId: number, title: string, parentId?: number | null) => {
    try {
      await api.addSubtask(taskId, title, parentId, currentSprintId || undefined);
      if (currentSprintId) {
        await reloadSprintDetails(currentSprintId);
      }
    } catch (err: any) {
      notifyError(err, "Erreur lors de l'ajout de la sous-tâche");
    }
  };

  const toggleStar = async (taskId: number) => {
    const previousTasks = tasks;
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, is_starred: !t.is_starred } : t)));

    try {
      await api.toggleTaskStar(taskId, currentSprintId || undefined);
    } catch (err: any) {
      setTasks(previousTasks);
      notifyError(err, 'Impossible de modifier la mise en avant.');
    }
  };

  return {
    tasks,
    setTasks,
    saveTask,
    updateTaskStatus,
    reorderKanbanTask,
    moveTaskProperty,
    assignTask,
    deleteTask,
    toggleSubtask,
    addSubtask,
    toggleStar
  };
}
