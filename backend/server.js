// server.js - Builder Uptime (Simple Version)
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Opik client (initialized async)
let opik = null;

// Initialize Opik with dynamic import (ESM compatibility)
async function initOpik() {
  try {
    const { Opik } = await import('opik');
    opik = new Opik({
      apiKey: process.env.OPIK_API_KEY,
      workspaceName: process.env.OPIK_WORKSPACE || "gathoni",
      projectName: process.env.OPIK_PROJECT_NAME || "builder-uptime"
    });
    console.log('✅ Opik initialized successfully');
    console.log(`   Workspace: ${process.env.OPIK_WORKSPACE || "gathoni"}`);
    console.log(`   Project: ${process.env.OPIK_PROJECT_NAME || "builder-uptime"}`);
    console.log(`   API Key: ${process.env.OPIK_API_KEY ? process.env.OPIK_API_KEY.substring(0, 8) + '...' : 'NOT SET'}`);
  } catch (error) {
    console.error('❌ Opik initialization failed:', error.message);
    console.log('⚠️  Running without Opik tracking');
  }
}

// Initialize on startup
initOpik();

// In-memory storage
const wellnessData = {};
const chatHistory = {};
const tasks = {};

// ====== HEALTH CHECK ======
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    opikEnabled: !!opik
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
    recommendation = "⚠️ Energy dipping. Consider a short break or switching tasks.";
  }

  try {
    // Log to Opik if available
    if (opik) {
      try {
        const trace = opik.trace({
          name: "wellness_intervention",
          input: { energyLevel, focusQuality, userId, taskId },
          output: { burnoutRisk, recommendation },
          tags: ["wellness", burnoutRisk.toLowerCase()]
        });
        trace.end();
        await opik.flush();
        console.log('✅ Wellness logged to Opik');
      } catch (opikError) {
        console.error('⚠️  Opik logging failed:', opikError.message);
      }
    }

    // Store wellness data
    if (!wellnessData[userId]) wellnessData[userId] = [];
    wellnessData[userId].push({
      timestamp: new Date().toISOString(),
      energyLevel,
      focusQuality,
      burnoutRisk
    });

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
    let response = "I'm here to support you. ";
    
    if (context?.currentEnergy <= 2) {
      response += "I notice your energy is very low. Taking a break isn't optional - it's essential.";
    } else if (context?.currentEnergy <= 3) {
      response += "Your energy is dipping. What would help you recharge?";
    } else if (message.toLowerCase().includes('stress')) {
      response += "It sounds like things are intense. What's one small thing you can do for yourself?";
    } else {
      response += "How are you really doing today?";
    }

    // Log to Opik if available
    if (opik) {
      try {
        const trace = opik.trace({
          name: "builder_buddy_chat",
          input: { message, energyLevel: context?.currentEnergy },
          output: { response },
          tags: ["chat", "llm"]
        });
        trace.end();
        await opik.flush();
        console.log('✅ Chat logged to Opik');
      } catch (opikError) {
        console.error('⚠️  Opik chat logging failed:', opikError.message);
      }
    }

    // Store chat history
    if (!chatHistory[userId]) chatHistory[userId] = [];
    chatHistory[userId].push(
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response, timestamp: new Date().toISOString() }
    );

    if (chatHistory[userId].length > 50) {
      chatHistory[userId] = chatHistory[userId].slice(-50);
    }

    res.json({ message: response });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to chat with agent" });
  }
});

app.post('/api/chat-history', async (req, res) => {
  const { userId } = req.body;
  res.json({ messages: chatHistory[userId] || [] });
});

app.post('/api/clear-chat', async (req, res) => {
  const { userId } = req.body;
  chatHistory[userId] = [];
  res.json({ success: true });
});

// ====== CHAT ANALYTICS ======
app.post('/api/chat-analytics', async (req, res) => {
  const { userId, eventType, sessionDuration, messageCount, currentEnergy, metadata, timestamp } = req.body;
  
  try {
    if (opik) {
      const trace = opik.trace({
        name: "chat_analytics",
        input: { userId, eventType, sessionDuration, messageCount, currentEnergy },
        output: { tracked: true },
        metadata: { ...metadata, timestamp },
        tags: ["analytics", "chat", eventType]
      });
      trace.end();
      await opik.flush();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Chat analytics error:", error);
    res.status(500).json({ error: "Failed to track analytics" });
  }
});

// ====== TASKS ROUTES ======
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
    if (opik) {
      try {
        const trace = opik.trace({
          name: "task_created",
          input: { userId, title, priority },
          output: { taskId: task.id, totalTasks: tasks[userId].length },
          tags: ["task", "created"]
        });
        trace.end();
        await opik.flush();
        console.log('✅ Task logged to Opik');
      } catch (opikError) {
        console.error('⚠️  Opik task logging failed:', opikError.message);
      }
    }

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

    tasks[userId][taskIndex] = {
      ...tasks[userId][taskIndex],
      ...(completed !== undefined && { completed }),
      ...(hasBlocker !== undefined && { hasBlocker }),
      ...(title && { title }),
      ...(description && { description }),
      ...(priority && { priority }),
      updatedAt: new Date().toISOString()
    };

    // Log to Opik
    if (opik) {
      try {
        const trace = opik.trace({
          name: "task_updated",
          input: { userId, taskId: id, changes: { completed, hasBlocker } },
          output: { task: tasks[userId][taskIndex] },
          tags: ["task", "updated"]
        });
        trace.end();
        await opik.flush();
      } catch (opikError) {
        console.error('⚠️  Opik logging failed:', opikError.message);
      }
    }

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

    const deletedTask = tasks[userId][taskIndex];
    tasks[userId].splice(taskIndex, 1);

    // Log to Opik
    if (opik) {
      try {
        const trace = opik.trace({
          name: "task_deleted",
          input: { userId, taskId: id, title: deletedTask.title },
          output: { success: true },
          tags: ["task", "deleted"]
        });
        trace.end();
        await opik.flush();
      } catch (opikError) {
        console.error('⚠️  Opik logging failed:', opikError.message);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  if (opik) await opik.flush();
  process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Builder Uptime Server running on port ${PORT}`);
  console.log(`📊 Opik tracking: ${opik ? '✅ enabled' : '⏳ initializing...'}`);
});// redeploy 29 Januari 2026 03:29:07 alasiri EAT
