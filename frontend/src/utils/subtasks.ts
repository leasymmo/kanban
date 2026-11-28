import { Subtask, Task } from '../types';

export interface HierarchicalSubtask extends Subtask {
  depth: number;
  children: HierarchicalSubtask[];
}

export const SUBTASK_DEPTH_THEME = [
  {
    borderClass: 'border-black/[0.12]',
    branchClass: '',
    modalCardClass: 'bg-white border-black/[0.12] hover:border-black/[0.22] shadow-2xs',
    dotClass: 'bg-brand-500',
    iconColorClass: 'text-brand-500',
    label: 'Étape principale'
  },
  {
    borderClass: 'border-indigo-300 ml-2.5 pl-2',
    branchClass: 'border-l-2 border-indigo-300/80 ml-4 pl-3',
    modalCardClass: 'bg-indigo-50/40 border-indigo-200/80 hover:border-indigo-300',
    dotClass: 'bg-indigo-500',
    iconColorClass: 'text-indigo-500',
    label: 'Sous-étape'
  },
  {
    borderClass: 'border-amber-300 ml-2.5 pl-2',
    branchClass: 'border-l-2 border-amber-300/80 ml-4 pl-3',
    modalCardClass: 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300',
    dotClass: 'bg-amber-500',
    iconColorClass: 'text-amber-500',
    label: 'Détail'
  },
  {
    borderClass: 'border-emerald-300 ml-2.5 pl-2',
    branchClass: 'border-l-2 border-emerald-300/80 ml-4 pl-3',
    modalCardClass: 'bg-emerald-50/40 border-emerald-200/80 hover:border-emerald-300',
    dotClass: 'bg-emerald-500',
    iconColorClass: 'text-emerald-500',
    label: 'Point précis'
  }
];

/**
 * Construit un arbre hiérarchique de sous-tâches à partir d'une liste plate
 * avec attribution de la profondeur (depth: 0, 1, 2, 3, etc.)
 */
export function buildSubtaskTree(subtasks: Subtask[]): HierarchicalSubtask[] {
  if (!Array.isArray(subtasks) || subtasks.length === 0) return [];

  const validIds = new Set(subtasks.map((s) => s.id));

  const buildLevel = (
    parentId: number | null,
    depth: number,
    visited: Set<number>
  ): HierarchicalSubtask[] => {
    if (depth > 10) return [];

    const directChildren = subtasks.filter((s) => {
      if (!s || visited.has(s.id)) return false;
      if (parentId === null) {
        // Rattacher à la racine les nœuds sans parent OU orphelins (parent inexistant)
        return (
          s.parent_id === null ||
          s.parent_id === undefined ||
          s.parent_id === 0 ||
          !validIds.has(s.parent_id)
        );
      }
      return s.parent_id === parentId;
    });

    return directChildren.map((s) => {
      const nextVisited = new Set(visited);
      nextVisited.add(s.id);
      return {
        ...s,
        depth,
        children: buildLevel(s.id, depth + 1, nextVisited),
      };
    });
  };

  return buildLevel(null, 0, new Set());
}

/**
 * Calcule récursivement le nombre de sous-tâches totales et terminées
 */
export function calculateSubtaskStats(subtasks: Subtask[]): { total: number; done: number; percent: number } {
  if (!subtasks || subtasks.length === 0) {
    return { total: 0, done: 0, percent: 0 };
  }

  const total = subtasks.length;
  const done = subtasks.filter(s => !!s.is_done).length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, done, percent };
}

/**
 * Parse une date SQL YYYY-MM-DD en Date locale sans décalage UTC
 */
export function parseLocalDate(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.substring(0, 10);
  const parts = clean.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Indique si une tâche non terminée a dépassé sa date d'échéance
 */
export function isTaskOverdue(dueDate?: string | null, status?: Task['status']): boolean {
  if (!dueDate || status === 'done') return false;
  const parsed = parseLocalDate(dueDate);
  if (!parsed) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parsed.getTime() < today.getTime();
}

/**
 * Réordonne un sous-ensemble de tâches au sein de la liste globale du sprint
 * en conservant les positions relatives des tâches masquées par les filtres.
 */
export function reorderTasksInSubset(tasks: Task[], orderedSubsetIds: number[]): Task[] {
  const sorted = [...tasks].sort((a, b) => (a.position - b.position) || (a.id - b.id));
  const byId = new Map(sorted.map(t => [t.id, t]));
  const uniqueValidIds = Array.from(new Set(orderedSubsetIds)).filter(id => byId.has(id));
  const subsetSet = new Set(uniqueValidIds);
  const slots: number[] = [];

  sorted.forEach((t, idx) => {
    if (subsetSet.has(t.id)) {
      slots.push(idx);
    }
  });

  slots.forEach((slotIdx, i) => {
    const replacement = byId.get(uniqueValidIds[i]);
    if (replacement) {
      sorted[slotIdx] = replacement;
    }
  });

  return sorted.map((t, idx) => ({ ...t, position: idx + 1 }));
}
