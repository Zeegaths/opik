# Builder Uptime 🤖⚡️

**AI-powered productivity agent, now delivered as a Chrome Extension.** Track tasks, get real-time insights, and monitor agent reasoning via Opik.

**🧩 Chrome Extension** • **📊 Opik Observability** • Deployed on **Monad Testnet**

---

## What It Does

**Chrome Extension:**
- 🧩 **Contextual Tracking:** Monitor productivity across any tab without leaving your workflow.
- 🔗 **Dashboard Overlay:** Real-time visibility into your current uptime and task list.
- 🎯 **Quick-Access:** One-click task entry and energy level logging via the extension popup.

**AI Agent & Observability:**
- 🧠 **Opik Integration:** Full transparency into agent traces. View the agent's internal reasoning for every productivity tip generated.
- 💡 **Smart Analysis:** AI detects work patterns and provides burnout prevention based on historical data.
- 🚨 **Real-time Logging:** Every action is logged to the **gathoni** workspace for full auditability.

**Productivity Tracking:**
- ✅ **Task Management:** Real-time blocker detection and focus time tracking.
- ⚡ **Energy Monitoring:** Logs focus/energy levels to optimize your work schedule.
- 🎯 **Uptime Score:** A live metric targeting 99.99% efficiency.

**Web3 Integration:**
- 🔐 **Smart Accounts:** Powered by MetaMask Delegation Toolkit (ERC-4337).
- 🔗 **Privy Auth:** Secure, frictionless wallet-based login.
- ⛓️ **Monad Testnet:** On-chain timestamping and proof-of-work achievements.

---

## Tech Stack

**Frontend:** React, TypeScript, TailwindCSS  
**Observability:** [Opik SDK](https://www.comet.com/opik) (Trace logging & evaluation)  
**AI:** Coinbase Agent Kit, Shade Agent  
**Blockchain:** Monad Testnet, MetaMask Delegation Toolkit  
**Auth:** Privy  
**Extension:** Manifest V3  

---

## Quick Start

### Installation
1. Clone the repository.
2. Build the extension: `npm run build`.
3. Open Chrome and navigate to `chrome://extensions`.
4. Enable **Developer Mode** and click **Load unpacked**.
5. Select the `dist` folder.

### Environment Variables
To ensure security, Opik keys are handled server-side to prevent exposure in the browser.
```env
# Server-side (Railway/Backend)
OPIK_API_KEY="fdSM4..." # Your Opik API Key
OPIK_WORKSPACE="" # Your Opik Workspace

# Client-side (Extension)
VITE_PRIVY_APP_ID="your-app-id"
VITE_SHADE_AGENT_URL="()"