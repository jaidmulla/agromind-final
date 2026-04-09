import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  IndianRupee,
  Zap,
  Users,
  X,
  Loader2,
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Task {
  id: string;
  day: number;
  title: string;
  description: string;
  product: string;
  cost_inr: number;
  duration_hours: number;
  priority: 'urgent' | 'recommended' | 'optional';
  status: 'pending' | 'completed';
  disease_name: string;
}

interface Recommendation {
  success: boolean;
  data: {
    summary: string;
    disease_name: string;
    severity: 'critical' | 'warning' | 'info' | 'healthy';
    tasks: Task[];
    total_cost_inr: number;
    deadline_hours: number;
    urgency: string;
    loss_warning: string;
    community_notes: string;
    nearby_farmer_alerts: number;
    temperature: number;
    humidity: number;
    rainfall_expected: boolean;
  };
}

interface AICommandProps {
  scanId: string;
  onClose?: () => void;
  language?: 'en' | 'hi' | 'mr';
}

const PRIORITY_COLORS = {
  urgent: 'bg-red-50 border-red-200 text-red-800',
  recommended: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  optional: 'bg-blue-50 border-blue-200 text-blue-800',
};

const PRIORITY_BADGE = {
  urgent: 'bg-red-100 text-red-800',
  recommended: 'bg-yellow-100 text-yellow-800',
  optional: 'bg-blue-100 text-blue-800',
};

const URGENCY_INDICATOR = {
  critical: 'bg-red-500',
  warning: 'bg-orange-500',
  info: 'bg-blue-500',
  healthy: 'bg-green-500',
};

export function AIDoctor({
  scanId,
  onClose,
  language = 'en',
}: AICommandProps) {
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // Fetch AI Doctor recommendations
  const { data: recommendations, isLoading, error } = useQuery({
    queryKey: ['aiDoctor', scanId, language],
    queryFn: async () => {
      const response = await api.get<Recommendation>(
        `/ai-doctor/recommendations/${scanId}`,
        {
          params: { language },
        }
      );
      return response.data;
    },
  });

  // Mark task as complete
  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.put(
        `/ai-doctor/tasks/${taskId}/complete`,
        {}
      );
      return response.data;
    },
    onSuccess: (_, taskId) => {
      setCompletedTasks((prev) => new Set([...prev, taskId]));
    },
  });

  const rec = recommendations?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-green-600 mb-4" />
          <p className="text-gray-600">
            {language === 'hi' && 'सिफारिशें तैयार की जा रही हैं...'}
            {language === 'mr' && 'शिफारशी तयार केली जात आहे...'}
            {language === 'en' && 'Generating recommendations...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !rec) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center text-red-600">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>
            {language === 'hi' && 'सिफारिशें लोड नहीं की जा सकीं'}
            {language === 'mr' && 'शिफारशी लोड करू शकत नाही'}
            {language === 'en' && 'Failed to load recommendations'}
          </p>
        </div>
      </div>
    );
  }

  const progressPercentage = completedTasks.size / rec.tasks.length * 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">
              {language === 'hi' && 'AI डॉक्टर सुझाव'}
              {language === 'mr' && 'AI डॉक्टर सुझाव'}
              {language === 'en' && 'AI Doctor Recommendations'}
            </h2>
            <p className="text-green-100">{rec.disease_name}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-green-700 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* Summary & Urgency */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200"
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900">
              {language === 'hi' && 'सारांश'}
              {language === 'mr' && 'सारांश'}
              {language === 'en' && 'Summary'}
            </h3>
            <p className="text-gray-700 mb-4">{rec.summary}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Urgency */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className={`w-5 h-5 ${URGENCY_INDICATOR[rec.severity]}`} />
                  <span className="font-semibold text-sm text-gray-600">
                    {language === 'hi' && 'आपातकालीन'}
                    {language === 'mr' && 'आपातकालीन'}
                    {language === 'en' && 'Urgency'}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {rec.severity === 'critical' && (language === 'hi' ? 'गंभीर' : language === 'mr' ? 'गंभीर' : 'Critical')}
                  {rec.severity === 'warning' && (language === 'hi' ? 'चेतावनी' : language === 'mr' ? 'चेतावनी' : 'Warning')}
                  {rec.severity === 'info' && (language === 'hi' ? 'सूचना' : language === 'mr' ? 'सूचना' : 'Info')}
                  {rec.severity === 'healthy' && (language === 'hi' ? 'स्वस्थ' : language === 'mr' ? 'स्वस्थ' : 'Healthy')}
                </p>
              </div>

              {/* Deadline */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <span className="font-semibold text-sm text-gray-600">
                    {language === 'hi' && 'समय सीमा'}
                    {language === 'mr' && 'समय सीमा'}
                    {language === 'en' && 'Deadline'}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {rec.deadline_hours}
                  {language === 'hi' && ' घंटे'}
                  {language === 'mr' && ' तास'}
                  {language === 'en' && ' hours'}
                </p>
              </div>

              {/* Cost */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <IndianRupee className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-sm text-gray-600">
                    {language === 'hi' && 'कुल लागत'}
                    {language === 'mr' && 'एकूण खर्च'}
                    {language === 'en' && 'Total Cost'}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  ₹{rec.total_cost_inr.toLocaleString()}
                </p>
              </div>

              {/* Nearby Alerts */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-sm text-gray-600">
                    {language === 'hi' && 'पास के किसान'}
                    {language === 'mr' && 'जवळच्या शेतकरी'}
                    {language === 'en' && 'Nearby Farmers'}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900">
                  {rec.nearby_farmer_alerts}
                </p>
              </div>
            </div>

            {/* Loss Warning */}
            {rec.loss_warning && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-semibold">
                  ⚠️ {rec.loss_warning}
                </p>
              </div>
            )}

            {/* Community Notes */}
            {rec.community_notes && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  {rec.community_notes}
                </p>
              </div>
            )}
          </motion.div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {language === 'hi' && 'कार्य प्रगति'}
                {language === 'mr' && 'कार्य प्रगती'}
                {language === 'en' && 'Task Progress'}
              </h3>
              <span className="text-sm text-gray-600">
                {completedTasks.size} / {rec.tasks.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all"
              />
            </div>
          </div>

          {/* Tasks */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {language === 'hi' && 'दैनिक कार्य'}
              {language === 'mr' && 'दैनिक काम'}
              {language === 'en' && 'Daily Tasks'}
            </h3>

            <AnimatePresence>
              <div className="space-y-3">
                {rec.tasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedTask(task)}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      PRIORITY_COLORS[task.priority]
                    } ${
                      completedTasks.has(task.id)
                        ? 'opacity-50 line-through'
                        : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (completedTasks.has(task.id)) {
                            setCompletedTasks(
                              (prev) =>
                                new Set(
                                  [...prev].filter((id) => id !== task.id)
                                )
                            );
                          } else {
                            completeTaskMutation.mutate(task.id);
                          }
                        }}
                        className="mt-1 flex-shrink-0"
                      >
                        {completedTasks.has(task.id) ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : (
                          <div className="w-6 h-6 border-2 border-current rounded-full" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900">
                            {language === 'hi' && 'दिन'} {task.day}: {task.title}
                          </h4>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${PRIORITY_BADGE[task.priority]}`}>
                            {task.priority === 'urgent'
                              ? language === 'hi'
                                ? 'तत्काल'
                                : language === 'mr'
                                ? 'जरुरी'
                                : 'Urgent'
                              : task.priority === 'recommended'
                              ? language === 'hi'
                                ? 'अनुशंसित'
                                : language === 'mr'
                                ? 'अनुशंसित'
                                : 'Recommended'
                              : language === 'hi'
                              ? 'वैकल्पिक'
                              : language === 'mr'
                              ? 'वैकल्पिक'
                              : 'Optional'}
                          </span>
                        </div>

                        <p className="text-sm text-gray-700 mb-3">
                          {task.description}
                        </p>

                        <div className="flex flex-wrap gap-3 text-xs">
                          <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded">
                            <span className="font-semibold">🧴</span>
                            {task.product}
                          </div>
                          <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded">
                            <IndianRupee className="w-4 h-4" />
                            ₹{task.cost_inr}
                          </div>
                          <div className="flex items-center gap-1 bg-white/50 px-2 py-1 rounded">
                            <Clock className="w-4 h-4" />
                            {task.duration_hours}h
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center text-sm text-gray-600">
            {language === 'hi' && '⏰ समय की कमी है - आज ही शुरू करें'}
            {language === 'mr' && '⏰ वेळ मर्यादित आहे - आज सुरुवात करा'}
            {language === 'en' && '⏰ Time is limited - Start today for best results'}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
