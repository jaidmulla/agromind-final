import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Trophy,
  TrendingUp,
  Calendar,
  IndianRupee,
  Zap,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';

interface Task {
  id: string;
  scan_id: string;
  day: number;
  task_title: string;
  task_description: string;
  product_name: string;
  priority: 'urgent' | 'recommended' | 'optional';
  urgency_level: 'high' | 'medium' | 'low';
  reason: string;
  cost_inr: number;
  disease_name: string;
  disease_severity: string;
  status: 'pending' | 'completed';
  completed_at?: string;
  created_at: string;
}

interface DashboardStats {
  total_tasks: number;
  completed_tasks: number;
  total_cost_saved: number;
  total_estimated_loss_prevented: number;
  diseases_treated: string[];
  average_completion_time_hours: number;
}

const PRIORITY_COLORS = {
  urgent: 'text-red-600 bg-red-50',
  recommended: 'text-yellow-600 bg-yellow-50',
  optional: 'text-blue-600 bg-blue-50',
};

const SEVERITY_COLORS = {
  critical: 'text-red-600',
  warning: 'text-orange-600',
  info: 'text-blue-600',
  healthy: 'text-green-600',
};

export function AIDoctorDashboard({ language = 'en' }: { language?: 'en' | 'hi' | 'mr' }) {
  // Fetch all tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['allAIDoctorTasks'],
    queryFn: async () => {
      const response = await api.get<{ data: Task[] }>('/ai-doctor/all-tasks');
      return response.data.data || [];
    },
  });

  // Calculate statistics
  const stats: DashboardStats = {
    total_tasks: tasks.length,
    completed_tasks: tasks.filter(t => t.status === 'completed').length,
    total_cost_saved: tasks
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.cost_inr, 0),
    total_estimated_loss_prevented: tasks.reduce((sum, t) => sum + (t.cost_inr || 0), 0) * 5, // Assume 5x ROI
    diseases_treated: [...new Set(tasks.map(t => t.disease_name))],
    average_completion_time_hours: 24, // Placeholder
  };

  const completionPercentage = stats.total_tasks > 0 
    ? Math.round((stats.completed_tasks / stats.total_tasks) * 100) 
    : 0;

  const recentTasks = tasks
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const completedTasks = tasks.filter(t => t.status === 'completed')
    .sort((a, b) => new Date(b.completed_at || '').getTime() - new Date(a.completed_at || '').getTime())
    .slice(0, 5);

  const translations = {
    en: {
      title: 'AI Doctor Task Dashboard',
      subtitle: 'Your Treatment Progress & Success Stories',
      stats: 'Your Statistics',
      totalTasks: 'Total Tasks',
      completedTasks: 'Completed Tasks',
      costSaved: 'Cost of Treatments',
      lossPrevented: 'Est. Loss Prevented',
      diseasesTreated: 'Diseases Treated',
      recentTasks: 'Recent Tasks',
      completedTasks_label: 'Completed Tasks',
      status: 'Status',
      priority: 'Priority',
      disease: 'Disease',
      crop: 'Crop',
      cost: 'Cost',
      noTasks: 'No tasks yet! Upload a disease image to get started.',
      successRate: 'Completion Rate',
      achievements: 'Your Achievements',
      firstTask: 'First Task Completed',
      tenTasks: '10+ Tasks Done',
      healthyField: 'Healthy Field',
      savingsGoal: 'Savings Goal: ₹5,000+',
    },
    hi: {
      title: 'AI डॉक्टर कार्य डैशबोर्ड',
      subtitle: 'आपकी उपचार प्रगति और सफलता की कहानियां',
      stats: 'आपकी सांख्यिकी',
      totalTasks: 'कुल कार्य',
      completedTasks: 'पूर्ण किए गए कार्य',
      costSaved: 'उपचार की लागत',
      lossPrevented: 'अनुमानित नुकसान रोकथाम',
      diseasesTreated: 'इलाज किए गए रोग',
      recentTasks: 'हाल के कार्य',
      completedTasks_label: 'पूर्ण किए गए कार्य',
      status: 'स्थिति',
      priority: 'प्राथमिकता',
      disease: 'रोग',
      crop: 'फसल',
      cost: 'लागत',
      noTasks: 'अभी कोई कार्य नहीं! शुरू करने के लिए रोग की छवि अपलोड करें।',
      successRate: 'पूर्णता दर',
      achievements: 'आपकी उपलब्धियां',
      firstTask: 'पहला कार्य पूर्ण',
      tenTasks: '10+ कार्य पूर्ण',
      healthyField: 'स्वस्थ खेत',
      savingsGoal: 'बचत लक्ष्य: ₹5,000+',
    },
    mr: {
      title: 'AI डॉक्टर कार्य डॅशबोर्ड',
      subtitle: 'आपली उपचार प्रगती आणि यशस्वी कहाणी',
      stats: 'आपकी आकडेवारी',
      totalTasks: 'एकूण कार्य',
      completedTasks: 'पूर्ण केलेले कार्य',
      costSaved: 'उपचार खर्च',
      lossPrevented: 'अंदाजे नुकसान टाळण्यात आले',
      diseasesTreated: 'उपचारित रोग',
      recentTasks: 'अलीकडील कार्य',
      completedTasks_label: 'पूर्ण केलेले कार्य',
      status: 'स्थिती',
      priority: 'प्राधान्य',
      disease: 'रोग',
      crop: 'पीक',
      cost: 'खर्च',
      noTasks: 'अद्याप कोणतेही कार्य नाही! सुरू करण्यासाठी रोग चित्र अपलोड करा.',
      successRate: 'पूर्णता दर',
      achievements: 'आपली उपलब्धी',
      firstTask: 'पहिले कार्य पूर्ण',
      tenTasks: '10+ कार्य पूर्ण',
      healthyField: 'निरोगी शेत',
      savingsGoal: 'बचत लक्ष्य: ₹5,000+',
    },
  };

  const t = translations[language as keyof typeof translations] || translations.en;

  if (tasks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.title}</h2>
          <p className="text-gray-600">{t.noTasks}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </motion.div>

        {/* Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {/* Total Tasks */}
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{t.totalTasks}</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_tasks}</p>
              </div>
              <div className="text-blue-500 opacity-20">
                <Zap className="w-12 h-12" />
              </div>
            </div>
          </div>

          {/* Completed Tasks */}
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{t.completedTasks}</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed_tasks}</p>
                <p className="text-xs text-gray-500 mt-1">{completionPercentage}% {t.successRate}</p>
              </div>
              <div className="text-green-500 opacity-20">
                <CheckCircle2 className="w-12 h-12" />
              </div>
            </div>
          </div>

          {/* Cost Saved */}
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{t.costSaved}</p>
                <p className="text-3xl font-bold text-yellow-600">₹{stats.total_cost_saved.toLocaleString()}</p>
              </div>
              <div className="text-yellow-500 opacity-20">
                <IndianRupee className="w-12 h-12" />
              </div>
            </div>
          </div>

          {/* Loss Prevented */}
          <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">{t.lossPrevented}</p>
                <p className="text-3xl font-bold text-red-600">₹{stats.total_estimated_loss_prevented.toLocaleString()}</p>
              </div>
              <div className="text-red-500 opacity-20">
                <TrendingUp className="w-12 h-12" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Completion Rate Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-6 shadow-md mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t.successRate}</h3>
            <span className="text-2xl font-bold text-green-600">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionPercentage}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-4 rounded-full bg-gradient-to-r from-green-500 to-blue-500"
            />
          </div>
        </motion.div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Tasks */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-md"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.recentTasks}</h3>
            <div className="space-y-3">
              {recentTasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className={`p-4 rounded-lg border-l-4 ${PRIORITY_COLORS[task.priority]}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm text-gray-900">{task.task_title}</h4>
                    <span className="text-xs text-gray-600">{t.disease}: {task.disease_name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>₹{task.cost_inr}</span>
                    <span>{task.priority === 'urgent' ? '🔴' : task.priority === 'recommended' ? '🟡' : '🔵'}</span>
                    <span>{task.status === 'completed' ? '✅' : '⏳'}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Completed Tasks */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-md"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t.completedTasks_label}
            </h3>
            <div className="space-y-3">
              {completedTasks.length > 0 ? (
                completedTasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="p-4 rounded-lg bg-green-50 border-l-4 border-green-500"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm text-gray-900 line-through">
                        {task.task_title}
                      </h4>
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-gray-600">
                      {task.disease_name} • ₹{task.cost_inr}
                    </p>
                  </motion.div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">{t.noTasks}</p>
              )}
            </div>
          </motion.div>
        </div>

        {/* Diseases Treated */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl p-6 shadow-md mt-8"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t.diseasesTreated}</h3>
          <div className="flex flex-wrap gap-2">
            {stats.diseases_treated.map((disease, index) => (
              <motion.span
                key={disease}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.05 }}
                className="px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium"
              >
                {disease}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Achievements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl p-6 shadow-md mt-8 text-white"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            {t.achievements}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <p className="text-sm opacity-90">{t.firstTask}</p>
              <p className="text-2xl font-bold mt-2">
                {stats.completed_tasks > 0 ? '✅' : '⬜'}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <p className="text-sm opacity-90">{t.tenTasks}</p>
              <p className="text-2xl font-bold mt-2">
                {stats.completed_tasks >= 10 ? '✅' : `${stats.completed_tasks}/10`}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <p className="text-sm opacity-90">{t.savingsGoal}</p>
              <p className="text-2xl font-bold mt-2">
                {stats.total_estimated_loss_prevented >= 5000 ? '✅' : `₹${Math.min(stats.total_estimated_loss_prevented, 5000)}`}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
