import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { authRouter } from './routes/auth.routes';
import { otpRouter } from './routes/otp.routes';
import { leafRouter } from './routes/leaf.routes';
import { scansRouter } from './routes/scans.routes';
import { alertsRouter } from './routes/alerts.routes';
import { notificationsRouter } from './routes/notifications.routes';
import { analyticsRouter, farmsRouter, cropsRouter, communityRouter, settingsRouter, schemesRouter, chatRouter, lossesRouter, aiDoctorRouter } from './routes/index';
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
import { errorHandler, notFound } from './middleware/errorHandler';
import logger from './utils/logger';
import { authenticate } from './middleware/auth';
import { startWeatherAlertJob } from './jobs/weather-alerts';
import { startDailyRegretAlertJob, startDailyCropReminderJob } from './jobs/daily-alerts';
import { startAnalyticsSnapshotJob } from './jobs/analytics-snapshots';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

const allowedOrigins = new Set([
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  ...(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
]);

// Security
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients and same-origin calls.
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
app.use('/api/v1/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: 'Too many login attempts' } }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (uploaded images)
app.use('/uploads', express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || './uploads')));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }));

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/otp', otpRouter);
app.use('/api/v1/leaf', leafRouter);
app.use('/api/v1/scans', scansRouter);
app.use('/api/v1/alerts', alertsRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/farms', farmsRouter);
app.use('/api/v1/crops', cropsRouter);
app.use('/api/v1/community', communityRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/schemes', schemesRouter);
app.use('/api/v1/chat', chatRouter);
app.use('/api/v1/losses', lossesRouter);
app.use('/api/v1/ai-doctor', aiDoctorRouter);

// Compatibility routes for legacy /api contract
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

// Error handling
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`🚀 AgroMind backend running on port ${PORT}`);
  logger.info(`📡 API: http://localhost:${PORT}/api/v1`);

  // Initialize background jobs
  logger.info('⏰ Initializing background alert jobs...');
  startWeatherAlertJob();
  startDailyRegretAlertJob();
  startDailyCropReminderJob();
  startAnalyticsSnapshotJob();
  logger.info('✅ All background jobs started');
});

export default app;
