import { motion } from 'motion/react';
import { Bell, User, Shield, Loader2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationPrefs, useUpdateNotificationPrefs, useUpdateProfile } from '../../hooks';
import { authApi } from '../../services/api';
import { toast } from 'sonner';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-[#2E7D32]' : 'bg-muted'}`}>
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-6' : ''}`} />
    </button>
  );
}

export function Settings() {
  const { user, updateUser } = useAuth();
  const { data: prefs } = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();
  const updateProfile = useUpdateProfile();

  const [profile, setProfile] = useState({ name: '', phone: '', location: '', farm_size: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', phone: user.phone || '', location: user.location || '', farm_size: user.farm_size ? String(user.farm_size) : '' });
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateProfile.mutateAsync({ name: profile.name, phone: profile.phone, location: profile.location, farm_size: profile.farm_size ? parseFloat(profile.farm_size) : undefined });
      updateUser(updated);
    } catch {} finally { setSavingProfile(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setSavingPassword(true);
    try {
      await authApi.changePassword(passwords.current, passwords.next);
      toast.success('Password changed successfully');
      setPasswords({ current: '', next: '' });
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to change password');
    } finally { setSavingPassword(false); }
  };

  const togglePref = (key: string, val: boolean) => {
    updatePrefs.mutate({ [key]: val });
  };

  const notifSettings = [
    { key: 'critical_alerts', label: 'Critical Alerts', desc: 'Immediate disease outbreak notifications', value: prefs?.critical_alerts ?? true },
    { key: 'warning_alerts', label: 'Warning Alerts', desc: 'Early warning disease notifications', value: prefs?.warning_alerts ?? true },
    { key: 'info_alerts', label: 'Info Alerts', desc: 'Irrigation and nutrient tips', value: prefs?.info_alerts ?? false },
    { key: 'email_notifications', label: 'Email Notifications', desc: 'Receive alerts via email', value: prefs?.email_notifications ?? true },
    { key: 'sms_notifications', label: 'SMS Alerts', desc: 'Receive alerts via SMS', value: prefs?.sms_notifications ?? false },
    { key: 'nearby_farmer_alerts', label: 'Nearby Disease Alerts', desc: 'Alert when disease outbreak within 50km', value: prefs?.nearby_farmer_alerts ?? true },
    { key: 'weekly_report', label: 'Weekly Report', desc: 'Weekly farm performance summary', value: prefs?.weekly_report ?? true },
    { key: 'community_updates', label: 'Community Updates', desc: 'New posts from nearby farmers', value: prefs?.community_updates ?? false },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </motion.div>

      <div className="space-y-6">
        {/* Profile */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <h2 className="text-xl font-bold">Profile</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-sm text-muted-foreground block mb-1.5">Full Name</label>
                <input value={profile.name} onChange={e => setProfile(p => ({...p, name: e.target.value}))}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5">Phone</label>
                <input value={profile.phone} onChange={e => setProfile(p => ({...p, phone: e.target.value}))}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5">Farm Size (acres)</label>
                <input type="number" value={profile.farm_size} onChange={e => setProfile(p => ({...p, farm_size: e.target.value}))}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
              </div>
              <div className="col-span-2">
                <label className="text-sm text-muted-foreground block mb-1.5">Location</label>
                <input value={profile.location} onChange={e => setProfile(p => ({...p, location: e.target.value}))}
                  placeholder="Pune, Maharashtra" className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" />
              </div>
            </div>
            <button type="submit" disabled={savingProfile}
              className="flex items-center gap-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-6 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-60">
              {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </button>
          </form>
        </motion.div>

        {/* Notifications */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <h2 className="text-xl font-bold">Notifications</h2>
          </div>
          <div className="space-y-4">
            {notifSettings.map(({ key, label, desc, value }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Toggle checked={value} onChange={(v) => togglePref(key, v)} />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Password */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#2E7D32]" />
            </div>
            <h2 className="text-xl font-bold">Change Password</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Current Password</label>
              <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({...p, current: e.target.value}))}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" required />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">New Password</label>
              <input type="password" value={passwords.next} onChange={e => setPasswords(p => ({...p, next: e.target.value}))}
                className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-[#2E7D32]" required minLength={6} />
            </div>
            <button type="submit" disabled={savingPassword}
              className="flex items-center gap-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white px-6 py-2.5 rounded-lg font-semibold transition-all disabled:opacity-60">
              {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Update Password
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
