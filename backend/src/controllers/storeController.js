import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

// Default initial catalog
export const SEED_PRODUCTS = [
  {
    name: 'Certified N95 Anti-Pollution Respirator Mask (Pack of 5)',
    price: 399,
    description: 'Ergonomic 5-layer filtration with adjustable nose clip and low breathing resistance. Meets NIOSH N95 and Indian BIS standards.',
    category: 'mask',
    image: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=600&auto=format&fit=crop&q=80',
    stock: 250,
    rating: 4.8,
    recommendedForAqiAbove: 100,
    useCase: 'outdoor',
    targetPollutants: ['PM2.5', 'PM10'],
    recommendationReason: 'Filters 95%+ of fine airborne PM2.5 during outdoor exposure and transit.',
    isActive: true,
  },
  {
    name: 'Smart True-HEPA H13 Air Purifier with Realtime Sensor',
    price: 11999,
    description: 'Triple-layer 360° filtration capturing 99.97% of airborne PM2.5, pollen, smoke, and fine aerosol particulates. Covers up to 450 sq.ft.',
    category: 'purifier',
    image: 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&auto=format&fit=crop&q=80',
    stock: 35,
    rating: 4.9,
    recommendedForAqiAbove: 120,
    useCase: 'indoor',
    targetPollutants: ['PM2.5', 'PM10'],
    recommendationReason: 'Essential for maintaining clean indoor air below 15 µg/m³ during seasonal smog.',
    isActive: true,
  },
  {
    name: 'Heavy-Duty Anti-Smog Purifier with Activated Carbon (CADR 550 m³/h)',
    price: 17499,
    description: 'Engineered for high-pollution corridors (Delhi & Industrial PCMC). High CADR with activated carbon honeycomb filter for VOC, smoke, and NO2 removal.',
    category: 'purifier',
    image: 'https://images.unsplash.com/photo-1626083307505-1818c3cb7a88?w=600&auto=format&fit=crop&q=80',
    stock: 20,
    rating: 4.8,
    recommendedForAqiAbove: 200,
    useCase: 'indoor',
    targetPollutants: ['VOC', 'NO₂', 'Smoke', 'PM2.5'],
    recommendationReason: 'Dual activated carbon and HEPA array removes industrial fumes, smoke, and gaseous VOCs.',
    isActive: true,
  },
  {
    name: 'Active-Carbon Commuter Sports Face Mask (Washable + 4 Filters)',
    price: 699,
    description: 'Neoprene breathable sports mask with dual exhalation valves for cyclists, runners, and daily commuters on Pune & Delhi roads.',
    category: 'mask',
    image: 'https://images.unsplash.com/photo-1586942593568-29361efcd571?w=600&auto=format&fit=crop&q=80',
    stock: 110,
    rating: 4.8,
    recommendedForAqiAbove: 100,
    useCase: 'commute',
    targetPollutants: ['PM2.5', 'NO₂', 'Diesel Soot'],
    recommendationReason: 'Low-resistance dual valves ideal for active cycling, running, and two-wheeler commuting.',
    isActive: true,
  },
  {
    name: 'Hyperlocal Laser Indoor Air Quality Monitor (PM2.5 / PM10 / VOC)',
    price: 3499,
    description: 'Continuous laser sensor tracking real-time indoor PM2.5, PM10, temperature, and relative humidity with color-coded risk alerts.',
    category: 'monitor',
    image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80',
    stock: 45,
    rating: 4.7,
    recommendedForAqiAbove: 100,
    useCase: 'indoor',
    targetPollutants: ['PM2.5', 'PM10'],
    recommendationReason: 'Verifies indoor air purifier effectiveness and alerts when windows should be shut.',
    isActive: true,
  },
  {
    name: 'Replacement True HEPA H13 Filter Core Set',
    price: 1899,
    description: 'High-density composite replacement filter core compatible with standard 360° cylindrical purifiers. Recommended replacement every 6 months.',
    category: 'filter',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80',
    stock: 80,
    rating: 4.9,
    recommendedForAqiAbove: 150,
    useCase: 'indoor',
    targetPollutants: ['PM2.5', 'PM10'],
    recommendationReason: 'Restores peak particulate capture efficiency for existing home purifiers.',
    isActive: true,
  },
];

/**
 * Get all available protection products (auto-seeds if database is empty)
 */
export const getProducts = asyncHandler(async (req, res) => {
  const { category } = req.query;

  if (mongoose.connection.readyState === 1) {
    const count = await Product.countDocuments();
    if (count === 0) {
      await Product.insertMany(SEED_PRODUCTS);
    }

    const filter = category ? { category } : {};
    const products = await Product.find(filter).sort({ recommendedForAqiAbove: 1 });
    return res.status(200).json(new ApiResponse(200, products, 'Products retrieved successfully'));
  }

  // Fallback offline catalog
  const filtered = category
    ? SEED_PRODUCTS.filter(p => p.category === category)
    : SEED_PRODUCTS;
  return res.status(200).json(new ApiResponse(200, filtered, 'Products loaded (offline mode)'));
});

/**
 * Place an order for protection items
 */
export const placeOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Cart items are required to place an order');
  }

  let total = 0;
  items.forEach(it => {
    total += (Number(it.price) || 0) * (Number(it.quantity) || 1);
  });

  if (mongoose.connection.readyState === 1) {
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        name: 'Aditya Sharma',
        email: 'aditya@saans.org',
        password: 'hashed_password_123',
      });
    }

    const order = await Order.create({
      user: user._id,
      items: items.map(it => ({
        product: mongoose.isValidObjectId(it.productId) ? it.productId : new mongoose.Types.ObjectId(),
        quantity: it.quantity || 1,
        price: it.price,
      })),
      total,
      status: 'placed',
      shippingAddress: shippingAddress || {
        city: 'Pune',
        pincode: '411044',
        addressLine: 'PCCOE Campus Road, Sector 26, Pradhikaran, Nigdi',
      },
    });

    return res.status(201).json(new ApiResponse(201, order, 'Order placed successfully'));
  }

  // Offline simulation
  const mockOrder = {
    _id: 'ord_' + Date.now(),
    items,
    total,
    status: 'placed',
    shippingAddress: shippingAddress || {
      city: 'Pune',
      pincode: '411044',
      addressLine: 'PCCOE Campus Road, Nigdi Pradhikaran',
    },
    createdAt: new Date().toISOString(),
  };

  return res.status(201).json(new ApiResponse(201, mockOrder, 'Order placed successfully (mock mode)'));
});

/**
 * Get all placed orders
 */
export const getOrders = asyncHandler(async (_req, res) => {
  if (mongoose.connection.readyState === 1) {
    const orders = await Order.find().populate('items.product').sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, orders, 'Orders retrieved successfully'));
  }

  return res.status(200).json(new ApiResponse(200, [], 'No orders placed yet in fallback mode'));
});

