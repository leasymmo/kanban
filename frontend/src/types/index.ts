export type UserRole = 'admin' | 'write' | 'read';

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
  is_active: number;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  is_done: number | boolean;
  position: number;
}

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  id: number;
  sprint_id: number;
  title: string;
  description?: string;
  status: TaskStatus;
  assigned_to: number | null;
  assigned_to_name?: string;
  assigned_to_initials?: string;
  assigned_to_color?: string;
  created_by: number;
  created_by_name?: string;
  property_id: number | null;
  property_name?: string;
  property_code?: string;
  property_color?: string;
  priority: TaskPriority;
  due_date?: string | null;
  position: number;
  is_unplanned?: number | boolean;
  parent_task_id?: number | null;
  subtasks: Subtask[];
  can_edit?: boolean;
  can_delete?: boolean;
  can_assign?: boolean;
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

export type QuestionStatus = 'open' | 'discussed' | 'resolved';

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
  status: QuestionStatus;
  can_edit?: boolean;
  can_delete?: boolean;
}
