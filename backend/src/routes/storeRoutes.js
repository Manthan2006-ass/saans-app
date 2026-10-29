import express from 'express';
import {
  getProducts,
  placeOrder,
  getOrders,
} from '../controllers/storeController.js';

const router = express.Router();

// GET /api/store/products
router.get('/products', getProducts);

// POST /api/store/orders
router.post('/orders', placeOrder);

// GET /api/store/orders
router.get('/orders', getOrders);

export default router;

