import { NavLink, useNavigate } from 'react-router';
import { LayoutDashboard, Scan, Users, BarChart3, Settings, LogOut, Leaf, CloudSun, FlaskConical, Map, BookOpen, MessageCircle, Play, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/scan', icon: Scan, label: 'AI Scan' },
    { to: '/simulation', icon: Play, label: 'Before/After' },
    { to: '/community', icon: Users, label: 'Community' },
    { to: '/map', icon: Map, label: 'Disease Map' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/weather', icon: CloudSun, label: 'Weather' },
    { to: '/chat', icon: MessageCircle, label: 'AI Doctor' },
    { to: '/llm', icon: Sparkles, label: 'AI Chat' },
    { to: '/schemes', icon: BookOpen, label: 'Gov Schemes' },
    { to: '/explain', icon: FlaskConical, label: 'Explainable AI' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'FP';

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#2E7D32] rounded-lg flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-sidebar-primary" style={{ fontFamily: 'var(--font-heading)' }}>
              AgroMind
            </h1>
            <p className="text-xs text-muted-foreground">Regret AI+</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map((link, index) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`
            }
          >
            {({ isActive }) => (
              <motion.div
                className="flex items-center gap-3 w-full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <link.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{link.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-current"
                  />
                )}
              </motion.div>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg">
          <div className="w-10 h-10 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user?.name || 'Farmer'}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.farm_size ? `${user.farm_size} acres` : user?.location || 'AgroMind Farmer'}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2 w-full rounded-lg text-sm text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
