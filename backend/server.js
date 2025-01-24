require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let opik = null;

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
  }
}

initOpik();

const wellnessData = {};
const chatHistory = {};
const tasks = {};

// ====== SAFETY GUARDRAILS ======
const CRISIS_KEYWORDS = ['suicide', 'kill myself', 'end it all', 'want to die', 'self harm', 'hurt myself'];
const PII_PATTERNS = [/\b\d{3}-\d{2}-\d{4}\b/g, /\b\d{16}\b/g, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g];

function detectCrisisLanguage(text) {
  const lowerText = text.toLowerCase();
  const detected = CRISIS_KEYWORDS.filter(k => lowerText.includes(k));
  return { hasCrisis: detected.length > 0, keywords: detected, severity: detected.length > 2 ? 'HIGH' : detected.length > 0 ? 'MEDIUM' : 'LOW' };
}

function detectAndRedactPII(text) {
  let redacted = text;
  let found = [];
  PII_PATTERNS.forEach((p, i) => {
    const m = text.match(p);
    if (m) { found.push({ type: ['SSN', 'CARD', 'EMAIL'][i], count: m.length }); redacted = redacted.replace(p, '[REDACTED]'); }
  });
  return { redactedText: redacted, piiFound: found, hasPII: found.length > 0 };
}

// ====== EVALUATION METRICS ======
function calcEmpathy(msg, resp) {
  let s = 5;
  ['i hear you', 'i understand', 'i notice', 'support you'].forEach(p => { if (resp.toLowerCase().includes(p)) s++; });
  ['you should', 'you must', 'just do'].forEach(p => { if (resp.toLowerCase().includes(p)) s--; });
  return Math.max(0, Math.min(10, s));
}

function calcActionability(resp) {
  let s = 5;
  ['try', 'consider', 'take a', 'what would', 'break'].forEach(p => { if (resp.toLowerCase().includes(p)) s++; });
  if (resp.match(/\d+\s*(minute|min|hour)/i)) s++;
  return Math.max(0, Math.min(10, s));
}

function calcSafety(resp, crisis) {
  let s = 10;
  ['push through', 'ignore it', 'man up'].forEach(p => { if (resp.toLowerCase().includes(p)) s -= 2; });
  if (crisis && !resp.toLowerCase().includes('support')) s -= 3;
  return Math.max(0, Math.min(10, s));
}

function calcBurnoutAccuracy(energy, risk) {
  if (energy <= 2 && risk === "HIGH") return 1.0;
  if (energy > 2 && energy <= 4 && risk === "MEDIUM") return 1.0;
  if (energy > 4 && risk === "LOW") return 1.0;
  return 0.5;
}

// ====== ROUTES ======
app.get('/health', (req, res) => {
  res.json({ status: 'ok', opikEnabled: !!opik, features: { safety: true, evaluation: true } });
});

app.post('/api/log-wellness', async (req, res) => {
  const { energyLevel, focusQuality, userId, taskId } = req.body;
  let burnoutRisk = energyLevel <= 2 ? "HIGH" : energyLevel <= 4 ? "MEDIUM" : "LOW";
  let recommendation = burnoutRisk === "HIGH" ? "🚨 Take a 15-minute break." : burnoutRisk === "MEDIUM" ? "⚠️ Consider a short break." : "You're in the flow!";
  
  const accuracy = calcBurnoutAccuracy(energyLevel, burnoutRisk);

  if (opik) {
    try {
      const trace = opik.trace({
        name: "wellness_intervention",
        input: { energyLevel, focusQuality, userId },
        output: { burnoutRisk, recommendation },
        metadata: { scores: { burnout_accuracy: accuracy } },
        tags: ["wellness", burnoutRisk.toLowerCase()]
      });
      trace.end();
      await opik.flush();
      console.log(`✅ Wellness logged [Accuracy: ${accuracy}]`);
    } catch (e) { console.error('⚠️ Opik error:', e.message); }
  }

  if (!wellnessData[userId]) wellnessData[userId] = [];
  wellnessData[userId].push({ timestamp: new Date().toISOString(), energyLevel, focusQuality, burnoutRisk });
  res.json({ success: true, burnoutRisk, recommendation });
});

app.post('/api/weekly-insights', async (req, res) => {
  const { userId } = req.body;
  const data = wellnessData[userId] || [];
  const avg = data.length > 0 ? data.reduce((s, d) => s + d.energyLevel, 0) / data.length : 5;
  res.json({ weeklyAvgEnergy: avg.toFixed(1), totalSessions: data.length, burnoutRiskDays: data.filter(d => d.burnoutRisk === "HIGH").length });
});

app.post('/api/chat', async (req, res) => {
  const { userId, message, context } = req.body;
  
  const crisis = detectCrisisLanguage(message);
  const pii = detectAndRedactPII(message);
  const safeMsg = pii.redactedText;

  let response = "I'm here to support you. ";
  let type = "general";
  
  if (crisis.hasCrisis) {
    response = "I hear you're going through something difficult. Support is available - please reach out to a crisis helpline or trusted person. 💙";
    type = "crisis_support";
  } else if (context?.currentEnergy <= 2) {
    response += "I notice your energy is very low. Taking a break is essential.";
    type = "low_energy";
  } else if (safeMsg.toLowerCase().includes('stress')) {
    response += "It sounds intense. What's one small thing you can do for yourself?";
    type = "stress_support";
  } else if (safeMsg.toLowerCase().includes('tired')) {
    response += "Fatigue is real. Can you take 15 minutes to step away?";
    type = "fatigue_support";
  } else {
    response += "How are you really doing today?";
    type = "check_in";
  }

  const empathy = calcEmpathy(safeMsg, response);
  const action = calcActionability(response);
  const safety = calcSafety(response, crisis.hasCrisis);
  const quality = (empathy + action + safety) / 3;

  if (opik) {
    try {
      const trace = opik.trace({
        name: "builder_buddy_chat",
        input: { message: safeMsg, energyLevel: context?.currentEnergy },
        output: { response, responseType: type },
        metadata: {
          safety: { crisisDetected: crisis.hasCrisis, piiDetected: pii.hasPII },
          scores: { empathy: empathy/10, actionability: action/10, safety: safety/10, overall: quality/10 }
        },
        tags: ["chat", type, crisis.hasCrisis ? "crisis_flagged" : "normal"]
      });
      trace.end();
      await opik.flush();
      console.log(`✅ Chat logged [${type}] Quality: ${quality.toFixed(1)}/10 ${crisis.hasCrisis ? '🚨' : ''}`);
    } catch (e) { console.error('⚠️ Opik error:', e.message); }
  }

  if (!chatHistory[userId]) chatHistory[userId] = [];
  chatHistory[userId].push(
    { role: 'user', content: safeMsg, timestamp: new Date().toISOString() },
    { role: 'assistant', content: response, timestamp: new Date().toISOString() }
  );
  if (chatHistory[userId].length > 50) chatHistory[userId] = chatHistory[userId].slice(-50);

  res.json({ message: response, meta: { crisisSupport: crisis.hasCrisis, qualityScore: quality.toFixed(1) } });
});

app.post('/api/chat-history', async (req, res) => {
  res.json({ messages: chatHistory[req.body.userId] || [] });
});

app.post('/api/clear-chat', async (req, res) => {
  chatHistory[req.body.userId] = [];
  res.json({ success: true });
});

app.post('/api/chat-analytics', async (req, res) => {
  const { userId, eventType, sessionDuration, messageCount, currentEnergy, metadata, timestamp } = req.body;
  if (opik) {
    try {
      const trace = opik.trace({
        name: "chat_analytics",
        input: { userId, eventType, sessionDuration, messageCount },
        output: { tracked: true },
        metadata: { ...metadata, scores: { engagement: Math.min(1, messageCount/10) } },
        tags: ["analytics", eventType]
      });
      trace.end();
      await opik.flush();
    } catch (e) { console.error('⚠️ Opik error:', e.message); }
  }
  res.json({ success: true });
});

app.get('/api/uptime/tasks', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId || 'default';
  res.json({ tasks: tasks[userId] || [] });
});

app.post('/api/uptime/tasks', async (req, res) => {
  const { userId, title, description, priority } = req.body;
  const task = { id: Date.now().toString(), userId, title, description, priority: priority || 'medium', completed: false, hasBlocker: false, createdAt: new Date().toISOString() };
  if (!tasks[userId]) tasks[userId] = [];
  tasks[userId].push(task);

  if (opik) {
    try {
      const trace = opik.trace({
        name: "task_created",
        input: { userId, title, priority },
        output: { taskId: task.id },
        metadata: { scores: { clarity: title.length > 10 ? 1.0 : 0.5 } },
        tags: ["task", "created", priority]
      });
      trace.end();
      await opik.flush();
      console.log('✅ Task logged');
    } catch (e) { console.error('⚠️ Opik error:', e.message); }
  }
  res.json({ task });
});

app.put('/api/uptime/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { userId, completed, title, description, priority, hasBlocker } = req.body;
  if (!tasks[userId]) return res.status(404).json({ error: 'Not found' });
  const idx = tasks[userId].findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const old = { ...tasks[userId][idx] };
  tasks[userId][idx] = { ...tasks[userId][idx], ...(completed !== undefined && { completed }), ...(hasBlocker !== undefined && { hasBlocker }), ...(title && { title }), ...(description && { description }), ...(priority && { priority }), updatedAt: new Date().toISOString() };

  if (opik) {
    try {
      const trace = opik.trace({
        name: "task_updated",
        input: { userId, taskId: id, changes: { completed, hasBlocker } },
        output: { task: tasks[userId][idx] },
        metadata: { scores: { completed: (!old.completed && completed) ? 1 : 0, blocker_resolved: (old.hasBlocker && !hasBlocker) ? 1 : 0 } },
        tags: ["task", "updated"]
      });
      trace.end();
      await opik.flush();
    } catch (e) { console.error('⚠️ Opik error:', e.message); }
  }
  res.json({ task: tasks[userId][idx] });
});

app.delete('/api/uptime/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-user-id'] || req.query.userId || 'default';
  if (!tasks[userId]) return res.status(404).json({ error: 'Not found' });
  const idx = tasks[userId].findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const deleted = tasks[userId][idx];
  tasks[userId].splice(idx, 1);

  if (opik) {
    try {
      const trace = opik.trace({
        name: "task_deleted",
        input: { userId, taskId: id, title: deleted.title },
        output: { success: true },
        metadata: { scores: { lifecycle: deleted.completed ? 1 : 0.3 } },
        tags: ["task", "deleted"]
      });
      trace.end();
      await opik.flush();
    } catch (e) { console.error('⚠️ Opik error:', e.message); }
  }
  res.json({ success: true });
});

app.get('/api/evaluation/summary', (req, res) => {
  res.json({
    totalUsers: Object.keys(wellnessData).length,
    totalChats: Object.values(chatHistory).reduce((s, h) => s + h.length, 0),
    totalTasks: Object.values(tasks).reduce((s, t) => s + t.length, 0),
    highBurnoutEvents: Object.values(wellnessData).flat().filter(d => d.burnoutRisk === "HIGH").length
  });
});

process.on('SIGTERM', async () => { if (opik) await opik.flush(); process.exit(0); });
process.on('SIGINT', async () => { if (opik) await opik.flush(); process.exit(0); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Builder Uptime Server running on port ${PORT}`);
  console.log(`📊 Opik tracking: ${opik ? '✅ enabled' : '⏳ initializing...'}`);
  console.log(`🛡️  Safety guardrails: ✅ enabled`);
  console.log(`📈 Evaluation metrics: ✅ enabled`);
});