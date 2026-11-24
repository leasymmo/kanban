import { Subtask } from '../types';

export interface HierarchicalSubtask extends Subtask {
  depth: number;
  children: HierarchicalSubtask[];
}

/**
 * Construit un arbre hiérarchique de sous-tâches à partir d'une liste plate
 * avec attribution de la profondeur (depth: 0, 1, 2, 3, etc.)
 */
export function buildSubtaskTree(
  subtasks: Subtask[],
  parentId: number | null = null,
  depth: number = 0
): HierarchicalSubtask[] {
  if (!subtasks || subtasks.length === 0) return [];

  const directChildren = subtasks.filter(s => {
    if (parentId === null) {
      return s.parent_id === null || s.parent_id === undefined || s.parent_id === 0;
    }
    return s.parent_id === parentId;
  });

  return directChildren.map(s => ({
    ...s,
    depth,
    children: buildSubtaskTree(subtasks, s.id, depth + 1)
  }));
}

/**
 * Aplatit un arbre hiérarchique en liste ordonnée pour l'affichage séquentiel
 */
export function flattenSubtaskTree(tree: HierarchicalSubtask[]): HierarchicalSubtask[] {
  const result: HierarchicalSubtask[] = [];

  function traverse(items: HierarchicalSubtask[]) {
    for (const item of items) {
      result.push(item);
      if (item.children && item.children.length > 0) {
        traverse(item.children);
      }
    }
  }

  traverse(tree);
  return result;
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
