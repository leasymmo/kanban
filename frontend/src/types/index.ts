type UserRole = 'admin' | 'write' | 'read';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar_color: string;
  initials: string;
}

export interface Property {
  id: number;
  name: string;
  code?: string;
  color: string;
  position?: number;
  is_active: number;
  deleted_at?: string | null;
}

export interface Subtask {
  id: number;
  task_id: number;
  parent_id?: number | null;
  title: string;
  is_done: number | boolean;
  position: number;
  children?: Subtask[];
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  sprint_id: number;
  title: string;
  description?: string;
  status: TaskStatus | 'pending';
  assigned_to: number | null;
  assigned_to_name?: string;
  assigned_to_initials?: string;
  assigned_to_color?: string;
  created_by: number;
  created_by_name?: string;
  created_by_initials?: string;
  created_at?: string;
  updated_at?: string;
  property_id: number | null;
  property_name?: string;
  property_code?: string;
  property_color?: string;
  priority: TaskPriority;
  due_date?: string | null;
  position: number;
  is_unplanned?: number | boolean;
  is_starred?: number | boolean;
  is_new?: number | boolean;
  subtasks: Subtask[];
  can_edit?: boolean;
  can_delete?: boolean;
  can_star?: boolean;
}

export interface Sprint {
  id: number;
  number: number;
  name: string;
  status: 'active' | 'closed';
  started_at: string;
  closed_at?: string | null;
  closed_by_name?: string;
  notes?: string;
  total_tasks?: number;
  done_tasks?: number;
  pending_tasks?: number;
  total_questions?: number;
}

export interface QuestionAnswer {
  id: number;
  question_id: number;
  user_id: number;
  user_name?: string;
  user_initials?: string;
  user_color?: string;
  content: string;
  created_at: string;
  can_edit?: boolean;
  can_delete?: boolean;
}

export interface Question {
  id: number;
  sprint_id: number;
  user_id: number;
  user_name?: string;
  user_initials?: string;
  user_color?: string;
  created_by: number;
  created_by_name?: string;
  created_at?: string;
  title: string;
  details?: string;
  final_answer?: string | null;
  answers?: QuestionAnswer[];
  can_edit?: boolean;
  can_delete?: boolean;
  can_decide?: boolean;
}

export interface PaginationMeta {
  limit: number;
  has_more: boolean;
  has_previous: boolean;
  next_cursor: string | null;
  previous_cursor: string | null;
  total: number | null;
}

export interface TaskFacets {
  status_counts: Record<TaskStatus | 'pending', number>;
  property_counts: Record<string, { total: number; done: number }>;
  assignee_counts: {
    all: number;
    unassigned: number;
    by_user: Record<string, number>;
  };
  total_matching: number;
}

export interface TaskGroupPage {
  key: string;
  label?: string;
  color?: string;
  code?: string;
  is_active?: number;
  done_count?: number;
  data: Task[];
  pagination: PaginationMeta;
}

export interface PaginatedTasksResponse {
  success: boolean;
  sprint_id: number;
  is_read_only: boolean;
  sort?: { by: string; direction: 'asc' | 'desc' };
  data: Task[];
  pagination: PaginationMeta;
  facets?: TaskFacets;
}

export interface GroupedTasksResponse {
  success: boolean;
  sprint_id: number;
  is_read_only: boolean;
  group_by: 'status' | 'property' | 'assignee';
  sort?: { by: string; direction: 'asc' | 'desc' };
  groups: Record<string, TaskGroupPage>;
  facets: TaskFacets;
}

export type TasksApiResponse = PaginatedTasksResponse | GroupedTasksResponse;

export interface QuestionFacets {
  counts_by_user_id: Record<string, number>;
  summary: {
    total: number;
    decided: number;
    undecided: number;
  };
}

export interface PaginatedQuestionsResponse {
  success: boolean;
  sprint_id: number;
  is_read_only: boolean;
  sort?: { by: string; direction: 'asc' | 'desc' };
  data: Question[];
  pagination: PaginationMeta;
  facets?: QuestionFacets;
}

export interface SprintMeetingSummary {
  active_total: number;
  done_count: number;
  carry_over_count: number;
  pending_assigned_count: number;
  pending_unassigned_count: number;
  questions_total: number;
  decided_questions_count: number;
  undecided_questions_count: number;
  per_user_tasks: Record<string, { active: number; done: number; pending: number }>;
  per_user_questions: Record<string, { total: number; decided: number; undecided: number }>;
}

export interface SprintDetailsPayload {
  sprint: Sprint;
  tasks_page: TasksApiResponse;
  questions_page: PaginatedQuestionsResponse;
  meeting_summary: SprintMeetingSummary;
  is_read_only: boolean;
}

export type TaskDueStateFilter = 'all' | 'overdue' | 'with_date' | 'without_date';
export type QuestionDecisionFilter = 'all' | 'decided' | 'undecided';
export type QuestionAnswersFilter = 'all' | 'with_answers' | 'without_answers';
export type QuestionSortKey =
  | 'created_at'
  | 'alpha'
  | 'decision_status'
  | 'answers_count'
  | 'user'
  | 'id';
