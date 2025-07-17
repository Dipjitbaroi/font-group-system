// SOLID Principle: Dependency Inversion - API abstraction layer
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  async uploadFile(endpoint, file) {
    const formData = new FormData();
    formData.append('font', file);

    return this.request(endpoint, {
      method: 'POST',
      headers: {}, // Remove Content-Type to let browser set it for FormData
      body: formData,
    });
  }
}

// SOLID Principle: Single Responsibility - Font-specific operations
class FontService extends ApiService {
  async getAllFonts() {
    return this.get('/fonts');
  }

  async uploadFont(file) {
    return this.uploadFile('/fonts/upload', file);
  }

  async deleteFont(filename) {
    return this.delete(`/fonts/${filename}`);
  }
}

// SOLID Principle: Single Responsibility - Group-specific operations
class GroupService extends ApiService {
  async getAllGroups() {
    return this.get('/groups');
  }

  async createGroup(group) {
    return this.post('/groups', group);
  }

  async updateGroup(id, group) {
    return this.put(`/groups/${id}`, group);
  }

  async deleteGroup(id) {
    return this.delete(`/groups/${id}`);
  }
}

// Export service instances
export const fontService = new FontService();
export const groupService = new GroupService();
