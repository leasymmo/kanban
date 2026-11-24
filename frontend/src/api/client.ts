import { Sprint, Task, Question, User, Property } from '../types';

const API_BASE = '/api';

function getStoredToken(): string | null {
  return localStorage.getItem('kanban_token');
}

function getStoredUserId(): string | null {
  return localStorage.getItem('kanban_current_user_id');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const userId = getStoredUserId();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (userId) {
    headers.set('X-User-Id', userId);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Erreur serveur (${response.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  setCurrentUserId(id: number) {
    localStorage.setItem('kanban_current_user_id', String(id));
  },

  getCurrentUserId(): number | null {
    const val = localStorage.getItem('kanban_current_user_id');
    return val ? Number(val) : null;
  },

  // Auth
  async login(userIdOrEmail: number | string, password?: string, direct?: boolean) {
    const body: Record<string, any> = { password: password || 'password123' };
    if (typeof userIdOrEmail === 'number') {
      body.user_id = userIdOrEmail;
    } else {
      body.email = userIdOrEmail;
    }
    if (direct) body.direct = true;

    const res = await request<{ success: boolean; token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (res.token) {
      localStorage.setItem('kanban_token', res.token);
    }
    return res;
  },

  async getMe() {
    return request<{ success: boolean; user: User }>('/auth/me');
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('kanban_token');
    }
  },

  // Users & Properties
  async getUsers() {
    return request<{ success: boolean; users: User[] }>('/users');
  },

  async getProperties() {
    return request<{ success: boolean; properties: Property[] }>('/properties');
  },

  // Sprints
  async getSprints() {
    return request<{ success: boolean; sprints: Sprint[] }>('/sprints');
  },

  async getCurrentSprint() {
    return request<{ success: boolean; sprint: Sprint }>('/sprints/current');
  },

  async getSprintDetails(id: number) {
    return request<{
      success: boolean;
      sprint: Sprint;
      tasks: Task[];
      questions: Question[];
      is_read_only: boolean;
    }>(`/sprints/${id}`);
  },

  async closeSprint(id: number, nextName?: string, notes?: string) {
    return request<{
      success: boolean;
      message: string;
      new_sprint_id: number;
      stats: { tasks_rolled_over: number; subtasks_rolled_over: number };
    }>(`/sprints/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ next_name: nextName, notes })
    });
  },

  // Tasks
  async createTask(data: Partial<Task> & { sprint_id: number; subtasks?: string[] }) {
    return request<{ success: boolean; task_id: number; message: string }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTask(id: number, data: Partial<Task>) {
    return request<{ success: boolean; message: string }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async updateTaskStatus(id: number, status: Task['status']) {
    return request<{ success: boolean }>(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async deleteTask(id: number) {
    return request<{ success: boolean }>(`/tasks/${id}`, {
      method: 'DELETE'
    });
  },

  // Subtasks
  async addSubtask(taskId: number, title: string) {
    return request<{ success: boolean; subtask_id: number }>(`/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  },

  async toggleSubtask(subtaskId: number) {
    return request<{ success: boolean; is_done: number }>(`/subtasks/${subtaskId}/toggle`, {
      method: 'PATCH'
    });
  },

  async deleteSubtask(subtaskId: number) {
    return request<{ success: boolean }>(`/subtasks/${subtaskId}`, {
      method: 'DELETE'
    });
  },

  // Questions
  async getQuestions(sprintId: number) {
    return request<{ success: boolean; sprint_id: number; questions: Question[] }>(`/questions?sprint_id=${sprintId}`);
  },

  async createQuestion(data: { sprint_id: number; title: string; details?: string; user_id?: number }) {
    return request<{ success: boolean; question_id: number }>(`/questions`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateQuestion(id: number, data: Partial<Question>) {
    return request<{ success: boolean }>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteQuestion(id: number) {
    return request<{ success: boolean }>(`/questions/${id}`, {
      method: 'DELETE'
    });
  }
};
