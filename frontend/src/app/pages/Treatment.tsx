import { useParams, useNavigate } from 'react-router';
import { ShieldCheck, ArrowLeft, Clock, LayoutDashboard } from 'lucide-react';
import { useReport } from '../../hooks';

export function Treatment() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { data: report, isLoading, isError } = useReport(reportId);

  if (isLoading) {
    return <div className="p-8">Loading treatment plan...</div>;
  }

  if (isError || !report) {
    return <div className="p-8 text-red-600">Unable to load treatment details.</div>;
  }

  const info = report.disease_info;
  const tips = info?.prevention_tips || (info?.prevention ? [info.prevention] : []);
  const steps = report.treatment_steps || [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(`/analysis/${report.id}`)}
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to analysis
      </button>

      <button
        onClick={() => navigate('/dashboard')}
        className="mb-5 ml-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <LayoutDashboard className="w-4 h-4" />
        Dashboard
      </button>

      <h1 className="text-3xl font-bold mb-2">Treatment Plan</h1>
      <p className="text-muted-foreground mb-6">Report ID: {report.id}</p>

      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">Recommended Treatment</h2>
        <p className="text-base leading-relaxed">{info?.chemical_treatment || report.treatment || 'No treatment recommendation available.'}</p>
        {info?.organic_treatment && (
          <p className="text-sm text-muted-foreground mt-3"><strong>Organic option:</strong> {info.organic_treatment}</p>
        )}
      </div>

      {steps.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Treatment Steps</h2>
          <div className="space-y-3">
            {steps.map(step => (
              <div key={step.step} className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-7 h-7 rounded-full bg-[#E8F5E9] text-[#2E7D32] flex items-center justify-center text-sm font-bold">{step.step}</span>
                  <h3 className="font-semibold">{step.title}</h3>
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{step.duration}</span>
                </div>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                {step.dosage && <p className="text-xs text-[#2E7D32] mt-2">Dosage: {step.dosage}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Prevention Tips</h2>
        {tips.length > 0 ? <ul className="space-y-3">
          {tips.map((tip: string) => (
            <li key={tip} className="flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2E7D32] mt-0.5" />
              <span>{tip}</span>
            </li>
          ))}
        </ul> : <p className="text-muted-foreground">No prevention tips available for this report.</p>}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold mb-2">Severity Level</h2>
        <p className="capitalize font-medium">{report.severity}</p>
      </div>
    </div>
  );
}
