import React from 'react';
import {
  Hourglass,
  PlayCircle,
  AlertOctagon,
  CheckCircle2,
  ArrowDown,
  Minus,
  Flame,
} from 'lucide-react';
import { TaskPriority, TaskStatus } from '../../types';

export interface StatusMeta {
  id: TaskStatus;
  label: string;
  shortLabel: string;
  color: string;
  bgSoft: string;
}

export const TASK_STATUS_META: Record<TaskStatus, StatusMeta> = {
  todo: {
    id: 'todo',
    label: 'À faire',
    shortLabel: 'À faire',
    color: 'var(--cdh-text-secondary)',
    bgSoft: 'var(--cdh-surface-control)',
  },
  in_progress: {
    id: 'in_progress',
    label: 'En cours',
    shortLabel: 'En cours',
    color: 'var(--cdh-warning)',
    bgSoft: 'var(--cdh-warning-soft)',
  },
  blocked: {
    id: 'blocked',
    label: 'Bloqué',
    shortLabel: 'Bloqué',
    color: 'var(--cdh-danger)',
    bgSoft: 'var(--cdh-danger-soft)',
  },
  done: {
    id: 'done',
    label: 'Terminé',
    shortLabel: 'Terminé',
    color: 'var(--cdh-success)',
    bgSoft: 'var(--cdh-success-soft)',
  },
};

export interface PriorityMeta {
  id: TaskPriority;
  label: string;
  color: string;
  bgSoft: string;
}

export const TASK_PRIORITY_META: Record<TaskPriority, PriorityMeta> = {
  low: {
    id: 'low',
    label: 'Basse',
    color: 'var(--cdh-text-secondary)',
    bgSoft: 'var(--cdh-surface-control)',
  },
  medium: {
    id: 'medium',
    label: 'Moyenne',
    color: 'var(--cdh-accent)',
    bgSoft: 'var(--cdh-accent-soft)',
  },
  high: {
    id: 'high',
    label: 'Haute / Urgente',
    color: 'var(--cdh-danger)',
    bgSoft: 'var(--cdh-danger-soft)',
  },
};

export const TaskStatusIcon: React.FC<{
  status: TaskStatus | 'pending';
  className?: string;
}> = ({ status, className = 'w-4 h-4' }) => {
  const normalized: TaskStatus =
    status && status !== 'pending' && status in TASK_STATUS_META ? status : 'todo';
  const color = (TASK_STATUS_META[normalized] ?? TASK_STATUS_META.todo).color;
  const props = { className, strokeWidth: 2, style: { color }, 'aria-hidden': true as const };

  switch (normalized) {
    case 'in_progress':
      return <PlayCircle {...props} />;
    case 'blocked':
      return <AlertOctagon {...props} />;
    case 'done':
      return <CheckCircle2 {...props} />;
    default:
      return <Hourglass {...props} />;
  }
};

export const TaskPriorityIcon: React.FC<{
  priority: TaskPriority;
  className?: string;
}> = ({ priority, className = 'w-4 h-4' }) => {
  const normalized: TaskPriority =
    priority && priority in TASK_PRIORITY_META ? priority : 'medium';
  const color = (TASK_PRIORITY_META[normalized] ?? TASK_PRIORITY_META.medium).color;
  const props = { className, strokeWidth: 2, style: { color }, 'aria-hidden': true as const };

  switch (normalized) {
    case 'high':
      return <Flame {...props} />;
    case 'low':
      return <ArrowDown {...props} />;
    default:
      return <Minus {...props} />;
  }
};
