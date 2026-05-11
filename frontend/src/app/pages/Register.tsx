import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Leaf, Eye, EyeOff, Loader2, MapPin, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { toast } from 'sonner';

export function Register() {
  const { register } = useAuth();
  const { setSelectedLocation } = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', location: '', farm_size: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Location search state
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedLoc, setSelectedLoc] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [searchingSuggestions, setSearchingSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Search locations
  const searchLocations = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setSearchingSuggestions(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`
      );
      const results = await response.json();
      setSuggestions(results.slice(0, 5));
    } catch (err) {
      console.error('Location search error:', err);
      setSuggestions([]);
    } finally {
      setSearchingSuggestions(false);
    }
  };

  const selectLocation = (loc: any) => {
    setSelectedLoc({
      name: loc.display_name.split(',')[0],
      lat: parseFloat(loc.lat),
      lon: parseFloat(loc.lon),
    });
    setLocationSearch(loc.display_name.split(',').slice(0, 2).join(','));
    set('location', loc.display_name.split(',').slice(0, 2).join(','));
    setSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) { setError('Name, email and password are required'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!selectedLoc) { setError('Please select your location'); return; }
    
    setLoading(true);
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
        location: form.location || undefined,
        farm_size: form.farm_size ? parseFloat(form.farm_size) : undefined,
        latitude: selectedLoc.lat,
        longitude: selectedLoc.lon,
      });
      
      // Store selected location
      setSelectedLocation({
        lat: selectedLoc.lat,
        lon: selectedLoc.lon,
        name: selectedLoc.name,
        displayName: form.location,
      });
      
      toast.success('Welcome to AgroMind! 🌱');
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E8F5E9] via-white to-[#F1F8E9] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#2E7D32] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Leaf className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#1B5E20]">AgroMind</h1>
          <p className="text-muted-foreground mt-1">Create your farmer account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-border p-8">
          <h2 className="text-2xl font-bold mb-6">Create Account</h2>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">Full Name *</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="Raj Patel" className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" required />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">Email Address *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  placeholder="raj@example.com" className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" required />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                    placeholder="Min 6 characters" className="w-full px-4 py-3 pr-12 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" required />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">Phone (optional)</label>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                  placeholder="9876543210" className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
                <p className="text-[11px] text-muted-foreground mt-1">Saved securely with your profile in the database</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">Farm Size (acres)</label>
                <input type="number" value={form.farm_size} onChange={e => set('farm_size', e.target.value)}
                  placeholder="10" min="0" className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
              </div>

              <div className="col-span-2">
                <label className="text-sm font-medium text-muted-foreground block mb-1.5">📍 Your Location *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => {
                      setLocationSearch(e.target.value);
                      searchLocations(e.target.value);
                    }}
                    placeholder="Search your location (Pune, Kolhapur...)"
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32] transition-all"
                    required
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto">
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => selectLocation(suggestion)}
                          className="w-full text-left px-4 py-2 hover:bg-[#F1F8E9] text-sm flex items-center gap-2 border-b last:border-b-0"
                        >
                          <MapPin className="w-3 h-3 text-[#2E7D32]" />
                          <div>
                            <div className="font-medium text-xs">{suggestion.display_name.split(',')[0]}</div>
                            <div className="text-[11px] text-muted-foreground">{suggestion.display_name.split(',').slice(1, 3).join(',')}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedLoc && (
                  <p className="text-xs text-green-600 mt-1.5 font-medium">✓ Location selected: {selectedLoc.name}</p>
                )}
              </div>
            </div>

            <button type="submit" disabled={loading || !selectedLoc}
              className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Creating account...</> : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-[#2E7D32] font-semibold hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
