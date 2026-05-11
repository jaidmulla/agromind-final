import { useParams, useNavigate } from 'react-router';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useReport } from '../../hooks';

function preventionTips(severity: 'low' | 'medium' | 'high') {
  if (severity === 'high') {
    return [
      'Isolate infected plants immediately to reduce spread.',
      'Apply treatment today and repeat exactly as instructed on product label.',
      'Inspect nearby plants daily for at least 7 days.',
    ];
  }
  if (severity === 'medium') {
    return [
      'Start treatment in the next 24 hours.',
      'Maintain leaf dryness and improve airflow around plants.',
      'Recheck crop condition every 2 days and rescan if symptoms worsen.',
    ];
  }
  return [
    'Continue regular weekly crop checks.',
    'Maintain preventive hygiene and remove weak leaves.',
    'Use balanced nutrition and irrigation practices.',
  ];
}

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

  const tips = preventionTips(report.severity);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button
        onClick={() => navigate(`/analysis/${report.id}`)}
        className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to analysis
      </button>

      <h1 className="text-3xl font-bold mb-2">Treatment Plan</h1>
      <p className="text-muted-foreground mb-6">Report ID: {report.id}</p>

      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-2">Recommended Treatment</h2>
        <p className="text-base leading-relaxed">{report.treatment || 'No treatment recommendation available.'}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Prevention Tips</h2>
        <ul className="space-y-3">
          {tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2E7D32] mt-0.5" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-semibold mb-2">Severity Level</h2>
        <p className="capitalize font-medium">{report.severity}</p>
      </div>
    </div>
  );
}
