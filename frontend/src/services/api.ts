import axios from 'axios';
import type {
  AuthResponse, User, Farm, Crop, Scan, Alert, AlertStats,
  DashboardStats, LossPreventionPoint, AlertTypePoint,
  CropPerformancePoint, ResponseTimePoint, WeatherRisk,
  CommunityPost, PostComment, NotificationPreferences, DiseaseReport, ContractDashboard,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const CONTRACT_BASE_URL = BASE_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const contractApi = axios.create({
  baseURL: CONTRACT_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Auth interceptors ──────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('agromind_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

contractApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('agromind_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('agromind_token');
      localStorage.removeItem('agromind_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

contractApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('agromind_token');
      localStorage.removeItem('agromind_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

const unwrap = <T>(res: { data: { data: T } }) => res.data.data;

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body: { name: string; email: string; password: string; phone?: string; location?: string; farm_size?: number; latitude?: number; longitude?: number }) =>
    api.post<{ success: boolean; data: AuthResponse }>('/auth/register', body).then(unwrap),

  login: (email: string, password: string) =>
    api.post<{ success: boolean; data: AuthResponse }>('/auth/login', { email, password }).then(unwrap),

  getMe: () =>
    api.get<{ success: boolean; data: User }>('/auth/me').then(unwrap),

  updateMe: (body: Partial<User>) =>
    api.put<{ success: boolean; data: User }>('/auth/me', body).then(unwrap),

  changePassword: (current_password: string, new_password: string) =>
    api.put('/auth/me/password', { current_password, new_password }).then(r => r.data),
};

// ── Scans ─────────────────────────────────────────────────────────────────
export const scansApi = {
  create: (formData: FormData) =>
    api.post<{ success: boolean; data: Scan }>('/scans', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then(unwrap),

  list: (params?: { status?: string; limit?: number; offset?: number }) =>
    api.get<{ success: boolean; data: Scan[] }>('/scans', { params }).then(unwrap),

  getById: (id: string) =>
    api.get<{ success: boolean; data: Scan }>(`/scans/${id}`).then(unwrap),

  resolve: (id: string, action_taken?: string) =>
    api.put(`/scans/${id}/resolve`, { action_taken }).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/scans/${id}`).then(r => r.data),
};

// ── Alerts ────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (params?: { severity?: string; is_resolved?: boolean; limit?: number }) =>
    api.get<{ success: boolean; data: Alert[] }>('/alerts', { params }).then(unwrap),

  stats: () =>
    api.get<{ success: boolean; data: AlertStats }>('/alerts/stats').then(unwrap),

  nearby: (params?: { lat?: number; lon?: number; radius?: number }) =>
    api.get<{ success: boolean; data: Alert[] }>('/alerts/nearby', { params: params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {} }).then(unwrap),

  heatmap: () =>
    api.get<{ success: boolean; data: Array<{ latitude: number; longitude: number; alert_count: number; severity: string }> }>('/alerts/heatmap').then(unwrap),

  markRead: (id: string) =>
    api.put(`/alerts/${id}/read`).then(r => r.data),

  resolve: (id: string, body?: { action_taken?: string; amount_prevented?: number }) =>
    api.put(`/alerts/${id}/resolve`, body).then(r => r.data),

  delete: (id: string) =>
    api.delete(`/alerts/${id}`).then(r => r.data),
};

// ── Analytics ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () =>
    api.get<{ success: boolean; data: DashboardStats }>('/analytics/dashboard').then(unwrap),

  lossPrevention: (range: 'week' | 'month' | 'year' = 'month') =>
    api.get<{ success: boolean; data: LossPreventionPoint[] }>('/analytics/loss-prevention', { params: { range } }).then(unwrap),

  alertTypes: () =>
    api.get<{ success: boolean; data: AlertTypePoint[] }>('/analytics/alert-types').then(unwrap),

  cropPerformance: () =>
    api.get<{ success: boolean; data: CropPerformancePoint[] }>('/analytics/crop-performance').then(unwrap),

  responseTimes: () =>
    api.get<{ success: boolean; data: ResponseTimePoint[] }>('/analytics/response-times').then(unwrap),

  weatherRisk: (params?: { lat?: number; lon?: number; city?: string }) =>
    api.get<{ success: boolean; data: WeatherRisk }>('/analytics/weather-risk', { params }).then(unwrap),
};

// ── Farms ─────────────────────────────────────────────────────────────────
export const farmsApi = {
  list: () =>
    api.get<{ success: boolean; data: Farm[] }>('/farms').then(unwrap),

  nearby: (radius_km = 10, params?: { lat?: number; lon?: number }) => {
    const cleanParams = params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {};
    return api.get<{ success: boolean; data: (Farm & { distance_km?: number; farmer_name?: string; farmer_location?: string })[] }>('/farms/nearby', { params: { radius_km, ...cleanParams } }).then(unwrap);
  },

  create: (body: Partial<Farm>) =>
    api.post<{ success: boolean; data: Farm }>('/farms', body).then(unwrap),

  getById: (id: string) =>
    api.get<{ success: boolean; data: Farm & { crops: Crop[] } }>(`/farms/${id}`).then(unwrap),

  update: (id: string, body: Partial<Farm>) =>
    api.put<{ success: boolean; data: Farm }>(`/farms/${id}`, body).then(unwrap),

  delete: (id: string) =>
    api.delete(`/farms/${id}`).then(r => r.data),
};

// ── Crops ─────────────────────────────────────────────────────────────────
export const cropsApi = {
  list: (params?: { farm_id?: string; status?: string }) =>
    api.get<{ success: boolean; data: Crop[] }>('/crops', { params }).then(unwrap),

  create: (body: Partial<Crop>) =>
    api.post<{ success: boolean; data: Crop }>('/crops', body).then(unwrap),

  getById: (id: string) =>
    api.get<{ success: boolean; data: Crop }>(`/crops/${id}`).then(unwrap),

  update: (id: string, body: Partial<Crop>) =>
    api.put<{ success: boolean; data: Crop }>(`/crops/${id}`, body).then(unwrap),

  delete: (id: string) =>
    api.delete(`/crops/${id}`).then(r => r.data),
};

// ── Community ─────────────────────────────────────────────────────────────
export const communityApi = {
  posts: (params?: { crop?: string; limit?: number; offset?: number }) =>
    api.get<{ success: boolean; data: CommunityPost[] }>('/community/posts', { params }).then(unwrap),

  mapPosts: (params?: { lat?: number; lon?: number; radius?: number }) =>
    api.get<{ success: boolean; data: CommunityPost[] }>('/community/map', { params: params ? Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) : {} }).then(unwrap),

  getPost: (id: string) =>
    api.get<{ success: boolean; data: CommunityPost }>(`/community/posts/${id}`).then(unwrap),

  create: (body: Partial<CommunityPost>) =>
    api.post<{ success: boolean; data: CommunityPost }>('/community/posts', body).then(unwrap),

  toggleLike: (id: string) =>
    api.post<{ success: boolean; data: { liked: boolean; likes_count: number } }>(`/community/posts/${id}/like`).then(unwrap),

  addComment: (id: string, content: string) =>
    api.post<{ success: boolean; data: PostComment }>(`/community/posts/${id}/comments`, { content }).then(unwrap),

  delete: (id: string) =>
    api.delete(`/community/posts/${id}`).then(r => r.data),
};

// ── Settings ──────────────────────────────────────────────────────────────
export const settingsApi = {
  getNotifications: () =>
    api.get<{ success: boolean; data: NotificationPreferences }>('/settings/notifications').then(unwrap),

  updateNotifications: (body: Partial<NotificationPreferences>) =>
    api.put<{ success: boolean; data: NotificationPreferences }>('/settings/notifications', body).then(unwrap),
};

export const diseaseDetectionApi = {
  scan: (formData: FormData) =>
    contractApi.post<{ success: boolean; data: Scan }>('/scan', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    }).then(unwrap),

  reports: (params?: { page?: number; limit?: number; severity?: 'low' | 'medium' | 'high'; disease?: string; crop_id?: string }) =>
    contractApi.get<{ success: boolean; data: DiseaseReport[]; pagination: { page: number; limit: number; total: number } }>('/reports', { params }).then(r => r.data),

  reportById: (id: string) =>
    contractApi.get<{ success: boolean; data: DiseaseReport }>(`/reports/${id}`).then(unwrap),

  dashboard: () =>
    contractApi.get<{ success: boolean; data: ContractDashboard }>('/dashboard').then(unwrap),

  alerts: (params?: { limit?: number; offset?: number; severity?: 'low' | 'medium' | 'high' }) =>
    contractApi.get<{ success: boolean; data: Array<{ id: string; report_id?: string; message: string; severity: 'low' | 'medium' | 'high'; is_active: boolean; created_at: string }> }>('/alerts', { params }).then(unwrap),
};
