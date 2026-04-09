// auth.routes.ts
import { Router } from 'express';
import { register, login, getMe, updateMe, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
export const authRouter = Router();
authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.get('/me', authenticate, getMe);
authRouter.put('/me', authenticate, updateMe);
authRouter.put('/me/password', authenticate, changePassword);
