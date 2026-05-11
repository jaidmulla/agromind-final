import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, Leaf, Shield, Clock } from 'lucide-react';
import { useContractAlerts, useContractDashboard } from '../../hooks';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '';

function severityBadgeColor(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return { bg: '#FFEBEE', color: '#C62828' };
  if (severity === 'medium') return { bg: '#FFF3E0', color: '#EF6C00' };
  return { bg: '#E8F5E9', color: '#2E7D32' };
}

export function ContractDashboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useContractDashboard();
  const { data: alerts = [] } = useContractAlerts();

  const recentScans = useMemo(() => data?.recent_scans || [], [data]);

  if (isLoading) return <div className="p-8">Loading dashboard...</div>;
  if (isError || !data) return <div className="p-8 text-red-600">Failed to load dashboard data.</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Crop Disease Dashboard</h1>
          <p className="text-muted-foreground">Auto-refreshes every 10 seconds</p>
        </div>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-lg border border-border hover:bg-muted">
          Refresh now
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-2xl border border-border p-5 bg-card">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Active Alerts</p>
          <p className="text-3xl font-bold mt-2">{data.active_alerts}</p>
        </div>

        <div className="rounded-2xl border border-border p-5 bg-card">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Leaf className="w-4 h-4" /> Crops Monitored</p>
          <p className="text-3xl font-bold mt-2">{data.crops_monitored}</p>
        </div>

        <div className="rounded-2xl border border-border p-5 bg-card">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Shield className="w-4 h-4" /> Protection Rate</p>
          <p className="text-3xl font-bold mt-2">{data.protection_rate}%</p>
        </div>

        <div className="rounded-2xl border border-border p-5 bg-card">
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Scans</p>
          <p className="text-3xl font-bold mt-2">{recentScans.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-semibold mb-4">Recent Scans</h2>
          <div className="space-y-3">
            {recentScans.length === 0 && <p className="text-muted-foreground">No scans available yet.</p>}
            {recentScans.map((scan) => {
              const badge = severityBadgeColor(scan.severity);
              const img = scan.image_path
                ? `${BACKEND_URL}${scan.image_path}`
                : '';
              return (
                <button
                  key={scan.report_id}
                  onClick={() => navigate(scan.scan_id ? `/solution/${scan.scan_id}` : `/analysis/${scan.report_id}`)}
                  className="w-full text-left rounded-xl border border-border p-3 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {img ? (
                      <img src={img} alt={scan.disease_name} className="w-14 h-14 rounded-lg object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{scan.disease_name}</p>
                      {scan.plant_name && <p className="text-sm text-muted-foreground truncate">{scan.plant_name}</p>}
                      <p className="text-sm text-muted-foreground">Confidence: {Math.round(scan.confidence)}%</p>
                      <p className="text-xs text-muted-foreground">{new Date(scan.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>
                      {scan.severity}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-semibold mb-4">Active Alerts</h2>
          <div className="space-y-3">
            {alerts.length === 0 && <p className="text-muted-foreground">No active alerts.</p>}
            {alerts.map((alert) => {
              const badge = severityBadgeColor(alert.severity);
              return (
                <div key={alert.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: badge.bg, color: badge.color }}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm">{alert.message}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
