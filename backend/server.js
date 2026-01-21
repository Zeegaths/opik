// server.js - COMPLETE VERSION with OpenAI + Opik
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Opik } = require('opik');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

console.log('🚀 Builder Uptime Server starting...');

// Initialize Opik SDK
const opikClient = new Opik({
  projectName: 'builder-uptime'
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In-memory storage
const wellnessData = {};
const chatHistory = {};
const tasks = {};

// ====== HEALTH CHECK ======
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    opikEnabled: true,
    openaiEnabled: !!process.env.OPENAI_API_KEY
  });
});

// ====== WELLNESS ROUTES ======
app.post('/api/log-wellness', async (req, res) => {
  const { energyLevel, focusQuality, userId, taskId } = req.body;

  let burnoutRisk = "LOW";
  let recommendation = "You're in the flow! Keep building.";

  if (energyLevel <= 2) {
    burnoutRisk = "HIGH";
    recommendation = "🚨 Warning: Low energy detected. Take a 15-minute break to stay sustainable.";
  } else if (energyLevel <= 4) {
    burnoutRisk = "MEDIUM";
    recommendation = "⚠️  Energy dipping. Consider a short break or switching tasks.";
  }

  try {
    // Store wellness data
    if (!wellnessData[userId]) wellnessData[userId] = [];
    wellnessData[userId].push({
      timestamp: new Date().toISOString(),
      energyLevel,
      focusQuality,
      burnoutRisk
    });

    // Log to Opik
    const trace = opikClient.trace({
      name: 'wellness_intervention',
      input: { energyLevel, focusQuality, userId, taskId },
      output: { burnoutRisk, recommendation },
      metadata: { userId, taskId }
    });
    trace.end();

    console.log(`✅ Opik: wellness_intervention logged`);

    res.json({ success: true, burnoutRisk, recommendation });
  } catch (error) {
    console.error("Wellness endpoint error:", error);
    res.status(500).json({ error: "Failed to log wellness data" });
  }
});

app.post('/api/weekly-insights', async (req, res) => {
  const { userId } = req.body;
  
  try {
    const userData = wellnessData[userId] || [];
    const avgEnergy = userData.length > 0 
      ? userData.reduce((sum, d) => sum + d.energyLevel, 0) / userData.length 
      : 5;

    res.json({
      weeklyAvgEnergy: avgEnergy.toFixed(1),
      totalSessions: userData.length,
      burnoutRiskDays: userData.filter(d => d.burnoutRisk === "HIGH").length
    });
  } catch (error) {
    console.error("Weekly insights error:", error);
    res.status(500).json({ error: "Failed to generate insights" });
  }
});

// ====== CHAT ROUTES ======
app.post('/api/chat', async (req, res) => {
  const { userId, message, context } = req.body;

  try {
    // Get chat history for context
    const history = chatHistory[userId] || [];
    
    // Build system prompt with user context
    const systemPrompt = `You are Builder Buddy, an empathetic AI coach for startup founders and builders. You help them:
- Maintain sustainable work habits and avoid burnout
- Process feelings about their work
- Make decisions about taking breaks
- Stay motivated through challenges

Current user context:
- Energy level: ${context?.currentEnergy || 3}/5
- Tasks completed: ${context?.tasksCompleted || 0}
- Streak: ${context?.streakDays || 0} days

Be warm, supportive, and direct. Keep responses concise (2-3 sentences max). If energy is low (≤2), strongly encourage a break.`;

    // Convert chat history to OpenAI format
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add last 10 messages for context
    history.slice(-10).forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content
      });
    });
    
    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 200,
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;

    // Store chat history
    if (!chatHistory[userId]) chatHistory[userId] = [];
    chatHistory[userId].push(
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response, timestamp: new Date().toISOString() }
    );

    // Keep only last 50 messages
    if (chatHistory[userId].length > 50) {
      chatHistory[userId] = chatHistory[userId].slice(-50);
    }

    // Log to Opik
    const trace = opikClient.trace({
      name: 'shade_agent_chat',
      input: { message, context, historyLength: history.length },
      output: { response, model: 'gpt-4o-mini' },
      metadata: { userId, energy: context?.currentEnergy }
    });
    trace.end();

    console.log(`✅ Opik: shade_agent_chat logged`);

    res.json({ message: response });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to chat with agent" });
  }
});

app.post('/api/chat-history', async (req, res) => {
  const { userId } = req.body;
  const messages = chatHistory[userId] || [];
  res.json({ messages });
});

app.post('/api/clear-chat', async (req, res) => {
  const { userId } = req.body;
  chatHistory[userId] = [];
  res.json({ success: true });
});

app.post('/api/chat-analytics', async (req, res) => {
  const { userId, eventType, sessionDuration, messageCount, currentEnergy, metadata } = req.body;
  
  try {
    const trace = opikClient.trace({
      name: 'chat_analytics',
      input: { userId, eventType, sessionDuration, messageCount, currentEnergy },
      output: { tracked: true },
      metadata: { ...metadata, userId }
    });
    trace.end();

    console.log(`✅ Opik: chat_analytics logged`);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Chat analytics error:", error);
    res.status(500).json({ error: "Failed to track analytics" });
  }
});

// ====== UPTIME ANALYSIS ENDPOINT ======
app.post('/api/analyze-uptime', async (req, res) => {
  const { userId, uptime, energy, tasks, focusMinutes, blockers } = req.body;

  try {
    const userData = wellnessData[userId] || [];
    const recentSessions = userData.slice(-7); // Last 7 sessions
    
    const analysisPrompt = `Analyze this builder's productivity and provide actionable insights:

Current Session:
- Uptime Score: ${uptime}%
- Energy Level: ${energy}/5
- Tasks Completed: ${tasks.filter(t => t.completed).length}/${tasks.length}
- Focus Time: ${focusMinutes} minutes
- Active Blockers: ${blockers}

Recent Wellness Trend (last 7 sessions):
${recentSessions.length > 0 ? recentSessions.map(s => `- Energy: ${s.energyLevel}/5, Risk: ${s.burnoutRisk}`).join('\n') : '- No recent data'}

Provide:
1. One specific suggestion (max 2 sentences)
2. Brief reasoning (max 1 sentence)
3. Should they take a break? (yes/no)

Format as JSON: {"suggestion": "...", "reasoning": "...", "needsBreak": true/false}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an AI productivity analyst. Provide concise, actionable insights. Always respond with valid JSON.' 
        },
        { role: 'user', content: analysisPrompt }
      ],
      max_tokens: 150,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(completion.choices[0].message.content);

    // Log to Opik
    const trace = opikClient.trace({
      name: 'uptime_analysis',
      input: { userId, uptime, energy, taskCount: tasks.length, focusMinutes },
      output: { analysis, model: 'gpt-4o-mini' },
      metadata: { userId, burnoutRisk: recentSessions[recentSessions.length - 1]?.burnoutRisk || 'UNKNOWN' }
    });
    trace.end();

    console.log(`✅ Opik: uptime_analysis logged`);

    res.json({ analysis });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Failed to analyze uptime" });
  }
});

// ====== TASK MANAGEMENT ROUTES ======
app.get('/api/uptime/tasks', async (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId || 'default';
  const userTasks = tasks[userId] || [];
  res.json({ tasks: userTasks });
});

app.post('/api/uptime/tasks', async (req, res) => {
  const { userId, title, description, priority } = req.body;
  
  try {
    const task = {
      id: Date.now().toString(),
      userId,
      title,
      description,
      priority: priority || 'medium',
      completed: false,
      hasBlocker: false,
      createdAt: new Date().toISOString()
    };

    if (!tasks[userId]) tasks[userId] = [];
    tasks[userId].push(task);

    // Log to Opik
    const trace = opikClient.trace({
      name: 'task_created',
      input: { userId, title, priority },
      output: { taskId: task.id },
      metadata: { userId }
    });
    trace.end();

    console.log(`✅ Opik: task_created logged`);

    res.json({ task });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.put('/api/uptime/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { userId, completed, title, description, priority, hasBlocker } = req.body;
  
  try {
    if (!tasks[userId]) {
      return res.status(404).json({ error: 'User tasks not found' });
    }

    const taskIndex = tasks[userId].findIndex(t => t.id === id);
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`📝 Updating task ${id}:`, { completed, title, hasBlocker });

    tasks[userId][taskIndex] = {
      ...tasks[userId][taskIndex],
      ...(completed !== undefined && { completed }),
      ...(hasBlocker !== undefined && { hasBlocker }),
      ...(title && { title }),
      ...(description && { description }),
      ...(priority && { priority }),
      updatedAt: new Date().toISOString()
    };

    console.log(`✅ Task ${id} updated:`, tasks[userId][taskIndex]);

    res.json({ task: tasks[userId][taskIndex] });
  } catch (error) {
    console.error("Update task error:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete('/api/uptime/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] || req.query.userId || 'default';
  
  try {
    if (!tasks[userId]) {
      return res.status(404).json({ error: 'User tasks not found' });
    }

    const taskIndex = tasks[userId].findIndex(t => t.id === id);
    if (taskIndex === -1) {
      return res.status(404).json({ error: 'Task not found' });
    }

    tasks[userId].splice(taskIndex, 1);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

const PORT = process.env.PORT || 3000;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Flushing Opik traces...');
  await opikClient.flush();
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Builder Uptime Server running on port ${PORT}`);
  console.log(`📊 Opik SDK: ENABLED ✅`);
  console.log(`🤖 OpenAI: ${process.env.OPENAI_API_KEY ? 'ENABLED ✅' : 'DISABLED ⚠️'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
});