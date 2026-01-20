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
  const [sessionStartTime] = useState(Date.now());
  const [messageCount, setMessageCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { chat, getChatHistory, clearChatHistory, isLoading } = useShadeAgent();
  const { 
    isListening, 
    transcript, 
    isSupported: voiceSupported, 
    startListening, 
    stopListening 
  } = useVoiceInput();

  // Track chat session metrics for Opik
  const trackChatMetric = useCallback(async (eventType: string, metadata: any = {}) => {
    try {
      // Send analytics event to backend for Opik tracking
      await fetch(`${import.meta.env.VITE_SHADE_AGENT_URL || 'http://localhost:3000'}/api/chat-analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          eventType,
          sessionDuration: Date.now() - sessionStartTime,
          messageCount,
          currentEnergy,
          metadata,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to track chat metric:', error);
    }
  }, [userId, sessionStartTime, messageCount, currentEnergy]);

  // Update input when voice transcript changes
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
      trackChatMetric('voice_input_used', { transcriptLength: transcript.length });
    }
  }, [transcript, trackChatMetric]);

  // Auto-scroll to bottom
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
          
          trackChatMetric('chat_history_loaded', { 
            messageCount: loadedMessages.length,
            loadTimeMs: Date.now() - loadStartTime
          });
        } else {
          const hour = new Date().getHours();
          const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
          
          setMessages([{
            role: 'assistant',
            content: `Good ${greeting}! 👋 How's your building going today?`,
            timestamp: new Date(),
          }]);
          
          trackChatMetric('new_chat_session');
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        trackChatMetric('chat_history_load_failed', { 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        
        setMessages([{
          role: 'assistant',
          content: `Good ${greeting}! 👋 How's your building going today?`,
          timestamp: new Date(),
        }]);
      } finally {
        if (mounted) {
          setIsLoadingHistory(false);
        }
      }
    }

    loadHistory();

    return () => {
      mounted = false;
      // Track session end
      trackChatMetric('chat_session_ended', { 
        duration: Date.now() - sessionStartTime,
        totalMessages: messageCount
      });
    };
  }, []);

  const sendMessage = useCallback(async (quickAction?: string) => {
    const messageToSend = quickAction || input.trim();
    if (!messageToSend || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setMessageCount(prev => prev + 1);

    if (isListening) {
      stopListening();
    }

    const sendStartTime = Date.now();

    try {
      // Track message sent
      trackChatMetric('message_sent', { 
        messageLength: messageToSend.length,
        isQuickAction: !!quickAction,
        usedVoice: isListening
      });

      const response = await chat({
        userId,
        message: messageToSend,
        context: {
          tasksCompleted,
          streakDays,
          currentEnergy,
        },
      });

      const responseTime = Date.now() - sendStartTime;

      if (response?.message || response?.reply) {
        const assistantMessage = response.message || response.reply;
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date(),
        }]);

        // Track successful response
        trackChatMetric('message_received', { 
          responseTimeMs: responseTime,
          responseLength: assistantMessage.length
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      // Track error
      trackChatMetric('message_failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        attemptTimeMs: Date.now() - sendStartTime
      });
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, isLoading, isListening, userId, tasksCompleted, streakDays, currentEnergy, chat, stopListening, trackChatMetric]);

  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      trackChatMetric('voice_stopped');
    } else {
      startListening();
      trackChatMetric('voice_started');
    }
  }, [isListening, startListening, stopListening, trackChatMetric]);

  const handleClearHistory = useCallback(async () => {
    if (confirm('Clear all conversation history? This cannot be undone.')) {
      await clearChatHistory(userId);
      trackChatMetric('chat_history_cleared', { messageCount: messages.length });
      
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      setMessages([{
        role: 'assistant',
        content: `Good ${greeting}! 👋 Starting fresh. How's your building going?`,
        timestamp: new Date(),
      }]);
      setMessageCount(0);
    }
  }, [userId, clearChatHistory, messages.length, trackChatMetric]);

  const quickActions = [
    { text: "feeling burnt out tbh", emoji: "😓" },
    { text: "in flow state rn!", emoji: "⚡" },
    { text: "stuck on this bug", emoji: "🐛" },
    { text: "shipped it!", emoji: "🚀" },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border-t-2 sm:border-2 border-cyan-500/50 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl lg:max-w-3xl h-[90vh] sm:h-[600px] lg:h-[700px] flex flex-col shadow-2xl">
        
        {/* Header - Responsive */}
        <div className="p-3 sm:p-4 lg:p-5 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-xl flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
              💬
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-white text-base sm:text-lg truncate">Builder Buddy</h3>
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-full w-full bg-green-500"></span>
                </span>
                <span className="truncate">Private AI in TEE</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              onClick={handleClearHistory}
              className="text-gray-400 hover:text-red-400 p-2 sm:p-2.5 text-lg sm:text-xl transition-colors"
              title="Clear chat history"
              aria-label="Clear chat history"
            >
              🗑️
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 sm:p-2.5 text-xl sm:text-2xl transition-colors"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Messages - Responsive spacing */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4">
          {isLoadingHistory ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                <div className="text-gray-400 text-sm sm:text-base">Loading history...</div>
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
                    className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] rounded-2xl p-3 sm:p-4 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                        : 'bg-gray-800 border border-gray-700 text-gray-100'
                    }`}
                  >
                    <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <span className="text-xs opacity-60 mt-1.5 block">
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
                  <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-gray-500 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions - Responsive horizontal scroll */}
        <div className="px-3 sm:px-4 lg:px-6 pb-2 sm:pb-3 flex overflow-x-auto gap-2 flex-shrink-0 scrollbar-hide -mx-3 sm:mx-0 px-3 sm:px-0">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                trackChatMetric('quick_action_used', { action: action.text });
                sendMessage(action.text);
              }}
              disabled={isLoading}
              className="px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 border border-gray-700 rounded-lg sm:rounded-xl text-xs sm:text-sm text-gray-300 transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="mr-1.5">{action.emoji}</span>
              <span className="hidden xs:inline sm:inline">{action.text}</span>
            </button>
          ))}
        </div>

        {/* Input Area - Responsive */}
        <div className="p-3 sm:p-4 lg:p-5 border-t border-gray-700 flex-shrink-0">
          {isListening && (
            <div className="mb-2 sm:mb-3 flex items-center gap-2 text-xs sm:text-sm text-cyan-400 animate-pulse">
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
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-black/50 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-sm sm:text-base resize-none transition-all"
              rows={1}
              disabled={isLoading || isListening}
              aria-label="Chat message input"
            />
            
            {voiceSupported && (
              <button
                onClick={handleVoiceToggle}
                disabled={isLoading}
                className={`p-2.5 sm:p-3 lg:p-3.5 rounded-xl font-bold transition-all text-lg sm:text-xl flex-shrink-0 ${
                  isListening
                    ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white animate-pulse'
                    : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/50 text-purple-400 hover:from-purple-500/30 hover:to-pink-500/30 active:scale-95'
                }`}
                aria-label={isListening ? "Stop listening" : "Start voice input"}
              >
                🎤
              </button>
            )}

            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-blue-400 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base flex-shrink-0"
              aria-label="Send message"
            >
              <span className="hidden xs:inline sm:inline">Send</span>
              <span className="inline xs:hidden sm:hidden">→</span>
            </button>
          </div>

          {/* Message count indicator */}
          <div className="mt-2 text-xs text-gray-500 text-center">
            {messageCount} {messageCount === 1 ? 'message' : 'messages'} this session
          </div>
        </div>
      </div>
    </div>
  );
}