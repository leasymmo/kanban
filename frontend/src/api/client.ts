import { Sprint, Task, Question, QuestionAnswer, User, Property } from '../types';

function getStoredToken(): string | null {
  return localStorage.getItem('kanban_token');
}

export function getApiBase(): string {
  if (typeof window === 'undefined') return '/api';

  const env = (import.meta as any).env;
  // En environnement de développement local avec Vite
  if (env && env.VITE_API_URL && !env.PROD) {
    return env.VITE_API_URL + '/api';
  }

  // Détection dynamique du dossier d'hébergement (ex: /kanban/ ou /)
  const pathname = window.location.pathname.replace(/\/index\.html.*$/, '');
  const cleanBase = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return `${cleanBase}/api`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const apiBase = getApiBase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${apiBase}${cleanEndpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Erreur serveur (${response.status}) sur ${url}`;
    const err = new Error(errorMsg) as Error & { status?: number };
    err.status = response.status;
    throw err;
  }

  return data;
}

export const api = {

  // Auth
  async login(userIdOrEmail: number | string, password?: string) {
    const body: Record<string, any> = { password: password || 'password123' };
    if (typeof userIdOrEmail === 'number') {
      body.user_id = userIdOrEmail;
    } else {
      body.email = userIdOrEmail;
    }

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

  async createUser(data: { name: string; email: string; password?: string; role: string; avatar_color?: string; initials?: string }) {
    return request<{ success: boolean; message: string; user: User }>('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateUser(id: number, data: { name?: string; email?: string; password?: string; role?: string; avatar_color?: string; initials?: string }) {
    return request<{ success: boolean; message: string; user: User }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteUser(id: number) {
    return request<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'DELETE'
    });
  },

  async getProperties(includeInactive: boolean = false) {
    const query = includeInactive ? '?include_inactive=1' : '';
    return request<{ success: boolean; properties: Property[] }>(`/properties${query}`);
  },

  async createProperty(data: { name: string; code?: string; color?: string }) {
    return request<{ success: boolean; message: string; property: Property }>('/properties', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProperty(id: number, data: { name?: string; code?: string; color?: string }) {
    return request<{ success: boolean; message: string; property: Property }>(`/properties/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async getPropertyPendingTasks(id: number) {
    return request<{
      success: boolean;
      active_sprint: { id: number; name: string; number: number } | null;
      tasks: { id: number; title: string; status: string }[];
    }>(`/properties/${id}/pending-tasks`);
  },

  async deactivateProperty(id: number, pendingAction?: 'detach' | 'delete') {
    return request<{ success: boolean; message: string; property: Property; resolved_count: number }>(
      `/properties/${id}/deactivate`,
      {
        method: 'POST',
        body: JSON.stringify(pendingAction ? { pending_action: pendingAction } : {})
      }
    );
  },

  async reactivateProperty(id: number) {
    return request<{ success: boolean; message: string; property: Property }>(
      `/properties/${id}/reactivate`,
      { method: 'POST' }
    );
  },

  async reorderProperties(orderedPropertyIds: number[]) {
    return request<{ success: boolean; message: string; properties: Property[] }>(
      '/properties/reorder',
      {
        method: 'PATCH',
        body: JSON.stringify({ ordered_property_ids: orderedPropertyIds })
      }
    );
  },

  // Sprints
  async getSprints() {
    return request<{ success: boolean; sprints: Sprint[] }>('/sprints');
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
      stats: { tasks_rolled_over: number; subtasks_rolled_over: number; meeting_tasks_activated?: number };
    }>(`/sprints/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ next_name: nextName, notes })
    });
  },

  async reopenSprint(id: number) {
    return request<{
      success: boolean;
      message: string;
      sprint_id: number;
    }>(`/sprints/${id}/reopen`, {
      method: 'POST'
    });
  },

  async updateSprint(id: number, data: Partial<Sprint>) {
    return request<{
      success: boolean;
      message: string;
    }>(`/sprints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteSprint(id: number) {
    return request<{
      success: boolean;
      message: string;
    }>(`/sprints/${id}`, {
      method: 'DELETE'
    });
  },

  // Tasks
  async createTask(data: Partial<Task> & {
    sprint_id: number;
    property_ids?: (number | null)[];
    created_from?: 'tasks' | 'meeting' | 'meeting_pending';
    pending_for_next_sprint?: boolean;
    subtasks?: any[];
  }) {
    return request<{
      success: boolean;
      task_id: number;
      task_ids?: number[];
      created_count?: number;
      pending_for_next_sprint?: boolean;
      message: string;
    }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateTask(id: number, data: Partial<Task> & { subtasks?: any[] }) {
    return request<{ success: boolean; message: string }>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async reorderTasks(data: {
    sprint_id: number;
    task_id: number;
    status?: Task['status'];
    property_id?: number | null;
    ordered_task_ids: number[];
  }) {
    return request<{ success: boolean; message: string }>('/tasks/reorder', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  },

  async updateTaskStatus(id: number, status: Task['status'], sprintId?: number) {
    return request<{ success: boolean }>(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, sprint_id: sprintId })
    });
  },

  async toggleTaskStar(id: number, sprintId?: number) {
    return request<{ success: boolean; task_id: number; is_starred: boolean; message: string }>(`/tasks/${id}/star`, {
      method: 'PATCH',
      body: JSON.stringify({ sprint_id: sprintId })
    });
  },

  async deleteTask(id: number, sprintId?: number) {
    const query = sprintId ? `?sprint_id=${sprintId}` : '';
    return request<{ success: boolean }>(`/tasks/${id}${query}`, {
      method: 'DELETE'
    });
  },

  // Subtasks
  async addSubtask(taskId: number, title: string, parentId?: number | null, sprintId?: number) {
    return request<{ success: boolean; subtask_id: number; subtask?: any }>(`/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: JSON.stringify({ title, parent_id: parentId || null, sprint_id: sprintId })
    });
  },

  async toggleSubtask(subtaskId: number, sprintId?: number) {
    return request<{ success: boolean; is_done: number }>(`/subtasks/${subtaskId}/toggle`, {
      method: 'PATCH',
      body: JSON.stringify({ sprint_id: sprintId })
    });
  },

  // Questions
  async createQuestion(data: { sprint_id: number; title: string; details?: string; user_id?: number }) {
    return request<{ success: boolean; question_id: number; message?: string }>(`/questions`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateQuestion(id: number, data: Partial<Pick<Question, 'title' | 'details' | 'user_id'>>) {
    return request<{ success: boolean }>(`/questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteQuestion(id: number) {
    return request<{ success: boolean }>(`/questions/${id}`, {
      method: 'DELETE'
    });
  },

  // Questions collaborative answers
  async addQuestionAnswer(questionId: number, content: string) {
    return request<{ success: boolean; answer: QuestionAnswer; message: string }>(`/questions/${questionId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  async updateQuestionAnswer(answerId: number, content: string) {
    return request<{ success: boolean; content: string; message: string }>(`/answers/${answerId}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
  },

  async deleteQuestionAnswer(answerId: number) {
    return request<{ success: boolean; message: string }>(`/answers/${answerId}`, {
      method: 'DELETE'
    });
  },

  // Questions definitive decision (in meeting)
  async setQuestionDecision(questionId: number, finalAnswer: string) {
    return request<{
      success: boolean;
      message: string;
      final_answer: string | null;
    }>(`/questions/${questionId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ final_answer: finalAnswer })
    });
  }
};
