import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertTriangle, CalendarDays, ArrowRight, Leaf, ShieldCheck, FlaskConical, Droplets } from 'lucide-react';
import { useReport } from '../../hooks';

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || '';

function severityUi(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') return { text: 'High', bg: '#FFEBEE', color: '#C62828' };
  if (severity === 'medium') return { text: 'Medium', bg: '#FFF3E0', color: '#EF6C00' };
  return { text: 'Low', bg: '#E8F5E9', color: '#2E7D32' };
}

export function Analysis() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { data: report, isLoading, isError } = useReport(reportId);

  const imageUrl = useMemo(() => {
    if (!report?.image_path) return '';
    if (report.image_path.startsWith('http://') || report.image_path.startsWith('https://')) {
      return report.image_path;
    }
    return `${BACKEND_URL}${report.image_path}`;
  }, [report]);

  if (isLoading) {
    return <div className="p-8">Loading analysis...</div>;
  }

  if (isError || !report) {
    return <div className="p-8 text-red-600">Unable to load report analysis.</div>;
  }

  const severity = severityUi(report.severity);
  const info = report.disease_info;
  const yieldLoss = Number(info?.yield_loss_percent || 0);
  const potentialLoss = Number(report.potential_loss || 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Analysis Report</h1>
      <p className="text-muted-foreground mb-6">Report ID: {report.id}</p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border overflow-hidden bg-card">
          {imageUrl ? (
            <img src={imageUrl} alt="Uploaded leaf" className="w-full h-[360px] object-cover" />
          ) : (
            <div className="h-[360px] flex items-center justify-center text-muted-foreground">No image available</div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">{report.disease_name}</h2>
            <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: severity.bg, color: severity.color }}>
              {severity.text}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-2xl font-bold">{Math.round(report.confidence)}%</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Crop Name</p>
              <p className="text-lg font-bold">{report.plant_name || report.crop_name || 'Detected crop'}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Yield Loss Risk</p>
              <p className="text-2xl font-bold">{yieldLoss}%</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Detected At</p>
              <p className="text-sm font-medium flex items-center gap-1 mt-1">
                <CalendarDays className="w-4 h-4" />
                {new Date(report.created_at).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-xl p-4 border" style={{ borderColor: severity.color }}>
            <p className="font-semibold mb-1 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Disease Summary
            </p>
            <p className="text-sm text-muted-foreground">
              The trained model detected {report.disease_name} on {report.plant_name || report.crop_name || 'the uploaded crop'} with {Math.round(report.confidence)}% confidence.
              {potentialLoss > 0 ? ` Potential loss is estimated at ₹${potentialLoss.toLocaleString('en-IN')} per acre.` : ''}
            </p>
          </div>

          <button
            onClick={() => navigate(report.scan_id ? `/solution/${report.scan_id}` : `/treatment/${report.id}`)}
            className="mt-6 w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            Open Full Scan Report
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Leaf className="w-4 h-4 text-[#2E7D32]" /> Symptoms</h3>
          {(info?.symptoms || []).length > 0 ? (
            <ul className="text-sm text-muted-foreground space-y-1">{info?.symptoms?.map(item => <li key={item}>- {item}</li>)}</ul>
          ) : <p className="text-sm text-muted-foreground">No symptom list available.</p>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#2E7D32]" /> Prevention</h3>
          <p className="text-sm text-muted-foreground">{info?.prevention || 'No prevention guidance available.'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><FlaskConical className="w-4 h-4 text-[#1565C0]" /> Treatment</h3>
          <p className="text-sm text-muted-foreground">{info?.chemical_treatment || report.treatment || 'No treatment guidance available.'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Droplets className="w-4 h-4 text-[#1565C0]" /> Irrigation</h3>
          <p className="text-sm text-muted-foreground">{info?.irrigation_suggestions || 'No irrigation guidance available.'}</p>
        </div>
      </div>
    </div>
  );
}
