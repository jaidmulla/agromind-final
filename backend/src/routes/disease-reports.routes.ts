import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { createScan } from '../controllers/scans.controller';
import {
  getContractAlerts,
  getContractDashboard,
  getReportById,
  getReports,
} from '../controllers/disease-reports.controller';

export const diseaseReportsRouter = Router();

diseaseReportsRouter.use(authenticate);
diseaseReportsRouter.post('/scan', upload.single('image'), createScan);
diseaseReportsRouter.get('/reports', getReports);
diseaseReportsRouter.get('/reports/:id', getReportById);
diseaseReportsRouter.get('/dashboard', getContractDashboard);
diseaseReportsRouter.get('/alerts', getContractAlerts);