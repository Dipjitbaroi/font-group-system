// ✅ ADDED: Font Loading Cache Service
class FontLoadingCache {
  constructor() {
    this.loadingPromises = new Map();
    this.loadedFonts = new Set();
    this.failedFonts = new Set();
  }

  isLoading(fontKey) {
    return this.loadingPromises.has(fontKey);
  }

  isLoaded(fontKey) {
    return this.loadedFonts.has(fontKey);
  }

  hasFailed(fontKey) {
    return this.failedFonts.has(fontKey);
  }

  setLoading(fontKey, promise) {
    this.loadingPromises.set(fontKey, promise);
    
    // Clean up when promise resolves/rejects
    promise
      .then(() => {
        this.loadedFonts.add(fontKey);
        this.loadingPromises.delete(fontKey);
      })
      .catch(() => {
        this.failedFonts.add(fontKey);
        this.loadingPromises.delete(fontKey);
      });
    
    return promise;
  }

  getLoadingPromise(fontKey) {
    return this.loadingPromises.get(fontKey);
  }

  clear() {
    this.loadingPromises.clear();
    this.loadedFonts.clear();
    this.failedFonts.clear();
  }

  removeFont(fontKey) {
    this.loadingPromises.delete(fontKey);
    this.loadedFonts.delete(fontKey);
    this.failedFonts.delete(fontKey);
  }
}

// Global font loading cache instance
const fontLoadingCache = new FontLoadingCache();

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
      // ✅ FIXED: Add timeout to all API requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
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

    // ✅ FIXED: Add timeout for file uploads
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for uploads

    try {
      const result = await this.request(endpoint, {
        method: 'POST',
        headers: {}, // Remove Content-Type to let browser set it for FormData
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

// SOLID Principle: Single Responsibility - Font-specific operations
class FontService extends ApiService {
  async getAllFonts() {
    return this.get('/fonts');
  }

  async uploadFont(file) {
    // ✅ ADDED: Validate file before upload
    if (!file) {
      throw new Error('No file provided');
    }
    
    if (!file.name.toLowerCase().endsWith('.ttf')) {
      throw new Error('Only TTF files are supported');
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Font file is too large (max 10MB)');
    }
    
    return this.uploadFile('/fonts/upload', file);
  }

  async deleteFont(filename) {
    if (!filename) {
      throw new Error('Filename is required');
    }
    
    // ✅ ADDED: Clear font from cache when deleted
    const fontKey = filename.replace('.ttf', '');
    fontLoadingCache.removeFont(fontKey);
    
    return this.delete(`/fonts/${filename}`);
  }
}

// SOLID Principle: Single Responsibility - Group-specific operations
class GroupService extends ApiService {
  async getAllGroups() {
    return this.get('/groups');
  }

  async createGroup(group) {
    // ✅ ADDED: Validate group data
    if (!group || !group.title || !group.fonts || !Array.isArray(group.fonts)) {
      throw new Error('Invalid group data');
    }
    
    if (group.fonts.length < 2) {
      throw new Error('Group must contain at least 2 fonts');
    }
    
    return this.post('/groups', group);
  }

  async updateGroup(id, group) {
    if (!id) {
      throw new Error('Group ID is required');
    }
    
    // ✅ ADDED: Validate group data
    if (!group || !group.title || !group.fonts || !Array.isArray(group.fonts)) {
      throw new Error('Invalid group data');
    }
    
    if (group.fonts.length < 2) {
      throw new Error('Group must contain at least 2 fonts');
    }
    
    return this.put(`/groups/${id}`, group);
  }

  async deleteGroup(id) {
    if (!id) {
      throw new Error('Group ID is required');
    }
    
    return this.delete(`/groups/${id}`);
  }
}

// ✅ ADDED: Font utilities
export const FontUtils = {
  cache: fontLoadingCache,
  
  generateFontKey(font) {
    return `${font.name}-${font.filename}`;
  },
  
  isFontLoaded(fontFamily, weight = 400, style = 'normal') {
    return document.fonts.check(`${weight} ${style} 16px "${fontFamily}"`);
  },
  
  async waitForFontLoad(fontFamily, weight = 400, style = 'normal', timeout = 5000) {
    return new Promise((resolve) => {
      const checkFont = () => {
        if (this.isFontLoaded(fontFamily, weight, style)) {
          resolve(true);
        } else if (timeout <= 0) {
          resolve(false);
        } else {
          timeout -= 100;
          setTimeout(checkFont, 100);
        }
      };
      checkFont();
    });
  },
  
  clearFontCache() {
    fontLoadingCache.clear();
  }
};

// Export service instances
export const fontService = new FontService();
export const groupService = new GroupService();