import { Outlet } from 'react-router';
import { Sidebar } from '../components/Sidebar';
import { useEffect, useState } from 'react';

export function RootLayout() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {isOffline && (
          <div className="bg-[#FF6F00] text-white px-4 py-2 text-center text-sm font-medium">
            ⚠️ You're offline · Showing cached data
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
