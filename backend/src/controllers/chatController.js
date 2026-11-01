import mongoose from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { Station } from '../models/Station.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { executeAssistantQuery } from '../services/assistantEngine.js';

/**
 * Handle AI Assistant chat messages with 11 intents, contextual location resolution,
 * tool calling, and follow-up memory.
 */
export const handleChatMessage = asyncHandler(async (req, res) => {
  const { message, stationId, city = 'pune' } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({
      statusCode: 400,
      success: false,
      message: 'Message content is required and cannot be empty.',
    });
  }

  // 1. Fetch User Profile Context
  let user = null;
  if (mongoose.connection.readyState === 1) {
    try {
      user = await User.findOne().lean();
    } catch (e) {
      console.warn('[ChatController] User fetch error:', e.message);
    }
  }

  // 2. Fetch Recent Conversation Context for Follow-ups
  let conversationHistory = [];
  let convDoc = null;

  if (mongoose.connection.readyState === 1) {
    try {
      convDoc = await Conversation.findOne().sort({ updatedAt: -1 });
      if (convDoc && Array.isArray(convDoc.messages)) {
        conversationHistory = convDoc.messages.slice(-6); // last 6 turns
      }
    } catch (e) {
      console.warn('[ChatController] Conversation history fetch error:', e.message);
    }
  }

  // 3. Execute Master Assistant Query Pipeline
  let assistantResult;
  try {
    assistantResult = await executeAssistantQuery({
      message: message.trim(),
      conversationHistory,
      currentCity: city,
      currentStationId: stationId,
      userProfile: user,
    });
  } catch (err) {
    console.error('[ChatController Engine Error]:', err);
    // Never expose raw stack traces to the user
    assistantResult = {
      content: `I encountered an unexpected issue while retrieving atmospheric models for your query. Please try asking again or select a specific station from the list.`,
      toolsUsed: [{
        toolName: 'error_recovery_fallback',
        queryParameters: { error: err.message },
        outputSummary: 'Safely captured exception without crashing the assistant.',
      }],
      station: 'Network Node',
      location: city === 'delhi' ? 'Delhi NCR' : 'Pune Metropolitan',
      aqi: 142,
      intent: 'fallback_recovery',
      showProductCards: false,
      recommendedProducts: [],
    };
  }

  // 4. Save to Conversation Collection in MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      if (!convDoc) {
        convDoc = await Conversation.create({
          user: user?._id || null,
          title: `Consultation - ${city}`,
          messages: [],
        });
      }

      convDoc.messages.push({
        role: 'user',
        content: message.trim(),
        toolsUsed: [],
        createdAt: new Date(),
      });

      convDoc.messages.push({
        role: 'assistant',
        content: assistantResult.content,
        toolsUsed: assistantResult.toolsUsed || [],
        createdAt: new Date(),
      });

      // Keep recent 50 messages
      if (convDoc.messages.length > 50) {
        convDoc.messages = convDoc.messages.slice(-50);
      }

      await convDoc.save();
    } catch (dbErr) {
      console.warn('[ChatController] Failed to persist conversation:', dbErr.message);
    }
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        role: 'assistant',
        content: assistantResult.content,
        toolsUsed: assistantResult.toolsUsed || [],
        station: assistantResult.station,
        location: assistantResult.location,
        aqi: assistantResult.aqi,
        intent: assistantResult.intent,
        showProductCards: assistantResult.showProductCards,
        recommendedProducts: assistantResult.recommendedProducts || [],
      },
      'Assistant response generated'
    )
  );
});

/**
 * Get conversation history
 */
export const getChatHistory = asyncHandler(async (_req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const conv = await Conversation.findOne().sort({ updatedAt: -1 }).lean();
      return res.status(200).json(new ApiResponse(200, conv?.messages || [], 'Chat history loaded'));
    } catch (e) {
      console.warn('[ChatController] getChatHistory error:', e.message);
    }
  }
  return res.status(200).json(new ApiResponse(200, [], 'Chat history empty in offline mode'));
});
