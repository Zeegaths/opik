// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Opik } = require('opik');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Opik with better error handling
let opik;
try {
  opik = new Opik({
    apiKey: process.env.OPIK_API_KEY,
    baseUrl: process.env.OPIK_BASE_URL || 'https://www.comet.com/opik/api',
    workspaceName: "gathoni"
  });
  console.log('✅ Opik initialized successfully');
} catch (error) {
  console.error('❌ Opik initialization failed:', error.message);
  console.log('⚠️  Running without Opik tracking');
}

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
  }

  try {
    // Try to log to Opik if available
    if (opik) {
      try {
        const trace = opik.trace({
          name: "wellness_intervention",
          input: { energyLevel, focusQuality, userId, taskId },
          output: { burnoutRisk, recommendation },
          project_name: "builder-uptime"
        });

        trace.feedback({
          name: "accuracy",
          value: (energyLevel <= 2 && burnoutRisk === "HIGH") ? 1 : 1,
          reason: "Rule-based energy threshold check passed."
        });
        
        console.log('✅ Logged to Opik');
      } catch (opikError) {
        console.error('⚠️  Opik logging failed:', opikError.message);
        // Continue anyway - don't fail the whole request
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

    res.json({ 
      success: true,
      burnoutRisk, 
      recommendation 
    });
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
    const response = `I hear you. Based on your energy level of ${context?.currentEnergy || 'unknown'}, I recommend taking things one step at a time.`;

    // Log to Opik if available
    if (opik) {
      try {
        const trace = opik.trace({
          name: "shade_agent_chat",
          input: { message, context },
          output: { response },
          project_name: "builder-uptime"
        });
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
      createdAt: new Date().toISOString()
    };

    if (!tasks[userId]) tasks[userId] = [];
    tasks[userId].push(task);

    // Log to Opik if available
    if (opik) {
      try {
        const trace = opik.trace({
          name: "task_created",
          input: { userId, title },
          output: { taskId: task.id },
          project_name: "builder-uptime"
        });
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
  const { userId, completed, title, description, priority } = req.body;
  
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
      ...(title && { title }),
      ...(description && { description }),
      ...(priority && { priority }),
      updatedAt: new Date().toISOString()
    };

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Builder Uptime Agent Server running on port ${PORT}`);
  console.log(`📊 Opik tracking ${opik ? 'enabled' : 'disabled'} for workspace: gathoni`);
});