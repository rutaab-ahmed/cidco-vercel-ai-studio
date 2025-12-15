
import { PlotRecord, SummaryData, User } from '../types';
import { MOCK_USERS, MOCK_RECORDS } from './mockData';

// Determine if we should use Mock Data (for Vercel/Demo) or Real Backend (Local)
// In Vite, env vars are accessed via import.meta.env
const USE_MOCK = (import.meta as any).env.VITE_USE_MOCK === 'true';

const API_BASE = 'http://localhost:8083/api';

// --- MOCK LOGIC HELPERS ---
const mockLogic = {
  getSummary: (groupByField: string, node?: string, sector?: string) => {
    // Filter first
    let filtered = MOCK_RECORDS;
    if (node) filtered = filtered.filter(r => r.NAME_OF_NODE === node);
    if (sector) filtered = filtered.filter(r => r.SECTOR_NO_ === sector);

    // Group and Sum
    const groups: Record<string, { area: number, count: number }> = {};
    
    filtered.forEach(r => {
      const key = r[groupByField] || 'Unknown';
      const area = parseFloat(String(r.PLOT_AREA_FOR_INVOICE || '0').replace(/[^0-9.]/g, '')) || 0;
      const addCount = parseFloat(String(r.Additional_Plot_Count || '0').replace(/[^0-9.]/g, '')) || 0;

      if (!groups[key]) groups[key] = { area: 0, count: 0 };
      groups[key].area += area;
      groups[key].count += addCount;
    });

    const totalArea = Object.values(groups).reduce((sum, g) => sum + g.area, 0);

    return Object.entries(groups).map(([category, stats]) => ({
      category,
      area: stats.area,
      additionalCount: stats.count,
      percent: totalArea > 0 ? parseFloat(((stats.area / totalArea) * 100).toFixed(2)) : 0
    })).sort((a, b) => a.category.localeCompare(b.category));
  }
};

export const ApiService = {
  // --- Auth ---
  async login(username: string, password: string): Promise<{ user: User | null; error?: string }> {
    if (USE_MOCK) {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 500));
      const user = MOCK_USERS.find(u => u.username === username && u.password === password);
      if (user) {
        // Return user without password
        const { password: _, ...cleanUser } = user;
        return { user: cleanUser };
      }
      return { user: null, error: 'Invalid credentials (Mock: try admin/admin)' };
    }

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        const err = await res.json();
        return { user: null, error: err.error || 'Login failed' };
      }
      return { user: await res.json() };
    } catch (e) {
      console.error(e);
      return { user: null, error: 'Cannot connect to server' };
    }
  },

  async addUser(userData: Partial<User> & { password: string }): Promise<{ success: boolean; message: string }> {
    if (USE_MOCK) {
       return { success: true, message: "User created (Mock Mode - not saved permanently)" };
    }
    try {
      const res = await fetch(`${API_BASE}/users/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      return { success: res.ok, message: data.message || data.error };
    } catch (e) {
      return { success: false, message: 'Network error' };
    }
  },

  async updatePassword(userId: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCK) return { success: true, message: "Password updated (Mock Mode)" };
    
    try {
      const res = await fetch(`${API_BASE}/users/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword })
      });
      const data = await res.json();
      return { success: res.ok, message: data.message || data.error };
    } catch (e) {
      return { success: false, message: 'Network error' };
    }
  },

  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCK) return { success: true, message: "Mock Email sent successfully." };
    try {
      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      const data = await res.json();
      return { success: res.ok, message: data.message || data.error };
    } catch (e) {
      return { success: false, message: 'Network error' };
    }
  },

  async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCK) return { success: true, message: "Password reset successful (Mock Mode)" };
    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      return { success: res.ok, message: data.message || data.error };
    } catch (e) {
      return { success: false, message: 'Network error' };
    }
  },

  // --- Data Fetching ---

  async getNodes(): Promise<string[]> {
    if (USE_MOCK) {
      const nodes = new Set(MOCK_RECORDS.map(r => r.NAME_OF_NODE).filter(Boolean));
      return Array.from(nodes).sort();
    }
    const res = await fetch(`${API_BASE}/nodes`);
    return await res.json();
  },

  async getSectors(node: string): Promise<string[]> {
    if (USE_MOCK) {
      const sectors = new Set(
        MOCK_RECORDS
          .filter(r => r.NAME_OF_NODE === node)
          .map(r => r.SECTOR_NO_)
          .filter(Boolean)
      );
      // Simple numeric sort if possible
      return Array.from(sectors).sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
    }
    const res = await fetch(`${API_BASE}/sectors?node=${encodeURIComponent(node)}`);
    return await res.json();
  },

  async getBlocks(node: string, sector: string): Promise<string[]> {
    if (USE_MOCK) {
      const blocks = new Set(
        MOCK_RECORDS
          .filter(r => r.NAME_OF_NODE === node && r.SECTOR_NO_ === sector)
          .map(r => r.BLOCK_ROAD_NAME)
          .filter(Boolean)
      );
      return Array.from(blocks).sort();
    }
    const res = await fetch(`${API_BASE}/blocks?node=${encodeURIComponent(node)}&sector=${encodeURIComponent(sector)}`);
    return await res.json();
  },

  async getPlots(node: string, sector: string): Promise<string[]> {
    if (USE_MOCK) {
      const plots = new Set(
        MOCK_RECORDS
          .filter(r => r.NAME_OF_NODE === node && r.SECTOR_NO_ === sector)
          .map(r => r.PLOT_NO_)
          .filter(Boolean)
      );
      return Array.from(plots).sort();
    }
    const res = await fetch(`${API_BASE}/plots?node=${encodeURIComponent(node)}&sector=${encodeURIComponent(sector)}`);
    return await res.json();
  },

  async searchRecords(node: string, sector: string, block?: string, plot?: string): Promise<PlotRecord[]> {
    if (USE_MOCK) {
      await new Promise(r => setTimeout(r, 400)); // fake delay
      return MOCK_RECORDS.filter(r => {
        let match = r.NAME_OF_NODE === node && r.SECTOR_NO_ === sector;
        if (block) match = match && r.BLOCK_ROAD_NAME === block;
        if (plot) match = match && r.PLOT_NO_ === plot;
        return match;
      });
    }
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node, sector, block, plot })
    });
    return await res.json();
  },

  async getRecordById(id: string): Promise<PlotRecord | undefined> {
    if (USE_MOCK) {
      return MOCK_RECORDS.find(r => r.ID === id);
    }
    const res = await fetch(`${API_BASE}/record/${id}`);
    if (!res.ok) return undefined;
    return await res.json();
  },

  async updateRecord(id: string, updates: Record<string, any>): Promise<boolean> {
    if (USE_MOCK) {
      const index = MOCK_RECORDS.findIndex(r => r.ID === id);
      if (index !== -1) {
        MOCK_RECORDS[index] = { ...MOCK_RECORDS[index], ...updates };
        return true;
      }
      return false;
    }
    try {
      const res = await fetch(`${API_BASE}/record/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ID: id, ...updates })
      });
      return res.ok;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async getDashboardSummary(node?: string, sector?: string): Promise<SummaryData[]> {
    if (USE_MOCK) {
      return mockLogic.getSummary('PLOT_USE_FOR_INVOICE', node, sector);
    }
    let url = `${API_BASE}/summary`;
    const params = new URLSearchParams();
    if (node) params.append('node', node);
    if (sector) params.append('sector', sector);
    if (params.toString()) url += `?${params.toString()}`;
    
    const res = await fetch(url);
    return await res.json();
  },

  async getDepartmentSummary(node?: string, sector?: string): Promise<SummaryData[]> {
    if (USE_MOCK) {
      return mockLogic.getSummary('Department_Remark', node, sector);
    }
    let url = `${API_BASE}/summary/department`;
    const params = new URLSearchParams();
    if (node) params.append('node', node);
    if (sector) params.append('sector', sector);
    if (params.toString()) url += `?${params.toString()}`;
    
    const res = await fetch(url);
    return await res.json();
  }
};
