import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Leaf, Shield, TrendingDown, MapPin, RefreshCw, Camera, Clock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useDashboardStats, useAlerts, useResolveAlert, useNearbyAlerts } from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import type { Alert, RecentScan } from '../../types';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '';

function severityColor(s: string) {
  if (s === 'critical') return { bg: '#FFEBEE', border: '#D32F2F', text: '#D32F2F', dot: '#D32F2F' };
  if (s === 'warning') return { bg: '#FFF3E0', border: '#FF6F00', text: '#FF6F00', dot: '#FF6F00' };
  return { bg: '#E3F2FD', border: '#1565C0', text: '#1565C0', dot: '#1565C0' };
}

function formatINR(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

function formatTimeLeft(seconds: number) {
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m left`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h left`;
  return `${Math.floor(seconds / 86400)}d left`;
}

function AlertCard({ alert, onResolve }: { alert: Alert; onResolve: () => void }) {
  const c = severityColor(alert.severity);
  const timeLeft = alert.time_left_seconds
    ? Math.max(0, alert.time_left_seconds - Math.floor((Date.now() - new Date(alert.created_at).getTime()) / 1000))
    : 0;

  return (
    <div className="rounded-xl border-2 p-6 transition-all hover:shadow-md"
      style={{ backgroundColor: c.bg, borderColor: c.border }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: c.dot }}>
              {alert.severity}
            </span>
            {timeLeft > 0 && (
              <span className="text-xs text-muted-foreground font-medium">{formatTimeLeft(timeLeft)}</span>
            )}
          </div>
          <h3 className="text-lg font-bold mb-1">{alert.title}</h3>
          <p className="text-sm text-muted-foreground">{alert.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Potential Loss</p>
          <p className="font-bold" style={{ color: c.text, fontFamily: 'monospace' }}>
            {formatINR(alert.potential_loss)}
          </p>
        </div>
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Preventable</p>
          <p className="font-bold text-[#2E7D32]" style={{ fontFamily: 'monospace' }}>
            {formatINR(alert.preventable_loss)}
          </p>
        </div>
        <div className="bg-white/60 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">AI Confidence</p>
          <p className="font-bold" style={{ color: c.text, fontFamily: 'monospace' }}>
            {alert.confidence}%
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onResolve}
          className="flex-1 py-2.5 rounded-lg font-semibold text-white text-sm transition-all hover:opacity-90"
          style={{ backgroundColor: c.dot }}>
          ✓ Mark Resolved
        </button>
        <button onClick={() => alert.scan_id && (window.location.href = `/solution/${alert.scan_id}`)}
          className="px-4 py-2.5 rounded-lg font-semibold text-sm border-2 transition-all hover:bg-white/50"
          style={{ borderColor: c.border, color: c.text }}>
          View Plan
        </button>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: stats, isLoading: statsLoading, error: statsError, refetch } = useDashboardStats();
  const { data: alerts = [], isLoading: alertsLoading, error: alertsError } = useAlerts({ is_resolved: false, limit: 10 });
  const { data: nearbyAlerts = [] } = useNearbyAlerts();
  const resolveAlert = useResolveAlert();

  const isLoading = statsLoading || alertsLoading;
  const hasError = statsError || alertsError;

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-card rounded-2xl p-8 border border-border text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Unable to Load Dashboard</h2>
          <p className="text-muted-foreground mb-6">
            We encountered an error fetching your dashboard data. Please try again.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => refetch()}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-semibold transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/scan')}
              className="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2.5 rounded-lg font-semibold transition-all"
            >
              Start Scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name?.split(' ')[0] || 'Farmer'} · Real-time crop monitoring
            </p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-all px-4 py-2 rounded-lg hover:bg-muted">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          {
            label: 'Total Loss Prevented', icon: TrendingDown, bg: '#E8F5E9', iconColor: '#2E7D32',
            value: statsLoading ? '...' : `₹${(stats?.total_loss_prevented || 0).toLocaleString('en-IN')}`,
            sub: statsLoading ? '' : `+₹${(stats?.today_prevented || 0).toLocaleString('en-IN')} today`,
            delay: 0.1,
          },
          {
            label: 'Active Alerts', icon: AlertTriangle, bg: '#FFEBEE', iconColor: '#D32F2F',
            value: statsLoading ? '...' : String(stats?.active_alerts || 0),
            sub: statsLoading ? '' : `${stats?.critical_alerts || 0} critical`,
            valueColor: '#D32F2F', delay: 0.2,
          },
          {
            label: 'Crops Monitored', icon: Leaf, bg: '#E8F5E9', iconColor: '#2E7D32',
            value: statsLoading ? '...' : String(stats?.crops_monitored || 0),
            sub: 'fields active', delay: 0.3,
          },
          {
            label: 'Protection Rate', icon: Shield, bg: '#E3F2FD', iconColor: '#1565C0',
            value: statsLoading ? '...' : `${stats?.protection_rate || 94}%`,
            sub: 'last 30 days', valueColor: '#1565C0', delay: 0.4,
          },
        ].map(({ label, icon: Icon, bg, iconColor, value, sub, valueColor, delay }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
            className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: bg }}>
                <Icon className="w-5 h-5" style={{ color: iconColor }} />
              </div>
              <p className="text-muted-foreground text-sm">{label}</p>
            </div>
            <p className="text-3xl font-bold" style={{ color: valueColor, fontFamily: 'monospace' }}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Nearby Alerts Banner */}
      {nearbyAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="mb-6 bg-[#FFF3E0] border-2 border-[#FF6F00] rounded-xl p-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#FF6F00] flex-shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-[#FF6F00]">⚠️ {nearbyAlerts.length} Nearby Disease Outbreak{nearbyAlerts.length > 1 ? 's' : ''}</p>
              <p className="text-sm text-muted-foreground">
                {nearbyAlerts[0]?.farmer_name || 'A farmer'} reported {nearbyAlerts[0]?.title} within {Math.round(nearbyAlerts[0]?.distance_km || 5)}km of you
              </p>
            </div>
            <button onClick={() => navigate('/community')}
              className="text-sm font-semibold text-[#FF6F00] hover:underline">View →</button>
          </div>
        </motion.div>
      )}

      {/* Active Alerts */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Active Alerts</h2>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#D32F2F] rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Live monitoring</span>
          </div>
        </div>

        {alertsLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="rounded-xl border border-border p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-6 bg-muted rounded w-2/3 mb-2" />
                <div className="h-4 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-[#E8F5E9] rounded-xl p-12 text-center border-2 border-[#2E7D32]">
            <div className="w-16 h-16 bg-[#2E7D32] rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-[#2E7D32] mb-2">All Clear!</h3>
            <p className="text-muted-foreground">No active alerts — your crops are safe 🌱</p>
          </motion.div>
        ) : (
          <AnimatePresence>
            <div className="space-y-6">
              {alerts.map((alert, index) => (
                <motion.div key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.1 }}>
                  <AlertCard
                    alert={alert}
                    onResolve={() => resolveAlert.mutate({ id: alert.id })}
                  />
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>

      {/* Recent Scans */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Recent Scans</h2>
          <button onClick={() => navigate('/scan')}
            className="flex items-center gap-2 text-sm font-semibold text-[#2E7D32] hover:underline">
            <Camera className="w-4 h-4" /> New Scan
          </button>
        </div>

        {statsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-border p-4 animate-pulse flex gap-4">
                <div className="w-14 h-14 bg-muted rounded-lg flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (stats?.recent_scans?.length || 0) === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-card rounded-xl p-8 text-center border border-border">
            <Camera className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No scans yet. Upload your first leaf image to get started.</p>
            <button onClick={() => navigate('/scan')}
              className="mt-4 bg-[#2E7D32] text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-[#1B5E20] transition-all">
              Start AI Scan
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {(stats?.recent_scans || []).map((scan: RecentScan, index: number) => {
              const sc = severityColor(scan.severity);
              return (
                <motion.div key={scan.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/solution/${scan.id}`)}
                  className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 cursor-pointer hover:shadow-md hover:border-[#2E7D32]/40 transition-all">
                  {/* Thumbnail */}
                  {scan.image_url ? (
                    <img
                      src={`${BACKEND_URL}${scan.image_url}`}
                      alt={scan.disease_name}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-border"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold truncate">{scan.disease_name}</h4>
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white flex-shrink-0"
                        style={{ backgroundColor: sc.dot }}>
                        {scan.severity}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {scan.plant_name}
                    </p>
                  </div>

                  {/* Confidence + Time */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold" style={{ color: sc.text, fontFamily: 'monospace' }}>
                      {Math.round(scan.confidence)}%
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {new Date(scan.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] rounded-xl p-8 text-white">
        <h3 className="text-2xl font-bold mb-2">Protect Your Harvest Before It's Too Late</h3>
        <p className="mb-6 opacity-90">Use AI-powered scanning to detect diseases before they spread</p>
        <div className="flex gap-4">
          <button onClick={() => navigate('/scan')}
            className="bg-white text-[#2E7D32] px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all">
            Start AI Scan
          </button>
          <button onClick={() => navigate('/community')}
            className="bg-white/20 backdrop-blur text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-all border border-white/30">
            Community Insights
          </button>
        </div>
      </motion.div>
    </div>
  );
}
