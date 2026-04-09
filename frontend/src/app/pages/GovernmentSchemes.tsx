import { motion } from 'motion/react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useCrops } from '../../hooks';
import { BookOpen, ExternalLink, Filter, Leaf, Banknote, ShieldCheck, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'All Schemes' },
  { key: 'insurance', label: '🛡️ Insurance' },
  { key: 'subsidy', label: '💰 Subsidy' },
  { key: 'credit', label: '🏦 Credit' },
  { key: 'income_support', label: '💸 Income Support' },
  { key: 'infrastructure', label: '🏗️ Infrastructure' },
  { key: 'training', label: '📚 Training' },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  insurance: <ShieldCheck className="w-4 h-4" />,
  subsidy: <Banknote className="w-4 h-4" />,
  credit: <TrendingUp className="w-4 h-4" />,
  income_support: <Banknote className="w-4 h-4" />,
  infrastructure: <BookOpen className="w-4 h-4" />,
  training: <BookOpen className="w-4 h-4" />,
};

function SchemeCard({ scheme }: { scheme: any }) {
  const [expanded, setExpanded] = useState(false);
  const catColor = scheme.category === 'insurance' ? '#1565C0' : scheme.category === 'subsidy' ? '#2E7D32' : scheme.category === 'credit' ? '#6A1B9A' : '#FF6F00';

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-md transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: catColor }}>{scheme.category.replace('_', ' ')}</span>
              {scheme.max_amount_inr > 0 && (
                <span className="text-xs bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full font-bold">
                  Up to ₹{scheme.max_amount_inr.toLocaleString('en-IN')}
                </span>
              )}
              {scheme.subsidy_pct > 0 && (
                <span className="text-xs bg-[#FFF3E0] text-[#FF6F00] px-2 py-0.5 rounded-full font-bold">
                  {scheme.subsidy_pct}% subsidy
                </span>
              )}
            </div>
            <h3 className="font-bold text-base leading-snug">{scheme.name}</h3>
            <p className="text-xs text-muted-foreground mt-1">{scheme.ministry}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{scheme.description}</p>

        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-[#2E7D32] font-semibold mt-3 hover:underline">
          {expanded ? <><ChevronUp className="w-3 h-3" /> Less details</> : <><ChevronDown className="w-3 h-3" /> See details</>}
        </button>

        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 space-y-3">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">KEY BENEFITS</p>
              {scheme.benefits.map((b: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm py-0.5">
                  <span className="text-[#2E7D32] flex-shrink-0">✓</span><span>{b}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">ELIGIBILITY</p>
                <p className="text-xs">{scheme.eligibility}</p>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">HOW TO APPLY</p>
                <p className="text-xs">{scheme.how_to_apply}</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#FF6F00]">⏰ {scheme.deadline}</span>
              <a href={scheme.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#1565C0] font-semibold hover:underline">
                Official Site <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function InputCard({ crop }: { crop: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['inputs', crop],
    queryFn: () => api.get(`/schemes/inputs/${crop}`).then(r => r.data.data),
    enabled: !!crop,
  });
  if (isLoading) return <div className="h-32 bg-muted rounded-xl animate-pulse" />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-bold mb-2 flex items-center gap-2"><Leaf className="w-4 h-4 text-[#2E7D32]" /> Fertilizer Schedule</h4>
        <div className="space-y-2">
          {data.fertilizers.map((f: any, i: number) => (
            <div key={i} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
              <div><p className="font-medium">{f.name}</p><p className="text-xs text-muted-foreground">{f.timing}</p></div>
              <div className="text-right"><p className="font-bold text-[#2E7D32]">{f.dose}</p><p className="text-xs text-muted-foreground">₹{f.price_per_kg}/kg</p></div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-bold mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#D32F2F]" /> Disease Protection</h4>
        <div className="space-y-2">
          {data.pesticides.map((p: any, i: number) => (
            <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${p.organic ? 'bg-[#E8F5E9]' : 'bg-muted'}`}>
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.timing}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{p.dose}</p>
                {p.organic && <span className="text-xs text-[#2E7D32] font-bold">🌿 Organic</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-bold mb-2">📋 Best Practices</h4>
        {data.best_practices.map((bp: string, i: number) => (
          <p key={i} className="text-sm text-muted-foreground py-1">• {bp}</p>
        ))}
      </div>
      <div className="bg-[#E3F2FD] rounded-xl p-4">
        <p className="text-sm font-bold text-[#1565C0]">Estimated Input Cost: ₹{data.estimated_input_cost_inr?.toLocaleString('en-IN')}/acre</p>
      </div>
    </div>
  );
}

export function GovernmentSchemes() {
  const [category, setCategory] = useState('all');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [activeTab, setActiveTab] = useState<'schemes' | 'inputs'>('schemes');
  const { data: crops = [] } = useCrops();

  const { data: schemesData, isLoading } = useQuery({
    queryKey: ['schemes', category, selectedCrop],
    queryFn: () => api.get('/schemes', { params: { category: category !== 'all' ? category : undefined, crop: selectedCrop || undefined } }).then(r => r.data.data),
    staleTime: 5 * 60_000,
  });

  const schemes = schemesData || [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Government Support</h1>
        <p className="text-muted-foreground">Schemes, subsidies, insurance + smart input recommendations for your crops</p>
      </motion.div>

      {/* Tab switch */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('schemes')}
          className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${activeTab === 'schemes' ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground'}`}>
          🏛️ Government Schemes
        </button>
        <button onClick={() => setActiveTab('inputs')}
          className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${activeTab === 'inputs' ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground'}`}>
          🌿 Input Recommendations
        </button>
      </div>

      {activeTab === 'schemes' && (
        <>
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => setCategory(c.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${category === c.key ? 'bg-[#2E7D32] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {c.label}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <input
              value={selectedCrop}
              onChange={e => setSelectedCrop(e.target.value.toLowerCase())}
              placeholder="Filter by crop type (e.g. tomato)"
              className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-[#2E7D32] focus:outline-none"
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">{schemes.length} schemes found</p>
              <div className="grid grid-cols-1 gap-4">
                {schemes.map((s: any) => <SchemeCard key={s.id} scheme={s} />)}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'inputs' && (
        <div>
          <div className="mb-6">
            <label className="text-sm font-medium text-muted-foreground block mb-2">Select your crop for recommendations</label>
            <select value={selectedCrop} onChange={e => setSelectedCrop(e.target.value)}
              className="w-full md:w-80 px-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-[#2E7D32] focus:outline-none">
              <option value="">Choose a crop...</option>
              {[...new Set(crops.map((c: any) => c.name))].map(c => (
                <option key={c} value={String(c).toLowerCase()}>{c}</option>
              ))}
            </select>
          </div>
          {selectedCrop ? (
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="text-xl font-bold mb-4 capitalize">{selectedCrop} — Complete Input Plan</h3>
              <InputCard crop={selectedCrop} />
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <Leaf className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a crop to see fertilizer schedule, pesticide plan, and best practices</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
