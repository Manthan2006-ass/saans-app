import mongoose from 'mongoose';

/**
 * Conversation Schema
 * AI Air Quality Assistant chat sessions with tool-use metadata
 */
const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: { type: String, required: true },
  toolsUsed: [{
    toolName: String,
    queryParameters: mongoose.Schema.Types.Mixed,
    outputSummary: String,
  }],
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const conversationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  station: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Station',
    default: null,
  },
  title: { type: String, default: 'Air Health Consultation' },
  messages: [messageSchema],
}, { timestamps: true });

export const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;

