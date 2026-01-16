// agent/src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import OpenAI from "openai";
import { agentAccountId, agent, requestSignature } from "@neardefi/shade-agent-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const conversationHistory = new Map<string, Array<{ role: string; content: string; timestamp: string }>>();


const app = new Hono();
app.use("/*", cors());

// In-memory storage (TEE)
const userSessions = new Map();
const conversations = new Map();


app.get("/", (c) => {
  return c.json({
    message: "Builder Uptime Shade Agent",
    status: "running in TEE ✅",
  });
});

app.get("/api/agent-account", async (c) => {
  try {
    const accountId = agentAccountId();
    const balance = await agent("getBalance");
    return c.json({ accountId, balance });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Update the /api/chat endpoint (replace the existing one)
app.post('/api/chat', async (c) => {
  try {
    const { userId, message, context } = await c.req.json();

    if (!userId || !message) {
      return c.json({ error: 'Missing userId or message' }, 400);
    }

    // Get or create conversation history for this user
    let history = conversationHistory.get(userId) || [];

    // Add user message to history
    history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Build context-aware system prompt
    const systemPrompt = `You are a supportive AI wellness coach for developers. 
Context: User has completed ${context?.tasksCompleted || 0} tasks today, 
energy level is ${context?.currentEnergy || 3}/5, 
streak is ${context?.streakDays || 0} days.

Keep responses concise (2-3 sentences), empathetic, and actionable. 
Focus on sustainable productivity and mental health.`;

    // Build messages array with history (last 10 messages to keep context manageable)
    const recentHistory = history.slice(-10);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
    ];

    // Get AI response
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      max_tokens: 150,
      temperature: 0.7,
    });

    const aiReply = completion.choices[0].message.content || "I'm here to help!";

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: aiReply,
      timestamp: new Date().toISOString(),
    });

    // Store updated history (keep last 50 messages)
    if (history.length > 50) {
      history = history.slice(-50);
    }
    conversationHistory.set(userId, history);

    // Extract mood from message (keep existing logic)
    let extractedMood = null;
    const moodKeywords = {
      1: ['terrible', 'awful', 'depressed', 'hopeless', 'burnt out', 'exhausted'],
      2: ['bad', 'tired', 'stressed', 'anxious', 'struggling'],
      3: ['okay', 'fine', 'alright', 'normal', 'meh'],
      4: ['good', 'productive', 'focused', 'motivated'],
      5: ['great', 'amazing', 'flow', 'energized', 'awesome', 'crushing'],
    };

    for (const [mood, keywords] of Object.entries(moodKeywords)) {
      if (keywords.some(keyword => message.toLowerCase().includes(keyword))) {
        extractedMood = parseInt(mood);
        break;
      }
    }

    return c.json({
      reply: aiReply,
      extractedMood,
      conversationLength: history.length,
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    return c.json({ error: 'Failed to process chat', details: error.message }, 500);
  }
});

// Add new endpoint to GET conversation history
app.post('/api/chat-history', async (c) => {
  try {
    const { userId } = await c.req.json();

    if (!userId) {
      return c.json({ error: 'Missing userId' }, 400);
    }

    const history = conversationHistory.get(userId) || [];

    return c.json({
      success: true,
      messages: history,
      count: history.length,
    });

  } catch (error: any) {
    console.error('Chat history error:', error);
    return c.json({ error: 'Failed to get chat history' }, 500);
  }
});

// Add endpoint to clear history (optional)
app.post('/api/clear-chat', async (c) => {
  try {
    const { userId } = await c.req.json();

    if (!userId) {
      return c.json({ error: 'Missing userId' }, 400);
    }

    conversationHistory.delete(userId);

    return c.json({
      success: true,
      message: 'Chat history cleared',
    });

  } catch (error: any) {
    console.error('Clear chat error:', error);
    return c.json({ error: 'Failed to clear chat' }, 500);
  }
});

export default app;

import { serve } from '@hono/node-server'

const port = parseInt(process.env.PORT || '3000')
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})