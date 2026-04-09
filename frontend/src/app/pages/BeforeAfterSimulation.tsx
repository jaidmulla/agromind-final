import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, AlertCircle, CheckCircle, Leaf, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useScans, useScan } from '../../hooks';

function formatINR(n: number) {
  return `₹${(n || 0).toLocaleString('en-IN')}`;
}

export function BeforeAfterSimulation() {
  const { data: scans = [], isLoading: scansLoading } = useScans({ status: 'analyzed', limit: 10 });
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [currentDay, setCurrentDay] = useState(0);

  useEffect(() => {
    if (!selectedId && scans.length > 0) {
      setSelectedId(scans[0].id);
    }
  }, [scans, selectedId]);

  const { data: scan, isLoading: scanLoading } = useScan(selectedId);

  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ['regret-timeline', selectedId],
    queryFn: () => api.get(`/scans/${selectedId}/regret-timeline`).then(r => r.data.data),
    enabled: !!selectedId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (timeline.length > 0) {
      setCurrentDay(timeline[0].day);
    }
  }, [timeline]);

  const stages = useMemo(() => {
    if (!timeline.length) return [];
    return timeline.map((t: any): any => ({
      day: t.day,
      label: t.label,
      loss_inr: t.cumulative_loss_inr || 0,
      is_critical: t.is_critical,
    }));
  }, [timeline]);

  const currentStage = stages.find((s: any) => s.day === currentDay) || stages[0];
  const maxLoss = stages.length ? stages[stages.length - 1].loss_inr : 0;

  const regret = (scan as any)?.regret_analysis || {};
  const treatmentCost = regret.treatment_cost_inr || Math.round((scan as any)?.potential_loss || 0) * 0.08;
  const savedAmount = regret.saved_amount_inr || Math.round(((scan as any)?.potential_loss || 0) * 0.85);
  const treatedLoss = Math.max(0, (currentStage?.loss_inr || 0) - savedAmount);

  const ignoredSpread = maxLoss ? Math.round((currentStage?.loss_inr / maxLoss) * 100) : 0;
  const treatedSpread = maxLoss ? Math.max(2, Math.round((treatedLoss / maxLoss) * 100)) : 2;

  if (scansLoading || scanLoading || timelineLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
      </div>
    );
  }

  if (!scan || !stages.length) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <Leaf className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
        <h2 className="text-xl font-bold mb-2">No scans yet</h2>
        <p className="text-muted-foreground">Run a disease scan to generate a real impact simulation.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Before vs After Simulation</h1>
        <p className="text-muted-foreground">Real impact simulation based on your latest scans</p>
      </motion.div>

      {/* Scan picker */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {scans.map((s: any) => (
          <button key={s.id} onClick={() => setSelectedId(s.id)}
            className={`px-5 py-2.5 rounded-xl font-semibold transition-all ${selectedId === s.id ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {s.plant_name} — {s.disease_name}
          </button>
        ))}
      </div>

      {/* Day slider */}
      <div className="bg-card rounded-2xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">⏱️ Time Simulator — Drag to see what happens</h3>
          <span className="font-bold text-[#2E7D32]">Day {currentDay}</span>
        </div>
        <div className="flex gap-3 mb-4 flex-wrap">
          {stages.map((s: any) => (
            <button key={s.day} onClick={() => setCurrentDay(s.day)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border-2 ${currentDay === s.day ? 'border-[#2E7D32] bg-[#E8F5E9] text-[#2E7D32]' : 'border-border bg-muted text-muted-foreground'}`}>
              Day {s.day}
            </button>
          ))}
        </div>
        <input type="range" min={stages[0].day} max={stages[stages.length - 1].day}
          value={currentDay}
          onChange={e => setCurrentDay(parseInt(e.target.value))}
          className="w-full accent-[#2E7D32]" />
      </div>

      {/* Side by side comparison */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* IGNORED */}
        <motion.div key={`ignored-${currentDay}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: '#D32F2F' }}>
          <div className="px-5 py-4 flex items-center gap-2 bg-[#D32F2F]">
            <AlertCircle className="w-5 h-5 text-white" />
            <h3 className="font-bold text-white">If You Ignore It</h3>
          </div>
          <div className="p-5">
            <p className="font-semibold text-center mb-4">{currentStage?.label}</p>
            <div className="space-y-3">
              <MetricBar label="Disease Spread" value={ignoredSpread} color="#D32F2F" />
              <MetricBar label="Yield Loss" value={ignoredSpread} color="#FF6F00" />
              <div className="bg-[#FFEBEE] rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Financial Loss</p>
                <p className="text-3xl font-bold text-[#D32F2F]">{formatINR(currentStage?.loss_inr || 0)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* TREATED */}
        <motion.div key={`treated-${currentDay}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          className="rounded-2xl border-2 border-[#2E7D32] overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-2 bg-[#2E7D32]">
            <CheckCircle className="w-5 h-5 text-white" />
            <h3 className="font-bold text-white">If You Treat Today</h3>
          </div>
          <div className="p-5">
            <p className="font-semibold text-center mb-4">Treatment applied immediately</p>
            <div className="space-y-3">
              <MetricBar label="Disease Spread" value={treatedSpread} color="#2E7D32" />
              <MetricBar label="Yield Loss" value={treatedSpread} color="#4CAF50" />
              <div className="bg-[#E8F5E9] rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Loss After Treatment</p>
                <p className="text-3xl font-bold text-[#2E7D32]">{formatINR(treatedLoss)}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ROI Summary */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] rounded-2xl p-6 text-white text-center">
        <h3 className="text-2xl font-bold mb-4">The Math Is Simple</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm opacity-80 mb-1">Treatment Cost</p>
            <p className="text-2xl font-bold">{formatINR(treatmentCost)}</p>
          </div>
          <div className="relative">
            <ArrowRight className="w-8 h-8 mx-auto mb-1 opacity-60" />
            <p className="text-sm opacity-80">Protects</p>
          </div>
          <div>
            <p className="text-sm opacity-80 mb-1">Maximum Loss Prevented</p>
            <p className="text-2xl font-bold">{formatINR(savedAmount)}</p>
          </div>
        </div>
        <div className="mt-4 bg-white/20 rounded-xl py-3">
          <p className="text-xl font-bold">{treatmentCost > 0 ? Math.round(savedAmount / treatmentCost) : 0}x Return on Treatment</p>
          <p className="text-sm opacity-80">Spend {formatINR(treatmentCost)}, save {formatINR(savedAmount)}</p>
        </div>
      </motion.div>
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full"
          style={{ backgroundColor: color }}
          animate={{ width: `${Math.min(100, Math.max(2, value))}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  );
}
