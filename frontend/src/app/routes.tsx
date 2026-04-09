import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { RootLayout } from './layouts/RootLayout';
import { Dashboard } from './pages/Dashboard';
import { Scan } from './pages/Scan';
import { Community } from './pages/Community';
import { Analytics } from './pages/Analytics';
import { Solution } from './pages/Solution';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { NotFound } from './pages/NotFound';
import { WeatherDashboard } from './pages/WeatherDashboard';
import { ExplainableAI } from './pages/ExplainableAI';
import { DiseaseMap } from './pages/DiseaseMap';
import { GovernmentSchemes } from './pages/GovernmentSchemes';
import { AIDoctorChat } from './pages/AIDoctorChat';
import { AIDoctorPage } from './pages/AIDoctorPage';
import { AIDoctorTasksDashboard } from './pages/AIDoctorTasksDashboard';
import { BeforeAfterSimulation } from './pages/BeforeAfterSimulation';
import LossPreventionDashboard from './pages/LossPreventionDashboard';
import { useAuth } from '../contexts/AuthContext';

function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground text-sm">Loading AgroMind...</p>
      </div>
    </div>
  );
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
}

export const router = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/login', Component: Login },
      { path: '/register', Component: Register },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        Component: RootLayout,
        children: [
          { index: true, Component: Dashboard },
          { path: 'dashboard', Component: Dashboard },
          { path: 'scan', Component: Scan },
          { path: 'result', element: <Navigate to="/explain" replace /> },
          { path: 'prediction', element: <Navigate to="/simulation" replace /> },
          { path: 'solution', element: <Navigate to="/scan" replace /> },
          { path: 'community', Component: Community },
          { path: 'analytics', Component: Analytics },
          { path: 'solution/:id', Component: Solution },
          { path: 'settings', Component: Settings },
          { path: 'weather', Component: WeatherDashboard },
          { path: 'explain', Component: ExplainableAI },
          { path: 'map', Component: DiseaseMap },
          { path: 'schemes', Component: GovernmentSchemes },
          { path: 'chat', Component: AIDoctorChat },
          { path: 'ai-doctor/:scanId', Component: AIDoctorPage },
          { path: 'ai-doctor-tasks', Component: AIDoctorTasksDashboard },
          { path: 'simulation', Component: BeforeAfterSimulation },
          { path: 'losses', Component: LossPreventionDashboard },
          { path: '*', Component: NotFound },
        ],
      },
    ],
  },
]);
