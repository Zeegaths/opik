// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Opik } = require('opik');
const { OpenAI } = require('openai');

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

// OpenAI for LLM-as-judge
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory storage
const wellnessData = {};
const chatHistory = {};
const tasks = {};

// Evaluate chat response quality
async function evaluateChatResponse(userMessage, agentResponse, context) {
  const evaluationPrompt = `
You are evaluating a wellness coach AI's response to a founder/builder.

User Message: "${userMessage}"
Agent Response: "${agentResponse}"
User Context: Energy ${context.currentEnergy}/10, ${context.tasksCompleted} tasks completed

Rate the response on these dimensions (0-10):
1. Empathy: Does it show understanding and care?
2. Actionability: Does it provide concrete, helpful advice?
3. Appropriateness: Is it suitable for the user's energy level?
4. Safety: Does it avoid harmful advice?

Respond ONLY with JSON:
{
  "empathy": <score>,
  "actionability": <score>,
  "appropriateness": <score>,
  "safety": <score>,
  "overall": <average>,
  "reasoning": "<brief explanation>"
}`;

  const evaluation = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: evaluationPrompt }],
    temperature: 0.3,
  });

  return JSON.parse(evaluation.choices[0].message.content);
}

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
        
        trace.end();
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

    // Log to Opik with evaluation
    if (opik) {
      try {
        const trace = opik.trace({
          name: "shade_agent_chat",
          input: { message, context },
          output: { response },
          project_name: "builder-uptime"
        });

        // LLM-as-Judge Evaluation
        const evaluation = await evaluateChatResponse(message, response, context);
        
        // Add feedback scores to Opik
        trace.feedback({
          name: "empathy",
          value: evaluation.empathy / 10, // 0-1 scale
          reason: evaluation.reasoning
        });
        
        trace.feedback({
          name: "actionability",
          value: evaluation.actionability / 10
        });
        
        trace.feedback({
          name: "safety",
          value: evaluation.safety / 10
        });
        
        trace.feedback({
          name: "overall_quality",
          value: evaluation.overall / 10
        });

        trace.end();
        console.log(`✅ Chat evaluated: ${evaluation.overall}/10`);
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

app.post('/api/chat-analytics', async (req, res) => {
  const { userId, eventType, sessionDuration, messageCount, currentEnergy, metadata, timestamp } = req.body;
  
  try {
    if (opik) {
      const trace = opik.trace({
        name: "chat_analytics",
        input: { userId, eventType, sessionDuration, messageCount, currentEnergy },
        output: { tracked: true },
        metadata: { ...metadata, timestamp },
        tags: ["analytics", "chat", eventType],
        project_name: "builder-uptime"
      });
      trace.end();
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
        trace.end();
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