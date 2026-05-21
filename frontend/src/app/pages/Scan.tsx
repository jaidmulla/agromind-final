import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  Camera,
  CheckCircle,
  CloudRain,
  Droplets,
  FlaskConical,
  Leaf,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sprout,
  Thermometer,
  Upload,
  X,
} from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useCreateScan, useDashboardStats } from '../../hooks';
import type { Scan } from '../../types';
import { toast } from 'sonner';

type ScanState = 'idle' | 'processing' | 'complete' | 'failed';

const progressSteps = ['Upload', 'Processing', 'ML Detection', 'AI Analysis', 'Final Report'];

function numeric(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function severityUi(severity: Scan['severity']) {
  if (severity === 'healthy') return { label: 'Healthy', bg: '#E8F5E9', border: '#2E7D32', text: '#2E7D32' };
  if (severity === 'warning') return { label: 'Moderate', bg: '#FFF3E0', border: '#FF6F00', text: '#FF6F00' };
  if (severity === 'critical') return { label: 'Severe', bg: '#FFEBEE', border: '#D32F2F', text: '#D32F2F' };
  return { label: 'Mild', bg: '#FFFDE7', border: '#FBC02D', text: '#8A6D00' };
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold mb-2">{title}</p>
      <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

export function Scan() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<Scan | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const createScan = useCreateScan();
  const { refetch: refetchDashboard } = useDashboardStats();

  const handleFileSelect = useCallback((file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      toast.error('Upload a JPEG, PNG, or WebP leaf image');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }
    setSelectedFile(file);
    setScanResult(null);
    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const reset = () => {
    setScanState('idle');
    setScanResult(null);
    setPreview(null);
    setSelectedFile(null);
    setProgress(0);
    setActiveStep(0);
    setErrorMessage('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const startScan = async () => {
    if (!selectedFile) {
      toast.error('Select a leaf image first');
      return;
    }

    setScanState('processing');
    setProgress(8);
    setActiveStep(0);
    setErrorMessage('');

    const timers = [
      window.setTimeout(() => { setActiveStep(1); setProgress(28); }, 350),
      window.setTimeout(() => { setActiveStep(2); setProgress(52); }, 1200),
      window.setTimeout(() => { setActiveStep(3); setProgress(78); }, 2400),
    ];

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      const result = await createScan.mutateAsync(formData);
      timers.forEach(window.clearTimeout);
      await refetchDashboard();
      const reportId = result.report_id || result.id;
      if (reportId) {
        toast.success('Scan complete. Opening analysis.');
        navigate(`/analysis/${reportId}`, { replace: true });
        return;
      }
      setActiveStep(4);
      setProgress(100);
      setScanResult(result);
      setScanState('complete');
      toast.success('Scan complete. Report saved to dashboard.');
    } catch (err: any) {
      timers.forEach(window.clearTimeout);
      const message = err?.response?.data?.message || err?.message || 'Scan failed. Please try again.';
      setErrorMessage(message);
      setScanState('failed');
      setProgress(0);
      toast.error(message);
    }
  };

  const resultInfo = scanResult?.disease_info;
  const severity = scanResult ? severityUi(scanResult.severity) : severityUi('info');
  const confidence = Math.round(numeric(scanResult?.confidence));
  const yieldLoss = numeric(resultInfo?.yield_loss_percent ?? scanResult?.yield_loss_percent);
  const potentialLoss = numeric(scanResult?.potential_loss);
  const weatherRisk = resultInfo?.weather_risk_analysis;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">AI Crop Scanner</h1>
        <p className="text-muted-foreground">Upload one clear leaf image. AgroMind automatically detects crop, disease, severity, and treatment.</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {scanState === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => !preview && fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-6 md:p-10 text-center transition-all ${preview ? 'border-[#2E7D32] bg-[#F1F8E9]' : 'border-border hover:border-[#2E7D32] hover:bg-[#F9FBF9] cursor-pointer'}`}
            >
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Selected leaf preview" className="max-h-[420px] w-full mx-auto rounded-xl object-contain bg-white shadow-sm" />
                  <button onClick={e => { e.stopPropagation(); reset(); }}
                    className="absolute top-3 right-3 bg-white rounded-full p-2 shadow-md hover:bg-red-50 transition-all"
                    aria-label="Remove selected image">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                  <p className="mt-4 text-sm text-muted-foreground">{selectedFile?.name} · {Math.round((selectedFile?.size || 0) / 1024)}KB</p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Leaf className="w-10 h-10 text-[#2E7D32]" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Drop Leaf Image Here</h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Use a close-up photo with one leaf in focus. JPEG, PNG, and WebP are supported.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <label className="flex items-center justify-center gap-2 bg-[#2E7D32] text-white px-6 py-3 rounded-lg font-semibold cursor-pointer hover:bg-[#1B5E20] transition-all">
                      <Upload className="w-5 h-5" /> Upload Image
                      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                    </label>
                    <label className="flex items-center justify-center gap-2 border-2 border-[#2E7D32] text-[#2E7D32] px-6 py-3 rounded-lg font-semibold cursor-pointer hover:bg-[#E8F5E9] transition-all">
                      <Camera className="w-5 h-5" /> Use Camera
                      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"
                        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                    </label>
                  </div>
                </>
              )}
            </div>

            {preview && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                <button onClick={startScan}
                  disabled={!selectedFile || createScan.isPending}
                  className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-60 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2">
                  {createScan.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sprout className="w-5 h-5" />}
                  Start AI Analysis
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {scanState === 'processing' && (
          <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-border bg-card overflow-hidden">
            {preview && (
              <div className="relative h-72 overflow-hidden">
                <img src={preview} alt="Scanning leaf" className="w-full h-full object-cover opacity-75" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-6">
                  <div className="text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-semibold">{progressSteps[activeStep]}</span>
                    </div>
                    <p className="text-sm opacity-85">Running trained model inference and AI recommendation analysis.</p>
                  </div>
                </div>
              </div>
            )}
            <div className="p-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Scan progress</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden mb-6">
                <motion.div className="h-full bg-gradient-to-r from-[#2E7D32] to-[#4CAF50] rounded-full"
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
              </div>
              <div className="grid md:grid-cols-5 gap-3">
                {progressSteps.map((step, index) => {
                  const done = index < activeStep;
                  const active = index === activeStep;
                  return (
                    <div key={step} className={`rounded-lg border p-3 text-sm ${done || active ? 'border-[#2E7D32] bg-[#E8F5E9]' : 'border-border bg-background'}`}>
                      <div className="flex items-center gap-2">
                        {done ? <CheckCircle className="w-4 h-4 text-[#2E7D32]" /> : active ? <Loader2 className="w-4 h-4 animate-spin text-[#2E7D32]" /> : <span className="w-4 h-4 rounded-full bg-muted" />}
                        <span className={done || active ? 'font-semibold text-[#2E7D32]' : 'text-muted-foreground'}>{step}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {scanState === 'failed' && (
          <motion.div key="failed" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-[#D32F2F] bg-[#FFEBEE] p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-[#D32F2F] mt-1" />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#D32F2F] mb-1">Scan Failed</h2>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            </div>
            <button onClick={reset}
              className="mt-5 bg-white border border-[#D32F2F] text-[#D32F2F] px-5 py-2.5 rounded-lg font-semibold hover:bg-red-50 transition-all flex items-center gap-2">
              <RotateCcw className="w-4 h-4" /> Try Another Image
            </button>
          </motion.div>
        )}

        {scanState === 'complete' && scanResult && (
          <motion.div key="complete" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl p-6 border-2" style={{ backgroundColor: scanResult.needs_clearer_image ? '#FFF3E0' : severity.bg, borderColor: scanResult.needs_clearer_image ? '#FF6F00' : severity.border }}>
              <div className="flex flex-col md:flex-row gap-5">
                {preview && <img src={preview} alt="Scanned leaf" className="w-full md:w-44 h-44 rounded-xl object-cover bg-white border border-white/70" />}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {scanResult.needs_clearer_image ? <AlertCircle className="w-6 h-6 text-[#FF6F00]" /> : <CheckCircle className="w-6 h-6" style={{ color: severity.text }} />}
                    <h2 className="text-2xl font-bold">{scanResult.needs_clearer_image ? 'Image Needs Review' : 'Final Report Ready'}</h2>
                    <span className="text-xs font-bold uppercase px-2 py-1 rounded-full text-white" style={{ backgroundColor: scanResult.needs_clearer_image ? '#FF6F00' : severity.text }}>
                      {scanResult.needs_clearer_image ? 'Unclear' : severity.label}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <div className="bg-white/70 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Crop Name</p>
                      <p className="font-bold">{scanResult.plant_name}</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Disease Name</p>
                      <p className="font-bold">{scanResult.disease_name}</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">AI Confidence</p>
                      <p className="font-bold">{confidence}%</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Yield Loss Risk</p>
                      <p className="font-bold">{yieldLoss}%</p>
                    </div>
                  </div>

                  <div className="h-3 bg-white/70 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: confidence >= 80 ? '#2E7D32' : confidence >= 60 ? '#FF6F00' : '#D32F2F' }}
                      initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, confidence))}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <DetailBlock title="Potential Yield Loss">
                <span className="font-bold text-[#D32F2F]">{yieldLoss}%</span>
                {potentialLoss > 0 && <span> · ₹{potentialLoss.toLocaleString('en-IN')} per acre estimated risk</span>}
              </DetailBlock>
              <DetailBlock title="Recovery Chances">
                {resultInfo?.recovery_chances || 'Recovery estimate unavailable for this scan.'}
              </DetailBlock>
              <DetailBlock title="Next Monitoring Time">
                {resultInfo?.next_monitoring_time || 'Re-scan within 48 hours if symptoms change.'}
              </DetailBlock>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <DetailBlock title="Symptoms">
                {(resultInfo?.symptoms || []).length > 0 ? (
                  <ul className="space-y-1">{resultInfo?.symptoms?.map(item => <li key={item}>- {item}</li>)}</ul>
                ) : 'No confident symptoms extracted.'}
              </DetailBlock>
              <DetailBlock title="Causes">
                {(resultInfo?.causes || []).length > 0 ? (
                  <ul className="space-y-1">{resultInfo?.causes?.map(item => <li key={item}>- {item}</li>)}</ul>
                ) : resultInfo?.spread_mechanism || 'Cause analysis unavailable.'}
              </DetailBlock>
              <DetailBlock title="Organic Treatment">
                <div className="flex gap-2"><ShieldCheck className="w-4 h-4 text-[#2E7D32] mt-0.5 flex-shrink-0" />{resultInfo?.organic_treatment || 'Not provided.'}</div>
              </DetailBlock>
              <DetailBlock title="Chemical Treatment">
                <div className="flex gap-2"><FlaskConical className="w-4 h-4 text-[#1565C0] mt-0.5 flex-shrink-0" />{resultInfo?.chemical_treatment || scanResult.recommendation || 'Not provided.'}</div>
              </DetailBlock>
              <DetailBlock title="Recommended Fertilizer">
                <div className="flex gap-2"><Sprout className="w-4 h-4 text-[#2E7D32] mt-0.5 flex-shrink-0" />{resultInfo?.recommended_fertilizer || 'Use soil-test-based balanced fertilizer.'}</div>
              </DetailBlock>
              <DetailBlock title="Irrigation Suggestions">
                <div className="flex gap-2"><Droplets className="w-4 h-4 text-[#1565C0] mt-0.5 flex-shrink-0" />{resultInfo?.irrigation_suggestions || 'Avoid wetting leaf surfaces during disease pressure.'}</div>
              </DetailBlock>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2"><CloudRain className="w-5 h-5 text-[#1565C0]" /> Weather Risk Analysis</h3>
              {weatherRisk ? (
                <div className="grid md:grid-cols-2 gap-3 text-sm text-muted-foreground">
                  <p className="flex gap-2"><Droplets className="w-4 h-4 mt-0.5" />{weatherRisk.humidity_risk}</p>
                  <p className="flex gap-2"><Thermometer className="w-4 h-4 mt-0.5" />{weatherRisk.temperature_risk}</p>
                  <p className="flex gap-2"><CloudRain className="w-4 h-4 mt-0.5" />{weatherRisk.rainfall_impact}</p>
                  <p>{weatherRisk.disease_spread_probability}</p>
                  <p className="md:col-span-2 font-medium text-foreground">{weatherRisk.recommendation}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Live weather was unavailable. Add farm/profile coordinates to enable weather-aware recommendations.</p>
              )}
            </div>

            <div className="rounded-2xl border border-[#2E7D32]/30 bg-[#E8F5E9] p-5">
              <h3 className="font-bold text-[#2E7D32] mb-2">AI Recommendation</h3>
              <p className="text-sm leading-relaxed">{scanResult.recommendation}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {!scanResult.needs_clearer_image && (
                <button onClick={() => navigate(`/solution/${scanResult.id}`)}
                  className="flex-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white py-3 rounded-xl font-bold transition-all">
                  Open Full Report
                </button>
              )}
              <button onClick={reset}
                className="px-6 py-3 rounded-xl border-2 border-border font-semibold hover:bg-muted transition-all">
                Scan Another Leaf
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
