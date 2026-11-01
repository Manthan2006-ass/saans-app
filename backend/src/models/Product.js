import mongoose from 'mongoose';

/**
 * Product Schema
 * Protection store products (HEPA purifiers, N95 respiratory masks, PM2.5 filters)
 */
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['purifier', 'mask', 'filter', 'accessory', 'monitor'],
    required: true,
  },
  image: { type: String, required: true },
  stock: { type: Number, default: 50 },
  rating: { type: Number, default: 4.8 },
  recommendedForAqiAbove: { type: Number, default: 150 },
  useCase: {
    type: String,
    enum: ['indoor', 'outdoor', 'commute', 'general'],
    default: 'general',
  },
  targetPollutants: [{ type: String }],
  isActive: { type: Boolean, default: true },
  recommendationReason: { type: String, default: '' },
}, { timestamps: true });

export const Product = mongoose.model('Product', productSchema);
export default Product;

