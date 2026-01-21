import { useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_SHADE_AGENT_URL || 'http://localhost:3000';

interface Task {
  id: number;
  completed: boolean;
  hasBlocker: boolean;
}

interface Analysis {
  suggestion: string;
  reasoning: string;
  needsBreak: boolean;
}

export function useUptimeAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeUptime = async (
    userId: string,
    uptime: number,
    energy: number,
    tasks: Task[],
    focusMinutes: number
  ): Promise<Analysis | null> => {
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze-uptime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          uptime,
          energy,
          tasks,
          focusMinutes,
          blockers: tasks.filter(t => t.hasBlocker && !t.completed).length
        })
      });

      if (!response.ok) throw new Error('Failed to analyze');

      const data = await response.json();
      return data.analysis;
    } catch (error) {
      console.error('Analysis error:', error);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  return { analyzeUptime, isAnalyzing };
}