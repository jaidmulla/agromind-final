import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi, analyticsApi, scansApi, communityApi, farmsApi, cropsApi, settingsApi, authApi, diseaseDetectionApi } from '../services/api';
import { toast } from 'sonner';

// ── Dashboard ────────────────────────────────────────────────────────────────
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: analyticsApi.dashboard,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

// ── Alerts ───────────────────────────────────────────────────────────────────
export function useAlerts(params?: { severity?: string; is_resolved?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => alertsApi.list(params),
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useAlertStats() {
  return useQuery({
    queryKey: ['alert-stats'],
    queryFn: alertsApi.stats,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useNearbyAlerts(lat?: number, lon?: number, radius?: number) {
  return useQuery({
    queryKey: ['alerts-nearby', lat, lon, radius],
    queryFn: () => alertsApi.nearby({ lat, lon, radius }),
    staleTime: 60_000,
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action_taken }: { id: string; action_taken?: string }) =>
      alertsApi.resolve(id, { action_taken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alert-stats'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Alert resolved! Loss prevention recorded.');
    },
    onError: () => toast.error('Failed to resolve alert'),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: alertsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      toast.success('Alert removed');
    },
  });
}

// ── Scans ────────────────────────────────────────────────────────────────────
export function useScans(params?: { status?: string; limit?: number }) {
  return useQuery({
    queryKey: ['scans', params],
    queryFn: () => scansApi.list(params),
    staleTime: 30_000,
  });
}

export function useScan(id: string | undefined) {
  return useQuery({
    queryKey: ['scans', id],
    queryFn: () => scansApi.getById(id!),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => diseaseDetectionApi.scan(formData),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans'] });
      qc.invalidateQueries({ queryKey: ['report'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['contract-dashboard'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Scan failed'),
  });
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: ['report', id],
    queryFn: () => diseaseDetectionApi.reportById(id!),
    enabled: !!id,
    staleTime: 15_000,
  });
}

export function useContractDashboard() {
  return useQuery({
    queryKey: ['contract-dashboard'],
    queryFn: diseaseDetectionApi.dashboard,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useContractAlerts() {
  return useQuery({
    queryKey: ['contract-alerts'],
    queryFn: async () => {
      const raw = await alertsApi.list({ is_resolved: false, limit: 20 });
      return raw.map((a) => ({
        id: a.id,
        report_id: a.scan_id,
        message: a.description || a.title,
        severity: (a.severity === 'critical' ? 'high' : a.severity === 'warning' ? 'medium' : 'low') as 'low' | 'medium' | 'high',
        is_active: !a.is_resolved,
        created_at: a.created_at,
      }));
    },
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

export function useResolveScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action_taken }: { id: string; action_taken?: string }) =>
      scansApi.resolve(id, action_taken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scans'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ── Analytics ────────────────────────────────────────────────────────────────
export function useLossPrevention(range: 'week' | 'month' | 'year') {
  return useQuery({
    queryKey: ['analytics-loss', range],
    queryFn: () => analyticsApi.lossPrevention(range),
    staleTime: 60_000,
  });
}

export function useAlertTypes() {
  return useQuery({
    queryKey: ['analytics-alert-types'],
    queryFn: analyticsApi.alertTypes,
    staleTime: 60_000,
  });
}

export function useCropPerformance() {
  return useQuery({
    queryKey: ['analytics-crop-performance'],
    queryFn: analyticsApi.cropPerformance,
    staleTime: 60_000,
  });
}

export function useResponseTimes() {
  return useQuery({
    queryKey: ['analytics-response-times'],
    queryFn: analyticsApi.responseTimes,
    staleTime: 60_000,
  });
}

export function useWeatherRisk(params?: { lat?: number; lon?: number; city?: string }) {
  return useQuery({
    queryKey: ['weather-risk', params?.lat, params?.lon, params?.city],
    queryFn: () => analyticsApi.weatherRisk(params),
    staleTime: 10 * 60_000, // 10 min
    refetchInterval: 5 * 60_000,
    enabled: true,
  });
}

// ── Community ─────────────────────────────────────────────────────────────────
export function useCommunityPosts(params?: { crop?: string; limit?: number }) {
  return useQuery({
    queryKey: ['community-posts', params],
    queryFn: () => communityApi.posts(params),
    staleTime: 30_000,
  });
}

export function useMapPosts(lat?: number, lon?: number, radius?: number) {
  return useQuery({
    queryKey: ['community-map', lat, lon, radius],
    queryFn: () => communityApi.mapPosts({ lat, lon, radius }),
    staleTime: 60_000,
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: communityApi.toggleLike,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-posts'] }),
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: communityApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-posts'] });
      toast.success('Post shared with the community!');
    },
    onError: () => toast.error('Failed to create post'),
  });
}

// ── Farms & Crops ─────────────────────────────────────────────────────────────
export function useFarms() {
  return useQuery({ queryKey: ['farms'], queryFn: farmsApi.list, staleTime: 60_000 });
}

export function useCrops(params?: { farm_id?: string; status?: string }) {
  return useQuery({
    queryKey: ['crops', params],
    queryFn: () => cropsApi.list(params),
    staleTime: 60_000,
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function useNotificationPrefs() {
  return useQuery({
    queryKey: ['notification-prefs'],
    queryFn: settingsApi.getNotifications,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.updateNotifications,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notification-prefs'] });
      toast.success('Preferences saved');
    },
    onError: () => toast.error('Failed to save preferences'),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (user) => {
      localStorage.setItem('agromind_user', JSON.stringify(user));
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('Profile updated');
    },
    onError: () => toast.error('Failed to update profile'),
  });
}
