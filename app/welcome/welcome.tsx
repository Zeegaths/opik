import { useUserOperation } from '~/hooks/useUserOperation';
import { useShadeAgent } from '~/hooks/useShadeAgent';
import { BuilderChat } from '~/components/BuilderChat';
import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import useMetaMaskSmartAccount from '../hooks/useMetamaskSmartAccount';
import { usePersistentTasks, useAutoSaveSession } from '~/hooks/usePersistentTasks';
import { OpikTracer } from '~/hooks/opik-provider';
import { useExtensionNotifications } from '~/hooks/useExtensionNotifications';
import { useUptimeAnalysis } from '~/hooks/useUptimeAnalysis';

// Define Task interface
interface Task {
  id: number;
  text: string;
  completed: boolean;
  hasBlocker: boolean;
}

// Define AI Analysis interface
interface AIAnalysis {
  suggestion: string;
  reasoning: string;
  needsBreak?: boolean;
}

export default function MinimalBuilderUptime() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const userWallet = wallets[0];
  const walletAddress = userWallet?.address;
  const { analyzeUptime, isAnalyzing } = useUptimeAnalysis();

  const isMetaMask = userWallet?.walletClientType === 'metamask' &&
    userWallet?.connectorType === 'injected';



  // Get Farcaster profile from Privy user data
  const farcasterAccount = user?.farcaster;
  const farcasterPfp = farcasterAccount?.pfp;
  const farcasterUsername = farcasterAccount?.username;
  const farcasterDisplayName = farcasterAccount?.displayName;

  // MetaMask Smart Account Integration
  const { smartAccount, isCreatingAccount, error: smartAccountError } =
    useMetaMaskSmartAccount(isMetaMask);
  const { sendUserOperation, isSending, txHash, error: txError } = useUserOperation(smartAccount);


  // UI State
  const [showSmartAccountInfo, setShowSmartAccountInfo] = useState(false);
  const [showTestTransaction, setShowTestTransaction] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testAmount, setTestAmount] = useState('0.001');

  // Task State
  const [taskInput, setTaskInput] = useState('');
  const {
    tasks,
    loading: tasksLoading,
    addTask,
    updateTask,
    deleteTask,
  } = usePersistentTasks();
  const [energy, setEnergy] = useState(4);
  const [focusSeconds, setFocusSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [lastBreak, setLastBreak] = useState<number | null>(null);
  const [showBreakReminder, setShowBreakReminder] = useState(false);
  const [timelineView, setTimelineView] = useState<'week' | 'month'>('week');

  // AI Analysis state (for when useBuilderAgent is implemented)
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [showAIInsight, setShowAIInsight] = useState(false);

  // Shade Agent integration
  const [showChat, setShowChat] = useState(false);
  const [burnoutWarning, setBurnoutWarning] = useState<{ level: string; action: string } | null>(null);
  const { logWellness, isLoading: agentLoading } = useShadeAgent();
  const { sendNotification } = useExtensionNotifications();

  useEffect(() => {
    if (energy <= 2) {
      sendNotification(
        '🚨 Low Energy Detected',
        'Take a 15-minute break to stay sustainable.'
      );
    }
  }, [energy, sendNotification]);

  useEffect(() => {
    console.log('📊 Component state:', {
      ready,
      authenticated,
      userId: user?.id,
      tasksCount: tasks.length,
      tasksLoading
    });
  }, [ready, authenticated, user, tasks, tasksLoading]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setFocusSeconds(prev => {
          const newSeconds = prev + 1;
          if (newSeconds === 5400) {
            setShowBreakReminder(true);
          }
          if (newSeconds > 5400 && (newSeconds - 5400) % 1800 === 0) {
            setShowBreakReminder(true);
          }
          return newSeconds;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);


  // Add this new handler
  const handleEnergyChange = async (newEnergy: number) => {
    setEnergy(newEnergy);

    // Log to backend which forwards to Opik
    if (authenticated && user?.id) {
      try {
        const focusQuality = Math.min(5, Math.max(1, Math.round((focusSeconds / 1800) + 1) || 3));

        await logWellness({
          userId: user.id,
          energyLevel: newEnergy,
          focusQuality: focusQuality,
          taskId: tasks[0]?.id?.toString() || 'current_session'
        });

        console.log("✅ Wellness logged to Opik via backend");
      } catch (err) {
        console.error("❌ Failed to log wellness", err);
      }
    }
  };

  const handleAnalyzeUptime = async () => {
    if (!authenticated || !user?.id) return;

    const analysis = await analyzeUptime(
      user.id,
      uptime,
      energy,
      tasks,
      Math.floor(focusSeconds / 60)
    );

    if (analysis) {
      setAnalysis(analysis);
      setShowAIInsight(true);
    }
  };
  // Task functions
  const handleAddTask = async (): Promise<void> => {
    if (taskInput.trim()) {
      await addTask(taskInput.trim());
      setTaskInput('');
    }
  };

  const toggleTask = async (id: number): Promise<void> => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await updateTask(id, { completed: !task.completed });
    }
  };

  const toggleBlocker = async (id: number): Promise<void> => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      console.log('Before toggle:', { id, hasBlocker: task.hasBlocker });
      await updateTask(id, { hasBlocker: !task.hasBlocker });
      console.log('After toggle should be:', { id, hasBlocker: !task.hasBlocker });
    }
  };;

  const takeBreak = (): void => {
    setLastBreak(Date.now());
    setIsTimerRunning(false);
    setFocusSeconds(0);
    setShowBreakReminder(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateUptime = (): number => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    const taskScore = (completed / tasks.length) * 50;
    const energyScore = (energy / 5) * 25;
    const blockers = tasks.filter(t => t.hasBlocker && !t.completed).length;
    const blockerPenalty = blockers * 10;
    const focusMinutes = Math.floor(focusSeconds / 60);
    const sustainableBonus = (focusMinutes > 120 || lastBreak) ? 0 : 10;
    const breakBonus = lastBreak ? 15 : 0;
    const total = taskScore + energyScore - blockerPenalty + sustainableBonus + breakBonus;
    return Math.max(0, Math.min(100, Math.round(total)));
  };

  // Test smart account transaction
  const handleTestTransaction = async () => {
    if (!smartAccount) {
      alert('Smart account not initialized. Please connect your wallet first.');
      return;
    }

    if (!testRecipient || !testAmount) {
      alert('Please enter recipient and amount');
      return;
    }

    try {
      // TODO: Uncomment when hooks are ready
      // await sendUserOperation(testRecipient, testAmount);
      alert('Smart account hooks not yet connected. Please implement useMetaMaskSmartAccount and useUserOperation hooks.');
      setShowTestTransaction(false);
    } catch (err) {
      alert('Error: ' + (err as Error).message);
    }
  };

  const uptime = calculateUptime();
  const energyEmojis = ['😫', '😔', '😐', '😊', '🚀'];
  const energyLabels = ['Exhausted', 'Low', 'Okay', 'Good', 'Peak'];

  // Timeline data - only showing current uptime
  // TODO: Implement persistent storage to track historical data
  const timelineData = {
    week: [
      { label: 'Mon', uptime: 0 },
      { label: 'Tue', uptime: 0 },
      { label: 'Wed', uptime: 0 },
      { label: 'Thu', uptime: 0 },
      { label: 'Fri', uptime: 0 },
      { label: 'Sat', uptime: 0 },
      { label: 'Today', uptime: uptime },
    ],
    month: [
      { label: 'W1', uptime: 0 },
      { label: 'W2', uptime: 0 },
      { label: 'W3', uptime: 0 },
      { label: 'W4', uptime: 0 },
    ],
  };

  const currentData = timelineData[timelineView];
  const averageUptime = uptime; // Only current session data available

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl"></div>
        <div className="hidden lg:block absolute top-1/2 left-1/4 w-64 h-64 bg-purple-500/3 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative border-b border-gray-800/50 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8 py-3 md:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <img
              src="./logo.png"
              alt="Builder Uptime Logo"
              className="w-8 h-8 md:w-10 md:h-10 rounded-xl shadow-lg shadow-cyan-500/30 flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="font-bold text-sm md:text-base lg:text-lg truncate">Builder Uptime</div>
              <div className="text-xs text-gray-500 hidden md:block">Real Productivity Tracking</div>
            </div>
          </div>

          <div className="flex items-center gap-2">

            {/* AI Coach Button */}
            {authenticated && (
              <button
                onClick={() => setShowChat(true)}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-purple-400 hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
              >
                💬 AI Coach
              </button>
            )}

            {/* Smart Account Badge */}
            {authenticated && smartAccount && (
              <button
                onClick={() => setShowSmartAccountInfo(!showSmartAccountInfo)}
                className="px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-purple-400 hover:from-purple-500/30 hover:to-pink-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20"
              >
                🔐 Smart Account
              </button>
            )}

            {/* Creating Account Status */}
            {authenticated && isCreatingAccount && (
              <div className="px-3 md:px-4 py-1.5 md:py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg md:rounded-xl text-xs md:text-sm text-yellow-400">
                🔄 Creating Smart Account...
              </div>
            )}

            {/* Privy Connect Button with Farcaster Profile */}
            <button
              onClick={authenticated ? logout : login}
              disabled={!ready}
              className="px-3 md:px-5 py-1.5 md:py-2 bg-gradient-to-r from-cyan-500/20 to-orange-500/20 border border-cyan-500/50 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-cyan-400 hover:from-cyan-500/30 hover:to-orange-500/30 hover:shadow-lg hover:shadow-cyan-500/20 transition-all duration-300 whitespace-nowrap"
            >
              {!ready ? 'Loading...' : authenticated ? (
                <span className="flex items-center gap-2">
                  {farcasterPfp ? (
                    <>
                      <img
                        src={farcasterPfp}
                        alt={farcasterUsername || 'Profile'}
                        className="w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-cyan-400"
                      />
                      <span className="hidden md:inline">
                        {farcasterDisplayName || farcasterUsername || 'Connected'}
                      </span>
                      <span className="md:hidden">Connected</span>
                    </>
                  ) : walletAddress ? (
                    <>
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                      <span className="hidden md:inline">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                      <span className="md:hidden">Connected</span>
                    </>
                  ) : (
                    'Connected'
                  )}
                </span>
              ) : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </header>

      {/* AI Insight Panel */}
      {showAIInsight && analysis && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-cyan-500/10 border-2 border-cyan-500/50 rounded-2xl p-5 backdrop-blur-xl">
            <button
              onClick={() => setShowAIInsight(false)}
              className="float-right text-gray-400 hover:text-white"
            >
              ✕
            </button>
            <div className="flex items-start gap-4">
              <div className="text-4xl">🤖</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-cyan-400 mb-1">
                  AI Suggestion
                </div>
                <p className="text-white mb-2">{analysis.suggestion}</p>
                <p className="text-xs text-gray-400">{analysis.reasoning}</p>

                {analysis.needsBreak && (
                  <button
                    onClick={takeBreak}
                    className="mt-3 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-xl text-sm font-bold text-green-400"
                  >
                    🌱 Take Break Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Account Info Panel */}
      {showSmartAccountInfo && smartAccount && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/50 rounded-2xl p-6 backdrop-blur-xl">
            <button
              onClick={() => setShowSmartAccountInfo(false)}
              className="float-right text-gray-400 hover:text-white text-xl"
            >
              ✕
            </button>
            <div className="flex items-start gap-4">
              <div className="text-5xl">🔐</div>
              <div className="flex-1 space-y-4">
                <div>
                  <div className="text-xl font-semibold text-purple-400 mb-2">
                    MetaMask Smart Account Active
                  </div>
                  <p className="text-sm text-gray-400">
                    Your account is powered by ERC-4337 Account Abstraction
                  </p>
                </div>

                <div className="grid gap-3">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
                      EOA Address (Privy Wallet)
                    </div>
                    <div className="font-mono text-sm bg-black/40 px-3 py-2 rounded-lg border border-gray-700">
                      {smartAccount.eoaAddress}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 font-semibold uppercase mb-1">
                      Smart Account Address
                    </div>
                    <div className="font-mono text-sm bg-black/40 px-3 py-2 rounded-lg border border-gray-700">
                      {smartAccount.smartAccountAddress}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowTestTransaction(true)}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/50 rounded-xl text-sm font-semibold text-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30 transition-all"
                  >
                    🚀 Test Transaction
                  </button>

                  <a
                    href={`https://sepolia.etherscan.io/address/${smartAccount.smartAccountAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-xl text-sm font-medium text-gray-300 hover:bg-gray-700 transition-all"
                  >
                    🔍 View on Explorer
                  </a>
                </div>

                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 text-sm text-gray-300">
                  <div className="font-semibold text-purple-400 mb-2">✨ Smart Account Features:</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Gasless transactions with paymasters</li>
                    <li>• Batch multiple operations in one transaction</li>
                    <li>• Delegate permissions to other accounts</li>
                    <li>• Social recovery and multi-sig support</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Break Reminder */}
      {showBreakReminder && (
        <div className="fixed top-16 md:top-20 left-1/2 transform -translate-x-1/2 z-50 animate-bounce px-4 w-full max-w-md">
          <div className="bg-gradient-to-r from-green-500/95 to-emerald-500/95 backdrop-blur-xl border-2 border-green-400 rounded-2xl shadow-2xl shadow-green-500/50 p-4 md:p-6">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="text-3xl md:text-4xl flex-shrink-0">🌱</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">Time for a Break!</h3>
                <p className="text-green-50 text-sm mb-4">
                  You've been focusing for {Math.floor(focusSeconds / 60)} minutes. Take a 15-20 minute break!
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={takeBreak}
                    className="flex-1 px-4 py-2 bg-white text-green-600 rounded-xl font-bold hover:bg-green-50 transition-all duration-300 text-sm"
                  >
                    Take Break
                  </button>
                  <button
                    onClick={() => setShowBreakReminder(false)}
                    className="px-4 py-2 bg-green-600/30 text-white rounded-xl font-medium hover:bg-green-600/50 transition-all duration-300 text-sm"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Transaction Modal */}
      {showTestTransaction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-cyan-500/50 rounded-2xl p-6 max-w-md w-full">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-cyan-400">Test Transaction</h3>
                <p className="text-sm text-gray-400">Send a test user operation</p>
              </div>
              <button
                onClick={() => setShowTestTransaction(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Recipient Address</label>
                <input
                  type="text"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 mb-2 block">Amount (ETH)</label>
                <input
                  type="text"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  placeholder="0.001"
                  className="w-full px-4 py-3 bg-black/50 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500 text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleTestTransaction}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg hover:shadow-cyan-500/50"
                >
                  Send
                </button>
                <button
                  onClick={() => setShowTestTransaction(false)}
                  className="px-6 py-3 bg-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-600 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 md:px-6 lg:px-8 py-6 md:py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

          {/* Left Column - Hero + Stats */}
          <div className="lg:col-span-5 space-y-6">
            {/* Hero Section */}
            <section className="relative">
              <div className="text-center space-y-6 md:space-y-8">
                {/* Live Uptime Display */}
                <div className="relative inline-block">
                  <div className={`absolute inset-0 blur-2xl opacity-30 ${uptime >= 80 ? 'bg-cyan-500' : uptime >= 50 ? 'bg-orange-500' : 'bg-red-500'
                    }`}></div>

                  <svg className="relative w-40 h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 mx-auto transform -rotate-90">
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="currentColor"
                      strokeWidth="10"
                      fill="none"
                      className="text-gray-800/50 lg:hidden"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="82"
                      stroke="currentColor"
                      strokeWidth="10"
                      fill="none"
                      className="text-gray-800/50 hidden md:block lg:hidden"
                    />
                    <circle
                      cx="112"
                      cy="112"
                      r="94"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      className="text-gray-800/50 hidden lg:block"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="70"
                      stroke="url(#progressGradient)"
                      strokeWidth="10"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 70}`}
                      strokeDashoffset={`${2 * Math.PI * 70 * (1 - uptime / 100)}`}
                      className="transition-all duration-700 ease-out lg:hidden"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))' }}
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="82"
                      stroke="url(#progressGradient)"
                      strokeWidth="10"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 82}`}
                      strokeDashoffset={`${2 * Math.PI * 82 * (1 - uptime / 100)}`}
                      className="transition-all duration-700 ease-out hidden md:block lg:hidden"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.5))' }}
                    />
                    <circle
                      cx="112"
                      cy="112"
                      r="94"
                      stroke="url(#progressGradient)"
                      strokeWidth="12"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 94}`}
                      strokeDashoffset={`${2 * Math.PI * 94 * (1 - uptime / 100)}`}
                      className="transition-all duration-700 ease-out hidden lg:block"
                      style={{ filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.6))' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-5xl md:text-6xl lg:text-7xl font-black bg-gradient-to-r from-cyan-400 to-orange-400 bg-clip-text text-transparent">{uptime}%</span>
                    <span className="text-xs md:text-sm text-gray-400 font-medium tracking-wide uppercase mt-1">Uptime</span>
                  </div>
                </div>

                {/* Catchphrase */}
                <div className="inline-flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-cyan-950/60 to-orange-950/60 border border-cyan-500/30 rounded-full backdrop-blur-sm shadow-lg shadow-cyan-500/10">
                  <span className="relative flex h-2 w-2 md:h-2.5 md:w-2.5 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-full w-full bg-cyan-500"></span>
                  </span>
                  <span className="text-cyan-400 font-semibold text-xs md:text-sm">99.99% uptime or we're not doing it right</span>
                </div>

                <div>
                  <h1 className="text-2xl md:text-4xl lg:text-5xl font-black mb-2 md:mb-3 leading-tight px-2">
                    Track What <span className="bg-gradient-to-r from-cyan-400 via-cyan-300 to-orange-400 bg-clip-text text-transparent">Actually</span> Ships
                  </h1>
                  <p className="text-gray-400 text-sm md:text-base px-4 hidden md:block">
                    Tasks · Energy · Focus · Sustainable Pace
                  </p>

                </div>
              </div>
            </section>

            {/* Productivity Factors */}
            <section className="space-y-4">
              {/* Energy Level */}
              <div className="group relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-gray-700/50 rounded-2xl p-5 md:p-6 backdrop-blur-sm hover:border-cyan-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/5 group-hover:to-transparent rounded-2xl transition-all duration-300"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Energy Level</div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-5xl md:text-4xl">{energyEmojis[energy - 1]}</span>
                    <span className="text-xl md:text-lg font-bold text-cyan-400">{energyLabels[energy - 1]}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={energy}
                      onChange={(e) => handleEnergyChange(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${(energy - 1) * 25}%, #1f2937 ${(energy - 1) * 25}%, #1f2937 100%)`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Focus Time */}
              <div className="group relative bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-gray-700/50 rounded-2xl p-5 md:p-6 backdrop-blur-sm hover:border-orange-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/10">
                {focusSeconds >= 4800 && focusSeconds < 5400 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                )}
                {focusSeconds >= 5400 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-transparent rounded-2xl transition-all duration-300"></div>
                <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Focus Session</div>
                    {focusSeconds >= 4800 && focusSeconds < 5400 && (
                      <span className="text-xs text-yellow-400">• Break soon</span>
                    )}
                    {focusSeconds >= 5400 && (
                      <span className="text-xs text-green-400">• Break recommended</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl md:text-4xl font-black bg-gradient-to-r from-orange-400 to-cyan-400 bg-clip-text text-transparent">{formatTime(focusSeconds)}</span>
                    </div>
                    <button
                      onClick={() => setIsTimerRunning(!isTimerRunning)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 whitespace-nowrap ${isTimerRunning
                        ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/50 shadow-lg shadow-orange-500/20'
                        : 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/20'
                        }`}
                    >
                      {isTimerRunning ? '⏸ Pause' : '▶ Start'}
                    </button>
                  </div>
                  {focusSeconds >= 5400 && (
                    <button
                      onClick={takeBreak}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50 rounded-xl text-sm font-semibold text-green-400 hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20"
                    >
                      🌱 Take Break
                    </button>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column - Tasks + Timeline */}
          <div className="lg:col-span-7 space-y-6">
            {/* Task Tracker */}
            <section className="relative">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-gray-700/50 rounded-2xl p-4 md:p-6 backdrop-blur-sm shadow-2xl">

                {/* Add Task */}
                <div className="flex gap-2 mb-4 md:mb-6">
                  <input
                    type="text"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                    placeholder="What are you building?"
                    className="flex-1 px-3 md:px-4 py-3 md:py-3.5 bg-black/50 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:shadow-lg focus:shadow-cyan-500/20 transition-all duration-300 text-sm placeholder-gray-600"
                  />
                  <button
                    onClick={handleAddTask}
                    className="px-4 md:px-6 py-3 md:py-3.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 text-sm shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-105 whitespace-nowrap"
                  >
                    Add
                  </button>
                </div>

                {/* Task List */}
                <div className="space-y-2.5 mb-4 md:mb-6">
                  {tasks.length === 0 ? (
                    // WELCOME / EMPTY STATE
                    <div className="text-center py-12 px-4">
                      <div className="relative inline-block mb-6">
                        {/* Animated circle */}
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-orange-500/20 blur-2xl animate-pulse"></div>
                        <div className="relative text-6xl md:text-7xl">📋</div>
                      </div>

                      <h3 className="text-xl md:text-2xl font-bold mb-3 bg-gradient-to-r from-cyan-400 to-orange-400 bg-clip-text text-transparent">
                        Ready to track your uptime?
                      </h3>

                      <p className="text-gray-400 mb-6 max-w-md mx-auto">
                        Add your first task to start building sustainably. We'll help you track progress and avoid burnout.
                      </p>

                      {/* Quick start tips */}
                      <div className="flex flex-col sm:flex-row gap-3 justify-center text-sm">
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
                          <span className="text-cyan-400">✓</span>
                          <span className="text-gray-300">Track tasks</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
                          <span className="text-orange-400">✓</span>
                          <span className="text-gray-300">Spot blockers</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg border border-gray-700">
                          <span className="text-purple-400">✓</span>
                          <span className="text-gray-300">AI insights</span>
                        </div>
                      </div>

                      {/* Arrow pointing to input */}
                      <div className="mt-8 text-cyan-400 animate-bounce">
                        <span className="text-2xl">↑</span>
                        <p className="text-xs mt-1 text-gray-500">Start by adding a task above</p>
                      </div>
                    </div>
                  ) : (
                    // EXISTING TASK LIST
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className={`group p-3 md:p-4 rounded-xl border-2 transition-all duration-300 ${task.completed
                          ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                          : task.hasBlocker
                            ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/40 shadow-lg shadow-red-500/10'
                            : 'bg-black/40 border-gray-700 hover:border-gray-600 hover:bg-black/60'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleTask(task.id)}
                            className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-300 flex-shrink-0 ${task.completed
                              ? 'bg-gradient-to-br from-cyan-500 to-blue-500 border-cyan-500 shadow-lg shadow-cyan-500/50'
                              : 'border-gray-600 hover:border-cyan-500 hover:scale-110'
                              }`}
                          >
                            {task.completed && <span className="text-white text-xs font-bold">✓</span>}
                          </button>
                          <span className={`flex-1 text-sm font-medium transition-all duration-300 ${task.completed ? 'line-through text-gray-500' : 'text-gray-200'
                            }`}>
                            {task.text}
                          </span>
                          <button
                            onClick={() => toggleBlocker(task.id)}
                            className={`text-lg px-2.5 py-1 rounded-lg transition-all duration-300 flex-shrink-0 ${task.hasBlocker
                              ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/50 shadow-lg shadow-red-500/20 scale-110'
                              : 'text-gray-600 hover:text-gray-400 hover:scale-110'
                              }`}
                          >
                            {task.hasBlocker ? '🚨' : '⚠️'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Stats */}
                <div className="pt-4 md:pt-5 border-t border-gray-700/50 grid grid-cols-3 gap-3 md:gap-4">
                  <div className="text-center p-3 bg-black/40 rounded-xl">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Tasks</div>
                    <div className="text-lg md:text-xl font-black bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                      {tasks.filter(t => t.completed).length}/{tasks.length}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-black/40 rounded-xl">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Blockers</div>
                    <div className="text-lg md:text-xl font-black text-red-400">
                      {tasks.filter(t => t.hasBlocker).length}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-black/40 rounded-xl">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Uptime</div>
                    <div className={`text-lg md:text-xl font-black ${uptime >= 80 ? 'text-cyan-400' : 'text-orange-400'}`}>
                      {uptime}%
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Uptime Timeline */}
            <section className="relative">
              <div className="bg-gradient-to-br from-gray-900/80 to-gray-800/80 border border-gray-700/50 rounded-2xl p-4 md:p-6 backdrop-blur-sm shadow-2xl">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold mb-1">Uptime Overview</h3>
                    <p className="text-sm text-gray-400">
                      Current Session: <span className={`font-bold ${uptime >= 80 ? 'text-cyan-400' : 'text-orange-400'}`}>{uptime}%</span>
                      <span className="text-xs text-gray-600 ml-2">(Historical data not yet tracked)</span>
                    </p>
                  </div>
                  <div className="flex gap-1 bg-black/50 p-1 rounded-xl w-full md:w-auto">
                    <button
                      onClick={() => setTimelineView('week')}
                      className={`flex-1 md:flex-none px-4 md:px-3 py-2 md:py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${timelineView === 'week'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-gray-400 hover:text-gray-300'
                        }`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => setTimelineView('month')}
                      className={`flex-1 md:flex-none px-4 md:px-3 py-2 md:py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${timelineView === 'month'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                        : 'text-gray-400 hover:text-gray-300'
                        }`}
                    >
                      Month
                    </button>
                  </div>
                </div>

                {/* Chart */}
                <div className="mb-4 md:mb-6">
                  <div className="flex items-end justify-between gap-1.5 md:gap-2 h-40 md:h-48">
                    {currentData.map((data, idx) => (
                      <div key={idx} className="group flex-1 flex flex-col items-center justify-end gap-2">
                        <div className="relative w-full">
                          <div className="w-full bg-gray-800 rounded-t-lg overflow-hidden" style={{ height: '10rem' }}>
                            <div
                              className={`w-full rounded-t-lg transition-all duration-700 group-hover:opacity-80 ${data.uptime >= 80
                                ? 'bg-gradient-to-t from-cyan-500 to-blue-500'
                                : data.uptime >= 60
                                  ? 'bg-gradient-to-t from-orange-500 to-yellow-500'
                                  : 'bg-gradient-to-t from-red-500 to-orange-500'
                                }`}
                              style={{
                                height: `${data.uptime}%`,
                                marginTop: 'auto',
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                              }}
                            />
                          </div>
                          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                            {data.uptime}%
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 font-medium">{data.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Chat Modal */}
      {showChat && authenticated && user?.id && (
        <BuilderChat
          userId={user.id}
          tasksCompleted={tasks.filter(t => t.completed).length}
          streakDays={0}
          currentEnergy={energy}
          onClose={() => setShowChat(false)}
        />
      )}
    </div>
  );
}

