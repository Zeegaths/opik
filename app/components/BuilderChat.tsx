import { useState, useEffect, useRef, useCallback } from 'react';
import { useShadeAgent } from '~/hooks/useShadeAgent';
import { useVoiceInput } from '~/hooks/UseVoiceInput';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface BuilderChatProps {
  userId: string;
  tasksCompleted: number;
  streakDays: number;
  currentEnergy: number;
  onClose: () => void;
}

// Privacy-preserving analytics - sends metadata only, not content
async function trackChatAnalytics(eventType: string, metadata: Record<string, any>) {
  try {
    const API_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    await fetch(`${API_URL}/api/chat-analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType,
        timestamp: new Date().toISOString(),
        // Only metadata - NO message content for privacy
        metadata: {
          ...metadata,
          // Scrub any content that might leak
          messageContent: undefined,
          content: undefined,
        }
      }),
    });
  } catch (error) {
    // Silent fail - don't break UX for analytics
    console.debug('Analytics tracking failed:', error);
  }
}

export function BuilderChat({ 
  userId, 
  tasksCompleted, 
  streakDays, 
  currentEnergy,
  onClose 
}: BuilderChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Session tracking for analytics
  const sessionStartRef = useRef<Date>(new Date());
  const messageCountRef = useRef<number>(0);
  
  const { chat, getChatHistory, clearChatHistory, isLoading } = useShadeAgent();
  const { 
    isListening, 
    transcript, 
    isSupported: voiceSupported, 
    startListening, 
    stopListening 
  } = useVoiceInput();

  // Track session start
  useEffect(() => {
    sessionStartRef.current = new Date();
    trackChatAnalytics('session_started', {
      userId,
      currentEnergy,
      tasksCompleted,
      streakDays,
    });

    // Track session end on unmount
    return () => {
      const sessionDuration = Date.now() - sessionStartRef.current.getTime();
      trackChatAnalytics('session_ended', {
        userId,
        sessionDurationMs: sessionDuration,
        messageCount: messageCountRef.current,
        currentEnergy,
      });
    };
  }, []);

  // Update input when voice transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Load conversation history on mount
  useEffect(() => {
    let mounted = true;

    async function loadHistory() {
      setIsLoadingHistory(true);
      const loadStartTime = Date.now();
      
      try {
        const history = await getChatHistory(userId);
        
        if (!mounted) return;
        
        if (history && history.length > 0) {
          const loadedMessages = history.map((msg: any) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(loadedMessages);
          
          // Track history loaded - metadata only
          trackChatAnalytics('history_loaded', {
            userId,
            messageCount: history.length, // Count only, no content
            loadTimeMs: Date.now() - loadStartTime,
          });
        } else {
          const hour = new Date().getHours();
          const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
          
          setMessages([{
            role: 'assistant',
            content: `Good ${greeting}! 👋 How's your building going today?`,
            timestamp: new Date(),
          }]);
          
          trackChatAnalytics('new_session', {
            userId,
            timeOfDay: greeting,
          });
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        
        setMessages([{
          role: 'assistant',
          content: `Good ${greeting}! 👋 How's your building going today?`,
          timestamp: new Date(),
        }]);
        
        trackChatAnalytics('history_load_error', {
          userId,
          errorType: 'load_failed',
        });
      } finally {
        if (mounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadHistory();

    return () => {
      mounted = false;
    };
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const messageStartTime = Date.now();
    const usedVoice = isListening;

    const userMsg: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    const messageToSend = input;
    setInput('');
    setIsTyping(true);
    messageCountRef.current++;

    if (isListening) {
      stopListening();
    }

    // Track message sent - PRIVACY: only length, not content
    trackChatAnalytics('message_sent', {
      userId,
      messageLength: messageToSend.length, // Length only, no content!
      usedVoice,
      currentEnergy,
      messageNumber: messageCountRef.current,
    });

    try {
      const response = await chat({
        userId,
        message: messageToSend,
        context: {
          tasksCompleted,
          streakDays,
          currentEnergy,
        },
      });

      if (response?.reply) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.reply,
          timestamp: new Date(),
        }]);

        // Track response received - PRIVACY: timing & length only
        trackChatAnalytics('response_received', {
          userId,
          responseTimeMs: Date.now() - messageStartTime,
          responseLength: response.reply.length, // Length only!
          qualityScore: response.meta?.qualityScore, // From server evaluation
          crisisDetected: response.meta?.crisisSupport, // Safety flag only
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
        timestamp: new Date(),
      }]);
      
      // Track error - no content
      trackChatAnalytics('message_error', {
        userId,
        responseTimeMs: Date.now() - messageStartTime,
        errorType: 'chat_failed',
      });
    } finally {
      setIsTyping(false);
    }
  }, [input, isLoading, isListening, userId, tasksCompleted, streakDays, currentEnergy, chat, stopListening]);

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      trackChatAnalytics('voice_stopped', { userId });
    } else {
      startListening();
      trackChatAnalytics('voice_started', { userId });
    }
  }, [isListening, startListening, stopListening, userId]);

  const handleClearHistory = useCallback(async () => {
    if (confirm('Clear all conversation history? This cannot be undone.')) {
      const messageCount = messages.length;
      await clearChatHistory(userId);
      
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      setMessages([{
        role: 'assistant',
        content: `Good ${greeting}! 👋 Starting fresh. How's your building going?`,
        timestamp: new Date(),
      }]);
      
      // Track clear - count only
      trackChatAnalytics('history_cleared', {
        userId,
        previousMessageCount: messageCount,
      });
    }
  }, [userId, clearChatHistory, messages.length]);

  const quickActions = [
    { text: "feeling burnt out tbh", emoji: "😓", category: "burnout" },
    { text: "in flow state rn!", emoji: "⚡", category: "positive" },
    { text: "stuck on this bug", emoji: "🐛", category: "stuck" },
    { text: "shipped it!", emoji: "🚀", category: "achievement" },
  ];

  const handleQuickAction = useCallback((action: typeof quickActions[0]) => {
    // Track quick action - category only, not exact text
    trackChatAnalytics('quick_action_used', {
      userId,
      actionCategory: action.category, // Category, not exact content
      currentEnergy,
    });
    
    setInput(action.text);
    setTimeout(() => sendMessage(), 100);
  }, [userId, currentEnergy, sendMessage]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-t-2 md:border-2 border-cyan-500/50 rounded-t-3xl md:rounded-2xl w-full md:w-full md:max-w-2xl h-[85vh] md:h-[600px] flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-lg md:rounded-xl flex items-center justify-center text-lg md:text-xl">
              💬
            </div>
            <div>
              <h3 className="font-bold text-white text-sm md:text-base">Builder Buddy</h3>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-full w-full bg-green-500"></span>
                </span>
                <span className="text-xs">Private AI in TEE 🔒</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClearHistory}
              className="text-gray-400 hover:text-red-400 text-sm p-2"
              title="Clear chat history"
            >
              🗑️
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl md:text-2xl p-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
          {isLoadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                <div className="text-gray-400 text-sm">Loading history...</div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={`${msg.role}-${i}-${msg.timestamp.getTime()}`}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[80%] rounded-2xl p-2.5 md:p-3 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                        : 'bg-gray-800 border border-gray-700 text-gray-100'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <span className="text-xs opacity-60 mt-1 block">
                      {msg.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="px-3 md:px-4 pb-2 flex overflow-x-auto gap-2 flex-shrink-0 scrollbar-hide">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(action)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-50"
            >
              {action.emoji} {action.text}
            </button>
          ))}
        </div>

        {/* Input Area with Voice */}
        <div className="p-3 md:p-4 border-t border-gray-700 flex-shrink-0">
          {isListening && (
            <div className="mb-2 flex items-center gap-2 text-xs text-cyan-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Listening... speak now
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={isListening ? "Listening..." : "How's your day going?"}
              className="flex-1 px-3 md:px-4 py-2 md:py-3 bg-black/50 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500 text-sm resize-none"
              rows={1}
              disabled={isLoading || isListening}
            />
            
            {voiceSupported && (
              <button
                onClick={handleVoiceToggle}
                disabled={isLoading}
                className={`p-2 md:p-3 rounded-xl font-bold transition-all text-sm md:text-base flex-shrink-0 ${
                  isListening
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white animate-pulse'
                    : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 text-purple-400 hover:from-purple-500/30 hover:to-pink-500/30'
                }`}
              >
                🎤
              </button>
            )}

            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base flex-shrink-0"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}