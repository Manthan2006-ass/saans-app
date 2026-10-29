import mongoose from 'mongoose';

/**
 * Order Schema
 * Purchases made by users in the Clean Air Protection Store
 */
const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'placed', 'processing', 'shipped', 'delivered'],
    default: 'placed',
  },
  shippingAddress: {
    city: { type: String, default: 'Pune' },
    pincode: { type: String, default: '411044' },
    addressLine: { type: String, default: 'PCCOE Campus Road, Nigdi Pradhikaran' },
  },
}, { timestamps: true });

export const Order = mongoose.model('Order', orderSchema);
export default Order;

