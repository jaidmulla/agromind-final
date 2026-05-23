import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getDashboard, getLossPrevention, getAlertTypes, getCropPerformance, getResponseTimes, getWeatherRiskData } from '../controllers/analytics.controller';
import { getFarms, createFarm, getFarmById, updateFarm, deleteFarm, getCrops, createCrop, getCropById, updateCrop, deleteCrop, getNearbyFarms } from '../controllers/farms.controller';
import { getPosts, getMapPosts, getPostById, createPost, toggleLike, addComment, deletePost } from '../controllers/community.controller';
import { getNotificationPrefs, updateNotificationPrefs } from '../controllers/settings.controller';

export const analyticsRouter = Router();
analyticsRouter.use(authenticate);
analyticsRouter.get('/dashboard', getDashboard);
analyticsRouter.get('/loss-prevention', getLossPrevention);
analyticsRouter.get('/alert-types', getAlertTypes);
analyticsRouter.get('/crop-performance', getCropPerformance);
analyticsRouter.get('/response-times', getResponseTimes);
analyticsRouter.get('/weather-risk', getWeatherRiskData);

export const farmsRouter = Router();
farmsRouter.use(authenticate);
farmsRouter.get('/', getFarms);
farmsRouter.get('/nearby', getNearbyFarms);
farmsRouter.post('/', createFarm);
farmsRouter.get('/:id', getFarmById);
farmsRouter.put('/:id', updateFarm);
farmsRouter.delete('/:id', deleteFarm);

export const cropsRouter = Router();
cropsRouter.use(authenticate);
cropsRouter.get('/', getCrops);
cropsRouter.post('/', createCrop);
cropsRouter.get('/:id', getCropById);
cropsRouter.put('/:id', updateCrop);
cropsRouter.delete('/:id', deleteCrop);

export const communityRouter = Router();
communityRouter.use(authenticate);
communityRouter.get('/posts', getPosts);
communityRouter.get('/map', getMapPosts);
communityRouter.get('/posts/:id', getPostById);
communityRouter.post('/posts', createPost);
communityRouter.post('/posts/:id/like', toggleLike);
communityRouter.post('/posts/:id/comments', addComment);
communityRouter.delete('/posts/:id', deletePost);

export const settingsRouter = Router();
settingsRouter.use(authenticate);
settingsRouter.get('/notifications', getNotificationPrefs);
settingsRouter.put('/notifications', updateNotificationPrefs);

import { getSchemes, getSchemeById, getInputRecommendations } from '../controllers/schemes.controller';
import { chat, getQuickReplies, analyzeImage, getChatHistoryEndpoint } from '../controllers/chat.controller';
import { llmChat, getConversation, listConversations, deleteConversation } from '../controllers/llm-chat.controller';
import { recordLossPrevention, getLossRecords, getLossSummary, deleteLossRecord } from '../controllers/losses.controller';
import { getLossPreventionStats, searchLossRecords } from '../controllers/losses-advanced.controller';
import { getRecommendationsByScán, getTasksByScan, completeAITask, getAllUserTasks, getAIDoctorDashboard } from '../controllers/ai-doctor.controller';
import { upload } from '../middleware/upload';

export const schemesRouter = Router();
schemesRouter.use(authenticate);
schemesRouter.get('/', getSchemes);
schemesRouter.get('/inputs/:crop', getInputRecommendations);
schemesRouter.get('/:id', getSchemeById);

export const chatRouter = Router();
chatRouter.use(authenticate);
chatRouter.post('/', chat);
chatRouter.get('/quick-replies', getQuickReplies);
chatRouter.get('/history', getChatHistoryEndpoint);
chatRouter.post('/analyze-image', upload.single('image'), analyzeImage);

export const lossesRouter = Router();
lossesRouter.use(authenticate);
lossesRouter.post('/', recordLossPrevention);
lossesRouter.get('/', getLossRecords);
lossesRouter.get('/summary', getLossSummary);
lossesRouter.get('/stats', getLossPreventionStats);
lossesRouter.get('/search', searchLossRecords);
lossesRouter.delete('/:id', deleteLossRecord);

export const aiDoctorRouter = Router();
aiDoctorRouter.use(authenticate);
aiDoctorRouter.get('/recommendations/:scanId', getRecommendationsByScán);
aiDoctorRouter.get('/tasks/:scanId', getTasksByScan);
aiDoctorRouter.put('/tasks/:taskId/complete', completeAITask);
aiDoctorRouter.get('/all-tasks', getAllUserTasks);
aiDoctorRouter.get('/dashboard', getAIDoctorDashboard);

export const llmChatRouter = Router();
llmChatRouter.use(authenticate);
llmChatRouter.post('/', llmChat);
llmChatRouter.get('/conversations', listConversations);
llmChatRouter.get('/conversations/:conversationId', getConversation);
llmChatRouter.delete('/conversations/:conversationId', deleteConversation);
