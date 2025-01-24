# Builder Uptime 🤖⚡️

**AI-powered wellness agent for Web3 builders.** Prevent burnout, track tasks, and monitor your energy - all with privacy-preserving AI running in a Trusted Execution Environment (TEE).

**🧩 Chrome Extension** • **📊 Opik Observability** • **🔒 TEE Privacy**

---

## What It Does

### 🛡️ Privacy-First AI (Shade Agent in TEE)
- **Trusted Execution Environment:** Your conversations stay encrypted and private
- **No content logged:** Only metadata (timing, scores) sent to analytics
- **PII Redaction:** Automatically detects and redacts sensitive data (SSN, emails, credit cards)

### 🧠 AI Agent & Observability (Opik Integration)
- **Full Trace Visibility:** Every interaction logged to [Opik](https://www.comet.com/opik) dashboard
- **LLM-as-Judge Evaluation:** Real-time quality scoring on every response
  - `empathy_score` - Emotional intelligence (0-1)
  - `actionability_score` - Usefulness of advice (0-1)
  - `safety_score` - Harm prevention (0-1)
  - `overall_quality` - Composite metric
- **Safety Guardrails:** Crisis language detection with 100% logging
- **Burnout Accuracy:** Validates energy → risk assessment correlation

### 🚨 Crisis Support & Safety
- **Crisis Detection:** Flags messages containing self-harm keywords
- **Automatic Response:** Provides supportive resources when crisis detected
- **Full Audit Trail:** All flagged conversations logged for review

### ✅ Productivity Tracking
- **Task Management:** Create, complete, and track blockers
- **Energy Monitoring:** Log energy levels (1-10) with burnout risk assessment
- **Session Analytics:** Track engagement, response times, voice usage
- **Weekly Insights:** Aggregated wellness trends and burnout risk days

### 🔐 Web3 Integration
- **Privy Auth:** Secure wallet-based login
- **Smart Accounts:** MetaMask Delegation Toolkit (ERC-4337)

---

## Opik Dashboard Views

| View | What You'll See |
|------|-----------------|
| **Traces** | `builder_buddy_chat`, `wellness_intervention`, `task_created`, `chat_analytics` |
| **Metadata** | Evaluation scores, safety flags, response timing |
| **Tags** | Filter by `crisis_flagged`, `wellness`, `high`, `low_energy` |
| **Metrics** | `burnout_accuracy`, `empathy`, `actionability`, `safety` |

### Sample Trace Metadata
```yaml
userId: did:privy:cmgu4ygja01y4l30cpzzkf1dn
responseTimeMs: 850
responseLength: 119  # Length only, no content!
safety:
  crisisDetected: false
  piiDetected: false
scores:
  empathy: 0.7
  actionability: 0.8
  safety: 1.0
  overall: 0.83
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React, TypeScript, TailwindCSS |
| **Observability** | [Opik SDK](https://www.comet.com/opik) (Traces, Evaluation, Metrics) |
| **AI Agent** | Shade Agent (TEE), OpenAI |
| **Auth** | Privy (Wallet-based) |
| **Backend** | Node.js, Express |
| **Deployment** | Railway |
| **Extension** | Chrome Manifest V3 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Extension                          │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │ Task Panel  │    │ Energy Log   │    │ Builder Chat │   │
│  └─────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Railway)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Express Server                                      │   │
│  │  • /api/chat → Shade Agent (TEE)                    │   │
│  │  • /api/log-wellness → Burnout detection            │   │
│  │  • /api/uptime/tasks → Task CRUD                    │   │
│  │  • /api/chat-analytics → Privacy-safe metrics       │   │
│  └─────────────────────────────────────────────────────┘   │
│                              │                              │
│                              ▼                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Opik Integration                                    │   │
│  │  • Trace logging (metadata only)                    │   │
│  │  • Evaluation scores                                │   │
│  │  • Safety guardrail flags                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Opik Dashboard (gathoni workspace)              │
│  • Real-time traces    • Quality metrics                    │
│  • Safety alerts       • Engagement analytics               │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- Chrome browser
- Opik account ([sign up](https://www.comet.com/opik))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/builder-uptime.git
cd builder-uptime

# Install dependencies
npm install

# Start development
npm run dev
```

### Chrome Extension Setup
1. Build the extension: `npm run build`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode**
4. Click **Load unpacked** → Select `dist` folder

### Environment Variables

```env
# Backend (.env)
OPIK_API_KEY="VBgqdX..."        # Your Opik API Key
OPIK_WORKSPACE="gathoni"         # Your Opik Workspace
OPIK_PROJECT_NAME="builder-uptime"
OPENAI_API_KEY="sk-..."          # For AI responses
PORT=3000

# Frontend (.env.local)
VITE_API_BASE_URL="https://your-backend.railway.app"
VITE_PRIVY_APP_ID="your-privy-app-id"
```

### Deploy Backend to Railway

```bash
cd backend
railway login
railway up
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with Opik status |
| `/api/chat` | POST | Chat with Builder Buddy (TEE) |
| `/api/log-wellness` | POST | Log energy level, get burnout risk |
| `/api/weekly-insights` | POST | Get aggregated wellness trends |
| `/api/uptime/tasks` | GET/POST | Task management |
| `/api/uptime/tasks/:id` | PUT/DELETE | Update/delete tasks |
| `/api/chat-analytics` | POST | Privacy-safe analytics |
| `/api/evaluation/summary` | GET | Dashboard summary stats |

---

## Opik Integration Details

### Traces Logged

| Trace Name | When | What's Captured |
|------------|------|-----------------|
| `builder_buddy_chat` | Every chat message | Response time, quality scores, safety flags |
| `wellness_intervention` | Energy logging | Burnout accuracy, timeliness |
| `task_created` | New task | Task clarity score |
| `task_updated` | Task completion | Completion time, blocker resolution |
| `task_deleted` | Task removal | Lifecycle score |
| `chat_analytics` | Frontend events | Session duration, engagement |

### Privacy Guarantees

✅ **What IS logged:**
- Message length (not content)
- Response timing
- Evaluation scores
- Safety flags (boolean)
- User ID (Privy DID)

❌ **What is NOT logged:**
- Actual message content
- Personal information
- Conversation history

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Links

- **Opik Dashboard:** [comet.com/opik/gathoni](https://www.comet.com/opik/gathoni)
- **Opik Docs:** [comet.com/docs/opik](https://www.comet.com/docs/opik)
- **Privy Docs:** [docs.privy.io](https://docs.privy.io)

---

## License

MIT

---

Built with 💙 for Web3 builders who refuse to burn out.