import { Router } from 'express';
import { analyze } from '../controllers/leaf.controller';
import { authenticate } from '../middleware/auth';

export const leafRouter = Router();

/**
 * POST /api/leaf/analyze
 * Analyze a leaf image using Plant.id + Claude
 * Requires JWT authentication
 *
 * Request Body:
 * {
 *   "imageBase64": "data:image/jpeg;base64,...",
 *   "language": "en"  // optional
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "plant_name": "Tomato",
 *   "disease_name": "Early Blight",
 *   "probability": 85,
 *   "cause": "Caused by fungus Alternaria solani",
 *   "treatment_steps": "...",
 *   "prevention_tips": "..."
 * }
 */
leafRouter.post('/analyze', authenticate, analyze);

export default leafRouter;
