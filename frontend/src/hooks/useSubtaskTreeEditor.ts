import { useCallback, useMemo, useState } from 'react';
import { Subtask } from '../types';
import { buildSubtaskTree, HierarchicalSubtask } from '../utils/subtasks';

export interface ModalSubtaskNode {
  id?: number;
  tempId: string;
  title: string;
  is_done: boolean;
  children: ModalSubtaskNode[];
}

function updateTreeNodes(
  nodes: ModalSubtaskNode[],
  updater: (node: ModalSubtaskNode) => ModalSubtaskNode | null
): ModalSubtaskNode[] {
  const result: ModalSubtaskNode[] = [];
  for (const node of nodes) {
    const updated = updater({
      ...node,
      children: updateTreeNodes(node.children, updater),
    });
    if (updated) {
      result.push(updated);
    }
  }
  return result;
}

function countSubtasksRecursive(nodes: ModalSubtaskNode[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const n of nodes) {
    total += 1;
    if (n.is_done) done += 1;
    if (n.children.length > 0) {
      const sub = countSubtasksRecursive(n.children);
      total += sub.total;
      done += sub.done;
    }
  }
  return { total, done };
}

function mapFromHierarchical(nodes: HierarchicalSubtask[], depth = 0): ModalSubtaskNode[] {
  return nodes.map((n, idx) => ({
    id: n.id,
    tempId: `loaded-${n.id}-${idx}-${depth}`,
    title: n.title,
    is_done: !!n.is_done,
    children: depth < 3 && n.children ? mapFromHierarchical(n.children, depth + 1) : [],
  }));
}

function reorderSiblingsInTree(
  nodes: ModalSubtaskNode[],
  parentKey: string,
  draggedTempId: string,
  targetTempId: string,
  position: 'before' | 'after'
): ModalSubtaskNode[] {
  if (parentKey === 'root') {
    const fromIdx = nodes.findIndex((n) => n.tempId === draggedTempId);
    const toIdx = nodes.findIndex((n) => n.tempId === targetTempId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return nodes;

    const copy = [...nodes];
    const [moved] = copy.splice(fromIdx, 1);
    const adjustedTargetIdx = copy.findIndex((n) => n.tempId === targetTempId);
    const insertIdx = position === 'after' ? adjustedTargetIdx + 1 : adjustedTargetIdx;
    copy.splice(insertIdx, 0, moved);
    return copy;
  }

  return nodes.map((node) => {
    if (node.tempId === parentKey) {
      const fromIdx = node.children.findIndex((c) => c.tempId === draggedTempId);
      const toIdx = node.children.findIndex((c) => c.tempId === targetTempId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return node;

      const copy = [...node.children];
      const [moved] = copy.splice(fromIdx, 1);
      const adjustedTargetIdx = copy.findIndex((c) => c.tempId === targetTempId);
      const insertIdx = position === 'after' ? adjustedTargetIdx + 1 : adjustedTargetIdx;
      copy.splice(insertIdx, 0, moved);
      return { ...node, children: copy };
    }

    if (node.children.length > 0) {
      return {
        ...node,
        children: reorderSiblingsInTree(
          node.children,
          parentKey,
          draggedTempId,
          targetTempId,
          position
        ),
      };
    }
    return node;
  });
}

export function useSubtaskTreeEditor() {
  const [subtaskTree, setSubtaskTree] = useState<ModalSubtaskNode[]>([]);

  const initFromSubtasks = useCallback((rawSubtasks: Subtask[]) => {
    setSubtaskTree(mapFromHierarchical(buildSubtaskTree(rawSubtasks || [])));
  }, []);

  const resetTree = useCallback(() => {
    setSubtaskTree([]);
  }, []);

  const addRootSubtask = useCallback((rawTitle: string): boolean => {
    const clean = rawTitle.trim();
    if (!clean) return false;
    setSubtaskTree((prev) => [
      ...prev,
      {
        tempId: `temp-${Date.now()}-${Math.random()}`,
        title: clean,
        is_done: false,
        children: [],
      },
    ]);
    return true;
  }, []);

  const addChildSubtask = useCallback((parentTempId: string, rawTitle: string): boolean => {
    const clean = rawTitle.trim();
    if (!clean) return false;
    const newChild: ModalSubtaskNode = {
      tempId: `temp-${Date.now()}-${Math.random()}`,
      title: clean,
      is_done: false,
      children: [],
    };
    setSubtaskTree((prev) =>
      updateTreeNodes(prev, (node) =>
        node.tempId === parentTempId ? { ...node, children: [...node.children, newChild] } : node
      )
    );
    return true;
  }, []);

  const removeSubtask = useCallback((tempId: string) => {
    setSubtaskTree((prev) =>
      updateTreeNodes(prev, (node) => (node.tempId === tempId ? null : node))
    );
  }, []);

  const toggleSubtask = useCallback((tempId: string) => {
    setSubtaskTree((prev) =>
      updateTreeNodes(prev, (node) =>
        node.tempId === tempId ? { ...node, is_done: !node.is_done } : node
      )
    );
  }, []);

  const updateSubtaskTitle = useCallback((tempId: string, title: string) => {
    setSubtaskTree((prev) =>
      updateTreeNodes(prev, (node) => (node.tempId === tempId ? { ...node, title } : node))
    );
  }, []);

  const reorderSiblings = useCallback(
    (
      parentKey: string,
      draggedTempId: string,
      targetTempId: string,
      position: 'before' | 'after'
    ) => {
      setSubtaskTree((prev) =>
        reorderSiblingsInTree(prev, parentKey, draggedTempId, targetTempId, position)
      );
    },
    []
  );

  const stats = useMemo(() => countSubtasksRecursive(subtaskTree), [subtaskTree]);

  const flattenForSubmit = useCallback(() => {
    const formattedSubtasks: any[] = [];
    let pos = 1;
    const flatten = (
      nodes: ModalSubtaskNode[],
      parentDbId: number | null,
      parentTempId: string | null
    ) => {
      for (const node of nodes) {
        if (!node.title.trim()) continue;
        formattedSubtasks.push({
          id: node.id,
          temp_id: node.tempId,
          parent_id: parentDbId,
          parent_temp_id: parentDbId ? null : parentTempId,
          title: node.title.trim(),
          is_done: node.is_done ? 1 : 0,
          position: pos++,
        });
        if (node.children.length > 0) {
          flatten(node.children, node.id || null, node.id ? null : node.tempId);
        }
      }
    };
    flatten(subtaskTree, null, null);
    return formattedSubtasks;
  }, [subtaskTree]);

  return {
    subtaskTree,
    stats,
    initFromSubtasks,
    resetTree,
    addRootSubtask,
    addChildSubtask,
    removeSubtask,
    toggleSubtask,
    updateSubtaskTitle,
    reorderSiblings,
    flattenForSubmit,
  };
}
