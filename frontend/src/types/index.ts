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
  title: string;
  details?: string;
  final_answer?: string | null;
  answers?: QuestionAnswer[];
  can_edit?: boolean;
  can_delete?: boolean;
  can_decide?: boolean;
}
