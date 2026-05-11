import { motion, AnimatePresence } from 'motion/react';
import { Camera, CheckCircle, AlertCircle, Loader2, X, Upload } from 'lucide-react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useCreateScan, useCrops, useDashboardStats } from '../../hooks';
import type { Scan } from '../../types';
import { toast } from 'sonner';

type ScanState = 'idle' | 'uploading' | 'analyzing' | 'complete';

export function Scan() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanResult, setScanResult] = useState<Scan | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [cropName, setCropName] = useState('');
  const createScan = useCreateScan();
  const { data: crops = [] } = useCrops();
  const { refetch: refetchDashboard } = useDashboardStats();

  useEffect(() => {
    if (crops.length === 1 && !selectedCropId) {
      setSelectedCropId(crops[0].id);
    }
  }, [crops, selectedCropId]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const startScan = async () => {
    if (!selectedFile) { toast.error('Please select an image first'); return; }
    if (crops.length > 0 && !selectedCropId && !cropName.trim()) {
      toast.error('Please link the image to a crop or enter the crop name before scanning');
      return;
    }
    if (crops.length === 0 && !cropName.trim()) {
      toast.error('Please enter the crop name before scanning');
      return;
    }
    setScanState('uploading');
    setProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 60) { clearInterval(progressInterval); return 60; }
        return p + 5;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (selectedCropId) formData.append('crop_id', selectedCropId);
      if (cropName.trim()) formData.append('crop_name', cropName.trim());

      setScanState('analyzing');

      const analysisInterval = setInterval(() => {
        setProgress(p => { if (p >= 95) { clearInterval(analysisInterval); return 95; } return p + 2; });
      }, 300);

      const result = await createScan.mutateAsync(formData);
      clearInterval(analysisInterval);
      setProgress(100);
      setScanResult(result);
      setScanState('complete');

      // Refresh dashboard to show new alert
      await refetchDashboard();

      // Redirect to report analysis page after scan completion.
      toast.success('Scan complete. Opening analysis report...', { duration: 2500 });
      setTimeout(() => {
        const targetReportId = result?.report_id || result?.id;
        if (targetReportId) {
          navigate(`/analysis/${targetReportId}`);
        }
      }, 2500);
    } catch (err) {
      toast.error('Scan failed. Please try again.');
      setScanState('idle');
      setProgress(0);
    }
  };

  const reset = () => {
    setScanState('idle');
    setScanResult(null);
    setPreview(null);
    setSelectedFile(null);
    setProgress(0);
  };

  const severityColors = {
    critical: { bg: '#FFEBEE', border: '#D32F2F', text: '#D32F2F' },
    warning: { bg: '#FFF3E0', border: '#FF6F00', text: '#FF6F00' },
    info: { bg: '#E3F2FD', border: '#1565C0', text: '#1565C0' },
    healthy: { bg: '#E8F5E9', border: '#2E7D32', text: '#2E7D32' },
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">AI Crop Scanner</h1>
        <p className="text-muted-foreground">Upload a leaf image for instant disease detection and financial impact assessment</p>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* IDLE — file selection */}
        {scanState === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => !preview && fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer ${
                preview ? 'border-[#2E7D32] bg-[#F1F8E9]' : 'border-border hover:border-[#2E7D32] hover:bg-[#F9FBF9]'
              }`}
            >
              {preview ? (
                <div className="relative">
                  <img src={preview} alt="Selected crop" className="max-h-72 mx-auto rounded-xl object-contain shadow-md" />
                  <button onClick={e => { e.stopPropagation(); reset(); }}
                    className="absolute top-2 right-2 bg-white rounded-full p-1.5 shadow-md hover:bg-red-50 transition-all">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                  <p className="mt-4 text-sm text-muted-foreground">{selectedFile?.name} · {((selectedFile?.size || 0) / 1024).toFixed(0)}KB</p>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-[#E8F5E9] rounded-full flex items-center justify-center mx-auto mb-6">
                    <Camera className="w-10 h-10 text-[#2E7D32]" />
                  </div>
                  <h2 className="text-xl font-bold mb-2">Drop Leaf Image Here</h2>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Take a clear photo of the affected leaf. Supports JPEG, PNG, WebP (max 10MB)
                  </p>
                  <div className="flex gap-3 justify-center">
                    <label className="flex items-center gap-2 bg-[#2E7D32] text-white px-6 py-3 rounded-lg font-semibold cursor-pointer hover:bg-[#1B5E20] transition-all">
                      <Upload className="w-5 h-5" /> Upload Image
                      <input ref={fileRef} type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                    </label>
                    <label className="flex items-center gap-2 border-2 border-[#2E7D32] text-[#2E7D32] px-6 py-3 rounded-lg font-semibold cursor-pointer hover:bg-[#E8F5E9] transition-all">
                      <Camera className="w-5 h-5" /> Use Camera
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                    </label>
                  </div>
                </>
              )}
            </div>

            {preview && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 space-y-4">
                {crops.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">Link to Crop</label>
                    <p className="text-xs text-muted-foreground mb-2">Choose a saved crop, or type the crop name below if it is not saved yet.</p>
                    <select value={selectedCropId} onChange={e => setSelectedCropId(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-[#2E7D32] focus:outline-none">
                      <option value="">Select a crop...</option>
                      {crops.map(c => <option key={c.id} value={c.id}>{c.name} — {c.field_name || c.variety || 'Field'}</option>)}
                    </select>
                    <input
                      value={cropName}
                      onChange={e => setCropName(e.target.value)}
                      placeholder="Or type crop name, e.g. Potato"
                      className="w-full mt-3 px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-[#2E7D32] focus:outline-none"
                    />
                  </div>
                )}
                {crops.length === 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">Crop Name</label>
                    <input
                      value={cropName}
                      onChange={e => setCropName(e.target.value)}
                      placeholder="Enter crop name, e.g. Potato"
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-[#2E7D32] focus:outline-none"
                    />
                  </div>
                )}
                <button onClick={startScan}
                  disabled={crops.length > 0 ? (!selectedCropId && !cropName.trim()) : !cropName.trim()}
                  className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg">
                  🔍 Start AI Analysis
                </button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* SCANNING / ANALYZING */}
        {(scanState === 'uploading' || scanState === 'analyzing') && (
          <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-card rounded-2xl border border-border overflow-hidden">
            {preview && (
              <div className="relative h-72 overflow-hidden">
                <img src={preview} alt="Scanning" className="w-full h-full object-cover opacity-70" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <div className="text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="font-semibold">
                        {scanState === 'uploading' ? 'Uploading image...' : 'Analyzing leaf patterns...'}
                      </span>
                    </div>
                    <p className="text-sm opacity-80">
                      {scanState === 'analyzing' ? 'Detecting disease, calculating financial impact...' : 'Preparing image...'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="p-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">{scanState === 'uploading' ? 'Uploading' : 'AI Analysis'}</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-[#2E7D32] to-[#4CAF50] rounded-full"
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {scanState === 'analyzing' ? 'ML disease model in progress...' : 'Secure upload in progress...'}
              </p>
            </div>
          </motion.div>
        )}

        {/* COMPLETE */}
        {scanState === 'complete' && scanResult && (() => {
          const c = severityColors[scanResult.severity] || severityColors.info;
          return (
            <motion.div key="complete" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Header */}
              <div className="bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] rounded-2xl p-8 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold mb-1">Analysis Complete</h2>
                    <p className="opacity-90">Model-based disease detection complete</p>
                  </div>
                  {preview && <img src={preview} alt="Scanned" className="ml-auto w-20 h-20 rounded-xl object-cover opacity-80" />}
                </div>
              </div>

              {/* Result */}
              <div className="rounded-xl border-2 p-6" style={{ backgroundColor: c.bg, borderColor: c.border }}>
                <div className="flex items-start gap-4">
                  <AlertCircle className="w-8 h-8 flex-shrink-0 mt-1" style={{ color: c.text }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-bold">{scanResult.disease_name}</h3>
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: c.text }}>{scanResult.severity}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">Detected in: <strong>{scanResult.plant_name}</strong></p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white/60 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">AI Confidence</p>
                        <p className="text-2xl font-bold" style={{ color: '#2E7D32', fontFamily: 'monospace' }}>{scanResult.confidence}%</p>
                      </div>
                      <div className="bg-white/60 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Potential Loss</p>
                        <p className="text-2xl font-bold" style={{ color: '#D32F2F', fontFamily: 'monospace' }}>
                          ₹{(scanResult.potential_loss || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    {scanResult.regret_insight && (
                      <div className="bg-white rounded-lg p-4 mb-3 border border-red-200">
                        <p className="font-bold text-[#D32F2F] mb-1">⚠️ Regret Projection</p>
                        <p className="text-sm">{scanResult.regret_insight}</p>
                      </div>
                    )}

                    <div className="bg-[#E8F5E9] rounded-lg p-4">
                      <p className="font-bold text-[#2E7D32] mb-1">💡 AI Recommendation</p>
                      <p className="text-sm">{scanResult.recommendation}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button onClick={() => navigate(`/treatment/${scanResult.report_id || scanResult.id}`)}
                  className="flex-1 bg-[#2E7D32] hover:bg-[#1B5E20] text-white py-3 rounded-xl font-bold transition-all">
                  View Full Treatment Plan →
                </button>
                <button onClick={reset}
                  className="px-6 py-3 rounded-xl border-2 border-border font-semibold hover:bg-muted transition-all">
                  Scan Another
                </button>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
