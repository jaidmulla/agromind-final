# AgroMind API Endpoints - Complete Reference

## Authentication Endpoints (`/api/v1/auth`)
- `POST /register` - Create new user account
- `POST /login` - User login 
- `GET /me` - Get current user profile
- `PUT /me` - Update user profile
- `PUT /me/password` - Change password

## Scans Endpoints (`/api/v1/scans`)
- `POST /` - Create new scan (image upload)
- `GET /` - List user's scans
- `GET /:id` - Get scan details
- `GET /:id/regret-timeline` - Get regret timeline for scan
- `PUT /:id/resolve` - Mark scan as resolved
- `DELETE /:id` - Delete scan

## Alerts Endpoints (`/api/v1/alerts`)
- `GET /` - List alerts
- `GET /:id` - Get alert details
- `GET /:id/timeline` - Get alert timeline
- `PUT /:id/acknowledge` - Acknowledge alert
- `PUT /:id/resolve` - Resolve alert
- `DELETE /:id` - Delete alert

## Notifications Endpoints (`/api/v1/notifications`)
- `GET /` - Get notification preferences (DEFAULT - FIXED)
- `GET /preferences` - Get notification preferences
- `PUT /preferences` - Update preferences
- `POST /register-token` - Register FCM push token
- `POST /test` - Send test notification
- `GET /logs` - Get notification history

## Analytics Endpoints (`/api/v1/analytics`)
- `GET /dashboard` - Get analytics dashboard
- `GET /loss-prevention` - Get loss prevention stats
- `GET /alert-types` - Get alert type distribution
- `GET /crop-performance` - Get crop performance metrics
- `GET /response-times` - Get response time analytics
- `GET /weather-risk` - Get weather risk data

## Farms Endpoints (`/api/v1/farms`)
- `GET /` - List user's farms
- `GET /nearby` - Get nearby farms
- `POST /` - Create new farm
- `GET /:id` - Get farm details
- `PUT /:id` - Update farm
- `DELETE /:id` - Delete farm

## Crops Endpoints (`/api/v1/crops`)
- `GET /` - List user's crops
- `POST /` - Create new crop
- `GET /:id` - Get crop details
- `PUT /:id` - Update crop
- `DELETE /:id` - Delete crop

## Community Endpoints (`/api/v1/community`)
- `GET /posts` - List community posts
- `GET /map` - Get posts on map
- `GET /posts/:id` - Get post details
- `POST /posts` - Create post
- `POST /posts/:id/like` - Like post
- `POST /posts/:id/comments` - Add comment
- `DELETE /posts/:id` - Delete post

## Settings Endpoints (`/api/v1/settings`)
- `GET /notifications` - Get notification settings
- `PUT /notifications` - Update settings

## Schemes Endpoints (`/api/v1/schemes`)
- `GET /` - List government schemes
- `GET /inputs/:crop` - Get input recommendations
- `GET /:id` - Get scheme details

## Chat Endpoints (`/api/v1/chat`)
- `POST /` - Send chat message
- `GET /quick-replies` - Get quick replies
- `GET /history` - Get chat history
- `POST /analyze-image` - Analyze image with AI

## Loss Prevention Endpoints (`/api/v1/losses`) - NEW
- `POST /` - Record loss prevention action (FIXED)
- `GET /` - List loss records (FIXED)
- `GET /summary` - Get loss summary (FIXED)
- `DELETE /:id` - Delete loss record (FIXED)

## Legacy Endpoints (Backward Compatibility)
- `GET /api/health/trend` - Health trend
- `GET /api/scans/history` - Scans history
- `GET /api/impact/saved` - Saved impact
- `POST /api/detect` - Detect disease (legacy scan)
- `POST /api/predict` - Predict impact
- `POST /api/impact` - Calculate impact (alias)
- `POST /api/regret` - Generate regret
- `GET /api/alerts/nearby` - Nearby alerts (legacy)
- `GET /api/alerts/heatmap` - Alerts heatmap
- `GET /api/simulation/:id` - Get simulation
- `GET /api/recommendations/:id` - Get recommendations
- `POST /api/tasks/update` - Update task
- `GET /api/schemes` - List schemes (legacy)
- `POST /api/chat` - Chat (legacy)

## Status
✅ All 50+ endpoints registered and functional
✅ Authentication middleware active
✅ Rate limiting enabled
✅ CORS configured
✅ Error handling in place
