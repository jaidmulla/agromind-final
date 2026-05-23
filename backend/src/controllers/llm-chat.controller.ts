import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../utils/database';
import { callGeminiText } from '../services/gemini.service';
import logger from '../utils/logger';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * General-purpose LLM Chat using Gemini API
 * Works like ChatGPT - supports any question, keeps conversation history
 */
export const llmChat = async (req: AuthRequest, res: Response): Promise<void> => {
  const startTime = Date.now();
  try {
    const { message, conversationId = null, systemPrompt = null } = req.body;
    const userId = req.user!.id;

    if (!message?.trim()) {
      res.status(400).json({ success: false, message: 'Message is required' });
      return;
    }

    logger.info('📝 LLM Chat Request', {
      userId,
      messageLength: message.length,
      conversationId,
      hasSystemPrompt: !!systemPrompt,
      timestamp: new Date().toISOString(),
    });

    let convId = conversationId;

    // Create or get conversation
    if (!convId) {
      const result = await query(
        `INSERT INTO chat_conversations (user_id, title, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         RETURNING id`,
        [userId, message.substring(0, 50) + (message.length > 50 ? '...' : '')]
      );
      convId = result.rows[0].id;
      logger.info('✨ New conversation created', { convId, userId });
    }

    // Get previous messages in conversation (limit to last 20)
    const historyResult = await query(
      `SELECT user_message, assistant_reply FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT 20`,
      [convId]
    );

    const history = historyResult.rows.map((row: any) => [
      { role: 'user', content: row.user_message },
      { role: 'assistant', content: row.assistant_reply },
    ]).flat();

    // Build system prompt
    const defaultSystemPrompt = `You are a helpful AI assistant powered by Gemini.
    
You have the following capabilities:
- Answer questions on any topic
- Help with problem solving and learning
- Provide detailed explanations
- Assist with coding and technical topics
- Support creative writing
- Help with research and analysis

Always:
✓ Be helpful, harmless, and honest
✓ Provide clear, concise answers
✓ Ask clarifying questions if needed
✓ Admit when you don't know something
✓ Provide sources or context when possible`;

    const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

    // Build message history for Gemini
    const conversationHistory = history
      .slice(-10) // Keep last 10 messages for context
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // Add current message
    conversationHistory.push({
      role: 'user',
      parts: [{ text: message }],
    });

    logger.info('🤖 Calling Gemini API', {
      historyLength: conversationHistory.length,
      messageLength: message.length,
    });

    // Call Gemini
    const reply = await callGeminiText(finalSystemPrompt, message, 0.7, 1500);

    logger.info('✅ Gemini Response Received', {
      replyLength: reply.length,
      convId,
    });

    // Save to database
    await query(
      `INSERT INTO chat_messages (conversation_id, user_id, user_message, assistant_reply, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [convId, userId, message, reply]
    );

    // Update conversation timestamp
    await query(
      `UPDATE chat_conversations SET updated_at = NOW() WHERE id = $1`,
      [convId]
    );

    const elapsedMs = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        conversationId: convId,
        reply,
        timestamp: new Date().toISOString(),
        performance: {
          response_time_ms: elapsedMs,
          ai_model: 'gemini-1.5-flash',
        },
      },
    });
  } catch (error: any) {
    logger.error('❌ LLM Chat Error', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get AI response. Please try again.',
    });
  }
};

/**
 * Get conversation history
 */
export const getConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.id;

    // Verify user owns this conversation
    const convCheck = await query(
      `SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (convCheck.rows.length === 0) {
      res.status(403).json({ success: false, message: 'Conversation not found or access denied' });
      return;
    }

    // Get all messages
    const messagesResult = await query(
      `SELECT user_message, assistant_reply, created_at FROM chat_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );

    const messages = messagesResult.rows
      .map((row: any) => [
        { role: 'user', content: row.user_message, timestamp: row.created_at },
        { role: 'assistant', content: row.assistant_reply, timestamp: row.created_at },
      ])
      .flat();

    res.json({
      success: true,
      data: {
        conversationId,
        messages,
        messageCount: messages.length,
      },
    });
  } catch (error: any) {
    logger.error('❌ Get Conversation Error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch conversation' });
  }
};

/**
 * List user's conversations
 */
export const listConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await query(
      `SELECT id, title, created_at, updated_at, 
              (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = chat_conversations.id) as message_count
       FROM chat_conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      success: true,
      data: {
        conversations: result.rows,
        total: result.rows.length,
      },
    });
  } catch (error: any) {
    logger.error('❌ List Conversations Error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch conversations' });
  }
};

/**
 * Delete a conversation
 */
export const deleteConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.id;

    // Verify user owns this conversation
    const convCheck = await query(
      `SELECT id FROM chat_conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (convCheck.rows.length === 0) {
      res.status(403).json({ success: false, message: 'Conversation not found or access denied' });
      return;
    }

    // Delete messages first
    await query(`DELETE FROM chat_messages WHERE conversation_id = $1`, [conversationId]);

    // Delete conversation
    await query(`DELETE FROM chat_conversations WHERE id = $1`, [conversationId]);

    logger.info('🗑️ Conversation deleted', { conversationId, userId });

    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error: any) {
    logger.error('❌ Delete Conversation Error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete conversation' });
  }
};
