const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export class ApiClient {
  private token: string | null = null;
  private tokenReady: Promise<void> | null = null;
  private resolveTokenReady: (() => void) | null = null;

  constructor() {
    this.tokenReady = new Promise((resolve) => {
      this.resolveTokenReady = resolve;
    });
  }

  setToken(token: string | null) {
    this.token = token;
    console.log('🔑 Token set:', token ? 'EXISTS' : 'NULL');
    
    if (this.resolveTokenReady) {
      this.resolveTokenReady();
      this.resolveTokenReady = null;
    }
  }

  async waitForToken() {
    await this.tokenReady;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    await this.waitForToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
    };

    console.log('📡 Request:', endpoint, { hasToken: !!this.token });

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // ===== TASK METHODS =====
  
  async createTask(taskData: { 
    userId: string; 
    title: string; 
    description?: string; 
    priority?: string;
  }) {
    const response = await this.request<{ task: any }>('/api/uptime/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
    return response.task;
  }

  async getTasks(userId?: string) {
    const response = await this.request<{ tasks: any[] }>(
      '/api/uptime/tasks' + (userId ? `?userId=${userId}` : '')
    );
    return response.tasks;
  }

async updateTask(id: string, updates: { 
  userId?: string;
  title?: string;
  completed?: boolean; 
  description?: string;
  priority?: string;
  hasBlocker?: boolean; // ✅ ADD THIS LINE
}) {
  const response = await this.request<{ task: any }>(`/api/uptime/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
  return response.task;
}

  async deleteTask(id: string) {
    return this.request(`/api/uptime/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async saveSession(data: any) {
    return this.request('/api/uptime/session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getHistory(days: number = 7) {
    return this.request(`/api/uptime/history?days=${days}`);
  }

  async getWeeklyStats() {
    return this.request('/api/uptime/stats/weekly');
  }
}

export const apiClient = new ApiClient();