import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushToken,
  sendTestNotification,
  getNotificationLogs,
} from '../controllers/notifications.controller';

export const notificationsRouter = Router();

// All routes require authentication
notificationsRouter.use(authenticate);

// Default GET - returns notification preferences (alias for /preferences)
notificationsRouter.get('/', getNotificationPreferences);

// Get user notification preferences
notificationsRouter.get('/preferences', getNotificationPreferences);

// Update user notification preferences
notificationsRouter.put('/preferences', updateNotificationPreferences);

// Register FCM push token
notificationsRouter.post('/register-token', registerPushToken);

// Send test notification to verify all channels
notificationsRouter.post('/test', sendTestNotification);

// Fetch notification logs/history
notificationsRouter.get('/logs', getNotificationLogs);
