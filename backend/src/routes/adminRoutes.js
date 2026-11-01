import express from 'express';
import {
  adminLogin,
  getAdminOverview,
  getAdminUsers,
  updateUserStatus,
  getAqiAnalytics,
  getAiAnalytics,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getSystemHealth,
} from '../controllers/adminController.js';
import { requireAdmin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public Admin Authentication
router.post('/login', adminLogin);

// Protected Admin Routes (require role: 'admin')
router.use(requireAdmin);

// A. Overview
router.get('/overview', getAdminOverview);

// B. User Management
router.get('/users', getAdminUsers);
router.patch('/users/:id/status', updateUserStatus);

// C. AQI Analytics
router.get('/aqi-analytics', getAqiAnalytics);

// D. AI Assistant Analytics
router.get('/ai-analytics', getAiAnalytics);

// E. Product Management
router.get('/products', getAdminProducts);
router.post('/products', createAdminProduct);
router.put('/products/:id', updateAdminProduct);
router.delete('/products/:id', deleteAdminProduct);

// F. System Health
router.get('/system-health', getSystemHealth);

export default router;
