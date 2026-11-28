import {
  QuestionAnswersFilter,
  QuestionDecisionFilter,
  QuestionSortKey,
  TaskDueStateFilter,
  TaskPriority,
  TaskStatus,
} from '../types';
import { QueryParamsInput } from '../api/client';
import {
  AssigneeFilter,
  getUserPreferences,
  TaskBoardSortKey,
  TaskListSortDir,
  TaskListSortKey,
  TaskViewMode,
} from './cookies';

export interface TaskQueryCriteria {
  sprintId: number;
  viewMode: TaskViewMode;
  taskFilter: AssigneeFilter;
  search: string;
  hiddenStatuses: TaskStatus[];
  hiddenPriorities: TaskPriority[];
  hiddenPropertyIds: number[];
  dueState: TaskDueStateFilter;
  starredOnly: boolean;
  unplannedOnly: boolean;
  hideEmptyProperties: boolean;
  listSortBy: TaskListSortKey;
  listSortDir: TaskListSortDir;
  boardSortBy: TaskBoardSortKey;
  boardSortDir: TaskListSortDir;
}

export interface QuestionQueryCriteria {
  sprintId: number;
  userFilter: 'me' | 'all' | number;
  search: string;
  decisionStatus: QuestionDecisionFilter;
  hasAnswers: QuestionAnswersFilter;
  answeredByMe: boolean | null;
  sortBy: QuestionSortKey;
  sortDir: 'asc' | 'desc';
}

export function buildTaskQueryParams(criteria: TaskQueryCriteria): QueryParamsInput {
  const isGrouped = criteria.viewMode === 'kanban' || criteria.viewMode === 'property';
  const groupBy =
    criteria.viewMode === 'kanban'
      ? 'status'
      : criteria.viewMode === 'property'
      ? 'property'
      : 'none';

  const sortBy = isGrouped ? criteria.boardSortBy : criteria.listSortBy;
  const sortDirection = isGrouped ? criteria.boardSortDir : criteria.listSortDir;

  const params: QueryParamsInput = {
    sprint_id: criteria.sprintId,
    scope: 'board',
    group_by: groupBy,
    limit: isGrouped ? 20 : 30,
    assignee: criteria.taskFilter,
    sort_by: sortBy,
    sort_direction: sortDirection,
    include_facets: 1,
  };

  if (criteria.viewMode === 'property') {
    params.include_empty = criteria.hideEmptyProperties ? 0 : 1;
  }

  const trimmedSearch = criteria.search.trim();
  if (trimmedSearch !== '') {
    params.search = trimmedSearch;
  }

  if (criteria.hiddenStatuses.length > 0) {
    params.exclude_status = criteria.hiddenStatuses;
  }
  if (criteria.hiddenPriorities.length > 0) {
    params.exclude_priority = criteria.hiddenPriorities;
  }
  if (criteria.hiddenPropertyIds.length > 0) {
    params.exclude_property_id = criteria.hiddenPropertyIds;
  }
  if (criteria.dueState !== 'all') {
    params.due_state = criteria.dueState;
  }
  if (criteria.starredOnly) {
    params.is_starred = 1;
  }
  if (criteria.unplannedOnly) {
    params.is_unplanned = 1;
  }

  return params;
}

export function serializeTaskCriteriaSignature(criteria: TaskQueryCriteria): string {
  return JSON.stringify({
    sprintId: criteria.sprintId,
    viewMode: criteria.viewMode,
    taskFilter: criteria.taskFilter,
    search: criteria.search.trim(),
    hiddenStatuses: [...criteria.hiddenStatuses].sort(),
    hiddenPriorities: [...criteria.hiddenPriorities].sort(),
    hiddenPropertyIds: [...criteria.hiddenPropertyIds].sort((a, b) => a - b),
    dueState: criteria.dueState,
    starredOnly: criteria.starredOnly,
    unplannedOnly: criteria.unplannedOnly,
    hideEmptyProperties: criteria.viewMode === 'property' ? criteria.hideEmptyProperties : false,
    sortBy: criteria.viewMode === 'list' ? criteria.listSortBy : criteria.boardSortBy,
    sortDir: criteria.viewMode === 'list' ? criteria.listSortDir : criteria.boardSortDir,
  });
}

export function buildQuestionQueryParams(criteria: QuestionQueryCriteria): QueryParamsInput {
  const params: QueryParamsInput = {
    sprint_id: criteria.sprintId,
    user_id: criteria.userFilter,
    sort_by: criteria.sortBy,
    sort_direction: criteria.sortDir,
    limit: 20,
    include_facets: 1,
  };

  const trimmedSearch = criteria.search.trim();
  if (trimmedSearch !== '') {
    params.search = trimmedSearch;
  }
  if (criteria.decisionStatus !== 'all') {
    params.decision_status = criteria.decisionStatus;
  }
  if (criteria.hasAnswers !== 'all') {
    params.has_answers = criteria.hasAnswers;
  }
  if (criteria.answeredByMe !== null) {
    params.answered_by_me = criteria.answeredByMe ? 1 : 0;
  }

  return params;
}

export function serializeQuestionCriteriaSignature(criteria: QuestionQueryCriteria): string {
  return JSON.stringify({
    sprintId: criteria.sprintId,
    userFilter: criteria.userFilter,
    search: criteria.search.trim(),
    decisionStatus: criteria.decisionStatus,
    hasAnswers: criteria.hasAnswers,
    answeredByMe: criteria.answeredByMe,
    sortBy: criteria.sortBy,
    sortDir: criteria.sortDir,
  });
}

/**
 * Construit les paramètres optimaux pour /api/bootstrap et /api/sprints/{id}
 * à partir des préférences sauvegardées de l'utilisateur afin d'éliminer toute double requête au démarrage.
 */
export function buildSprintDetailsRequestParams(userId: number | null, sprintId?: number): QueryParamsInput {
  const prefs = userId ? getUserPreferences(userId) : {};
  const viewMode: TaskViewMode = prefs.taskViewMode ?? 'kanban';
  const isGrouped = viewMode === 'kanban' || viewMode === 'property';

  const criteria: TaskQueryCriteria = {
    sprintId: sprintId ?? 0,
    viewMode,
    taskFilter: prefs.taskFilter ?? 'me',
    search: prefs.taskSearchQuery ?? '',
    hiddenStatuses: prefs.hiddenStatuses ?? [],
    hiddenPriorities: prefs.hiddenPriorities ?? [],
    hiddenPropertyIds: prefs.hiddenPropertyIds ?? [],
    dueState: prefs.taskDueState ?? 'all',
    starredOnly: prefs.taskStarredOnly ?? false,
    unplannedOnly: prefs.taskUnplannedOnly ?? false,
    hideEmptyProperties: prefs.hideEmptyProperties ?? true,
    listSortBy: prefs.taskListSortBy ?? 'priority',
    listSortDir: prefs.taskListSortDir ?? 'asc',
    boardSortBy: prefs.taskBoardSortBy ?? 'position',
    boardSortDir: prefs.taskBoardSortDir ?? 'asc',
  };

  const base = buildTaskQueryParams(criteria);
  if (!sprintId) {
    delete base.sprint_id;
  }
  if (!isGrouped) {
    base.group_by = 'none';
  }

  return {
    ...base,
    q_user_id: 'me',
    q_sort_by: 'created_at',
    q_sort_direction: 'asc',
    q_limit: 20,
  };
}
