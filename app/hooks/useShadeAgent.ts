import { useState } from 'react';

const SHADE_AGENT_URL = import.meta.env.VITE_SHADE_AGENT_URL || 'http://localhost:3000';

interface WellnessData {
  userId: string;
  taskId: string;
  moodBefore?: number;
  moodAfter?: number;
  energyLevel: number;
  focusQuality?: number;
  notes?: string;
}

interface ChatMessage {
  userId: string;
  message: string;
  context?: {
    tasksCompleted: number;
    streakDays: number;
    currentEnergy: number;
  };
}

interface HistoricalMessage {
  role: string;
  content: string;
  timestamp: string;
}

export function useShadeAgent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logWellness = async (data: WellnessData) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${SHADE_AGENT_URL}/api/log-wellness`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to log wellness data');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error logging wellness:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const chat = async (data: ChatMessage) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${SHADE_AGENT_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to chat with agent');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error chatting with agent:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getChatHistory = async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${SHADE_AGENT_URL}/api/chat-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to get chat history');
      }

      const result = await response.json();
      return result.messages as HistoricalMessage[];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error getting chat history:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const clearChatHistory = async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${SHADE_AGENT_URL}/api/clear-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to clear chat history');
      }

      const result = await response.json();
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error clearing chat history:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const getWeeklyInsights = async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${SHADE_AGENT_URL}/api/weekly-insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to get weekly insights');
      }

      const result = await response.json();
      return result;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    logWellness,
    chat,
    getChatHistory,
    clearChatHistory,
    getWeeklyInsights,
    isLoading,
    error,
  };
}