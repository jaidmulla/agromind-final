import { motion } from 'motion/react';
import { Brain, Eye, BarChart2, Shield, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useScans } from '../../hooks';

const MODEL_INFO = {
  ai: {
    name: 'OpenAI GPT-4o-mini (Vision)',
    type: 'Large Language Vision Model',
    provider: 'OpenAI',
    strengths: ['Nuanced language understanding', 'Contextual financial analysis', 'Treatment recommendation generation', 'Behavioral regret messaging'],
    limitations: ['May hallucinate in low-light images', 'Performance varies on novel disease strains'],
  },
  ml: {
    name: 'MobileNetV2 Fine-tuned',
    type: 'Convolutional Neural Network (CNN)',
    dataset: 'PlantVillage Dataset (38 classes)',
    parameters: '3,060,070',
    classes: 38,
    strengths: ['Fast inference (<2 seconds)', 'Trained on verified disease images', 'Consistent class probability output'],
    limitations: ['Fixed to 38 PlantVillage classes', 'Requires clear leaf images', 'No novel disease detection'],
  },
};

const DISEASE_CLASSES = [
  { name: 'Tomato Late Blight', severity: 'critical', confidence_typical: '88–95%' },
  { name: 'Potato Late Blight', severity: 'critical', confidence_typical: '85–93%' },
  { name: 'Tomato Early Blight', severity: 'warning', confidence_typical: '82–91%' },
  { name: 'Corn Northern Leaf Blight', severity: 'critical', confidence_typical: '80–89%' },
  { name: 'Grape Black Rot', severity: 'critical', confidence_typical: '83–92%' },
  { name: 'Tomato TYLCV', severity: 'critical', confidence_typical: '87–94%' },
  { name: 'Healthy Tomato', severity: 'healthy', confidence_typical: '90–97%' },
  { name: 'Healthy Potato', severity: 'healthy', confidence_typical: '88–95%' },
];

function AccordionItem({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: React.ElementType }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-all">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
            <Icon className="w-4 h-4 text-[#2E7D32]" />
          </div>
          <span className="font-bold">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export function ExplainableAI() {
  const { data: scans = [] } = useScans({ limit: 5 });
  const severityColor = (s: string) => s === 'critical' ? '#D32F2F' : s === 'warning' ? '#FF6F00' : '#2E7D32';

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Explainable AI</h1>
        <p className="text-muted-foreground">Understand how AgroMind makes decisions — transparency and trust</p>
      </motion.div>

      <div className="space-y-4">
        {/* How it works */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] rounded-2xl p-6 text-white">
          <h2 className="text-xl font-bold mb-4">How AgroMind Detects Disease</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { step: '1', label: 'Image Upload', desc: 'Farmer uploads leaf photo' },
              { step: '2', label: 'CNN Analysis', desc: 'MobileNetV2 classifies disease' },
              { step: '3', label: 'AI Validation', desc: 'OpenAI Vision validates + enriches' },
              { step: '4', label: 'Regret AI', desc: 'Loss + urgency calculated' },
            ].map(({ step, label, desc }) => (
              <div key={step} className="text-center">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 font-bold">{step}</div>
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs opacity-80 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* AI Models */}
        <AccordionItem title="AI Models Used" icon={Brain}>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-[#E3F2FD] rounded-xl p-4">
              <p className="font-bold text-[#1565C0] mb-1">{MODEL_INFO.ai.name}</p>
              <p className="text-xs text-muted-foreground mb-3">{MODEL_INFO.ai.type} · {MODEL_INFO.ai.provider}</p>
              <p className="text-xs font-semibold mb-1">Strengths:</p>
              {MODEL_INFO.ai.strengths.map(s => <p key={s} className="text-xs text-muted-foreground">✓ {s}</p>)}
            </div>
            <div className="bg-[#E8F5E9] rounded-xl p-4">
              <p className="font-bold text-[#2E7D32] mb-1">{MODEL_INFO.ml.name}</p>
              <p className="text-xs text-muted-foreground mb-1">{MODEL_INFO.ml.type}</p>
              <p className="text-xs text-muted-foreground mb-3">Dataset: {MODEL_INFO.ml.dataset}</p>
              <p className="text-xs font-semibold mb-1">Strengths:</p>
              {MODEL_INFO.ml.strengths.map(s => <p key={s} className="text-xs text-muted-foreground">✓ {s}</p>)}
            </div>
          </div>
        </AccordionItem>

        {/* Disease Classes */}
        <AccordionItem title={`Detectable Diseases (${MODEL_INFO.ml.classes} Classes)`} icon={Eye}>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {DISEASE_CLASSES.map(d => (
              <div key={d.name} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
                <span>{d.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{d.confidence_typical}</span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColor(d.severity) }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Full list: Apple (4), Blueberry (1), Cherry (2), Corn (4), Grape (4), Orange (1), Peach (2), Pepper (2), Potato (3), Raspberry (1), Soybean (1), Squash (1), Strawberry (2), Tomato (10)</p>
        </AccordionItem>

        {/* Regret AI Engine */}
        <AccordionItem title="Regret AI Engine — Behavioral Psychology" icon={BarChart2}>
          <div className="space-y-3 mt-2 text-sm">
            <p className="text-muted-foreground">AgroMind uses <strong>regret theory</strong> from behavioral economics to motivate faster action:</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { concept: 'Loss Framing', desc: 'People act faster when shown concrete ₹ loss vs abstract risk percentages' },
                { concept: 'Urgency Scoring', desc: 'A 0–100 score computed from severity × confidence × time-to-damage' },
                { concept: 'Daily Loss Clock', desc: 'Shows exactly how much money is lost per day of inaction' },
                { concept: 'Social Proof', desc: 'Shows how many nearby farmers solved the same problem successfully' },
              ].map(({ concept, desc }) => (
                <div key={concept} className="bg-muted rounded-xl p-3">
                  <p className="font-bold text-xs mb-1">{concept}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#E8F5E9] rounded-xl p-4">
              <p className="font-bold text-[#2E7D32] text-sm mb-2">Regret Score Formula</p>
              <code className="text-xs font-mono block bg-white rounded p-2">
                score = severity_weight + min(35, loss_inr/1500) + (confidence% × 0.20) + max(0, 12-urgency_days)
              </code>
              <p className="text-xs text-muted-foreground mt-2">Critical=40pts, Warning=25pts, Info=10pts. Max score: 100.</p>
            </div>
          </div>
        </AccordionItem>

        {/* Confidence Interpretation */}
        <AccordionItem title="How to Interpret Confidence Scores" icon={Info}>
          <div className="space-y-3 mt-2">
            {[
              { range: '90–100%', label: 'Very High Confidence', desc: 'Clear, well-lit image with classic disease symptoms. Act immediately.', color: '#D32F2F' },
              { range: '75–89%', label: 'High Confidence', desc: 'Strong match to known disease pattern. Treatment recommended.', color: '#FF6F00' },
              { range: '60–74%', label: 'Moderate Confidence', desc: 'Possible match. Retake image or consult extension officer.', color: '#FFA000' },
              { range: 'Below 60%', label: 'Low Confidence', desc: 'Image may be blurry or disease is early-stage. Retake for accuracy.', color: '#1565C0' },
            ].map(({ range, label, desc, color }) => (
              <div key={range} className="flex items-start gap-3">
                <span className="text-sm font-bold w-20 flex-shrink-0" style={{ color }}>{range}</span>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </AccordionItem>

        {/* Trust */}
        <AccordionItem title="Data Privacy & Trust" icon={Shield}>
          <div className="space-y-2 mt-2 text-sm text-muted-foreground">
            <p>✅ Leaf images are processed server-side and stored securely on your account only</p>
            <p>✅ Images are never shared with other farmers or third parties</p>
            <p>✅ AI analysis uses OpenAI — no training on your farm data</p>
            <p>✅ Community posts are only shared with your explicit consent</p>
            <p>✅ Location data (lat/lon) is used only for nearby farmer alerts you can disable in Settings</p>
            <p>✅ All data is encrypted in transit (HTTPS) and at rest (PostgreSQL encryption)</p>
          </div>
        </AccordionItem>

        {/* Recent Scan Analysis */}
        {scans.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl border border-border p-6">
            <h3 className="font-bold mb-4">Your Recent AI Decisions</h3>
            <div className="space-y-3">
              {scans.slice(0,4).map(scan => (
                <div key={scan.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{scan.disease_name}</p>
                    <p className="text-xs text-muted-foreground">{scan.plant_name} · {new Date(scan.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{scan.confidence}% confident</span>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: severityColor(scan.severity) }} />
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full capitalize">{scan.source || 'ai'}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
