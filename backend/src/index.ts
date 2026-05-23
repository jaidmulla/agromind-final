import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { query } from './utils/database.js';

// Routes
import { authRouter } from './routes/auth.routes';
import { scansRouter } from './routes/scans.routes';
import { alertsRouter } from './routes/alerts.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { diseaseReportsRouter } from './routes/disease-reports.routes';
import {
  analyticsRouter,
  farmsRouter,
  cropsRouter,
  communityRouter,
  settingsRouter,
  schemesRouter,
  chatRouter,
  lossesRouter,
  aiDoctorRouter,
  llmChatRouter
} from './routes/index';

// Controllers
import { upload } from './middleware/upload';
import { createScan } from './controllers/scans.controller';
import { getNearbyAlerts } from './controllers/alerts.controller';
import {
  getHealthTrend,
  getScansHistory,
  getImpactSaved,
  predictImpact,
  generateRegret,
  getAlertsHeatmap,
  getSimulationById,
  getRecommendationsById,
  updateTask,
  getSchemesCompat,
} from './controllers/compat.controller';
import { chat as legacyChat } from './controllers/chat.controller';

// Middleware
import { errorHandler, notFound } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';
import { httpRequestLogger } from './middleware/http-request-logger';
import logger from './utils/logger';

// Jobs
import { startWeatherAlertJob } from './jobs/weather-alerts';
import { startDailyRegretAlertJob, startDailyCropReminderJob } from './jobs/daily-alerts';
import { startAnalyticsSnapshotJob } from './jobs/analytics-snapshots';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// =====================
// 🌐 CORS CONFIG
// =====================
const allowedOrigins = new Set([
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
]);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// =====================
// 🔐 RATE LIMIT
// =====================
app.use('/api/v1/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10 })
);

app.use('/api',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 300 })
);

// =====================
// 📦 BODY PARSER
// =====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(httpRequestLogger);

// =====================
// 📁 STATIC FILES
// =====================
app.use('/uploads',
  express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || './uploads'))
);

// =====================
// ❤️ HEALTH CHECK
// =====================
app.get('/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date() })
);

app.get('/api/v1/health', (_req, res) =>
  res.json({ status: 'ok', time: new Date() })
);

// =====================
// 🧪 DB TEST ROUTE (FIXED)
// =====================
app.get('/test-db', async (_req, res) => {
  try {
    const result = await query('SELECT NOW() as "current_time"');
    res.json({
      success: true,
      database: 'agromind_db',
      user: process.env.DB_USER || 'agromind_user',
      timestamp: result.rows[0],
      message: 'DB Connected ✅',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Database connection failed'
    });
  }
});

// =====================
// 🧪 API DB TEST ROUTE
// =====================
app.get('/api/v1/test-db', async (_req, res) => {
  try {
    const result = await query('SELECT NOW() as "current_time", COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = \'public\'');
    res.json({
      success: true,
      database: 'agromind_db',
      user: process.env.DB_USER || 'agromind_user',
      timestamp: new Date(),
      tables: result.rows[0],
      message: 'DB Connected ✅',
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Database connection failed'
    });
  }
});

// =====================
// 🚀 API ROUTES
// =====================
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/scans', scansRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1', diseaseReportsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/farms', farmsRouter);
app.use('/api/v1/crops', cropsRouter);
app.use('/api/v1/community', communityRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/schemes', schemesRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/llm', llmChatRouter);
app.use('/api/v1/losses', lossesRouter);
app.use('/api/v1/ai-doctor', aiDoctorRouter);

// =====================
// 🔁 LEGACY ROUTES
// =====================
app.get('/api/health/trend', authenticate, getHealthTrend);
app.get('/api/scans/history', authenticate, getScansHistory);
app.get('/api/impact/saved', authenticate, getImpactSaved);

app.post('/api/detect', authenticate, upload.single('image'), createScan);
app.post('/api/predict', authenticate, predictImpact);
app.post('/api/impact', authenticate, predictImpact);
app.post('/api/regret', authenticate, generateRegret);

app.get('/api/alerts/nearby', authenticate, getNearbyAlerts);
app.get('/api/alerts/heatmap', authenticate, getAlertsHeatmap);

app.get('/api/simulation/:id', authenticate, getSimulationById);
app.get('/api/recommendations/:id', authenticate, getRecommendationsById);

app.post('/api/tasks/update', authenticate, updateTask);
app.get('/api/schemes', authenticate, getSchemesCompat);

app.post('/api/chat', authenticate, legacyChat);

// =====================
// ❗ ERROR HANDLING (LAST)
// =====================
app.use(notFound);
app.use(errorHandler);

// =====================
// 🚀 SERVER START
// =====================
app.listen(PORT, () => {
  logger.info(`🚀 AgroMind backend running on port ${PORT}`);
  logger.info(`📡 API: http://localhost:${PORT}/api/v1`);

  startWeatherAlertJob();
  startDailyRegretAlertJob();
  startDailyCropReminderJob();
  startAnalyticsSnapshotJob();

  logger.info('✅ All background jobs started');
});

export default app;