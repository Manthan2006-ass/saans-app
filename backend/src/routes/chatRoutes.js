import express from 'express';
import { handleChatMessage, getChatHistory } from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat
router.post('/', handleChatMessage);

// GET /api/chat/history
router.get('/history', getChatHistory);

export default router;

