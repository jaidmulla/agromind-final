import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate } from 'react-router';
import {
  CheckCircle, Clock, Loader2, ArrowLeft, Leaf, AlertCircle,
  TrendingDown, Zap, Users, Target, ChevronDown, ChevronUp, Shield, Stethoscope
} from 'lucide-react';
import { useState } from 'react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import { useScan, useResolveScan } from '../../hooks';
import { AIDoctor } from '../components/AIDoctor';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '';

function formatINR(n: number) {
  return `₹${(n || 0).toLocaleString('en-IN')}`;
}

function RegretScoreRing({ score, level }: { score: number; level: string }) {
  const color = score >= 70 ? '#D32F2F' : score >= 40 ? '#FF6F00' : '#2E7D32';
  const circumference = 2 * Math.PI * 54;
  const progress = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="var(--muted)" strokeWidth="8" />
          <motion.circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
            strokeLinecap="round" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: progress }}
            transition={{ duration: 1.5, ease: 'easeOut' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <span className="text-xs font-bold uppercase px-3 py-1 rounded-full text-white" style={{ backgroundColor: color }}>
          {level} URGENCY
        </span>
      </div>
    </div>
  );
}

function LossTimeline({ timeline }: { timeline: Array<{ day: number; cumulative_loss_inr: number; label: string; is_critical: boolean }> }) {
  if (!timeline?.length) return null;
  const maxLoss = Math.max(...timeline.map(t => t.cumulative_loss_inr));

  return (
    <div className="space-y-2">
      {timeline.slice(0, 6).map((point, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-16 text-right">{point.label}</span>
          <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(point.cumulative_loss_inr / maxLoss) * 100}%` }}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="h-full rounded-full"
              style={{ backgroundColor: point.is_critical ? '#D32F2F' : '#FF6F00' }}
            />
          </div>
          <span className="text-xs font-bold w-20" style={{ color: point.is_critical ? '#D32F2F' : '#FF6F00' }}>
            {formatINR(point.cumulative_loss_inr)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Solution() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: scanData, isLoading, error } = useScan(id);
  const resolveScan = useResolveScan();
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(false);
  const [showDiseaseInfo, setShowDiseaseInfo] = useState(false);
  const [showAIDoctor, setShowAIDoctor] = useState(false);

  const scan = scanData as (typeof scanData & {
    regret_analysis?: { regret_score: number; urgency_level: string; emotional_message: string; financial_message: string; social_proof: string; countdown_message: string; daily_loss_inr: number; treatment_cost_inr: number; roi_multiplier: number };
    regret_timeline?: Array<{ day: number; cumulative_loss_inr: number; label: string; is_critical: boolean }>;
    behavioral_triggers?: { regret_score: number; loss_timeline?: [] };
    disease_info?: { scientific_name: string; symptoms: string[]; spread_mechanism: string; prevention: string; affected_crops: string[] };
  });

  const toggleStep = (i: number) => {
    setCompletedSteps(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };

  const handleApply = async () => {
    if (!scan) return;
    setApplying(true);
    const steps = scan.treatment_steps || [];
    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 500));
      setCompletedSteps(prev => new Set([...prev, i]));
    }
    try {
      await resolveScan.mutateAsync({ id: scan.id });
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#2E7D32', '#4CAF50', '#8BC34A', '#FFF9C4'] });
      toast.success(`Treatment applied! ${formatINR(Math.round((parseFloat(scan.potential_loss as unknown as string) || 0) * 0.85))} loss prevented!`);
      setTimeout(() => navigate('/'), 2500);
    } catch { toast.error('Failed to record'); }
    finally { setApplying(false); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#2E7D32] mx-auto mb-3" />
        <p className="text-muted-foreground">Loading treatment plan...</p>
      </div>
    </div>
  );

  if (error || !scan) return (
    <div className="p-8 text-center">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Scan not found</h2>
      <button onClick={() => navigate('/scan')} className="bg-[#2E7D32] text-white px-6 py-3 rounded-lg font-semibold mt-2">New Scan</button>
    </div>
  );

  const steps = scan.treatment_steps || [];
  const isResolved = scan.status === 'resolved';
  const potentialLoss = parseFloat(scan.potential_loss as unknown as string) || 0;
  const regret = scan.regret_analysis;
  const timeline = scan.regret_timeline;
  const diseaseInfo = scan.disease_info;
  const severityColor = scan.severity === 'critical' ? '#D32F2F' : scan.severity === 'warning' ? '#FF6F00' : scan.severity === 'healthy' ? '#2E7D32' : '#1565C0';

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-4xl font-bold mb-1">Treatment Plan</h1>
        <p className="text-muted-foreground">AI-generated protocol — <strong>{scan.disease_name}</strong></p>
      </motion.div>

      <div className="grid gap-6">
        {/* Hero — Disease + Regret Score */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-card rounded-2xl border border-border p-6">
          <div className="flex gap-6 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: severityColor }}>{scan.severity}</span>
                <span className="text-sm text-muted-foreground">Confidence: <strong>{scan.confidence}%</strong></span>
                {scan.source === 'combined' && <span className="text-xs bg-[#E3F2FD] text-[#1565C0] px-2 py-0.5 rounded-full">AI + CNN verified</span>}
              </div>
              <h2 className="text-2xl font-bold mb-1">{scan.disease_name}</h2>
              <p className="text-muted-foreground text-sm mb-4">Detected in: <strong>{scan.plant_name}</strong></p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Potential Loss</p>
                  <p className="text-xl font-bold text-[#D32F2F]" style={{ fontFamily: 'monospace' }}>{formatINR(potentialLoss)}</p>
                  <p className="text-xs text-muted-foreground">per acre</p>
                </div>
                <div className="bg-[#E8F5E9] rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Preventable</p>
                  <p className="text-xl font-bold text-[#2E7D32]" style={{ fontFamily: 'monospace' }}>{formatINR(Math.round(potentialLoss * 0.85))}</p>
                  <p className="text-xs text-muted-foreground">if treated now</p>
                </div>
              </div>
            </div>
            {regret && <RegretScoreRing score={regret.regret_score} level={regret.urgency_level} />}
          </div>
        </motion.div>

        {/* Regret AI Engine */}
        {regret && scan.severity !== 'healthy' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: severityColor }}>
            <div className="px-6 py-4 text-white" style={{ backgroundColor: severityColor }}>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                <span className="font-bold">Regret AI Engine</span>
                <span className="ml-auto text-sm opacity-90">{regret.countdown_message}</span>
              </div>
            </div>
            <div className="p-6 space-y-4" style={{ backgroundColor: scan.severity === 'critical' ? '#FFEBEE' : scan.severity === 'warning' ? '#FFF8E1' : '#F3F4F6' }}>
              {/* Emotional message */}
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: severityColor }} />
                <p className="text-sm font-medium">{regret.emotional_message}</p>
              </div>
              {/* Financial */}
              <div className="flex gap-3">
                <TrendingDown className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#D32F2F]" />
                <p className="text-sm">{regret.financial_message}</p>
              </div>
              {/* ROI */}
              <div className="bg-white rounded-xl p-4 grid grid-cols-3 gap-3 text-center text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Daily Loss</p>
                  <p className="font-bold text-[#D32F2F]">{formatINR(regret.daily_loss_inr)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Treatment Cost</p>
                  <p className="font-bold text-[#1565C0]">{formatINR(regret.treatment_cost_inr)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">ROI Multiplier</p>
                  <p className="font-bold text-[#2E7D32]">{regret.roi_multiplier}x</p>
                </div>
              </div>
              {/* Social proof */}
              <div className="flex gap-2 items-center">
                <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground italic">{regret.social_proof}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Regret Loss Timeline */}
        {timeline && timeline.length > 0 && scan.severity !== 'healthy' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-[#D32F2F]" />
              <h3 className="font-bold">Loss Timeline — What Happens If You Wait?</h3>
            </div>
            <LossTimeline timeline={timeline} />
            <p className="text-xs text-muted-foreground mt-3">🔴 Red bars = beyond treatment window. Act before it turns irreversible.</p>
          </motion.div>
        )}

        {/* Regret Insight from AI */}
        {scan.regret_insight && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-[#FFF3E0] border border-[#FF6F00] rounded-xl p-5">
            <p className="font-bold text-[#FF6F00] mb-2">⚠️ If You Don't Act Today</p>
            <p className="text-sm">{scan.regret_insight}</p>
          </motion.div>
        )}

        {/* AI Recommendation */}
        {scan.recommendation && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-[#E8F5E9] border border-[#2E7D32]/30 rounded-xl p-5">
            <p className="font-bold text-[#2E7D32] mb-2">💡 AI Recommendation</p>
            <p className="text-sm">{scan.recommendation}</p>
          </motion.div>
        )}

        {/* Symptoms */}
        {diseaseInfo?.symptoms?.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl border border-border overflow-hidden">
            <button onClick={() => setShowSymptoms(!showSymptoms)}
              className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-all">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#FF6F00]" />
                <span className="font-bold">Symptoms to Watch ({diseaseInfo.symptoms.length})</span>
              </div>
              {showSymptoms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <AnimatePresence>
              {showSymptoms && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                  className="overflow-hidden">
                  <div className="px-5 pb-5 space-y-2">
                    {diseaseInfo.symptoms.map((s, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#FF6F00] flex-shrink-0 mt-1.5" />
                        <p className="text-sm">{s}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Treatment Steps */}
        {steps.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <h3 className="text-xl font-bold mb-4">Step-by-Step Treatment Protocol</h3>
            <div className="space-y-3">
              {steps.map((step: { step: number; title: string; description: string; duration: string; product?: string; dosage?: string }, index: number) => {
                const done = completedSteps.has(index);
                return (
                  <motion.div key={index}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + index * 0.08 }}
                    onClick={() => !applying && !isResolved && toggleStep(index)}
                    className={`bg-card rounded-xl p-5 border-2 cursor-pointer transition-all ${done ? 'border-[#2E7D32] bg-[#E8F5E9]' : 'border-border hover:border-[#2E7D32]/40'}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all ${done ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground'}`}>
                        {done ? <CheckCircle className="w-5 h-5" /> : step.step}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-bold">{step.title}</h4>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />{step.duration}
                          </span>
                          {step.product && <span className="text-xs bg-[#E3F2FD] text-[#1565C0] px-2 py-0.5 rounded-full">{step.product}</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                        {step.dosage && <p className="text-xs text-[#2E7D32] mt-1 font-medium">Dosage: {step.dosage}</p>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Disease Encyclopedia */}
        {(diseaseInfo?.scientific_name || diseaseInfo?.spread_mechanism) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-card rounded-2xl border border-border overflow-hidden">
            <button onClick={() => setShowDiseaseInfo(!showDiseaseInfo)}
              className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-all">
              <div className="flex items-center gap-2">
                <Leaf className="w-5 h-5 text-[#2E7D32]" />
                <span className="font-bold">Disease Encyclopedia</span>
              </div>
              {showDiseaseInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <AnimatePresence>
              {showDiseaseInfo && (
                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="px-5 pb-5 grid grid-cols-2 gap-4 text-sm">
                    {diseaseInfo.scientific_name && <div><p className="text-muted-foreground mb-1">Scientific Name</p><p className="font-medium italic">{diseaseInfo.scientific_name}</p></div>}
                    {diseaseInfo.spread_mechanism && <div><p className="text-muted-foreground mb-1">Spread</p><p className="font-medium">{diseaseInfo.spread_mechanism}</p></div>}
                    {diseaseInfo.affected_crops?.length > 0 && <div className="col-span-2"><p className="text-muted-foreground mb-1">Affected Crops</p><p className="font-medium">{diseaseInfo.affected_crops.join(', ')}</p></div>}
                    {diseaseInfo.prevention && <div className="col-span-2"><p className="text-muted-foreground mb-1">Prevention</p><p className="font-medium">{diseaseInfo.prevention}</p></div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Action Buttons */}
        {!isResolved ? (
          <div className="flex gap-4 flex-col md:flex-row">
            <button onClick={handleApply} disabled={applying}
              className="flex-1 py-4 rounded-xl font-bold text-lg text-white transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              style={{ backgroundColor: severityColor }}>
              {applying ? <><Loader2 className="w-5 h-5 animate-spin" /> Applying Protocol...</> : '✓ Apply Treatment & Record Loss Prevention'}
            </button>
            <button onClick={() => setShowAIDoctor(true)} 
              className="flex-1 py-4 rounded-xl font-bold text-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all flex items-center justify-center gap-2">
              <Stethoscope className="w-5 h-5" />
              AI Doctor Detailed Plan
            </button>
            <button onClick={() => navigate('/scan')} className="px-6 py-4 rounded-xl border-2 border-border font-semibold hover:bg-muted transition-all">
              New Scan
            </button>
          </div>
        ) : (
          <div className="bg-[#E8F5E9] border-2 border-[#2E7D32] rounded-xl p-6 text-center">
            <Shield className="w-12 h-12 text-[#2E7D32] mx-auto mb-3" />
            <h3 className="text-xl font-bold text-[#2E7D32] mb-2">Treatment Applied ✓</h3>
            <p className="text-muted-foreground">{formatINR(Math.round(potentialLoss * 0.85))} loss prevention recorded to your dashboard.</p>
          </div>
        )}
      </div>

      {/* AI Doctor Modal */}
      <AnimatePresence>
        {showAIDoctor && id && (
          <AIDoctor 
            scanId={id} 
            onClose={() => setShowAIDoctor(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
